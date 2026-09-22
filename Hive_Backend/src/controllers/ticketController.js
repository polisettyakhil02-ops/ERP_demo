import Ticket from "../models/Ticket.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/ApiError.js";
import { sendMail } from "../utils/mailer.js";
import { regenerateTicketsExcel } from "../utils/ticketExcel.js";

const TYPE_LABELS = {
  bug: "Bug",
  feature: "New Feature",
  improvement: "Improvement",
};

// Overridable per environment - a hardcoded address means staging and
// production cannot differ, and changing who gets support mail needs a
// deploy.
const SUPPORT_INBOX = process.env.SUPPORT_INBOX || "dtggrouptech@gmail.com";

export const createTicket = asyncHandler(async (req, res) => {
  const { type, page, description } = req.body;

  if (!["bug", "feature", "improvement"].includes(type)) {
    throw new ApiError(400, "type must be one of bug, feature, improvement.");
  }
  if (!page || !page.trim()) {
    throw new ApiError(400, "page is required.");
  }
  if (!description || !description.trim()) {
    throw new ApiError(400, "description is required.");
  }

  const ticket = await Ticket.create({
    type,
    page: page.trim(),
    description: description.trim(),
    reporter_name: req.user.full_name,
    reporter_email: req.user.email,
    reporter_role: req.user.role,
    created_by: req.user._id,
  });

  // The ticket is already durably saved at this point - everything below is
  // a best-effort side effect (the tracking spreadsheet, the support-inbox
  // email) and must never turn this already-successful write into an
  // apparent failure. Previously these were awaited BEFORE responding, all
  // under the same asyncHandler - a single SMTP hiccup rejected the whole
  // request with a 500 even though the ticket existed, so the client's
  // success path (toast + list refresh) never ran and the new ticket only
  // ever showed up after a manual reload. Responding first, then running
  // these in their own try/catch, fixes that regardless of whether the
  // side effects themselves succeed.
  res.status(201).json({ success: true, data: ticket });

  // The spreadsheet and the email are INDEPENDENT side effects and get
  // their own try/catch. They used to share one block with the spreadsheet
  // first, so anything that broke the spreadsheet - a read-only data/
  // directory on the server, a disk-full, one malformed ticket row - threw
  // before sendMail was ever reached and silently took the support email
  // down with it. A spreadsheet problem should cost the attachment, not the
  // notification.
  let attachments = [];
  try {
    const ticketsFile = await regenerateTicketsExcel();
    const today = new Date().toISOString().slice(0, 10);
    attachments.push({
      filename: `tickets-${today}.xlsx`,
      path: ticketsFile,
    });
  } catch (err) {
    console.error(
      `ticket.createTicket: ticket ${ticket._id} saved, but regenerating the tracking spreadsheet failed - sending the support email without it:`,
      err,
    );
  }

  if (req.file) {
    attachments.push({
      filename: req.file.originalname,
      content: req.file.buffer,
      contentType: req.file.mimetype,
    });
  }

  try {
    const result = await sendMail({
      to: SUPPORT_INBOX,
      subject: `[${TYPE_LABELS[type]}] Support ticket from ${req.user.full_name}`,
      text: [
        `Type: ${TYPE_LABELS[type]}`,
        `Page: ${page.trim()}`,
        `Reporter: ${req.user.full_name} (${req.user.email})`,
        `Role: ${req.user.role}`,
        `Submitted: ${new Date().toLocaleString()}`,
        "",
        "Description:",
        description.trim(),
      ].join("\n"),
      attachments,
    });
    // sendMail resolves (rather than throwing) when SMTP is unconfigured -
    // without this branch that case logged nothing here and looked exactly
    // like a successful send.
    if (!result?.sent) {
      console.error(
        `ticket.createTicket: ticket ${ticket._id} saved, but the support email was NOT sent to ${SUPPORT_INBOX} - ${result?.reason || "unknown reason"}`,
      );
    } else {
      console.log(
        `ticket.createTicket: support email for ticket ${ticket._id} sent to ${SUPPORT_INBOX}`,
      );
    }
  } catch (err) {
    console.error(
      `ticket.createTicket: ticket ${ticket._id} saved, but sending the support email to ${SUPPORT_INBOX} failed:`,
      err,
    );
  }
});

// GET /api/tickets/mine?page=&limit=
export const getMyTickets = asyncHandler(async (req, res) => {
  const filter = { reporter_email: req.user.email, is_deleted: false };

  const pageNum = Math.max(parseInt(req.query.page, 10) || 1, 1);
  const pageSize = Math.max(parseInt(req.query.limit, 10) || 10, 1);
  const total = await Ticket.countDocuments(filter);

  const tickets = await Ticket.find(filter)
    .sort({ created_date: -1 })
    .select("type page description status created_date")
    .skip((pageNum - 1) * pageSize)
    .limit(pageSize);

  res.status(200).json({
    success: true,
    data: tickets,
    meta: {
      total,
      page: pageNum,
      limit: pageSize,
      totalPages: Math.max(Math.ceil(total / pageSize), 1),
    },
  });
});

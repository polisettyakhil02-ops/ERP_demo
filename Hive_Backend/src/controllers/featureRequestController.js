// controllers/featureRequestController.js
//
// "Suggest a feature": staff chat with Claude about an idea (chat), submit
// the resulting draft (create), and follow its status (list). A Super Admin
// sees every request and moves it through review (update). Nothing here
// changes the app itself - requests are for the development team.

import Anthropic from "@anthropic-ai/sdk";
import FeatureRequest, {
  FEATURE_REQUEST_STATUSES,
} from "../models/FeatureRequest.js";
import { isAllowed } from "../rbac/permissions.js";
import { MULTI_BRANCH_ROLES, ROLES } from "../config/constants.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/ApiError.js";
import {
  isFeatureChatConfigured,
  normalizeDraft,
  runFeatureChat,
} from "../utils/featureChat.js";

const ENTITY = "FeatureRequest";

const MAX_TURNS = 40;
const MAX_USER_CHARS = 4000;
const MAX_ASSISTANT_CHARS = 8000;

function assertAllowed(user, action) {
  if (!isAllowed(ENTITY, action, user.role)) {
    throw new ApiError(
      403,
      "You do not have permission to manage feature requests.",
    );
  }
}

// The browser sends the whole chat each turn. It must alternate user /
// assistant, starting and ending with the user; an assistant turn may carry
// the draft it showed.
function validateHistory(messages) {
  if (
    !Array.isArray(messages) ||
    messages.length === 0 ||
    messages.length > MAX_TURNS
  ) {
    throw new ApiError(
      400,
      `Send between 1 and ${MAX_TURNS} chat messages. Start a new chat if this one is too long.`,
    );
  }
  const history = messages.map((m, i) => {
    const role = i % 2 === 0 ? "user" : "assistant";
    const max = role === "user" ? MAX_USER_CHARS : MAX_ASSISTANT_CHARS;
    if (!m || m.role !== role) {
      throw new ApiError(
        400,
        "Chat messages must alternate, starting with yours.",
      );
    }
    if (
      typeof m.content !== "string" ||
      !m.content.trim() ||
      m.content.length > max
    ) {
      throw new ApiError(
        400,
        `Each message must be between 1 and ${max} characters.`,
      );
    }
    const turn = { role, content: m.content.trim() };
    if (role === "assistant" && m.draft) {
      const draft = normalizeDraft(m.draft);
      if (draft) turn.draft = draft;
    }
    return turn;
  });
  if (history[history.length - 1].role !== "user") {
    throw new ApiError(400, "The last chat message must be yours.");
  }
  return history;
}

// Kept on the stored request for the reviewer - plain text only.
function sanitizeConversation(conversation) {
  if (!Array.isArray(conversation)) return [];
  return conversation
    .filter(
      (m) =>
        m &&
        ["user", "assistant"].includes(m.role) &&
        typeof m.content === "string" &&
        m.content.trim(),
    )
    .slice(0, MAX_TURNS + 1)
    .map((m) => ({
      role: m.role,
      content: m.content.trim().slice(0, MAX_ASSISTANT_CHARS),
    }));
}

// POST /api/feature-requests/chat
// body: { messages: [{ role, content, draft? }] } -> { reply, draft }
export const chat = asyncHandler(async (req, res) => {
  assertAllowed(req.user, "create");
  if (!isFeatureChatConfigured()) {
    throw new ApiError(
      503,
      "The AI assistant isn't set up yet. Ask your administrator to add an Anthropic API key.",
    );
  }
  const history = validateHistory(req.body.messages);

  try {
    const result = await runFeatureChat({
      history,
      requesterRole: req.user.role,
    });
    res.json({ success: true, data: result });
  } catch (err) {
    if (err instanceof Anthropic.RateLimitError) {
      throw new ApiError(
        429,
        "The AI assistant is busy right now. Please try again in a minute.",
      );
    }
    if (
      err instanceof Anthropic.AuthenticationError ||
      err instanceof Anthropic.PermissionDeniedError
    ) {
      console.error("[featureChat] Anthropic credentials rejected:", err.status);
      throw new ApiError(
        503,
        "The AI assistant isn't set up correctly. Ask your administrator to check the Anthropic API key.",
      );
    }
    if (err instanceof Anthropic.APIError) {
      console.error("[featureChat] Anthropic API error:", err.status, err.message);
      throw new ApiError(
        502,
        "The AI assistant couldn't answer just now. Please try again.",
      );
    }
    throw err;
  }
});

// POST /api/feature-requests
// body: the draft fields + conversation
export const create = asyncHandler(async (req, res) => {
  assertAllowed(req.user, "create");
  const draft = normalizeDraft(req.body);
  if (!draft) {
    throw new ApiError(400, "A title and summary are required.");
  }

  const doc = await FeatureRequest.create({
    ...draft,
    conversation: sanitizeConversation(req.body.conversation),
    requested_by: req.user._id,
    requester_name: req.user.full_name,
    requester_role: req.user.role,
    branch: MULTI_BRANCH_ROLES.includes(req.user.role)
      ? null
      : req.user.branch || null,
    created_by: req.user._id,
  });

  res.status(201).json({ success: true, data: doc });
});

// GET /api/feature-requests?status=
// Staff see their own requests; a Super Admin sees everyone's.
export const list = asyncHandler(async (req, res) => {
  assertAllowed(req.user, "read");
  const filter = { is_deleted: { $ne: true } };
  if (req.user.role !== ROLES.SUPER_ADMIN) {
    filter.requested_by = req.user._id;
  }
  if (req.query.status) {
    if (!FEATURE_REQUEST_STATUSES.includes(req.query.status)) {
      throw new ApiError(400, "Unknown status.");
    }
    filter.status = req.query.status;
  }

  const rows = await FeatureRequest.find(filter)
    .sort("-created_date")
    .limit(200)
    .populate("branch", "name")
    .lean();
  res.json({ success: true, data: rows });
});

// PUT /api/feature-requests/:id - Super Admin only (FeatureRequest.update
// lists no roles, see rbac/permissions.js).
// body: { status?, admin_notes? } - admin_notes is shown to the requester.
export const update = asyncHandler(async (req, res) => {
  assertAllowed(req.user, "update");
  const doc = await FeatureRequest.findOne({
    _id: req.params.id,
    is_deleted: { $ne: true },
  });
  if (!doc) throw new ApiError(404, "Feature request not found.");

  const { status, admin_notes } = req.body;
  if (status !== undefined) {
    if (!FEATURE_REQUEST_STATUSES.includes(status)) {
      throw new ApiError(400, "Unknown status.");
    }
    doc.status = status;
  }
  if (admin_notes !== undefined) {
    if (typeof admin_notes !== "string") {
      throw new ApiError(400, "admin_notes must be text.");
    }
    doc.admin_notes = admin_notes.trim().slice(0, 4000);
  }
  doc.reviewed_by = req.user._id;
  doc.reviewed_at = new Date();
  doc.updated_by = req.user._id;
  await doc.save();

  res.json({ success: true, data: doc });
});

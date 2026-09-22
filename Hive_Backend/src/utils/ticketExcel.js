import fs from "fs";
import path from "path";
import XLSX from "xlsx";
import Ticket from "../models/Ticket.js";

const DATA_DIR = path.resolve("data");
const TICKETS_FILE = path.join(DATA_DIR, "tickets.xlsx");

// Regenerated in full from the DB (the source of truth) on every new ticket,
// rather than appended to, so concurrent submissions can never corrupt or
// race on the file the way a shared read-modify-write append would.
export async function regenerateTicketsExcel() {
  fs.mkdirSync(DATA_DIR, { recursive: true });

  const tickets = await Ticket.find({ is_deleted: false })
    .sort({ created_date: -1 })
    .lean();

  const rows = tickets.map((t) => ({
    "Ticket ID": String(t._id),
    Type: t.type,
    Page: t.page,
    Description: t.description,
    "Reporter Name": t.reporter_name,
    "Reporter Email": t.reporter_email,
    "Reporter Role": t.reporter_role,
    Status: t.status,
    "Created At": new Date(t.created_date).toLocaleString(),
  }));

  const sheet = XLSX.utils.json_to_sheet(rows);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, sheet, "Tickets");
  XLSX.writeFile(workbook, TICKETS_FILE);

  return TICKETS_FILE;
}

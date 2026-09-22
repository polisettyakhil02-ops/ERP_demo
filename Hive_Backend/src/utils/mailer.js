import nodemailer from "nodemailer";

let transporter = null;

const REQUIRED_VARS = ["SMTP_HOST", "SMTP_USER", "SMTP_PASS"];

// Which of the required SMTP settings are missing, if any. Exported so the
// server can say so once at boot instead of leaving it to be discovered the
// next time somebody wonders why a support email never arrived.
export function missingMailConfig() {
  return REQUIRED_VARS.filter((v) => !process.env[v]);
}

export const isMailConfigured = () => missingMailConfig().length === 0;

function getTransporter() {
  if (transporter) return transporter;

  if (!isMailConfigured()) {
    return null;
  }

  transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT) || 587,
    secure: Number(process.env.SMTP_PORT) === 465,
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });

  return transporter;
}

// Resolves to { sent: false, reason } rather than throwing when SMTP is
// not configured - but every caller MUST check `sent`. An unchecked
// { sent: false } is indistinguishable from a delivered email, which is
// exactly how a mail outage stays invisible for weeks.
export async function sendMail({ to, subject, text, attachments }) {
  const t = getTransporter();
  if (!t) {
    const reason = `SMTP not configured - missing ${missingMailConfig().join(", ")}`;
    console.error(`[mailer] ${reason}. Email to ${to} was NOT sent.`);
    return { sent: false, reason };
  }

  await t.sendMail({
    from: process.env.SMTP_FROM || process.env.SMTP_USER,
    to,
    subject,
    text,
    attachments,
  });

  return { sent: true };
}

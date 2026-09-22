import dotenv from "dotenv";
import app from "./src/app.js";
import { connectDB } from "./src/config/db.js";
import { missingMailConfig } from "./src/utils/mailer.js";
dotenv.config();
const PORT = process.env.PORT || 5000;

async function start() {
  try {
    await connectDB();

    // Bind to 127.0.0.1 so Express only accepts requests proxied through Nginx
    // remove  127.0.0.1 in local
    // Outbound email is best-effort everywhere it is used, so a missing
    // SMTP block never fails a request - which means boot is the only place
    // it can reasonably be noticed.
    const missing = missingMailConfig();
    if (missing.length > 0) {
      console.error(
        `[mailer] SMTP is NOT configured - missing ${missing.join(", ")} in this environment's .env. Support ticket emails will be skipped silently.`,
      );
    } else {
      console.log(`[mailer] SMTP configured (${process.env.SMTP_HOST}).`);
    }

    app.listen(PORT, "127.0.0.1", () => {
      console.log(`Backend Running...`);
    });
  } catch (err) {
    console.error("Failed to start server:", err);
    process.exit(1);
  }
}

start();

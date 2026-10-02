require("dotenv").config();

const nodemailer = require("nodemailer");

function getRequiredEnv(name) {
  const value = process.env[name];
  if (!value || !String(value).trim()) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return String(value).trim();
}

function parseBooleanFlag(value, defaultValue) {
  if (value === undefined || value === null || value === "") return defaultValue;
  return ["1", "true", "yes", "on"].includes(String(value).trim().toLowerCase());
}

async function main() {
  const host = getRequiredEnv("SMTP_HOST");
  const port = Number(getRequiredEnv("SMTP_PORT"));
  const user = getRequiredEnv("SMTP_USER");
  const pass = getRequiredEnv("SMTP_PASS");
  const from = process.env.SMTP_FROM?.trim() || user;
  const to = process.env.CONTACT_RECIPIENT_EMAIL?.trim() || user;
  const secure = parseBooleanFlag(process.env.SMTP_SECURE, port === 465);

  const transporter = nodemailer.createTransport({
    host,
    port,
    secure,
    auth: { user, pass },
  });

  await transporter.verify();

  const info = await transporter.sendMail({
    from,
    to,
    envelope: {
      from: user,
      to,
    },
    subject: "Test email Il Forno d'Oro",
    text: [
      "Bonjour,",
      "",
      "Ceci est un test SMTP automatique depuis l'application click & collect.",
      "Si vous recevez ce message, la connexion mail Infomaniak fonctionne.",
    ].join("\n"),
  });

  console.log("Mail smoke ready");
  console.log({
    host,
    port,
    secure,
    user,
    from,
    to,
    messageId: info.messageId || null,
    accepted: info.accepted || [],
    rejected: info.rejected || [],
  });
}

main().catch((error) => {
  console.error("Mail smoke failed:", error.message);
  process.exitCode = 1;
});

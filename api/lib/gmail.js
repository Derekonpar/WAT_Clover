import nodemailer from "nodemailer";

function getTransport() {
  const user = (process.env.GMAIL_SENDER || process.env.GOOGLE_GMAIL_USER || "").trim();
  const pass = (process.env.GMAIL_APP_PASSWORD || process.env.GOOGLE_APP_PASSWORD || "").trim();
  if (!user || !pass) {
    throw new Error(
      "Gmail not configured. Set GMAIL_SENDER and GMAIL_APP_PASSWORD in .env (or Vercel env vars).",
    );
  }
  return nodemailer.createTransport({
    service: "gmail",
    auth: { user, pass },
  });
}

export async function sendOrderEmails(emailPreviews) {
  const transport = getTransport();
  const from = (process.env.GMAIL_SENDER || process.env.GOOGLE_GMAIL_USER || "").trim();
  const sent = [];

  for (const email of emailPreviews) {
    const info = await transport.sendMail({
      from: `Wild Axe Throwing <${from}>`,
      to: email.to,
      subject: email.subject,
      text: email.body,
    });
    sent.push({
      distributor: email.distributor,
      to: email.to,
      messageId: info.messageId,
    });
  }

  return sent;
}

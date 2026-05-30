import nodemailer from "nodemailer";

const FEEDBACK_RECEIVER = "bhandarideepakdev@gmail.com";

function getRequiredEnv(name: string) {
  const value = process.env[name];
  if (!value || value.trim().length === 0) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      name?: string;
      email?: string;
      message?: string;
    };

    const name = (body.name || "").trim();
    const email = (body.email || "").trim();
    const message = (body.message || "").trim();

    const emailLooksValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

    if (name.length < 2 || !emailLooksValid || message.length < 6) {
      return Response.json(
        { message: "Please complete all fields with valid values." },
        { status: 400 },
      );
    }

    const smtpHost = getRequiredEnv("FEEDBACK_SMTP_HOST");
    const smtpPort = Number.parseInt(getRequiredEnv("FEEDBACK_SMTP_PORT"), 10);
    const smtpUser = getRequiredEnv("FEEDBACK_SMTP_USER");
    const smtpPass = getRequiredEnv("FEEDBACK_SMTP_PASS");
    const fromEmail = process.env.FEEDBACK_FROM?.trim() || smtpUser;

    const transporter = nodemailer.createTransport({
      host: smtpHost,
      port: smtpPort,
      secure: smtpPort === 465,
      auth: {
        user: smtpUser,
        pass: smtpPass,
      },
    });

    const escapedName = escapeHtml(name);
    const escapedEmail = escapeHtml(email);
    const escapedMessage = escapeHtml(message).replace(/\n/g, "<br />");

    await transporter.sendMail({
      from: fromEmail,
      to: FEEDBACK_RECEIVER,
      replyTo: email,
      subject: `Website Feedback from ${name}`,
      text: [
        `Name: ${name}`,
        `Email: ${email}`,
        "",
        "Message:",
        message,
      ].join("\n"),
      html: `
        <h2>New Website Feedback</h2>
        <p><strong>Name:</strong> ${escapedName}</p>
        <p><strong>Email:</strong> ${escapedEmail}</p>
        <p><strong>Message:</strong><br />${escapedMessage}</p>
      `,
    });

    return Response.json({ message: "Feedback sent." });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Unable to send feedback right now.";

    return Response.json({ message }, { status: 500 });
  }
}

import nodemailer from "nodemailer";

export const runtime = "nodejs";

function getRequiredEnv(name: string) {
  const value = process.env[name];
  if (!value || value.trim().length === 0) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

function isAuthorized(request: Request) {
  const token = process.env.HEALTHCHECK_TOKEN?.trim();
  if (!token) return true;

  const provided = request.headers.get("x-healthcheck-token")?.trim();
  return provided === token;
}

async function verifyTransport() {
  const smtpHost = getRequiredEnv("FEEDBACK_SMTP_HOST");
  const smtpPort = Number.parseInt(getRequiredEnv("FEEDBACK_SMTP_PORT"), 10);
  const smtpUser = getRequiredEnv("FEEDBACK_SMTP_USER");
  const smtpPass = getRequiredEnv("FEEDBACK_SMTP_PASS");

  const transporter = nodemailer.createTransport({
    host: smtpHost,
    port: smtpPort,
    secure: smtpPort === 465,
    auth: {
      user: smtpUser,
      pass: smtpPass,
    },
  });

  await Promise.race([
    transporter.verify(),
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error("SMTP verify timeout")), 8000),
    ),
  ]);
}

export async function GET(request: Request) {
  if (!isAuthorized(request)) {
    return Response.json(
      { ok: false, error: "Unauthorized" },
      { status: 401 },
    );
  }

  try {
    await verifyTransport();
    return Response.json({ ok: true, message: "SMTP connection verified." });
  } catch (error) {
    const message = error instanceof Error ? error.message : "SMTP verification failed.";
    return Response.json({ ok: false, error: message }, { status: 500 });
  }
}

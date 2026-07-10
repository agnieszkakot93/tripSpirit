/**
 * Transactional email for password reset.
 *
 * Provider order:
 * 1. Resend (`RESEND_API_KEY`) — works without a custom domain (use
 *    `onboarding@resend.dev` for testing; verify your domain for production).
 * 2. Cloudflare Email Sending (`EMAIL` binding) — requires an onboarded sending
 *    domain (`npx wrangler email sending enable <your-domain>`).
 * 3. Dev fallback — log reset URL to the worker console.
 */

type SendPasswordResetArgs = {
  to: string;
  resetUrl: string;
};

function buildPasswordResetContent(resetUrl: string): {
  subject: string;
  text: string;
  html: string;
} {
  const subject = "Reset your TripSprint AI password";
  const text = [
    "We received a request to reset your TripSprint AI password.",
    "",
    `Reset it here: ${resetUrl}`,
    "",
    "This link expires in 1 hour. If you didn't request this, ignore this email.",
  ].join("\n");
  const html = [
    `<p>We received a request to reset your TripSprint AI password.</p>`,
    `<p><a href="${resetUrl}">Reset your password</a></p>`,
    `<p>This link expires in 1 hour. If you didn't request this, you can safely ignore this email.</p>`,
  ].join("");
  return { subject, text, html };
}

async function sendViaResend(
  apiKey: string,
  from: string,
  to: string,
  subject: string,
  text: string,
  html: string,
): Promise<void> {
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ from, to: [to], subject, text, html }),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Resend API ${res.status}: ${body || res.statusText}`);
  }
}

async function sendViaCloudflare(
  email: SendEmail,
  from: string,
  to: string,
  subject: string,
  text: string,
  html: string,
): Promise<void> {
  await email.send({ from, to, subject, text, html });
}

export async function sendPasswordResetEmail(
  env: Cloudflare.Env,
  { to, resetUrl }: SendPasswordResetArgs,
): Promise<void> {
  const from =
    env.EMAIL_FROM ?? "TripSprint AI <onboarding@resend.dev>";
  const { subject, text, html } = buildPasswordResetContent(resetUrl);

  if (env.RESEND_API_KEY) {
    await sendViaResend(env.RESEND_API_KEY, from, to, subject, text, html);
    return;
  }

  if (env.EMAIL) {
    await sendViaCloudflare(env.EMAIL, from, to, subject, text, html);
    return;
  }

  // Dev fallback when neither provider is configured.
  console.info("[dev] password reset URL:", resetUrl);
}

/**
 * Transactional email via Cloudflare Email Sending, with a dev fallback.
 *
 * In production the `EMAIL` (`send_email`) binding and an onboarded sending
 * domain are required. Local dev has no binding, so we log the reset URL to the
 * worker console and return without throwing (see AGENTS.md note).
 */

type SendPasswordResetArgs = {
  to: string;
  resetUrl: string;
};

export async function sendPasswordResetEmail(
  env: Cloudflare.Env,
  { to, resetUrl }: SendPasswordResetArgs,
): Promise<void> {
  if (!env.EMAIL) {
    // Dev fallback: never reachable in production (binding always present).
    console.info("[dev] password reset URL:", resetUrl);
    return;
  }

  const from = env.EMAIL_FROM ?? "noreply@localhost";
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

  await env.EMAIL.send({ from, to, subject, text, html });
}

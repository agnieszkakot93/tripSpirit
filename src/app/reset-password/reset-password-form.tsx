"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useState, type FormEvent } from "react";

import { MapPinIcon } from "@/components/icons";
import { LoaderInline } from "@/components/loader";

export function ResetPasswordForm() {
  const searchParams = useSearchParams();
  const token = searchParams.get("token");

  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [done, setDone] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!token) return;
    if (password !== confirm) {
      setError("Passwords do not match");
      return;
    }
    setError(null);
    setPending(true);
    try {
      const res = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        setError(data.error ?? "Could not reset password");
        return;
      }
      setDone(true);
    } finally {
      setPending(false);
    }
  }

  return (
    <main className="grid min-h-screen place-items-center bg-[var(--sidebar)] p-6">
      <div
        className="pointer-events-none fixed inset-0 opacity-40"
        style={{
          background:
            "radial-gradient(circle at top left, #ffd2ac, transparent 32%), radial-gradient(circle at bottom right, #f7b267, transparent 28%)",
        }}
      />

      <section className="relative w-full max-w-[460px] rounded-[36px] bg-[var(--surface)] p-9 shadow-[0_30px_100px_rgba(0,0,0,0.28)]">
        <div className="inline-flex items-center gap-2 rounded-full bg-[var(--foreground)] px-3 py-2 text-sm font-extrabold text-white">
          <MapPinIcon className="text-[var(--primary)]" />
          TripSprint AI
        </div>

        <h1 className="mt-5 text-4xl font-black leading-[0.95] tracking-tight text-[var(--foreground)]">
          Set a new password
        </h1>

        {!token ? (
          <>
            <p className="mt-3 leading-relaxed text-[var(--muted)]">
              This reset link is missing or invalid.
            </p>
            <p className="alert-error mt-6" role="alert">
              Request a new reset link from the sign-in page.
            </p>
            <p className="mt-6 text-center text-sm text-[var(--muted)]">
              <Link
                href="/login"
                className="font-semibold text-[var(--foreground)] underline"
              >
                Back to sign in
              </Link>
            </p>
          </>
        ) : done ? (
          <div className="mt-6 grid gap-4">
            <p className="alert-success">
              Your password has been reset. You can now sign in with your new
              password.
            </p>
            <Link href="/login" className="btn-primary w-full text-center">
              Go to sign in
            </Link>
          </div>
        ) : (
          <>
            <p className="mt-3 leading-relaxed text-[var(--muted)]">
              Choose a new password for your account.
            </p>

            {error ? (
              <p className="alert-error mt-5" role="alert">
                {error}
              </p>
            ) : null}

            <form className="mt-6 grid gap-3" onSubmit={handleSubmit}>
              <input
                type="password"
                required
                minLength={8}
                placeholder="New password"
                autoComplete="new-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="field-input"
              />
              <input
                type="password"
                required
                minLength={8}
                placeholder="Confirm new password"
                autoComplete="new-password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                className="field-input"
              />
              <button
                type="submit"
                disabled={pending}
                className="btn-primary mt-2 w-full"
              >
                {pending ? (
                  <LoaderInline label="Resetting…" />
                ) : (
                  "Reset password"
                )}
              </button>
            </form>
          </>
        )}
      </section>
    </main>
  );
}

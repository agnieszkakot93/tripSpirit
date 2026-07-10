"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { signIn } from "next-auth/react";
import { useState, type FormEvent } from "react";

import { MapPinIcon } from "@/components/icons";
import { LoaderInline } from "@/components/loader";

export function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get("callbackUrl") ?? "/trips";
  const accountDeleted = searchParams.get("deleted") === "1";

  const [mode, setMode] = useState<"signin" | "register" | "forgot">(
    searchParams.get("mode") === "register" ? "register" : "signin",
  );
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [remember, setRemember] = useState(false);
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  function switchMode(next: "signin" | "register" | "forgot") {
    setMode(next);
    setError(null);
  }

  async function handleRegister(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setPending(true);
    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password, name: name || undefined }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        setError(data.error ?? "Registration failed");
        return;
      }
      const signInResult = await signIn("credentials", {
        email,
        password,
        redirect: false,
      });
      if (signInResult?.error) {
        setError("Account created but sign-in failed. Try signing in.");
        switchMode("signin");
        return;
      }
      router.push(callbackUrl);
      router.refresh();
    } finally {
      setPending(false);
    }
  }

  async function handleSignIn(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setPending(true);
    try {
      const result = await signIn("credentials", {
        email,
        password,
        redirect: false,
      });
      if (result?.error) {
        setError("Invalid email or password");
        return;
      }
      router.push(callbackUrl);
      router.refresh();
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
          {mode === "register"
            ? "Create your account"
            : mode === "forgot"
              ? "Reset your password"
              : "Sign in"}
        </h1>
        <p className="mt-3 leading-relaxed text-[var(--muted)]">
          {mode === "register"
            ? "Create a trip, generate a day-by-day itinerary, then customize every day, activity, and cost."
            : mode === "forgot"
              ? "Password reset is coming soon."
              : "Plan smarter city breaks with AI-assisted itineraries."}
        </p>

        {mode !== "forgot" && (
          <div className="mt-6 flex gap-2 rounded-2xl bg-[var(--surface-muted)] p-1">
            <button
              type="button"
              className={`flex-1 rounded-xl px-3 py-2.5 text-sm font-semibold transition-colors ${
                mode === "signin"
                  ? "bg-white text-[var(--foreground)] shadow-sm"
                  : "text-[var(--muted)]"
              }`}
              onClick={() => switchMode("signin")}
            >
              Sign in
            </button>
            <button
              type="button"
              className={`flex-1 rounded-xl px-3 py-2.5 text-sm font-semibold transition-colors ${
                mode === "register"
                  ? "bg-white text-[var(--foreground)] shadow-sm"
                  : "text-[var(--muted)]"
              }`}
              onClick={() => switchMode("register")}
            >
              Register
            </button>
          </div>
        )}

        {accountDeleted ? (
          <p className="alert-success mt-5" role="status">
            Your account and all saved trips have been permanently deleted.
          </p>
        ) : null}

        {error ? (
          <p className="alert-error mt-5" role="alert">
            {error}
          </p>
        ) : null}

        {mode === "forgot" ? (
          <div className="mt-6 grid gap-4">
            <p className="alert-warning">Password reset coming soon.</p>
            <button
              type="button"
              onClick={() => switchMode("signin")}
              className="btn-ghost text-sm text-[var(--muted)]"
            >
              Back to sign in
            </button>
          </div>
        ) : (
          <form
            className="mt-6 grid gap-3"
            onSubmit={mode === "register" ? handleRegister : handleSignIn}
          >
            {mode === "register" ? (
              <input
                name="name"
                type="text"
                placeholder="Name (optional)"
                autoComplete="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="field-input"
              />
            ) : null}

            <input
              name="email"
              type="email"
              required
              placeholder="Email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="field-input"
            />

            <input
              name="password"
              type="password"
              required
              minLength={8}
              placeholder="Password"
              autoComplete={
                mode === "register" ? "new-password" : "current-password"
              }
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="field-input"
            />

            {mode === "signin" ? (
              <div className="flex items-center justify-between text-sm">
                <label className="flex items-center gap-2 text-[var(--muted)]">
                  <input
                    type="checkbox"
                    checked={remember}
                    onChange={(e) => setRemember(e.target.checked)}
                    className="rounded"
                  />
                  Remember me
                </label>
                <button
                  type="button"
                  onClick={() => switchMode("forgot")}
                  className="btn-ghost text-[var(--muted)] underline"
                >
                  Forgot password?
                </button>
              </div>
            ) : null}

            <button
              type="submit"
              disabled={pending}
              className="btn-primary mt-2 w-full"
            >
              {pending ? (
                <LoaderInline
                  label={
                    mode === "register" ? "Creating account…" : "Signing in…"
                  }
                />
              ) : mode === "register" ? (
                "Create account"
              ) : (
                "Sign in"
              )}
            </button>
          </form>
        )}

        <p className="mt-6 text-center text-sm text-[var(--muted)]">
          <Link href="/" className="font-semibold text-[var(--foreground)] underline">
            Back to home
          </Link>
        </p>
      </section>
    </main>
  );
}

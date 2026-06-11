"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { signIn } from "next-auth/react";
import { useState, type FormEvent } from "react";

export function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get("callbackUrl") ?? "/trips";

  const [mode, setMode] = useState<"signin" | "register" | "forgot">(
    searchParams.get("mode") === "register" ? "register" : "signin",
  );
  const [email, setEmail] = useState("");
  const [confirmEmail, setConfirmEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [deleted, setDeleted] = useState(false);

  function switchMode(next: "signin" | "register" | "forgot") {
    setMode(next);
    setError(null);
    setDeleted(false);
    setConfirmEmail("");
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

  async function handleDeleteAccount(e: FormEvent) {
    e.preventDefault();
    if (confirmEmail.trim().toLowerCase() !== email.trim().toLowerCase()) {
      setError("Emails do not match");
      return;
    }
    setError(null);
    setPending(true);
    try {
      const res = await fetch("/api/auth/delete-account", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim().toLowerCase() }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        setError(data.error ?? "Could not delete account");
        return;
      }
      setDeleted(true);
      setEmail("");
      setConfirmEmail("");
    } finally {
      setPending(false);
    }
  }

  const subtitle =
    mode === "signin"
      ? "Sign in to continue"
      : mode === "register"
        ? "Create an account with email and password"
        : "Delete your account so you can re-register";

  return (
    <main className="mx-auto flex min-h-full max-w-md flex-col justify-center gap-8 px-6 py-16">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
          TripSprint AI
        </h1>
        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
          {subtitle}
        </p>
      </div>

      {mode !== "forgot" && (
        <div className="flex gap-2 rounded-lg bg-zinc-100 p-1 dark:bg-zinc-900">
          <button
            type="button"
            className={`flex-1 rounded-md px-3 py-2 text-sm font-medium transition-colors ${
              mode === "signin"
                ? "bg-white text-zinc-900 shadow dark:bg-zinc-800 dark:text-zinc-50"
                : "text-zinc-600 dark:text-zinc-400"
            }`}
            onClick={() => switchMode("signin")}
          >
            Sign in
          </button>
          <button
            type="button"
            className={`flex-1 rounded-md px-3 py-2 text-sm font-medium transition-colors ${
              mode === "register"
                ? "bg-white text-zinc-900 shadow dark:bg-zinc-800 dark:text-zinc-50"
                : "text-zinc-600 dark:text-zinc-400"
            }`}
            onClick={() => switchMode("register")}
          >
            Register
          </button>
        </div>
      )}

      {error ? (
        <p
          className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800 dark:border-red-900 dark:bg-red-950 dark:text-red-200"
          role="alert"
        >
          {error}
        </p>
      ) : null}

      {mode === "forgot" ? (
        deleted ? (
          <div className="flex flex-col gap-4">
            <p className="rounded-md border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-800 dark:border-green-900 dark:bg-green-950 dark:text-green-200">
              Account deleted. You can now register a new account with the same
              email.
            </p>
            <button
              type="button"
              onClick={() => switchMode("register")}
              className="rounded-md bg-zinc-900 px-4 py-2.5 text-sm font-medium text-white dark:bg-zinc-100 dark:text-zinc-900"
            >
              Register now
            </button>
          </div>
        ) : (
          <form className="flex flex-col gap-4" onSubmit={handleDeleteAccount}>
            <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-200">
              This permanently deletes your account and all saved trips. There
              is no undo.
            </p>
            <label className="flex flex-col gap-1 text-sm">
              <span className="font-medium text-zinc-700 dark:text-zinc-300">
                Your email
              </span>
              <input
                type="email"
                required
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="rounded-md border border-zinc-300 bg-white px-3 py-2 text-zinc-900 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-50"
              />
            </label>
            <label className="flex flex-col gap-1 text-sm">
              <span className="font-medium text-zinc-700 dark:text-zinc-300">
                Type your email again to confirm
              </span>
              <input
                type="email"
                required
                autoComplete="off"
                value={confirmEmail}
                onChange={(e) => setConfirmEmail(e.target.value)}
                className="rounded-md border border-zinc-300 bg-white px-3 py-2 text-zinc-900 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-50"
              />
            </label>
            <button
              type="submit"
              disabled={pending}
              className="mt-2 rounded-md bg-red-600 px-4 py-2.5 text-sm font-medium text-white disabled:opacity-60 hover:bg-red-700"
            >
              {pending ? "Deleting…" : "Delete my account"}
            </button>
            <button
              type="button"
              onClick={() => switchMode("signin")}
              className="text-sm text-zinc-500 underline"
            >
              Cancel
            </button>
          </form>
        )
      ) : (
        <form
          className="flex flex-col gap-4"
          onSubmit={mode === "register" ? handleRegister : handleSignIn}
        >
          {mode === "register" ? (
            <label className="flex flex-col gap-1 text-sm">
              <span className="font-medium text-zinc-700 dark:text-zinc-300">
                Name (optional)
              </span>
              <input
                name="name"
                type="text"
                autoComplete="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="rounded-md border border-zinc-300 bg-white px-3 py-2 text-zinc-900 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-50"
              />
            </label>
          ) : null}
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium text-zinc-700 dark:text-zinc-300">
              Email
            </span>
            <input
              name="email"
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="rounded-md border border-zinc-300 bg-white px-3 py-2 text-zinc-900 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-50"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium text-zinc-700 dark:text-zinc-300">
              Password
            </span>
            <input
              name="password"
              type="password"
              required
              minLength={8}
              autoComplete={
                mode === "register" ? "new-password" : "current-password"
              }
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="rounded-md border border-zinc-300 bg-white px-3 py-2 text-zinc-900 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-50"
            />
          </label>
          <button
            type="submit"
            disabled={pending}
            className="mt-2 rounded-md bg-zinc-900 px-4 py-2.5 text-sm font-medium text-white disabled:opacity-60 dark:bg-zinc-100 dark:text-zinc-900"
          >
            {pending
              ? "Please wait…"
              : mode === "register"
                ? "Create account"
                : "Sign in"}
          </button>
          {mode === "signin" && (
            <button
              type="button"
              onClick={() => switchMode("forgot")}
              className="text-center text-sm text-zinc-500 underline"
            >
              Forgot password?
            </button>
          )}
        </form>
      )}

      <p className="text-center text-sm text-zinc-500">
        <Link
          href="/"
          className="font-medium text-zinc-800 underline dark:text-zinc-200"
        >
          Back to home
        </Link>
      </p>
    </main>
  );
}

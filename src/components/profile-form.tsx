"use client";

import { useRouter } from "next/navigation";
import { signOut } from "next-auth/react";
import { useState, type FormEvent } from "react";

import { UserIcon } from "@/components/icons";

type ProfileFormProps = {
  email: string;
  name?: string | null;
};

export function ProfileForm({ email, name }: ProfileFormProps) {
  const router = useRouter();
  const [displayName, setDisplayName] = useState(name ?? "");
  const [password, setPassword] = useState("");
  const [deleteMode, setDeleteMode] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function handleDelete(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setPending(true);
    try {
      const res = await fetch("/api/auth/delete-account", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        setError(data.error ?? "Could not delete account");
        return;
      }
      // JWT sessions survive the deleted D1 row — clear the cookie client-side.
      await signOut({ redirect: false });
      router.push("/login?deleted=1");
      router.refresh();
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="mx-auto max-w-lg p-8">
      <h1 className="text-3xl font-black tracking-tight text-[var(--foreground)]">
        Profile
      </h1>
      <p className="mt-2 text-[var(--muted)]">
        Manage your account settings.
      </p>

      {error ? (
        <p className="alert-error mt-6" role="alert">
          {error}
        </p>
      ) : null}

      <div className="mt-8 flex flex-col items-center">
        <div className="flex h-24 w-24 items-center justify-center rounded-full bg-[var(--surface-muted)] text-[var(--muted)]">
          <UserIcon className="h-10 w-10" />
        </div>
      </div>

      <div className="mt-8 grid gap-4">
        <label className="grid gap-1.5 text-sm">
          <span className="font-semibold text-[var(--foreground)]">Name</span>
          <input
            type="text"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            className="field-input"
            placeholder="Your name"
            disabled
          />
        </label>

        <label className="grid gap-1.5 text-sm">
          <span className="font-semibold text-[var(--foreground)]">Email</span>
          <input
            type="email"
            value={email}
            readOnly
            className="field-input opacity-70"
          />
        </label>

        <label className="grid gap-1.5 text-sm">
          <span className="font-semibold text-[var(--foreground)]">
            Password
          </span>
          <input
            type="password"
            value="••••••••"
            readOnly
            className="field-input opacity-70"
          />
        </label>
      </div>

      <div className="mt-10 border-t border-[var(--border-muted)] pt-8">
        {!deleteMode ? (
          <button
            type="button"
            className="rounded-full border border-red-200 px-5 py-2.5 text-sm font-semibold text-red-700 hover:bg-red-50"
            onClick={() => setDeleteMode(true)}
          >
            Delete account
          </button>
        ) : (
          <form className="grid gap-4" onSubmit={handleDelete}>
            <p className="alert-warning">
              This permanently deletes your account and all saved trips. There
              is no undo. Trip data sent to our AI provider during itinerary
              generation cannot be recalled from their systems.
            </p>
            <label className="grid gap-1.5 text-sm">
              <span className="font-semibold">
                Enter your password to confirm
              </span>
              <input
                type="password"
                required
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="field-input"
              />
            </label>
            <div className="flex gap-3">
              <button
                type="button"
                className="btn-ghost rounded-full px-5 py-2.5 text-sm font-semibold text-[var(--foreground)]"
                onClick={() => setDeleteMode(false)}
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={pending}
                className="rounded-full bg-red-600 px-5 py-2.5 text-sm font-bold text-white disabled:opacity-60"
              >
                {pending ? "Deleting…" : "Delete my account"}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

import Link from "next/link";

import { auth, signOut } from "@/lib/auth";

export async function SiteHeader() {
  const session = await auth();
  const identifier =
    session?.user?.email ?? session?.user?.name ?? session?.user?.id;

  async function handleSignOut() {
    "use server";
    await signOut({ redirectTo: "/" });
  }

  return (
    <header className="flex items-center justify-between gap-4 border-b border-zinc-200 pb-4 dark:border-zinc-800">
      <Link
        href="/"
        className="text-sm font-semibold tracking-tight text-zinc-900 dark:text-zinc-50"
      >
        TripSprint AI
      </Link>
      <div className="flex items-center gap-4">
        {identifier ? (
          <span className="text-sm text-zinc-600 dark:text-zinc-400">
            {identifier}
          </span>
        ) : null}
        <form action={handleSignOut}>
          <button
            type="submit"
            className="text-sm font-medium text-zinc-500 underline dark:text-zinc-400"
          >
            Sign out
          </button>
        </form>
      </div>
    </header>
  );
}

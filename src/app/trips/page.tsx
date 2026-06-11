import Link from "next/link";

import { auth, signOut } from "@/lib/auth";

export default async function TripsPage() {
  const session = await auth();

  return (
    <main className="mx-auto flex min-h-full max-w-2xl flex-col gap-6 px-6 py-16">
      <div>
        <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50">
          Your trips
        </h1>
        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
          Signed in as{" "}
          <span className="font-medium text-zinc-800 dark:text-zinc-200">
            {session?.user?.email ?? session?.user?.name ?? session?.user?.id}
          </span>
        </p>
      </div>
      <p className="text-zinc-600 dark:text-zinc-400">
        Saved itineraries will appear here once the trip planner UI is wired up
        (FR-004–FR-012).
      </p>
      <div className="flex items-center gap-4">
        <Link
          href="/"
          className="text-sm font-medium text-zinc-800 underline dark:text-zinc-200"
        >
          ← Home
        </Link>
        <form
          action={async () => {
            "use server";
            await signOut({ redirectTo: "/" });
          }}
        >
          <button
            type="submit"
            className="text-sm font-medium text-zinc-500 underline dark:text-zinc-400"
          >
            Sign out
          </button>
        </form>
      </div>
    </main>
  );
}

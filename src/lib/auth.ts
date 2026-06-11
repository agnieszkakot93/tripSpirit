import { D1Adapter } from "@auth/d1-adapter";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { eq } from "drizzle-orm";
import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";

import { users } from "@/db/schema";
import { getDb } from "@/lib/db";
import { verifyPassword } from "@/lib/password";

export const { handlers, auth, signIn, signOut } = NextAuth(async () => {
  const { env } = await getCloudflareContext({ async: true });
  return {
    adapter: D1Adapter(env.DB),
    session: { strategy: "jwt" },
    trustHost: true,
    pages: { signIn: "/login" },
    providers: [
      Credentials({
        name: "credentials",
        credentials: {
          email: { label: "Email", type: "email" },
          password: { label: "Password", type: "password" },
        },
        authorize: async (credentials) => {
          const rawEmail = credentials?.email;
          const rawPassword = credentials?.password;
          if (
            typeof rawEmail !== "string" ||
            typeof rawPassword !== "string" ||
            !rawEmail.trim() ||
            !rawPassword
          ) {
            return null;
          }
          const email = rawEmail.trim().toLowerCase();
          const db = getDb();
          const [user] = await db
            .select()
            .from(users)
            .where(eq(users.email, email))
            .limit(1);
          if (!user?.passwordHash) return null;
          const ok = await verifyPassword(rawPassword, user.passwordHash);
          if (!ok) return null;
          return {
            id: user.id,
            email: user.email ?? undefined,
            name: user.name ?? undefined,
            image: user.image ?? undefined,
          };
        },
      }),
    ],
    callbacks: {
      // Route guarding lives in src/lib/auth-edge.ts (the proxy config).
      // `authorized` only runs in the proxy/middleware path, so it is
      // intentionally omitted here to keep a single source of truth.
      async jwt({ token, user }) {
        if (user?.id) token.sub = user.id;
        return token;
      },
      async session({ session, token }) {
        if (session.user && token.sub) {
          session.user.id = token.sub;
        }
        return session;
      },
    },
  };
});

import { D1Adapter } from "@auth/d1-adapter";
import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";

import { authorizeCredentials } from "@/lib/auth-credentials";
import { getAppCloudflareContext } from "@/lib/cloudflare-context";
import { getDb } from "@/lib/db";

export const { handlers, auth, signIn, signOut } = NextAuth(async () => {
  const { env } = await getAppCloudflareContext();
  return {
    secret: env.AUTH_SECRET,
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
          const db = await getDb();
          return authorizeCredentials(db, credentials);
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

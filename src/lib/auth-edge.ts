import NextAuth from "next-auth";

// Lightweight JWT-only config for the proxy (edge runtime).
// No D1 adapter or Node.js imports — just reads the JWT to check session.
export const { auth } = NextAuth({
  session: { strategy: "jwt" },
  trustHost: true,
  pages: { signIn: "/login" },
  providers: [],
  callbacks: {
    authorized({ auth: session, request }) {
      const path = request.nextUrl.pathname;
      const isPublic =
        path === "/" ||
        path === "/login" ||
        path.startsWith("/api/auth/");
      return !!session || isPublic;
    },
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
});

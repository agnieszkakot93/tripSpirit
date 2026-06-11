export { auth as proxy } from "@/lib/auth-edge";

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon\\.ico|api/auth).*)"],
};

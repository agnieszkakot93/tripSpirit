import { Suspense } from "react";

import { LoaderPage } from "@/components/loader";

import { LoginForm } from "./login-form";

export const dynamic = "force-dynamic";

export default function LoginPage() {
  return (
    <Suspense fallback={<LoaderPage label="Preparing sign in…" variant="dark" />}>
      <LoginForm />
    </Suspense>
  );
}

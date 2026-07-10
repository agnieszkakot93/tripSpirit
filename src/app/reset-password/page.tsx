import { Suspense } from "react";

import { LoaderPage } from "@/components/loader";

import { ResetPasswordForm } from "./reset-password-form";

export const dynamic = "force-dynamic";

export default function ResetPasswordPage() {
  return (
    <Suspense
      fallback={<LoaderPage label="Preparing reset…" variant="dark" />}
    >
      <ResetPasswordForm />
    </Suspense>
  );
}

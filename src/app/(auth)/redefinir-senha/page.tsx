import type { Metadata } from "next";

import { ResetPasswordForm } from "./form";

export const metadata: Metadata = { title: "Nova senha", robots: { index: false } };

export default function Page() {
  return <ResetPasswordForm />;
}

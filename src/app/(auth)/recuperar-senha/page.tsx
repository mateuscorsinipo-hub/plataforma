import type { Metadata } from "next";

import { ForgotPasswordForm } from "./form";

export const metadata: Metadata = { title: "Recuperar senha", robots: { index: false } };

export default function Page() {
  return <ForgotPasswordForm />;
}

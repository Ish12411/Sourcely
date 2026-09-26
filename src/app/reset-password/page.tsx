import type { Metadata } from "next";
import ResetPasswordForm from "@/components/ResetPasswordForm";

export const metadata: Metadata = {
  title: "Set a new password — Sourcely",
};

// Deliberately NOT a public path in middleware: it needs the session that
// /auth/confirm establishes from the emailed link. Opened cold, the middleware
// sends the person to sign in — which is correct, since there is no account
// in hand to set a password for.
export default function ResetPasswordPage() {
  return <ResetPasswordForm />;
}

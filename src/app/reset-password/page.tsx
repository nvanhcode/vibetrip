import type { Metadata } from "next";
import { ResetPasswordForm } from "@/components/app/reset-password-form";

export const metadata: Metadata = {
  title: "Đặt lại mật khẩu | VibeTrip",
  description: "Cập nhật mật khẩu mới cho tài khoản VibeTrip.",
};

export default function ResetPasswordPage() {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-md items-center px-4 py-10">
      <ResetPasswordForm />
    </main>
  );
}

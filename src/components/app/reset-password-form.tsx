"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { evaluatePasswordStrength } from "@/lib/password-strength";
import { createClient } from "@/lib/supabase/client";

export function ResetPasswordForm() {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const passwordStrength = useMemo(() => evaluatePasswordStrength(password), [password]);
  const strengthColorClass =
    passwordStrength.level === "strong"
      ? "bg-emerald-500"
      : passwordStrength.level === "medium"
        ? "bg-amber-500"
        : passwordStrength.level === "weak"
          ? "bg-rose-500"
          : "bg-border";

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    setMessage(null);

    try {
      if (!passwordStrength.isStrong) {
        throw new Error("Mật khẩu mới chưa đủ mạnh theo các quy tắc bảo mật.");
      }

      if (password !== confirmPassword) {
        throw new Error("Mật khẩu xác nhận không khớp.");
      }

      const { error: updateError } = await supabase.auth.updateUser({
        password,
      });

      if (updateError) throw updateError;

      setMessage("Đổi mật khẩu thành công. Bạn có thể đăng nhập lại ngay bây giờ.");
      router.replace("/login");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Không thể đổi mật khẩu.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="w-full rounded-3xl border border-border bg-card p-5 shadow-xl shadow-black/5 sm:p-6">
      <h1 className="text-2xl font-black tracking-tight text-foreground">Đặt lại mật khẩu</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Tạo mật khẩu mới đủ mạnh để bảo vệ tài khoản của bạn.
      </p>

      <form onSubmit={onSubmit} className="mt-4 space-y-3">
        <div>
          <label className="mb-1.5 block text-sm font-medium text-foreground">Mật khẩu mới</label>
          <Input
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            autoComplete="new-password"
            placeholder="Nhập mật khẩu mới"
            minLength={10}
            required
          />
        </div>

        <div className="rounded-2xl border border-border bg-muted/40 p-3">
          <div className="mb-2 flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Độ mạnh mật khẩu</span>
            <span className="font-semibold text-foreground">{passwordStrength.label}</span>
          </div>
          <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
            <div
              className={`h-full transition-all duration-300 ${strengthColorClass}`}
              style={{ width: `${passwordStrength.percent}%` }}
            />
          </div>
          <ul className="mt-2 space-y-1 text-xs text-muted-foreground">
            {passwordStrength.checks.map((rule) => (
              <li key={rule.id} className={rule.met ? "text-emerald-600" : "text-muted-foreground"}>
                {rule.met ? "Đã đạt" : "Chưa đạt"} - {rule.label}
              </li>
            ))}
          </ul>
        </div>

        <div>
          <label className="mb-1.5 block text-sm font-medium text-foreground">Xác nhận mật khẩu mới</label>
          <Input
            type="password"
            value={confirmPassword}
            onChange={(event) => setConfirmPassword(event.target.value)}
            autoComplete="new-password"
            placeholder="Nhập lại mật khẩu mới"
            minLength={10}
            required
          />
        </div>

        <Button type="submit" className="w-full" disabled={submitting}>
          {submitting ? "Đang cập nhật..." : "Cập nhật mật khẩu"}
        </Button>
      </form>

      <p className="mt-4 text-xs text-muted-foreground">
        Quay lại{" "}
        <Link href="/login" className="font-medium text-primary hover:underline">
          trang đăng nhập
        </Link>
        .
      </p>

      {error && <p className="mt-3 text-sm text-destructive">{error}</p>}
      {message && <p className="mt-3 text-sm text-foreground">{message}</p>}
    </div>
  );
}
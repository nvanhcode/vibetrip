"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { evaluatePasswordStrength } from "@/lib/password-strength";
import { createClient } from "@/lib/supabase/client";
import { createAccessRequest } from "@/models/rbac.model";

type Mode = "login" | "register" | "forgot";

export function AuthForm() {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);

  const [mode, setMode] = useState<Mode>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [requestProvinceManager, setRequestProvinceManager] = useState(false);
  const [requestWardAdmin, setRequestWardAdmin] = useState(false);
  const [acceptedPolicies, setAcceptedPolicies] = useState(false);
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
      if (mode === "login") {
        const { error: signInError } = await supabase.auth.signInWithPassword({
          email,
          password,
        });

        if (signInError) throw signInError;

        router.replace("/map");
        router.refresh();
        return;
      }

      if (mode === "forgot") {
        const redirectTo = `${window.location.origin}/reset-password`;
        const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo,
        });

        if (resetError) throw resetError;

        setMessage("Đã gửi email đặt lại mật khẩu. Vui lòng kiểm tra hộp thư của bạn.");
        return;
      }

      if (!fullName.trim()) {
        throw new Error("Vui lòng nhập tên hiển thị.");
      }

      if (!passwordStrength.isStrong) {
        throw new Error("Mật khẩu chưa đủ mạnh theo các quy tắc bảo mật.");
      }

      if (password !== confirmPassword) {
        throw new Error("Mật khẩu xác nhận không khớp.");
      }

      if (!acceptedPolicies) {
        throw new Error("Bạn cần đồng ý Nội quy cộng đồng và Quyền riêng tư để đăng ký.");
      }

      if (requestProvinceManager && requestWardAdmin) {
        throw new Error("Bạn chỉ được chọn một loại yêu cầu quản trị: tỉnh hoặc xã.");
      }

      const { error: signUpError, data } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            full_name: fullName.trim(),
            accepted_policies: true,
            accepted_policies_at: new Date().toISOString(),
          },
        },
      });

      if (signUpError) throw signUpError;

      const requestedRole = requestProvinceManager
        ? "province_manager"
        : requestWardAdmin
          ? "ward_admin"
          : null;

      if (requestedRole) {
        const { error: requestError } = await createAccessRequest(supabase, {
          email: email.trim().toLowerCase(),
          full_name: fullName.trim(),
          user_id: data.user?.id ?? null,
          requested_role: requestedRole,
          notes: "Yêu cầu gửi từ màn hình đăng ký",
        });

        if (requestError && requestError.code !== "23505") {
          console.error("createAccessRequest failed", requestError);
        }
      }

      if (!data.session) {
        setMessage(
          requestedRole
            ? "Đăng ký thành công. Vui lòng xác nhận email, yêu cầu quản trị đã được gửi tới quản trị viên."
            : "Đăng ký thành công. Vui lòng kiểm tra email để xác nhận tài khoản."
        );
      } else {
        setMessage(
          requestedRole
            ? "Đăng ký thành công. Yêu cầu quản trị đã được gửi tới quản trị viên để duyệt."
            : "Đăng ký thành công."
        );
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Đã có lỗi xảy ra.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="w-full rounded-3xl border border-border bg-card/95 p-4 text-card-foreground shadow-xl shadow-black/5 backdrop-blur sm:p-6">
      <div className="mb-5 grid grid-cols-2 rounded-2xl bg-muted p-1">
        <button
          type="button"
          onClick={() => {
            setMode("login");
            setMessage(null);
            setError(null);
          }}
          className={
            mode === "login"
              ? "rounded-xl bg-background px-3 py-2 text-sm font-semibold"
              : "rounded-xl px-3 py-2 text-sm text-muted-foreground"
          }
        >
          Đăng nhập
        </button>
        <button
          type="button"
          onClick={() => {
            setMode("register");
            setMessage(null);
            setError(null);
          }}
          className={
            mode === "register"
              ? "rounded-xl bg-background px-3 py-2 text-sm font-semibold"
              : "rounded-xl px-3 py-2 text-sm text-muted-foreground"
          }
        >
          Đăng ký
        </button>
      </div>

      <form onSubmit={onSubmit} className="space-y-3">
        {mode === "register" && (
          <div>
            <label className="mb-1.5 block text-sm font-medium text-foreground">Tên hiển thị</label>
            <Input
              value={fullName}
              onChange={(event) => setFullName(event.target.value)}
              autoComplete="name"
              placeholder="Họ và tên"
              required
            />
          </div>
        )}

        <div>
          <label className="mb-1.5 block text-sm font-medium text-foreground">Email</label>
          <Input
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            autoComplete="email"
            placeholder="you@example.com"
            required
          />
        </div>

        {mode !== "forgot" && (
          <>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-foreground">Mật khẩu</label>
              <Input
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                autoComplete={mode === "login" ? "current-password" : "new-password"}
                placeholder="Nhập mật khẩu"
                minLength={10}
                required
              />
            </div>

            {mode === "register" && (
              <>
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
                  <label className="mb-1.5 block text-sm font-medium text-foreground">Xác nhận mật khẩu</label>
                  <Input
                    type="password"
                    value={confirmPassword}
                    onChange={(event) => setConfirmPassword(event.target.value)}
                    autoComplete="new-password"
                    placeholder="Nhập lại mật khẩu"
                    minLength={10}
                    required
                  />
                </div>

                <label className="flex items-start gap-2 rounded-xl border border-border bg-muted/30 px-3 py-2 text-sm leading-5">
                  <input
                    type="checkbox"
                    className="mt-1 size-4 rounded border-border"
                    checked={acceptedPolicies}
                    onChange={(event) => setAcceptedPolicies(event.target.checked)}
                    required
                  />
                  <span>
                    Tôi đồng ý với{" "}
                    <Link href="/community-guidelines" className="font-medium text-primary hover:underline">
                      Nội quy cộng đồng
                    </Link>{" "}
                    và{" "}
                    <Link href="/privacy-policy" className="font-medium text-primary hover:underline">
                      Quyền riêng tư
                    </Link>
                    .
                  </span>
                </label>

                {/* <div className="rounded-xl border border-border bg-muted/30 px-3 py-2">
                  <p className="mb-2 text-sm font-medium text-foreground">Yêu cầu nâng cấp tài khoản (không bắt buộc)</p>

                  <label className="flex items-start gap-2 text-sm leading-5 text-muted-foreground">
                    <input
                      type="checkbox"
                      className="mt-1 size-4 rounded border-border"
                      checked={requestProvinceManager}
                      onChange={(event) => {
                        const checked = event.target.checked;
                        setRequestProvinceManager(checked);
                        if (checked) {
                          setRequestWardAdmin(false);
                        }
                      }}
                    />
                    <span>Yêu cầu trở thành quản lý tỉnh</span>
                  </label>

                  <label className="mt-2 flex items-start gap-2 text-sm leading-5 text-muted-foreground">
                    <input
                      type="checkbox"
                      className="mt-1 size-4 rounded border-border"
                      checked={requestWardAdmin}
                      onChange={(event) => {
                        const checked = event.target.checked;
                        setRequestWardAdmin(checked);
                        if (checked) {
                          setRequestProvinceManager(false);
                        }
                      }}
                    />
                    <span>Yêu cầu trở thành quản trị xã</span>
                  </label>
                </div> */}
              </>
            )}
          </>
        )}

        <Button type="submit" className="w-full" disabled={submitting}>
          {submitting
            ? "Đang xử lý..."
            : mode === "login"
              ? "Đăng nhập"
              : mode === "register"
                ? "Tạo tài khoản"
                : "Gửi liên kết đặt lại mật khẩu"}
        </Button>

        {mode === "login" && (
          <button
            type="button"
            className="w-full text-sm font-medium text-primary hover:underline"
            onClick={() => {
              setMode("forgot");
              setError(null);
              setMessage("Nhập email để nhận liên kết đặt lại mật khẩu.");
            }}
          >
            Quên mật khẩu?
          </button>
        )}

        {mode === "forgot" && (
          <button
            type="button"
            className="w-full text-sm font-medium text-muted-foreground hover:text-foreground"
            onClick={() => {
              setMode("login");
              setError(null);
              setMessage(null);
            }}
          >
            Quay lại đăng nhập
          </button>
        )}
      </form>

      <p className="mt-4 text-xs leading-5 text-muted-foreground">
        Bằng việc tiếp tục, bạn xác nhận đã đọc{" "}
        <Link href="/community-guidelines" className="font-medium text-primary hover:underline">
          Nội quy cộng đồng
        </Link>{" "}
        và{" "}
        <Link href="/privacy-policy" className="font-medium text-primary hover:underline">
          Quyền riêng tư
        </Link>
        .
      </p>

      {error && <p className="mt-3 text-sm text-destructive">{error}</p>}
      {message && <p className="mt-3 text-sm text-foreground">{message}</p>}
    </div>
  );
}

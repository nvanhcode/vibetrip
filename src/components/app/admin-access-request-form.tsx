"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { ProvinceOption } from "@/components/app/province-picker";
import { Textarea } from "@/components/ui/textarea";

type SelectedUser = {
  id: string;
  email: string;
  fullName: string | null;
};

type AdminAccessRequestFormProps = {
  action: (formData: FormData) => void | Promise<void>;
  provinces?: ProvinceOption[];
  forcedRole?: "province_manager" | "ward_admin";
};

export function AdminAccessRequestForm({ action, provinces = [], forcedRole }: AdminAccessRequestFormProps) {
  const [email, setEmail] = useState("");
  const [requestedRole, setRequestedRole] = useState<"province_manager" | "ward_admin">(forcedRole ?? "province_manager");
  const [provinceCode, setProvinceCode] = useState("");
  const [selectedUser, setSelectedUser] = useState<SelectedUser | null>(null);
  const [lookupMessage, setLookupMessage] = useState<string | null>(null);
  const [lookupError, setLookupError] = useState<string | null>(null);
  const [isLookingUp, setIsLookingUp] = useState(false);

  const effectiveRole = forcedRole ?? requestedRole;

  async function handleLookup() {
    const normalizedEmail = email.trim().toLowerCase();

    setSelectedUser(null);
    setLookupMessage(null);
    setLookupError(null);

    if (!normalizedEmail) {
      setLookupError("Nhập đúng email để tìm tài khoản.");
      return;
    }

    setIsLookingUp(true);

    try {
      const response = await fetch(`/api/admin/users/by-email?email=${encodeURIComponent(normalizedEmail)}`);
      const data = (await response.json()) as {
        error?: string;
        user: SelectedUser | null;
      };

      if (!response.ok) {
        throw new Error(data.error || "Không thể tìm tài khoản.");
      }

      if (!data.user) {
        setLookupMessage("Không tìm thấy user khớp chính xác với email này.");
        return;
      }

      setSelectedUser(data.user);
      setLookupMessage("Đã tìm thấy đúng 1 tài khoản, bạn có thể dùng ngay để tạo yêu cầu.");
    } catch (error) {
      setLookupError(error instanceof Error ? error.message : "Không thể tìm tài khoản.");
    } finally {
      setIsLookingUp(false);
    }
  }

  return (
    <form action={action} className="grid gap-3 md:grid-cols-2">
      <div className="space-y-1.5 md:col-span-1">
        <label className="text-sm font-medium text-foreground">Email</label>
        <div className="flex gap-2">
          <Input
            name="email"
            type="email"
            value={email}
            onChange={(event) => {
              setEmail(event.target.value);
              setSelectedUser(null);
              setLookupMessage(null);
              setLookupError(null);
            }}
            placeholder="nguoidung@example.com"
            required
          />
          <Button type="button" variant="outline" onClick={handleLookup} disabled={isLookingUp}>
            {isLookingUp ? "Đang tìm" : "Tìm user"}
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">Chỉ hiện kết quả khi email khớp chính xác với tài khoản đã có.</p>
      </div>

      <div className="space-y-1.5 md:col-span-1">
        <label className="text-sm font-medium text-foreground">Họ tên</label>
        <Input name="full_name" placeholder="Nguyễn Văn A" required />
      </div>

      <div className="space-y-1.5 md:col-span-1">
        <label className="text-sm font-medium text-foreground">Vai trò yêu cầu</label>
        {forcedRole ? (
          <input type="hidden" name="requested_role" value={forcedRole} />
        ) : (
          <select
            name="requested_role"
            className="h-9 w-full rounded-xl border border-input bg-input/30 px-3 text-sm"
            value={requestedRole}
            onChange={(event) => {
              const nextRole = event.target.value === "ward_admin" ? "ward_admin" : "province_manager";
              setRequestedRole(nextRole);
            }}
          >
            <option value="province_manager">Quản lý tỉnh</option>
            <option value="ward_admin">Quản trị xã</option>
          </select>
        )}
      </div>

      {effectiveRole === "ward_admin" && (
        <div className="space-y-1.5 md:col-span-1">
          <label className="text-sm font-medium text-foreground">Tỉnh yêu cầu</label>
          <select
            name="province_code"
            className="h-9 w-full rounded-xl border border-input bg-input/30 px-3 text-sm"
            value={provinceCode}
            onChange={(event) => setProvinceCode(event.target.value)}
            required
          >
            <option value="">Chọn tỉnh</option>
            {provinces.map((province) => (
              <option key={province.code} value={province.code}>
                {province.name} ({province.code})
              </option>
            ))}
          </select>
        </div>
      )}

      <div className="space-y-1.5 md:col-span-1">
        <label className="text-sm font-medium text-foreground">Tài khoản liên kết</label>
        <input type="hidden" name="user_id" value={selectedUser?.id ?? ""} readOnly />
        <div className="rounded-xl border border-dashed border-border px-3 py-2 text-sm text-muted-foreground">
          {selectedUser ? (
            <div className="space-y-1">
              <p className="font-medium text-foreground">{selectedUser.fullName ?? "Tài khoản đã xác thực"}</p>
              <p>{selectedUser.email}</p>
              <p className="text-xs">User ID: {selectedUser.id}</p>
            </div>
          ) : (
            <p>Chưa chọn tài khoản. Hãy nhập email chính xác rồi bấm tìm.</p>
          )}
        </div>
      </div>

      <div className="space-y-1.5 md:col-span-2">
        <label className="text-sm font-medium text-foreground">Ghi chú</label>
        <Textarea name="notes" placeholder="Mô tả yêu cầu, đơn vị công tác..." />
      </div>

      {lookupError ? <p className="md:col-span-2 text-sm text-destructive">{lookupError}</p> : null}
      {!lookupError && lookupMessage ? <p className="md:col-span-2 text-sm text-muted-foreground">{lookupMessage}</p> : null}

      <div className="md:col-span-2">
        <Button type="submit">Tạo yêu cầu</Button>
      </div>
    </form>
  );
}

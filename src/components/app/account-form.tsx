"use client";

import Image from "next/image";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { createClient } from "@/lib/supabase/client";
import type { ProvinceOption } from "@/components/app/province-picker";

type AccountFormProps = {
  userId: string;
  email: string;
  initialFullName: string;
  initialAvatarUrl: string;
  provinces: ProvinceOption[];
};

export function AccountForm({ userId, email, initialFullName, initialAvatarUrl, provinces }: AccountFormProps) {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);

  const [fullName, setFullName] = useState(initialFullName);
  const [avatarPreview, setAvatarPreview] = useState(initialAvatarUrl);
  const [file, setFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  const [requestingUpgrade, setRequestingUpgrade] = useState(false);
  const [requestProvinceManager, setRequestProvinceManager] = useState(false);
  const [requestWardAdmin, setRequestWardAdmin] = useState(false);
  const [requestWardProvinceCode, setRequestWardProvinceCode] = useState("");
  const [requestNotes, setRequestNotes] = useState("");
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function onSave(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setStatus(null);
    setError(null);

    try {
      let avatarUrl = avatarPreview;

      if (file) {
        const fileExt = file.name.split(".").pop() || "jpg";
        const filePath = `${userId}/${Date.now()}.${fileExt}`;

        const { error: uploadError } = await supabase.storage
          .from("avatars")
          .upload(filePath, file, {
            upsert: true,
            contentType: file.type || undefined,
          });

        if (uploadError) throw uploadError;

        const { data } = supabase.storage.from("avatars").getPublicUrl(filePath);
        avatarUrl = data.publicUrl;
      }

      const { error: updateError } = await supabase.auth.updateUser({
        data: {
          full_name: fullName,
          avatar_url: avatarUrl,
        },
      });

      if (updateError) throw updateError;

      setAvatarPreview(avatarUrl);
      setFile(null);
      setStatus("Đã cập nhật thông tin tài khoản.");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Không thể cập nhật tài khoản.");
    } finally {
      setSaving(false);
    }
  }

  async function onRequestUpgrade() {
    setRequestingUpgrade(true);
    setError(null);
    setStatus(null);

    try {
      if (requestProvinceManager && requestWardAdmin) {
        throw new Error("Bạn chỉ được chọn một loại yêu cầu quản trị.");
      }

      const requestedRole = requestProvinceManager ? "province_manager" : requestWardAdmin ? "ward_admin" : null;
      if (!requestedRole) {
        throw new Error("Vui lòng chọn vai trò muốn yêu cầu.");
      }

      if (requestedRole === "ward_admin" && !requestWardProvinceCode) {
        throw new Error("Vui lòng chọn tỉnh bạn muốn xin quyền quản trị xã.");
      }

      const { error: requestError } = await supabase.from("access_requests").insert({
        user_id: userId,
        email: email.trim().toLowerCase(),
        full_name: fullName.trim(),
        requested_role: requestedRole,
        province_code: requestedRole === "ward_admin" ? requestWardProvinceCode : null,
        notes: requestNotes.trim() || null,
      });

      if (requestError && requestError.code !== "23505") {
        throw requestError;
      }

      setStatus("Đã gửi yêu cầu nâng cấp tài khoản cho quản trị viên.");
      setRequestNotes("");
      setRequestProvinceManager(false);
      setRequestWardAdmin(false);
      setRequestWardProvinceCode("");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Không thể gửi yêu cầu nâng cấp.");
    } finally {
      setRequestingUpgrade(false);
    }
  }

  return (
    <form onSubmit={onSave} className="space-y-4">
      <div className="flex items-center gap-3">
        <span className="relative inline-flex size-18 items-center justify-center overflow-hidden rounded-full bg-muted text-sm font-semibold text-foreground">
          {avatarPreview ? (
            <Image src={avatarPreview} alt="Avatar" fill sizes="72px" className="object-cover" />
          ) : (
            "VT"
          )}
        </span>

        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium text-foreground">{email}</p>
          <Input
            type="file"
            accept="image/*"
            className="mt-2"
            onChange={(event) => {
              const selected = event.target.files?.[0] ?? null;
              setFile(selected);
              if (selected) {
                setAvatarPreview(URL.createObjectURL(selected));
              }
            }}
          />
        </div>
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium text-foreground">Tên hiển thị</label>
        <Input
          value={fullName}
          onChange={(event) => setFullName(event.target.value)}
          autoComplete="name"
          placeholder="Họ và tên"
          required
        />
      </div>

      <Button type="submit" disabled={saving}>
        {saving ? "Đang lưu..." : "Lưu thay đổi"}
      </Button>

      <div className="rounded-2xl border border-border bg-muted/30 p-3">
        <p className="mb-2 text-sm font-semibold text-foreground">Yêu cầu nâng cấp tài khoản quản trị</p>
        <p className="mb-3 text-xs text-muted-foreground">
          Gửi yêu cầu trở thành quản lý tỉnh hoặc quản trị xã để quản trị viên duyệt và phân công địa bàn.
        </p>

        <div className="space-y-3">
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
                  setRequestWardProvinceCode("");
                }
              }}
            />
            <span>Yêu cầu trở thành quản lý tỉnh</span>
          </label>

          <label className="flex items-start gap-2 text-sm leading-5 text-muted-foreground">
            <input
              type="checkbox"
              className="mt-1 size-4 rounded border-border"
              checked={requestWardAdmin}
              onChange={(event) => {
                const checked = event.target.checked;
                setRequestWardAdmin(checked);
                if (checked) {
                  setRequestProvinceManager(false);
                } else {
                  setRequestWardProvinceCode("");
                }
              }}
            />
            <span>Yêu cầu trở thành quản trị xã</span>
          </label>

          {requestWardAdmin && (
            <div>
              <label className="mb-1 block text-sm font-medium text-foreground">Tỉnh muốn xin quyền quản trị xã</label>
              <select
                className="h-9 w-full rounded-xl border border-input bg-input/30 px-3 text-sm"
                value={requestWardProvinceCode}
                onChange={(event) => setRequestWardProvinceCode(event.target.value)}
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

          <div>
            <label className="mb-1 block text-sm font-medium text-foreground">Ghi chú</label>
            <Textarea
              value={requestNotes}
              onChange={(event) => setRequestNotes(event.target.value)}
              placeholder="Mô tả khu vực bạn muốn phụ trách..."
            />
          </div>

          <Button
            type="button"
            disabled={requestingUpgrade}
            onClick={onRequestUpgrade}
          >
            {requestingUpgrade ? "Đang gửi yêu cầu..." : "Gửi yêu cầu nâng cấp"}
          </Button>
        </div>
      </div>
      
      {error && <p className="text-sm text-destructive">{error}</p>}
      {status && <p className="text-sm text-foreground">{status}</p>}
    </form>
  );
}

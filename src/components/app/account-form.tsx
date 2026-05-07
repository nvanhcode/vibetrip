"use client";

import Image from "next/image";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { createClient } from "@/lib/supabase/client";

type AccountFormProps = {
  userId: string;
  email: string;
  initialFullName: string;
  initialAvatarUrl: string;
};

export function AccountForm({ userId, email, initialFullName, initialAvatarUrl }: AccountFormProps) {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);

  const [fullName, setFullName] = useState(initialFullName);
  const [avatarPreview, setAvatarPreview] = useState(initialAvatarUrl);
  const [file, setFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
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
      
      {error && <p className="text-sm text-destructive">{error}</p>}
      {status && <p className="text-sm text-foreground">{status}</p>}
    </form>
  );
}

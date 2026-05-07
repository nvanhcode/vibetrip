"use client";

import { User02Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import Image from "next/image";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { signOutAction } from "@/app/auth/actions";
import { Button } from "@/components/ui/button";
import type { AppRole } from "@/models/rbac.model";
import { cn } from "@/lib/utils";

type HeaderUser = {
  email: string | null;
  role: AppRole | null;
  roleLabel: string;
  metadata: {
    full_name?: string;
    avatar_url?: string;
  };
};

type HeaderUserMenuProps = {
  user: HeaderUser | null;
};

function initialsFromName(name: string) {
  const parts = name
    .split(" ")
    .map((part) => part.trim())
    .filter(Boolean)
    .slice(0, 2);

  if (parts.length === 0) return "VT";
  return parts.map((part) => part[0]?.toUpperCase() ?? "").join("");
}

export function HeaderUserMenu({ user }: HeaderUserMenuProps) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    function onClickOutside(event: MouseEvent) {
      if (!containerRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    }

    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  if (!user) {
    return (
      <Button asChild size="sm" className="ml-auto">
        <Link href="/login">Đăng nhập</Link>
      </Button>
    );
  }

  const name = user.metadata.full_name || user.email || "Tài khoản";
  const initials = initialsFromName(name);
  const avatarUrl = user.metadata.avatar_url;

  return (
    <div className="relative ml-auto" ref={containerRef}>
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className={cn(
          "inline-flex items-center gap-2 rounded-full border border-border bg-card px-2 py-1 text-left transition-colors hover:bg-accent",
          open && "bg-accent"
        )}
      >
        <span className="relative inline-flex size-9 items-center justify-center overflow-hidden rounded-full bg-muted text-xs font-semibold text-foreground">
          {avatarUrl ? (
            <Image src={avatarUrl} alt={name} fill sizes="36px" className="object-cover" />
          ) : (
            initials
          )}
        </span>

        <span className="hidden max-w-32 min-w-0 sm:block">
          <span className="block truncate text-sm font-semibold text-foreground">{name}</span>
          <span className="block truncate text-[11px] text-muted-foreground">{user.email}</span>
        </span>

        <HugeiconsIcon icon={User02Icon} strokeWidth={1.8} className="size-4 shrink-0 text-muted-foreground" />
      </button>

      {open && (
        <div className="absolute right-0 top-[calc(100%+0.5rem)] z-50 w-64 overflow-hidden rounded-2xl border border-border bg-popover p-1.5 text-popover-foreground shadow-lg">
          <div className="rounded-xl bg-muted/40 px-3 py-2">
            <p className="truncate text-xs font-semibold uppercase tracking-wide text-muted-foreground">Đăng nhập với</p>
            <p className="truncate text-sm font-medium text-foreground">{user.email}</p>
            <p className="mt-1 truncate text-xs text-muted-foreground">Vai trò: {user.roleLabel}</p>
          </div>

          {user.role === "admin" && (
            <Link
              href="/account/manage-province-accounts"
              onClick={() => setOpen(false)}
              className="block rounded-xl px-3 py-2 text-sm font-medium hover:bg-accent"
            >
              Quản lý tài khoản tỉnh
            </Link>
          )}

          {user.role === "province_manager" && (
            <Link
              href="/account/manage-ward-accounts"
              onClick={() => setOpen(false)}
              className="block rounded-xl px-3 py-2 text-sm font-medium hover:bg-accent"
            >
              Quản lý tài khoản xã
            </Link>
          )}

          <Link
            href="/account"
            onClick={() => setOpen(false)}
            className="block rounded-xl px-3 py-2 text-sm font-medium hover:bg-accent"
          >
            Tài khoản
          </Link>
          <Link
            href="/community-guidelines"
            onClick={() => setOpen(false)}
            className="block rounded-xl px-3 py-2 text-sm font-medium hover:bg-accent"
          >
            Nội quy cộng đồng
          </Link>
          <Link
            href="/privacy-policy"
            onClick={() => setOpen(false)}
            className="block rounded-xl px-3 py-2 text-sm font-medium hover:bg-accent"
          >
            Quyền riêng tư
          </Link>
          <form action={signOutAction}>
            <button
              type="submit"
              className="block w-full rounded-xl px-3 py-2 text-left text-sm font-medium text-destructive hover:bg-destructive/10"
            >
              Đăng xuất
            </button>
          </form>
        </div>
      )}
    </div>
  );
}

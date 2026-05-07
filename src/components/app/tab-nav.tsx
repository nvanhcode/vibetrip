"use client";

import {
  Calendar03Icon,
  Comment01Icon,
  MapPinpoint01Icon,
  Route01Icon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const TABS = [
  { href: "/map", label: "Bản đồ", icon: MapPinpoint01Icon },
  { href: "/routes", label: "Lộ trình", icon: Route01Icon },
  { href: "/events", label: "Sự kiện", icon: Calendar03Icon },
  { href: "/forum", label: "Diễn đàn", icon: Comment01Icon },
];

export function TabNav() {
  const pathname = usePathname();

  return (
    <>
      <aside className="hidden h-screen w-64 flex-col gap-3 border-r border-border bg-background/95 p-4 backdrop-blur md:sticky md:top-0 md:z-50 md:row-span-2 md:flex">
        <div className="rounded-2xl bg-linear-to-br from-primary to-primary/80 px-4 py-4 text-primary-foreground">
          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-primary-foreground/80">VibeTripVn</p>
          <p className="mt-1 text-base font-bold">Đi để khám phá</p>
          <p className="mt-1 text-xs text-primary-foreground/80">Lịch trình, bản đồ và sự kiện trong một nơi.</p>
        </div>

        <nav className="flex flex-1 flex-col gap-1.5">
          {TABS.map((tab) => {
            const active = pathname === tab.href || pathname.startsWith(`${tab.href}/`);
            const Icon = tab.icon;

            return (
              <Link
                key={tab.href}
                href={tab.href}
                className={cn(
                  "group flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors",
                  active
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                )}
              >
                <HugeiconsIcon icon={Icon} strokeWidth={1.8} className="size-4 shrink-0" />
                <span className="truncate">{tab.label}</span>
              </Link>
            );
          })}
        </nav>

        <div className="rounded-2xl border border-border bg-card p-2 text-card-foreground shadow-sm">
          <Image
            src="/images/banner-menu-left.png"
            alt="Banner"
            width={768}
            height={1376}
            className="h-auto w-full rounded-xl object-contain"
          />
        </div>
      </aside>

      <nav className="fixed inset-x-0 bottom-0 z-40 grid grid-cols-4 gap-2 border-t border-border bg-background/95 px-2 pb-[max(8px,env(safe-area-inset-bottom))] pt-2 backdrop-blur md:hidden">
        {TABS.map((tab) => {
          const active = pathname === tab.href || pathname.startsWith(`${tab.href}/`);
          const Icon = tab.icon;

          return (
            <Link
              key={tab.href}
              href={tab.href}
              className={cn(
                "flex flex-col items-center justify-center gap-1 rounded-xl px-1 py-2 text-center text-[11px] font-medium transition-colors",
                active
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground"
              )}
            >
              <HugeiconsIcon icon={Icon} strokeWidth={1.8} className="size-4" />
              <span className="truncate">{tab.label}</span>
            </Link>
          );
        })}
      </nav>
    </>
  );
}

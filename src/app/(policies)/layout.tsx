import type { ReactNode } from "react";
import Link from "next/link";
import { TabNav } from "@/components/app/tab-nav";
import { TabsHeader } from "@/components/app/tabs-header";

export default function PoliciesLayout({ children }: { children: ReactNode }) {
  return (
    <div className="relative flex min-h-dvh flex-col overflow-x-clip bg-background md:grid md:min-h-screen md:grid-cols-[16rem_minmax(0,1fr)] md:grid-rows-[auto_minmax(0,1fr)]">
      <div className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(60rem_60rem_at_12%_-10%,color-mix(in_oklab,var(--color-primary)_10%,transparent),transparent_58%),radial-gradient(60rem_60rem_at_85%_-30%,color-mix(in_oklab,var(--color-muted-foreground)_12%,transparent),transparent_62%)]" />
      <TabNav />
      <div className="flex min-h-0 flex-1 flex-col md:col-start-2 md:row-span-2 md:min-h-0">
        <TabsHeader />

        <main className="flex min-h-0 flex-1 flex-col pb-[calc(4.5rem+env(safe-area-inset-bottom))] md:pb-0">
          <div className="mx-auto w-full max-w-3xl flex-1 px-4 py-6 md:px-6 md:py-8">
            <div className="mb-4 grid grid-cols-2 rounded-2xl border border-border bg-card/80 p-1 backdrop-blur">
              <Link
                href="/community-guidelines"
                className="rounded-xl px-3 py-2 text-center text-sm font-medium text-foreground transition-colors hover:bg-accent"
              >
                Nội quy cộng đồng
              </Link>
              <Link
                href="/privacy-policy"
                className="rounded-xl px-3 py-2 text-center text-sm font-medium text-foreground transition-colors hover:bg-accent"
              >
                Quyền riêng tư
              </Link>
            </div>
            <div className="rounded-3xl border border-border bg-card/90 p-5 shadow-xl shadow-black/5 backdrop-blur sm:p-6">
              {children}
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}

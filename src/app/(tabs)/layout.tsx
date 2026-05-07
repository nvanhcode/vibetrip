import type { ReactNode } from "react";
import { TabNav } from "@/components/app/tab-nav";
import { TabsHeader } from "@/components/app/tabs-header";

export default function TabsLayout({ children }: { children: ReactNode }) {
  return (
    <div className="relative flex min-h-dvh flex-col overflow-x-clip bg-background md:grid md:min-h-screen md:grid-cols-[16rem_minmax(0,1fr)] md:grid-rows-[auto_minmax(0,1fr)]">
      <div className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(60rem_60rem_at_12%_-10%,color-mix(in_oklab,var(--color-primary)_10%,transparent),transparent_58%),radial-gradient(60rem_60rem_at_85%_-30%,color-mix(in_oklab,var(--color-muted-foreground)_12%,transparent),transparent_62%)]" />
      <TabNav />
      <div className="flex min-h-0 flex-1 flex-col md:col-start-2 md:row-span-2 md:min-h-0">
        <TabsHeader />

        <main className="flex min-h-0 flex-1 flex-col pb-[calc(4.5rem+env(safe-area-inset-bottom))] md:pb-0">
          <div className="mx-auto flex min-h-0 w-full max-w-7xl flex-1 flex-col">
            <div className="animate-in fade-in-0 slide-in-from-bottom-2 duration-500 min-h-0 flex-1">
              {children}
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}

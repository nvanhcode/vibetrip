import Image from "next/image";
import { HeaderUserMenu } from "@/components/app/header-user-menu";
import { createClient } from "@/lib/supabase/server";

export async function TabsHeader() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const headerUser = user
    ? {
      email: user.email ?? null,
      metadata: {
        full_name: typeof user.user_metadata.full_name === "string" ? user.user_metadata.full_name : undefined,
        avatar_url: typeof user.user_metadata.avatar_url === "string" ? user.user_metadata.avatar_url : undefined,
      },
    }
    : null;

  return (
    <header className="sticky top-0 z-40 border-b border-border bg-background/85 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-7xl items-center gap-3 px-4 md:px-6">
        <Image src="/logo.png" alt="VibeTrip.vn" width={50} height={50} className="shrink-0" />
        <div>
          <p className="text-base font-black tracking-tight text-foreground sm:text-lg">VibeTripVn</p>
          <p className="text-xs text-muted-foreground">Khám phá nhịp sống trong từng chuyến đi.</p>
        </div>
        <HeaderUserMenu user={headerUser} />
      </div>
    </header>
  );
}

import { redirect } from "next/navigation";
import { UserRoutesList } from "@/components/app/user-routes-list";
import { fetchVisibleRoutes } from "@/lib/user-routes";
import { createClient } from "@/lib/supabase/server";

export default async function RoutesPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const routes = await fetchVisibleRoutes(supabase, { limit: 200 });
  const publicRoutes = routes.filter((route) => route.visibility === "public");
  const friendsRoutes = routes.filter((route) => route.visibility === "friends");
  const privateRoutes = routes.filter((route) => route.visibility === "private");

  return (
    <div className="space-y-4 p-4 md:p-6">
      <section className="rounded-3xl border border-border bg-card px-4 py-4 shadow-sm md:px-5">
        <h1 className="text-lg font-bold text-foreground md:text-xl">Lộ trình trên hệ thống</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Bạn đang xem toàn bộ lộ trình theo quyền hiển thị: công khai, bạn bè và chỉ mình tôi.
        </p>
      </section>

      <UserRoutesList
        title="Công khai"
        routes={publicRoutes}
        emptyMessage="Chưa có lộ trình công khai nào."
        showOwner
      />

      <UserRoutesList
        title="Bạn bè"
        routes={friendsRoutes}
        emptyMessage="Không có lộ trình bạn bè phù hợp với bạn hiện tại."
        showOwner
      />

      <UserRoutesList
        title="Chỉ mình tôi"
        routes={privateRoutes}
        emptyMessage="Bạn chưa có lộ trình riêng tư nào."
        showOwner
      />
    </div>
  );
}

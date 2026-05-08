import type { UserRoute } from "@/models/route.model";
import { getVisibilityLabel } from "@/lib/user-routes";
import { cn } from "@/lib/utils";

type UserRoutesListProps = {
  title: string;
  routes: UserRoute[];
  emptyMessage: string;
  showOwner?: boolean;
};

function formatRouteDate(value: string) {
  return new Intl.DateTimeFormat("vi-VN", { dateStyle: "medium" }).format(
    new Date(value),
  );
}

function visibilityClassName(visibility: UserRoute["visibility"]) {
  if (visibility === "public") {
    return "border-emerald-300 bg-emerald-50 text-emerald-700";
  }

  if (visibility === "friends") {
    return "border-sky-300 bg-sky-50 text-sky-700";
  }

  return "border-slate-300 bg-slate-100 text-slate-700";
}

export function UserRoutesList({
  title,
  routes,
  emptyMessage,
  showOwner = false,
}: UserRoutesListProps) {
  return (
    <section className="rounded-3xl border border-border bg-card p-4 shadow-sm md:p-5">
      <div className="mb-3 flex items-center justify-between gap-2">
        <h2 className="text-base font-bold text-foreground">{title}</h2>
        <span className="rounded-full border border-border bg-background px-2.5 py-1 text-xs text-muted-foreground">
          {routes.length}
        </span>
      </div>

      {routes.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-border bg-background/60 px-3 py-3 text-sm text-muted-foreground">
          {emptyMessage}
        </p>
      ) : (
        <div className="space-y-3">
          {routes.map((route) => {
            const destinationStops = route.stops.filter((stop) => stop.stop_kind === "record");

            return (
              <article
                key={route.id}
                className="rounded-2xl border border-border bg-background/70 px-3 py-3"
              >
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-sm font-semibold text-foreground">{route.title}</p>
                  <span
                    className={cn(
                      "rounded-full border px-2 py-0.5 text-[11px] font-medium",
                      visibilityClassName(route.visibility),
                    )}
                  >
                    {getVisibilityLabel(route.visibility)}
                  </span>
                </div>

                <p className="mt-1 text-xs text-muted-foreground">
                  Bắt đầu: {formatRouteDate(route.start_date)}
                </p>

                {showOwner ? (
                  <p className="mt-1 text-xs text-muted-foreground">
                    Chủ sở hữu: {route.owner_display_name}
                  </p>
                ) : null}

                {route.summary ? (
                  <p className="mt-2 text-xs text-muted-foreground">{route.summary}</p>
                ) : null}

                <div className="mt-2 rounded-xl border border-border bg-card px-2.5 py-2 text-xs text-foreground">
                  <p>
                    <span className="font-semibold">A</span>: {route.origin_label}
                  </p>

                  {destinationStops.length > 0 ? (
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {destinationStops.map((stop, index) => (
                        <span
                          key={stop.id}
                          className="rounded-full border border-border bg-background px-2 py-0.5 text-[11px] text-muted-foreground"
                        >
                          {index + 1}. {stop.label}
                        </span>
                      ))}
                    </div>
                  ) : (
                    <p className="mt-2 text-[11px] text-muted-foreground">
                      Chưa có điểm đến trong lộ trình này.
                    </p>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}

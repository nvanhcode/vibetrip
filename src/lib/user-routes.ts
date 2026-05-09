import type { SupabaseClient } from "@supabase/supabase-js";
import type { UserRoute, UserRouteStop } from "@/models/route.model";

type RouteRow = Omit<UserRoute, "stops">;

type StopRow = UserRouteStop;

type FetchRoutesOptions = {
  ownerId?: string;
  limit?: number;
};

export async function fetchVisibleRoutes(
  supabase: SupabaseClient,
  options: FetchRoutesOptions = {},
): Promise<UserRoute[]> {
  const limit = Math.min(Math.max(options.limit ?? 120, 1), 400);

  let query = supabase
    .from("user_routes")
    .select(
      "id, owner_id, owner_display_name, title, start_date, visibility, origin_label, origin_latitude, origin_longitude, summary, stop_count, created_at",
    )
    .order("start_date", { ascending: true })
    .order("created_at", { ascending: false })
    .limit(limit);

  if (options.ownerId) {
    query = query.eq("owner_id", options.ownerId);
  }

  const { data: routeRows, error: routeError } = await query;
  if (routeError || !Array.isArray(routeRows) || routeRows.length === 0) {
    return [];
  }

  const normalizedRouteRows = routeRows as RouteRow[];
  const routeIds = normalizedRouteRows.map((route) => route.id);

  const { data: stopRows } = await supabase
    .from("user_route_stops")
    .select(
      "id, route_id, position, stop_kind, label, latitude, longitude, event_record_id",
    )
    .in("route_id", routeIds)
    .order("position", { ascending: true });

  const stopsByRouteId = new Map<string, UserRouteStop[]>();

  for (const stop of (stopRows ?? []) as StopRow[]) {
    const currentStops = stopsByRouteId.get(stop.route_id) ?? [];
    currentStops.push(stop);
    stopsByRouteId.set(stop.route_id, currentStops);
  }

  return normalizedRouteRows.map((route) => ({
    ...route,
    stops: stopsByRouteId.get(route.id) ?? [],
  }));
}

export async function fetchRouteById(
  supabase: SupabaseClient,
  routeId: string,
): Promise<UserRoute | null> {
  const { data: routeRow, error: routeError } = await supabase
    .from("user_routes")
    .select(
      "id, owner_id, owner_display_name, title, start_date, visibility, origin_label, origin_latitude, origin_longitude, summary, stop_count, created_at",
    )
    .eq("id", routeId)
    .maybeSingle();

  if (routeError || !routeRow) {
    return null;
  }

  const { data: stopRows } = await supabase
    .from("user_route_stops")
    .select(
      "id, route_id, position, stop_kind, label, latitude, longitude, event_record_id",
    )
    .eq("route_id", routeId)
    .order("position", { ascending: true });

  return {
    ...(routeRow as RouteRow),
    stops: (stopRows ?? []) as UserRouteStop[],
  };
}

export function getVisibilityLabel(visibility: UserRoute["visibility"]) {
  if (visibility === "public") {
    return "Công khai";
  }

  if (visibility === "friends") {
    return "Bạn bè";
  }

  return "Chỉ mình tôi";
}

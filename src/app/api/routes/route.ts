import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import type { RouteVisibility } from "@/models/route.model";

type SaveRouteStopInput = {
  label?: string;
  coordinates?: [number, number];
  kind?: "origin" | "record";
  recordId?: string;
};

type SaveRouteRequest = {
  title?: string;
  startDate?: string;
  visibility?: RouteVisibility;
  summary?: string | null;
  stops?: SaveRouteStopInput[];
};

const VISIBILITY_VALUES = new Set<RouteVisibility>(["public", "friends", "private"]);

function isValidDateInput(value: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value);
}

function normalizeTitle(stops: SaveRouteStopInput[]) {
  const origin = stops.find((stop) => stop.kind === "origin")?.label?.trim() || "Điểm bắt đầu";
  const firstDestination =
    stops.find((stop) => stop.kind === "record")?.label?.trim() || "Điểm đến";

  return `${origin} -> ${firstDestination}`.slice(0, 120);
}

function resolveUserDisplayName(user: {
  email?: string | null;
  user_metadata?: Record<string, unknown>;
}) {
  const metadata = user.user_metadata ?? {};
  const fullName =
    typeof metadata.full_name === "string" ? metadata.full_name.trim() : "";

  if (fullName) {
    return fullName.slice(0, 120);
  }

  const emailPrefix = (user.email ?? "").split("@")[0]?.trim() ?? "";
  if (emailPrefix) {
    return emailPrefix.slice(0, 120);
  }

  return "Người dùng";
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let payload: SaveRouteRequest;

  try {
    payload = (await request.json()) as SaveRouteRequest;
  } catch {
    return NextResponse.json({ error: "Payload khong hop le." }, { status: 400 });
  }

  const startDate = payload.startDate?.trim() ?? "";
  const title = payload.title?.trim() ?? "";
  const visibility = payload.visibility;
  const stops = Array.isArray(payload.stops) ? payload.stops : [];

  if (!title) {
    return NextResponse.json({ error: "Vui lòng nhập tên lộ trình." }, { status: 400 });
  }

  if (!isValidDateInput(startDate)) {
    return NextResponse.json({ error: "Ngày bắt đầu không hợp lệ." }, { status: 400 });
  }

  if (!visibility || !VISIBILITY_VALUES.has(visibility)) {
    return NextResponse.json({ error: "Chế độ riêng tư không hợp lệ." }, { status: 400 });
  }

  if (stops.length < 2) {
    return NextResponse.json({ error: "Cần ít nhất điểm bắt đầu và 1 điểm đến." }, { status: 400 });
  }

  const origin = stops[0];
  if (origin.kind !== "origin") {
    return NextResponse.json({ error: "Điểm đầu tiên phải là điểm bắt đầu." }, { status: 400 });
  }

  const hasInvalidStop = stops.some((stop) => {
    if (!stop.label?.trim()) {
      return true;
    }

    if (!Array.isArray(stop.coordinates) || stop.coordinates.length !== 2) {
      return true;
    }

    const [lng, lat] = stop.coordinates;
    return !Number.isFinite(lng) || !Number.isFinite(lat);
  });

  if (hasInvalidStop) {
    return NextResponse.json({ error: "Danh sách điểm dừng không hợp lệ." }, { status: 400 });
  }

  const ownerDisplayName = resolveUserDisplayName(user);
  const finalTitle = title || normalizeTitle(stops);
  const summary = typeof payload.summary === "string" ? payload.summary.trim() || null : null;

  const { data: insertedRoute, error: routeError } = await supabase
    .from("user_routes")
    .insert({
      owner_id: user.id,
      owner_display_name: ownerDisplayName,
      title: finalTitle,
      start_date: startDate,
      visibility,
      origin_label: origin.label?.trim() ?? "Điểm bắt đầu",
      origin_latitude: origin.coordinates?.[1],
      origin_longitude: origin.coordinates?.[0],
      summary,
      stop_count: Math.max(0, stops.length - 1),
    })
    .select("id")
    .single();

  if (routeError || !insertedRoute?.id) {
    return NextResponse.json(
      { error: "Không thể lưu lộ trình lúc này." },
      { status: 500 },
    );
  }

  const routeId = insertedRoute.id;

  const stopRows = stops.map((stop, index) => ({
    route_id: routeId,
    position: index,
    stop_kind: stop.kind,
    label: stop.label?.trim(),
    latitude: stop.coordinates?.[1],
    longitude: stop.coordinates?.[0],
    event_record_id: stop.recordId ?? null,
  }));

  const { error: stopError } = await supabase
    .from("user_route_stops")
    .insert(stopRows);

  if (stopError) {
    // Best-effort cleanup since this endpoint writes to 2 tables.
    await supabase.from("user_routes").delete().eq("id", routeId);

    return NextResponse.json(
      { error: "Lưu điểm dừng thất bại. Vui lòng thử lại." },
      { status: 500 },
    );
  }

  return NextResponse.json({ id: routeId }, { status: 201 });
}

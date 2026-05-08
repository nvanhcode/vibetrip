import { NextRequest, NextResponse } from "next/server";
import type { EventRecordKind } from "@/models/event.model";
import { createClient } from "@/lib/supabase/server";

type EventCategoryRelation = {
  category_id?: string;
  event_categories?:
    | {
        id?: string;
        name?: string;
      }
    | Array<{
        id?: string;
        name?: string;
      }>
    | null;
};

type EventRecordRow = {
  id: string;
  record_kind: EventRecordKind;
  event_name: string;
  event_type: string;
  event_description: string;
  image_urls: string[];
  goong_latitude: number;
  goong_longitude: number;
  organized_at: string | null;
  opens_at: string | null;
  closes_at: string | null;
  event_record_categories?: EventCategoryRelation[] | null;
};

type ParsedBounds = {
  minLat: number;
  maxLat: number;
  minLng: number;
  maxLng: number;
};

function parseNumber(value: string | null) {
  if (!value) return null;
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return null;
  return parsed;
}

function parseBounds(searchParams: URLSearchParams): ParsedBounds | null {
  const minLat = parseNumber(searchParams.get("minLat"));
  const maxLat = parseNumber(searchParams.get("maxLat"));
  const minLng = parseNumber(searchParams.get("minLng"));
  const maxLng = parseNumber(searchParams.get("maxLng"));

  if (
    minLat === null ||
    maxLat === null ||
    minLng === null ||
    maxLng === null ||
    minLat > maxLat ||
    minLng > maxLng
  ) {
    return null;
  }

  return { minLat, maxLat, minLng, maxLng };
}

function parseCategoryIds(value: string | null) {
  if (!value) return [] as string[];
  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function toRadians(degrees: number) {
  return (degrees * Math.PI) / 180;
}

function haversineKm(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number,
) {
  const earthRadiusKm = 6371;
  const dLat = toRadians(lat2 - lat1);
  const dLng = toRadians(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRadians(lat1)) *
      Math.cos(toRadians(lat2)) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return earthRadiusKm * c;
}

function normalizeCategory(
  relation: EventCategoryRelation,
): { id: string; name: string } | null {
  const rawCategory = Array.isArray(relation.event_categories)
    ? relation.event_categories[0]
    : relation.event_categories;

  if (!rawCategory?.id || !rawCategory.name) {
    return null;
  }

  return {
    id: rawCategory.id,
    name: rawCategory.name,
  };
}

export async function GET(request: NextRequest) {
  const bounds = parseBounds(request.nextUrl.searchParams);

  if (!bounds) {
    return NextResponse.json(
      { error: "Phạm vi bản đồ không hợp lệ." },
      { status: 400 },
    );
  }

  const search = request.nextUrl.searchParams.get("search")?.trim() ?? "";
  const categoryIds = parseCategoryIds(
    request.nextUrl.searchParams.get("categoryIds"),
  );

  const radiusKm = parseNumber(request.nextUrl.searchParams.get("radiusKm"));
  const centerLat = parseNumber(request.nextUrl.searchParams.get("centerLat"));
  const centerLng = parseNumber(request.nextUrl.searchParams.get("centerLng"));
  const hasRadiusFilter =
    radiusKm !== null && radiusKm > 0 && centerLat !== null && centerLng !== null;

  try {
    const supabase = await createClient();
    let scopedRecordIds: string[] | null = null;

    if (categoryIds.length > 0) {
      const { data: relationRows, error: relationError } = await supabase
        .from("event_record_categories")
        .select("event_record_id, category_id")
        .in("category_id", categoryIds);

      if (relationError) {
        return NextResponse.json(
          { error: "Không thể lọc danh mục lúc này." },
          { status: 500 },
        );
      }

      scopedRecordIds = Array.from(
        new Set((relationRows ?? []).map((row) => row.event_record_id)),
      );

      if (scopedRecordIds.length === 0) {
        return NextResponse.json({ records: [] }, { status: 200 });
      }
    }

    let query = supabase
      .from("event_records")
      .select(
        `
          id,
          record_kind,
          event_name,
          event_type,
          event_description,
          image_urls,
          goong_latitude,
          goong_longitude,
          organized_at,
          opens_at,
          closes_at,
          event_record_categories(category_id, event_categories(id, name))
        `,
      )
      .eq("is_approved", true)
      .not("goong_latitude", "is", null)
      .not("goong_longitude", "is", null)
      .gte("goong_latitude", bounds.minLat)
      .lte("goong_latitude", bounds.maxLat)
      .gte("goong_longitude", bounds.minLng)
      .lte("goong_longitude", bounds.maxLng)
      .limit(500);

    if (scopedRecordIds) {
      query = query.in("id", scopedRecordIds);
    }

    if (search.length >= 2) {
      const keyword = search.replaceAll(",", " ");
      query = query.or(
        `event_name.ilike.%${keyword}%,event_type.ilike.%${keyword}%,event_description.ilike.%${keyword}%`,
      );
    }

    if (hasRadiusFilter && radiusKm !== null && centerLat !== null && centerLng !== null) {
      const latDelta = radiusKm / 111.32;
      const cosLat = Math.max(Math.cos(toRadians(centerLat)), 0.01);
      const lngDelta = radiusKm / (111.32 * cosLat);

      query = query
        .gte("goong_latitude", centerLat - latDelta)
        .lte("goong_latitude", centerLat + latDelta)
        .gte("goong_longitude", centerLng - lngDelta)
        .lte("goong_longitude", centerLng + lngDelta);
    }

    const { data, error } = await query;

    if (error) {
      return NextResponse.json(
        { error: "Không thể tải dữ liệu bản đồ." },
        { status: 500 },
      );
    }

    const rows = (data ?? []) as EventRecordRow[];

    const records = rows
      .filter((row) => {
        if (!hasRadiusFilter || radiusKm === null || centerLat === null || centerLng === null) {
          return true;
        }

        return (
          haversineKm(
            centerLat,
            centerLng,
            row.goong_latitude,
            row.goong_longitude,
          ) <= radiusKm
        );
      })
      .map((row) => ({
        id: row.id,
        record_kind: row.record_kind,
        event_name: row.event_name,
        event_type: row.event_type,
        event_description: row.event_description,
        image_urls: Array.isArray(row.image_urls) ? row.image_urls : [],
        goong_latitude: row.goong_latitude,
        goong_longitude: row.goong_longitude,
        organized_at: row.organized_at,
        opens_at: row.opens_at,
        closes_at: row.closes_at,
        categories: (row.event_record_categories ?? [])
          .map((relation) => normalizeCategory(relation))
          .filter((category): category is { id: string; name: string } => Boolean(category)),
      }));

    return NextResponse.json({ records }, { status: 200 });
  } catch {
    return NextResponse.json(
      { error: "Đã xảy ra lỗi khi tải dữ liệu bản đồ." },
      { status: 500 },
    );
  }
}

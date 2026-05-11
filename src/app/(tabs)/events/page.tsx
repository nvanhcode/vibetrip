import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { FavoriteButton } from "@/components/app/favorite-button";
import { createClient } from "@/lib/supabase/server";

type PageProps = {
  searchParams?: Promise<{ [key: string]: string | string[] | undefined }>;
};

type CategoryOption = {
  id: string;
  name: string;
};

function single(v: string | string[] | undefined): string {
  return Array.isArray(v) ? (v[0] ?? "") : (v ?? "");
}

export default async function EventsPage({ searchParams }: PageProps) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const params = await searchParams;
  const cat = single(params?.category);
  const prov = single(params?.province);
  const wardRaw = single(params?.ward);
  const view = single(params?.view) || "grid";

  const [provincesRes, wardsRes, categoriesRes, recordsRes] = await Promise.all([
    supabase.from("provinces").select("code, name").order("name", { ascending: true }),
    supabase.from("wards").select("code, province_code, name").order("name", { ascending: true }),
    supabase.from("event_categories").select("id, name").order("name", { ascending: true }),
    supabase
      .from("event_records")
      .select("id, record_kind, province_code, ward_code, event_name, event_type, image_urls, goong_latitude, goong_longitude, created_at")
      .eq("is_approved", true)
      .order("created_at", { ascending: false }),
  ]);

  const provinces = provincesRes.data ?? [];
  const wards = wardsRes.data ?? [];
  const categories = categoriesRes.data ?? [];
  const records = recordsRes.data ?? [];

  const scopedWards = prov ? wards.filter((w) => w.province_code === prov) : [];
  const ward = scopedWards.some((w) => w.code === wardRaw) ? wardRaw : "";

  const ids = records.map((r) => r.id);
  const [catRowsRes, favoritesRes] = await Promise.all([
    ids.length
      ? supabase
          .from("event_record_categories")
          .select("event_record_id, event_categories(id, name)")
          .in("event_record_id", ids)
      : Promise.resolve({
          data: [] as Array<{
            event_record_id: string;
            event_categories: { id: string; name: string } | null;
          }>,
        }),
    supabase
      .from("user_event_favorites")
      .select("event_record_id")
      .eq("user_id", user.id),
  ]);

  const catMap = new Map<string, { id: string; name: string }[]>();
  for (const row of catRowsRes.data ?? []) {
    const c = Array.isArray(row.event_categories) ? row.event_categories[0] : row.event_categories;
    if (!c?.id) continue;
    catMap.set(row.event_record_id, [...(catMap.get(row.event_record_id) ?? []), c]);
  }

  const favoriteSet = new Set((favoritesRes.data ?? []).map((f) => f.event_record_id));

  const provMap = new Map(provinces.map((p) => [p.code, p.name]));
  const wardMap = new Map(wards.map((w) => [w.code, w.name]));

  const visible = records.filter((r) => {
    if (prov && r.province_code !== prov) return false;
    if (ward && r.ward_code !== ward) return false;
    if (cat) return (catMap.get(r.id) ?? []).some((c) => c.id === cat);
    return true;
  });

  const filterCount = [cat, prov, ward].filter(Boolean).length;

  function href(overrides: Record<string, string> = {}) {
    const base: Record<string, string> = { view, category: cat, province: prov, ward };
    const merged = { ...base, ...overrides };
    const p = new URLSearchParams();
    for (const [k, v] of Object.entries(merged)) {
      if (v) p.set(k, v);
    }
    const q = p.toString();
    return q ? `/events?${q}` : "/events";
  }

  return (
    <div className="space-y-4 p-4 md:p-6">
      {/* ── Header ── */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-foreground">Sự kiện & Địa điểm</h1>
          <p className="text-sm text-muted-foreground">Khám phá sự kiện và địa điểm đã được kiểm duyệt.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button asChild variant="outline" size="sm">
            <Link href="/events/stats">Thống kê</Link>
          </Button>
          <Button asChild variant="outline" size="sm">
            <Link href="/events/admin">Quản trị</Link>
          </Button>
          <Button asChild size="sm">
            <Link href="/events/new">+ Tạo bản ghi</Link>
          </Button>
        </div>
      </div>

      {/* ── Filter form ── */}
      <form className="grid gap-3 rounded-2xl border border-border bg-muted/20 p-4 md:grid-cols-4">
        <input type="hidden" name="view" value={view} />

        <label className="space-y-1 text-sm">
          <span className="font-medium text-foreground">Danh mục</span>
          <select
            name="category"
            defaultValue={cat}
            className="h-9 w-full rounded-4xl border border-input bg-background px-3 text-sm text-foreground"
          >
            <option value="">Tất cả danh mục</option>
            {(categories as CategoryOption[]).map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </label>

        <label className="space-y-1 text-sm">
          <span className="font-medium text-foreground">Tỉnh</span>
          <select
            name="province"
            defaultValue={prov}
            className="h-9 w-full rounded-4xl border border-input bg-background px-3 text-sm text-foreground"
          >
            <option value="">Tất cả tỉnh</option>
            {provinces.map((p) => (
              <option key={p.code} value={p.code}>
                {p.name}
              </option>
            ))}
          </select>
        </label>

        <label className="space-y-1 text-sm">
          <span className="font-medium text-foreground">Xã</span>
          <select
            name="ward"
            defaultValue={ward}
            disabled={!prov}
            className="h-9 w-full rounded-4xl border border-input bg-background px-3 text-sm text-foreground disabled:cursor-not-allowed disabled:opacity-50"
          >
            <option value="">{prov ? "Tất cả xã" : "Chọn tỉnh trước"}</option>
            {scopedWards.map((w) => (
              <option key={w.code} value={w.code}>
                {w.name}
              </option>
            ))}
          </select>
        </label>

        <div className="flex items-end gap-2">
          <Button type="submit" className="flex-1">
            Áp dụng
          </Button>
          <Button asChild variant="outline" className="flex-1">
            <Link href={href({ category: "", province: "", ward: "" })}>Bỏ lọc</Link>
          </Button>
        </div>
      </form>

      {/* ── Count + view toggle ── */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {visible.length} kết quả{filterCount > 0 ? ` · ${filterCount} bộ lọc đang áp dụng` : ""}
        </p>
        <div className="flex gap-1 rounded-xl border border-border p-1">
          <Link
            href={href({ view: "grid" })}
            className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
              view === "grid" ? "bg-foreground text-background" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            Lưới
          </Link>
          <Link
            href={href({ view: "list" })}
            className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
              view === "list" ? "bg-foreground text-background" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            Danh sách
          </Link>
        </div>
      </div>

      {/* ── Empty state ── */}
      {visible.length === 0 && (
        <div className="py-16 text-center">
          <p className="text-muted-foreground">Không có kết quả phù hợp.</p>
          <Button asChild variant="outline" className="mt-4">
            <Link href="/events">Xóa bộ lọc</Link>
          </Button>
        </div>
      )}

      {/* ── Grid view ── */}
      {view === "grid" && visible.length > 0 && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {visible.map((record) => {
            const cats = catMap.get(record.id) ?? [];
            const img = Array.isArray(record.image_urls)
              ? (record.image_urls[0] as string | undefined)
              : undefined;

            return (
              <div
                key={record.id}
                className="group flex flex-col overflow-hidden rounded-2xl border border-border bg-card transition-shadow hover:shadow-md"
              >
                <div className="relative h-44 w-full bg-muted">
                  {img ? (
                    <Image
                      src={img}
                      alt={record.event_name}
                      fill
                      sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                      className="object-cover transition-transform duration-300 group-hover:scale-105"
                    />
                  ) : (
                    <div className="flex h-full items-center justify-center text-xs text-muted-foreground">
                      Không có ảnh
                    </div>
                  )}
                  <div className="absolute left-3 top-3">
                    <Badge variant={record.record_kind === "event" ? "default" : "secondary"}>
                      {record.record_kind === "event" ? "Sự kiện" : "Địa điểm"}
                    </Badge>
                  </div>
                </div>

                <div className="flex flex-1 flex-col gap-2 p-4">
                  <p className="line-clamp-2 font-semibold leading-snug text-foreground">
                    {record.event_name}
                  </p>
                  {record.event_type && (
                    <p className="text-xs text-muted-foreground">{record.event_type}</p>
                  )}
                  <p className="text-xs text-muted-foreground">
                    📍 {provMap.get(record.province_code) ?? record.province_code}
                    {record.ward_code
                      ? ` · ${wardMap.get(record.ward_code) ?? record.ward_code}`
                      : ""}
                  </p>
                  {cats.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {cats.slice(0, 3).map((c) => (
                        <Badge key={c.id} variant="outline" className="text-xs">
                          {c.name}
                        </Badge>
                      ))}
                      {cats.length > 3 && (
                        <Badge variant="outline" className="text-xs">
                          +{cats.length - 3}
                        </Badge>
                      )}
                    </div>
                  )}
                  <div className="mt-auto flex gap-2">
                    <Button asChild variant="outline" size="sm" className="flex-1">
                      <Link href={`/events/${record.id}`}>Xem chi tiết</Link>
                    </Button>
                    <Button asChild variant="secondary" size="sm" className="flex-1">
                      <Link
                        href={`/map?record_id=${record.id}${record.goong_latitude && record.goong_longitude ? `&lat=${record.goong_latitude}&lng=${record.goong_longitude}` : ""}`}
                      >
                        Xem bản đồ
                      </Link>
                    </Button>
                    <FavoriteButton
                      eventRecordId={record.id}
                      initialIsFavorited={favoriteSet.has(record.id)}
                      size="sm"
                    />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ── List view ── */}
      {view === "list" && visible.length > 0 && (
        <div className="flex flex-col gap-3">
          {visible.map((record) => {
            const cats = catMap.get(record.id) ?? [];
            const img = Array.isArray(record.image_urls)
              ? (record.image_urls[0] as string | undefined)
              : undefined;

            return (
              <div
                key={record.id}
                className="flex items-center gap-4 rounded-2xl border border-border bg-card p-3 transition-shadow hover:shadow-sm"
              >
                <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-xl bg-muted">
                  {img ? (
                    <Image
                      src={img}
                      alt={record.event_name}
                      fill
                      sizes="64px"
                      className="object-cover"
                    />
                  ) : (
                    <div className="flex h-full items-center justify-center text-[10px] text-muted-foreground">
                      N/A
                    </div>
                  )}
                </div>

                <div className="flex min-w-0 flex-1 flex-col gap-1">
                  <div className="flex flex-wrap items-center gap-1">
                    <Badge
                      variant={record.record_kind === "event" ? "default" : "secondary"}
                      className="text-xs"
                    >
                      {record.record_kind === "event" ? "Sự kiện" : "Địa điểm"}
                    </Badge>
                    {cats.slice(0, 2).map((c) => (
                      <Badge key={c.id} variant="outline" className="text-xs">
                        {c.name}
                      </Badge>
                    ))}
                  </div>
                  <p className="truncate font-medium text-foreground">{record.event_name}</p>
                  <p className="text-xs text-muted-foreground">
                    📍 {provMap.get(record.province_code) ?? record.province_code}
                    {record.ward_code
                      ? ` · ${wardMap.get(record.ward_code) ?? record.ward_code}`
                      : ""}
                  </p>
                </div>

                <div className="flex shrink-0 gap-2">
                  <Button asChild variant="outline" size="sm">
                    <Link href={`/events/${record.id}`}>Chi tiết</Link>
                  </Button>
                  <Button asChild variant="secondary" size="sm">
                    <Link
                      href={`/map?record_id=${record.id}${record.goong_latitude && record.goong_longitude ? `&lat=${record.goong_latitude}&lng=${record.goong_longitude}` : ""}`}
                    >
                      Bản đồ
                    </Link>
                  </Button>
                  <FavoriteButton
                    eventRecordId={record.id}
                    initialIsFavorited={favoriteSet.has(record.id)}
                    size="sm"
                    variant="ghost"
                  />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

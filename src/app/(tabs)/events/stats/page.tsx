import Link from "next/link";
import { redirect } from "next/navigation";
import { EventStatsCharts, type SummaryRow } from "@/components/app/event-stats-charts";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { createClient } from "@/lib/supabase/server";

type PageProps = {
  searchParams?: Promise<{ [key: string]: string | string[] | undefined }>;
};

type CategoryOption = {
  id: string;
  name: string;
};

type RecordCategory = {
  id: string;
  name: string;
};



function toSingleValue(value: string | string[] | undefined) {
  if (Array.isArray(value)) return value[0] ?? "";
  return value ?? "";
}

function buildEventsHref(filters: {
  category?: string;
  province?: string;
  ward?: string;
}) {
  const params = new URLSearchParams();

  if (filters.category) {
    params.set("category", filters.category);
  }

  if (filters.province) {
    params.set("province", filters.province);
  }

  if (filters.ward) {
    params.set("ward", filters.ward);
  }

  const query = params.toString();
  return query ? `/events?${query}` : "/events";
}

function sortRows(rows: SummaryRow[]) {
  return rows.sort((left, right) => {
    if (right.total !== left.total) {
      return right.total - left.total;
    }

    return left.label.localeCompare(right.label, "vi");
  });
}

function renderSummaryTable(rows: SummaryRow[], emptyLabel: string) {
  if (rows.length === 0) {
    return <p className="text-sm text-muted-foreground">{emptyLabel}</p>;
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-border">
      <table className="w-full min-w-2xl text-left text-sm">
        <thead className="bg-muted/40 text-muted-foreground">
          <tr>
            <th className="px-4 py-3 font-medium">Nhóm</th>
            <th className="px-4 py-3 font-medium">Chi tiết</th>
            <th className="px-4 py-3 text-right font-medium">Tổng</th>
            <th className="px-4 py-3 text-right font-medium">Đã duyệt</th>
            <th className="px-4 py-3 text-right font-medium">Chờ duyệt</th>
            <th className="px-4 py-3 text-right font-medium">Từ chối</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.key} className="border-t border-border/70 bg-background/80 align-top">
              <td className="px-4 py-3 font-medium text-foreground">{row.label}</td>
              <td className="px-4 py-3 text-muted-foreground">{row.description || "-"}</td>
              <td className="px-4 py-3 text-right font-semibold text-foreground">{row.total}</td>
              <td className="px-4 py-3 text-right text-muted-foreground">{row.approved}</td>
              <td className="px-4 py-3 text-right text-muted-foreground">{row.pending}</td>
              <td className="px-4 py-3 text-right text-muted-foreground">{row.rejected}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default async function EventStatsPage({ searchParams }: PageProps) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const [params, provincesRes, wardsRes, categoriesRes, recordsRes] = await Promise.all([
    searchParams,
    supabase.from("provinces").select("code, name").order("name", { ascending: true }),
    supabase.from("wards").select("code, province_code, name").order("name", { ascending: true }),
    supabase.from("event_categories").select("id, name").order("name", { ascending: true }),
    supabase
      .from("event_records")
      .select("id, record_kind, province_code, ward_code, is_approved, reviewed_at")
      .eq("record_kind", "place"),
  ]);

  const selectedCategoryId = toSingleValue(params?.category);
  const selectedProvinceCode = toSingleValue(params?.province);
  const selectedWardCodeRaw = toSingleValue(params?.ward);

  const provinces = provincesRes.data ?? [];
  const wards = wardsRes.data ?? [];
  const categories = categoriesRes.data ?? [];
  const placeRecords = recordsRes.data ?? [];
  const scopedWards = selectedProvinceCode
    ? wards.filter((ward) => ward.province_code === selectedProvinceCode)
    : [];
  const selectedWardCode = scopedWards.some((ward) => ward.code === selectedWardCodeRaw)
    ? selectedWardCodeRaw
    : "";
  const placeRecordIds = placeRecords.map((record) => record.id);

  const recordCategoriesRes = placeRecordIds.length
    ? await supabase
        .from("event_record_categories")
        .select("event_record_id, event_categories(id, name)")
        .in("event_record_id", placeRecordIds)
    : { data: [] as Array<{ event_record_id: string; event_categories: { id: string; name: string } | null }> };

  const provinceMap = new Map(provinces.map((province) => [province.code, province.name]));
  const wardMap = new Map(wards.map((ward) => [ward.code, ward.name]));
  const categoryMap = new Map<string, RecordCategory[]>();

  for (const row of recordCategoriesRes.data ?? []) {
    const category = Array.isArray(row.event_categories)
      ? row.event_categories[0]
      : row.event_categories;

    if (!category?.id || !category.name) continue;

    const values = categoryMap.get(row.event_record_id) ?? [];
    values.push({ id: category.id, name: category.name });
    categoryMap.set(row.event_record_id, values);
  }

  const visiblePlaces = placeRecords.filter((record) => {
    if (selectedProvinceCode && record.province_code !== selectedProvinceCode) {
      return false;
    }

    if (selectedWardCode && record.ward_code !== selectedWardCode) {
      return false;
    }

    if (selectedCategoryId) {
      const categoriesOfRecord = categoryMap.get(record.id) ?? [];
      return categoriesOfRecord.some((category) => category.id === selectedCategoryId);
    }

    return true;
  });

  const totalPlaces = visiblePlaces.length;
  const approvedPlaces = visiblePlaces.filter((record) => record.reviewed_at && record.is_approved).length;
  const pendingPlaces = visiblePlaces.filter((record) => !record.reviewed_at).length;
  const rejectedPlaces = visiblePlaces.filter((record) => record.reviewed_at && !record.is_approved).length;

  const provinceStatsMap = new Map<string, SummaryRow>();
  const wardStatsMap = new Map<string, SummaryRow>();
  const categoryStatsMap = new Map<string, SummaryRow>();

  for (const record of visiblePlaces) {
    const provinceCode = record.province_code;
    const wardCode = record.ward_code;
    const isApproved = Boolean(record.reviewed_at && record.is_approved);
    const isPending = !record.reviewed_at;
    const isRejected = Boolean(record.reviewed_at && !record.is_approved);

    const provinceRow = provinceStatsMap.get(provinceCode) ?? {
      key: provinceCode,
      label: provinceMap.get(provinceCode) ?? provinceCode,
      total: 0,
      approved: 0,
      pending: 0,
      rejected: 0,
    };
    provinceRow.total += 1;
    provinceRow.approved += Number(isApproved);
    provinceRow.pending += Number(isPending);
    provinceRow.rejected += Number(isRejected);
    provinceStatsMap.set(provinceCode, provinceRow);

    const wardRow = wardStatsMap.get(wardCode) ?? {
      key: wardCode,
      label: wardMap.get(wardCode) ?? wardCode,
      description: provinceMap.get(provinceCode) ?? provinceCode,
      total: 0,
      approved: 0,
      pending: 0,
      rejected: 0,
    };
    wardRow.total += 1;
    wardRow.approved += Number(isApproved);
    wardRow.pending += Number(isPending);
    wardRow.rejected += Number(isRejected);
    wardStatsMap.set(wardCode, wardRow);

    const categoriesOfRecord = categoryMap.get(record.id) ?? [];
    if (categoriesOfRecord.length === 0) {
      const uncategorizedRow = categoryStatsMap.get("uncategorized") ?? {
        key: "uncategorized",
        label: "Chưa chọn danh mục",
        total: 0,
        approved: 0,
        pending: 0,
        rejected: 0,
      };
      uncategorizedRow.total += 1;
      uncategorizedRow.approved += Number(isApproved);
      uncategorizedRow.pending += Number(isPending);
      uncategorizedRow.rejected += Number(isRejected);
      categoryStatsMap.set("uncategorized", uncategorizedRow);
      continue;
    }

    for (const category of categoriesOfRecord) {
      const categoryRow = categoryStatsMap.get(category.id) ?? {
        key: category.id,
        label: category.name,
        total: 0,
        approved: 0,
        pending: 0,
        rejected: 0,
      };
      categoryRow.total += 1;
      categoryRow.approved += Number(isApproved);
      categoryRow.pending += Number(isPending);
      categoryRow.rejected += Number(isRejected);
      categoryStatsMap.set(category.id, categoryRow);
    }
  }

  const provinceStats = sortRows(Array.from(provinceStatsMap.values()));
  const wardStats = sortRows(Array.from(wardStatsMap.values()));
  const categoryStats = sortRows(Array.from(categoryStatsMap.values()));
  const activeFilterCount = [selectedCategoryId, selectedProvinceCode, selectedWardCode].filter(Boolean).length;
  const selectedCategoryName = categories.find((category) => category.id === selectedCategoryId)?.name ?? "";
  const statsResetHref = "/events/stats";
  const listHref = buildEventsHref({
    category: selectedCategoryId,
    province: selectedProvinceCode,
    ward: selectedWardCode,
  });

  return (
    <div className="space-y-4 p-4 md:p-6">
      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <CardTitle>Thống kê địa điểm</CardTitle>
              <CardDescription>
                Tổng hợp số lượng địa điểm theo tỉnh, xã và danh mục. Thống kê này bao gồm cả bản ghi chờ duyệt và bị từ chối.
              </CardDescription>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Button asChild variant="outline">
                <Link href={listHref}>Về danh sách</Link>
              </Button>
              <Button asChild variant="default">
                <Link href="/events/new">Tạo bản ghi mới</Link>
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          <form className="grid gap-3 rounded-2xl border border-border bg-muted/20 p-4 md:grid-cols-4">
            <label className="space-y-1 text-sm text-muted-foreground">
              <span className="font-medium text-foreground">Danh mục</span>
              <select
                name="category"
                defaultValue={selectedCategoryId}
                className="h-9 w-full rounded-4xl border border-input bg-background px-3 text-sm text-foreground"
              >
                <option value="">Tất cả danh mục</option>
                {(categories as CategoryOption[]).map((category) => (
                  <option key={category.id} value={category.id}>
                    {category.name}
                  </option>
                ))}
              </select>
            </label>

            <label className="space-y-1 text-sm text-muted-foreground">
              <span className="font-medium text-foreground">Tỉnh</span>
              <select
                name="province"
                defaultValue={selectedProvinceCode}
                className="h-9 w-full rounded-4xl border border-input bg-background px-3 text-sm text-foreground"
              >
                <option value="">Tất cả tỉnh</option>
                {provinces.map((province) => (
                  <option key={province.code} value={province.code}>
                    {province.name}
                  </option>
                ))}
              </select>
            </label>

            <label className="space-y-1 text-sm text-muted-foreground">
              <span className="font-medium text-foreground">Xã</span>
              <select
                name="ward"
                defaultValue={selectedWardCode}
                disabled={!selectedProvinceCode}
                className="h-9 w-full rounded-4xl border border-input bg-background px-3 text-sm text-foreground disabled:cursor-not-allowed disabled:opacity-50"
              >
                <option value="">{selectedProvinceCode ? "Tất cả xã trong tỉnh" : "Chọn tỉnh trước"}</option>
                {scopedWards.map((ward) => (
                  <option key={ward.code} value={ward.code}>
                    {ward.name}
                  </option>
                ))}
              </select>
            </label>

            <div className="flex items-end gap-2">
              <Button type="submit" className="flex-1">Áp dụng</Button>
              <Button asChild variant="outline" className="flex-1">
                <Link href={statsResetHref}>Bỏ lọc</Link>
              </Button>
            </div>
          </form>

          <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-border bg-background/70 px-4 py-3 text-sm text-muted-foreground">
            <Badge variant="outline">{totalPlaces} địa điểm</Badge>
            {activeFilterCount > 0 && <Badge variant="secondary">{activeFilterCount} bộ lọc đang áp dụng</Badge>}
            {selectedProvinceCode && (
              <Badge variant="outline">
                {provinceMap.get(selectedProvinceCode) ?? selectedProvinceCode}
                {selectedWardCode ? ` / ${wardMap.get(selectedWardCode) ?? selectedWardCode}` : ""}
              </Badge>
            )}
            {selectedCategoryName && <Badge variant="outline">{selectedCategoryName}</Badge>}
          </div>

          <div className="grid gap-3 md:grid-cols-4">
            <div className="rounded-2xl border border-border bg-muted/20 p-4">
              <p className="text-sm text-muted-foreground">Tổng địa điểm</p>
              <p className="mt-2 text-3xl font-semibold text-foreground">{totalPlaces}</p>
            </div>
            <div className="rounded-2xl border border-border bg-muted/20 p-4">
              <p className="text-sm text-muted-foreground">Đã duyệt</p>
              <p className="mt-2 text-3xl font-semibold text-foreground">{approvedPlaces}</p>
            </div>
            <div className="rounded-2xl border border-border bg-muted/20 p-4">
              <p className="text-sm text-muted-foreground">Chờ duyệt</p>
              <p className="mt-2 text-3xl font-semibold text-foreground">{pendingPlaces}</p>
            </div>
            <div className="rounded-2xl border border-border bg-muted/20 p-4">
              <p className="text-sm text-muted-foreground">Từ chối</p>
              <p className="mt-2 text-3xl font-semibold text-foreground">{rejectedPlaces}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <EventStatsCharts
        provinceStats={provinceStats}
        wardStats={wardStats}
        categoryStats={categoryStats}
        totalPlaces={totalPlaces}
        approvedPlaces={approvedPlaces}
        pendingPlaces={pendingPlaces}
        rejectedPlaces={rejectedPlaces}
      />

      <Card>
        <CardHeader>
          <CardTitle>Bảng chi tiết — Theo tỉnh</CardTitle>
          <CardDescription>Số lượng địa điểm được nhóm theo tỉnh.</CardDescription>
        </CardHeader>
        <CardContent>
          {renderSummaryTable(provinceStats, "Chưa có địa điểm nào trong phạm vi lọc hiện tại.")}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Bảng chi tiết — Theo xã</CardTitle>
          <CardDescription>Số lượng địa điểm được nhóm theo xã.</CardDescription>
        </CardHeader>
        <CardContent>
          {renderSummaryTable(wardStats, "Chưa có xã nào có địa điểm trong phạm vi lọc hiện tại.")}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Bảng chi tiết — Theo danh mục</CardTitle>
          <CardDescription>
            Một địa điểm có thể xuất hiện ở nhiều danh mục nếu bản ghi được gắn nhiều danh mục.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {renderSummaryTable(categoryStats, "Chưa có danh mục nào trong phạm vi lọc hiện tại.")}
        </CardContent>
      </Card>
    </div>
  );
}

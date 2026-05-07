import Link from "next/link";
import { redirect } from "next/navigation";
import { FormSubmitButton } from "@/components/app/form-submit-button";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { resolveUserRole } from "@/lib/rbac";
import { createClient } from "@/lib/supabase/server";
import { deleteEventRecordAction, reviewEventRecordAction } from "./actions";

type PageProps = {
  searchParams?: Promise<{ [key: string]: string | string[] | undefined }>;
};

function toSingleValue(value: string | string[] | undefined) {
  if (Array.isArray(value)) return value[0] ?? "";
  return value ?? "";
}

function formatWeekday(weekday: number | null) {
  const labels: Record<number, string> = {
    1: "Thứ 2",
    2: "Thứ 3",
    3: "Thứ 4",
    4: "Thứ 5",
    5: "Thứ 6",
    6: "Thứ 7",
    7: "Chủ nhật",
  };

  if (!weekday || !labels[weekday]) {
    return "Không xác định";
  }

  return labels[weekday];
}

export default async function EventsPage({ searchParams }: PageProps) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const [params, role, provincesRes, wardsRes, recordsRes] = await Promise.all([
    searchParams,
    resolveUserRole(supabase, user.id),
    supabase.from("provinces").select("code, name").order("name", { ascending: true }),
    supabase.from("wards").select("code, province_code, name").order("name", { ascending: true }),
    supabase
      .from("event_records")
      .select(
        "id, record_kind, goong_place_id, goong_latitude, goong_longitude, province_code, ward_code, event_name, event_type, event_description, image_urls, allow_registration, organized_at, opens_at, closes_at, excluded_weekdays, schedule_description, contact_phone, contact_email, contact_name, is_approved, reviewed_by, reviewed_at, rejection_reason, created_by, created_at"
      )
      .order("created_at", { ascending: false }),
  ]);

  const pendingOnlyMine = toSingleValue(params?.pending) === "mine";

  const records = recordsRes.data ?? [];
  const recordIds = records.map((record) => record.id);

  const [recordCategoriesRes, recordOrganizersRes, recordSchedulesRes] = await Promise.all([
    recordIds.length
      ? supabase
        .from("event_record_categories")
        .select("event_record_id, event_categories(id, name)")
        .in("event_record_id", recordIds)
      : Promise.resolve({ data: [] as Array<{ event_record_id: string; event_categories: { id: string; name: string } | null }> }),
    recordIds.length
      ? supabase
        .from("event_record_organizers")
        .select("event_record_id, event_organizers(id, name)")
        .in("event_record_id", recordIds)
      : Promise.resolve({ data: [] as Array<{ event_record_id: string; event_organizers: { id: string; name: string } | null }> }),
    recordIds.length
      ? supabase
        .from("event_record_schedules")
        .select("event_record_id, slot_order, organized_at, weekday, opens_at, closes_at")
        .in("event_record_id", recordIds)
        .order("slot_order", { ascending: true })
      : Promise.resolve({
        data: [] as Array<{
          event_record_id: string;
          slot_order: number;
          organized_at: string | null;
          weekday: number | null;
          opens_at: string;
          closes_at: string;
        }>,
      }),
  ]);

  const provinceMap = new Map((provincesRes.data ?? []).map((province) => [province.code, province.name]));
  const wardMap = new Map((wardsRes.data ?? []).map((ward) => [ward.code, ward.name]));

  const categoryMap = new Map<string, string[]>();
  for (const row of recordCategoriesRes.data ?? []) {
    const categoryName = Array.isArray(row.event_categories)
      ? row.event_categories[0]?.name
      : row.event_categories?.name;
    if (!categoryName) continue;
    const values = categoryMap.get(row.event_record_id) ?? [];
    values.push(categoryName);
    categoryMap.set(row.event_record_id, values);
  }

  const organizerMap = new Map<string, string[]>();
  for (const row of recordOrganizersRes.data ?? []) {
    const organizerName = Array.isArray(row.event_organizers)
      ? row.event_organizers[0]?.name
      : row.event_organizers?.name;
    if (!organizerName) continue;
    const values = organizerMap.get(row.event_record_id) ?? [];
    values.push(organizerName);
    organizerMap.set(row.event_record_id, values);
  }

  const schedulesMap = new Map<
    string,
    Array<{ slot_order: number; organized_at: string | null; weekday: number | null; opens_at: string; closes_at: string }>
  >();
  for (const row of recordSchedulesRes.data ?? []) {
    const values = schedulesMap.get(row.event_record_id) ?? [];
    values.push(row);
    schedulesMap.set(row.event_record_id, values);
  }

  let managedProvinceCodes = new Set<string>();
  let managedWardCodes = new Set<string>();

  if (role === "province_manager") {
    const { data } = await supabase.from("province_managers").select("province_code").eq("user_id", user.id);
    managedProvinceCodes = new Set((data ?? []).map((item) => item.province_code));
  }

  if (role === "ward_admin") {
    const { data } = await supabase.from("ward_admins").select("ward_code").eq("user_id", user.id);
    managedWardCodes = new Set((data ?? []).map((item) => item.ward_code));
  }

  function canReviewRecord(record: { province_code: string; ward_code: string }) {
    if (role === "admin") return true;
    if (role === "province_manager") return managedProvinceCodes.has(record.province_code);
    if (role === "ward_admin") return managedWardCodes.has(record.ward_code);
    return false;
  }

  const visibleRecords = pendingOnlyMine
    ? records.filter((record) => !record.reviewed_at && canReviewRecord(record))
    : records;

  return (
    <div className="space-y-4 p-4 md:p-6">
      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <CardTitle>Danh sách sự kiện và địa điểm</CardTitle>
              <CardDescription>
                Hiển thị tất cả bản ghi đã tạo. Bạn có thể duyệt trực tiếp ngay tại đây nếu có quyền.
              </CardDescription>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Button asChild variant="default">
                <Link href="/events/new">Tạo bản ghi mới</Link>
              </Button>
              <Link
                href={pendingOnlyMine ? "/events" : "/events?pending=mine"}
                className="inline-flex h-9 items-center rounded-4xl border border-border px-3 text-sm font-medium hover:bg-muted"
              >
                {pendingOnlyMine ? "Xem tất cả" : "Chờ duyệt của tôi"}
              </Link>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {visibleRecords.length === 0 && <p className="text-sm text-muted-foreground">Chưa có bản ghi phù hợp.</p>}

          {visibleRecords.map((record) => {
            const categoryNames = categoryMap.get(record.id) ?? [];
            const organizerNames = organizerMap.get(record.id) ?? [];
            const schedules = schedulesMap.get(record.id) ?? [];
            const canReview = !record.reviewed_at && canReviewRecord(record);
            const canDelete =
              record.created_by === user.id &&
              (record.reviewed_at === null || (record.reviewed_at !== null && !record.is_approved));

            return (
              <div key={record.id} className="space-y-3 rounded-2xl border border-border bg-muted/20 p-4">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="outline">{record.record_kind === "event" ? "Sự kiện" : "Địa điểm"}</Badge>
                  {!record.reviewed_at && <Badge variant="secondary">Chờ duyệt</Badge>}
                  {record.reviewed_at && record.is_approved && <Badge>Đã duyệt</Badge>}
                  {record.reviewed_at && !record.is_approved && <Badge variant="destructive">Từ chối</Badge>}
                </div>

                <div>
                  <p className="text-base font-semibold text-foreground">{record.event_name}</p>
                  <p className="text-sm text-muted-foreground">{record.event_type}</p>
                </div>

                <p className="text-sm text-muted-foreground">{record.event_description}</p>

                {Array.isArray(record.image_urls) && record.image_urls.length > 0 && (
                  <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
                    {record.image_urls.map((imageUrl: string) => (
                      <img
                        key={`${record.id}-${imageUrl}`}
                        src={imageUrl}
                        alt={record.event_name}
                        className="h-28 w-full rounded-xl object-cover"
                        loading="lazy"
                      />
                    ))}
                  </div>
                )}

                <div className="grid gap-2 text-sm text-muted-foreground md:grid-cols-2">
                  <p>Tỉnh: {provinceMap.get(record.province_code) ?? record.province_code}</p>
                  <p>Xã: {wardMap.get(record.ward_code) ?? record.ward_code}</p>
                  <p>Goong ID: {record.goong_place_id}</p>
                  <p>
                    Tọa độ: {record.goong_latitude}, {record.goong_longitude}
                  </p>
                  <p>Cho đăng ký: {record.allow_registration ? "Có" : "Không"}</p>
                  <p>Mô tả lịch: {record.schedule_description || "Không có"}</p>
                  <p>SĐT liên hệ: {record.contact_phone || "Không có"}</p>
                  <p>Email liên hệ: {record.contact_email || "Không có"}</p>
                  <p>Tên liên hệ: {record.contact_name || "Không có"}</p>
                </div>

                <div className="space-y-2 rounded-xl border border-border bg-background/70 p-3 text-sm text-muted-foreground">
                  <p className="font-medium text-foreground">Khung thời gian</p>
                  {schedules.length === 0 && record.organized_at && record.opens_at && record.closes_at && (
                    <p>
                      1. {new Date(record.organized_at).toLocaleString("vi-VN")} | {record.opens_at.slice(0, 5)} - {record.closes_at.slice(0, 5)}
                    </p>
                  )}
                  {schedules.length === 0 && (!record.organized_at || !record.opens_at || !record.closes_at) && (
                    <p>Không có</p>
                  )}
                  {schedules.map((schedule) => (
                    <p key={`${record.id}-schedule-${schedule.slot_order}`}>
                      {schedule.slot_order + 1}. {schedule.organized_at ? `Ngày cụ thể: ${new Date(schedule.organized_at).toLocaleString("vi-VN")}` : `Lịch theo thứ: ${formatWeekday(schedule.weekday)}`} | {schedule.opens_at.slice(0, 5)} - {schedule.closes_at.slice(0, 5)}
                    </p>
                  ))}
                </div>

                <div className="flex flex-wrap gap-2">
                  {categoryNames.length === 0 && <Badge variant="outline">Chưa chọn danh mục</Badge>}
                  {categoryNames.map((name) => (
                    <Badge key={`${record.id}-cat-${name}`} variant="outline">
                      {name}
                    </Badge>
                  ))}
                </div>

                <div className="flex flex-wrap gap-2">
                  {organizerNames.length === 0 && <Badge variant="outline">Chưa có đơn vị tổ chức</Badge>}
                  {organizerNames.map((name) => (
                    <Badge key={`${record.id}-org-${name}`} variant="outline">
                      {name}
                    </Badge>
                  ))}
                </div>

                {record.reviewed_at && (
                  <div className="rounded-xl border border-border bg-background/70 p-3 text-sm text-muted-foreground">
                    <p>Duyệt lúc: {new Date(record.reviewed_at).toLocaleString("vi-VN")}</p>
                    <p>Người duyệt: {record.reviewed_by ?? "N/A"}</p>
                    {!record.is_approved && <p>Lý do từ chối: {record.rejection_reason || "Không có"}</p>}
                  </div>
                )}

                {canDelete && (
                  <form action={deleteEventRecordAction}>
                    <input type="hidden" name="record_id" value={record.id} />
                    <FormSubmitButton idleText="Xóa bản ghi" pendingText="Đang xóa..." variant="destructive" />
                  </form>
                )}

                {canReview && (
                  <div className="grid gap-2 md:grid-cols-2">
                    <form action={reviewEventRecordAction} className="flex items-center gap-2">
                      <input type="hidden" name="record_id" value={record.id} />
                      <input type="hidden" name="decision" value="approve" />
                      <FormSubmitButton idleText="Duyệt" pendingText="Đang duyệt..." />
                    </form>

                    <form action={reviewEventRecordAction} className="space-y-2">
                      <input type="hidden" name="record_id" value={record.id} />
                      <input type="hidden" name="decision" value="reject" />
                      <input
                        name="rejection_reason"
                        placeholder="Lý do từ chối"
                        className="h-9 w-full rounded-4xl border border-input bg-input/30 px-3 text-sm"
                        required
                      />
                      <FormSubmitButton idleText="Từ chối" pendingText="Đang xử lý..." variant="destructive" />
                    </form>
                  </div>
                )}
              </div>
            );
          })}
        </CardContent>
      </Card>
    </div>
  );
}

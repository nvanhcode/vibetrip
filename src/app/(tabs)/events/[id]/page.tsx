import Image from "next/image";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { FormSubmitButton } from "@/components/app/form-submit-button";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { resolveUserRole } from "@/lib/rbac";
import { createClient } from "@/lib/supabase/server";
import { deleteEventRecordAction, reviewEventRecordAction } from "../actions";

type PageProps = {
  params: Promise<{ id: string }>;
};

function formatWeekday(weekday: number | null): string {
  const labels: Record<number, string> = {
    1: "Thứ 2",
    2: "Thứ 3",
    3: "Thứ 4",
    4: "Thứ 5",
    5: "Thứ 6",
    6: "Thứ 7",
    7: "Chủ nhật",
  };
  if (!weekday || !labels[weekday]) return "Không xác định";
  return labels[weekday];
}

export default async function EventDetailPage({ params }: PageProps) {
  const { id } = await params;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const [role, recordRes] = await Promise.all([
    resolveUserRole(supabase, user.id),
    supabase
      .from("event_records")
      .select(
        "id, record_kind, goong_place_id, goong_latitude, goong_longitude, province_code, ward_code, event_name, event_type, event_description, image_urls, allow_registration, organized_at, opens_at, closes_at, schedule_description, contact_phone, contact_email, contact_name, is_approved, reviewed_by, reviewed_at, rejection_reason, created_by, created_at"
      )
      .eq("id", id)
      .single(),
  ]);

  if (!recordRes.data || recordRes.error) {
    notFound();
  }

  const record = recordRes.data;

  const [provincesRes, wardsRes, catRes, organizerRes, scheduleRes] = await Promise.all([
    supabase.from("provinces").select("code, name"),
    supabase.from("wards").select("code, name"),
    supabase
      .from("event_record_categories")
      .select("event_categories(id, name)")
      .eq("event_record_id", id),
    supabase
      .from("event_record_organizers")
      .select("event_organizers(id, name)")
      .eq("event_record_id", id),
    supabase
      .from("event_record_schedules")
      .select("slot_order, organized_at, weekday, opens_at, closes_at")
      .eq("event_record_id", id)
      .order("slot_order", { ascending: true }),
  ]);

  const provMap = new Map((provincesRes.data ?? []).map((p) => [p.code, p.name]));
  const wardMap = new Map((wardsRes.data ?? []).map((w) => [w.code, w.name]));

  const categories = (catRes.data ?? [])
    .map((row) => (Array.isArray(row.event_categories) ? row.event_categories[0] : row.event_categories))
    .filter((c): c is { id: string; name: string } => !!c?.id);

  const organizers = (organizerRes.data ?? [])
    .map((row) => (Array.isArray(row.event_organizers) ? row.event_organizers[0] : row.event_organizers))
    .filter((o): o is { id: string; name: string } => !!o?.id);

  const schedules = scheduleRes.data ?? [];

  // Jurisdiction check
  let managedProvinceCodes = new Set<string>();
  let managedWardCodes = new Set<string>();

  if (role === "province_manager") {
    const { data } = await supabase.from("province_managers").select("province_code").eq("user_id", user.id);
    managedProvinceCodes = new Set((data ?? []).map((r) => r.province_code));
  }

  if (role === "ward_admin") {
    const { data } = await supabase.from("ward_admins").select("ward_code").eq("user_id", user.id);
    managedWardCodes = new Set((data ?? []).map((r) => r.ward_code));
  }

  const canReview =
    !record.reviewed_at &&
    (role === "admin" ||
      (role === "province_manager" && managedProvinceCodes.has(record.province_code)) ||
      (role === "ward_admin" && managedWardCodes.has(record.ward_code)));

  const isCreator = record.created_by === user.id;
  const canEdit = isCreator && !record.reviewed_at;
  const canDelete =
    isCreator && (!record.reviewed_at || (record.reviewed_at !== null && !record.is_approved));

  const images: string[] = Array.isArray(record.image_urls) ? (record.image_urls as string[]) : [];

  return (
    <div className="space-y-4 p-4 md:p-6">
      {/* ── Back navigation ── */}
      <div className="flex flex-wrap items-center gap-2">
        <Button asChild variant="ghost" size="sm">
          <Link href="/events">← Danh sách</Link>
        </Button>
        {isCreator && (
          <Button asChild variant="ghost" size="sm">
            <Link href="/events/admin">Quản trị</Link>
          </Button>
        )}
      </div>

      {/* ── Hero images ── */}
      {images.length > 0 && (
        <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
          {images.map((url) => (
            <div key={url} className="relative h-40 overflow-hidden rounded-2xl bg-muted">
              <Image
                src={url}
                alt={record.event_name}
                fill
                sizes="(max-width: 768px) 50vw, 25vw"
                className="object-cover"
              />
            </div>
          ))}
        </div>
      )}

      {/* ── Main info card ── */}
      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="space-y-2">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant={record.record_kind === "event" ? "default" : "secondary"}>
                  {record.record_kind === "event" ? "Sự kiện" : "Địa điểm"}
                </Badge>
                {!record.reviewed_at && <Badge variant="secondary">Chờ duyệt</Badge>}
                {record.reviewed_at && record.is_approved && <Badge>Đã duyệt</Badge>}
                {record.reviewed_at && !record.is_approved && (
                  <Badge variant="destructive">Từ chối</Badge>
                )}
              </div>
              <CardTitle className="text-2xl">{record.event_name}</CardTitle>
              {record.event_type && <CardDescription className="text-sm">{record.event_type}</CardDescription>}
            </div>
            <div className="flex flex-wrap gap-2">
              {canEdit && (
                <Button asChild variant="outline" size="sm">
                  <Link href={`/events/${record.id}/edit`}>Chỉnh sửa</Link>
                </Button>
              )}
              {canDelete && (
                <form action={deleteEventRecordAction}>
                  <input type="hidden" name="record_id" value={record.id} />
                  <FormSubmitButton
                    idleText="Xóa bản ghi"
                    pendingText="Đang xóa..."
                    variant="destructive"
                    size="sm"
                  />
                </form>
              )}
            </div>
          </div>
        </CardHeader>

        <CardContent className="space-y-4">
          {/* Description */}
          {record.event_description && (
            <p className="text-sm text-muted-foreground leading-relaxed">
              {record.event_description}
            </p>
          )}

          {/* Location */}
          <div className="grid gap-2 rounded-xl border border-border bg-muted/20 p-4 text-sm md:grid-cols-2">
            <p>
              <span className="font-medium text-foreground">Tỉnh:</span>{" "}
              {provMap.get(record.province_code) ?? record.province_code}
            </p>
            <p>
              <span className="font-medium text-foreground">Xã:</span>{" "}
              {wardMap.get(record.ward_code) ?? record.ward_code}
            </p>
            {record.goong_latitude && record.goong_longitude && (
              <p>
                <span className="font-medium text-foreground">Tọa độ:</span>{" "}
                {record.goong_latitude}, {record.goong_longitude}
              </p>
            )}
            {record.goong_place_id && (
              <p>
                <span className="font-medium text-foreground">Goong ID:</span>{" "}
                {record.goong_place_id}
              </p>
            )}
          </div>

          {/* Categories */}
          {categories.length > 0 && (
            <div>
              <p className="mb-2 text-sm font-medium text-foreground">Danh mục</p>
              <div className="flex flex-wrap gap-1">
                {categories.map((c) => (
                  <Badge key={c.id} variant="outline">
                    {c.name}
                  </Badge>
                ))}
              </div>
            </div>
          )}

          {/* Organizers */}
          {organizers.length > 0 && (
            <div>
              <p className="mb-2 text-sm font-medium text-foreground">Đơn vị tổ chức</p>
              <div className="flex flex-wrap gap-1">
                {organizers.map((o) => (
                  <Badge key={o.id} variant="secondary">
                    {o.name}
                  </Badge>
                ))}
              </div>
            </div>
          )}

          {/* Schedule */}
          <div>
            <p className="mb-2 text-sm font-medium text-foreground">Khung thời gian</p>
            <div className="rounded-xl border border-border bg-muted/20 p-3 text-sm text-muted-foreground space-y-1">
              {schedules.length === 0 &&
                record.organized_at &&
                record.opens_at &&
                record.closes_at && (
                  <p>
                    1. {new Date(record.organized_at).toLocaleString("vi-VN")} |{" "}
                    {record.opens_at.slice(0, 5)} – {record.closes_at.slice(0, 5)}
                  </p>
                )}
              {schedules.length === 0 &&
                (!record.organized_at || !record.opens_at || !record.closes_at) && (
                  <p>Không có</p>
                )}
              {schedules.map((s) => (
                <p key={s.slot_order}>
                  {s.slot_order + 1}.{" "}
                  {s.organized_at
                    ? `Ngày: ${new Date(s.organized_at).toLocaleString("vi-VN")}`
                    : `Lịch thứ: ${formatWeekday(s.weekday)}`}{" "}
                  | {s.opens_at.slice(0, 5)} – {s.closes_at.slice(0, 5)}
                </p>
              ))}
              {record.schedule_description && (
                <p className="mt-2 border-t border-border pt-2">{record.schedule_description}</p>
              )}
            </div>
          </div>

          {/* Contact */}
          {(record.contact_name || record.contact_phone || record.contact_email) && (
            <div>
              <p className="mb-2 text-sm font-medium text-foreground">Liên hệ</p>
              <div className="rounded-xl border border-border bg-muted/20 p-3 text-sm text-muted-foreground space-y-0.5">
                {record.contact_name && <p>Tên: {record.contact_name}</p>}
                {record.contact_phone && <p>SĐT: {record.contact_phone}</p>}
                {record.contact_email && <p>Email: {record.contact_email}</p>}
              </div>
            </div>
          )}

          {/* Allow registration */}
          <p className="text-sm text-muted-foreground">
            <span className="font-medium text-foreground">Cho phép đăng ký:</span>{" "}
            {record.allow_registration ? "Có" : "Không"}
          </p>

          {/* Review info */}
          {record.reviewed_at && (
            <div className="rounded-xl border border-border bg-muted/20 p-3 text-sm text-muted-foreground space-y-0.5">
              <p className="font-medium text-foreground">Thông tin duyệt</p>
              <p>Duyệt lúc: {new Date(record.reviewed_at).toLocaleString("vi-VN")}</p>
              {record.reviewed_by && <p>Người duyệt: {record.reviewed_by}</p>}
              {!record.is_approved && record.rejection_reason && (
                <p>Lý do từ chối: {record.rejection_reason}</p>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── Review actions ── */}
      {canReview && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Hành động duyệt</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-3 md:grid-cols-2">
              <form action={reviewEventRecordAction} className="flex items-center gap-2">
                <input type="hidden" name="record_id" value={record.id} />
                <input type="hidden" name="decision" value="approve" />
                <FormSubmitButton idleText="Duyệt bản ghi" pendingText="Đang duyệt..." className="w-full" />
              </form>

              <form action={reviewEventRecordAction} className="space-y-2">
                <input type="hidden" name="record_id" value={record.id} />
                <input type="hidden" name="decision" value="reject" />
                <input
                  name="rejection_reason"
                  placeholder="Nhập lý do từ chối..."
                  className="h-9 w-full rounded-4xl border border-input bg-input/30 px-3 text-sm"
                  required
                />
                <FormSubmitButton
                  idleText="Từ chối bản ghi"
                  pendingText="Đang xử lý..."
                  variant="destructive"
                  className="w-full"
                />
              </form>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

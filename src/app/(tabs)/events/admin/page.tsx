import Link from "next/link";
import { redirect } from "next/navigation";
import { FormSubmitButton } from "@/components/app/form-submit-button";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { resolveUserRole } from "@/lib/rbac";
import { createClient } from "@/lib/supabase/server";
import { deleteEventRecordAction, reviewEventRecordAction } from "../actions";

type PageProps = {
  searchParams?: Promise<{ [key: string]: string | string[] | undefined }>;
};

type EventRecord = {
  id: string;
  record_kind: string;
  province_code: string;
  ward_code: string;
  event_name: string;
  event_type: string | null;
  is_approved: boolean | null;
  reviewed_at: string | null;
  reviewed_by: string | null;
  rejection_reason: string | null;
  created_by: string;
  created_at: string;
};

function single(v: string | string[] | undefined): string {
  return Array.isArray(v) ? (v[0] ?? "") : (v ?? "");
}

function statusBadge(record: Pick<EventRecord, "is_approved" | "reviewed_at">) {
  if (!record.reviewed_at) {
    return <Badge variant="secondary">Chờ duyệt</Badge>;
  }
  if (record.is_approved) {
    return <Badge>Đã duyệt</Badge>;
  }
  return <Badge variant="destructive">Từ chối</Badge>;
}

export default async function AdminPage({ searchParams }: PageProps) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const params = await searchParams;
  const tab = single(params?.tab) || "mine";

  const [role, provincesRes, wardsRes] = await Promise.all([
    resolveUserRole(supabase, user.id),
    supabase.from("provinces").select("code, name"),
    supabase.from("wards").select("code, name"),
  ]);

  const provMap = new Map((provincesRes.data ?? []).map((p) => [p.code, p.name]));
  const wardMap = new Map((wardsRes.data ?? []).map((w) => [w.code, w.name]));

  // My submitted records
  const myRecordsRes = await supabase
    .from("event_records")
    .select(
      "id, record_kind, province_code, ward_code, event_name, event_type, is_approved, reviewed_at, reviewed_by, rejection_reason, created_by, created_at"
    )
    .eq("created_by", user.id)
    .order("created_at", { ascending: false });

  const myRecords: EventRecord[] = myRecordsRes.data ?? [];

  // Records available to review (based on role)
  const canReviewAny =
    role === "admin" || role === "province_manager" || role === "ward_admin";

  let reviewRecords: EventRecord[] = [];
  if (canReviewAny) {
    let managedProvinceCodes = new Set<string>();
    let managedWardCodes = new Set<string>();

    if (role === "province_manager") {
      const { data } = await supabase
        .from("province_managers")
        .select("province_code")
        .eq("user_id", user.id);
      managedProvinceCodes = new Set((data ?? []).map((r) => r.province_code));
    }

    if (role === "ward_admin") {
      const { data } = await supabase
        .from("ward_admins")
        .select("ward_code")
        .eq("user_id", user.id);
      managedWardCodes = new Set((data ?? []).map((r) => r.ward_code));
    }

    const pendingRes = await supabase
      .from("event_records")
      .select(
        "id, record_kind, province_code, ward_code, event_name, event_type, is_approved, reviewed_at, reviewed_by, rejection_reason, created_by, created_at"
      )
      .is("reviewed_at", null)
      .order("created_at", { ascending: false });

    reviewRecords = (pendingRes.data ?? []).filter((r) => {
      if (role === "admin") return true;
      if (role === "province_manager") return managedProvinceCodes.has(r.province_code);
      if (role === "ward_admin") return managedWardCodes.has(r.ward_code);
      return false;
    }) as EventRecord[];
  }

  // Fetch categories for all records
  const allIds = [...new Set([...myRecords.map((r) => r.id), ...reviewRecords.map((r) => r.id)])];
  const catMap = new Map<string, { id: string; name: string }[]>();
  if (allIds.length) {
    const catRes = await supabase
      .from("event_record_categories")
      .select("event_record_id, event_categories(id, name)")
      .in("event_record_id", allIds);

    for (const row of catRes.data ?? []) {
      const c = Array.isArray(row.event_categories) ? row.event_categories[0] : row.event_categories;
      if (!c?.id) continue;
      catMap.set(row.event_record_id, [...(catMap.get(row.event_record_id) ?? []), c]);
    }
  }

  const activeTab = canReviewAny ? tab : "mine";
  const displayRecords = activeTab === "review" ? reviewRecords : myRecords;

  return (
    <div className="space-y-4 p-4 md:p-6">
      {/* ── Header ── */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-foreground">Quản trị bản ghi</h1>
          <p className="text-sm text-muted-foreground">
            Quản lý bản ghi bạn đã gửi và duyệt bản ghi trong phạm vi quản lý.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button asChild variant="outline" size="sm">
            <Link href="/events">Về danh sách</Link>
          </Button>
          <Button asChild size="sm">
            <Link href="/events/new">+ Tạo bản ghi</Link>
          </Button>
        </div>
      </div>

      {/* ── Tabs ── */}
      <div className="flex gap-1 rounded-xl border border-border p-1 w-fit">
        <Link
          href="/events/admin?tab=mine"
          className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
            activeTab === "mine"
              ? "bg-foreground text-background"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          Bản ghi của tôi
          {myRecords.length > 0 && (
            <span className="ml-2 rounded-full bg-muted px-1.5 py-0.5 text-xs">
              {myRecords.length}
            </span>
          )}
        </Link>
        {canReviewAny && (
          <Link
            href="/events/admin?tab=review"
            className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
              activeTab === "review"
                ? "bg-foreground text-background"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            Cần duyệt
            {reviewRecords.length > 0 && (
              <span className="ml-2 rounded-full bg-destructive/20 text-destructive px-1.5 py-0.5 text-xs">
                {reviewRecords.length}
              </span>
            )}
          </Link>
        )}
      </div>

      {/* ── Empty state ── */}
      {displayRecords.length === 0 && (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            {activeTab === "mine"
              ? "Bạn chưa có bản ghi nào. Nhấn \"+ Tạo bản ghi\" để bắt đầu."
              : "Không có bản ghi nào đang chờ duyệt trong phạm vi quản lý của bạn."}
          </CardContent>
        </Card>
      )}

      {/* ── Record list ── */}
      <div className="flex flex-col gap-3">
        {displayRecords.map((record) => {
          const cats = catMap.get(record.id) ?? [];
          const isMyRecord = record.created_by === user.id;
          const canDelete =
            isMyRecord && (!record.reviewed_at || (record.reviewed_at !== null && !record.is_approved));
          const canEdit = isMyRecord && !record.reviewed_at;

          return (
            <Card key={record.id}>
              <CardHeader className="pb-3">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant={record.record_kind === "event" ? "default" : "secondary"}>
                        {record.record_kind === "event" ? "Sự kiện" : "Địa điểm"}
                      </Badge>
                      {statusBadge(record)}
                    </div>
                    <CardTitle className="text-base">{record.event_name}</CardTitle>
                    {record.event_type && (
                      <CardDescription>{record.event_type}</CardDescription>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {new Date(record.created_at).toLocaleDateString("vi-VN")}
                  </p>
                </div>
              </CardHeader>

              <CardContent className="space-y-3">
                {/* Location */}
                <p className="text-sm text-muted-foreground">
                  📍 {provMap.get(record.province_code) ?? record.province_code}
                  {record.ward_code
                    ? ` · ${wardMap.get(record.ward_code) ?? record.ward_code}`
                    : ""}
                </p>

                {/* Categories */}
                {cats.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {cats.map((c) => (
                      <Badge key={c.id} variant="outline" className="text-xs">
                        {c.name}
                      </Badge>
                    ))}
                  </div>
                )}

                {/* Review info */}
                {record.reviewed_at && (
                  <div className="rounded-xl border border-border bg-muted/20 p-3 text-xs text-muted-foreground space-y-0.5">
                    <p>Duyệt lúc: {new Date(record.reviewed_at).toLocaleString("vi-VN")}</p>
                    {!record.is_approved && record.rejection_reason && (
                      <p>Lý do từ chối: {record.rejection_reason}</p>
                    )}
                  </div>
                )}

                {/* Actions */}
                <div className="flex flex-wrap items-center gap-2 pt-1">
                  <Button asChild variant="ghost" size="sm">
                    <Link href={`/events/${record.id}`}>Xem chi tiết</Link>
                  </Button>

                  {canEdit && (
                    <Button asChild variant="outline" size="sm">
                      <Link href={`/events/${record.id}/edit`}>Chỉnh sửa</Link>
                    </Button>
                  )}

                  {canDelete && (
                    <form action={deleteEventRecordAction}>
                      <input type="hidden" name="record_id" value={record.id} />
                      <FormSubmitButton
                        idleText="Xóa"
                        pendingText="Đang xóa..."
                        variant="destructive"
                        size="sm"
                      />
                    </form>
                  )}

                  {/* Review actions (only in review tab) */}
                  {activeTab === "review" && !record.reviewed_at && (
                    <>
                      <form action={reviewEventRecordAction} className="flex items-center gap-2">
                        <input type="hidden" name="record_id" value={record.id} />
                        <input type="hidden" name="decision" value="approve" />
                        <FormSubmitButton idleText="Duyệt" pendingText="Đang duyệt..." size="sm" />
                      </form>

                      <form action={reviewEventRecordAction} className="flex items-center gap-2">
                        <input type="hidden" name="record_id" value={record.id} />
                        <input type="hidden" name="decision" value="reject" />
                        <input
                          name="rejection_reason"
                          placeholder="Lý do từ chối"
                          className="h-8 rounded-4xl border border-input bg-input/30 px-3 text-xs"
                          required
                        />
                        <FormSubmitButton
                          idleText="Từ chối"
                          pendingText="Đang xử lý..."
                          variant="destructive"
                          size="sm"
                        />
                      </form>
                    </>
                  )}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}

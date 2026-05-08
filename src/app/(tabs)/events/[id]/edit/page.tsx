import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { EventsComposer } from "@/components/app/events-composer";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { resolveUserRole } from "@/lib/rbac";
import { createClient } from "@/lib/supabase/server";
import { updateEventRecordAction } from "../../actions";

const PAGE_SIZE = 1000;

type ProvinceOption = {
  code: string;
  name: string;
};

type WardOption = {
  code: string;
  province_code: string;
  name: string;
};

type CategoryOption = {
  id: string;
  name: string;
};

type OrganizerOption = {
  id: string;
  name: string;
  province_code: string | null;
  ward_code: string | null;
};

type PagedResult<T> = {
  data: T[] | null;
  error: unknown;
};

async function fetchAllRows<T>(
  fetchPage: (from: number, to: number) => PromiseLike<PagedResult<T>>,
) {
  const allRows: T[] = [];

  for (let from = 0; ; from += PAGE_SIZE) {
    const to = from + PAGE_SIZE - 1;
    const { data, error } = await fetchPage(from, to);

    if (error || !data?.length) {
      break;
    }

    allRows.push(...data);

    if (data.length < PAGE_SIZE) {
      break;
    }
  }

  return allRows;
}

type PageProps = {
  params: Promise<{ id: string }>;
};

function toLocalDateTimeString(isoString: string | null | undefined) {
  if (!isoString) return "";
  const date = new Date(isoString);
  if (Number.isNaN(date.getTime())) return "";

  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  return `${year}-${month}-${day}T${hours}:${minutes}`;
}

function toTimeString(timeValue: string | null | undefined) {
  if (!timeValue) return "";
  return timeValue.slice(0, 5);
}

export default async function EditEventRecordPage({ params }: PageProps) {
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
        "id, record_kind, goong_place_id, goong_latitude, goong_longitude, province_code, ward_code, event_name, event_type, event_description, image_urls, allow_registration, organized_at, opens_at, closes_at, schedule_description, contact_phone, contact_email, contact_name, reviewed_at, created_by",
      )
      .eq("id", id)
      .maybeSingle(),
  ]);

  const record = recordRes.data;

  if (!record || record.reviewed_at) {
    notFound();
  }

  const isCreator = record.created_by === user.id;
  let canReview = role === "admin";

  if (!canReview && role === "province_manager") {
    const { data: managedProvince } = await supabase
      .from("province_managers")
      .select("province_code")
      .eq("user_id", user.id)
      .eq("province_code", record.province_code)
      .maybeSingle();
    canReview = Boolean(managedProvince);
  }

  if (!canReview && role === "ward_admin") {
    const { data: managedWard } = await supabase
      .from("ward_admins")
      .select("ward_code")
      .eq("user_id", user.id)
      .eq("ward_code", record.ward_code)
      .maybeSingle();
    canReview = Boolean(managedWard);
  }

  if (!isCreator && !canReview) {
    notFound();
  }

  const [provinces, wards, categories, organizers, recordCategoriesRes, recordOrganizersRes, recordSchedulesRes] =
    await Promise.all([
      fetchAllRows<ProvinceOption>((from, to) =>
        supabase
          .from("provinces")
          .select("code, name")
          .order("name", { ascending: true })
          .order("code", { ascending: true })
          .range(from, to),
      ),
      fetchAllRows<WardOption>((from, to) =>
        supabase
          .from("wards")
          .select("code, province_code, name")
          .order("name", { ascending: true })
          .order("code", { ascending: true })
          .range(from, to),
      ),
      fetchAllRows<CategoryOption>((from, to) =>
        supabase
          .from("event_categories")
          .select("id, name")
          .order("name", { ascending: true })
          .order("id", { ascending: true })
          .range(from, to),
      ),
      fetchAllRows<OrganizerOption>((from, to) =>
        supabase
          .from("event_organizers")
          .select("id, name, province_code, ward_code")
          .order("name", { ascending: true })
          .order("id", { ascending: true })
          .range(from, to),
      ),
      supabase
        .from("event_record_categories")
        .select("category_id")
        .eq("event_record_id", id),
      supabase
        .from("event_record_organizers")
        .select("organizer_id")
        .eq("event_record_id", id),
      supabase
        .from("event_record_schedules")
        .select("slot_order, organized_at, weekday, opens_at, closes_at")
        .eq("event_record_id", id)
        .order("slot_order", { ascending: true }),
    ]);

  const selectedCategoryIds = (recordCategoriesRes.data ?? []).map((row) => row.category_id);
  const selectedOrganizerIds = (recordOrganizersRes.data ?? []).map((row) => row.organizer_id);

  const scheduleSlots = (recordSchedulesRes.data ?? []).map((row) => ({
    mode: (row.weekday ? "weekday" : "date") as "date" | "weekday",
    organizedAt: toLocalDateTimeString(row.organized_at),
    weekday: row.weekday ? String(row.weekday) : "",
    opensAt: toTimeString(row.opens_at),
    closesAt: toTimeString(row.closes_at),
  }));

  const goongPlaceLabel = `${record.goong_place_id} (${record.goong_latitude}, ${record.goong_longitude})`;

  async function updateAction(formData: FormData) {
    "use server";
    formData.set("record_id", id);
    await updateEventRecordAction(formData);
  }

  return (
    <div className="space-y-4 p-4 md:p-6">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-lg font-semibold text-foreground">Chỉnh sửa bản ghi</p>
          <p className="text-sm text-muted-foreground">Chỉnh sửa thông tin trước khi duyệt.</p>
        </div>
        <Button asChild variant="outline">
          <Link href="/events">Quay lại danh sách</Link>
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Thông tin bản ghi</CardTitle>
          <CardDescription>
            Bản ghi sẽ được cập nhật và vẫn chờ duyệt.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <EventsComposer
            provinces={provinces}
            wards={wards}
            categories={categories}
            organizers={organizers}
            createAction={updateAction}
            submitLabel="Cập nhật bản ghi"
            defaultValues={{
              recordKind: record.record_kind as "event" | "place",
              goongPlaceId: record.goong_place_id ?? "",
              goongLatitude: record.goong_latitude != null ? String(record.goong_latitude) : "",
              goongLongitude: record.goong_longitude != null ? String(record.goong_longitude) : "",
              goongPlaceLabel,
              provinceCode: record.province_code,
              wardCode: record.ward_code,
              eventName: record.event_name,
              eventType: record.event_type ?? "",
              eventDescription: record.event_description ?? "",
              allowRegistration: record.allow_registration ?? false,
              scheduleSlots: scheduleSlots.length > 0 ? scheduleSlots : undefined,
              scheduleDescription: record.schedule_description ?? "",
              contactPhone: record.contact_phone ?? "",
              contactEmail: record.contact_email ?? "",
              contactName: record.contact_name ?? "",
              selectedCategoryIds,
              selectedOrganizerIds,
              existingImageUrls: Array.isArray(record.image_urls) ? record.image_urls : [],
            }}
          />
        </CardContent>
      </Card>
    </div>
  );
}

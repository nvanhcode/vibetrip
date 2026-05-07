import Link from "next/link";
import { redirect } from "next/navigation";
import { EventsComposer } from "@/components/app/events-composer";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { createClient } from "@/lib/supabase/server";
import { createEventRecordAction } from "../actions";

export default async function NewEventRecordPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const [provincesRes, wardsRes, categoriesRes, organizersRes] = await Promise.all([
    supabase.from("provinces").select("code, name").order("name", { ascending: true }),
    supabase.from("wards").select("code, province_code, name").order("name", { ascending: true }),
    supabase.from("event_categories").select("id, name").order("name", { ascending: true }),
    supabase.from("event_organizers").select("id, name, province_code, ward_code").order("name", { ascending: true }),
  ]);

  return (
    <div className="space-y-4 p-4 md:p-6">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-lg font-semibold text-foreground">Tạo sự kiện / địa điểm</p>
          <p className="text-sm text-muted-foreground">Tạo bản ghi mới và gửi duyệt theo phạm vi tỉnh/xã.</p>
        </div>
        <Button asChild variant="outline">
          <Link href="/events">Quay lại danh sách</Link>
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Thông tin bản ghi</CardTitle>
          <CardDescription>
            Ai cũng có thể tạo bản ghi. Bản ghi mới sẽ chờ duyệt bởi quản trị xã hoặc tỉnh phụ trách khu vực tương ứng.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <EventsComposer
            provinces={provincesRes.data ?? []}
            wards={wardsRes.data ?? []}
            categories={categoriesRes.data ?? []}
            organizers={organizersRes.data ?? []}
            createAction={createEventRecordAction}
          />
        </CardContent>
      </Card>
    </div>
  );
}

import Link from "next/link";
import { redirect } from "next/navigation";
import { EventsComposer } from "@/components/app/events-composer";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { createClient } from "@/lib/supabase/server";
import { createEventRecordAction } from "../actions";

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

export default async function NewEventRecordPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const [provinces, wards, categories, organizers] = await Promise.all([
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
            provinces={provinces}
            wards={wards}
            categories={categories}
            organizers={organizers}
            createAction={createEventRecordAction}
          />
        </CardContent>
      </Card>
    </div>
  );
}

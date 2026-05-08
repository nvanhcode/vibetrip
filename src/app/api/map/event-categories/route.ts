import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

type EventCategoryRow = {
  id: string;
  name: string;
};

export async function GET() {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("event_categories")
      .select("id, name")
      .order("name", { ascending: true });

    if (error) {
      return NextResponse.json(
        { error: "Không thể tải danh mục sự kiện." },
        { status: 500 },
      );
    }

    const categories = ((data ?? []) as EventCategoryRow[]).filter(
      (row) => row.id && row.name,
    );

    return NextResponse.json({ categories }, { status: 200 });
  } catch {
    return NextResponse.json(
      { error: "Đã xảy ra lỗi khi tải danh mục." },
      { status: 500 },
    );
  }
}

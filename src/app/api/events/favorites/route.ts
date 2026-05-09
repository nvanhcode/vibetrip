import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

type FavoriteRequest = {
  eventRecordId?: string;
  action?: "add" | "remove";
};

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let payload: FavoriteRequest;

  try {
    payload = (await request.json()) as FavoriteRequest;
  } catch {
    return NextResponse.json({ error: "Payload không hợp lệ." }, { status: 400 });
  }

  const eventRecordId = payload.eventRecordId?.trim();
  const action = payload.action;

  if (!eventRecordId) {
    return NextResponse.json({ error: "eventRecordId là bắt buộc." }, { status: 400 });
  }

  if (action !== "add" && action !== "remove") {
    return NextResponse.json(
      { error: "action phải là 'add' hoặc 'remove'." },
      { status: 400 }
    );
  }

  // Verify event_record exists and is approved
  const { data: eventRecord, error: eventError } = await supabase
    .from("event_records")
    .select("id, is_approved")
    .eq("id", eventRecordId)
    .maybeSingle();

  if (eventError || !eventRecord) {
    return NextResponse.json({ error: "Sự kiện không tồn tại." }, { status: 404 });
  }

  if (!eventRecord.is_approved) {
    return NextResponse.json(
      { error: "Chỉ có thể yêu thích sự kiện đã được phê duyệt." },
      { status: 403 }
    );
  }

  if (action === "add") {
    const { error: insertError } = await supabase
      .from("user_event_favorites")
      .insert({ user_id: user.id, event_record_id: eventRecordId });

    if (insertError) {
      // If it's a unique constraint error, it's already favorited
      if (insertError.code === "23505") {
        return NextResponse.json(
          { message: "Sự kiện đã được yêu thích." },
          { status: 200 }
        );
      }
      return NextResponse.json({ error: "Không thể yêu thích sự kiện." }, { status: 500 });
    }

    return NextResponse.json({ message: "Đã thêm vào yêu thích." }, { status: 200 });
  }

  if (action === "remove") {
    const { error: deleteError } = await supabase
      .from("user_event_favorites")
      .delete()
      .eq("user_id", user.id)
      .eq("event_record_id", eventRecordId);

    if (deleteError) {
      return NextResponse.json(
        { error: "Không thể bỏ yêu thích sự kiện." },
        { status: 500 }
      );
    }

    return NextResponse.json({ message: "Đã xóa khỏi yêu thích." }, { status: 200 });
  }

  return NextResponse.json({ error: "Invalid action" }, { status: 400 });
}

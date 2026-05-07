import { NextResponse } from "next/server";

const GOONG_PLACE_DETAIL_ENDPOINT = "https://rsapi.goong.io/place/detail";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const placeId = searchParams.get("placeId")?.trim();
  const goongApiKey = process.env.GOONG_API_KEY;

  if (!goongApiKey) {
    return NextResponse.json(
      { error: "Thiếu GOONG_API_KEY trên server." },
      { status: 500 }
    );
  }

  if (!placeId) {
    return NextResponse.json(
      { error: "Thiếu placeId." },
      { status: 400 }
    );
  }

  const url = new URL(GOONG_PLACE_DETAIL_ENDPOINT);
  url.searchParams.set("api_key", goongApiKey);
  url.searchParams.set("place_id", placeId);

  try {
    const response = await fetch(url, {
      method: "GET",
      headers: { Accept: "application/json" },
      cache: "no-store",
    });

    const data = await response.json();

    if (!response.ok) {
      return NextResponse.json(
        { error: data?.error_message ?? "Không thể gọi Goong Place Detail." },
        { status: response.status }
      );
    }

    return NextResponse.json(data);
  } catch {
    return NextResponse.json(
      { error: "Lỗi mạng khi gọi Goong Place Detail." },
      { status: 502 }
    );
  }
}
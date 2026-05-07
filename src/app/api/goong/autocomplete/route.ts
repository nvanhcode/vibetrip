import { NextResponse } from "next/server";

const GOONG_AUTOCOMPLETE_ENDPOINT = "https://rsapi.goong.io/place/autocomplete";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const input = searchParams.get("input")?.trim();
  const goongApiKey = process.env.GOONG_API_KEY;

  if (!goongApiKey) {
    return NextResponse.json(
      { error: "Thiếu GOONG_API_KEY trên server." },
      { status: 500 }
    );
  }

  if (!input || input.length < 2) {
    return NextResponse.json({ predictions: [] });
  }

  const url = new URL(GOONG_AUTOCOMPLETE_ENDPOINT);
  url.searchParams.set("api_key", goongApiKey);
  url.searchParams.set("input", input);

  try {
    const response = await fetch(url, {
      method: "GET",
      headers: { Accept: "application/json" },
      cache: "no-store",
    });

    const data = await response.json();

    if (!response.ok) {
      return NextResponse.json(
        { error: data?.error_message ?? "Không thể gọi Goong Autocomplete." },
        { status: response.status }
      );
    }

    return NextResponse.json(data);
  } catch {
    return NextResponse.json(
      { error: "Lỗi mạng khi gọi Goong Autocomplete." },
      { status: 502 }
    );
  }
}
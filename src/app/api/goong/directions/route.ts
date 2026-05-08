import { NextResponse } from "next/server";

const GOONG_DIRECTIONS_ENDPOINT = "https://rsapi.goong.io/direction";

function parseCoordinate(value: string | null) {
  if (!value) {
    return null;
  }

  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return null;
  }

  return parsed;
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const goongApiKey = process.env.GOONG_API_KEY;

  const originLat = parseCoordinate(searchParams.get("originLat"));
  const originLng = parseCoordinate(searchParams.get("originLng"));
  const destinationLat = parseCoordinate(searchParams.get("destinationLat"));
  const destinationLng = parseCoordinate(searchParams.get("destinationLng"));
  const vehicle = searchParams.get("vehicle")?.trim() || "car";

  if (!goongApiKey) {
    return NextResponse.json(
      { error: "Thiếu GOONG_API_KEY trên server." },
      { status: 500 },
    );
  }

  if (
    originLat === null ||
    originLng === null ||
    destinationLat === null ||
    destinationLng === null
  ) {
    return NextResponse.json(
      { error: "Thiếu hoặc sai định dạng tọa độ chỉ đường." },
      { status: 400 },
    );
  }

  const url = new URL(GOONG_DIRECTIONS_ENDPOINT);
  url.searchParams.set("api_key", goongApiKey);
  url.searchParams.set("origin", `${originLat},${originLng}`);
  url.searchParams.set("destination", `${destinationLat},${destinationLng}`);
  url.searchParams.set("vehicle", vehicle);

  try {
    const response = await fetch(url, {
      method: "GET",
      headers: { Accept: "application/json" },
      cache: "no-store",
    });

    const data = await response.json();

    if (!response.ok) {
      return NextResponse.json(
        { error: data?.error_message ?? "Không thể gọi Goong Directions." },
        { status: response.status },
      );
    }

    return NextResponse.json(data);
  } catch {
    return NextResponse.json(
      { error: "Lỗi mạng khi gọi Goong Directions." },
      { status: 502 },
    );
  }
}

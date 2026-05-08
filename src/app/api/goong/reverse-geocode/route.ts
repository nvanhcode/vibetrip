import { NextResponse } from "next/server";

const GOONG_REVERSE_GEOCODE_ENDPOINT = "https://rsapi.goong.io/Geocode";

type GoongReverseResponse = {
  results?: Array<{
    place_id?: string;
    formatted_address?: string;
    address_components?: Array<{
      long_name?: string;
    }>;
    geometry?: {
      location?: {
        lat?: number;
        lng?: number;
      };
    };
  }>;
  error_message?: string;
};

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const lat = searchParams.get("lat")?.trim();
  const lng = searchParams.get("lng")?.trim();
  const goongApiKey = process.env.GOONG_API_KEY;

  if (!goongApiKey) {
    return NextResponse.json(
      { error: "Thiếu GOONG_API_KEY trên server." },
      { status: 500 },
    );
  }

  if (!lat || !lng) {
    return NextResponse.json(
      { error: "Thiếu lat hoặc lng." },
      { status: 400 },
    );
  }

  const url = new URL(GOONG_REVERSE_GEOCODE_ENDPOINT);
  url.searchParams.set("api_key", goongApiKey);
  url.searchParams.set("latlng", `${lat},${lng}`);

  try {
    const response = await fetch(url, {
      method: "GET",
      headers: { Accept: "application/json" },
      cache: "no-store",
    });

    const data = (await response.json()) as GoongReverseResponse;

    if (!response.ok) {
      return NextResponse.json(
        { error: data.error_message ?? "Không thể gọi Goong Reverse Geocode." },
        { status: response.status },
      );
    }

    const first = data.results?.[0];
    const latNum = Number(lat);
    const lngNum = Number(lng);

    return NextResponse.json({
      place_id: first?.place_id ?? null,
      name: first?.address_components?.[0]?.long_name ?? first?.formatted_address ?? "Vị trí hiện tại",
      formatted_address: first?.formatted_address ?? null,
      lat: Number.isFinite(latNum) ? latNum : first?.geometry?.location?.lat ?? null,
      lng: Number.isFinite(lngNum) ? lngNum : first?.geometry?.location?.lng ?? null,
    });
  } catch {
    return NextResponse.json(
      { error: "Lỗi mạng khi gọi Goong Reverse Geocode." },
      { status: 502 },
    );
  }
}

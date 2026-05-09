import { GoongMapPanel } from "@/components/app/goong-map-panel";
import { fetchRouteById } from "@/lib/user-routes";
import { createClient } from "@/lib/supabase/server";

type PageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function MapPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const routeId = Array.isArray(params.route_id) ? params.route_id[0] : params.route_id;
  const recordId = Array.isArray(params.record_id) ? params.record_id[0] : params.record_id;
  const latRaw = Array.isArray(params.lat) ? params.lat[0] : params.lat;
  const lngRaw = Array.isArray(params.lng) ? params.lng[0] : params.lng;

  const lat = latRaw ? Number(latRaw) : Number.NaN;
  const lng = lngRaw ? Number(lngRaw) : Number.NaN;
  const initialFocusCoordinates =
    Number.isFinite(lat) && Number.isFinite(lng)
      ? ([lng, lat] as [number, number])
      : null;

  let initialRoute = null;

  if (routeId) {
    try {
      const supabase = await createClient();
      initialRoute = await fetchRouteById(supabase, routeId);
    } catch (error) {
      console.error("Failed to fetch route:", error);
    }
  }

  return (
    <GoongMapPanel
      initialRoute={initialRoute}
      initialFocusRecordId={recordId ?? null}
      initialFocusCoordinates={initialFocusCoordinates}
    />
  );
}

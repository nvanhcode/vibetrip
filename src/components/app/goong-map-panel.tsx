"use client";

import Image from "next/image";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import maplibregl, { type LngLatLike, type Map as MaplibreMap } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";
import type { EventRecordKind } from "@/models/event.model";
import type { UserRoute } from "@/models/route.model";

type GoongPrediction = {
  description?: string;
  place_id?: string;
};

type GoongAutocompleteResponse = {
  predictions?: GoongPrediction[];
};

type GoongPlaceDetailResponse = {
  result?: {
    geometry?: {
      location?: {
        lat?: number;
        lng?: number;
      };
    };
  };
};

type GoongDirectionLeg = {
  distance?: { text?: string };
  duration?: { text?: string };
};

type GoongDirectionRoute = {
  overview_polyline?: { points?: string };
  legs?: GoongDirectionLeg[];
};

type GoongDirectionResponse = {
  routes?: GoongDirectionRoute[];
  error?: string;
};

type MapBounds = {
  minLat: number;
  maxLat: number;
  minLng: number;
  maxLng: number;
};

type MapCategory = {
  id: string;
  name: string;
};

type MapRecord = {
  id: string;
  record_kind: EventRecordKind;
  event_name: string;
  event_type: string;
  event_description: string;
  image_urls: string[];
  goong_latitude: number;
  goong_longitude: number;
  organized_at: string | null;
  opens_at: string | null;
  closes_at: string | null;
  categories: MapCategory[];
};

type MapRecordsResponse = {
  records?: MapRecord[];
  error?: string;
};

type MapCategoriesResponse = {
  categories?: MapCategory[];
  error?: string;
};

type ChatAttachment = {
  id: string;
  label: string;
  latitude: number;
  longitude: number;
  source: "event_record" | "route_stop";
  recordId: string | null;
  routeId: string | null;
};

type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  attachments: ChatAttachment[];
  createdAt: string;
};

type ChatConversationSummary = {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
};

type AiChatListResponse = {
  conversations?: ChatConversationSummary[];
  messages?: ChatMessage[];
  error?: string;
};

type AiChatSendResponse = {
  conversationId?: string;
  assistantMessage?: ChatMessage;
  conversations?: ChatConversationSummary[];
  error?: string;
};

type RadiusMode = "none" | "my-location" | "navigation-address";
type RouteVisibility = "public" | "friends" | "private";
type RightPanelMode = "navigation" | "ai-chat";

type RecordFeatureProperties = {
  id: string;
  record_kind: EventRecordKind;
  event_name: string;
};

type RouteStop = {
  id: string;
  label: string;
  coordinates: [number, number];
  kind: "origin" | "record";
  recordId?: string;
};

type RouteSegment = {
  id: string;
  color: string;
  coordinates: [number, number][];
};

type RouteLegSummary = {
  id: string;
  color: string;
  fromLabel: string;
  toLabel: string;
  distance?: string;
  duration?: string;
};

type SaveRouteResponse = {
  id?: string;
  error?: string;
};

const DEFAULT_CENTER: LngLatLike = [105.83416, 21.027764];
const DEFAULT_ZOOM = 13;
const MARKER_CLUSTER_TRANSITION_ZOOM = 7;
const RECORDS_SOURCE_ID = "event-records-source";
const CLUSTER_CIRCLES_LAYER_ID = "event-records-clusters";
const CLUSTER_COUNT_LAYER_ID = "event-records-cluster-count";
const UNCLUSTERED_LAYER_ID = "event-records-unclustered";
const DIRECTION_ROUTE_SOURCE_PREFIX = "goong-direction-route-source";
const DIRECTION_ROUTE_LAYER_PREFIX = "goong-direction-route-layer";
const ROUTE_SEGMENT_COLORS = [
  "#2563eb",
  "#f97316",
  "#16a34a",
  "#db2777",
  "#7c3aed",
  "#0891b2",
];

function decodePolyline(encoded: string) {
  const points: [number, number][] = [];
  let index = 0;
  let lat = 0;
  let lng = 0;

  while (index < encoded.length) {
    let result = 0;
    let shift = 0;
    let byte = 0;

    do {
      byte = encoded.charCodeAt(index) - 63;
      index += 1;
      result |= (byte & 0x1f) << shift;
      shift += 5;
    } while (byte >= 0x20);

    const deltaLat = (result & 1) !== 0 ? ~(result >> 1) : result >> 1;
    lat += deltaLat;

    result = 0;
    shift = 0;

    do {
      byte = encoded.charCodeAt(index) - 63;
      index += 1;
      result |= (byte & 0x1f) << shift;
      shift += 5;
    } while (byte >= 0x20);

    const deltaLng = (result & 1) !== 0 ? ~(result >> 1) : result >> 1;
    lng += deltaLng;

    points.push([lng * 1e-5, lat * 1e-5]);
  }

  return points;
}

function useDebouncedValue<T>(value: T, delay: number) {
  const [debouncedValue, setDebouncedValue] = useState(value);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [delay, value]);

  return debouncedValue;
}

function getTodayDateInputValue() {
  const now = new Date();
  const year = now.getFullYear();
  const month = `${now.getMonth() + 1}`.padStart(2, "0");
  const date = `${now.getDate()}`.padStart(2, "0");
  return `${year}-${month}-${date}`;
}

function getSuggestedRouteName(stops: RouteStop[]) {
  const originLabel = stops.find((stop) => stop.kind === "origin")?.label?.trim();
  const firstDestination = stops.find((stop) => stop.kind === "record")?.label?.trim();

  if (originLabel && firstDestination) {
    return `${originLabel} -> ${firstDestination}`;
  }

  if (firstDestination) {
    return `Lộ trình đến ${firstDestination}`;
  }

  return "Lộ trình cá nhân";
}

function toFeatureCollection(records: MapRecord[]): GeoJSON.FeatureCollection<
  GeoJSON.Point,
  RecordFeatureProperties
> {
  return {
    type: "FeatureCollection",
    features: records.map((record) => ({
      type: "Feature",
      geometry: {
        type: "Point",
        coordinates: [record.goong_longitude, record.goong_latitude],
      },
      properties: {
        id: record.id,
        record_kind: record.record_kind,
        event_name: record.event_name,
      },
    })),
  };
}

export function GoongMapPanel({
  initialRoute,
  initialFocusRecordId = null,
  initialFocusCoordinates = null,
}: {
  initialRoute: UserRoute | null;
  initialFocusRecordId?: string | null;
  initialFocusCoordinates?: [number, number] | null;
}) {
  const supabase = useMemo(() => createClient(), []);
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<MaplibreMap | null>(null);
  const userMarkerRef = useRef<maplibregl.Marker | null>(null);
  const selectedPlaceMarkerRef = useRef<maplibregl.Marker | null>(null);
  const watchIdRef = useRef<number | null>(null);
  const hasCenteredRef = useRef<boolean>(false);
  const consumedInitialFocusRef = useRef<boolean>(false);
  const userPositionRef = useRef<[number, number] | null>(null);
  const routePointMarkersRef = useRef<maplibregl.Marker[]>([]);
  const recordsRef = useRef<MapRecord[]>([]);
  const eventMarkersRef = useRef<globalThis.Map<string, maplibregl.Marker>>(
    new globalThis.Map(),
  );
  const placeMarkersRef = useRef<globalThis.Map<string, maplibregl.Marker>>(
    new globalThis.Map(),
  );
  const fetchSeqRef = useRef(0);

  const [isRightPanelOpen, setIsRightPanelOpen] = useState(false);
  const [rightPanelMode, setRightPanelMode] = useState<RightPanelMode>("navigation");
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const loadedRoute = initialRoute;
  const [search, setSearch] = useState("");
  const [predictions, setPredictions] = useState<GoongPrediction[]>([]);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [isOffCenter, setIsOffCenter] = useState(false);
  const [locationMessage, setLocationMessage] = useState<string | null>(
    "Đang yêu cầu quyền vị trí...",
  );
  const [selectedPlaceLabel, setSelectedPlaceLabel] = useState(initialRoute?.origin_label ?? "");
  const [selectedPlacePosition, setSelectedPlacePosition] = useState<[
    number,
    number,
  ] | null>(initialRoute ? [initialRoute.origin_longitude, initialRoute.origin_latitude] : null);
  const [myPosition, setMyPosition] = useState<[number, number] | null>(null);
  const [viewportBounds, setViewportBounds] = useState<MapBounds | null>(null);
  const [records, setRecords] = useState<MapRecord[]>([]);
  const [recordsError, setRecordsError] = useState<string | null>(null);
  const [isLoadingRecords, setIsLoadingRecords] = useState(false);
  const [categoryOptions, setCategoryOptions] = useState<MapCategory[]>([]);
  const [categoryError, setCategoryError] = useState<string | null>(null);
  const [selectedCategoryIds, setSelectedCategoryIds] = useState<string[]>([]);
  const [recordKeyword, setRecordKeyword] = useState("");
  const [radiusMode, setRadiusMode] = useState<RadiusMode>("none");
  const [radiusKm, setRadiusKm] = useState("5");
  const [selectedRecordId, setSelectedRecordId] = useState<string | null>(initialFocusRecordId);
  const [mapZoom, setMapZoom] = useState(DEFAULT_ZOOM);
  const [routeDestinations, setRouteDestinations] = useState<RouteStop[]>(
    initialRoute
      ? initialRoute.stops
          .filter((stop) => stop.stop_kind === "record")
          .map((stop) => ({
            id: stop.id,
            label: stop.label,
            coordinates: [stop.longitude, stop.latitude] as [number, number],
            kind: "record" as const,
            recordId: stop.event_record_id ?? undefined,
          }))
      : [],
  );
  const [routeLegs, setRouteLegs] = useState<RouteLegSummary[]>([]);
  const [routeSummary, setRouteSummary] = useState<string | null>(initialRoute?.summary ?? null);
  const [routeError, setRouteError] = useState<string | null>(null);
  const [isRouting, setIsRouting] = useState(false);
  const [pendingRouteStop, setPendingRouteStop] = useState<RouteStop | null>(null);
  const [isInsertDialogOpen, setIsInsertDialogOpen] = useState(false);
  const [isSaveRouteDialogOpen, setIsSaveRouteDialogOpen] = useState(false);
  const [routeName, setRouteName] = useState(initialRoute?.title ?? "");
  const [routeStartDate, setRouteStartDate] = useState(getTodayDateInputValue);
  const [routeVisibility, setRouteVisibility] = useState<RouteVisibility>("private");
  const [isSavingRoute, setIsSavingRoute] = useState(false);
  const [saveRouteError, setSaveRouteError] = useState<string | null>(null);
  const [saveRouteSuccess, setSaveRouteSuccess] = useState<string | null>(null);
  const [isMapStyleLoaded, setIsMapStyleLoaded] = useState(false);
  const [chatConversations, setChatConversations] = useState<ChatConversationSummary[]>([]);
  const [activeChatConversationId, setActiveChatConversationId] = useState<string | null>(null);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatPrompt, setChatPrompt] = useState("");
  const [chatError, setChatError] = useState<string | null>(null);
  const [isChatLoading, setIsChatLoading] = useState(false);
  const [isChatSending, setIsChatSending] = useState(false);
  const chatScrollRef = useRef<HTMLDivElement | null>(null);

  // Compute whether the route is owned by the current user
  const isRouteOwnedByCurrentUser = useMemo(
    () => currentUserId && initialRoute ? currentUserId === initialRoute.owner_id : true,
    [currentUserId, initialRoute],
  );
  const isEditingOwnedRoute = Boolean(loadedRoute && isRouteOwnedByCurrentUser);

  const styleUrl = useMemo(() => {
    const mapKey = process.env.NEXT_PUBLIC_GOONG_MAP_KEY;
    if (!mapKey) {
      return null;
    }
    return `https://tiles.goong.io/assets/goong_map_highlight.json?api_key=${mapKey}`;
  }, []);

  const radiusKmNumber = useMemo(() => {
    const parsed = Number(radiusKm);
    if (!Number.isFinite(parsed) || parsed <= 0) {
      return null;
    }
    return Math.min(parsed, 100);
  }, [radiusKm]);

  const activeRadiusCenter = useMemo(() => {
    if (radiusMode === "my-location") {
      return myPosition;
    }

    if (radiusMode === "navigation-address") {
      return selectedPlacePosition;
    }

    return null;
  }, [myPosition, radiusMode, selectedPlacePosition]);

  const routeOrigin = useMemo<RouteStop | null>(() => {
    if (selectedPlacePosition) {
      return {
        id: "selected-place-origin",
        label: selectedPlaceLabel || "Địa chỉ đã chọn",
        coordinates: selectedPlacePosition,
        kind: "origin",
      };
    }

    if (myPosition) {
      return {
        id: "my-location-origin",
        label: "Vị trí của bạn",
        coordinates: myPosition,
        kind: "origin",
      };
    }

    return null;
  }, [myPosition, selectedPlaceLabel, selectedPlacePosition]);

  const routeStops = useMemo(
    () => (routeOrigin ? [routeOrigin, ...routeDestinations] : routeDestinations),
    [routeDestinations, routeOrigin],
  );

  const routeInsertOptions = useMemo(() => {
    if (!pendingRouteStop || !routeOrigin) {
      return [];
    }

    return Array.from({ length: routeDestinations.length + 1 }, (_, index) => {
      const previousStop = index === 0 ? routeOrigin : routeDestinations[index - 1];
      const nextStop = routeDestinations[index] ?? null;

      return {
        index,
        previousLabel: previousStop.label,
        nextLabel: nextStop?.label ?? null,
      };
    });
  }, [pendingRouteStop, routeDestinations, routeOrigin]);

  const eventRecords = useMemo(
    () => records.filter((record) => record.record_kind === "event"),
    [records],
  );

  const placeRecords = useMemo(
    () => records.filter((record) => record.record_kind === "place"),
    [records],
  );

  const selectedCategorySet = useMemo(
    () => new Set(selectedCategoryIds),
    [selectedCategoryIds],
  );

  const canApplyRadiusFilter =
    radiusMode === "none" ||
    (radiusKmNumber !== null && Array.isArray(activeRadiusCenter));
  const debouncedViewportBounds = useDebouncedValue(viewportBounds, 320);
  const debouncedRecordKeyword = useDebouncedValue(recordKeyword.trim(), 350);
  const debouncedSelectedCategoryIds = useDebouncedValue(selectedCategoryIds, 220);
  const debouncedRadiusCenter = useDebouncedValue(activeRadiusCenter, 320);
  const debouncedRadiusKmNumber = useDebouncedValue(radiusKmNumber, 320);

  // ── Get current user ──────────────────────────────────────────────────────
  useEffect(() => {
    const getUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        setCurrentUserId(user.id);
      }
    };
    void getUser();
  }, [supabase]);

  // ── Fit map bounds to show the loaded route ────────────────────────────────
  useEffect(() => {
    if (!initialRoute || !mapRef.current) {
      return;
    }

    const allPoints = [
      [initialRoute.origin_longitude, initialRoute.origin_latitude],
      ...initialRoute.stops
        .filter((stop) => stop.stop_kind === "record")
        .map((stop) => [stop.longitude, stop.latitude]),
    ] as [number, number][];

    if (allPoints.length <= 1) {
      return;
    }

    const bounds = allPoints.reduce(
      (acc, [lng, lat]) => ({
        minLng: Math.min(acc.minLng, lng),
        maxLng: Math.max(acc.maxLng, lng),
        minLat: Math.min(acc.minLat, lat),
        maxLat: Math.max(acc.maxLat, lat),
      }),
      {
        minLng: allPoints[0][0],
        maxLng: allPoints[0][0],
        minLat: allPoints[0][1],
        maxLat: allPoints[0][1],
      },
    );

    const fitBoundsWhenReady = () => {
      if (mapRef.current?.isStyleLoaded()) {
        mapRef.current.fitBounds(
          [[bounds.minLng, bounds.minLat], [bounds.maxLng, bounds.maxLat]],
          { padding: 40 },
        );
      } else if (mapRef.current) {
        // Wait for style to load before fitting bounds
        mapRef.current.once("styledata", fitBoundsWhenReady);
      }
    };

    fitBoundsWhenReady();
  }, [initialRoute]);

  useEffect(() => {
    recordsRef.current = records;
  }, [records]);

  const clearDirectionRoute = useCallback(() => {
    const map = mapRef.current;
    if (!map) {
      return;
    }

    const style = map.getStyle();
    if (!style) {
      routePointMarkersRef.current.forEach((marker) => marker.remove());
      routePointMarkersRef.current = [];
      return;
    }

    style.layers
      ?.filter((layer) => layer.id.startsWith(DIRECTION_ROUTE_LAYER_PREFIX))
      .forEach((layer) => {
        if (map.getLayer(layer.id)) {
          map.removeLayer(layer.id);
        }
      });

    Object.keys(style.sources ?? {})
      .filter((sourceId) => sourceId.startsWith(DIRECTION_ROUTE_SOURCE_PREFIX))
      .forEach((sourceId) => {
        if (map.getSource(sourceId)) {
          map.removeSource(sourceId);
        }
      });

    routePointMarkersRef.current.forEach((marker) => marker.remove());
    routePointMarkersRef.current = [];
  }, []);

  const drawDirectionRoute = useCallback(
    (segments: RouteSegment[], stops: RouteStop[]) => {
      const map = mapRef.current;
      if (!map || !map.isStyleLoaded() || segments.length === 0) {
        return;
      }

      clearDirectionRoute();

      segments.forEach((segment) => {
        const sourceId = `${DIRECTION_ROUTE_SOURCE_PREFIX}-${segment.id}`;
        const layerId = `${DIRECTION_ROUTE_LAYER_PREFIX}-${segment.id}`;

        map.addSource(sourceId, {
          type: "geojson",
          data: {
            type: "Feature",
            properties: {},
            geometry: {
              type: "LineString",
              coordinates: segment.coordinates,
            },
          },
        });

        map.addLayer({
          id: layerId,
          type: "line",
          source: sourceId,
          layout: {
            "line-join": "round",
            "line-cap": "round",
          },
          paint: {
            "line-color": segment.color,
            "line-width": 6,
            "line-opacity": 0.68,
            "line-blur": 0.25,
          },
        });
      });

      routePointMarkersRef.current = stops.map((stop, index) => {
        const markerElement = document.createElement("div");
        markerElement.className = cn(
          "flex size-7 items-center justify-center rounded-full border-2 border-white text-[11px] font-semibold text-white shadow",
          stop.kind === "origin" ? "bg-slate-900" : "bg-primary",
        );
        markerElement.textContent = stop.kind === "origin" ? "A" : String(index);

        return new maplibregl.Marker({ element: markerElement })
          .setLngLat(stop.coordinates)
          .addTo(map);
      });

      const allCoordinates = segments.flatMap((segment) => segment.coordinates);
      const bounds = allCoordinates.reduce(
        (acc, coordinate) => acc.extend(coordinate),
        new maplibregl.LngLatBounds(allCoordinates[0], allCoordinates[0]),
      );

      map.fitBounds(bounds, { padding: 80, duration: 550 });
    },
    [clearDirectionRoute],
  );

  const fetchDirectionRoute = useCallback(
    async (origin: [number, number], destination: [number, number]) => {
      const params = new URLSearchParams({
        originLat: String(origin[1]),
        originLng: String(origin[0]),
        destinationLat: String(destination[1]),
        destinationLng: String(destination[0]),
        vehicle: "car",
      });

      const response = await fetch(`/api/goong/directions?${params.toString()}`, {
        method: "GET",
        cache: "no-store",
      });
      const data = (await response.json()) as GoongDirectionResponse;

      if (!response.ok) {
        throw new Error(data.error ?? "Không thể lấy tuyến đường từ Goong.");
      }

      const firstRoute = data.routes?.[0];
      const encoded = firstRoute?.overview_polyline?.points;
      if (!encoded) {
        throw new Error("Không tìm thấy tuyến đường phù hợp.");
      }

      const coordinates = decodePolyline(encoded);
      if (coordinates.length === 0) {
        throw new Error("Không thể giải mã tuyến đường.");
      }

      const leg = firstRoute.legs?.[0];

      return {
        coordinates,
        distance: leg?.distance?.text,
        duration: leg?.duration?.text,
      };
    },
    [],
  );

  const insertRouteStop = useCallback((insertIndex: number) => {
    if (!pendingRouteStop) {
      return;
    }

    setRouteDestinations((prev) => {
      const nextStops = [...prev];
      nextStops.splice(insertIndex, 0, pendingRouteStop);
      return nextStops;
    });
    setRouteLegs([]);
    setRouteSummary(null);
    setPendingRouteStop(null);
    setIsInsertDialogOpen(false);
    setRouteError(null);
  }, [pendingRouteStop]);

  const removeRouteStop = useCallback((recordId: string) => {
    setRouteDestinations((prev) => prev.filter((stop) => stop.recordId !== recordId));
    setRouteLegs([]);
    setRouteSummary(null);
    setRouteError(null);
  }, []);

  const clearRouteStops = useCallback(() => {
    setRouteDestinations([]);
    setPendingRouteStop(null);
    setIsInsertDialogOpen(false);
    setRouteLegs([]);
    setRouteSummary(null);
    setRouteError(null);
    setSaveRouteError(null);
    setSaveRouteSuccess(null);
    clearDirectionRoute();
  }, [clearDirectionRoute]);

  const cancelLoadedRoute = useCallback(() => {
    setIsSaveRouteDialogOpen(false);
    setSaveRouteError(null);
    setSaveRouteSuccess(null);
    setRouteError(null);
    setPendingRouteStop(null);
    setIsInsertDialogOpen(false);

    const params = new URLSearchParams(searchParams.toString());
    if (!params.has("route_id")) {
      return;
    }

    params.delete("route_id");
    const nextQuery = params.toString();
    router.replace(nextQuery ? `${pathname}?${nextQuery}` : pathname);
  }, [pathname, router, searchParams]);

  const openSaveRouteDialog = useCallback(() => {
    if (routeStops.length < 2) {
      setRouteError("Cần có điểm bắt đầu và ít nhất 1 điểm đến để lưu lộ trình.");
      return;
    }

    if (isEditingOwnedRoute && loadedRoute) {
      setRouteName((prev) => prev.trim() || loadedRoute.title);
    } else {
      setRouteName(getSuggestedRouteName(routeStops));
    }
    setSaveRouteError(null);
    setSaveRouteSuccess(null);
    setRouteError(null);
    setIsSaveRouteDialogOpen(true);
  }, [isEditingOwnedRoute, loadedRoute, routeStops]);

  const handleSaveRoute = useCallback(async () => {
    if (routeStops.length < 2) {
      setSaveRouteError("Cần ít nhất 2 điểm để lưu lộ trình.");
      return;
    }

    const trimmedRouteName = routeName.trim();
    if (!trimmedRouteName) {
      setSaveRouteError("Vui lòng nhập tên lộ trình.");
      return;
    }

    if (!routeStartDate) {
      setSaveRouteError("Vui lòng chọn ngày bắt đầu.");
      return;
    }

    const method = isEditingOwnedRoute ? "PUT" : "POST";

    setIsSavingRoute(true);
    setSaveRouteError(null);
    setSaveRouteSuccess(null);

    try {
      const response = await fetch("/api/routes", {
        method,
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          routeId: isEditingOwnedRoute ? loadedRoute?.id : undefined,
          title: trimmedRouteName,
          startDate: routeStartDate,
          visibility: routeVisibility,
          summary: routeSummary,
          stops: routeStops.map((stop) => ({
            label: stop.label,
            coordinates: stop.coordinates,
            kind: stop.kind,
            recordId: stop.recordId,
          })),
        }),
      });

      const data = (await response.json()) as SaveRouteResponse;

      if (!response.ok) {
        setSaveRouteError(
          data.error ??
            (isEditingOwnedRoute
              ? "Không thể cập nhật lộ trình lúc này."
              : "Không thể lưu lộ trình lúc này."),
        );
        return;
      }

      setIsSaveRouteDialogOpen(false);
      setSaveRouteSuccess(
        isEditingOwnedRoute ? "Đã cập nhật lộ trình thành công." : "Đã lưu lộ trình thành công.",
      );
    } catch {
      setSaveRouteError(
        isEditingOwnedRoute ? "Lỗi mạng khi cập nhật lộ trình." : "Lỗi mạng khi lưu lộ trình.",
      );
    } finally {
      setIsSavingRoute(false);
    }
  }, [isEditingOwnedRoute, loadedRoute, routeName, routeStartDate, routeStops, routeSummary, routeVisibility]);

  const openDirections = useCallback(
    (record: MapRecord) => {
      if (loadedRoute && !isRouteOwnedByCurrentUser) {
        setRouteError("Bạn không thể chỉnh sửa lộ trình của người khác. Hãy sao chép nó trước.");
        return;
      }

      setRightPanelMode("navigation");
      setIsRightPanelOpen(true);

      if (!routeOrigin) {
        setRouteError("Chưa có điểm đi. Hãy chọn địa chỉ điều hướng hoặc bật vị trí hiện tại.");
        return;
      }

      const nextStop: RouteStop = {
        id: `record-${record.id}`,
        label: record.event_name || "Địa điểm không tên",
        coordinates: [record.goong_longitude, record.goong_latitude],
        kind: "record",
        recordId: record.id,
      };

      if (routeDestinations.some((stop) => stop.recordId === record.id)) {
        setRouteError("Địa điểm này đã có trong danh sách chỉ đường.");
        return;
      }

      if (routeDestinations.length === 0) {
        setRouteDestinations([nextStop]);
        setRouteLegs([]);
        setRouteSummary(null);
        setRouteError(null);
        return;
      }

      setPendingRouteStop(nextStop);
      setIsInsertDialogOpen(true);
    },
    [routeDestinations, routeOrigin, loadedRoute, isRouteOwnedByCurrentUser],
  );

  useEffect(() => {
    if (routeStops.length < 2 || !isMapStyleLoaded) {
      clearDirectionRoute();
      return;
    }

    let isCancelled = false;

    const renderRoute = async () => {
      setIsRouting(true);
      setRouteError(null);
      setRouteSummary(null);

      try {
        const nextSegments: RouteSegment[] = [];
        const nextLegs: RouteLegSummary[] = [];

        for (let index = 0; index < routeStops.length - 1; index += 1) {
          const originStop = routeStops[index];
          const destinationStop = routeStops[index + 1];
          const route = await fetchDirectionRoute(
            originStop.coordinates,
            destinationStop.coordinates,
          );

          if (isCancelled) {
            return;
          }

          const color = ROUTE_SEGMENT_COLORS[index % ROUTE_SEGMENT_COLORS.length];
          nextSegments.push({
            id: `${index + 1}`,
            color,
            coordinates: route.coordinates,
          });
          nextLegs.push({
            id: `${originStop.id}-${destinationStop.id}`,
            color,
            fromLabel: originStop.label,
            toLabel: destinationStop.label,
            distance: route.distance,
            duration: route.duration,
          });
        }

        if (isCancelled) {
          return;
        }

        drawDirectionRoute(nextSegments, routeStops);
        setRouteLegs(nextLegs);
        setRouteSummary(
          `${routeStops.length} điểm · ${nextLegs.length} chặng được tô màu riêng`,
        );
      } catch (error) {
        if (isCancelled) {
          return;
        }

        clearDirectionRoute();
        setRouteLegs([]);
        setRouteError(
          error instanceof Error ? error.message : "Lỗi mạng khi lấy dữ liệu chỉ đường.",
        );
      } finally {
        if (!isCancelled) {
          setIsRouting(false);
        }
      }
    };

    void renderRoute();

    return () => {
      isCancelled = true;
    };
  }, [clearDirectionRoute, drawDirectionRoute, fetchDirectionRoute, routeStops, isMapStyleLoaded]);

  const updateViewportBounds = (map: MaplibreMap) => {
    const bounds = map.getBounds();

    setViewportBounds({
      minLat: bounds.getSouth(),
      maxLat: bounds.getNorth(),
      minLng: bounds.getWest(),
      maxLng: bounds.getEast(),
    });
    setMapZoom(map.getZoom());
  };

  const removeExistingMapMarkers = () => {
    eventMarkersRef.current.forEach((marker: maplibregl.Marker) => marker.remove());
    placeMarkersRef.current.forEach((marker: maplibregl.Marker) => marker.remove());
    eventMarkersRef.current.clear();
    placeMarkersRef.current.clear();
  };

  const findMarkerByRecordId = (recordId: string) => {
    return (
      eventMarkersRef.current.get(recordId) ??
      placeMarkersRef.current.get(recordId) ??
      null
    );
  };

  const openRecordPopup = useCallback((recordId: string) => {
    const marker = findMarkerByRecordId(recordId);
    const popup = marker?.getPopup();
    if (!marker || !popup) {
      return false;
    }

    setSelectedRecordId(recordId);

    if (!popup.isOpen()) {
      marker.togglePopup();
    }

    return true;
  }, []);

  const flyToRecord = useCallback((record: MapRecord) => {
    const map = mapRef.current;
    if (!map) {
      return;
    }

    const targetCenter: [number, number] = [record.goong_longitude, record.goong_latitude];
    const currentCenter = map.getCenter();
    const targetZoom = Math.max(map.getZoom(), 16);
    const needsMove =
      Math.abs(currentCenter.lng - targetCenter[0]) > 0.000001 ||
      Math.abs(currentCenter.lat - targetCenter[1]) > 0.000001 ||
      Math.abs(map.getZoom() - targetZoom) > 0.01;

    setSelectedRecordId(record.id);

    if (!needsMove) {
      openRecordPopup(record.id);
      return;
    }

    map.flyTo({
      center: targetCenter,
      zoom: targetZoom,
      speed: 0.9,
    });

    map.once("moveend", () => {
      window.setTimeout(() => {
        openRecordPopup(record.id);
      }, 0);
    });
  }, [openRecordPopup]);

  const ensureClusterLayers = (map: MaplibreMap) => {
    if (!map.getSource(RECORDS_SOURCE_ID)) {
      map.addSource(RECORDS_SOURCE_ID, {
        type: "geojson",
        data: toFeatureCollection([]),
        cluster: true,
        clusterRadius: 56,
        clusterMaxZoom: MARKER_CLUSTER_TRANSITION_ZOOM - 1,
      });
    }

    if (!map.getLayer(CLUSTER_CIRCLES_LAYER_ID)) {
      map.addLayer({
        id: CLUSTER_CIRCLES_LAYER_ID,
        type: "circle",
        source: RECORDS_SOURCE_ID,
        filter: ["has", "point_count"],
        maxzoom: MARKER_CLUSTER_TRANSITION_ZOOM - 0.01,
        paint: {
          "circle-color": [
            "step",
            ["get", "point_count"],
            "#0f766e",
            10,
            "#0284c7",
            30,
            "#0f172a",
          ],
          "circle-radius": [
            "step",
            ["get", "point_count"],
            20,
            10,
            24,
            30,
            30,
          ],
          "circle-stroke-width": 2,
          "circle-stroke-color": "#ffffff",
        },
      });
    }

    if (!map.getLayer(CLUSTER_COUNT_LAYER_ID)) {
      map.addLayer({
        id: CLUSTER_COUNT_LAYER_ID,
        type: "symbol",
        source: RECORDS_SOURCE_ID,
        filter: ["has", "point_count"],
        maxzoom: MARKER_CLUSTER_TRANSITION_ZOOM - 0.01,
        layout: {
          "text-field": ["get", "point_count_abbreviated"],
          "text-size": 12,
          "text-font": ["Open Sans Bold"],
        },
        paint: {
          "text-color": "#ffffff",
        },
      });
    }

    if (!map.getLayer(UNCLUSTERED_LAYER_ID)) {
      map.addLayer({
        id: UNCLUSTERED_LAYER_ID,
        type: "circle",
        source: RECORDS_SOURCE_ID,
        filter: ["!", ["has", "point_count"]],
        maxzoom: MARKER_CLUSTER_TRANSITION_ZOOM - 0.01,
        paint: {
          "circle-color": [
            "match",
            ["get", "record_kind"],
            "event",
            "#dc2626",
            "#10b981",
          ],
          "circle-radius": 8,
          "circle-stroke-width": 2,
          "circle-stroke-color": "#ffffff",
        },
      });
    }
  };

  const updateClusterSource = (map: MaplibreMap, nextRecords: MapRecord[]) => {
    const source = map.getSource(RECORDS_SOURCE_ID) as maplibregl.GeoJSONSource | undefined;
    if (!source) {
      return;
    }

    source.setData(toFeatureCollection(nextRecords));
  };

  const toggleCategory = (categoryId: string) => {
    setSelectedCategoryIds((prev) => {
      if (prev.includes(categoryId)) {
        return prev.filter((id) => id !== categoryId);
      }

      return [...prev, categoryId];
    });
  };

  useEffect(() => {
    if (!mapContainerRef.current || !styleUrl || mapRef.current) {
      return;
    }

    const map = new maplibregl.Map({
      container: mapContainerRef.current,
      style: styleUrl,
      center: initialFocusCoordinates ?? DEFAULT_CENTER,
      zoom: initialFocusCoordinates ? 15 : DEFAULT_ZOOM,
      attributionControl: false,
    });

    if (initialFocusCoordinates) {
      hasCenteredRef.current = true;
    }

    map.addControl(new maplibregl.NavigationControl(), "bottom-left");

    map.on("load", () => {
      setLocationMessage(null);
      setIsMapStyleLoaded(true);
      ensureClusterLayers(map);
      updateClusterSource(map, recordsRef.current);

      map.on("click", CLUSTER_CIRCLES_LAYER_ID, (event) => {
        const feature = event.features?.[0];
        const clusterId = feature?.properties?.cluster_id;

        if (typeof clusterId !== "number") {
          return;
        }

        const source = map.getSource(RECORDS_SOURCE_ID) as maplibregl.GeoJSONSource | undefined;
        const pointFeature = feature as GeoJSON.Feature<GeoJSON.Point> | undefined;
        if (!source || !pointFeature) {
          return;
        }

        void source.getClusterExpansionZoom(clusterId).then((zoom) => {
          const coordinates = pointFeature.geometry.coordinates;
          map.easeTo({ center: [coordinates[0], coordinates[1]], zoom, duration: 400 });
        });
      });

      map.on("click", UNCLUSTERED_LAYER_ID, (event) => {
        const recordId = event.features?.[0]?.properties?.id;
        if (typeof recordId !== "string") {
          return;
        }

        const record = recordsRef.current.find((item) => item.id === recordId);
        if (!record) {
          return;
        }

        flyToRecord(record);
      });

      map.on("mouseenter", CLUSTER_CIRCLES_LAYER_ID, () => {
        map.getCanvas().style.cursor = "pointer";
      });

      map.on("mouseleave", CLUSTER_CIRCLES_LAYER_ID, () => {
        map.getCanvas().style.cursor = "";
      });

      map.on("mouseenter", UNCLUSTERED_LAYER_ID, () => {
        map.getCanvas().style.cursor = "pointer";
      });

      map.on("mouseleave", UNCLUSTERED_LAYER_ID, () => {
        map.getCanvas().style.cursor = "";
      });

      updateViewportBounds(map);
    });

    map.on("moveend", () => {
      updateViewportBounds(map);

      if (!userPositionRef.current) return;
      const center = map.getCenter();
      const dist = Math.hypot(
        center.lng - userPositionRef.current[0],
        center.lat - userPositionRef.current[1],
      );
      setIsOffCenter(dist > 0.001);
    });

    mapRef.current = map;

    return () => {
      if (watchIdRef.current !== null && navigator.geolocation) {
        navigator.geolocation.clearWatch(watchIdRef.current);
      }

      watchIdRef.current = null;
      userMarkerRef.current?.remove();
      selectedPlaceMarkerRef.current?.remove();
      clearDirectionRoute();
      removeExistingMapMarkers();
      map.remove();
      mapRef.current = null;
    };
  }, [clearDirectionRoute, flyToRecord, initialFocusCoordinates, styleUrl]);

  useEffect(() => {
    let disposed = false;

    const loadCategories = async () => {
      setCategoryError(null);

      try {
        const response = await fetch("/api/map/event-categories", {
          method: "GET",
          cache: "no-store",
        });
        const data = (await response.json()) as MapCategoriesResponse;

        if (!response.ok) {
          if (!disposed) {
            setCategoryError(data.error ?? "Không thể tải danh mục.");
          }
          return;
        }

        if (!disposed) {
          setCategoryOptions(Array.isArray(data.categories) ? data.categories : []);
        }
      } catch {
        if (!disposed) {
          setCategoryError("Lỗi mạng khi tải danh mục.");
        }
      }
    };

    void loadCategories();

    return () => {
      disposed = true;
    };
  }, []);

  useEffect(() => {
    const query = search.trim();

    if (query.length < 2) {
      return;
    }

    const timeoutId = window.setTimeout(async () => {
      setIsSearching(true);
      setSearchError(null);

      try {
        const response = await fetch(
          `/api/goong/autocomplete?input=${encodeURIComponent(query)}`,
          { method: "GET", cache: "no-store" },
        );
        const data = (await response.json()) as GoongAutocompleteResponse & {
          error?: string;
        };

        if (!response.ok) {
          setSearchError(data.error ?? "Không thể tìm gợi ý địa chỉ.");
          setPredictions([]);
          return;
        }

        setPredictions(Array.isArray(data.predictions) ? data.predictions : []);
      } catch {
        setSearchError("Lỗi mạng khi tìm địa điểm.");
        setPredictions([]);
      } finally {
        setIsSearching(false);
      }
    }, 350);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [search]);

  useEffect(() => {
    if (!mapRef.current || !navigator.geolocation) {
      return;
    }

    const geo = navigator.geolocation;

    const updateLocation = (position: GeolocationPosition) => {
      const lngLat: [number, number] = [
        position.coords.longitude,
        position.coords.latitude,
      ];

      if (!userMarkerRef.current) {
        const markerElement = document.createElement("div");

        markerElement.className =
          "h-5 w-5 rounded-full border-2 border-white bg-primary shadow-[0_0_0_6px_color-mix(in_oklab,var(--color-primary)_24%,transparent)]";

        userMarkerRef.current = new maplibregl.Marker({
          element: markerElement,
        })
          .setLngLat(lngLat)
          .addTo(mapRef.current!);
      } else {
        userMarkerRef.current.setLngLat(lngLat);
      }

      userPositionRef.current = lngLat;
      setMyPosition(lngLat);

      // Auto-center on first load: to route origin if available, otherwise to current location
      if (!hasCenteredRef.current) {
        const centerPoint = initialRoute
          ? ([initialRoute.origin_longitude, initialRoute.origin_latitude] as [number, number])
          : lngLat;

        mapRef.current?.easeTo({
          center: centerPoint,
          zoom: 15,
          duration: 700,
        });

        hasCenteredRef.current = true;
        setIsOffCenter(false);
      }

      setLocationMessage(null);
    };

    const handleError = (error: GeolocationPositionError) => {
      switch (error.code) {
        case error.PERMISSION_DENIED:
          setLocationMessage("Bạn đã từ chối quyền vị trí.");
          break;

        case error.POSITION_UNAVAILABLE:
          // Safari hay vào đây lúc GPS chưa lock
          setLocationMessage("Đang xác định vị trí...");
          break;

        case error.TIMEOUT:
          setLocationMessage("Lấy vị trí quá lâu...");
          break;

        default:
          setLocationMessage("Không lấy được vị trí.");
      }
    };

    // bước 1: lấy vị trí initial
    geo.getCurrentPosition(
      (position) => {
        updateLocation(position);

        // bước 2: chỉ watch sau khi có initial position
        watchIdRef.current = geo.watchPosition(updateLocation, handleError, {
          enableHighAccuracy: false,
          maximumAge: 10000,
          timeout: 30000,
        });
      },
      handleError,
      {
        enableHighAccuracy: false,
        maximumAge: 10000,
        timeout: 30000,
      },
    );

    return () => {
      if (watchIdRef.current !== null) {
        geo.clearWatch(watchIdRef.current);
        watchIdRef.current = null;
      }

      hasCenteredRef.current = false;
      userPositionRef.current = null;
      setMyPosition(null);
      setIsOffCenter(false);
    };
  }, [styleUrl, initialRoute]);

  useEffect(() => {
    if (!initialFocusRecordId || consumedInitialFocusRef.current) {
      return;
    }

    const map = mapRef.current;
    if (!map || records.length === 0) {
      return;
    }

    const target = records.find((record) => record.id === initialFocusRecordId);
    if (!target) {
      return;
    }

    consumedInitialFocusRef.current = true;
    flyToRecord(target);
  }, [flyToRecord, initialFocusRecordId, records]);

  useEffect(() => {
    if (!debouncedViewportBounds) {
      return;
    }

    if (!canApplyRadiusFilter) {
      return;
    }

    const currentFetchSeq = fetchSeqRef.current + 1;
    fetchSeqRef.current = currentFetchSeq;

    const timeoutId = window.setTimeout(async () => {
      setIsLoadingRecords(true);
      setRecordsError(null);

      try {
        const params = new URLSearchParams({
          minLat: String(debouncedViewportBounds.minLat),
          maxLat: String(debouncedViewportBounds.maxLat),
          minLng: String(debouncedViewportBounds.minLng),
          maxLng: String(debouncedViewportBounds.maxLng),
        });

        if (debouncedRecordKeyword.length >= 2) {
          params.set("search", debouncedRecordKeyword);
        }

        if (debouncedSelectedCategoryIds.length > 0) {
          params.set("categoryIds", debouncedSelectedCategoryIds.join(","));
        }

        if (
          radiusMode !== "none" &&
          debouncedRadiusKmNumber !== null &&
          Array.isArray(debouncedRadiusCenter)
        ) {
          params.set("radiusKm", String(debouncedRadiusKmNumber));
          params.set("centerLng", String(debouncedRadiusCenter[0]));
          params.set("centerLat", String(debouncedRadiusCenter[1]));
        }

        const response = await fetch(`/api/map/event-records?${params.toString()}`, {
          method: "GET",
          cache: "no-store",
        });
        const data = (await response.json()) as MapRecordsResponse;

        if (fetchSeqRef.current !== currentFetchSeq) {
          return;
        }

        if (!response.ok) {
          setRecordsError(data.error ?? "Không thể tải dữ liệu bản đồ.");
          setRecords([]);
          return;
        }

        const nextRecords = Array.isArray(data.records) ? data.records : [];
        setRecords(nextRecords);
        setSelectedRecordId((prev) => {
          if (prev && nextRecords.some((record) => record.id === prev)) {
            return prev;
          }

          return nextRecords[0]?.id ?? null;
        });
      } catch {
        if (fetchSeqRef.current !== currentFetchSeq) {
          return;
        }

        setRecordsError("Lỗi mạng khi tải dữ liệu bản đồ.");
        setRecords([]);
        setSelectedRecordId(null);
      } finally {
        if (fetchSeqRef.current === currentFetchSeq) {
          setIsLoadingRecords(false);
        }
      }
    }, 250);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [
    canApplyRadiusFilter,
    debouncedRadiusCenter,
    debouncedRadiusKmNumber,
    debouncedRecordKeyword,
    debouncedSelectedCategoryIds,
    debouncedViewportBounds,
    radiusMode,
  ]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) {
      return;
    }

    updateClusterSource(map, records);

    if (mapZoom < MARKER_CLUSTER_TRANSITION_ZOOM) {
      removeExistingMapMarkers();
      return;
    }

    removeExistingMapMarkers();

    records.forEach((record) => {
      const element = document.createElement("button");
      element.type = "button";
      element.setAttribute("aria-label", record.event_name || "Sự kiện / địa điểm");
      element.className = "group relative block h-14 w-14 bg-transparent";

      const thumbnail = document.createElement("div");
      thumbnail.className =
        "relative mx-auto h-14 w-14 overflow-hidden rounded-full border-[3px] border-white bg-neutral-300 shadow-[0_10px_24px_rgba(0,0,0,0.22)] transition-transform group-hover:scale-105";

      const coverImage = record.image_urls[0];
      if (coverImage) {
        thumbnail.style.backgroundImage = `url(${coverImage})`;
        thumbnail.style.backgroundSize = "cover";
        thumbnail.style.backgroundPosition = "center";
      } else {
        thumbnail.textContent = record.record_kind === "event" ? "EV" : "PL";
        thumbnail.className = cn(
          thumbnail.className,
          "flex items-center justify-center bg-white text-xs font-semibold text-slate-700",
        );
      }

      const kindBadge = document.createElement("span");
      kindBadge.className = cn(
        "absolute bottom-0 right-0 h-4 w-4 rounded-full border-2 border-white",
        record.record_kind === "event" ? "bg-destructive" : "bg-emerald-500",
      );

      element.appendChild(thumbnail);
      element.appendChild(kindBadge);

      const popup = new maplibregl.Popup({
        offset: 16,
        closeOnMove: false,
      });
      const popupContent = document.createElement("div");
      popupContent.className = "space-y-2 py-1";
      popupContent.addEventListener("click", (event) => {
        event.stopPropagation();
      });

      if (coverImage) {
        const preview = document.createElement("img");
        preview.src = coverImage;
        preview.alt = record.event_name || "Hình đại diện";
        preview.className = "h-28 w-full rounded-xl object-cover";
        popupContent.appendChild(preview);
      }

      const title = document.createElement("p");
      title.className = "text-sm font-semibold text-foreground";
      title.textContent = record.event_name || "Sự kiện / địa điểm";

      const subtitle = document.createElement("p");
      subtitle.className = "text-xs text-muted-foreground";
      subtitle.textContent =
        record.record_kind === "event"
          ? `Sự kiện${record.event_type ? ` · ${record.event_type}` : ""}`
          : "Địa điểm";

      popupContent.appendChild(title);
      popupContent.appendChild(subtitle);

      if (record.event_description) {
        const description = document.createElement("p");
        description.className = "line-clamp-3 text-xs text-muted-foreground";
        description.textContent = record.event_description;
        popupContent.appendChild(description);
      }

      if (record.categories.length > 0) {
        const categoryText = document.createElement("p");
        categoryText.className = "text-xs text-muted-foreground";
        categoryText.textContent = `Danh mục: ${record.categories
          .map((category) => category.name)
          .join(", ")}`;
        popupContent.appendChild(categoryText);
      }

      const actions = document.createElement("div");
      actions.className = "flex gap-2 pt-1";

      const detailLink = document.createElement("a");
      detailLink.href = `/events/${record.id}`;
      detailLink.className =
        "inline-flex h-8 items-center justify-center rounded-lg border border-border px-3 text-xs font-medium text-foreground transition-colors hover:bg-accent hover:text-accent-foreground";
      detailLink.textContent = "Xem chi tiết";
      detailLink.addEventListener("click", (event) => {
        event.stopPropagation();
      });

      const directionsButton = document.createElement("button");
      directionsButton.type = "button";
      directionsButton.className =
        "inline-flex h-8 items-center justify-center rounded-lg bg-primary px-3 text-xs font-medium text-primary-foreground transition-opacity hover:opacity-90";
      directionsButton.textContent = "Chỉ đường";
      directionsButton.addEventListener("click", (event) => {
        event.stopPropagation();
        openDirections(record);
      });

      actions.appendChild(detailLink);
      actions.appendChild(directionsButton);
      popupContent.appendChild(actions);

      popup.setDOMContent(popupContent);

      const marker = new maplibregl.Marker({ element })
        .setLngLat([record.goong_longitude, record.goong_latitude])
        .setPopup(popup)
        .addTo(map);

      element.addEventListener("click", (event) => {
        event.preventDefault();
        event.stopPropagation();
        openRecordPopup(record.id);
      });

      element.addEventListener("touchend", (event) => {
        event.preventDefault();
        event.stopPropagation();
        openRecordPopup(record.id);
      });

      popup.on("open", () => {
        setSelectedRecordId(record.id);
      });

      popup.on("close", () => {
        setSelectedRecordId((prev) => (prev === record.id ? null : prev));
      });

      if (record.record_kind === "event") {
        eventMarkersRef.current.set(record.id, marker);
      } else {
        placeMarkersRef.current.set(record.id, marker);
      }
    });

    return () => {
      removeExistingMapMarkers();
    };
  }, [mapZoom, openDirections, openRecordPopup, records]);

  const handleSelectPrediction = async (prediction: GoongPrediction) => {
    if (!prediction.place_id) {
      return;
    }

    setSearch(prediction.description ?? "");
    setPredictions([]);
    setSearchError(null);

    try {
      const response = await fetch(
        `/api/goong/place-detail?placeId=${encodeURIComponent(prediction.place_id)}`,
        { method: "GET", cache: "no-store" },
      );
      const data = (await response.json()) as GoongPlaceDetailResponse & {
        error?: string;
      };

      if (!response.ok) {
        setSearchError(data.error ?? "Không lấy được thông tin địa điểm.");
        return;
      }

      const location = data.result?.geometry?.location;

      if (
        !location ||
        typeof location.lng !== "number" ||
        typeof location.lat !== "number"
      ) {
        setSearchError("Không tìm thấy tọa độ cho địa điểm này.");
        return;
      }

      const lngLat: [number, number] = [location.lng, location.lat];
      setSelectedPlacePosition(lngLat);
      setSelectedPlaceLabel(prediction.description ?? "");

      if (!mapRef.current) {
        return;
      }

      if (!selectedPlaceMarkerRef.current) {
        const markerElement = document.createElement("div");
        markerElement.className =
          "h-4 w-4 rounded-full border-2 border-white bg-accent shadow-[0_0_0_4px_color-mix(in_oklab,var(--color-accent)_24%,transparent)]";

        selectedPlaceMarkerRef.current = new maplibregl.Marker({
          element: markerElement,
        })
          .setLngLat(lngLat)
          .addTo(mapRef.current);
      } else {
        selectedPlaceMarkerRef.current.setLngLat(lngLat);
      }

      mapRef.current.flyTo({ center: lngLat, zoom: 16, speed: 0.9 });
    } catch {
      setSearchError("Lỗi mạng khi lấy chi tiết địa điểm.");
    }
  };

  const trimmedSearch = search.trim();
  const visiblePredictions = trimmedSearch.length >= 2 ? predictions : [];
  const displayRouteSummary =
    routeSummary ?? (routeStops.length === 1 ? "Đã chọn điểm bắt đầu." : null);

  const loadChatConversations = useCallback(async () => {
    setIsChatLoading(true);
    setChatError(null);

    try {
      const response = await fetch("/api/map/ai-chat", {
        method: "GET",
        cache: "no-store",
      });
      const data = (await response.json()) as AiChatListResponse;

      if (!response.ok) {
        setChatError(data.error ?? "Không thể tải lịch sử chat AI.");
        return;
      }

      setChatConversations(Array.isArray(data.conversations) ? data.conversations : []);
    } catch {
      setChatError("Lỗi mạng khi tải lịch sử chat AI.");
    } finally {
      setIsChatLoading(false);
    }
  }, []);

  const loadConversationMessages = useCallback(async (conversationId: string) => {
    setIsChatLoading(true);
    setChatError(null);

    try {
      const response = await fetch(
        `/api/map/ai-chat?conversationId=${encodeURIComponent(conversationId)}`,
        {
          method: "GET",
          cache: "no-store",
        },
      );
      const data = (await response.json()) as AiChatListResponse;

      if (!response.ok) {
        setChatError(data.error ?? "Không thể tải cuộc trò chuyện.");
        return;
      }

      setChatConversations(Array.isArray(data.conversations) ? data.conversations : []);
      setChatMessages(Array.isArray(data.messages) ? data.messages : []);
      setActiveChatConversationId(conversationId);
    } catch {
      setChatError("Lỗi mạng khi tải tin nhắn chat AI.");
    } finally {
      setIsChatLoading(false);
    }
  }, []);

  const openNewChatConversation = useCallback(() => {
    setActiveChatConversationId(null);
    setChatMessages([]);
    setChatPrompt("");
    setChatError(null);
  }, []);

  const openAiChatPanel = useCallback(() => {
    setRightPanelMode("ai-chat");
    setIsRightPanelOpen(true);
    void loadChatConversations();
    openNewChatConversation();
  }, [loadChatConversations, openNewChatConversation]);

  const sendChatPrompt = useCallback(async () => {
    const prompt = chatPrompt.trim();
    if (prompt.length < 2) {
      setChatError("Vui lòng nhập nội dung chat.");
      return;
    }

    const optimisticUserMessage: ChatMessage = {
      id: `tmp-user-${Date.now()}`,
      role: "user",
      content: prompt,
      attachments: [],
      createdAt: new Date().toISOString(),
    };

    setIsChatSending(true);
    setChatError(null);
    setChatMessages((prev) => [...prev, optimisticUserMessage]);
    setChatPrompt("");

    try {
      const response = await fetch("/api/map/ai-chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          prompt,
          conversationId: activeChatConversationId ?? undefined,
          userLocation: Array.isArray(myPosition)
            ? {
                latitude: myPosition[1],
                longitude: myPosition[0],
              }
            : null,
          mapViewport: viewportBounds
            ? {
                minLat: viewportBounds.minLat,
                maxLat: viewportBounds.maxLat,
                minLng: viewportBounds.minLng,
                maxLng: viewportBounds.maxLng,
                zoom: mapZoom,
              }
            : null,
        }),
      });

      const data = (await response.json()) as AiChatSendResponse;

      if (!response.ok || !data.assistantMessage) {
        setChatMessages((prev) => prev.filter((message) => message.id !== optimisticUserMessage.id));
        setChatPrompt(prompt);
        setChatError(data.error ?? "Không thể gửi yêu cầu chat AI.");
        return;
      }

      const assistantMessage = data.assistantMessage;

      setActiveChatConversationId(data.conversationId ?? activeChatConversationId);
      setChatConversations(Array.isArray(data.conversations) ? data.conversations : []);
      setChatMessages((prev) => [
        ...prev.filter((message) => message.id !== optimisticUserMessage.id),
        {
          ...optimisticUserMessage,
          id: `local-user-${Date.now()}`,
        },
        assistantMessage,
      ]);
    } catch {
      setChatMessages((prev) => prev.filter((message) => message.id !== optimisticUserMessage.id));
      setChatPrompt(prompt);
      setChatError("Lỗi mạng khi gửi yêu cầu chat AI.");
    } finally {
      setIsChatSending(false);
    }
  }, [activeChatConversationId, chatPrompt, mapZoom, myPosition, viewportBounds]);

  const focusAttachmentOnMap = useCallback((attachment: ChatAttachment) => {
    const map = mapRef.current;
    if (!map) {
      return;
    }

    map.flyTo({
      center: [attachment.longitude, attachment.latitude],
      zoom: Math.max(map.getZoom(), 15),
      speed: 0.85,
    });

    if (attachment.recordId) {
      const recordId = attachment.recordId;
      setSelectedRecordId(recordId);
      window.setTimeout(() => {
        openRecordPopup(recordId);
      }, 400);
    }
  }, [openRecordPopup]);

  useEffect(() => {
    if (!chatScrollRef.current) {
      return;
    }

    chatScrollRef.current.scrollTop = chatScrollRef.current.scrollHeight;
  }, [chatMessages, isChatSending]);

  return (
    <section className="h-[calc(100dvh-8.6rem)] md:h-full min-h-105 w-full overflow-hidden bg-card">
      <div className="flex h-full w-full flex-col md:flex-row">
        <div className="relative min-w-0 flex-1 border-b border-border md:border-b-0 md:border-r">
          <div ref={mapContainerRef} className="h-full w-full" />

          {(!styleUrl || locationMessage) && (
            <div className="pointer-events-none absolute left-3 top-3 rounded-xl border border-border bg-background/90 px-3 py-2 text-xs text-muted-foreground backdrop-blur">
              {styleUrl
                ? locationMessage
                : "Thiếu NEXT_PUBLIC_GOONG_MAP_KEY để hiển thị bản đồ."}
            </div>
          )}
        </div>

        <aside
          className={cn(
            "shrink-0 border-t border-border bg-linear-to-b from-background via-background to-background/98 backdrop-blur-sm transition-[height] duration-300 md:border-l md:border-t-0 md:transition-[width]",
            isRightPanelOpen ? "h-[calc(100dvh-5.5rem)] md:w-96" : "h-14 md:w-14",
          )}
        >
          {!isRightPanelOpen ? (
            <div className="flex h-full flex-row items-center gap-2 px-3 py-2 md:flex-col md:px-2 md:py-3">
              <button
                type="button"
                onClick={() => {
                  setRightPanelMode("navigation");
                  setIsRightPanelOpen(true);
                }}
                className="group inline-flex py-2 size-10 items-center justify-center rounded-2xl border border-border bg-card/60 text-foreground transition-all hover:bg-primary hover:text-primary-foreground hover:border-primary shadow-sm hover:shadow-md"
                aria-label="Mở tab điều hướng"
                title="Điều hướng & bộ lọc"
              >
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  className="size-5"
                  aria-hidden="true"
                >
                  <path
                    d="M12 3.75L20.25 20.25L12 16.5L3.75 20.25L12 3.75Z"
                    stroke="currentColor"
                    strokeWidth="1.8"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </button>

              <button
                type="button"
                onClick={() => {
                  openAiChatPanel();
                }}
                className="group inline-flex py-2 size-10 items-center justify-center rounded-2xl border border-border bg-card/60 text-foreground transition-all hover:bg-emerald-500 hover:text-white hover:border-emerald-500 shadow-sm hover:shadow-md"
                aria-label="Mở chat AI"
                title="Chat AI"
              >
                <svg viewBox="0 0 24 24" fill="none" className="size-5" aria-hidden="true">
                  <path
                    d="M4 5.75A2.75 2.75 0 0 1 6.75 3h10.5A2.75 2.75 0 0 1 20 5.75v7.5A2.75 2.75 0 0 1 17.25 16H10l-4.4 3.52c-.74.6-1.85.07-1.85-.88V5.75Z"
                    stroke="currentColor"
                    strokeWidth="1.8"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                  <path
                    d="M8 8.5h8M8 11.5h5"
                    stroke="currentColor"
                    strokeWidth="1.8"
                    strokeLinecap="round"
                  />
                </svg>
              </button>

              <div className="hidden rounded-lg border border-border/50 bg-card/50 px-2.5 py-1 text-[10px] font-medium text-muted-foreground md:block shadow-sm">
                {records.length}
              </div>

              {isOffCenter && (
                <button
                  type="button"
                  onClick={() => {
                    if (userPositionRef.current && mapRef.current) {
                      mapRef.current.easeTo({
                        center: userPositionRef.current,
                        zoom: 15,
                        duration: 700,
                      });
                    }
                  }}
                  className="inline-flex py-2 size-10 items-center justify-center rounded-2xl border border-border bg-card/60 text-foreground transition-all hover:bg-blue-500 hover:text-white hover:border-blue-500 shadow-sm hover:shadow-md"
                  aria-label="Về vị trí hiện tại"
                  title="Về vị trí hiện tại"
                >
                  <svg
                    viewBox="0 0 24 24"
                    fill="none"
                    className="size-5"
                    aria-hidden="true"
                  >
                    <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="1.8" />
                    <path
                      d="M12 2v3M12 19v3M2 12h3M19 12h3"
                      stroke="currentColor"
                      strokeWidth="1.8"
                      strokeLinecap="round"
                    />
                  </svg>
                </button>
              )}
            </div>
          ) : (
            <div className="flex h-full flex-col">
              <div className="flex items-center justify-between gap-3 border-b border-border/30 px-4 py-3.5">
                <div className="flex items-center gap-2 flex-1 min-w-0">
                  {rightPanelMode === "navigation" ? (
                    <svg
                      viewBox="0 0 24 24"
                      fill="none"
                      className="size-5 text-primary shrink-0"
                      aria-hidden="true"
                    >
                      <path
                        d="M12 3.75L20.25 20.25L12 16.5L3.75 20.25L12 3.75Z"
                        stroke="currentColor"
                        strokeWidth="1.8"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  ) : (
                    <svg
                      viewBox="0 0 24 24"
                      fill="none"
                      className="size-5 text-emerald-600 shrink-0"
                      aria-hidden="true"
                    >
                      <path
                        d="M4 5.75A2.75 2.75 0 0 1 6.75 3h10.5A2.75 2.75 0 0 1 20 5.75v7.5A2.75 2.75 0 0 1 17.25 16H10l-4.4 3.52c-.74.6-1.85.07-1.85-.88V5.75Z"
                        stroke="currentColor"
                        strokeWidth="1.8"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                      <path
                        d="M8 8.5h8M8 11.5h5"
                        stroke="currentColor"
                        strokeWidth="1.8"
                        strokeLinecap="round"
                      />
                    </svg>
                  )}
                  <p className="text-sm font-bold text-foreground truncate">
                    {rightPanelMode === "navigation" ? "Bản đồ & Bộ lọc" : "Trợ lý AI bản đồ"}
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  {rightPanelMode === "ai-chat" ? (
                    <>
                      <select
                        value={activeChatConversationId ?? "new"}
                        onChange={(event) => {
                          const selectedValue = event.target.value;
                          if (selectedValue === "new") {
                            openNewChatConversation();
                            return;
                          }

                          void loadConversationMessages(selectedValue);
                        }}
                        className="h-8 max-w-36 rounded-lg border border-border/50 bg-card/60 px-2 text-xs"
                      >
                        <option value="new">Cuộc trò chuyện mới</option>
                        {chatConversations.map((conversation) => (
                          <option key={conversation.id} value={conversation.id}>
                            {conversation.title}
                          </option>
                        ))}
                      </select>
                      <button
                        type="button"
                        onClick={openNewChatConversation}
                        className="inline-flex h-8 items-center justify-center rounded-lg border border-emerald-300 bg-emerald-50 px-2 text-[11px] font-semibold text-emerald-700 transition-colors hover:bg-emerald-100"
                      >
                        Chat mới
                      </button>
                    </>
                  ) : null}

                  {isOffCenter && (
                    <button
                      type="button"
                      onClick={() => {
                        if (userPositionRef.current && mapRef.current) {
                          mapRef.current.easeTo({
                            center: userPositionRef.current,
                            zoom: 15,
                            duration: 700,
                          });
                        }
                      }}
                      className="inline-flex size-8 items-center justify-center rounded-xl border border-border/50 bg-blue-50 text-blue-600 transition-all hover:bg-blue-100 hover:border-blue-300 shadow-sm"
                      aria-label="Về vị trí hiện tại"
                      title="Về vị trí hiện tại"
                    >
                      <svg
                        viewBox="0 0 24 24"
                        fill="none"
                        className="size-4"
                        aria-hidden="true"
                      >
                        <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="1.8" />
                        <path
                          d="M12 2v3M12 19v3M2 12h3M19 12h3"
                          stroke="currentColor"
                          strokeWidth="1.8"
                          strokeLinecap="round"
                        />
                      </svg>
                    </button>
                  )}

                  {rightPanelMode === "navigation" ? (
                    <button
                      type="button"
                      onClick={() => {
                        openAiChatPanel();
                      }}
                      className="inline-flex size-8 items-center justify-center rounded-xl border border-emerald-200 bg-emerald-50 text-emerald-700 transition-all hover:bg-emerald-100"
                      aria-label="Chuyển sang chat AI"
                      title="Chat AI"
                    >
                      <svg viewBox="0 0 24 24" fill="none" className="size-4" aria-hidden="true">
                        <path
                          d="M4 5.75A2.75 2.75 0 0 1 6.75 3h10.5A2.75 2.75 0 0 1 20 5.75v7.5A2.75 2.75 0 0 1 17.25 16H10l-4.4 3.52c-.74.6-1.85.07-1.85-.88V5.75Z"
                          stroke="currentColor"
                          strokeWidth="1.8"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => {
                        setRightPanelMode("navigation");
                      }}
                      className="inline-flex h-8 items-center justify-center rounded-lg border border-border/50 bg-card/60 px-2 text-[11px] font-semibold text-foreground transition-all hover:bg-accent"
                    >
                      Bộ lọc
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={() => setIsRightPanelOpen(false)}
                    className="inline-flex size-8 items-center justify-center rounded-xl border border-border/50 bg-card/60 text-foreground transition-all hover:bg-accent hover:text-accent-foreground hover:border-accent/50"
                    aria-label="Đóng tab điều hướng"
                  >
                    <svg
                      viewBox="0 0 24 24"
                      fill="none"
                      className="size-4.5"
                      aria-hidden="true"
                    >
                      <path
                        d="M14.25 6.75L9 12L14.25 17.25"
                        stroke="currentColor"
                        strokeWidth="1.8"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  </button>
                </div>
              </div>

              {rightPanelMode === "navigation" ? (
                <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-auto p-4 pb-6">
                {/* Navigation Address Section */}
                <div className="rounded-2xl border border-border/40 bg-linear-to-br from-card/80 to-card/40 p-4 shadow-sm hover:border-border/60 transition-colors">
                  <div className="flex items-center gap-2 mb-3">
                    <svg
                      viewBox="0 0 24 24"
                      fill="none"
                      className="size-4 text-primary shrink-0"
                      aria-hidden="true"
                    >
                      <path
                        d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2z"
                        stroke="currentColor"
                        strokeWidth="1.8"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                      <path
                        d="M12 6v6l4 2"
                        stroke="currentColor"
                        strokeWidth="1.8"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                      Điểm Khởi Hành
                    </p>
                  </div>
                  <Input
                    value={search}
                    onChange={(event) => {
                      setSearch(event.target.value);
                      setSearchError(null);
                    }}
                    placeholder="Tìm địa chỉ..."
                    className="h-10 rounded-xl border-border/50 bg-background/50 text-sm placeholder:text-muted-foreground/60"
                  />

                  {isSearching ? (
                    <p className="mt-2 text-xs text-muted-foreground">
                      ⏳ Đang tìm...
                    </p>
                  ) : null}

                  {searchError ? (
                    <p className="mt-2 text-xs text-destructive/80 font-medium">{searchError}</p>
                  ) : null}

                  {visiblePredictions.length > 0 && (
                    <div className="mt-3 max-h-40 overflow-y-auto">
                      <div className="flex flex-col gap-2">
                        {visiblePredictions.map((prediction) => (
                          <button
                            key={prediction.place_id ?? prediction.description}
                            type="button"
                            onClick={() => {
                              void handleSelectPrediction(prediction);
                            }}
                            className="rounded-lg border border-border/40 bg-card/50 px-3 py-2.5 text-left text-xs text-foreground transition-all hover:bg-primary/10 hover:border-primary/50 hover:text-primary font-medium"
                          >
                            <span className="line-clamp-1">{prediction.description ?? "Địa điểm không tên"}</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {!isSearching &&
                  !searchError &&
                  trimmedSearch.length >= 2 &&
                  visiblePredictions.length === 0 ? (
                    <p className="mt-2 text-xs text-muted-foreground">
                      Không có gợi ý phù hợp.
                    </p>
                  ) : null}

                  {selectedPlacePosition ? (
                    <p className="mt-3 text-xs text-foreground font-medium bg-primary/5 rounded-lg px-2.5 py-2 border border-primary/20">
                      📍 {selectedPlaceLabel || "Địa chỉ đã chọn"}
                    </p>
                  ) : myPosition ? (
                    <p className="mt-3 text-xs text-foreground font-medium bg-blue-50 rounded-lg px-2.5 py-2 border border-blue-200">
                      📍 Vị trí của bạn
                    </p>
                  ) : null}
                </div>

                {isLoadingRecords ? (
                  <p className="text-xs text-muted-foreground animate-pulse">
                    ⏳ Đang tải dữ liệu...
                  </p>
                ) : null}

                {isRouting ? (
                  <p className="text-xs text-muted-foreground animate-pulse">
                    🗺️ Đang tính toán tuyến đường...
                  </p>
                ) : null}

                {displayRouteSummary ? (
                  <p className="text-xs text-foreground font-medium bg-emerald-50 rounded-lg px-3 py-2 border border-emerald-200">
                    ✓ {displayRouteSummary}
                  </p>
                ) : null}

                {routeError ? (
                  <p className="text-xs text-destructive/80 font-medium bg-red-50 rounded-lg px-3 py-2 border border-red-200">
                    ⚠️ {routeError}
                  </p>
                ) : null}

                {saveRouteError ? (
                  <p className="text-xs text-destructive/80 font-medium bg-red-50 rounded-lg px-3 py-2 border border-red-200">
                    ⚠️ {saveRouteError}
                  </p>
                ) : null}

                {saveRouteSuccess ? (
                  <p className="text-xs text-emerald-700 font-medium bg-emerald-50 rounded-lg px-3 py-2 border border-emerald-200">
                    ✓ {saveRouteSuccess}
                  </p>
                ) : null}

                {recordsError ? (
                  <p className="text-xs text-destructive/80 font-medium bg-red-50 rounded-lg px-3 py-2 border border-red-200">
                    ⚠️ {recordsError}
                  </p>
                ) : null}

                {/* Personal Route Section */}
                <div className="rounded-2xl border border-border/40 bg-linear-to-br from-card/80 to-card/40 p-4 shadow-sm hover:border-border/60 transition-colors">
                  <div className="flex items-center justify-between gap-3 mb-3">
                    <div className="flex items-center gap-2">
                      <svg
                        viewBox="0 0 24 24"
                        fill="none"
                        className="size-4 text-primary shrink-0"
                        aria-hidden="true"
                      >
                        <path
                          d="M12 2L3 7v10c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V7l-9-5z"
                          stroke="currentColor"
                          strokeWidth="1.8"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                        {loadedRoute && !isRouteOwnedByCurrentUser ? `Lộ trình của ${loadedRoute.owner_display_name}` : "Lộ Trình Cá Nhân"}
                      </p>
                    </div>
                    <div className="flex items-center gap-1.5">
                      {loadedRoute && !isRouteOwnedByCurrentUser ? (
                        <>
                          <button
                            type="button"
                            onClick={() => {
                              setRouteName(`${loadedRoute.title} (bản sao)`);
                              setIsSaveRouteDialogOpen(true);
                            }}
                            className="rounded-lg border border-primary/40 bg-primary/10 px-3 py-1.5 text-xs font-semibold text-primary transition-all hover:bg-primary/20 hover:border-primary/60"
                          >
                            Sao chép
                          </button>
                          <button
                            type="button"
                            onClick={cancelLoadedRoute}
                            className="rounded-lg border border-border/40 bg-background/50 px-3 py-1.5 text-xs font-medium text-muted-foreground transition-all hover:bg-accent/30 hover:text-foreground hover:border-border/60"
                          >
                            Hủy
                          </button>
                        </>
                      ) : (
                        <>
                          <button
                            type="button"
                            onClick={openSaveRouteDialog}
                            disabled={routeStops.length < 2 || isSavingRoute}
                            className="rounded-lg border border-primary/40 bg-primary/10 px-3 py-1.5 text-xs font-semibold text-primary transition-all hover:bg-primary/20 hover:border-primary/60 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:bg-primary/10 disabled:hover:border-primary/40"
                          >
                              {isEditingOwnedRoute ? "Cập nhật" : "Lưu"}
                          </button>

                          {loadedRoute ? (
                            <button
                              type="button"
                              onClick={cancelLoadedRoute}
                              className="rounded-lg border border-border/40 bg-background/50 px-3 py-1.5 text-xs font-medium text-muted-foreground transition-all hover:bg-accent/30 hover:text-foreground hover:border-border/60"
                            >
                                Hủy
                            </button>
                          ) : routeDestinations.length > 0 ? (
                            <button
                              type="button"
                              onClick={clearRouteStops}
                              className="rounded-lg border border-border/40 bg-background/50 px-3 py-1.5 text-xs font-medium text-muted-foreground transition-all hover:bg-destructive/10 hover:text-destructive/80 hover:border-destructive/30"
                            >
                                Xóa hết
                            </button>
                          ) : null}
                        </>
                      )}
                    </div>
                  </div>

                  {loadedRoute && !isRouteOwnedByCurrentUser ? (
                    <div className="mt-3 rounded-lg border border-yellow-200 bg-yellow-50/60 px-3 py-2 text-xs text-yellow-800 font-medium">
                      ⚠️ Đây là lộ trình của người khác. Sao chép để tạo lộ trình riêng.
                    </div>
                  ) : null}

                  <div className="mt-3 flex flex-col gap-2">
                    {routeOrigin ? (
                      <div className="flex items-center gap-3 rounded-lg border border-primary/30 bg-linear-to-r from-primary/5 to-transparent px-3 py-2.5 text-xs text-foreground">
                        <span className="inline-flex size-6 items-center justify-center rounded-full bg-slate-900 text-xs font-bold text-white shadow-sm">
                          A
                        </span>
                        <span className="flex-1 font-medium truncate">{routeOrigin.label}</span>
                      </div>
                    ) : (
                      <p className="text-xs text-muted-foreground px-2 py-1 italic">
                        📍 Chưa có điểm bắt đầu. Chọn địa chỉ hoặc bật vị trí.
                      </p>
                    )}

                    {routeDestinations.map((stop, index) => (
                      <div
                        key={stop.id}
                        className="flex items-center gap-3 rounded-lg border border-border/40 bg-card/50 px-3 py-2.5 text-xs text-foreground hover:border-border/60 hover:bg-card/70 transition-colors"
                      >
                        <span className="inline-flex size-6 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground shadow-sm">
                          {index + 1}
                        </span>
                        <span className="min-w-0 flex-1 truncate font-medium">{stop.label}</span>
                        <button
                          type="button"
                          onClick={() => {
                            if (stop.recordId) {
                              removeRouteStop(stop.recordId);
                            }
                          }}
                          disabled={Boolean(loadedRoute && !isRouteOwnedByCurrentUser)}
                          className="rounded-md border border-destructive/30 bg-destructive/10 px-2 py-1 text-[10px] font-medium text-destructive/80 transition-all hover:bg-destructive/20 hover:border-destructive/50 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          Xóa
                        </button>
                      </div>
                    ))}

                    {routeOrigin && routeDestinations.length === 0 ? (
                      <p className="text-xs text-muted-foreground px-2 py-1 italic">
                        Chọn địa điểm đầu tiên để bắt đầu lộ trình.
                      </p>
                    ) : null}
                  </div>

                  {routeLegs.length > 0 ? (
                    <div className="mt-3 flex flex-col gap-2 border-t border-border/30 pt-3">
                      {routeLegs.map((leg, index) => (
                        <div
                          key={leg.id}
                          className="rounded-lg border border-border/40 bg-card/50 px-3 py-2 text-xs"
                        >
                          <div className="flex items-center gap-2">
                            <span
                              className="inline-flex size-2.5 rounded-full shrink-0"
                              style={{ backgroundColor: leg.color }}
                              aria-hidden="true"
                            />
                            <span className="font-semibold text-foreground">
                              Chặng {index + 1}
                            </span>
                          </div>
                          <p className="mt-1 text-[11px] text-muted-foreground line-clamp-1">
                            {leg.fromLabel} → {leg.toLabel}
                          </p>
                          <p className="mt-1 text-[10px] text-muted-foreground font-medium">
                            {[leg.distance ?? null, leg.duration ?? null]
                              .filter(Boolean)
                              .join(" · ") || "Đã vẽ trên bản đồ"}
                          </p>
                        </div>
                      ))}
                    </div>
                  ) : null}
                </div>

                {/* Search & Filter Section */}
                <div className="rounded-2xl border border-border/40 bg-linear-to-br from-card/80 to-card/40 p-4 shadow-sm hover:border-border/60 transition-colors">
                  <div className="flex items-center gap-2 mb-3">
                    <svg
                      viewBox="0 0 24 24"
                      fill="none"
                      className="size-4 text-primary shrink-0"
                      aria-hidden="true"
                    >
                      <path
                        d="M11 19a8 8 0 100-16 8 8 0 000 16zM21 21l-4.35-4.35"
                        stroke="currentColor"
                        strokeWidth="1.8"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                      Tìm Sự Kiện & Địa Điểm
                    </p>
                  </div>
                  
                  <Input
                    value={recordKeyword}
                    onChange={(event) => {
                      setRecordKeyword(event.target.value);
                    }}
                    placeholder="Tên, loại, mô tả..."
                    className="h-10 rounded-xl border-border/50 bg-background/50 text-sm placeholder:text-muted-foreground/60"
                  />

                  <div className="mt-3 space-y-2">
                    <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Phạm vi tìm kiếm</label>
                    <select
                      value={radiusMode}
                      onChange={(event) => {
                        setRadiusMode(event.target.value as RadiusMode);
                      }}
                      className="w-full h-10 rounded-lg border border-border/50 bg-background/50 px-3 text-sm font-medium transition-colors focus:border-primary focus:ring-1 focus:ring-primary"
                    >
                      <option value="none">Không giới hạn</option>
                      <option value="my-location">Quanh vị trí của tôi</option>
                      <option value="navigation-address">Quanh địa chỉ điều hướng</option>
                    </select>
                  </div>

                  {radiusMode !== "none" ? (
                    <div className="mt-3 flex items-center gap-2">
                      <Input
                        value={radiusKm}
                        onChange={(event) => {
                          setRadiusKm(event.target.value);
                        }}
                        inputMode="decimal"
                        placeholder="5"
                        className="h-10 rounded-lg border-border/50 bg-background/50 text-sm placeholder:text-muted-foreground/60 flex-1"
                      />
                      <span className="text-xs font-semibold text-muted-foreground">km</span>
                    </div>
                  ) : null}

                  {!canApplyRadiusFilter ? (
                    <p className="mt-2 text-xs text-amber-700 font-medium bg-amber-50 rounded-lg px-2.5 py-2 border border-amber-200">
                      ⚠️ Cần vị trí hiện tại hoặc địa chỉ để dùng bộ lọc phạm vi.
                    </p>
                  ) : null}
                </div>

                {/* Categories Section */}
                <div className="rounded-2xl border border-border/40 bg-linear-to-br from-card/80 to-card/40 p-4 shadow-sm hover:border-border/60 transition-colors">
                  <div className="flex items-center justify-between gap-2 mb-3">
                    <div className="flex items-center gap-2">
                      <svg
                        viewBox="0 0 24 24"
                        fill="none"
                        className="size-4 text-primary shrink-0"
                        aria-hidden="true"
                      >
                        <path
                          d="M7 2H4c-1.1 0-2 .9-2 2v3c0 1.1.9 2 2 2h3c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zM17 2h-3c-1.1 0-2 .9-2 2v3c0 1.1.9 2 2 2h3c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zM17 12h-3c-1.1 0-2 .9-2 2v3c0 1.1.9 2 2 2h3c1.1 0 2-.9 2-2v-3c0-1.1-.9-2-2-2zM7 12H4c-1.1 0-2 .9-2 2v3c0 1.1.9 2 2 2h3c1.1 0 2-.9 2-2v-3c0-1.1-.9-2-2-2z"
                          fill="currentColor"
                        />
                      </svg>
                      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                        Danh Mục
                      </p>
                    </div>
                    {selectedCategoryIds.length > 0 ? (
                      <button
                        type="button"
                        onClick={() => setSelectedCategoryIds([])}
                        className="rounded-lg border border-border/40 bg-background/50 px-2.5 py-1 text-[10px] font-semibold text-muted-foreground transition-all hover:bg-accent/30 hover:text-foreground hover:border-border/60"
                      >
                        Xóa lọc
                      </button>
                    ) : null}
                  </div>

                  {categoryError ? (
                    <p className="text-xs text-destructive/80 font-medium bg-red-50 rounded-lg px-2.5 py-2 border border-red-200">
                      ⚠️ {categoryError}
                    </p>
                  ) : null}

                  {!categoryError && (
                    <div className="flex flex-wrap gap-2">
                      {categoryOptions.map((category) => (
                        <button
                          key={category.id}
                          type="button"
                          onClick={() => toggleCategory(category.id)}
                          className={cn(
                            "rounded-full border px-3 py-2 text-xs font-medium transition-all",
                            selectedCategorySet.has(category.id)
                              ? "border-primary bg-primary/15 text-primary shadow-sm"
                              : "border-border/40 bg-card/50 text-muted-foreground hover:bg-card hover:border-border/60 hover:text-foreground",
                          )}
                        >
                          {category.name}
                        </button>
                      ))}
                    </div>
                  )}

                  <div className="mt-4 grid grid-cols-3 gap-2 rounded-lg border border-border/40 bg-background/50 p-3">
                    <div className="text-center">
                      <p className="text-[10px] font-medium text-muted-foreground uppercase">Tổng</p>
                      <p className="mt-1 text-lg font-bold text-foreground">{records.length}</p>
                    </div>
                    <div className="text-center border-l border-r border-border/40">
                      <p className="text-[10px] font-medium text-emerald-700 uppercase">Địa Điểm</p>
                      <p className="mt-1 text-lg font-bold text-emerald-600">{placeRecords.length}</p>
                    </div>
                    <div className="text-center">
                      <p className="text-[10px] font-medium text-destructive uppercase">Sự Kiện</p>
                      <p className="mt-1 text-lg font-bold text-destructive">{eventRecords.length}</p>
                    </div>
                  </div>
                </div>

                {/* Search Results Section */}
                <div className="rounded-2xl border border-border/40 bg-linear-to-br from-card/80 to-card/40 p-4 shadow-sm hover:border-border/60 transition-colors">
                  <div className="flex items-center justify-between gap-2 mb-3">
                    <div className="flex items-center gap-2">
                      <svg
                        viewBox="0 0 24 24"
                        fill="none"
                        className="size-4 text-primary shrink-0"
                        aria-hidden="true"
                      >
                        <path
                          d="M9 20c-4.97 0-9-4.03-9-9s4.03-9 9-9 9 4.03 9 9-4.03 9-9 9zm6-2l4 4"
                          stroke="currentColor"
                          strokeWidth="1.8"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                        Kết Quả Trên Bản Đồ
                      </p>
                    </div>
                  </div>

                  <div className="flex max-h-96 flex-col gap-2 overflow-y-auto pr-1">
                    {records.map((record) => {
                      const coverImage = record.image_urls[0];
                      const isSelected = record.id === selectedRecordId;

                      return (
                        <div
                          key={record.id}
                          onClick={() => flyToRecord(record)}
                          onKeyDown={(event) => {
                            if (event.key === "Enter" || event.key === " ") {
                              event.preventDefault();
                              flyToRecord(record);
                            }
                          }}
                          role="button"
                          tabIndex={0}
                          className={cn(
                            "flex gap-3 rounded-lg border px-3 py-2.5 text-left transition-all cursor-pointer",
                            isSelected
                              ? "border-primary bg-primary/10 shadow-md"
                              : "border-border/40 bg-card/50 hover:bg-card/70 hover:border-border/60",
                          )}
                        >
                          <div className="relative mt-0.5 h-12 w-10 shrink-0 flex-col">
                            <div
                              className={cn(
                                "mx-auto flex h-9 w-9 items-center justify-center overflow-hidden rounded-full border-2 border-white shadow-md",
                                record.record_kind === "event"
                                  ? "bg-destructive"
                                  : "bg-emerald-500",
                              )}
                            >
                              {coverImage ? (
                                <Image
                                  src={coverImage}
                                  alt={record.event_name}
                                  width={24}
                                  height={24}
                                  sizes="24px"
                                  className="h-6 w-6 rounded-full object-cover"
                                />
                              ) : (
                                <span className="text-[9px] font-bold text-white">
                                  {record.record_kind === "event" ? "EV" : "PL"}
                                </span>
                              )}
                            </div>
                            <div
                              className={cn(
                                "absolute left-1/2 top-7 h-2.5 w-2.5 -translate-x-1/2 rotate-45 rounded-sm border-r border-b border-white shadow-sm",
                                record.record_kind === "event"
                                  ? "bg-destructive"
                                  : "bg-emerald-500",
                              )}
                            />
                          </div>

                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-semibold text-foreground">
                              {record.event_name || "Sự kiện / địa điểm"}
                            </p>
                            <p className="mt-0.5 text-[11px] text-muted-foreground font-medium">
                              {record.record_kind === "event" ? "📌 Sự kiện" : "📍 Địa điểm"}
                              {record.event_type ? ` · ${record.event_type}` : ""}
                            </p>
                            {record.event_description ? (
                              <p className="mt-1 line-clamp-2 text-[11px] text-muted-foreground">
                                {record.event_description}
                              </p>
                            ) : null}

                            <div className="mt-2 flex gap-1.5">
                              <a
                                href={`/events/${record.id}`}
                                onClick={(event) => {
                                  event.stopPropagation();
                                }}
                                className="inline-flex h-7 items-center justify-center rounded-lg border border-border/50 bg-background/50 px-2 text-[10px] font-semibold text-foreground transition-all hover:bg-accent hover:border-accent/50 hover:text-accent-foreground"
                              >
                                Xem
                              </a>
                              <button
                                type="button"
                                onClick={(event) => {
                                  event.stopPropagation();
                                  openDirections(record);
                                }}
                                className="inline-flex h-7 items-center justify-center rounded-lg bg-primary px-2 text-[10px] font-semibold text-primary-foreground transition-all hover:bg-primary/90 shadow-sm hover:shadow-md"
                              >
                                Chỉ đường
                              </button>
                            </div>
                          </div>
                        </div>
                      );
                    })}

                    {!isLoadingRecords && records.length === 0 ? (
                      <p className="px-2 py-4 text-xs text-muted-foreground italic text-center">
                        📭 Không có kết quả phù hợp.
                      </p>
                    ) : null}
                  </div>
                </div>
              </div>
              ) : (
                <div className="flex min-h-0 flex-1 flex-col p-4 pb-5">
                  {chatError ? (
                    <p className="mb-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs font-medium text-destructive/80">
                      {chatError}
                    </p>
                  ) : null}

                  {isChatLoading ? (
                    <p className="mb-3 text-xs text-muted-foreground">Đang tải lịch sử chat...</p>
                  ) : null}

                  <div
                    ref={chatScrollRef}
                    className="min-h-0 flex-1 space-y-3 overflow-y-auto rounded-2xl border border-border/40 bg-card/50 p-3"
                  >
                    {chatMessages.length === 0 ? (
                      <div className="rounded-xl border border-emerald-200 bg-emerald-50/70 px-3 py-3 text-xs text-emerald-900">
                        Bắt đầu cuộc trò chuyện mới. AI chỉ trả lời dựa trên dữ liệu sự kiện và lộ trình cá nhân trong hệ thống.
                      </div>
                    ) : null}

                    {chatMessages.map((message) => (
                      <div
                        key={message.id}
                        className={cn(
                          "max-w-[92%] rounded-xl px-3 py-2 text-xs leading-relaxed",
                          message.role === "user"
                            ? "ml-auto bg-primary text-primary-foreground"
                            : "mr-auto border border-border/40 bg-background",
                        )}
                      >
                        <p className="whitespace-pre-wrap">{message.content}</p>

                        {message.role === "assistant" && message.attachments.length > 0 ? (
                          <div className="mt-2 flex flex-wrap gap-1.5">
                            {message.attachments.map((attachment) => (
                              <button
                                key={`${message.id}-${attachment.source}-${attachment.id}`}
                                type="button"
                                onClick={() => {
                                  focusAttachmentOnMap(attachment);
                                }}
                                className="inline-flex h-7 items-center rounded-full border border-emerald-300 bg-emerald-50 px-2.5 text-[10px] font-semibold text-emerald-700 transition-colors hover:bg-emerald-100"
                                title="Xem trên bản đồ"
                              >
                                {attachment.label}
                              </button>
                            ))}
                          </div>
                        ) : null}
                      </div>
                    ))}

                    {isChatSending ? (
                      <p className="text-xs text-muted-foreground">AI đang trả lời...</p>
                    ) : null}
                  </div>

                  <div className="mt-3 flex items-end gap-2">
                    <textarea
                      value={chatPrompt}
                      onChange={(event) => {
                        setChatPrompt(event.target.value);
                        setChatError(null);
                      }}
                      onKeyDown={(event) => {
                        if (event.key === "Enter" && !event.shiftKey) {
                          event.preventDefault();
                          void sendChatPrompt();
                        }
                      }}
                      placeholder="Nhập câu hỏi về dữ liệu bản đồ và lộ trình cá nhân..."
                      className="max-h-32 min-h-10 flex-1 resize-y rounded-xl border border-border/50 bg-background/70 px-3 py-2 text-sm outline-none transition-colors focus:border-emerald-400"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        void sendChatPrompt();
                      }}
                      disabled={isChatSending}
                      className="inline-flex h-10 items-center justify-center rounded-xl bg-emerald-600 px-3 text-xs font-semibold text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      Gửi
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </aside>
      </div>

      <Dialog
        open={isInsertDialogOpen}
        onOpenChange={(open) => {
          setIsInsertDialogOpen(open);
          if (!open) {
            setPendingRouteStop(null);
          }
        }}
      >
        <DialogContent showCloseButton>
          <DialogHeader>
            <DialogTitle>Chèn địa điểm vào tuyến</DialogTitle>
            <DialogDescription>
              Chọn vị trí để thêm {pendingRouteStop?.label || "địa điểm mới"} vào danh sách chỉ đường.
            </DialogDescription>
          </DialogHeader>

          <div className="flex flex-col gap-2">
            {routeInsertOptions.map((option) => (
              <button
                key={`${option.previousLabel}-${option.nextLabel ?? "end"}`}
                type="button"
                onClick={() => insertRouteStop(option.index)}
                className="rounded-2xl border border-border bg-card px-3 py-3 text-left text-sm text-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
              >
                {option.nextLabel
                  ? `${option.previousLabel} → ${pendingRouteStop?.label} → ${option.nextLabel}`
                  : `${option.previousLabel} → ${pendingRouteStop?.label}`}
              </button>
            ))}
          </div>
        </DialogContent>
      </Dialog>

      <Dialog
        open={isSaveRouteDialogOpen}
        onOpenChange={(open) => {
          setIsSaveRouteDialogOpen(open);
          if (!open) {
            setSaveRouteError(null);
          }
        }}
      >
        <DialogContent showCloseButton>
          <DialogHeader>
              <DialogTitle>
                {loadedRoute && !isRouteOwnedByCurrentUser
                  ? "Sao chép lộ trình"
                  : isEditingOwnedRoute
                    ? "Cập nhật lộ trình"
                    : "Lưu lộ trình"}
              </DialogTitle>
            <DialogDescription>
                {loadedRoute && !isRouteOwnedByCurrentUser
                  ? `Bạn sắp tạo một bản sao của lộ trình "${loadedRoute.title}". Đặt tên mới cho bản sao của bạn.`
                  : isEditingOwnedRoute
                    ? "Cập nhật thông tin lộ trình hiện tại của bạn."
                    : "Chọn tên lộ trình, ngày bắt đầu và chế độ riêng tư."}
            </DialogDescription>
          </DialogHeader>

          <div className="flex flex-col gap-3">
            <div className="space-y-1">
                <p className="text-xs text-muted-foreground">Tên lộ trình</p>
                <Input
                  type="text"
                  value={routeName}
                  onChange={(event) => {
                    setRouteName(event.target.value);
                  }}
                  placeholder="Ví dụ: Hà Nội cuối tuần"
                />
              </div>

              {(!loadedRoute || isRouteOwnedByCurrentUser) ? (
                <>
                  <div className="space-y-1">
                    <p className="text-xs text-muted-foreground">Ngày bắt đầu</p>
                  <Input
                    type="date"
                    value={routeStartDate}
                    onChange={(event) => {
                      setRouteStartDate(event.target.value);
                    }}
                  />
                </div>

                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground">Chế độ hiển thị</p>
                  <select
                    value={routeVisibility}
                    onChange={(event) => {
                      setRouteVisibility(event.target.value as RouteVisibility);
                    }}
                    className="h-9 rounded-xl border border-input bg-input/30 px-3 text-sm"
                  >
                    <option value="public">Công khai</option>
                    <option value="friends">Bạn bè</option>
                    <option value="private">Chỉ mình tôi</option>
                  </select>
                </div>
                </>
              ) : null}

            <button
              type="button"
              onClick={() => {
                void handleSaveRoute();
              }}
              disabled={isSavingRoute}
              className="inline-flex h-9 items-center justify-center rounded-xl bg-primary px-3 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-65"
            >
              {isSavingRoute 
                ? "Đang lưu..." 
                : (loadedRoute && !isRouteOwnedByCurrentUser
                  ? "Sao chép"
                  : isEditingOwnedRoute
                    ? "Cập nhật"
                    : "Lưu lộ trình")}
            </button>
          </div>
        </DialogContent>
      </Dialog>
    </section>
  );
}

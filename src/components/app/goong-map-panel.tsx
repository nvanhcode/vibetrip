"use client";

import Image from "next/image";
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
import type { EventRecordKind } from "@/models/event.model";

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

type RadiusMode = "none" | "my-location" | "navigation-address";
type RouteVisibility = "public" | "friends" | "private";

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

export function GoongMapPanel() {
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<MaplibreMap | null>(null);
  const userMarkerRef = useRef<maplibregl.Marker | null>(null);
  const selectedPlaceMarkerRef = useRef<maplibregl.Marker | null>(null);
  const watchIdRef = useRef<number | null>(null);
  const hasCenteredRef = useRef<boolean>(false);
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

  const [isNavOpen, setIsNavOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [predictions, setPredictions] = useState<GoongPrediction[]>([]);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [isOffCenter, setIsOffCenter] = useState(false);
  const [locationMessage, setLocationMessage] = useState<string | null>(
    "Đang yêu cầu quyền vị trí...",
  );
  const [selectedPlaceLabel, setSelectedPlaceLabel] = useState("");
  const [selectedPlacePosition, setSelectedPlacePosition] = useState<[
    number,
    number,
  ] | null>(null);
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
  const [selectedRecordId, setSelectedRecordId] = useState<string | null>(null);
  const [mapZoom, setMapZoom] = useState(DEFAULT_ZOOM);
  const [routeDestinations, setRouteDestinations] = useState<RouteStop[]>([]);
  const [routeLegs, setRouteLegs] = useState<RouteLegSummary[]>([]);
  const [routeSummary, setRouteSummary] = useState<string | null>(null);
  const [routeError, setRouteError] = useState<string | null>(null);
  const [isRouting, setIsRouting] = useState(false);
  const [pendingRouteStop, setPendingRouteStop] = useState<RouteStop | null>(null);
  const [isInsertDialogOpen, setIsInsertDialogOpen] = useState(false);
  const [isSaveRouteDialogOpen, setIsSaveRouteDialogOpen] = useState(false);
  const [routeName, setRouteName] = useState("");
  const [routeStartDate, setRouteStartDate] = useState(getTodayDateInputValue);
  const [routeVisibility, setRouteVisibility] = useState<RouteVisibility>("private");
  const [isSavingRoute, setIsSavingRoute] = useState(false);
  const [saveRouteError, setSaveRouteError] = useState<string | null>(null);
  const [saveRouteSuccess, setSaveRouteSuccess] = useState<string | null>(null);

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

  useEffect(() => {
    recordsRef.current = records;
  }, [records]);

  const clearDirectionRoute = useCallback(() => {
    const map = mapRef.current;
    if (!map) {
      return;
    }

    const style = map.getStyle();

    style.layers
      ?.filter((layer) => layer.id.startsWith(DIRECTION_ROUTE_LAYER_PREFIX))
      .forEach((layer) => {
        if (map.getLayer(layer.id)) {
          map.removeLayer(layer.id);
        }
      });

    Object.keys(style.sources)
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
      if (!map || segments.length === 0) {
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

  const openSaveRouteDialog = useCallback(() => {
    if (routeStops.length < 2) {
      setRouteError("Cần có điểm bắt đầu và ít nhất 1 điểm đến để lưu lộ trình.");
      return;
    }

    setRouteName(getSuggestedRouteName(routeStops));
    setSaveRouteError(null);
    setSaveRouteSuccess(null);
    setRouteError(null);
    setIsSaveRouteDialogOpen(true);
  }, [routeStops]);

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

    setIsSavingRoute(true);
    setSaveRouteError(null);
    setSaveRouteSuccess(null);

    try {
      const response = await fetch("/api/routes", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
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
        setSaveRouteError(data.error ?? "Không thể lưu lộ trình lúc này.");
        return;
      }

      setIsSaveRouteDialogOpen(false);
      setSaveRouteSuccess("Đã lưu lộ trình thành công.");
    } catch {
      setSaveRouteError("Lỗi mạng khi lưu lộ trình.");
    } finally {
      setIsSavingRoute(false);
    }
  }, [routeName, routeStartDate, routeStops, routeSummary, routeVisibility]);

  const openDirections = useCallback(
    (record: MapRecord) => {
      setIsNavOpen(true);

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
    [routeDestinations, routeOrigin],
  );

  useEffect(() => {
    if (routeStops.length < 2) {
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
  }, [clearDirectionRoute, drawDirectionRoute, fetchDirectionRoute, routeStops]);

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
      center: DEFAULT_CENTER,
      zoom: DEFAULT_ZOOM,
      attributionControl: false,
    });

    map.addControl(new maplibregl.NavigationControl(), "bottom-left");

    map.on("load", () => {
      setLocationMessage(null);
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
  }, [clearDirectionRoute, flyToRecord, styleUrl]);

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

      if (!hasCenteredRef.current) {
        mapRef.current?.easeTo({
          center: lngLat,
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
  }, [styleUrl]);

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
            "shrink-0 border-t border-border bg-background/95 transition-[height] duration-300 md:border-l md:border-t-0 md:transition-[width]",
            isNavOpen ? "h-[calc(100dvh-5.5rem)] md:w-82" : "h-14 md:w-14",
          )}
        >
          {!isNavOpen ? (
            <div className="flex h-full flex-row items-center gap-2 px-3 py-2 md:flex-col md:px-0 md:py-3">
              <button
                type="button"
                onClick={() => setIsNavOpen(true)}
                className="inline-flex size-10 items-center justify-center rounded-2xl border border-border bg-card text-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
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

              <div className="hidden rounded-xl border border-border bg-card px-2 py-1 text-[10px] text-muted-foreground md:block">
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
                  className="inline-flex size-10 items-center justify-center rounded-2xl border border-border bg-card text-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
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
              <div className="flex items-center gap-2 border-b border-border px-2 py-2.5 md:border-b">
                <button
                  type="button"
                  onClick={() => setIsNavOpen(false)}
                  className="inline-flex size-8 items-center justify-center rounded-xl border border-border bg-card text-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
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
                <p className="text-sm font-semibold text-foreground flex-1">
                  Bản đồ & bộ lọc
                </p>

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
                    className="inline-flex size-8 items-center justify-center rounded-xl border border-border bg-card text-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
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
              </div>

              <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-auto p-2">
                <div className="rounded-2xl border border-border bg-card/80 p-2">
                  <p className="px-1 text-[11px] font-medium text-muted-foreground">
                    Điều hướng địa chỉ
                  </p>
                  <Input
                    value={search}
                    onChange={(event) => {
                      setSearch(event.target.value);
                      setSearchError(null);
                    }}
                    placeholder="Tìm địa chỉ..."
                    className="mt-1 h-9 rounded-xl"
                  />

                  {isSearching ? (
                    <p className="mt-1 px-1 text-xs text-muted-foreground">
                      Đang tìm...
                    </p>
                  ) : null}

                  {searchError ? (
                    <p className="mt-1 px-1 text-xs text-destructive">{searchError}</p>
                  ) : null}

                  <div className="mt-2 max-h-34 overflow-y-auto">
                    <div className="flex flex-col gap-1">
                      {visiblePredictions.map((prediction) => (
                        <button
                          key={prediction.place_id ?? prediction.description}
                          type="button"
                          onClick={() => {
                            void handleSelectPrediction(prediction);
                          }}
                          className="rounded-xl border border-border bg-card px-2 py-2 text-left text-xs text-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
                        >
                          {prediction.description ?? "Địa điểm không tên"}
                        </button>
                      ))}

                      {!isSearching &&
                      !searchError &&
                      trimmedSearch.length >= 2 &&
                      visiblePredictions.length === 0 ? (
                        <p className="px-1 text-xs text-muted-foreground">
                          Không có gợi ý phù hợp.
                        </p>
                      ) : null}
                    </div>
                  </div>

                  {selectedPlacePosition ? (
                    <p className="mt-2 px-1 text-[11px] text-muted-foreground">
                      Điểm đi hiện tại: {selectedPlaceLabel || "Địa chỉ đã chọn"}
                    </p>
                  ) : myPosition ? (
                    <p className="mt-2 px-1 text-[11px] text-muted-foreground">
                      Điểm đi hiện tại: vị trí của bạn
                    </p>
                  ) : null}
                </div>

                {isLoadingRecords ? (
                  <p className="px-1 text-xs text-muted-foreground">
                    Đang tải dữ liệu trong phạm vi map...
                  </p>
                ) : null}

                {isRouting ? (
                  <p className="px-1 text-xs text-muted-foreground">
                    Đang tính toán tuyến đường Goong...
                  </p>
                ) : null}

                {displayRouteSummary ? (
                  <p className="px-1 text-xs text-foreground">{displayRouteSummary}</p>
                ) : null}

                {routeError ? (
                  <p className="px-1 text-xs text-destructive">{routeError}</p>
                ) : null}

                {saveRouteError ? (
                  <p className="px-1 text-xs text-destructive">{saveRouteError}</p>
                ) : null}

                {saveRouteSuccess ? (
                  <p className="px-1 text-xs text-emerald-700">{saveRouteSuccess}</p>
                ) : null}

                {recordsError ? (
                  <p className="px-1 text-xs text-destructive">{recordsError}</p>
                ) : null}

                <div className="rounded-2xl border border-border bg-card/80 p-2">
                  <div className="flex items-center justify-between gap-2 px-1">
                    <p className="text-[11px] font-medium text-muted-foreground">
                        Lộ trình cá nhân
                    </p>
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={openSaveRouteDialog}
                        disabled={routeStops.length < 2 || isSavingRoute}
                        className="rounded-lg border border-border px-2 py-0.5 text-[10px] text-foreground transition-colors hover:bg-accent hover:text-accent-foreground disabled:cursor-not-allowed disabled:opacity-60"
                      >
                          Lưu lộ trình
                      </button>

                      {routeDestinations.length > 0 ? (
                        <button
                          type="button"
                          onClick={clearRouteStops}
                          className="rounded-lg border border-border px-2 py-0.5 text-[10px] text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
                        >
                            Xóa hết
                        </button>
                      ) : null}
                    </div>
                  </div>

                  <div className="mt-2 flex flex-col gap-2 px-1">
                    {routeOrigin ? (
                      <div className="rounded-xl border border-border bg-background/70 px-2 py-2 text-xs text-foreground">
                        <span className="mr-2 inline-flex size-5 items-center justify-center rounded-full bg-slate-900 text-[10px] font-semibold text-white">
                          A
                        </span>
                        {routeOrigin.label}
                      </div>
                    ) : (
                      <p className="text-xs text-muted-foreground">
                        Chưa có điểm bắt đầu. Hãy chọn địa chỉ hoặc bật vị trí hiện tại.
                      </p>
                    )}

                    {routeDestinations.map((stop, index) => (
                      <div
                        key={stop.id}
                        className="flex items-center gap-2 rounded-xl border border-border bg-background/70 px-2 py-2 text-xs text-foreground"
                      >
                        <span className="inline-flex size-5 items-center justify-center rounded-full bg-primary text-[10px] font-semibold text-primary-foreground">
                          {index + 1}
                        </span>
                        <span className="min-w-0 flex-1 truncate">{stop.label}</span>
                        <button
                          type="button"
                          onClick={() => {
                            if (stop.recordId) {
                              removeRouteStop(stop.recordId);
                            }
                          }}
                          className="rounded-md border border-border px-1.5 py-0.5 text-[10px] text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
                        >
                          Xóa
                        </button>
                      </div>
                    ))}

                    {routeOrigin && routeDestinations.length === 0 ? (
                      <p className="text-xs text-muted-foreground">
                        Chọn địa điểm đầu tiên để bắt đầu tuyến nhiều điểm.
                      </p>
                    ) : null}
                  </div>

                  {routeLegs.length > 0 ? (
                    <div className="mt-3 flex flex-col gap-2 px-1">
                      {routeLegs.map((leg, index) => (
                        <div
                          key={leg.id}
                          className="rounded-xl border border-border bg-background/70 px-2 py-2 text-xs text-foreground"
                        >
                          <div className="flex items-center gap-2">
                            <span
                              className="inline-flex size-3 rounded-full"
                              style={{ backgroundColor: leg.color }}
                              aria-hidden="true"
                            />
                            <span className="font-medium">
                              Chặng {index + 1}: {leg.fromLabel} → {leg.toLabel}
                            </span>
                          </div>
                          <p className="mt-1 text-[11px] text-muted-foreground">
                            {[leg.distance ?? null, leg.duration ?? null]
                              .filter(Boolean)
                              .join(" · ") || "Đã vẽ trên bản đồ"}
                          </p>
                        </div>
                      ))}
                    </div>
                  ) : null}
                </div>

                <div className="rounded-2xl border border-border bg-card/80 p-2">
                  <p className="px-1 text-[11px] font-medium text-muted-foreground">
                    Tìm sự kiện / địa điểm
                  </p>
                  <Input
                    value={recordKeyword}
                    onChange={(event) => {
                      setRecordKeyword(event.target.value);
                    }}
                    placeholder="Tên, loại, mô tả..."
                    className="mt-1 h-9 rounded-xl"
                  />

                  <div className="mt-2 flex items-center gap-2 px-1">
                    <label className="text-xs text-muted-foreground" htmlFor="radius-mode">
                      Phạm vi
                    </label>
                    <select
                      id="radius-mode"
                      value={radiusMode}
                      onChange={(event) => {
                        setRadiusMode(event.target.value as RadiusMode);
                      }}
                      className="h-8 flex-1 rounded-xl border border-input bg-input/30 px-2 text-xs"
                    >
                      <option value="none">Không giới hạn</option>
                      <option value="my-location">Quanh vị trí của tôi</option>
                      <option value="navigation-address">Quanh địa chỉ điều hướng</option>
                    </select>
                  </div>

                  {radiusMode !== "none" ? (
                    <div className="mt-2 flex items-center gap-2 px-1">
                      <Input
                        value={radiusKm}
                        onChange={(event) => {
                          setRadiusKm(event.target.value);
                        }}
                        inputMode="decimal"
                        placeholder="5"
                        className="h-8 rounded-xl text-xs"
                      />
                      <span className="text-xs text-muted-foreground">km</span>
                    </div>
                  ) : null}

                  {!canApplyRadiusFilter ? (
                    <p className="mt-2 px-1 text-xs text-amber-700">
                      Chưa có tâm lọc hợp lệ. Hãy bật vị trí hiện tại hoặc chọn địa chỉ điều hướng.
                    </p>
                  ) : null}
                </div>

                <div className="rounded-2xl border border-border bg-card/80 p-2">
                  <div className="flex items-center justify-between px-1">
                    <p className="text-[11px] font-medium text-muted-foreground">
                      Danh mục
                    </p>
                    {selectedCategoryIds.length > 0 ? (
                      <button
                        type="button"
                        onClick={() => setSelectedCategoryIds([])}
                        className="rounded-lg border border-border px-2 py-0.5 text-[10px] text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
                      >
                        Xóa lọc
                      </button>
                    ) : null}
                  </div>

                  {categoryError ? (
                    <p className="mt-2 px-1 text-xs text-destructive">{categoryError}</p>
                  ) : null}

                  <div className="mt-2 max-h-30 overflow-y-auto">
                    <div className="flex flex-wrap gap-1">
                      {categoryOptions.map((category) => (
                        <button
                          key={category.id}
                          type="button"
                          onClick={() => toggleCategory(category.id)}
                          className={cn(
                            "rounded-full border px-2.5 py-1 text-[11px] transition-colors",
                            selectedCategorySet.has(category.id)
                              ? "border-primary bg-primary/15 text-primary"
                              : "border-border bg-card text-muted-foreground hover:bg-accent hover:text-accent-foreground",
                          )}
                        >
                          {category.name}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="mt-3 space-y-1 rounded-xl border border-border bg-background/70 px-2 py-2 text-xs">
                    <div className="flex items-center justify-between text-muted-foreground">
                      <span>Tổng bản ghi</span>
                      <span className="font-semibold text-foreground">{records.length}</span>
                    </div>
                    <div className="flex items-center justify-between text-muted-foreground">
                      <span>Địa điểm</span>
                      <span className="font-semibold text-emerald-600">{placeRecords.length}</span>
                    </div>
                    <div className="flex items-center justify-between text-muted-foreground">
                      <span>Sự kiện</span>
                      <span className="font-semibold text-destructive">{eventRecords.length}</span>
                    </div>
                  </div>
                </div>

                <div className="rounded-2xl border border-border bg-card/80 p-2">
                  <div className="flex items-center justify-between px-1">
                    <p className="text-[11px] font-medium text-muted-foreground">
                      Kết quả trong khung map
                    </p>
                    <span className="text-[10px] text-muted-foreground">Click để định vị</span>
                  </div>

                  <div className="mt-2 pr-1">
                    <div className="flex flex-col gap-2">
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
                              "flex items-start gap-3 rounded-2xl border px-2 py-2 text-left transition-colors",
                              isSelected
                                ? "border-primary bg-primary/8"
                                : "border-border bg-background/75 hover:bg-accent hover:text-accent-foreground",
                            )}
                          >
                            <div className="relative mt-0.5 h-12 w-10 shrink-0">
                              <div
                                className={cn(
                                  "mx-auto flex h-9 w-9 items-center justify-center overflow-hidden rounded-full border-2 border-white shadow-sm",
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
                                  <span className="text-[9px] font-semibold text-white">
                                    {record.record_kind === "event" ? "EV" : "PL"}
                                  </span>
                                )}
                              </div>
                              <div
                                className={cn(
                                  "absolute left-1/2 top-7 h-3 w-3 -translate-x-1/2 rotate-45 rounded-[0.3rem] border-r-2 border-b-2 border-white",
                                  record.record_kind === "event"
                                    ? "bg-destructive"
                                    : "bg-emerald-500",
                                )}
                              />
                            </div>

                            <div className="min-w-0 flex-1">
                              <p className="truncate text-xs font-semibold text-foreground">
                                {record.event_name || "Sự kiện / địa điểm"}
                              </p>
                              <p className="mt-0.5 text-[11px] text-muted-foreground">
                                {record.record_kind === "event" ? "Sự kiện" : "Địa điểm"}
                                {record.event_type ? ` · ${record.event_type}` : ""}
                              </p>
                              {record.event_description ? (
                                <p className="mt-1 line-clamp-2 text-[11px] text-muted-foreground">
                                  {record.event_description}
                                </p>
                              ) : null}
                              {record.categories.length > 0 ? (
                                <p className="mt-1 line-clamp-2 text-[11px] text-muted-foreground">
                                  {record.categories.map((category) => category.name).join(", ")}
                                </p>
                              ) : null}

                              <div className="mt-2 flex gap-2">
                                <a
                                  href={`/events/${record.id}`}
                                  onClick={(event) => {
                                    event.stopPropagation();
                                  }}
                                  className="inline-flex h-7 items-center justify-center rounded-lg border border-border px-2.5 text-[11px] font-medium text-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
                                >
                                  Xem chi tiết
                                </a>
                                <button
                                  type="button"
                                  onClick={(event) => {
                                    event.stopPropagation();
                                    openDirections(record);
                                  }}
                                  className="inline-flex h-7 items-center justify-center rounded-lg bg-primary px-2.5 text-[11px] font-medium text-primary-foreground transition-opacity hover:opacity-90"
                                >
                                  Chỉ đường
                                </button>
                              </div>
                            </div>
                          </div>
                        );
                      })}

                      {!isLoadingRecords && records.length === 0 ? (
                        <p className="px-1 py-2 text-xs text-muted-foreground">
                          Không có kết quả phù hợp trong khung map hiện tại.
                        </p>
                      ) : null}
                    </div>
                  </div>
                </div>
              </div>
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
              <DialogTitle>Lưu lộ trình</DialogTitle>
            <DialogDescription>
                Chọn tên lộ trình, ngày bắt đầu và chế độ riêng tư.
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

            <button
              type="button"
              onClick={() => {
                void handleSaveRoute();
              }}
              disabled={isSavingRoute}
              className="inline-flex h-9 items-center justify-center rounded-xl bg-primary px-3 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-65"
            >
              {isSavingRoute ? "Đang lưu..." : "Lưu lộ trình"}
            </button>
          </div>
        </DialogContent>
      </Dialog>
    </section>
  );
}

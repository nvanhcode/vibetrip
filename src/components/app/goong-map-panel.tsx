"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import maplibregl, { type LngLatLike, type Map } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

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

const DEFAULT_CENTER: LngLatLike = [105.83416, 21.027764];
const DEFAULT_ZOOM = 15;

export function GoongMapPanel() {
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<Map | null>(null);
  const userMarkerRef = useRef<maplibregl.Marker | null>(null);
  const selectedPlaceMarkerRef = useRef<maplibregl.Marker | null>(null);
  const watchIdRef = useRef<number | null>(null);
  const hasCenteredRef = useRef<boolean>(false);
  const userPositionRef = useRef<[number, number] | null>(null);

  const [isNavOpen, setIsNavOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [predictions, setPredictions] = useState<GoongPrediction[]>([]);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [isOffCenter, setIsOffCenter] = useState(false);
  const [locationMessage, setLocationMessage] = useState<string | null>(
    "Đang yêu cầu quyền vị trí...",
  );

  const styleUrl = useMemo(() => {
    const mapKey = process.env.NEXT_PUBLIC_GOONG_MAP_KEY;
    if (!mapKey) {
      return null;
    }
    return `https://tiles.goong.io/assets/goong_map_highlight.json?api_key=${mapKey}`;
  }, []);

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
    });

    map.on("moveend", () => {
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
      map.remove();
      mapRef.current = null;
    };
  }, [styleUrl]);

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
      setIsOffCenter(false);
    };
  }, [styleUrl]);

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
            isNavOpen ? "h-40 md:w-50" : "h-14 md:w-14",
          )}
        >
          {!isNavOpen ? (
            <div className="flex h-full flex-row items-center gap-2 px-3 py-2 md:flex-col md:px-0 md:py-3">
              <button
                type="button"
                onClick={() => setIsNavOpen(true)}
                className="inline-flex size-10 items-center justify-center rounded-2xl border border-border bg-card text-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
                aria-label="Mở tab điều hướng"
                title="Điều hướng"
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
                  Điều hướng
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

              <div className="flex min-h-0 flex-1 flex-col gap-2 p-2">
                <Input
                  value={search}
                  onChange={(event) => {
                    setSearch(event.target.value);
                    setSearchError(null);
                  }}
                  placeholder="Tìm địa chỉ..."
                  className="h-9 rounded-xl"
                />

                {isSearching ? (
                  <p className="px-1 text-xs text-muted-foreground">
                    Đang tìm...
                  </p>
                ) : null}

                {searchError ? (
                  <p className="px-1 text-xs text-destructive">{searchError}</p>
                ) : null}

                <div className="min-h-0 flex-1 overflow-y-auto">
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
              </div>
            </div>
          )}
        </aside>
      </div>
    </section>
  );
}

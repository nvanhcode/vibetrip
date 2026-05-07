"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { FormSubmitButton } from "@/components/app/form-submit-button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

type CategoryOption = {
  id: string;
  name: string;
};

type OrganizerOption = {
  id: string;
  name: string;
  province_code: string | null;
  ward_code: string | null;
};

type ProvinceOption = {
  code: string;
  name: string;
};

type WardOption = {
  code: string;
  province_code: string;
  name: string;
};

type GoongPrediction = {
  description?: string;
  place_id?: string;
};

type GoongAutocompleteResponse = {
  predictions?: GoongPrediction[];
  error?: string;
};

type GoongPlaceDetailResponse = {
  result?: {
    name?: string;
    formatted_address?: string;
    geometry?: {
      location?: {
        lat?: number;
        lng?: number;
      };
    };
  };
  error?: string;
};

type EventsComposerProps = {
  provinces: ProvinceOption[];
  wards: WardOption[];
  categories: CategoryOption[];
  organizers: OrganizerOption[];
  createAction: (formData: FormData) => void | Promise<void>;
};

type ScheduleSlot = {
  id: string;
  mode: "date" | "weekday";
  organizedAt: string;
  weekday: string;
  opensAt: string;
  closesAt: string;
};

function createScheduleSlot(id: string): ScheduleSlot {
  return {
    id,
    mode: "date",
    organizedAt: "",
    weekday: "",
    opensAt: "",
    closesAt: "",
  };
}

function addOneDayLocalDateTime(value: string) {
  if (!value) return "";

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return value;
  }

  parsed.setDate(parsed.getDate() + 1);

  const year = parsed.getFullYear();
  const month = String(parsed.getMonth() + 1).padStart(2, "0");
  const day = String(parsed.getDate()).padStart(2, "0");
  const hours = String(parsed.getHours()).padStart(2, "0");
  const minutes = String(parsed.getMinutes()).padStart(2, "0");

  return `${year}-${month}-${day}T${hours}:${minutes}`;
}

export function EventsComposer({
  provinces,
  wards,
  categories,
  organizers,
  createAction,
}: EventsComposerProps) {
  const imageInputRef = useRef<HTMLInputElement | null>(null);
  const [provinceCode, setProvinceCode] = useState("");
  const [selectedCategoryIds, setSelectedCategoryIds] = useState<string[]>([]);
  const [selectedOrganizerIds, setSelectedOrganizerIds] = useState<string[]>([]);
  const [placeQuery, setPlaceQuery] = useState("");
  const [predictions, setPredictions] = useState<GoongPrediction[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [placeError, setPlaceError] = useState<string | null>(null);
  const [selectedPlaceId, setSelectedPlaceId] = useState("");
  const [selectedPlaceLabel, setSelectedPlaceLabel] = useState("");
  const [selectedLatitude, setSelectedLatitude] = useState("");
  const [selectedLongitude, setSelectedLongitude] = useState("");
  const [provinceSearch, setProvinceSearch] = useState("");
  const [wardSearch, setWardSearch] = useState("");
  const [wardCode, setWardCode] = useState("");
  const [scheduleSlots, setScheduleSlots] = useState<ScheduleSlot[]>(() => [createScheduleSlot("slot-0")]);
  const [eventImages, setEventImages] = useState<File[]>([]);
  const [isDraggingImages, setIsDraggingImages] = useState(false);

  const filteredProvinces = useMemo(() => {
    const query = provinceSearch.trim().toLowerCase();
    if (!query) return provinces;
    return provinces.filter(
      (province) =>
        province.name.toLowerCase().includes(query) ||
        province.code.toLowerCase().includes(query),
    );
  }, [provinceSearch, provinces]);

  const selectedProvince = useMemo(
    () => provinces.find((province) => province.code === provinceCode) ?? null,
    [provinceCode, provinces],
  );

  const wardOptions = useMemo(() => {
    if (!provinceCode) return [];
    const query = wardSearch.trim().toLowerCase();
    const scopedWards = wards.filter((ward) => ward.province_code === provinceCode);
    if (!query) return scopedWards;
    return scopedWards.filter(
      (ward) => ward.name.toLowerCase().includes(query) || ward.code.toLowerCase().includes(query),
    );
  }, [provinceCode, wardSearch, wards]);

  const filteredOrganizers = useMemo(() => {
    if (!provinceCode || !wardCode) return [];
    return organizers.filter(
      (org) => org.province_code === provinceCode && org.ward_code === wardCode,
    );
  }, [provinceCode, wardCode, organizers]);

  const selectedWard = useMemo(
    () => wards.find((ward) => ward.code === wardCode) ?? null,
    [wardCode, wards],
  );

  useEffect(() => {
    const query = placeQuery.trim();

    if (query.length < 2) {
      return;
    }

    const timeoutId = window.setTimeout(async () => {
      setIsSearching(true);
      setPlaceError(null);

      try {
        const response = await fetch(`/api/goong/autocomplete?input=${encodeURIComponent(query)}`, {
          method: "GET",
          cache: "no-store",
        });

        const data = (await response.json()) as GoongAutocompleteResponse;
        if (!response.ok) {
          setPlaceError(data.error ?? "Không thể tìm gợi ý địa điểm.");
          setPredictions([]);
          return;
        }

        setPredictions(Array.isArray(data.predictions) ? data.predictions : []);
      } catch {
        setPlaceError("Lỗi mạng khi tìm địa điểm.");
        setPredictions([]);
      } finally {
        setIsSearching(false);
      }
    }, 350);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [placeQuery]);

  function toggleValue(list: string[], value: string) {
    if (list.includes(value)) {
      return list.filter((item) => item !== value);
    }
    return [...list, value];
  }

  function addScheduleSlot() {
    setScheduleSlots((prev) => [...prev, createScheduleSlot(`slot-${crypto.randomUUID()}`)]);
  }

  function removeScheduleSlot(id: string) {
    setScheduleSlots((prev) => {
      if (prev.length <= 1) return prev;
      return prev.filter((slot) => slot.id !== id);
    });
  }

  function duplicateScheduleSlot(id: string) {
    setScheduleSlots((prev) => {
      const sourceSlot = prev.find((slot) => slot.id === id);
      if (!sourceSlot) return prev;

      const duplicatedSlot: ScheduleSlot = {
        id: `slot-${crypto.randomUUID()}`,
        mode: sourceSlot.mode,
        organizedAt: addOneDayLocalDateTime(sourceSlot.organizedAt),
        weekday: sourceSlot.weekday,
        opensAt: sourceSlot.opensAt,
        closesAt: sourceSlot.closesAt,
      };

      return [...prev, duplicatedSlot];
    });
  }

  function updateScheduleSlot(
    id: string,
    field: "mode" | "organizedAt" | "weekday" | "opensAt" | "closesAt",
    value: string,
  ) {
    setScheduleSlots((prev) =>
      prev.map((slot) => {
        if (slot.id !== id) return slot;

        if (field === "mode") {
          return {
            ...slot,
            mode: value as "date" | "weekday",
            organizedAt: value === "date" ? slot.organizedAt : "",
            weekday: value === "weekday" ? slot.weekday : "",
          };
        }

        return {
          ...slot,
          [field]: value,
        };
      }),
    );
  }

  function syncEventImages(files: File[]) {
    const validImageFiles = files.filter((file) => file.type.startsWith("image/"));
    const dataTransfer = new DataTransfer();

    validImageFiles.forEach((file) => {
      dataTransfer.items.add(file);
    });

    if (imageInputRef.current) {
      imageInputRef.current.files = dataTransfer.files;
    }

    setEventImages(validImageFiles);
  }

  function mergeEventImages(files: File[]) {
    const existing = new Set(eventImages.map((file) => `${file.name}-${file.size}-${file.lastModified}`));
    const merged = [...eventImages];

    files.forEach((file) => {
      const key = `${file.name}-${file.size}-${file.lastModified}`;
      if (!file.type.startsWith("image/") || existing.has(key)) {
        return;
      }

      existing.add(key);
      merged.push(file);
    });

    syncEventImages(merged);
  }

  function removeEventImage(index: number) {
    syncEventImages(eventImages.filter((_, currentIndex) => currentIndex !== index));
  }

  async function handleSelectPrediction(prediction: GoongPrediction) {
    if (!prediction.place_id) {
      return;
    }

    setSelectedPlaceId(prediction.place_id);
    setPlaceQuery(prediction.description ?? "");
    setPredictions([]);
    setPlaceError(null);
    setSelectedPlaceLabel(prediction.description ?? prediction.place_id);
    setSelectedLatitude("");
    setSelectedLongitude("");

    try {
      const response = await fetch(`/api/goong/place-detail?placeId=${encodeURIComponent(prediction.place_id)}`, {
        method: "GET",
        cache: "no-store",
      });

      const data = (await response.json()) as GoongPlaceDetailResponse;
      if (!response.ok) {
        setPlaceError(data.error ?? "Không thể lấy chi tiết địa điểm.");
        return;
      }

      const detailLabel = [data.result?.name, data.result?.formatted_address]
        .filter(Boolean)
        .join(" - ");

      if (detailLabel) {
        setSelectedPlaceLabel(detailLabel);
      }

      const latitude = data.result?.geometry?.location?.lat;
      const longitude = data.result?.geometry?.location?.lng;

      if (typeof latitude === "number" && typeof longitude === "number") {
        setSelectedLatitude(String(latitude));
        setSelectedLongitude(String(longitude));
      } else {
        setPlaceError("Thiếu tọa độ từ Goong Place Detail. Vui lòng chọn địa điểm khác.");
      }
    } catch {
      setPlaceError("Lỗi mạng khi lấy chi tiết địa điểm.");
    }
  }

  return (
    <form action={createAction} className="space-y-4">
      <div className="grid gap-3 md:grid-cols-2">
        <div>
          <label className="mb-1 block text-sm font-medium">Loại bản ghi</label>
          <select name="record_kind" className="h-9 w-full rounded-4xl border border-input bg-input/30 px-3 text-sm" defaultValue="event">
            <option value="event">Sự kiện</option>
            <option value="place">Địa điểm</option>
          </select>
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium">Tìm địa điểm Goong</label>
          <Input
            value={placeQuery}
            onChange={(event) => {
              const nextValue = event.target.value;
              setPlaceQuery(nextValue);
              if (nextValue.trim().length < 2) {
                setPredictions([]);
                setIsSearching(false);
              }
              if (selectedPlaceId) {
                setSelectedPlaceId("");
                setSelectedPlaceLabel("");
                setSelectedLatitude("");
                setSelectedLongitude("");
              }
            }}
            placeholder="Nhập tên địa điểm để tìm..."
            autoComplete="off"
          />
          {isSearching && <p className="mt-1 text-xs text-muted-foreground">Đang tìm kiếm...</p>}
          {placeError && <p className="mt-1 text-xs text-destructive">{placeError}</p>}

          {!selectedPlaceId && predictions.length > 0 && (
            <div className="mt-2 max-h-44 overflow-y-auto rounded-xl border border-border bg-background">
              {predictions.map((prediction) => (
                <button
                  key={prediction.place_id ?? prediction.description}
                  type="button"
                  className="block w-full border-b border-border px-3 py-2 text-left text-sm text-muted-foreground last:border-b-0 hover:bg-accent hover:text-accent-foreground"
                  onClick={() => {
                    void handleSelectPrediction(prediction);
                  }}
                >
                  {prediction.description ?? prediction.place_id ?? "Địa điểm không tên"}
                </button>
              ))}
            </div>
          )}

          <input name="goong_place_id" value={selectedPlaceId} readOnly hidden required />
          <input name="goong_latitude" value={selectedLatitude} readOnly hidden required />
          <input name="goong_longitude" value={selectedLongitude} readOnly hidden required />

          {selectedPlaceId && (
            <div className="mt-2 rounded-xl border border-border bg-muted/20 px-3 py-2">
              <p className="text-xs text-muted-foreground">Goong Place ID: {selectedPlaceId}</p>
              <p className="text-xs text-muted-foreground">{selectedPlaceLabel}</p>
              {selectedLatitude && selectedLongitude && (
                <p className="text-xs text-muted-foreground">
                  Tọa độ: {selectedLatitude}, {selectedLongitude}
                </p>
              )}
            </div>
          )}
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        <div>
          <label className="mb-1 block text-sm font-medium">Tỉnh</label>
          <input type="hidden" name="province_code" value={provinceCode} required />
          <Input
            value={provinceSearch}
            onChange={(event) => setProvinceSearch(event.target.value)}
            placeholder="Tìm tỉnh theo tên/mã..."
            className="mb-2"
          />
          <ScrollArea className="h-44 rounded-xl border border-input bg-input/10 p-1">
            <ul className="space-y-1">
              {filteredProvinces.length === 0 && (
                <li className="px-2 py-2 text-xs text-muted-foreground">Không tìm thấy tỉnh phù hợp.</li>
              )}
              {filteredProvinces.map((province) => {
                const active = province.code === provinceCode;
                return (
                  <li key={province.code}>
                    <button
                      type="button"
                      onClick={() => {
                        setProvinceCode(province.code);
                        setWardSearch("");
                        setWardCode("");
                        setSelectedOrganizerIds([]);
                      }}
                      className={cn(
                        "flex w-full items-center justify-between rounded-lg px-2 py-2 text-left text-sm transition-colors hover:bg-accent hover:text-accent-foreground",
                        active && "bg-primary/10 text-primary",
                      )}
                    >
                      <span className="truncate">{province.name}</span>
                      <span className="text-xs text-muted-foreground">{province.code}</span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </ScrollArea>
          {selectedProvince && (
            <p className="mt-2 text-xs text-muted-foreground">
              Đã chọn: <span className="font-medium text-foreground">{selectedProvince.name}</span>
            </p>
          )}
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium">Xã</label>
          <input type="hidden" name="ward_code" value={wardCode} required />
          <Input
            value={wardSearch}
            onChange={(event) => setWardSearch(event.target.value)}
            placeholder={provinceCode ? "Tìm xã theo tên/mã..." : "Chọn tỉnh trước để tìm xã"}
            className="mb-2"
            disabled={!provinceCode}
          />
          <ScrollArea className="h-44 rounded-xl border border-input bg-input/10 p-1">
            <ul className="space-y-1">
              {!provinceCode && (
                <li className="px-2 py-2 text-xs text-muted-foreground">Vui lòng chọn tỉnh trước khi chọn xã.</li>
              )}
              {provinceCode && wardOptions.length === 0 && (
                <li className="px-2 py-2 text-xs text-muted-foreground">Không tìm thấy xã phù hợp.</li>
              )}
              {wardOptions.map((ward) => {
                const active = ward.code === wardCode;
                return (
                  <li key={ward.code}>
                    <button
                      type="button"
                      onClick={() => { setWardCode(ward.code); setSelectedOrganizerIds([]); }}
                      className={cn(
                        "flex w-full items-center justify-between rounded-lg px-2 py-2 text-left text-sm transition-colors hover:bg-accent hover:text-accent-foreground",
                        active && "bg-primary/10 text-primary",
                      )}
                    >
                      <span className="truncate">{ward.name}</span>
                      <span className="text-xs text-muted-foreground">{ward.code}</span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </ScrollArea>
          {selectedWard && (
            <p className="mt-2 text-xs text-muted-foreground">
              Đã chọn: <span className="font-medium text-foreground">{selectedWard.name}</span>
            </p>
          )}
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        <div>
          <label className="mb-1 block text-sm font-medium">Tên sự kiện / địa điểm</label>
          <Input name="event_name" placeholder="Tên hiển thị" required />
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium">Loại sự kiện</label>
          <Input name="event_type" placeholder="Lễ hội, ẩm thực, check-in..." required />
        </div>
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium">Mô tả</label>
        <Textarea name="event_description" placeholder="Mô tả nội dung chính..." required />
      </div>

      <div className="space-y-2">
        <label className="block text-sm font-medium">Hình ảnh mô tả (ít nhất 1 ảnh)</label>
        <div
          role="presentation"
          className={cn(
            "rounded-2xl border border-dashed p-4 transition-colors",
            isDraggingImages ? "border-primary bg-primary/5" : "border-border bg-muted/20",
          )}
          onDragEnter={(event) => {
            event.preventDefault();
            event.stopPropagation();
            setIsDraggingImages(true);
          }}
          onDragOver={(event) => {
            event.preventDefault();
            event.stopPropagation();
            setIsDraggingImages(true);
          }}
          onDragLeave={(event) => {
            event.preventDefault();
            event.stopPropagation();
            setIsDraggingImages(false);
          }}
          onDrop={(event) => {
            event.preventDefault();
            event.stopPropagation();
            setIsDraggingImages(false);
            mergeEventImages(Array.from(event.dataTransfer.files));
          }}
        >
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              className="inline-flex h-9 items-center rounded-4xl border border-border px-3 text-sm font-medium hover:bg-muted"
              onClick={() => imageInputRef.current?.click()}
            >
              Chọn ảnh
            </button>
            <p className="text-xs text-muted-foreground">Kéo thả ảnh vào đây hoặc bấm Chọn ảnh.</p>
          </div>

          <input
            ref={imageInputRef}
            type="file"
            name="event_images"
            accept="image/*"
            multiple
            required
            className="sr-only"
            onChange={(event) => {
              syncEventImages(Array.from(event.target.files ?? []));
            }}
          />

          <div className="mt-3 space-y-2">
            {eventImages.length === 0 && (
              <p className="text-xs text-muted-foreground">Chưa có ảnh nào được chọn.</p>
            )}
            {eventImages.map((file, index) => (
              <div key={`${file.name}-${file.size}-${file.lastModified}`} className="flex items-center justify-between rounded-xl border border-border bg-background/70 px-3 py-2 text-xs">
                <span className="truncate pr-3 text-muted-foreground">{file.name}</span>
                <button
                  type="button"
                  className="rounded-4xl border border-border px-2 py-1 hover:bg-muted"
                  onClick={() => removeEventImage(index)}
                >
                  Xóa
                </button>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="space-y-3 rounded-xl border border-border bg-muted/20 p-3">
        <div className="flex items-center justify-between gap-2">
          <div>
            <p className="text-sm font-semibold">Khung thời gian</p>
            <p className="text-xs text-muted-foreground">
              Có thể để trống toàn bộ để mở tất cả các ngày, hoặc nhập theo ngày cụ thể / thứ trong tuần.
            </p>
          </div>
          <button
            type="button"
            onClick={addScheduleSlot}
            className="inline-flex h-8 items-center rounded-4xl border border-border px-3 text-xs font-medium hover:bg-muted"
          >
            Thêm bộ thời gian
          </button>
        </div>

        <div className="space-y-3">
          {scheduleSlots.map((slot, index) => (
            <div key={slot.id} className="space-y-2 rounded-xl border border-border bg-background/70 p-3">
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm font-medium">Bộ thời gian {index + 1}</p>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => duplicateScheduleSlot(slot.id)}
                    className="inline-flex h-7 items-center rounded-4xl border border-border px-2 text-xs hover:bg-muted"
                  >
                    Nhân bản
                  </button>
                  <button
                    type="button"
                    onClick={() => removeScheduleSlot(slot.id)}
                    disabled={scheduleSlots.length === 1}
                    className="inline-flex h-7 items-center rounded-4xl border border-border px-2 text-xs hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    Xóa
                  </button>
                </div>
              </div>

              <div className="grid gap-3 md:grid-cols-3">
                <div>
                  <label className="mb-1 block text-sm font-medium">Loại lịch</label>
                  <select
                    value={slot.mode}
                    onChange={(event) => updateScheduleSlot(slot.id, "mode", event.target.value)}
                    className="h-9 w-full rounded-4xl border border-input bg-input/30 px-3 text-sm"
                  >
                    <option value="date">Ngày cụ thể</option>
                    <option value="weekday">Thứ trong tuần</option>
                  </select>
                  <input type="hidden" name="schedule_mode" value={slot.mode} />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium">
                    {slot.mode === "date" ? "Thời gian tổ chức" : "Thứ trong tuần"}
                  </label>
                  {slot.mode === "date" ? (
                    <Input
                      type="datetime-local"
                      value={slot.organizedAt}
                      onChange={(event) => updateScheduleSlot(slot.id, "organizedAt", event.target.value)}
                    />
                  ) : (
                    <select
                      value={slot.weekday}
                      onChange={(event) => updateScheduleSlot(slot.id, "weekday", event.target.value)}
                      className="h-9 w-full rounded-4xl border border-input bg-input/30 px-3 text-sm"
                    >
                      <option value="">Chọn thứ</option>
                      <option value="1">Thứ 2</option>
                      <option value="2">Thứ 3</option>
                      <option value="3">Thứ 4</option>
                      <option value="4">Thứ 5</option>
                      <option value="5">Thứ 6</option>
                      <option value="6">Thứ 7</option>
                      <option value="7">Chủ nhật</option>
                    </select>
                  )}
                  <input type="hidden" name="schedule_organized_at" value={slot.mode === "date" ? slot.organizedAt : ""} />
                  <input type="hidden" name="schedule_weekday" value={slot.mode === "weekday" ? slot.weekday : ""} />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium">Mở cửa từ</label>
                  <Input
                    type="time"
                    name="schedule_opens_at"
                    value={slot.opensAt}
                    onChange={(event) => updateScheduleSlot(slot.id, "opensAt", event.target.value)}
                  />
                </div>
              </div>

              <div className="grid gap-3 md:grid-cols-3">
                <div>
                  <label className="mb-1 block text-sm font-medium">Đến</label>
                  <Input
                    type="time"
                    name="schedule_closes_at"
                    value={slot.closesAt}
                    onChange={(event) => updateScheduleSlot(slot.id, "closesAt", event.target.value)}
                  />
                </div>
              </div>
            </div>
          ))}
        </div>

        <label className="inline-flex items-center gap-2 text-sm text-muted-foreground">
          <input type="checkbox" name="allow_registration" className="size-4 rounded border-border" />
          Cho phép đăng ký tham gia
        </label>
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium">Mô tả lịch hoạt động (nếu cần)</label>
        <Textarea name="schedule_description" placeholder="Nếu không có giờ cố định, ghi lịch hoạt động tại đây." />
      </div>

      <div className="grid gap-3 md:grid-cols-3">
        <div>
          <label className="mb-1 block text-sm font-medium">Số điện thoại liên hệ</label>
          <Input name="contact_phone" placeholder="090..." />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium">Email liên hệ</label>
          <Input type="email" name="contact_email" placeholder="mail@domain.com" />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium">Tên liên hệ</label>
          <Input name="contact_name" placeholder="Người phụ trách" />
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="rounded-xl border border-border bg-muted/30 p-3">
          <p className="mb-2 text-sm font-semibold">Danh mục sự kiện</p>
          <div className="grid max-h-40 gap-2 overflow-y-auto pr-1">
            {categories.map((category) => (
              <label key={category.id} className="inline-flex items-center gap-2 text-sm text-muted-foreground">
                <input
                  type="checkbox"
                  checked={selectedCategoryIds.includes(category.id)}
                  onChange={() => setSelectedCategoryIds((prev) => toggleValue(prev, category.id))}
                  className="size-4 rounded border-border"
                />
                {category.name}
              </label>
            ))}
          </div>
          <input type="hidden" name="selected_category_ids" value={selectedCategoryIds.join(",")} />
          <label className="mt-3 mb-1 block text-xs font-medium text-muted-foreground">Tạo danh mục mới</label>
          <Textarea name="new_category_names" placeholder="Mỗi dòng hoặc phân tách bằng dấu phẩy" className="min-h-20" />
        </div>

        <div className="rounded-xl border border-border bg-muted/30 p-3">
          <p className="mb-2 text-sm font-semibold">Đơn vị tổ chức</p>
          {(!provinceCode || !wardCode) && (
            <p className="mb-2 text-xs text-muted-foreground">Vui lòng chọn tỉnh và xã để xem đơn vị tổ chức.</p>
          )}
          <div className="grid max-h-40 gap-2 overflow-y-auto pr-1">
            {filteredOrganizers.map((organizer) => (
              <label key={organizer.id} className="inline-flex items-center gap-2 text-sm text-muted-foreground">
                <input
                  type="checkbox"
                  checked={selectedOrganizerIds.includes(organizer.id)}
                  onChange={() => setSelectedOrganizerIds((prev) => toggleValue(prev, organizer.id))}
                  className="size-4 rounded border-border"
                />
                {organizer.name}
              </label>
            ))}
          </div>
          <input type="hidden" name="selected_organizer_ids" value={selectedOrganizerIds.join(",")} />
          <label className="mt-3 mb-1 block text-xs font-medium text-muted-foreground">Tạo đơn vị mới</label>
          <Textarea name="new_organizer_names" placeholder="Mỗi dòng hoặc phân tách bằng dấu phẩy" className="min-h-20" />
        </div>
      </div>

      <FormSubmitButton idleText="Đăng bản ghi" pendingText="Đang tạo..." />
    </form>
  );
}

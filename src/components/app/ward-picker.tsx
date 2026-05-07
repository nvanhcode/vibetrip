"use client";

import * as React from "react";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";

export type WardOption = { code: string; name: string; province_code: string };
export type ProvinceOption = { code: string; name: string };

interface WardPickerProps {
  name: string;
  provinces: ProvinceOption[];
  /** Pre-loaded wards by province. If omitted, wards are fetched via /api/wards on province select. */
  wardsByProvince?: Record<string, WardOption[]>;
  defaultValue?: string[];
  required?: boolean;
}

export function WardPicker({ name, provinces, wardsByProvince, defaultValue = [], required }: WardPickerProps) {
  const [selected, setSelected] = React.useState<Set<string>>(new Set(defaultValue));
  const [search, setSearch] = React.useState("");
  const [activeProvince, setActiveProvince] = React.useState<string>(
    provinces.length === 1 ? provinces[0].code : ""
  );
  const [asyncWards, setAsyncWards] = React.useState<Record<string, WardOption[]>>({});
  const [loading, setLoading] = React.useState(false);

  // On mount, if single province and no pre-loaded wards, fetch them
  React.useEffect(() => {
    if (provinces.length === 1 && !wardsByProvince) {
      handleProvinceSelect(provinces[0].code);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleProvinceSelect(code: string) {
    setActiveProvince(code);
    setSearch("");
    // If wardsByProvince is provided (pre-loaded), no need to fetch
    if (wardsByProvince) return;
    if (asyncWards[code]) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/wards?province_code=${encodeURIComponent(code)}`);
      if (res.ok) {
        const data: WardOption[] = await res.json();
        setAsyncWards((prev) => ({ ...prev, [code]: data }));
      }
    } finally {
      setLoading(false);
    }
  }

  const wardSource = wardsByProvince ?? asyncWards;
  const wards = activeProvince ? (wardSource[activeProvince] ?? []) : [];

  const filtered = wards.filter(
    (w) =>
      w.name.toLowerCase().includes(search.toLowerCase()) ||
      w.code.toLowerCase().includes(search.toLowerCase())
  );

  function toggle(code: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(code)) {
        next.delete(code);
      } else {
        next.add(code);
      }
      return next;
    });
  }

  // All ward codes for current province (for select-all in province)
  const allProvinceCodes = wards.map((w) => w.code);
  const allSelected = allProvinceCodes.length > 0 && allProvinceCodes.every((c) => selected.has(c));

  function toggleAll() {
    setSelected((prev) => {
      const next = new Set(prev);
      if (allSelected) {
        allProvinceCodes.forEach((c) => next.delete(c));
      } else {
        allProvinceCodes.forEach((c) => next.add(c));
      }
      return next;
    });
  }

  const hiddenValue = Array.from(selected).join(",");

  // Find ward name by code across all provinces
  function wardLabel(code: string) {
    const source = wardsByProvince ?? asyncWards;
    for (const list of Object.values(source)) {
      const found = list.find((w) => w.code === code);
      if (found) return found.name;
    }
    return code;
  }

  return (
    <div className="space-y-2">
      <input type="hidden" name={name} value={hiddenValue} required={required} />

      {selected.size > 0 && (
        <div className="flex flex-wrap gap-1">
          {Array.from(selected).map((code) => (
            <span
              key={code}
              className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary"
            >
              {wardLabel(code)}
              <button
                type="button"
                onClick={() => toggle(code)}
                className="ml-0.5 rounded-full hover:text-destructive"
                aria-label={`Bỏ chọn ${wardLabel(code)}`}
              >
                ×
              </button>
            </span>
          ))}
        </div>
      )}

      {provinces.length > 1 && (
        <div className="flex flex-wrap gap-1">
          {provinces.map((p) => (
            <button
              key={p.code}
              type="button"
              onClick={() => handleProvinceSelect(p.code)}
              className={cn(
                "rounded-full border px-2.5 py-0.5 text-xs font-medium transition-colors",
                activeProvince === p.code
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-input bg-background hover:bg-accent hover:text-accent-foreground"
              )}
            >
              {p.name}
            </button>
          ))}
        </div>
      )}

      {activeProvince ? (
        <>
          <Input
            placeholder="Tìm xã..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />

          <ScrollArea className="h-48 rounded-md border border-input">
            <ul className="p-1">
              {loading && (
                <li className="px-2 py-3 text-center text-xs text-muted-foreground">Đang tải...</li>
              )}
              {!loading && wards.length > 0 && (
                <li>
                  <button
                    type="button"
                    onClick={toggleAll}
                    className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-xs font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
                  >
                    <span
                      className={cn(
                        "flex h-4 w-4 shrink-0 items-center justify-center rounded border border-input",
                        allSelected && "border-primary bg-primary text-primary-foreground"
                      )}
                      aria-hidden
                    >
                      {allSelected && (
                        <svg viewBox="0 0 12 12" fill="none" className="h-3 w-3">
                          <path d="M2 6l3 3 5-5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      )}
                    </span>
                    Chọn tất cả ({wards.length})
                  </button>
                </li>
              )}
              {!loading && filtered.length === 0 && (
                <li className="px-2 py-3 text-center text-xs text-muted-foreground">Không tìm thấy xã nào.</li>
              )}
              {filtered.map((ward) => {
                const isSelected = selected.has(ward.code);
                return (
                  <li key={ward.code}>
                    <button
                      type="button"
                      onClick={() => toggle(ward.code)}
                      className={cn(
                        "flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-sm transition-colors hover:bg-accent hover:text-accent-foreground",
                        isSelected && "bg-primary/10 text-primary"
                      )}
                    >
                      <span
                        className={cn(
                          "flex h-4 w-4 shrink-0 items-center justify-center rounded border border-input",
                          isSelected && "border-primary bg-primary text-primary-foreground"
                        )}
                        aria-hidden
                      >
                        {isSelected && (
                          <svg viewBox="0 0 12 12" fill="none" className="h-3 w-3">
                            <path d="M2 6l3 3 5-5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                          </svg>
                        )}
                      </span>
                      <span className="flex-1 truncate">{ward.name}</span>
                      <span className="text-xs text-muted-foreground">{ward.code}</span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </ScrollArea>
        </>
      ) : (
        <p className="text-xs text-muted-foreground">Chọn một tỉnh ở trên để xem danh sách xã.</p>
      )}
    </div>
  );
}

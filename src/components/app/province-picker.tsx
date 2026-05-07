"use client";

import * as React from "react";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";

export type ProvinceOption = { code: string; name: string };

interface ProvincePickerProps {
  name: string;
  provinces: ProvinceOption[];
  defaultValue?: string[];
  required?: boolean;
}

export function ProvincePicker({ name, provinces, defaultValue = [], required }: ProvincePickerProps) {
  const [selected, setSelected] = React.useState<Set<string>>(new Set(defaultValue));
  const [search, setSearch] = React.useState("");

  const filtered = provinces.filter(
    (p) =>
      p.name.toLowerCase().includes(search.toLowerCase()) ||
      p.code.toLowerCase().includes(search.toLowerCase())
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

  const hiddenValue = Array.from(selected).join(",");

  return (
    <div className="space-y-2">
      <input type="hidden" name={name} value={hiddenValue} required={required} />

      {selected.size > 0 && (
        <div className="flex flex-wrap gap-1">
          {Array.from(selected).map((code) => {
            const province = provinces.find((p) => p.code === code);
            return (
              <span
                key={code}
                className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary"
              >
                {province?.name ?? code}
                <button
                  type="button"
                  onClick={() => toggle(code)}
                  className="ml-0.5 rounded-full hover:text-destructive"
                  aria-label={`Bỏ chọn ${province?.name ?? code}`}
                >
                  ×
                </button>
              </span>
            );
          })}
        </div>
      )}

      <Input
        placeholder="Tìm tỉnh..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
      />

      <ScrollArea className="h-40 rounded-md border border-input">
        <ul className="p-1">
          {filtered.length === 0 && (
            <li className="px-2 py-3 text-center text-xs text-muted-foreground">Không tìm thấy tỉnh nào.</li>
          )}
          {filtered.map((province) => {
            const isSelected = selected.has(province.code);
            return (
              <li key={province.code}>
                <button
                  type="button"
                  onClick={() => toggle(province.code)}
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
                  <span className="flex-1 truncate">{province.name}</span>
                  <span className="text-xs text-muted-foreground">{province.code}</span>
                </button>
              </li>
            );
          })}
        </ul>
      </ScrollArea>
    </div>
  );
}

"use client";

import { FavouriteIcon, MapPinpoint01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import Image from "next/image";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { FavoriteButton } from "@/components/app/favorite-button";

type FavoriteEventRecord = {
  id: string;
  record_kind: "event" | "place";
  province_code: string;
  ward_code: string | null;
  event_name: string;
  event_type: string | null;
  image_urls: string[] | null;
  created_at: string;
  categories?: { id: string; name: string }[];
};

type UserFavoriteEventsProps = {
  events: FavoriteEventRecord[];
  currentUserId: string;
  targetUserId: string;
  provinces: Map<string, string>;
  wards: Map<string, string>;
};

export function UserFavoriteEvents({
  events,
  currentUserId,
  targetUserId,
  provinces,
  wards,
}: UserFavoriteEventsProps) {
  if (events.length === 0) {
    return null;
  }

  const isOwnProfile = currentUserId === targetUserId;

  return (
    <div className="space-y-3">
      <h3 className="flex items-center gap-2 text-lg font-semibold text-foreground">
        <HugeiconsIcon icon={FavouriteIcon} className="size-5 text-rose-500" />
        <span>Sự kiện yêu thích ({events.length})</span>
      </h3>

      <div className="grid gap-4 sm:grid-cols-2">
        {events.map((event) => {
          const img = Array.isArray(event.image_urls)
            ? (event.image_urls[0] as string | undefined)
            : undefined;
          const cats = event.categories ?? [];

          return (
            <div
              key={event.id}
              className="group flex flex-col overflow-hidden rounded-2xl border border-border bg-card transition-shadow hover:shadow-md"
            >
              <div className="relative h-40 w-full bg-muted">
                {img ? (
                  <Image
                    src={img}
                    alt={event.event_name}
                    fill
                    sizes="(max-width: 640px) 100vw, 50vw"
                    className="object-cover transition-transform duration-300 group-hover:scale-105"
                  />
                ) : (
                  <div className="flex h-full items-center justify-center text-xs text-muted-foreground">
                    Không có ảnh
                  </div>
                )}
                <div className="absolute left-3 top-3">
                  <Badge variant={event.record_kind === "event" ? "default" : "secondary"}>
                    {event.record_kind === "event" ? "Sự kiện" : "Địa điểm"}
                  </Badge>
                </div>
              </div>

              <div className="flex flex-1 flex-col gap-2 p-3">
                <p className="line-clamp-2 font-semibold leading-snug text-foreground">
                  {event.event_name}
                </p>
                {event.event_type && (
                  <p className="text-xs text-muted-foreground">{event.event_type}</p>
                )}
                <p className="flex items-center gap-1 text-xs text-muted-foreground">
                  <HugeiconsIcon icon={MapPinpoint01Icon} className="size-3.5" />
                  <span>
                    {provinces.get(event.province_code) ?? event.province_code}
                    {event.ward_code ? ` · ${wards.get(event.ward_code) ?? event.ward_code}` : ""}
                  </span>
                </p>
                {cats.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {cats.slice(0, 2).map((c) => (
                      <Badge key={c.id} variant="outline" className="text-xs">
                        {c.name}
                      </Badge>
                    ))}
                    {cats.length > 2 && (
                      <Badge variant="outline" className="text-xs">
                        +{cats.length - 2}
                      </Badge>
                    )}
                  </div>
                )}
                <div className="mt-auto flex gap-2">
                  <Button asChild variant="outline" size="sm" className="flex-1">
                    <Link href={`/events/${event.id}`}>Xem chi tiết</Link>
                  </Button>
                  {isOwnProfile && (
                    <FavoriteButton
                      eventRecordId={event.id}
                      initialIsFavorited={true}
                      size="sm"
                    />
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

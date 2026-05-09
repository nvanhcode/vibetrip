"use client";

import { HeartAddIcon, HeartCheckIcon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type FavoriteButtonProps = {
  eventRecordId: string;
  initialIsFavorited?: boolean;
  onFavoriteChange?: (isFavorited: boolean) => void;
  size?: "sm" | "md" | "lg";
  variant?: "default" | "outline" | "ghost";
};

export function FavoriteButton({
  eventRecordId,
  initialIsFavorited = false,
  onFavoriteChange,
  size = "md",
  variant = "outline",
}: FavoriteButtonProps) {
  const [isFavorited, setIsFavorited] = useState(initialIsFavorited);
  const [isLoading, setIsLoading] = useState(false);

  async function handleToggleFavorite() {
    if (isLoading) return;
    setIsLoading(true);

    try {
      const action = isFavorited ? "remove" : "add";
      const response = await fetch("/api/events/favorites", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          eventRecordId,
          action,
        }),
      });

      if (response.ok) {
        const newIsFavorited = !isFavorited;
        setIsFavorited(newIsFavorited);
        onFavoriteChange?.(newIsFavorited);
      }
    } catch (error) {
      console.error("Error toggling favorite:", error);
    } finally {
      setIsLoading(false);
    }
  }

  const buttonSize = size === "sm" ? "sm" : size === "lg" ? "lg" : "default";

  return (
    <Button
      onClick={handleToggleFavorite}
      disabled={isLoading}
      variant={variant}
      size={buttonSize}
      className={cn(
        "gap-2",
        isFavorited && variant === "outline" && "border-red-500/50 text-red-600"
      )}
      title={isFavorited ? "Bỏ yêu thích" : "Yêu thích"}
    >
      <HugeiconsIcon
        icon={isFavorited ? HeartCheckIcon : HeartAddIcon}
        className={cn(
          "size-4",
          isFavorited && "text-red-600"
        )}
      />
      <span className="hidden sm:inline">
        {isFavorited ? "Đã yêu thích" : "Yêu thích"}
      </span>
    </Button>
  );
}

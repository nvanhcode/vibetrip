"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";

type NotificationType =
  | "event_record_reviewed"
  | "forum_post_liked"
  | "forum_post_commented"
  | "forum_comment_replied";

type NotificationItem = {
  id: string;
  recipient_user_id: string;
  notification_type: NotificationType;
  title: string;
  body: string;
  link_path: string;
  is_read: boolean;
  created_at: string;
};

type ToastItem = {
  id: string;
  title: string;
  body: string;
  linkPath: string;
};

type FilterKey = "all" | "review" | "like" | "comment";

type NotificationsMenuProps = {
  currentUserId: string;
};

const FETCH_LIMIT = 30;

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("vi-VN", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date(value));
}

export function NotificationsMenu({ currentUserId }: NotificationsMenuProps) {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const toastTimersRef = useRef<Map<string, number>>(new Map());

  const [open, setOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [activeFilter, setActiveFilter] = useState<FilterKey>("all");
  const [realtimeToasts, setRealtimeToasts] = useState<ToastItem[]>([]);
  const [isDeleteAllPending, setIsDeleteAllPending] = useState(false);
  const [confirmDeleteAll, setConfirmDeleteAll] = useState(false);
  const [errorText, setErrorText] = useState<string | null>(null);

  const unreadCount = useMemo(() => items.filter((item) => !item.is_read).length, [items]);

  const filteredItems = useMemo(() => {
    return items.filter((item) => {
      if (activeFilter === "all") return true;
      if (activeFilter === "review") return item.notification_type === "event_record_reviewed";
      if (activeFilter === "like") return item.notification_type === "forum_post_liked";
      return (
        item.notification_type === "forum_post_commented" || item.notification_type === "forum_comment_replied"
      );
    });
  }, [activeFilter, items]);

  const addRealtimeToast = useCallback((notification: NotificationItem) => {
    const toast: ToastItem = {
      id: notification.id,
      title: notification.title,
      body: notification.body,
      linkPath: notification.link_path,
    };

    setRealtimeToasts((prev) => [toast, ...prev.filter((item) => item.id !== toast.id)].slice(0, 3));

    const existingTimer = toastTimersRef.current.get(toast.id);
    if (existingTimer) {
      window.clearTimeout(existingTimer);
    }

    const timeoutId = window.setTimeout(() => {
      setRealtimeToasts((prev) => prev.filter((item) => item.id !== toast.id));
      toastTimersRef.current.delete(toast.id);
    }, 4500);

    toastTimersRef.current.set(toast.id, timeoutId);
  }, []);

  const loadNotifications = useCallback(async () => {
    const { data, error } = await supabase
      .from("user_notifications")
      .select("id, recipient_user_id, notification_type, title, body, link_path, is_read, created_at")
      .eq("recipient_user_id", currentUserId)
      .order("created_at", { ascending: false })
      .limit(FETCH_LIMIT);

    if (error) {
      setErrorText(error.message);
      setItems([]);
    } else {
      setErrorText(null);
      setItems((data ?? []) as NotificationItem[]);
    }

    setIsLoading(false);
  }, [currentUserId, supabase]);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      void loadNotifications();
    }, 0);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [loadNotifications]);

  useEffect(() => {
    const channel = supabase
      .channel(`user-notifications-${currentUserId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "user_notifications",
          filter: `recipient_user_id=eq.${currentUserId}`,
        },
        (payload) => {
          const createdItem = payload.new as NotificationItem;
          setItems((prev) => [createdItem, ...prev.filter((item) => item.id !== createdItem.id)].slice(0, FETCH_LIMIT));
          addRealtimeToast(createdItem);
        },
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "user_notifications",
          filter: `recipient_user_id=eq.${currentUserId}`,
        },
        (payload) => {
          const updatedItem = payload.new as NotificationItem;
          setItems((prev) => prev.map((item) => (item.id === updatedItem.id ? { ...item, ...updatedItem } : item)));
        },
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [addRealtimeToast, currentUserId, supabase]);

  useEffect(() => {
    const timers = toastTimersRef.current;

    return () => {
      for (const timer of timers.values()) {
        window.clearTimeout(timer);
      }
      timers.clear();
    };
  }, []);

  useEffect(() => {
    function onClickOutside(event: MouseEvent) {
      if (!containerRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    }

    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  async function markAsRead(notificationId: string) {
    const { error } = await supabase
      .from("user_notifications")
      .update({ is_read: true, read_at: new Date().toISOString() })
      .eq("id", notificationId)
      .eq("recipient_user_id", currentUserId)
      .eq("is_read", false);

    if (error) {
      console.error("markAsRead failed", error);
    }
  }

  async function markAllAsRead() {
    const unreadIds = items.filter((item) => !item.is_read).map((item) => item.id);
    if (unreadIds.length === 0) return;

    setItems((prev) => prev.map((item) => ({ ...item, is_read: true })));

    const { error } = await supabase
      .from("user_notifications")
      .update({ is_read: true, read_at: new Date().toISOString() })
      .eq("recipient_user_id", currentUserId)
      .eq("is_read", false);

    if (error) {
      console.error("markAllAsRead failed", error);
      void loadNotifications();
    }
  }

  async function deleteOne(notificationId: string) {
    const snapshot = items;
    setItems((prev) => prev.filter((item) => item.id !== notificationId));

    const { error } = await supabase
      .from("user_notifications")
      .delete()
      .eq("id", notificationId)
      .eq("recipient_user_id", currentUserId);

    if (error) {
      console.error("deleteOne failed", error);
      setItems(snapshot);
    }
  }

  async function deleteAll() {
    setIsDeleteAllPending(true);
    const snapshot = items;
    setItems([]);

    const { error } = await supabase.from("user_notifications").delete().eq("recipient_user_id", currentUserId);

    if (error) {
      console.error("deleteAll failed", error);
      setItems(snapshot);
    }

    setIsDeleteAllPending(false);
    setConfirmDeleteAll(false);
  }

  async function handleOpenItem(item: NotificationItem) {
    setOpen(false);
    if (!item.is_read) {
      setItems((prev) => prev.map((n) => (n.id === item.id ? { ...n, is_read: true } : n)));
      await markAsRead(item.id);
    }
    router.push(item.link_path);
  }

  function closeToast(toastId: string) {
    const timer = toastTimersRef.current.get(toastId);
    if (timer) {
      window.clearTimeout(timer);
      toastTimersRef.current.delete(toastId);
    }
    setRealtimeToasts((prev) => prev.filter((item) => item.id !== toastId));
  }

  function handleDeleteAllClick() {
    if (isDeleteAllPending || items.length === 0) {
      return;
    }

    if (!confirmDeleteAll) {
      setConfirmDeleteAll(true);
      window.setTimeout(() => {
        setConfirmDeleteAll(false);
      }, 4000);
      return;
    }

    void deleteAll();
  }

  function openFromToast(toast: ToastItem) {
    closeToast(toast.id);
    const linked = items.find((item) => item.id === toast.id);
    if (linked) {
      void handleOpenItem(linked);
      return;
    }
    router.push(toast.linkPath);
  }

  return (
    <div className="relative" ref={containerRef}>
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className={cn(
          "relative inline-flex size-10 items-center justify-center rounded-full border border-border bg-card text-foreground transition-colors hover:bg-accent",
          open && "bg-accent",
        )}
        aria-label="Thông báo"
      >
        <svg viewBox="0 0 24 24" fill="none" className="size-5" stroke="currentColor" strokeWidth="1.8" aria-hidden>
          <path d="M12 3a6 6 0 0 0-6 6v3.4c0 .8-.3 1.6-.9 2.2L3.8 16a1 1 0 0 0 .7 1.7h15a1 1 0 0 0 .7-1.7l-1.3-1.4a3 3 0 0 1-.9-2.2V9a6 6 0 0 0-6-6Z" />
          <path d="M9.5 19a2.5 2.5 0 0 0 5 0" />
        </svg>
        {unreadCount > 0 && (
          <span className="absolute -right-1 -top-1 inline-flex min-w-5 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-semibold text-destructive-foreground">
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-[calc(100%+0.5rem)] z-50 w-88 max-w-[calc(100vw-2rem)] overflow-hidden rounded-2xl border border-border bg-popover text-popover-foreground shadow-lg">
          <div className="flex items-center justify-between border-b border-border px-3 py-2">
            <p className="text-sm font-semibold">Thông báo</p>
            <div className="flex items-center gap-1">
              <Button type="button" variant="ghost" size="sm" onClick={() => void markAllAsRead()} disabled={unreadCount === 0}>
                Đọc hết
              </Button>
              <Button
                type="button"
                variant={confirmDeleteAll ? "destructive" : "ghost"}
                size="sm"
                onClick={handleDeleteAllClick}
                disabled={items.length === 0 || isDeleteAllPending}
              >
                {isDeleteAllPending ? "Đang xóa..." : confirmDeleteAll ? "Xác nhận xóa" : "Xóa hết"}
              </Button>
            </div>
          </div>

          {confirmDeleteAll && !isDeleteAllPending && (
            <div className="border-b border-border px-3 py-2">
              <p className="text-[11px] text-destructive">Nhấn lại nút xác nhận trong 4 giây để xóa toàn bộ thông báo.</p>
            </div>
          )}

          <div className="flex gap-1 border-b border-border px-2 py-2">
            <button
              type="button"
              onClick={() => setActiveFilter("all")}
              className={cn(
                "rounded-lg px-2 py-1 text-[11px] font-medium",
                activeFilter === "all" ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground",
              )}
            >
              Tất cả
            </button>
            <button
              type="button"
              onClick={() => setActiveFilter("review")}
              className={cn(
                "rounded-lg px-2 py-1 text-[11px] font-medium",
                activeFilter === "review" ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground",
              )}
            >
              Duyệt
            </button>
            <button
              type="button"
              onClick={() => setActiveFilter("like")}
              className={cn(
                "rounded-lg px-2 py-1 text-[11px] font-medium",
                activeFilter === "like" ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground",
              )}
            >
              Like
            </button>
            <button
              type="button"
              onClick={() => setActiveFilter("comment")}
              className={cn(
                "rounded-lg px-2 py-1 text-[11px] font-medium",
                activeFilter === "comment" ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground",
              )}
            >
              Bình luận
            </button>
          </div>

          <div className="max-h-96 overflow-y-auto p-1.5">
            {isLoading && <p className="px-2 py-3 text-xs text-muted-foreground">Đang tải thông báo...</p>}
            {errorText && <p className="px-2 py-3 text-xs text-destructive">{errorText}</p>}
            {!isLoading && !errorText && filteredItems.length === 0 && (
              <p className="px-2 py-3 text-xs text-muted-foreground">Chưa có thông báo mới.</p>
            )}

            {filteredItems.map((item) => (
              <div
                key={item.id}
                className={cn(
                  "flex items-start gap-1 rounded-xl border px-2 py-2 transition-colors",
                  item.is_read
                    ? "border-transparent bg-transparent hover:bg-accent/60"
                    : "border-primary/30 bg-primary/10 hover:bg-primary/15",
                )}
              >
                <button
                  type="button"
                  onClick={() => void handleOpenItem(item)}
                  className="min-w-0 flex-1 text-left"
                >
                  <p className="text-xs font-semibold text-foreground">{item.title}</p>
                  <p className="mt-1 text-xs text-muted-foreground">{item.body}</p>
                  <p className="mt-1 text-[11px] text-muted-foreground">{formatDateTime(item.created_at)}</p>
                </button>
                <button
                  type="button"
                  onClick={() => void deleteOne(item.id)}
                  className="rounded-md px-2 py-1 text-[11px] text-muted-foreground hover:bg-accent hover:text-foreground"
                  aria-label="Xóa thông báo"
                >
                  Xóa
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {realtimeToasts.length > 0 && (
        <div className="fixed bottom-4 right-4 z-70 flex w-[calc(100vw-2rem)] max-w-sm flex-col gap-2 md:bottom-6 md:right-6">
          {realtimeToasts.map((toast) => (
            <div key={toast.id} className="rounded-2xl border border-primary/30 bg-card p-3 shadow-lg backdrop-blur">
              <div className="flex items-start gap-2">
                <button type="button" onClick={() => openFromToast(toast)} className="min-w-0 flex-1 text-left">
                  <p className="text-xs font-semibold text-foreground">{toast.title}</p>
                  <p className="mt-1 text-xs text-muted-foreground">{toast.body}</p>
                </button>
                <button
                  type="button"
                  onClick={() => closeToast(toast.id)}
                  className="rounded-md px-1.5 py-0.5 text-xs text-muted-foreground hover:bg-accent hover:text-foreground"
                  aria-label="Đóng"
                >
                  ×
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

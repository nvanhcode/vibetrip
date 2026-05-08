"use client";

import Image from "next/image";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";

type CurrentUser = {
  id: string;
  email: string;
  displayName: string;
  avatarUrl: string;
};

type EventSearchOption = {
  id: string;
  event_name: string;
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

type GoongReverseGeocodeResponse = {
  place_id?: string;
  name?: string;
  formatted_address?: string;
  lat?: number;
  lng?: number;
  error?: string;
};

type CheckinPlace = {
  id: string;
  name: string;
  address: string;
  lat: number;
  lng: number;
};

type LikeRow = {
  user_id: string;
};

type CommentRow = {
  id: string;
  post_id: string;
  parent_comment_id: string | null;
  author_id: string;
  author_name: string;
  author_avatar_url: string | null;
  content: string;
  created_at: string;
};

type EventRecordRelation =
  | {
      id: string;
      event_name: string;
    }
  | {
      id: string;
      event_name: string;
    }[]
  | null;

type PostRow = {
  id: string;
  author_id: string;
  author_name: string;
  author_avatar_url: string | null;
  content: string;
  image_urls: string[] | null;
  checkin_place_name: string | null;
  checkin_place_address: string | null;
  checkin_place_id: string | null;
  checkin_latitude: number | null;
  checkin_longitude: number | null;
  event_record_id: string | null;
  created_at: string;
  forum_post_likes: LikeRow[] | null;
  forum_post_comments: CommentRow[] | null;
  event_records: EventRecordRelation;
};

type ForumCommentView = {
  id: string;
  postId: string;
  parentCommentId: string | null;
  authorId: string;
  authorName: string;
  authorAvatarUrl: string;
  content: string;
  createdAt: string;
};

type ForumPostView = {
  id: string;
  authorId: string;
  authorName: string;
  authorAvatarUrl: string;
  content: string;
  imageUrls: string[];
  checkinPlace: CheckinPlace | null;
  eventRecord: { id: string; eventName: string } | null;
  createdAt: string;
  likeCount: number;
  commentCount: number;
  likedByCurrentUser: boolean;
  comments: ForumCommentView[];
};

type ForumFeedProps = {
  currentUser: CurrentUser;
  focusPostId?: string | null;
};

function firstRelation<T>(value: T | T[] | null): T | null {
  if (!value) return null;
  if (Array.isArray(value)) {
    return value[0] ?? null;
  }
  return value;
}

function toViewPost(row: PostRow, currentUserId: string): ForumPostView {
  const relation = firstRelation(row.event_records);
  const comments = (row.forum_post_comments ?? [])
    .slice()
    .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
    .map((comment) => ({
      id: comment.id,
      postId: comment.post_id,
      parentCommentId: comment.parent_comment_id,
      authorId: comment.author_id,
      authorName: comment.author_name || "Người dùng",
      authorAvatarUrl: comment.author_avatar_url ?? "",
      content: comment.content,
      createdAt: comment.created_at,
    }));

  return {
    id: row.id,
    authorId: row.author_id,
    authorName: row.author_name || "Người dùng",
    authorAvatarUrl: row.author_avatar_url ?? "",
    content: row.content,
    imageUrls: Array.isArray(row.image_urls) ? row.image_urls : [],
    checkinPlace:
      typeof row.checkin_latitude === "number" &&
      typeof row.checkin_longitude === "number" &&
      row.checkin_place_name
        ? {
            id: row.checkin_place_id ?? `latlng:${row.checkin_latitude},${row.checkin_longitude}`,
            name: row.checkin_place_name,
            address: row.checkin_place_address ?? "",
            lat: row.checkin_latitude,
            lng: row.checkin_longitude,
          }
        : null,
    eventRecord: relation
      ? {
          id: relation.id,
          eventName: relation.event_name,
        }
      : null,
    createdAt: row.created_at,
    likeCount: row.forum_post_likes?.length ?? 0,
    commentCount: comments.length,
    likedByCurrentUser: (row.forum_post_likes ?? []).some((like) => like.user_id === currentUserId),
    comments,
  };
}

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("vi-VN", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date(value));
}

function extFromFile(file: File) {
  const parts = file.name.split(".");
  const ext = parts[parts.length - 1];
  return ext ? ext.toLowerCase() : "jpg";
}

const PAGE_SIZE = 10;

const POST_SELECT_FIELDS = `
  id,
  author_id,
  author_name,
  author_avatar_url,
  content,
  image_urls,
  checkin_place_name,
  checkin_place_address,
  checkin_place_id,
  checkin_latitude,
  checkin_longitude,
  event_record_id,
  created_at,
  event_records(id, event_name),
  forum_post_likes(user_id),
  forum_post_comments(id, post_id, parent_comment_id, author_id, author_name, author_avatar_url, content, created_at)
` as const;

export function ForumFeed({ currentUser, focusPostId = null }: ForumFeedProps) {
  const supabase = useMemo(() => createClient(), []);

  const [posts, setPosts] = useState<ForumPostView[]>([]);
  const [isLoadingPosts, setIsLoadingPosts] = useState(true);
  const [feedError, setFeedError] = useState<string | null>(null);

  const [content, setContent] = useState("");
  const [imageFiles, setImageFiles] = useState<File[]>([]);
  const [creating, setCreating] = useState(false);
  const [composerError, setComposerError] = useState<string | null>(null);
  const [composerStatus, setComposerStatus] = useState<string | null>(null);

  const [checkinPlace, setCheckinPlace] = useState<CheckinPlace | null>(null);
  const [placeQuery, setPlaceQuery] = useState("");
  const [placePredictions, setPlacePredictions] = useState<GoongPrediction[]>([]);
  const [isSearchingPlace, setIsSearchingPlace] = useState(false);
  const [placeError, setPlaceError] = useState<string | null>(null);

  const [eventQuery, setEventQuery] = useState("");
  const [eventOptions, setEventOptions] = useState<EventSearchOption[]>([]);
  const [isSearchingEvent, setIsSearchingEvent] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState<EventSearchOption | null>(null);

  const [pendingLikePostId, setPendingLikePostId] = useState<string | null>(null);
  const [commentDrafts, setCommentDrafts] = useState<Record<string, string>>({});
  const [replyTarget, setReplyTarget] = useState<Record<string, string | null>>({});
  const [pendingCommentPostId, setPendingCommentPostId] = useState<string | null>(null);

  const [hasMore, setHasMore] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [oldestCursor, setOldestCursor] = useState<string | null>(null);
  const sentinelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let isCancelled = false;

    async function initialLoad() {
      const { data, error } = await supabase
        .from("forum_posts")
        .select(POST_SELECT_FIELDS)
        .order("created_at", { ascending: false })
        .limit(PAGE_SIZE);

      if (isCancelled) {
        return;
      }

      if (error) {
        setFeedError(error.message);
        setPosts([]);
      } else {
        const rows = (data ?? []) as PostRow[];
        let mergedRows = rows;

        if (focusPostId && !rows.some((row) => row.id === focusPostId)) {
          const { data: focusRow } = await supabase
            .from("forum_posts")
            .select(POST_SELECT_FIELDS)
            .eq("id", focusPostId)
            .maybeSingle<PostRow>();

          if (focusRow) {
            mergedRows = [focusRow, ...rows];
          }
        }

        setPosts(mergedRows.map((row) => toViewPost(row, currentUser.id)));
        const last = rows[rows.length - 1];
        setOldestCursor(last?.created_at ?? null);
        setHasMore(rows.length === PAGE_SIZE);
      }

      setIsLoadingPosts(false);
    }

    void initialLoad();

    return () => {
      isCancelled = true;
    };
  }, [currentUser.id, focusPostId, supabase]);

  useEffect(() => {
    if (typeof window === "undefined" || posts.length === 0) {
      return;
    }

    const hash = window.location.hash.replace(/^#/, "");
    if (!hash) {
      return;
    }

    const element = document.getElementById(hash);
    if (element) {
      element.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }, [posts]);

  useEffect(() => {
    const query = placeQuery.trim();
    if (query.length < 2) {
      return;
    }

    const timeoutId = window.setTimeout(async () => {
      setIsSearchingPlace(true);
      setPlaceError(null);

      try {
        const response = await fetch(`/api/goong/autocomplete?input=${encodeURIComponent(query)}`, {
          method: "GET",
          cache: "no-store",
        });
        const data = (await response.json()) as GoongAutocompleteResponse;

        if (!response.ok) {
          setPlaceError(data.error ?? "Không thể tìm kiếm địa điểm check-in.");
          setPlacePredictions([]);
          return;
        }

        setPlacePredictions(Array.isArray(data.predictions) ? data.predictions : []);
      } catch {
        setPlaceError("Lỗi mạng khi tìm địa điểm.");
        setPlacePredictions([]);
      } finally {
        setIsSearchingPlace(false);
      }
    }, 350);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [placeQuery]);

  useEffect(() => {
    const query = eventQuery.trim();
    if (query.length < 2) {
      return;
    }

    const timeoutId = window.setTimeout(async () => {
      setIsSearchingEvent(true);

      const { data, error } = await supabase
        .from("event_records")
        .select("id, event_name")
        .eq("is_approved", true)
        .ilike("event_name", `%${query}%`)
        .order("event_name", { ascending: true })
        .limit(8);

      if (error) {
        setEventOptions([]);
      } else {
        setEventOptions((data ?? []) as EventSearchOption[]);
      }

      setIsSearchingEvent(false);
    }, 300);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [eventQuery, supabase]);

  const loadMore = useCallback(async () => {
    if (!hasMore || isLoadingMore || !oldestCursor) return;

    setIsLoadingMore(true);

    const { data, error } = await supabase
      .from("forum_posts")
      .select(POST_SELECT_FIELDS)
      .order("created_at", { ascending: false })
      .lt("created_at", oldestCursor)
      .limit(PAGE_SIZE);

    if (!error) {
      const rows = (data ?? []) as PostRow[];
      setPosts((prev) => [...prev, ...rows.map((row) => toViewPost(row, currentUser.id))]);
      if (rows.length > 0) {
        const last = rows[rows.length - 1];
        setOldestCursor(last?.created_at ?? null);
      }
      setHasMore(rows.length === PAGE_SIZE);
    }

    setIsLoadingMore(false);
  }, [hasMore, isLoadingMore, oldestCursor, supabase, currentUser.id]);

  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          void loadMore();
        }
      },
      { rootMargin: "200px" },
    );

    observer.observe(sentinel);
    return () => {
      observer.disconnect();
    };
  }, [loadMore]);

  function resetComposer() {
    setContent("");
    setImageFiles([]);
    setCheckinPlace(null);
    setPlaceQuery("");
    setPlacePredictions([]);
    setEventQuery("");
    setEventOptions([]);
    setSelectedEvent(null);
  }

  async function uploadImages() {
    const urls: string[] = [];

    for (const file of imageFiles) {
      const path = `${currentUser.id}/${Date.now()}-${crypto.randomUUID()}.${extFromFile(file)}`;
      const { error: uploadError } = await supabase.storage.from("forum-posts").upload(path, file, {
        upsert: false,
        contentType: file.type || undefined,
      });

      if (uploadError) {
        throw uploadError;
      }

      const { data } = supabase.storage.from("forum-posts").getPublicUrl(path);
      urls.push(data.publicUrl);
    }

    return urls;
  }

  async function handleCreatePost(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    setComposerError(null);
    setComposerStatus(null);

    if (!content.trim() && imageFiles.length === 0) {
      setComposerError("Bài đăng cần có nội dung hoặc ít nhất 1 ảnh.");
      return;
    }

    setCreating(true);

    try {
      const imageUrls = await uploadImages();

      const { data: insertedRows, error } = await supabase
        .from("forum_posts")
        .insert({
          author_id: currentUser.id,
          author_name: currentUser.displayName,
          author_avatar_url: currentUser.avatarUrl || null,
          content: content.trim(),
          image_urls: imageUrls,
          checkin_place_id: checkinPlace?.id ?? null,
          checkin_place_name: checkinPlace?.name ?? null,
          checkin_place_address: checkinPlace?.address ?? null,
          checkin_latitude: checkinPlace?.lat ?? null,
          checkin_longitude: checkinPlace?.lng ?? null,
          event_record_id: selectedEvent?.id ?? null,
        })
        .select("id, created_at")
        .single();

      if (error) {
        throw error;
      }

      const capturedCheckin = checkinPlace;
      const capturedEvent = selectedEvent;
      const capturedContent = content.trim();
      const newPost: ForumPostView = {
        id: insertedRows?.id ?? crypto.randomUUID(),
        authorId: currentUser.id,
        authorName: currentUser.displayName,
        authorAvatarUrl: currentUser.avatarUrl || "",
        content: capturedContent,
        imageUrls: imageUrls,
        checkinPlace: capturedCheckin
          ? {
              id: capturedCheckin.id,
              name: capturedCheckin.name,
              address: capturedCheckin.address,
              lat: capturedCheckin.lat,
              lng: capturedCheckin.lng,
            }
          : null,
        eventRecord: capturedEvent
          ? { id: capturedEvent.id, eventName: capturedEvent.event_name }
          : null,
        createdAt: insertedRows?.created_at ?? new Date().toISOString(),
        likeCount: 0,
        commentCount: 0,
        likedByCurrentUser: false,
        comments: [],
      };

      setPosts((prev) => [newPost, ...prev]);
      resetComposer();
      setComposerStatus("Đã đăng bài thành công.");
    } catch (err) {
      setComposerError(err instanceof Error ? err.message : "Không thể tạo bài đăng.");
    } finally {
      setCreating(false);
    }
  }

  async function handleUseCurrentLocation() {
    setPlaceError(null);

    if (!navigator.geolocation) {
      setPlaceError("Thiết bị không hỗ trợ định vị.");
      return;
    }

    await new Promise<void>((resolve) => {
      navigator.geolocation.getCurrentPosition(
        async (position) => {
          const lat = position.coords.latitude;
          const lng = position.coords.longitude;

          try {
            const response = await fetch(
              `/api/goong/reverse-geocode?lat=${encodeURIComponent(String(lat))}&lng=${encodeURIComponent(String(lng))}`,
              {
                method: "GET",
                cache: "no-store",
              },
            );
            const data = (await response.json()) as GoongReverseGeocodeResponse;

            if (!response.ok) {
              setPlaceError(data.error ?? "Không thể lấy địa chỉ từ vị trí hiện tại.");
              resolve();
              return;
            }

            setCheckinPlace({
              id: data.place_id ?? `latlng:${lat},${lng}`,
              name: data.name ?? "Vị trí hiện tại",
              address: data.formatted_address ?? "",
              lat,
              lng,
            });
            setPlaceQuery(data.formatted_address ?? data.name ?? "");
            setPlacePredictions([]);
          } catch {
            setPlaceError("Lỗi mạng khi lấy thông tin vị trí.");
          }

          resolve();
        },
        () => {
          setPlaceError("Không lấy được vị trí hiện tại. Hãy kiểm tra quyền định vị.");
          resolve();
        },
        {
          enableHighAccuracy: false,
          timeout: 15000,
          maximumAge: 10000,
        },
      );
    });
  }

  async function handleSelectPrediction(prediction: GoongPrediction) {
    if (!prediction.place_id) {
      return;
    }

    setPlaceError(null);
    setPlacePredictions([]);
    setPlaceQuery(prediction.description ?? "");

    try {
      const response = await fetch(
        `/api/goong/place-detail?placeId=${encodeURIComponent(prediction.place_id)}`,
        {
          method: "GET",
          cache: "no-store",
        },
      );
      const data = (await response.json()) as GoongPlaceDetailResponse;

      if (!response.ok) {
        setPlaceError(data.error ?? "Không thể lấy chi tiết địa điểm.");
        return;
      }

      const latitude = data.result?.geometry?.location?.lat;
      const longitude = data.result?.geometry?.location?.lng;
      if (typeof latitude !== "number" || typeof longitude !== "number") {
        setPlaceError("Địa điểm không có tọa độ hợp lệ.");
        return;
      }

      setCheckinPlace({
        id: prediction.place_id,
        name: data.result?.name ?? prediction.description ?? "Địa điểm",
        address: data.result?.formatted_address ?? prediction.description ?? "",
        lat: latitude,
        lng: longitude,
      });
    } catch {
      setPlaceError("Lỗi mạng khi chọn địa điểm.");
    }
  }

  async function handleToggleLike(post: ForumPostView) {
    if (pendingLikePostId === post.id) return;

    const wasLiked = post.likedByCurrentUser;
    setPendingLikePostId(post.id);

    // Optimistic update
    setPosts((prev) =>
      prev.map((p) => {
        if (p.id !== post.id) return p;
        return {
          ...p,
          likedByCurrentUser: !wasLiked,
          likeCount: wasLiked ? p.likeCount - 1 : p.likeCount + 1,
        };
      }),
    );

    if (wasLiked) {
      const { error } = await supabase
        .from("forum_post_likes")
        .delete()
        .eq("post_id", post.id)
        .eq("user_id", currentUser.id);

      if (error) {
        // Revert on failure
        setPosts((prev) =>
          prev.map((p) => {
            if (p.id !== post.id) return p;
            return { ...p, likedByCurrentUser: true, likeCount: p.likeCount + 1 };
          }),
        );
      }
    } else {
      const { error } = await supabase.from("forum_post_likes").insert({
        post_id: post.id,
        user_id: currentUser.id,
      });

      if (error) {
        // Revert on failure
        setPosts((prev) =>
          prev.map((p) => {
            if (p.id !== post.id) return p;
            return { ...p, likedByCurrentUser: false, likeCount: p.likeCount - 1 };
          }),
        );
      }
    }

    setPendingLikePostId(null);
  }

  async function handleSendComment(postId: string) {
    const contentDraft = (commentDrafts[postId] ?? "").trim();
    if (!contentDraft || pendingCommentPostId === postId) {
      return;
    }

    const parentCommentId = replyTarget[postId] ?? null;
    const tempId = `optimistic-${Date.now()}`;
    const tempComment: ForumCommentView = {
      id: tempId,
      postId,
      parentCommentId,
      authorId: currentUser.id,
      authorName: currentUser.displayName,
      authorAvatarUrl: currentUser.avatarUrl || "",
      content: contentDraft,
      createdAt: new Date().toISOString(),
    };

    // Optimistic: append comment & clear draft immediately
    setPosts((prev) =>
      prev.map((p) => {
        if (p.id !== postId) return p;
        return {
          ...p,
          comments: [...p.comments, tempComment],
          commentCount: p.commentCount + 1,
        };
      }),
    );
    setCommentDrafts((prev) => ({ ...prev, [postId]: "" }));
    setReplyTarget((prev) => ({ ...prev, [postId]: null }));
    setPendingCommentPostId(postId);

    const { error } = await supabase.from("forum_post_comments").insert({
      post_id: postId,
      parent_comment_id: parentCommentId,
      author_id: currentUser.id,
      author_name: currentUser.displayName,
      author_avatar_url: currentUser.avatarUrl || null,
      content: contentDraft,
    });

    if (error) {
      // Revert optimistic comment on failure
      setPosts((prev) =>
        prev.map((p) => {
          if (p.id !== postId) return p;
          return {
            ...p,
            comments: p.comments.filter((c) => c.id !== tempId),
            commentCount: p.commentCount - 1,
          };
        }),
      );
      setCommentDrafts((prev) => ({ ...prev, [postId]: contentDraft }));
      setReplyTarget((prev) => ({ ...prev, [postId]: parentCommentId }));
    }

    setPendingCommentPostId(null);
  }

  return (
    <div className="grid gap-4 p-4 md:grid-cols-[minmax(0,42rem)_minmax(18rem,22rem)] md:gap-5 md:p-6">
      <section className="space-y-4">
        <div className="rounded-3xl border border-border bg-card p-4 shadow-sm md:p-5">
          <div className="mb-3 flex items-center gap-3">
            <span className="relative inline-flex size-11 shrink-0 items-center justify-center overflow-hidden rounded-full bg-muted text-sm font-semibold text-foreground">
              {currentUser.avatarUrl ? (
                <Image src={currentUser.avatarUrl} alt={currentUser.displayName} fill sizes="44px" className="object-cover" />
              ) : (
                currentUser.displayName.slice(0, 2).toUpperCase()
              )}
            </span>
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-foreground">{currentUser.displayName}</p>
              <p className="truncate text-xs text-muted-foreground">Chia sẻ điểm đến, khoảnh khắc và gợi ý của bạn</p>
            </div>
          </div>

          <form onSubmit={handleCreatePost} className="space-y-3">
            <Textarea
              value={content}
              onChange={(event) => setContent(event.target.value)}
              placeholder="Bạn vừa khám phá điều gì thú vị?"
              className="min-h-30 rounded-2xl"
            />

            <div className="grid gap-3 md:grid-cols-2">
              <label className="rounded-2xl border border-dashed border-border bg-muted/30 p-3 text-sm text-muted-foreground">
                <span className="mb-2 block text-xs font-semibold uppercase tracking-wide text-foreground">Ảnh bài đăng</span>
                <Input
                  type="file"
                  accept="image/*"
                  multiple
                  onChange={(event) => {
                    const files = Array.from(event.target.files ?? []).filter((file) => file.type.startsWith("image/"));
                    setImageFiles(files);
                  }}
                />
                {imageFiles.length > 0 && (
                  <p className="mt-2 text-xs">Đã chọn {imageFiles.length} ảnh.</p>
                )}
              </label>

              <div className="rounded-2xl border border-border bg-muted/20 p-3">
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-foreground">Check-in địa điểm</p>
                <div className="flex gap-2">
                  <Input
                    value={placeQuery}
                    onChange={(event) => {
                      setPlaceQuery(event.target.value);
                      if (event.target.value.trim().length < 2) {
                        setPlacePredictions([]);
                      }
                    }}
                    placeholder="Tìm địa điểm qua Goong"
                  />
                  <Button type="button" variant="outline" onClick={handleUseCurrentLocation}>
                    Vị trí tôi
                  </Button>
                </div>

                {isSearchingPlace && <p className="mt-2 text-xs text-muted-foreground">Đang tìm địa điểm...</p>}
                {placeError && <p className="mt-2 text-xs text-destructive">{placeError}</p>}

                {placePredictions.length > 0 && (
                  <div className="mt-2 max-h-36 space-y-1 overflow-y-auto rounded-xl border border-border bg-background p-2">
                    {placePredictions.map((prediction, index) => (
                      <button
                        key={`${prediction.place_id ?? index}`}
                        type="button"
                        className="w-full rounded-lg px-2 py-1.5 text-left text-xs text-foreground hover:bg-muted"
                        onClick={() => {
                          void handleSelectPrediction(prediction);
                        }}
                      >
                        {prediction.description ?? "Địa điểm"}
                      </button>
                    ))}
                  </div>
                )}

                {checkinPlace && (
                  <div className="mt-2 rounded-xl border border-border bg-background px-2 py-2 text-xs">
                    <p className="font-semibold text-foreground">{checkinPlace.name}</p>
                    {checkinPlace.address && <p className="text-muted-foreground">{checkinPlace.address}</p>}
                  </div>
                )}
              </div>
            </div>

            <div className="rounded-2xl border border-border bg-muted/20 p-3">
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-foreground">Check-in sự kiện</p>
              <Input
                value={eventQuery}
                onChange={(event) => {
                  const next = event.target.value;
                  setEventQuery(next);
                    if (next.trim().length < 2) {
                      setEventOptions([]);
                    }
                  if (!next.trim()) {
                    setSelectedEvent(null);
                  }
                }}
                placeholder="Tìm theo tên sự kiện"
              />
              {isSearchingEvent && <p className="mt-2 text-xs text-muted-foreground">Đang tìm sự kiện...</p>}
              {eventOptions.length > 0 && (
                <div className="mt-2 max-h-32 space-y-1 overflow-y-auto rounded-xl border border-border bg-background p-2">
                  {eventOptions.map((option) => (
                    <button
                      type="button"
                      key={option.id}
                      className="w-full rounded-lg px-2 py-1.5 text-left text-xs text-foreground hover:bg-muted"
                      onClick={() => {
                        setSelectedEvent(option);
                        setEventQuery(option.event_name);
                        setEventOptions([]);
                      }}
                    >
                      {option.event_name}
                    </button>
                  ))}
                </div>
              )}
              {selectedEvent && (
                <div className="mt-2 flex items-center justify-between rounded-xl border border-border bg-background px-2 py-2 text-xs">
                  <p className="font-semibold text-foreground">{selectedEvent.event_name}</p>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setSelectedEvent(null);
                      setEventQuery("");
                    }}
                  >
                    Bỏ chọn
                  </Button>
                </div>
              )}
            </div>

            {composerError && <p className="text-sm text-destructive">{composerError}</p>}
            {composerStatus && <p className="text-sm text-foreground">{composerStatus}</p>}

            <Button type="submit" disabled={creating} className="w-full rounded-2xl">
              {creating ? "Đang đăng..." : "Đăng bài"}
            </Button>
          </form>
        </div>

        {isLoadingPosts && (
          <div className="rounded-3xl border border-border bg-card p-6 text-sm text-muted-foreground">Đang tải bài đăng...</div>
        )}

        {feedError && (
          <div className="rounded-3xl border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">
            {feedError}
          </div>
        )}

        {!isLoadingPosts && !feedError && posts.length === 0 && (
          <div className="rounded-3xl border border-border bg-card p-8 text-center">
            <p className="text-base font-semibold text-foreground">Chưa có bài đăng nào</p>
            <p className="mt-1 text-sm text-muted-foreground">Hãy là người đầu tiên mở chủ đề cho cộng đồng.</p>
          </div>
        )}

        <div className="space-y-4">
          {posts.map((post) => {
            const rootComments = post.comments.filter((comment) => !comment.parentCommentId);
            const repliesByParent = new Map<string, ForumCommentView[]>();

            for (const comment of post.comments) {
              if (!comment.parentCommentId) continue;
              const current = repliesByParent.get(comment.parentCommentId) ?? [];
              repliesByParent.set(comment.parentCommentId, [...current, comment]);
            }

            return (
              <article id={`post-${post.id}`} key={post.id} className="overflow-hidden rounded-3xl border border-border bg-card shadow-sm">
                <header className="flex items-center gap-3 border-b border-border/70 px-4 py-3 md:px-5">
                  <span className="relative inline-flex size-10 shrink-0 items-center justify-center overflow-hidden rounded-full bg-muted text-xs font-semibold text-foreground">
                    {post.authorAvatarUrl ? (
                      <Image src={post.authorAvatarUrl} alt={post.authorName} fill sizes="40px" className="object-cover" />
                    ) : (
                      post.authorName.slice(0, 2).toUpperCase()
                    )}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-foreground">{post.authorName}</p>
                    <p className="text-xs text-muted-foreground">{formatDateTime(post.createdAt)}</p>
                  </div>
                </header>

                <div className="space-y-3 px-4 py-4 md:px-5">
                  {post.content && <p className="whitespace-pre-wrap text-sm leading-relaxed text-foreground">{post.content}</p>}

                  {(post.checkinPlace || post.eventRecord) && (
                    <div className="space-y-2 rounded-2xl border border-border bg-muted/30 px-3 py-2">
                      {post.checkinPlace && (
                        <p className="text-xs text-foreground">
                          📍 <span className="font-semibold">{post.checkinPlace.name}</span>
                          {post.checkinPlace.address ? ` · ${post.checkinPlace.address}` : ""}
                        </p>
                      )}
                      {post.eventRecord && (
                        <p className="text-xs text-foreground">
                          🎫 Check-in sự kiện: <span className="font-semibold">{post.eventRecord.eventName}</span>
                        </p>
                      )}
                    </div>
                  )}

                  {post.imageUrls.length > 0 && (
                    <div
                      className={cn(
                        "grid gap-2",
                        post.imageUrls.length === 1 && "grid-cols-1",
                        post.imageUrls.length === 2 && "grid-cols-2",
                        post.imageUrls.length >= 3 && "grid-cols-2 md:grid-cols-3",
                      )}
                    >
                      {post.imageUrls.map((url, index) => (
                        <div key={`${post.id}-img-${index}`} className="relative h-44 overflow-hidden rounded-2xl bg-muted md:h-52">
                          <Image
                            src={url}
                            alt={`post-${post.id}-${index}`}
                            fill
                            sizes="(max-width: 768px) 50vw, 28vw"
                            className="object-cover"
                          />
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="flex items-center justify-between border-t border-border/70 px-4 py-2.5 text-xs text-muted-foreground md:px-5">
                  <span>{post.likeCount} lượt thích</span>
                  <span>{post.commentCount} bình luận</span>
                </div>

                <div className="flex gap-2 border-t border-border/70 px-4 py-2.5 md:px-5">
                  <Button
                    type="button"
                    variant={post.likedByCurrentUser ? "default" : "outline"}
                    size="sm"
                    disabled={pendingLikePostId === post.id}
                    onClick={() => {
                      void handleToggleLike(post);
                    }}
                    className="rounded-xl"
                  >
                    {post.likedByCurrentUser ? "Đã thích" : "Thích"}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="rounded-xl"
                    onClick={() => {
                      const textarea = document.getElementById(`comment-input-${post.id}`);
                      textarea?.focus();
                    }}
                  >
                    Bình luận
                  </Button>
                </div>

                <div className="space-y-3 border-t border-border/70 px-4 py-3 md:px-5">
                  {rootComments.map((comment) => {
                    const replies = repliesByParent.get(comment.id) ?? [];

                    return (
                      <div id={`comment-${comment.id}`} key={comment.id} className="space-y-2">
                        <div className="rounded-2xl bg-muted/40 p-3">
                          <div className="mb-1 flex items-center justify-between gap-2">
                            <p className="text-xs font-semibold text-foreground">{comment.authorName}</p>
                            <p className="text-[11px] text-muted-foreground">{formatDateTime(comment.createdAt)}</p>
                          </div>
                          <p className="text-sm text-foreground">{comment.content}</p>
                          <button
                            type="button"
                            className="mt-2 text-[11px] font-medium text-primary"
                            onClick={() => {
                              setReplyTarget((prev) => ({ ...prev, [post.id]: comment.id }));
                            }}
                          >
                            Trả lời
                          </button>
                        </div>

                        {replies.length > 0 && (
                          <div className="space-y-2 pl-4 md:pl-6">
                            {replies.map((reply) => (
                              <div id={`comment-${reply.id}`} key={reply.id} className="rounded-2xl border border-border bg-background p-3">
                                <div className="mb-1 flex items-center justify-between gap-2">
                                  <p className="text-xs font-semibold text-foreground">{reply.authorName}</p>
                                  <p className="text-[11px] text-muted-foreground">{formatDateTime(reply.createdAt)}</p>
                                </div>
                                <p className="text-sm text-foreground">{reply.content}</p>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}

                  <div className="space-y-2 rounded-2xl border border-border bg-background p-2">
                    {replyTarget[post.id] && (
                      <div className="flex items-center justify-between rounded-xl bg-muted px-2 py-1.5 text-xs">
                        <p className="text-muted-foreground">Đang trả lời bình luận</p>
                        <button
                          type="button"
                          className="font-semibold text-foreground"
                          onClick={() => {
                            setReplyTarget((prev) => ({ ...prev, [post.id]: null }));
                          }}
                        >
                          Hủy
                        </button>
                      </div>
                    )}
                    <Textarea
                      id={`comment-input-${post.id}`}
                      value={commentDrafts[post.id] ?? ""}
                      onChange={(event) => {
                        const next = event.target.value;
                        setCommentDrafts((prev) => ({ ...prev, [post.id]: next }));
                      }}
                      placeholder="Viết bình luận..."
                      className="min-h-20 border-0 bg-transparent shadow-none focus-visible:ring-0"
                    />
                    <div className="flex justify-end">
                      <Button
                        type="button"
                        size="sm"
                        disabled={pendingCommentPostId === post.id}
                        onClick={() => {
                          void handleSendComment(post.id);
                        }}
                      >
                        Gửi
                      </Button>
                    </div>
                  </div>
                </div>
              </article>
            );
          })}
        </div>

        <div ref={sentinelRef} className="py-2 text-center text-xs text-muted-foreground">
          {isLoadingMore && "Đang tải thêm..."}
          {!hasMore && posts.length > 0 && !isLoadingPosts && "Đã tải hết bài đăng."}
        </div>
      </section>

      <aside className="hidden md:block">
        <div className="sticky top-22 space-y-3 rounded-3xl border border-border bg-card p-4 shadow-sm">
          <p className="text-sm font-semibold text-foreground">Diễn đàn cộng đồng</p>
          <p className="text-xs leading-relaxed text-muted-foreground">
            Chia sẻ trải nghiệm thực tế, check-in địa điểm và kết nối cùng những người có cùng đam mê khám phá.
          </p>
          <div className="rounded-2xl bg-muted/40 p-3 text-xs text-muted-foreground">
            <p className="font-semibold text-foreground">Mẹo đăng bài hiệu quả</p>
            <p className="mt-1">1. Đính kèm ảnh thật để tăng độ tin cậy.</p>
            <p className="mt-1">2. Check-in đúng địa điểm hoặc sự kiện để người khác dễ theo dõi.</p>
            <p className="mt-1">3. Bình luận văn minh, tôn trọng cộng đồng.</p>
          </div>
        </div>
      </aside>
    </div>
  );
}

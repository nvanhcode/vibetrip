"use client";

import {
  Calendar03Icon,
  Comment01Icon,
  Delete02Icon,
  HeartAddIcon,
  HeartCheckIcon,
  MapPinpoint01Icon,
  UserAdd01Icon,
  UserCheck01Icon,
  UserMinus01Icon,
  UserRemove01Icon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import Image from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { UserRoutesList } from "@/components/app/user-routes-list";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";
import type { UserRoute } from "@/models/route.model";

// ─── Types ──────────────────────────────────────────────────────────────────

type CurrentUser = {
  id: string;
  displayName: string;
  avatarUrl: string;
};

type TargetUser = {
  id: string;
  displayName: string;
  avatarUrl: string;
  postCount: number;
  friendCount: number;
};

type FriendshipState = {
  id: string;
  requesterId: string;
  addresseeId: string;
  status: "pending" | "accepted" | "declined" | "blocked";
} | null;

type MutualFriend = {
  user_id: string;
  display_name: string;
  avatar_url: string | null;
};

type UserProfileProps = {
  currentUser: CurrentUser;
  targetUser: TargetUser;
  initialFriendship: FriendshipState;
  initialMutualFriends: MutualFriend[];
  initialRoutes: UserRoute[];
};

type LikeRow = { user_id: string };
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
  | { id: string; event_name: string }
  | { id: string; event_name: string }[]
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

type PostView = {
  id: string;
  authorId: string;
  authorName: string;
  authorAvatarUrl: string;
  content: string;
  imageUrls: string[];
  checkinPlace: { id: string; name: string; address: string; lat: number; lng: number } | null;
  eventRecord: { id: string; eventName: string } | null;
  createdAt: string;
  likeCount: number;
  commentCount: number;
  likedByCurrentUser: boolean;
  comments: CommentView[];
};

type CommentView = {
  id: string;
  postId: string;
  parentCommentId: string | null;
  authorId: string;
  authorName: string;
  authorAvatarUrl: string;
  content: string;
  createdAt: string;
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

function firstRelation<T>(value: T | T[] | null): T | null {
  if (!value) return null;
  if (Array.isArray(value)) return value[0] ?? null;
  return value;
}

function toPostView(row: PostRow, currentUserId: string): PostView {
  const relation = firstRelation(row.event_records);
  const comments = (row.forum_post_comments ?? [])
    .slice()
    .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
    .map((c) => ({
      id: c.id,
      postId: c.post_id,
      parentCommentId: c.parent_comment_id,
      authorId: c.author_id,
      authorName: c.author_name || "Người dùng",
      authorAvatarUrl: c.author_avatar_url ?? "",
      content: c.content,
      createdAt: c.created_at,
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
    eventRecord: relation ? { id: relation.id, eventName: relation.event_name } : null,
    createdAt: row.created_at,
    likeCount: row.forum_post_likes?.length ?? 0,
    commentCount: comments.length,
    likedByCurrentUser: (row.forum_post_likes ?? []).some((l) => l.user_id === currentUserId),
    comments,
  };
}

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("vi-VN", { dateStyle: "short", timeStyle: "short" }).format(
    new Date(value),
  );
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

// ─── PostBody ─────────────────────────────────────────────────────────────────

function PostBody({ post }: { post: PostView }) {
  return (
    <div className="space-y-3">
      {post.content && (
        <p className="whitespace-pre-wrap text-sm leading-relaxed text-foreground">{post.content}</p>
      )}
      {(post.checkinPlace || post.eventRecord) && (
        <div className="space-y-2 rounded-2xl border border-border bg-muted/30 px-3 py-2">
          {post.checkinPlace && (
            <p className="flex items-start gap-2 text-xs text-foreground">
              <HugeiconsIcon
                icon={MapPinpoint01Icon}
                strokeWidth={1.8}
                className="mt-0.5 size-3.5 shrink-0 text-muted-foreground"
              />
              <span>
                <span className="font-semibold">{post.checkinPlace.name}</span>
                {post.checkinPlace.address ? ` · ${post.checkinPlace.address}` : ""}
              </span>
            </p>
          )}
          {post.eventRecord && (
            <p className="flex items-start gap-2 text-xs text-foreground">
              <HugeiconsIcon
                icon={Calendar03Icon}
                strokeWidth={1.8}
                className="mt-0.5 size-3.5 shrink-0 text-muted-foreground"
              />
              <span>
                Check-in sự kiện:{" "}
                <span className="font-semibold">{post.eventRecord.eventName}</span>
              </span>
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
            <div
              key={`${post.id}-img-${index}`}
              className="relative h-44 overflow-hidden rounded-2xl bg-muted md:h-52"
            >
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
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function UserProfile({
  currentUser,
  targetUser,
  initialFriendship,
  initialMutualFriends,
  initialRoutes,
}: UserProfileProps) {
  const supabase = useMemo(() => createClient(), []);
  const isOwnProfile = currentUser.id === targetUser.id;

  // ── Friendship state ──────────────────────────────────────────────────────
  const [friendship, setFriendship] = useState<FriendshipState>(initialFriendship);
  const [friendshipPending, setFriendshipPending] = useState(false);

  // ── Posts state ───────────────────────────────────────────────────────────
  const [posts, setPosts] = useState<PostView[]>([]);
  const [isLoadingPosts, setIsLoadingPosts] = useState(true);
  const [feedError, setFeedError] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [oldestCursor, setOldestCursor] = useState<string | null>(null);
  const sentinelRef = useRef<HTMLDivElement>(null);

  // ── Stats state ───────────────────────────────────────────────────────────
  const [postCount, setPostCount] = useState(targetUser.postCount);
  const [friendCount, setFriendCount] = useState(targetUser.friendCount);

  // ── Delete confirm ────────────────────────────────────────────────────────
  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // ── Likes ─────────────────────────────────────────────────────────────────
  const [pendingLikePostId, setPendingLikePostId] = useState<string | null>(null);

  // ── Comments dialog ───────────────────────────────────────────────────────
  const [openPostId, setOpenPostId] = useState<string | null>(null);
  const [commentDrafts, setCommentDrafts] = useState<Record<string, string>>({});
  const [pendingCommentPostId, setPendingCommentPostId] = useState<string | null>(null);

  const selectedPost = useMemo(
    () => (openPostId ? posts.find((p) => p.id === openPostId) ?? null : null),
    [openPostId, posts],
  );
  const dialogRootComments = useMemo(
    () => selectedPost?.comments.filter((c) => !c.parentCommentId) ?? [],
    [selectedPost],
  );
  const dialogRepliesByParent = useMemo(() => {
    const map = new Map<string, CommentView[]>();
    for (const c of selectedPost?.comments ?? []) {
      if (!c.parentCommentId) continue;
      map.set(c.parentCommentId, [...(map.get(c.parentCommentId) ?? []), c]);
    }
    return map;
  }, [selectedPost]);

  // ── Load posts ────────────────────────────────────────────────────────────
  useEffect(() => {
    let cancelled = false;

    async function load() {
      setIsLoadingPosts(true);
      const { data, error } = await supabase
        .from("forum_posts")
        .select(POST_SELECT_FIELDS)
        .eq("author_id", targetUser.id)
        .order("created_at", { ascending: false })
        .limit(PAGE_SIZE);

      if (cancelled) return;

      if (error) {
        setFeedError(error.message);
      } else {
        const rows = (data ?? []) as PostRow[];
        setPosts(rows.map((r) => toPostView(r, currentUser.id)));
        const last = rows[rows.length - 1];
        setOldestCursor(last?.created_at ?? null);
        setHasMore(rows.length === PAGE_SIZE);
      }

      setIsLoadingPosts(false);
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [targetUser.id, currentUser.id, supabase]);

  // ── Infinite scroll ───────────────────────────────────────────────────────
  const loadMore = useCallback(async () => {
    if (!hasMore || isLoadingMore || !oldestCursor) return;
    setIsLoadingMore(true);

    const { data, error } = await supabase
      .from("forum_posts")
      .select(POST_SELECT_FIELDS)
      .eq("author_id", targetUser.id)
      .order("created_at", { ascending: false })
      .lt("created_at", oldestCursor)
      .limit(PAGE_SIZE);

    if (!error) {
      const rows = (data ?? []) as PostRow[];
      setPosts((prev) => [...prev, ...rows.map((r) => toPostView(r, currentUser.id))]);
      if (rows.length > 0) setOldestCursor(rows[rows.length - 1]?.created_at ?? null);
      setHasMore(rows.length === PAGE_SIZE);
    }

    setIsLoadingMore(false);
  }, [hasMore, isLoadingMore, oldestCursor, supabase, targetUser.id, currentUser.id]);

  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) void loadMore();
      },
      { rootMargin: "200px" },
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [loadMore]);

  // ── Friend actions ────────────────────────────────────────────────────────
  async function handleSendRequest() {
    if (friendshipPending) return;
    setFriendshipPending(true);
    const { data, error } = await supabase
      .from("user_friendships")
      .insert({ requester_id: currentUser.id, addressee_id: targetUser.id })
      .select("id, requester_id, addressee_id, status")
      .single();

    if (!error && data) {
      setFriendship({
        id: data.id,
        requesterId: data.requester_id,
        addresseeId: data.addressee_id,
        status: data.status as "pending",
      });
    }
    setFriendshipPending(false);
  }

  async function handleAcceptRequest() {
    if (!friendship || friendshipPending) return;
    setFriendshipPending(true);
    const { error } = await supabase
      .from("user_friendships")
      .update({ status: "accepted" })
      .eq("id", friendship.id);

    if (!error) {
      setFriendship((prev) => (prev ? { ...prev, status: "accepted" } : prev));
      setFriendCount((c) => c + 1);
    }
    setFriendshipPending(false);
  }

  async function handleDeclineRequest() {
    if (!friendship || friendshipPending) return;
    setFriendshipPending(true);
    const { error } = await supabase
      .from("user_friendships")
      .update({ status: "declined" })
      .eq("id", friendship.id);

    if (!error) {
      setFriendship(null);
    }
    setFriendshipPending(false);
  }

  async function handleUnfriend() {
    if (!friendship || friendshipPending) return;
    setFriendshipPending(true);
    const { error } = await supabase
      .from("user_friendships")
      .delete()
      .eq("id", friendship.id);

    if (!error) {
      setFriendship(null);
      setFriendCount((c) => Math.max(0, c - 1));
    }
    setFriendshipPending(false);
  }

  async function handleCancelRequest() {
    if (!friendship || friendshipPending) return;
    setFriendshipPending(true);
    const { error } = await supabase
      .from("user_friendships")
      .delete()
      .eq("id", friendship.id);

    if (!error) setFriendship(null);
    setFriendshipPending(false);
  }

  // ── Delete post ───────────────────────────────────────────────────────────
  async function handleDeletePost() {
    if (!deleteTargetId || isDeleting) return;
    setIsDeleting(true);

    const { error } = await supabase
      .from("forum_posts")
      .delete()
      .eq("id", deleteTargetId)
      .eq("author_id", currentUser.id);

    if (!error) {
      setPosts((prev) => prev.filter((p) => p.id !== deleteTargetId));
      setPostCount((c) => Math.max(0, c - 1));
    }

    setIsDeleting(false);
    setDeleteTargetId(null);
  }

  // ── Like toggle ───────────────────────────────────────────────────────────
  async function handleToggleLike(post: PostView) {
    if (pendingLikePostId === post.id) return;
    const wasLiked = post.likedByCurrentUser;
    setPendingLikePostId(post.id);

    setPosts((prev) =>
      prev.map((p) =>
        p.id !== post.id
          ? p
          : { ...p, likedByCurrentUser: !wasLiked, likeCount: wasLiked ? p.likeCount - 1 : p.likeCount + 1 },
      ),
    );

    if (wasLiked) {
      const { error } = await supabase
        .from("forum_post_likes")
        .delete()
        .eq("post_id", post.id)
        .eq("user_id", currentUser.id);
      if (error) {
        setPosts((prev) =>
          prev.map((p) =>
            p.id !== post.id ? p : { ...p, likedByCurrentUser: true, likeCount: p.likeCount + 1 },
          ),
        );
      }
    } else {
      const { error } = await supabase
        .from("forum_post_likes")
        .insert({ post_id: post.id, user_id: currentUser.id });
      if (error) {
        setPosts((prev) =>
          prev.map((p) =>
            p.id !== post.id ? p : { ...p, likedByCurrentUser: false, likeCount: p.likeCount - 1 },
          ),
        );
      }
    }

    setPendingLikePostId(null);
  }

  // ── Comment send ──────────────────────────────────────────────────────────
  async function handleSendComment(postId: string) {
    const content = (commentDrafts[postId] ?? "").trim();
    if (!content || pendingCommentPostId === postId) return;

    const tempId = `optimistic-${Date.now()}`;
    const tempComment: CommentView = {
      id: tempId,
      postId,
      parentCommentId: null,
      authorId: currentUser.id,
      authorName: currentUser.displayName,
      authorAvatarUrl: currentUser.avatarUrl,
      content,
      createdAt: new Date().toISOString(),
    };

    setPosts((prev) =>
      prev.map((p) =>
        p.id !== postId
          ? p
          : { ...p, comments: [...p.comments, tempComment], commentCount: p.commentCount + 1 },
      ),
    );
    setCommentDrafts((prev) => ({ ...prev, [postId]: "" }));
    setPendingCommentPostId(postId);

    const { error } = await supabase.from("forum_post_comments").insert({
      post_id: postId,
      parent_comment_id: null,
      author_id: currentUser.id,
      author_name: currentUser.displayName,
      author_avatar_url: currentUser.avatarUrl || null,
      content,
    });

    if (error) {
      setPosts((prev) =>
        prev.map((p) =>
          p.id !== postId
            ? p
            : {
                ...p,
                comments: p.comments.filter((c) => c.id !== tempId),
                commentCount: p.commentCount - 1,
              },
        ),
      );
      setCommentDrafts((prev) => ({ ...prev, [postId]: content }));
    }

    setPendingCommentPostId(null);
  }

  // ── Friendship button render ───────────────────────────────────────────────
  function renderFriendButton() {
    if (isOwnProfile) return null;

    if (!friendship) {
      return (
        <Button
          size="sm"
          className="rounded-xl"
          disabled={friendshipPending}
          onClick={() => void handleSendRequest()}
        >
          <HugeiconsIcon icon={UserAdd01Icon} strokeWidth={1.8} className="size-4" />
          Kết bạn
        </Button>
      );
    }

    if (friendship.status === "accepted") {
      return (
        <Button
          size="sm"
          variant="outline"
          className="rounded-xl"
          disabled={friendshipPending}
          onClick={() => void handleUnfriend()}
        >
          <HugeiconsIcon icon={UserMinus01Icon} strokeWidth={1.8} className="size-4" />
          Huỷ kết bạn
        </Button>
      );
    }

    if (friendship.status === "pending") {
      // I sent the request
      if (friendship.requesterId === currentUser.id) {
        return (
          <Button
            size="sm"
            variant="outline"
            className="rounded-xl"
            disabled={friendshipPending}
            onClick={() => void handleCancelRequest()}
          >
            <HugeiconsIcon icon={UserRemove01Icon} strokeWidth={1.8} className="size-4" />
            Huỷ lời mời
          </Button>
        );
      }
      // They sent the request to me
      return (
        <div className="flex gap-2">
          <Button
            size="sm"
            className="rounded-xl"
            disabled={friendshipPending}
            onClick={() => void handleAcceptRequest()}
          >
            <HugeiconsIcon icon={UserCheck01Icon} strokeWidth={1.8} className="size-4" />
            Chấp nhận
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="rounded-xl"
            disabled={friendshipPending}
            onClick={() => void handleDeclineRequest()}
          >
            Từ chối
          </Button>
        </div>
      );
    }

    // declined / blocked – allow re-sending
    return (
      <Button
        size="sm"
        className="rounded-xl"
        disabled={friendshipPending}
        onClick={() => void handleSendRequest()}
      >
        <HugeiconsIcon icon={UserAdd01Icon} strokeWidth={1.8} className="size-4" />
        Kết bạn
      </Button>
    );
  }

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <div className="p-4 md:p-6">
      {/* Profile header card */}
      <div className="mb-6 overflow-hidden rounded-3xl border border-border bg-card shadow-sm">
        <div className="flex flex-col gap-4 p-5 sm:flex-row sm:items-start sm:gap-5">
          <span className="relative inline-flex size-20 shrink-0 items-center justify-center overflow-hidden rounded-full bg-muted text-xl font-bold text-foreground sm:size-24">
            {targetUser.avatarUrl ? (
              <Image
                src={targetUser.avatarUrl}
                alt={targetUser.displayName}
                fill
                sizes="96px"
                className="object-cover"
              />
            ) : (
              targetUser.displayName.slice(0, 2).toUpperCase()
            )}
          </span>

          <div className="min-w-0 flex-1 space-y-3">
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="text-lg font-bold text-foreground sm:text-xl">
                {targetUser.displayName}
              </h1>
              {renderFriendButton()}
            </div>

            <div className="flex gap-6 text-sm">
              <div className="text-center">
                <p className="text-base font-bold text-foreground">{postCount}</p>
                <p className="text-xs text-muted-foreground">bài đăng</p>
              </div>
              <div className="text-center">
                <p className="text-base font-bold text-foreground">{friendCount}</p>
                <p className="text-xs text-muted-foreground">bạn bè</p>
              </div>
            </div>
          </div>
        </div>

        {/* Mutual friends strip */}
        {!isOwnProfile && initialMutualFriends.length > 0 && (
          <div className="border-t border-border/60 px-5 py-3">
            <p className="mb-2 text-xs font-semibold text-muted-foreground">
              {initialMutualFriends.length} bạn bè chung
            </p>
            <div className="flex flex-wrap gap-2">
              {initialMutualFriends.map((mf) => (
                <Link
                  key={mf.user_id}
                  href={`/profile/${mf.user_id}`}
                  className="flex items-center gap-1.5 rounded-full border border-border bg-muted/40 px-2.5 py-1 text-xs text-foreground transition-colors hover:bg-muted"
                >
                  <span className="relative inline-flex size-5 shrink-0 items-center justify-center overflow-hidden rounded-full bg-muted text-[9px] font-bold text-foreground">
                    {mf.avatar_url ? (
                      <Image
                        src={mf.avatar_url}
                        alt={mf.display_name}
                        fill
                        sizes="20px"
                        className="object-cover"
                      />
                    ) : (
                      mf.display_name.slice(0, 2).toUpperCase()
                    )}
                  </span>
                  {mf.display_name}
                </Link>
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-5">
        <div className="order-2 space-y-4 xl:order-1 xl:col-span-3">
          {/* Posts feed */}
        {isLoadingPosts && (
          <div className="rounded-3xl border border-border bg-card p-6 text-sm text-muted-foreground">
            Đang tải bài đăng...
          </div>
        )}

        {feedError && (
          <div className="rounded-3xl border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">
            {feedError}
          </div>
        )}

        {!isLoadingPosts && !feedError && posts.length === 0 && (
          <div className="rounded-3xl border border-border bg-card p-8 text-center">
            <p className="text-base font-semibold text-foreground">Chưa có bài đăng nào</p>
            <p className="mt-1 text-sm text-muted-foreground">
              {isOwnProfile ? "Hãy chia sẻ điều gì đó với cộng đồng." : "Người dùng này chưa đăng bài nào."}
            </p>
          </div>
        )}

        {posts.map((post) => (
          <article
            key={post.id}
            className="overflow-hidden rounded-3xl border border-border bg-card shadow-sm"
          >
            <header className="flex items-center gap-3 border-b border-border/70 px-4 py-3 md:px-5">
              <span className="relative inline-flex size-10 shrink-0 items-center justify-center overflow-hidden rounded-full bg-muted text-xs font-semibold text-foreground">
                {post.authorAvatarUrl ? (
                  <Image
                    src={post.authorAvatarUrl}
                    alt={post.authorName}
                    fill
                    sizes="40px"
                    className="object-cover"
                  />
                ) : (
                  post.authorName.slice(0, 2).toUpperCase()
                )}
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-foreground">{post.authorName}</p>
                <p className="text-xs text-muted-foreground">{formatDateTime(post.createdAt)}</p>
              </div>
              {isOwnProfile && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="shrink-0 rounded-xl text-destructive hover:bg-destructive/10 hover:text-destructive"
                  onClick={() => setDeleteTargetId(post.id)}
                >
                  <HugeiconsIcon icon={Delete02Icon} strokeWidth={1.8} className="size-4" />
                  Xoá
                </Button>
              )}
            </header>

            <div className="space-y-3 px-4 py-4 md:px-5">
              <PostBody post={post} />
            </div>

            <div className="flex items-center justify-between border-t border-border/70 px-4 py-2.5 text-xs text-muted-foreground md:px-5">
              <span className="flex items-center gap-1.5">
                <HugeiconsIcon icon={HeartAddIcon} strokeWidth={1.8} className="size-3.5" />
                {post.likeCount} lượt thích
              </span>
              <span className="flex items-center gap-1.5">
                <HugeiconsIcon icon={Comment01Icon} strokeWidth={1.8} className="size-3.5" />
                {post.commentCount} bình luận
              </span>
            </div>

            <div className="flex gap-2 border-t border-border/70 px-4 py-2.5 md:px-5">
              <Button
                type="button"
                variant={post.likedByCurrentUser ? "default" : "outline"}
                size="sm"
                disabled={pendingLikePostId === post.id}
                onClick={() => void handleToggleLike(post)}
                className="rounded-xl"
              >
                <HugeiconsIcon
                  icon={post.likedByCurrentUser ? HeartCheckIcon : HeartAddIcon}
                  strokeWidth={1.8}
                  className="size-4"
                />
                {post.likedByCurrentUser ? "Đã thích" : "Thích"}
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="rounded-xl"
                onClick={() => setOpenPostId(post.id)}
              >
                <HugeiconsIcon icon={Comment01Icon} strokeWidth={1.8} className="size-4" />
                Bình luận
              </Button>
            </div>
          </article>
        ))}

        <div ref={sentinelRef} className="py-2 text-center text-xs text-muted-foreground">
          {isLoadingMore && "Đang tải thêm..."}
          {!hasMore && posts.length > 0 && !isLoadingPosts && "Đã tải hết bài đăng."}
        </div>

        </div>

        <div className="order-1 xl:order-2 xl:col-span-2">
          <UserRoutesList
            title={isOwnProfile ? "Lộ trình của tôi" : "Lộ trình của người dùng"}
            routes={initialRoutes}
            emptyMessage={
              isOwnProfile
                ? "Bạn chưa lưu lộ trình nào. Hãy tạo lộ trình từ tab Bản đồ."
                : "Người dùng này chưa có lộ trình có thể hiển thị cho bạn."
            }
          />
        </div>
      </div>

      {/* Delete confirm dialog */}
      <Dialog
        open={deleteTargetId !== null}
        onOpenChange={(open) => {
          if (!open) setDeleteTargetId(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Xoá bài đăng</DialogTitle>
            <DialogDescription>
              Bạn có chắc muốn xoá bài đăng này? Hành động không thể hoàn tác.
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-end gap-2 pt-2">
            <Button
              variant="outline"
              className="rounded-xl"
              onClick={() => setDeleteTargetId(null)}
              disabled={isDeleting}
            >
              Huỷ
            </Button>
            <Button
              variant="destructive"
              className="rounded-xl"
              onClick={() => void handleDeletePost()}
              disabled={isDeleting}
            >
              {isDeleting ? "Đang xoá..." : "Xoá bài đăng"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Comments dialog */}
      <Dialog
        open={openPostId !== null}
        onOpenChange={(open) => {
          if (!open) setOpenPostId(null);
        }}
      >
        <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Bình luận</DialogTitle>
            <DialogDescription className="sr-only">Đọc và gửi bình luận</DialogDescription>
          </DialogHeader>

          {selectedPost && (
            <div className="space-y-4">
              <PostBody post={selectedPost} />

              <div className="space-y-3">
                {dialogRootComments.map((comment) => (
                  <div key={comment.id} className="space-y-2">
                    <div className="flex gap-2">
                      <span className="relative inline-flex size-7 shrink-0 items-center justify-center overflow-hidden rounded-full bg-muted text-[10px] font-semibold text-foreground">
                        {comment.authorAvatarUrl ? (
                          <Image
                            src={comment.authorAvatarUrl}
                            alt={comment.authorName}
                            fill
                            sizes="28px"
                            className="object-cover"
                          />
                        ) : (
                          comment.authorName.slice(0, 2).toUpperCase()
                        )}
                      </span>
                      <div className="min-w-0 flex-1 rounded-2xl bg-muted/40 px-3 py-2 text-sm">
                        <p className="mb-0.5 text-xs font-semibold text-foreground">
                          {comment.authorName}
                        </p>
                        <p className="text-foreground">{comment.content}</p>
                      </div>
                    </div>
                    {(dialogRepliesByParent.get(comment.id) ?? []).map((reply) => (
                      <div key={reply.id} className="ml-9 flex gap-2">
                        <span className="relative inline-flex size-6 shrink-0 items-center justify-center overflow-hidden rounded-full bg-muted text-[9px] font-semibold text-foreground">
                          {reply.authorAvatarUrl ? (
                            <Image
                              src={reply.authorAvatarUrl}
                              alt={reply.authorName}
                              fill
                              sizes="24px"
                              className="object-cover"
                            />
                          ) : (
                            reply.authorName.slice(0, 2).toUpperCase()
                          )}
                        </span>
                        <div className="min-w-0 flex-1 rounded-2xl bg-muted/30 px-3 py-2 text-sm">
                          <p className="mb-0.5 text-xs font-semibold text-foreground">
                            {reply.authorName}
                          </p>
                          <p className="text-foreground">{reply.content}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                ))}
              </div>

              <div className="flex gap-2">
                <input
                  type="text"
                  className="flex-1 rounded-xl border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                  placeholder="Viết bình luận..."
                  value={commentDrafts[selectedPost.id] ?? ""}
                  onChange={(e) =>
                    setCommentDrafts((prev) => ({ ...prev, [selectedPost.id]: e.target.value }))
                  }
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      void handleSendComment(selectedPost.id);
                    }
                  }}
                />
                <Button
                  size="sm"
                  className="rounded-xl"
                  disabled={
                    pendingCommentPostId === selectedPost.id ||
                    !(commentDrafts[selectedPost.id] ?? "").trim()
                  }
                  onClick={() => void handleSendComment(selectedPost.id)}
                >
                  Gửi
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

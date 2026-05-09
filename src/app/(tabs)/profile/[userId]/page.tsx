import { notFound, redirect } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { UserProfile } from "@/components/app/user-profile";
import { fetchVisibleRoutes } from "@/lib/user-routes";

type PageProps = {
  params: Promise<{ userId: string }>;
};

type FavoriteEventRecord = {
  id: string;
  record_kind: "event" | "place";
  province_code: string;
  ward_code: string | null;
  event_name: string;
  event_type: string | null;
  image_urls: string[] | null;
  created_at: string;
};

type FavoriteRow = {
  event_record_id: string;
  event_records: FavoriteEventRecord | FavoriteEventRecord[] | null;
};

export default async function ProfilePage({ params }: PageProps) {
  const { userId } = await params;

  const supabase = await createClient();
  const {
    data: { user: currentUser },
  } = await supabase.auth.getUser();

  if (!currentUser) {
    redirect("/login");
  }

  // Validate userId is a UUID to prevent injection / unnecessary DB hits
  const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!uuidPattern.test(userId)) {
    notFound();
  }

  // Get target user profile via admin client (has access to auth.users metadata)
  const adminClient = createAdminClient();
  const { data: targetUserData } = await adminClient.auth.admin.getUserById(userId);

  if (!targetUserData.user) {
    notFound();
  }

  const targetMeta = targetUserData.user.user_metadata ?? {};
  const targetEmail = targetUserData.user.email ?? "";
  const rawName = typeof targetMeta.full_name === "string" ? targetMeta.full_name.trim() : "";
  const rawAvatar = typeof targetMeta.avatar_url === "string" ? targetMeta.avatar_url.trim() : "";

  // Fall back to forum_posts for display name if auth metadata is empty
  let displayName = rawName || targetEmail.split("@")[0] || "Người dùng";
  let avatarUrl = rawAvatar;

  if (!rawName) {
    const { data: latestPost } = await supabase
      .from("forum_posts")
      .select("author_name, author_avatar_url")
      .eq("author_id", userId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (latestPost) {
      displayName = latestPost.author_name || displayName;
      avatarUrl = avatarUrl || latestPost.author_avatar_url || "";
    }
  }

  // Get post count and friend count
  const [{ count: postCount }, { count: friendCount }] = await Promise.all([
    supabase
      .from("forum_posts")
      .select("id", { count: "exact", head: true })
      .eq("author_id", userId),
    supabase
      .from("user_friendships")
      .select("id", { count: "exact", head: true })
      .or(`requester_id.eq.${userId},addressee_id.eq.${userId}`)
      .eq("status", "accepted"),
  ]);

  // Get current friendship status between current user and target user
  const { data: friendshipRow } = await supabase
    .from("user_friendships")
    .select("id, requester_id, addressee_id, status")
    .or(
      `and(requester_id.eq.${currentUser.id},addressee_id.eq.${userId}),and(requester_id.eq.${userId},addressee_id.eq.${currentUser.id})`,
    )
    .maybeSingle();

  // Get mutual friends (via RPC)
  const { data: mutualFriendsData } = await supabase.rpc("get_mutual_friends", {
    target_user_id: userId,
  });

  const currentUserEmail = currentUser.email ?? "";
  const currentUserMeta = currentUser.user_metadata ?? {};
  const currentDisplayName =
    (typeof currentUserMeta.full_name === "string" ? currentUserMeta.full_name.trim() : "") ||
    currentUserEmail.split("@")[0] ||
    "Người dùng";
  const currentAvatarUrl =
    typeof currentUserMeta.avatar_url === "string" ? currentUserMeta.avatar_url.trim() : "";

  type MutualFriend = { user_id: string; display_name: string; avatar_url: string | null };
  const [initialRoutes, provincesRes, wardsRes, favoritesRes] = await Promise.all([
    fetchVisibleRoutes(supabase, {
      ownerId: userId,
      limit: 100,
    }),
    supabase.from("provinces").select("code, name").order("name", { ascending: true }),
    supabase.from("wards").select("code, province_code, name").order("name", { ascending: true }),
    supabase
      .from("user_event_favorites")
      .select(
        `
        event_record_id,
        event_records(
          id,
          record_kind,
          province_code,
          ward_code,
          event_name,
          event_type,
          image_urls,
          created_at
        )
      `,
      )
      .eq("user_id", userId)
      .order("created_at", { ascending: false }),
  ]);

  const provinces = provincesRes.data ?? [];
  const wards = wardsRes.data ?? [];
  const favoritesData = (favoritesRes.data ?? []) as FavoriteRow[];
  const provMap = new Map(provinces.map((p) => [p.code, p.name]));
  const wardMap = new Map(wards.map((w) => [w.code, w.name]));

  // Transform favorite records and fetch their categories
  const favoriteRecordIds = favoritesData
    .map((f) => {
      const rec = f.event_records;
      if (!rec || Array.isArray(rec)) return null;
      return rec.id;
    })
    .filter(Boolean);

  const catRowsRes = favoriteRecordIds.length
    ? await supabase
        .from("event_record_categories")
        .select("event_record_id, event_categories(id, name)")
        .in("event_record_id", favoriteRecordIds)
    : { data: [] as Array<{
        event_record_id: string;
        event_categories: { id: string; name: string } | null;
      }> };

  const catMap = new Map<string, { id: string; name: string }[]>();
  for (const row of catRowsRes.data ?? []) {
    const c = Array.isArray(row.event_categories) ? row.event_categories[0] : row.event_categories;
    if (!c?.id) continue;
    catMap.set(row.event_record_id, [...(catMap.get(row.event_record_id) ?? []), c]);
  }

  const initialFavoriteEvents: Array<{
    id: string;
    record_kind: "event" | "place";
    province_code: string;
    ward_code: string | null;
    event_name: string;
    event_type: string | null;
    image_urls: string[] | null;
    created_at: string;
    categories: { id: string; name: string }[];
  }> = [];

  for (const f of favoritesData) {
    const rec = f.event_records;
    if (rec && !Array.isArray(rec)) {
      initialFavoriteEvents.push({
        id: rec.id,
        record_kind: rec.record_kind,
        province_code: rec.province_code,
        ward_code: rec.ward_code,
        event_name: rec.event_name,
        event_type: rec.event_type,
        image_urls: rec.image_urls,
        created_at: rec.created_at,
        categories: catMap.get(rec.id) ?? [],
      });
    }
  }

  return (
    <UserProfile
      currentUser={{
        id: currentUser.id,
        displayName: currentDisplayName,
        avatarUrl: currentAvatarUrl,
      }}
      targetUser={{
        id: userId,
        displayName,
        avatarUrl,
        postCount: postCount ?? 0,
        friendCount: friendCount ?? 0,
      }}
      initialFriendship={
        friendshipRow
          ? {
              id: friendshipRow.id,
              requesterId: friendshipRow.requester_id,
              addresseeId: friendshipRow.addressee_id,
              status: friendshipRow.status as "pending" | "accepted" | "declined" | "blocked",
            }
          : null
      }
      initialMutualFriends={(mutualFriendsData ?? []) as MutualFriend[]}
      initialRoutes={initialRoutes}
      initialFavoriteEvents={initialFavoriteEvents}
      provinces={provMap}
      wards={wardMap}
    />
  );
}

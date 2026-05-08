import { redirect } from "next/navigation";
import { ForumFeed } from "@/components/app/forum-feed";
import { createClient } from "@/lib/supabase/server";

export default async function ForumPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const email = user.email ?? "";
  const metadataName = typeof user.user_metadata.full_name === "string" ? user.user_metadata.full_name : "";
  const metadataAvatar = typeof user.user_metadata.avatar_url === "string" ? user.user_metadata.avatar_url : "";

  const displayName = metadataName.trim() || email.split("@")[0] || "Người dùng";

  return (
    <ForumFeed
      currentUser={{
        id: user.id,
        email,
        displayName,
        avatarUrl: metadataAvatar,
      }}
    />
  );
}

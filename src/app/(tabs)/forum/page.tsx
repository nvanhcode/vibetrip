import { redirect } from "next/navigation";
import { ForumFeed } from "@/components/app/forum-feed";
import { createClient } from "@/lib/supabase/server";

type PageProps = {
  searchParams?: Promise<{ [key: string]: string | string[] | undefined }>;
};

function single(value: string | string[] | undefined): string {
  return Array.isArray(value) ? (value[0] ?? "") : (value ?? "");
}

export default async function ForumPage({ searchParams }: PageProps) {
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
  const params = await searchParams;
  const focusPostId = single(params?.post).trim() || null;

  return (
    <ForumFeed
      currentUser={{
        id: user.id,
        email,
        displayName,
        avatarUrl: metadataAvatar,
      }}
      focusPostId={focusPostId}
    />
  );
}

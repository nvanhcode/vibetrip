import { redirect } from "next/navigation";
import { AccountForm } from "@/components/app/account-form";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { createClient } from "@/lib/supabase/server";

export default async function AccountPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const fullName = typeof user.user_metadata.full_name === "string" ? user.user_metadata.full_name : "";
  const avatarUrl = typeof user.user_metadata.avatar_url === "string" ? user.user_metadata.avatar_url : "";

  const { data: provinces } = await supabase
    .from("provinces")
    .select("code, name")
    .order("name", { ascending: true });

  return (
    <Card className="mx-auto mt-2 max-w-2xl">
      <CardHeader>
        <CardTitle>Tài khoản</CardTitle>
        <CardDescription>Cập nhật thông tin cá nhân và avatar của bạn.</CardDescription>
      </CardHeader>
      <CardContent>
        <AccountForm
          userId={user.id}
          email={user.email ?? ""}
          initialFullName={fullName}
          initialAvatarUrl={avatarUrl}
          provinces={(provinces ?? []).map((province) => ({ code: province.code, name: province.name }))}
        />
      </CardContent>
    </Card>
  );
}

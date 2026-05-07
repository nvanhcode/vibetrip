import type { User } from "@supabase/supabase-js";
import type { NextRequest } from "next/server";
import { resolveUserRole } from "@/lib/rbac";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

type UserPickerResult = {
  id: string;
  email: string;
  fullName: string | null;
};

function extractFullName(user: User) {
  const metadata = user.user_metadata;
  if (!metadata || typeof metadata !== "object") {
    return null;
  }

  const fullName = metadata.full_name;
  return typeof fullName === "string" && fullName.trim() ? fullName.trim() : null;
}

async function findUserByExactEmail(email: string) {
  const adminSupabase = createAdminClient();
  let page = 1;
  const perPage = 100;

  while (true) {
    const { data, error } = await adminSupabase.auth.admin.listUsers({ page, perPage });

    if (error) {
      throw error;
    }

    const matchedUser = data.users.find((user) => user.email?.toLowerCase() === email);

    if (matchedUser) {
      return {
        id: matchedUser.id,
        email: matchedUser.email ?? email,
        fullName: extractFullName(matchedUser),
      } satisfies UserPickerResult;
    }

    if (data.users.length < perPage) {
      return null;
    }

    page += 1;
  }
}

export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const role = await resolveUserRole(supabase, user.id);
  if (role !== "admin") {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }

  const email = request.nextUrl.searchParams.get("email")?.trim().toLowerCase() ?? "";
  if (!email) {
    return Response.json({ error: "Email is required" }, { status: 400 });
  }

  try {
    const matchedUser = await findUserByExactEmail(email);
    return Response.json({ user: matchedUser });
  } catch (error) {
    console.error("user picker lookup failed", error);
    return Response.json({ error: "Lookup failed" }, { status: 500 });
  }
}

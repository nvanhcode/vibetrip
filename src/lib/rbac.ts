import type { SupabaseClient } from "@supabase/supabase-js";
import type { AppRole } from "@/models/rbac.model";

export function isAppRole(value: unknown): value is AppRole {
  return value === "admin" || value === "province_manager" || value === "ward_admin";
}

export function getRoleLabel(role: AppRole | null) {
  if (role === "admin") return "Admin";
  if (role === "province_manager") return "Quản lý tỉnh";
  if (role === "ward_admin") return "Quản trị xã";
  return "Người dùng";
}

export async function resolveUserRole(supabase: SupabaseClient, userId: string): Promise<AppRole | null> {
  const { data, error } = await supabase.from("user_roles").select("role").eq("user_id", userId).maybeSingle<{ role: string }>();

  if (error || !data?.role) {
    return null;
  }

  return isAppRole(data.role) ? data.role : null;
}

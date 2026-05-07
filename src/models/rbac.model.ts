import type { SupabaseClient } from "@supabase/supabase-js";

export type AppRole = "admin" | "province_manager" | "ward_admin";

export type UserRole = {
  user_id: string;
  role: AppRole;
  assigned_by: string | null;
  created_at: string;
  updated_at: string;
};

export type ProvinceManagerAssignment = {
  user_id: string;
  province_code: string;
  assigned_by: string | null;
  created_at: string;
};

export type WardAdminAssignment = {
  user_id: string;
  ward_code: string;
  assigned_by: string | null;
  created_at: string;
};

export type AccessRequestStatus = "pending" | "approved" | "rejected";

export type AccessRequest = {
  id: string;
  user_id: string | null;
  email: string;
  full_name: string;
  requested_role: AppRole | null;
  province_code: string | null;
  status: AccessRequestStatus;
  notes: string | null;
  reviewed_by: string | null;
  created_at: string;
  updated_at: string;
};

export async function getCurrentUserRole(supabase: SupabaseClient, userId: string) {
  return supabase.from("user_roles").select("role").eq("user_id", userId).maybeSingle<Pick<UserRole, "role">>();
}

export async function listProvinceAssignmentsForUser(supabase: SupabaseClient, userId: string) {
  return supabase
    .from("province_managers")
    .select("user_id, province_code, assigned_by, created_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: true });
}

export async function listWardAssignmentsForUser(supabase: SupabaseClient, userId: string) {
  return supabase
    .from("ward_admins")
    .select("user_id, ward_code, assigned_by, created_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: true });
}

export async function createAccessRequest(
  supabase: SupabaseClient,
  payload: Pick<AccessRequest, "email" | "full_name"> &
    Partial<Pick<AccessRequest, "user_id" | "notes" | "requested_role" | "province_code">>
) {
  return supabase
    .from("access_requests")
    .insert({
      email: payload.email,
      full_name: payload.full_name,
      user_id: payload.user_id ?? null,
      requested_role: payload.requested_role ?? null,
      province_code: payload.province_code ?? null,
      notes: payload.notes ?? null,
    })
    .select("id, user_id, email, full_name, requested_role, province_code, status, notes, reviewed_by, created_at, updated_at")
    .single<AccessRequest>();
}

"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isAppRole, resolveUserRole } from "@/lib/rbac";

function parseCodeList(raw: FormDataEntryValue | null) {
  return (raw ?? "")
    .toString()
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
}

async function requireAuthUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  return { supabase, user };
}

async function deleteRoleIfNoAssignments(userId: string) {
  const adminSupabase = createAdminClient();
  const [{ count: provinceAssignmentCount, error: provinceCountError }, { count: wardAssignmentCount, error: wardCountError }] = await Promise.all([
    adminSupabase.from("province_managers").select("user_id", { count: "exact", head: true }).eq("user_id", userId),
    adminSupabase.from("ward_admins").select("user_id", { count: "exact", head: true }).eq("user_id", userId),
  ]);

  if (provinceCountError || wardCountError) {
    console.error("deleteRoleIfNoAssignments count failed", { provinceCountError, wardCountError, userId });
    return;
  }

  if ((provinceAssignmentCount ?? 0) > 0 || (wardAssignmentCount ?? 0) > 0) {
    return;
  }

  const { data: currentRole, error: currentRoleError } = await adminSupabase
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .maybeSingle<{ role: string }>();

  if (currentRoleError) {
    console.error("deleteRoleIfNoAssignments load role failed", currentRoleError);
    return;
  }

  if (!currentRole || currentRole.role === "admin") {
    return;
  }

  const { error: deleteRoleError } = await adminSupabase.from("user_roles").delete().eq("user_id", userId);

  if (deleteRoleError) {
    console.error("deleteRoleIfNoAssignments delete role failed", deleteRoleError);
  }
}

export async function requestRoleUpgradeAction(formData: FormData) {
  const { supabase, user } = await requireAuthUser();

  const requestedRoleRaw = formData.get("requested_role")?.toString() ?? "";
  const fullName = formData.get("full_name")?.toString().trim() ?? "";
  const email = formData.get("email")?.toString().trim().toLowerCase() ?? "";
  const notes = formData.get("notes")?.toString().trim() ?? "";
  const provinceCode = formData.get("province_code")?.toString().trim() ?? "";

  if (!fullName || !email) {
    return;
  }

  const requestedRole = isAppRole(requestedRoleRaw) ? requestedRoleRaw : null;
  if (!requestedRole || requestedRole === "admin") {
    return;
  }

  if (requestedRole === "ward_admin" && !provinceCode) {
    return;
  }

  const { error } = await supabase.from("access_requests").insert({
    user_id: user.id,
    email,
    full_name: fullName,
    requested_role: requestedRole,
    province_code: requestedRole === "ward_admin" ? provinceCode : null,
    notes: notes || null,
  });

  if (error && error.code !== "23505") {
    console.error("requestRoleUpgradeAction failed", error);
  }

  revalidatePath("/account");
}

export async function adminCreateAccessRequestAction(formData: FormData) {
  const { supabase, user } = await requireAuthUser();
  const role = await resolveUserRole(supabase, user.id);
  if (role !== "admin") {
    return;
  }

  const email = formData.get("email")?.toString().trim().toLowerCase() ?? "";
  const fullName = formData.get("full_name")?.toString().trim() ?? "";
  const notes = formData.get("notes")?.toString().trim() ?? "";
  const requestedRoleRaw = formData.get("requested_role")?.toString() ?? "";
  const userIdRaw = formData.get("user_id")?.toString().trim() ?? "";
  const provinceCode = formData.get("province_code")?.toString().trim() ?? "";

  const requestedRole = isAppRole(requestedRoleRaw) ? requestedRoleRaw : null;

  if (!email || !fullName || !requestedRole || requestedRole === "admin") {
    return;
  }

  if (requestedRole === "ward_admin" && !provinceCode) {
    return;
  }

  const { error } = await supabase.from("access_requests").insert({
    email,
    full_name: fullName,
    notes: notes || null,
    user_id: userIdRaw || null,
    requested_role: requestedRole,
    province_code: requestedRole === "ward_admin" ? provinceCode : null,
  });

  if (error && error.code !== "23505") {
    console.error("adminCreateAccessRequestAction failed", error);
  }

  revalidatePath("/account/manage-province-accounts");
}

export async function approveProvinceManagerRequestAction(formData: FormData) {
  const { supabase, user } = await requireAuthUser();
  const role = await resolveUserRole(supabase, user.id);
  if (role !== "admin") {
    return;
  }

  const requestId = formData.get("request_id")?.toString() ?? "";
  const userId = formData.get("user_id")?.toString() ?? "";
  const provinceCodes = parseCodeList(formData.get("province_codes"));
  const requestedRoleRaw = formData.get("requested_role")?.toString() ?? "";
  const requestedRole = isAppRole(requestedRoleRaw) ? requestedRoleRaw : "province_manager";

  if (!requestId || !userId || requestedRole === "admin") {
    return;
  }

  const { error: roleError } = await supabase.from("user_roles").upsert(
    {
      user_id: userId,
      role: requestedRole,
      assigned_by: user.id,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id" }
  );

  if (roleError) {
    console.error("approveProvinceManagerRequestAction upsert role failed", roleError);
    return;
  }

  if (requestedRole === "province_manager") {
    for (const provinceCode of provinceCodes) {
      const { error: assignmentError } = await supabase.from("province_managers").upsert(
        {
          user_id: userId,
          province_code: provinceCode,
          assigned_by: user.id,
        },
        { onConflict: "user_id,province_code" }
      );

      if (assignmentError) {
        console.error("assign province manager failed", assignmentError);
      }
    }
  }

  if (requestedRole === "ward_admin") {
    const wardCodes = parseCodeList(formData.get("ward_codes"));
    for (const wardCode of wardCodes) {
      const { error: assignmentError } = await supabase.from("ward_admins").upsert(
        {
          user_id: userId,
          ward_code: wardCode,
          assigned_by: user.id,
        },
        { onConflict: "user_id,ward_code" }
      );

      if (assignmentError) {
        console.error("assign ward admin failed", assignmentError);
      }
    }
  }

  const { error: requestError } = await supabase
    .from("access_requests")
    .update({ status: "approved", reviewed_by: user.id, updated_at: new Date().toISOString() })
    .eq("id", requestId);

  if (requestError) {
    console.error("approveProvinceManagerRequestAction update request failed", requestError);
  }

  revalidatePath("/account/manage-province-accounts");
}

export async function revokeProvinceManagerAction(formData: FormData) {
  const { supabase, user } = await requireAuthUser();
  const role = await resolveUserRole(supabase, user.id);
  if (role !== "admin") {
    return;
  }

  const userId = formData.get("user_id")?.toString() ?? "";
  const provinceCode = formData.get("province_code")?.toString() ?? "";

  if (!userId || !provinceCode) {
    return;
  }

  const { error } = await supabase
    .from("province_managers")
    .delete()
    .eq("user_id", userId)
    .eq("province_code", provinceCode);

  if (error) {
    console.error("revokeProvinceManagerAction failed", error);
    return;
  }

  await deleteRoleIfNoAssignments(userId);

  revalidatePath("/account/manage-province-accounts");
}

export async function revokeWardAdminAction(formData: FormData) {
  const { supabase, user } = await requireAuthUser();
  const role = await resolveUserRole(supabase, user.id);
  if (role !== "admin" && role !== "province_manager") {
    return;
  }

  const adminSupabase = createAdminClient();

  const userId = formData.get("user_id")?.toString() ?? "";
  const wardCode = formData.get("ward_code")?.toString() ?? "";

  if (!userId || !wardCode) {
    return;
  }

  // province_manager can only revoke wards in their own provinces
  if (role === "province_manager") {
    const { data: ward } = await adminSupabase
      .from("wards")
      .select("province_code")
      .eq("code", wardCode)
      .maybeSingle();

    if (!ward) return;

    const { data: managed } = await supabase
      .from("province_managers")
      .select("province_code")
      .eq("user_id", user.id)
      .eq("province_code", ward.province_code)
      .maybeSingle();

    if (!managed) return;
  }

  const { error } = await adminSupabase
    .from("ward_admins")
    .delete()
    .eq("user_id", userId)
    .eq("ward_code", wardCode);

  if (error) {
    console.error("revokeWardAdminAction failed", error);
    return;
  }

  await deleteRoleIfNoAssignments(userId);

  revalidatePath("/account/manage-province-accounts");
  revalidatePath("/account/manage-ward-accounts");
}

export async function rejectAccessRequestAction(formData: FormData) {
  const { supabase, user } = await requireAuthUser();
  const role = await resolveUserRole(supabase, user.id);
  if (role !== "admin" && role !== "province_manager") {
    return;
  }

  const requestId = formData.get("request_id")?.toString() ?? "";
  const notes = formData.get("notes")?.toString().trim() ?? "";

  if (!requestId) {
    return;
  }

  if (role === "province_manager") {
    const { data: request } = await supabase
      .from("access_requests")
      .select("id, requested_role, province_code")
      .eq("id", requestId)
      .maybeSingle();

    if (!request || request.requested_role !== "ward_admin" || !request.province_code) {
      return;
    }

    const { data: managed } = await supabase
      .from("province_managers")
      .select("province_code")
      .eq("user_id", user.id)
      .eq("province_code", request.province_code)
      .maybeSingle();

    if (!managed) {
      return;
    }
  }

  const { error } = await supabase
    .from("access_requests")
    .update({ status: "rejected", reviewed_by: user.id, notes: notes || null, updated_at: new Date().toISOString() })
    .eq("id", requestId);

  if (error) {
    console.error("rejectAccessRequestAction failed", error);
  }

  revalidatePath("/account/manage-province-accounts");
  revalidatePath("/account/manage-ward-accounts");
}

export async function provinceManagerCreateWardRequestAction(formData: FormData) {
  const { supabase, user } = await requireAuthUser();
  const role = await resolveUserRole(supabase, user.id);
  if (role !== "province_manager") {
    return;
  }

  const email = formData.get("email")?.toString().trim().toLowerCase() ?? "";
  const fullName = formData.get("full_name")?.toString().trim() ?? "";
  const notes = formData.get("notes")?.toString().trim() ?? "";
  const userIdRaw = formData.get("user_id")?.toString().trim() ?? "";
  const provinceCode = formData.get("province_code")?.toString().trim() ?? "";

  if (!email || !fullName || !provinceCode) {
    return;
  }

  const { data: managed } = await supabase
    .from("province_managers")
    .select("province_code")
    .eq("user_id", user.id)
    .eq("province_code", provinceCode)
    .maybeSingle();

  if (!managed) {
    return;
  }

  const { error } = await supabase.from("access_requests").insert({
    email,
    full_name: fullName,
    notes: notes || null,
    user_id: userIdRaw || null,
    requested_role: "ward_admin",
    province_code: provinceCode,
  });

  if (error && error.code !== "23505") {
    console.error("provinceManagerCreateWardRequestAction failed", error);
  }

  revalidatePath("/account/manage-ward-accounts");
}

export async function approveWardAdminRequestAction(formData: FormData) {
  const { supabase, user } = await requireAuthUser();
  const role = await resolveUserRole(supabase, user.id);
  if (role !== "province_manager") {
    return;
  }

  const adminSupabase = createAdminClient();
  const requestId = formData.get("request_id")?.toString() ?? "";
  const userIdRaw = formData.get("user_id")?.toString().trim() ?? "";
  const wardCodes = parseCodeList(formData.get("ward_codes"));

  if (!requestId || wardCodes.length === 0) {
    return;
  }

  const { data: request } = await adminSupabase
    .from("access_requests")
    .select("id, user_id, requested_role, status, province_code")
    .eq("id", requestId)
    .maybeSingle();

  if (!request || request.requested_role !== "ward_admin" || request.status !== "pending" || !request.province_code) {
    return;
  }

  const userId = userIdRaw || request.user_id || "";
  if (!userId) {
    return;
  }

  const { data: managed } = await supabase
    .from("province_managers")
    .select("province_code")
    .eq("user_id", user.id)
    .eq("province_code", request.province_code)
    .maybeSingle();

  if (!managed) {
    return;
  }

  const { data: selectedWards } = await adminSupabase
    .from("wards")
    .select("code")
    .in("code", wardCodes)
    .eq("province_code", request.province_code);

  const allowedWardCodes = new Set((selectedWards ?? []).map((item) => item.code));
  if (allowedWardCodes.size !== wardCodes.length) {
    return;
  }

  const { error: roleError } = await adminSupabase.from("user_roles").upsert(
    {
      user_id: userId,
      role: "ward_admin",
      assigned_by: user.id,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id" }
  );

  if (roleError) {
    console.error("approveWardAdminRequestAction upsert role failed", roleError);
    return;
  }

  for (const wardCode of wardCodes) {
    const { error: assignmentError } = await adminSupabase.from("ward_admins").upsert(
      {
        user_id: userId,
        ward_code: wardCode,
        assigned_by: user.id,
      },
      { onConflict: "user_id,ward_code" }
    );

    if (assignmentError) {
      console.error("approveWardAdminRequestAction assign ward failed", assignmentError);
    }
  }

  const { error: requestError } = await adminSupabase
    .from("access_requests")
    .update({ status: "approved", reviewed_by: user.id, updated_at: new Date().toISOString() })
    .eq("id", requestId);

  if (requestError) {
    console.error("approveWardAdminRequestAction update request failed", requestError);
  }

  revalidatePath("/account/manage-ward-accounts");
}
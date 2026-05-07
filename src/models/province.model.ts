import type { SupabaseClient } from "@supabase/supabase-js";

export type Province = {
  code: string;
  name: string;
  created_at: string;
  updated_at: string;
};

export async function listProvinces(supabase: SupabaseClient) {
  return supabase.from("provinces").select("code, name, created_at, updated_at").order("name", { ascending: true });
}

export async function getProvinceByCode(supabase: SupabaseClient, code: string) {
  return supabase
    .from("provinces")
    .select("code, name, created_at, updated_at")
    .eq("code", code)
    .maybeSingle<Province>();
}

export async function createProvince(supabase: SupabaseClient, payload: Pick<Province, "code" | "name">) {
  return supabase.from("provinces").insert(payload).select("code, name, created_at, updated_at").single<Province>();
}

export async function updateProvinceName(supabase: SupabaseClient, code: string, name: string) {
  return supabase
    .from("provinces")
    .update({ name, updated_at: new Date().toISOString() })
    .eq("code", code)
    .select("code, name, created_at, updated_at")
    .single<Province>();
}

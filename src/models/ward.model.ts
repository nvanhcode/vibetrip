import type { SupabaseClient } from "@supabase/supabase-js";

export type Ward = {
  code: string;
  province_code: string;
  name: string;
  english_name: string | null;
  level: string | null;
  decree: string | null;
  created_at: string;
  updated_at: string;
};

export async function listWardsByProvince(supabase: SupabaseClient, provinceCode: string) {
  return supabase
    .from("wards")
    .select("code, province_code, name, english_name, level, decree, created_at, updated_at")
    .eq("province_code", provinceCode)
    .order("name", { ascending: true });
}

export async function getWardByCode(supabase: SupabaseClient, code: string) {
  return supabase
    .from("wards")
    .select("code, province_code, name, english_name, level, decree, created_at, updated_at")
    .eq("code", code)
    .maybeSingle<Ward>();
}

export async function createWard(
  supabase: SupabaseClient,
  payload: Pick<Ward, "code" | "province_code" | "name" | "english_name" | "level" | "decree">
) {
  return supabase
    .from("wards")
    .insert(payload)
    .select("code, province_code, name, english_name, level, decree, created_at, updated_at")
    .single<Ward>();
}

export async function updateWard(supabase: SupabaseClient, code: string, payload: Partial<Omit<Ward, "code" | "created_at">>) {
  return supabase
    .from("wards")
    .update({ ...payload, updated_at: new Date().toISOString() })
    .eq("code", code)
    .select("code, province_code, name, english_name, level, decree, created_at, updated_at")
    .single<Ward>();
}

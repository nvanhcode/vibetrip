"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { resolveUserRole } from "@/lib/rbac";
import { createClient } from "@/lib/supabase/server";

const MAX_EVENT_IMAGE_COUNT = 10;
const MAX_EVENT_IMAGE_SIZE_BYTES = 8 * 1024 * 1024;

function parseCommaList(raw: FormDataEntryValue | null) {
  return (raw ?? "")
    .toString()
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function parseNames(raw: FormDataEntryValue | null) {
  return (raw ?? "")
    .toString()
    .split(/[\n,]/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function parseOptionalDateTime(raw: FormDataEntryValue | null) {
  const value = raw?.toString().trim();
  if (!value) return null;

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return date.toISOString();
}

function parseOptionalTime(raw: FormDataEntryValue | null) {
  const value = raw?.toString().trim();
  if (!value) return null;
  if (!/^\d{2}:\d{2}$/.test(value)) return null;
  return `${value}:00`;
}

function parseOptionalWeekday(raw: FormDataEntryValue | null) {
  const value = raw?.toString().trim();
  if (!value) return null;

  const weekday = Number(value);
  if (!Number.isInteger(weekday) || weekday < 1 || weekday > 7) {
    return null;
  }

  return weekday;
}

function parseSchedules(formData: FormData) {
  const modeValues = formData.getAll("schedule_mode");
  const organizedAtValues = formData.getAll("schedule_organized_at");
  const weekdayValues = formData.getAll("schedule_weekday");
  const opensAtValues = formData.getAll("schedule_opens_at");
  const closesAtValues = formData.getAll("schedule_closes_at");

  if (
    modeValues.length === 0 ||
    modeValues.length !== organizedAtValues.length ||
    modeValues.length !== weekdayValues.length ||
    modeValues.length !== opensAtValues.length ||
    modeValues.length !== closesAtValues.length
  ) {
    return [] as Array<{ organizedAt: string | null; weekday: number | null; opensAt: string; closesAt: string; slotOrder: number }>;
  }

  const schedules: Array<{ organizedAt: string | null; weekday: number | null; opensAt: string; closesAt: string; slotOrder: number }> = [];

  for (let index = 0; index < modeValues.length; index += 1) {
    const mode = modeValues[index]?.toString().trim() === "weekday" ? "weekday" : "date";
    const organizedAt = parseOptionalDateTime(organizedAtValues[index] ?? null);
    const weekday = parseOptionalWeekday(weekdayValues[index] ?? null);
    const opensAt = parseOptionalTime(opensAtValues[index] ?? null);
    const closesAt = parseOptionalTime(closesAtValues[index] ?? null);

    const isEmptyRow = !organizedAt && !weekday && !opensAt && !closesAt;
    if (isEmptyRow) {
      continue;
    }

    if (!opensAt || !closesAt || opensAt >= closesAt) {
      return [];
    }

    if (mode === "date" && !organizedAt) {
      return [];
    }

    if (mode === "weekday" && !weekday) {
      return [];
    }

    schedules.push({
      organizedAt: mode === "date" ? organizedAt : null,
      weekday: mode === "weekday" ? weekday : null,
      opensAt,
      closesAt,
      slotOrder: schedules.length,
    });
  }

  return schedules;
}

function parseCoordinate(raw: FormDataEntryValue | null, min: number, max: number) {
  const value = raw?.toString().trim();
  if (!value) return null;

  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return null;
  if (parsed < min || parsed > max) return null;

  return parsed;
}

function getEventImageFiles(formData: FormData) {
  const entries = formData.getAll("event_images");

  return entries
    .filter((entry): entry is File => entry instanceof File)
    .filter((file) => file.size > 0 && file.type.startsWith("image/"));
}

function sanitizeFilename(filename: string) {
  return filename
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9._-]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "") || "image";
}

async function uploadEventImages(
  supabase: Awaited<ReturnType<typeof createClient>>,
  recordId: string,
  imageFiles: File[],
) {
  const uploadedPaths: string[] = [];
  const imageUrls: string[] = [];

  try {
    for (const [index, file] of imageFiles.entries()) {
      const extension = file.name.includes(".") ? file.name.split(".").pop() : null;
      const safeFileName = sanitizeFilename(file.name.replace(/\.[^.]+$/, ""));
      const finalFileName = extension
        ? `${safeFileName}-${Date.now()}-${index}.${sanitizeFilename(extension)}`
        : `${safeFileName}-${Date.now()}-${index}`;
      const filePath = `${recordId}/${finalFileName}`;

      const fileBuffer = await file.arrayBuffer();
      const { error: uploadError } = await supabase.storage.from("events").upload(filePath, fileBuffer, {
        contentType: file.type || undefined,
        upsert: false,
      });

      if (uploadError) {
        throw uploadError;
      }

      uploadedPaths.push(filePath);
      imageUrls.push(supabase.storage.from("events").getPublicUrl(filePath).data.publicUrl);
    }
  } catch (error) {
    if (uploadedPaths.length > 0) {
      const { error: cleanupError } = await supabase.storage.from("events").remove(uploadedPaths);
      if (cleanupError) {
        console.error("uploadEventImages cleanup failed", cleanupError);
      }
    }

    throw error;
  }

  return {
    uploadedPaths,
    imageUrls,
  };
}

async function requireUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  return { supabase, user };
}

async function ensureCategories(supabase: Awaited<ReturnType<typeof createClient>>, userId: string, names: string[]) {
  const ids: string[] = [];

  for (const name of names) {
    const { data, error } = await supabase
      .from("event_categories")
      .insert({ name, created_by: userId })
      .select("id")
      .maybeSingle<{ id: string }>();

    if (error && error.code !== "23505") {
      throw error;
    }

    if (data?.id) {
      ids.push(data.id);
      continue;
    }

    const { data: existing, error: existingError } = await supabase
      .from("event_categories")
      .select("id")
      .ilike("name", name)
      .maybeSingle<{ id: string }>();

    if (existingError) {
      throw existingError;
    }

    if (existing?.id) {
      ids.push(existing.id);
    }
  }

  return ids;
}

async function ensureOrganizers(supabase: Awaited<ReturnType<typeof createClient>>, userId: string, names: string[], provinceCode: string, wardCode: string) {
  const ids: string[] = [];

  for (const name of names) {
    const { data, error } = await supabase
      .from("event_organizers")
      .insert({ name, created_by: userId, province_code: provinceCode, ward_code: wardCode })
      .select("id")
      .maybeSingle<{ id: string }>();

    if (error && error.code !== "23505") {
      throw error;
    }

    if (data?.id) {
      ids.push(data.id);
      continue;
    }

    const { data: existing, error: existingError } = await supabase
      .from("event_organizers")
      .select("id")
      .ilike("name", name)
      .eq("province_code", provinceCode)
      .eq("ward_code", wardCode)
      .maybeSingle<{ id: string }>();

    if (existingError) {
      throw existingError;
    }

    if (existing?.id) {
      ids.push(existing.id);
    }
  }

  return ids;
}

export async function createEventRecordAction(formData: FormData) {
  const { supabase, user } = await requireUser();

  const recordKindRaw = formData.get("record_kind")?.toString().trim();
  const recordKind = recordKindRaw === "place" ? "place" : "event";
  const goongPlaceId = formData.get("goong_place_id")?.toString().trim() ?? "";
  const goongLatitude = parseCoordinate(formData.get("goong_latitude"), -90, 90);
  const goongLongitude = parseCoordinate(formData.get("goong_longitude"), -180, 180);
  const provinceCode = formData.get("province_code")?.toString().trim() ?? "";
  const wardCode = formData.get("ward_code")?.toString().trim() ?? "";
  const eventName = formData.get("event_name")?.toString().trim() ?? "";
  const eventType = formData.get("event_type")?.toString().trim() ?? "";
  const eventDescription = formData.get("event_description")?.toString().trim() ?? "";
  const allowRegistration = formData.get("allow_registration")?.toString() === "on";
  const eventImages = getEventImageFiles(formData);

  const schedules = parseSchedules(formData);
  const firstDatedSchedule = schedules.find((schedule) => schedule.organizedAt) ?? null;
  const scheduleDescription = formData.get("schedule_description")?.toString().trim() || null;

  const contactPhone = formData.get("contact_phone")?.toString().trim() || null;
  const contactEmail = formData.get("contact_email")?.toString().trim() || null;
  const contactName = formData.get("contact_name")?.toString().trim() || null;

  if (!goongPlaceId || goongLatitude === null || goongLongitude === null || !provinceCode || !wardCode || !eventName || !eventType || !eventDescription) {
    return;
  }

  if (eventImages.length === 0 || eventImages.length > MAX_EVENT_IMAGE_COUNT) {
    return;
  }

  if (eventImages.some((file) => file.size > MAX_EVENT_IMAGE_SIZE_BYTES)) {
    return;
  }

  const selectedCategoryIds = parseCommaList(formData.get("selected_category_ids"));
  const selectedOrganizerIds = parseCommaList(formData.get("selected_organizer_ids"));
  const newCategoryNames = parseNames(formData.get("new_category_names"));
  const newOrganizerNames = parseNames(formData.get("new_organizer_names"));

  const [createdCategoryIds, createdOrganizerIds] = await Promise.all([
    ensureCategories(supabase, user.id, [...new Set(newCategoryNames)]),
    ensureOrganizers(supabase, user.id, [...new Set(newOrganizerNames)], provinceCode, wardCode),
  ]);

  const allCategoryIds = [...new Set([...selectedCategoryIds, ...createdCategoryIds])];
  const allOrganizerIds = [...new Set([...selectedOrganizerIds, ...createdOrganizerIds])];

  const { data: validCategories } = allCategoryIds.length
    ? await supabase.from("event_categories").select("id").in("id", allCategoryIds)
    : { data: [] as { id: string }[] };
  const { data: validOrganizers } = allOrganizerIds.length
    ? await supabase.from("event_organizers").select("id").in("id", allOrganizerIds)
    : { data: [] as { id: string }[] };

  const categoryIds = (validCategories ?? []).map((item) => item.id);
  const organizerIds = (validOrganizers ?? []).map((item) => item.id);

  const recordId = crypto.randomUUID();
  let imageUrls: string[] = [];
  let uploadedImagePaths: string[] = [];

  try {
    const uploadResult = await uploadEventImages(supabase, recordId, eventImages);
    imageUrls = uploadResult.imageUrls;
    uploadedImagePaths = uploadResult.uploadedPaths;
  } catch (error) {
    console.error("createEventRecordAction upload images failed", error);
    return;
  }

  const { data: record, error: recordError } = await supabase
    .from("event_records")
    .insert({
      id: recordId,
      record_kind: recordKind,
      goong_place_id: goongPlaceId,
      goong_latitude: goongLatitude,
      goong_longitude: goongLongitude,
      province_code: provinceCode,
      ward_code: wardCode,
      event_name: eventName,
      event_type: eventType,
      event_description: eventDescription,
      image_urls: imageUrls,
      allow_registration: allowRegistration,
      organized_at: firstDatedSchedule?.organizedAt ?? null,
      opens_at: firstDatedSchedule?.opensAt ?? null,
      closes_at: firstDatedSchedule?.closesAt ?? null,
      excluded_weekdays: [],
      schedule_description: scheduleDescription,
      contact_phone: contactPhone,
      contact_email: contactEmail,
      contact_name: contactName,
      created_by: user.id,
    })
    .select("id")
    .maybeSingle<{ id: string }>();

  if (recordError || !record?.id) {
    console.error("createEventRecordAction insert record failed", recordError);
    const { error: cleanupError } = await supabase.storage.from("events").remove(uploadedImagePaths);
    if (cleanupError) {
      console.error("createEventRecordAction cleanup uploaded images failed", cleanupError);
    }
    return;
  }

  if (schedules.length > 0) {
    const { error: scheduleError } = await supabase.from("event_record_schedules").insert(
      schedules.map((schedule) => ({
        event_record_id: record.id,
        slot_order: schedule.slotOrder,
        organized_at: schedule.organizedAt,
        weekday: schedule.weekday,
        opens_at: schedule.opensAt,
        closes_at: schedule.closesAt,
      })),
    );

    if (scheduleError) {
      console.error("createEventRecordAction insert schedules failed", scheduleError);
      return;
    }
  }

  if (categoryIds.length > 0) {
    const rows = categoryIds.map((categoryId) => ({
      event_record_id: record.id,
      category_id: categoryId,
    }));

    const { error } = await supabase.from("event_record_categories").insert(rows);
    if (error) {
      console.error("createEventRecordAction insert categories failed", error);
    }
  }

  if (organizerIds.length > 0) {
    const rows = organizerIds.map((organizerId) => ({
      event_record_id: record.id,
      organizer_id: organizerId,
    }));

    const { error } = await supabase.from("event_record_organizers").insert(rows);
    if (error) {
      console.error("createEventRecordAction insert organizers failed", error);
    }
  }

  revalidatePath("/events");
  redirect("/events");
}

export async function reviewEventRecordAction(formData: FormData) {
  const { supabase, user } = await requireUser();
  const role = await resolveUserRole(supabase, user.id);

  if (!role) {
    return;
  }

  const recordId = formData.get("record_id")?.toString().trim() ?? "";
  const decision = formData.get("decision")?.toString().trim() ?? "";
  const rejectionReason = formData.get("rejection_reason")?.toString().trim() ?? "";

  if (!recordId || (decision !== "approve" && decision !== "reject")) {
    return;
  }

  if (decision === "reject" && !rejectionReason) {
    return;
  }

  const { data: record, error: recordError } = await supabase
    .from("event_records")
    .select("id, province_code, ward_code, reviewed_at")
    .eq("id", recordId)
    .maybeSingle<{ id: string; province_code: string; ward_code: string; reviewed_at: string | null }>();

  if (recordError || !record || record.reviewed_at) {
    return;
  }

  let canReview = role === "admin";

  if (!canReview && role === "province_manager") {
    const { data: managedProvince } = await supabase
      .from("province_managers")
      .select("province_code")
      .eq("user_id", user.id)
      .eq("province_code", record.province_code)
      .maybeSingle();

    canReview = Boolean(managedProvince);
  }

  if (!canReview && role === "ward_admin") {
    const { data: managedWard } = await supabase
      .from("ward_admins")
      .select("ward_code")
      .eq("user_id", user.id)
      .eq("ward_code", record.ward_code)
      .maybeSingle();

    canReview = Boolean(managedWard);
  }

  if (!canReview) {
    return;
  }

  const nowIso = new Date().toISOString();
  const { error: updateError } = await supabase
    .from("event_records")
    .update({
      is_approved: decision === "approve",
      reviewed_by: user.id,
      reviewed_at: nowIso,
      rejection_reason: decision === "reject" ? rejectionReason : null,
      updated_at: nowIso,
    })
    .eq("id", record.id)
    .is("reviewed_at", null);

  if (updateError) {
    console.error("reviewEventRecordAction failed", updateError);
  }

  revalidatePath("/events");
}

export async function deleteEventRecordAction(formData: FormData) {
  const { supabase, user } = await requireUser();

  const recordId = formData.get("record_id")?.toString().trim() ?? "";

  if (!recordId) {
    return;
  }

  const { data: record, error: recordError } = await supabase
    .from("event_records")
    .select("id, created_by, reviewed_at, is_approved")
    .eq("id", recordId)
    .maybeSingle<{ id: string; created_by: string; reviewed_at: string | null; is_approved: boolean }>();

  if (recordError || !record) {
    return;
  }

  const isDeletable =
    record.created_by === user.id &&
    (record.reviewed_at === null || (record.reviewed_at !== null && !record.is_approved));

  if (!isDeletable) {
    return;
  }

  const { error: deleteError } = await supabase
    .from("event_records")
    .delete()
    .eq("id", record.id)
    .eq("created_by", user.id);

  if (deleteError) {
    console.error("deleteEventRecordAction failed", deleteError);
    return;
  }

  revalidatePath("/events");
}

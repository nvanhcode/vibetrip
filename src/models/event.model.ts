export type EventRecordKind = "event" | "place";

export type EventCategory = {
  id: string;
  name: string;
  created_by: string;
  created_at: string;
  updated_at: string;
};

export type EventOrganizer = {
  id: string;
  name: string;
  created_by: string;
  created_at: string;
  updated_at: string;
};

export type EventRecord = {
  id: string;
  record_kind: EventRecordKind;
  goong_place_id: string;
  goong_latitude: number;
  goong_longitude: number;
  province_code: string;
  ward_code: string;
  event_name: string;
  event_type: string;
  event_description: string;
  image_urls: string[];
  allow_registration: boolean;
  organized_at: string | null;
  opens_at: string | null;
  closes_at: string | null;
  excluded_weekdays: string[];
  schedule_description: string | null;
  contact_phone: string | null;
  contact_email: string | null;
  contact_name: string | null;
  is_approved: boolean;
  reviewed_by: string | null;
  reviewed_at: string | null;
  rejection_reason: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
  event_record_schedules?: EventRecordSchedule[];
};

export type EventRecordSchedule = {
  id: string;
  event_record_id: string;
  slot_order: number;
  organized_at: string | null;
  weekday: number | null;
  opens_at: string;
  closes_at: string;
  created_at: string;
};

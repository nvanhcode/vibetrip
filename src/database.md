## Table `provinces`

### Columns

| Name | Type | Constraints |
|------|------|-------------|
| `code` | `text` | Primary |
| `name` | `text` |  |
| `created_at` | `timestamptz` |  |
| `updated_at` | `timestamptz` |  |

## Table `wards`

### Columns

| Name | Type | Constraints |
|------|------|-------------|
| `code` | `text` | Primary |
| `province_code` | `text` |  |
| `name` | `text` |  |
| `english_name` | `text` |  Nullable |
| `level` | `text` |  Nullable |
| `decree` | `text` |  Nullable |
| `created_at` | `timestamptz` |  |
| `updated_at` | `timestamptz` |  |

## Table `user_roles`

### Columns

| Name | Type | Constraints |
|------|------|-------------|
| `user_id` | `uuid` | Primary, FK -> `auth.users.id` |
| `role` | `app_role` | Not Null |
| `assigned_by` | `uuid` | Nullable, FK -> `auth.users.id` |
| `created_at` | `timestamptz` |  |
| `updated_at` | `timestamptz` |  |

## Table `province_managers`

### Columns

| Name | Type | Constraints |
|------|------|-------------|
| `user_id` | `uuid` | Primary (composite), FK -> `auth.users.id` |
| `province_code` | `text` | Primary (composite), FK -> `provinces.code` |
| `assigned_by` | `uuid` | Nullable, FK -> `auth.users.id` |
| `created_at` | `timestamptz` |  |

## Table `ward_admins`

### Columns

| Name | Type | Constraints |
|------|------|-------------|
| `user_id` | `uuid` | Primary (composite), FK -> `auth.users.id` |
| `ward_code` | `text` | Primary (composite), FK -> `wards.code` |
| `assigned_by` | `uuid` | Nullable, FK -> `auth.users.id` |
| `created_at` | `timestamptz` |  |

## Table `access_requests`

### Columns

| Name | Type | Constraints |
|------|------|-------------|
| `id` | `uuid` | Primary |
| `user_id` | `uuid` | Nullable, FK -> `auth.users.id` |
| `email` | `text` | Not Null |
| `full_name` | `text` | Not Null |
| `requested_role` | `app_role` | Nullable |
| `province_code` | `text` | Nullable, FK -> `provinces.code` |
| `status` | `access_request_status` | Not Null, Default `pending` |
| `notes` | `text` | Nullable |
| `reviewed_by` | `uuid` | Nullable, FK -> `auth.users.id` |
| `created_at` | `timestamptz` |  |
| `updated_at` | `timestamptz` |  |

## Table `event_categories`

### Columns

| Name | Type | Constraints |
|------|------|-------------|
| `id` | `uuid` | Primary |
| `name` | `text` | Not Null |
| `created_by` | `uuid` | Not Null, FK -> `auth.users.id` |
| `created_at` | `timestamptz` |  |
| `updated_at` | `timestamptz` |  |

## Table `event_organizers`

### Columns

| Name | Type | Constraints |
|------|------|-------------|
| `id` | `uuid` | Primary |
| `name` | `text` | Not Null |
| `province_code` | `text` | Nullable, FK -> `provinces.code` |
| `ward_code` | `text` | Nullable, FK -> `wards.code` |
| `created_by` | `uuid` | Not Null, FK -> `auth.users.id` |
| `created_at` | `timestamptz` |  |
| `updated_at` | `timestamptz` |  |

## Table `event_records`

### Columns

| Name | Type | Constraints |
|------|------|-------------|
| `id` | `uuid` | Primary |
| `record_kind` | `text` | Not Null (`event` or `place`) |
| `goong_place_id` | `text` | Not Null |
| `goong_latitude` | `double precision` | Nullable |
| `goong_longitude` | `double precision` | Nullable |
| `province_code` | `text` | Not Null, FK -> `provinces.code` |
| `ward_code` | `text` | Not Null, FK -> `wards.code` |
| `event_name` | `text` | Not Null |
| `event_type` | `text` | Not Null |
| `event_description` | `text` | Not Null |
| `allow_registration` | `boolean` | Not Null |
| `organized_at` | `timestamptz` | Nullable |
| `opens_at` | `time` | Nullable |
| `closes_at` | `time` | Nullable |
| `excluded_weekdays` | `text[]` | Not Null, legacy (khong con nhap tu form) |
| `schedule_description` | `text` | Nullable |
| `contact_phone` | `text` | Nullable |
| `contact_email` | `text` | Nullable |
| `contact_name` | `text` | Nullable |
| `is_approved` | `boolean` | Not Null |
| `reviewed_by` | `uuid` | Nullable, FK -> `auth.users.id` |
| `reviewed_at` | `timestamptz` | Nullable |
| `rejection_reason` | `text` | Nullable |
| `created_by` | `uuid` | Not Null, FK -> `auth.users.id` |
| `created_at` | `timestamptz` |  |
| `updated_at` | `timestamptz` |  |

## Table `event_record_categories`

### Columns

| Name | Type | Constraints |
|------|------|-------------|
| `event_record_id` | `uuid` | Primary (composite), FK -> `event_records.id` |
| `category_id` | `uuid` | Primary (composite), FK -> `event_categories.id` |
| `created_at` | `timestamptz` |  |

## Table `event_record_organizers`

### Columns

| Name | Type | Constraints |
|------|------|-------------|
| `event_record_id` | `uuid` | Primary (composite), FK -> `event_records.id` |
| `organizer_id` | `uuid` | Primary (composite), FK -> `event_organizers.id` |
| `created_at` | `timestamptz` |  |

## Table `event_record_schedules`

### Columns

| Name | Type | Constraints |
|------|------|-------------|
| `id` | `uuid` | Primary |
| `event_record_id` | `uuid` | FK -> `event_records.id` |
| `slot_order` | `integer` | Not Null, unique per `event_record_id` |
| `organized_at` | `timestamptz` | Not Null |
| `opens_at` | `time` | Not Null |
| `closes_at` | `time` | Not Null |
| `created_at` | `timestamptz` |  |


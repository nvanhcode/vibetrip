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


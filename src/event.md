# Đặc tính của một bản ghi sự kiện / địa điểm (Event Record)

## Bảng `event_records`

Mỗi bản ghi đại diện cho một sự kiện hoặc địa điểm trong hệ thống.

| Cột | Kiểu | Bắt buộc | Mô tả |
|-----|------|----------|-------|
| `id` | `uuid` | ✓ | Khoá chính, tự sinh |
| `record_kind` | `text` | ✓ | Loại bản ghi: `event` (sự kiện) hoặc `place` (địa điểm) |
| `goong_place_id` | `text` | ✓ | ID địa điểm từ Goong Maps API |
| `goong_latitude` | `double precision` | — | Vĩ độ, từ −90 đến 90; đi theo cặp với `goong_longitude` |
| `goong_longitude` | `double precision` | — | Kinh độ, từ −180 đến 180; đi theo cặp với `goong_latitude` |
| `province_code` | `text` | ✓ | Mã tỉnh, tham chiếu `provinces.code` |
| `ward_code` | `text` | ✓ | Mã xã, tham chiếu `wards.code` |
| `event_name` | `text` | ✓ | Tên sự kiện / địa điểm hiển thị |
| `event_type` | `text` | ✓ | Loại hình (ví dụ: Lễ hội, Ẩm thực, Check-in…) |
| `event_description` | `text` | ✓ | Mô tả nội dung chính |
| `image_urls` | `text[]` | ✓ | Danh sách URL ảnh mô tả (lưu trên Supabase Storage bucket `events`) |
| `allow_registration` | `boolean` | ✓ | Có cho phép đăng ký tham gia không, mặc định `false` |
| `organized_at` | `timestamptz` | — | Thời điểm tổ chức của slot ngày cụ thể đầu tiên (denormalized từ `event_record_schedules`) |
| `opens_at` | `time` | — | Giờ mở cửa của slot đầu tiên (đi theo cặp với `closes_at`) |
| `closes_at` | `time` | — | Giờ đóng cửa của slot đầu tiên (đi theo cặp với `opens_at`) |
| `excluded_weekdays` | `text[]` | ✓ | Danh sách thứ bị loại trừ, mặc định `{}` |
| `schedule_description` | `text` | — | Mô tả lịch tự do nếu không có khung giờ cố định |
| `contact_phone` | `text` | — | Số điện thoại liên hệ |
| `contact_email` | `text` | — | Email liên hệ |
| `contact_name` | `text` | — | Tên người liên hệ |
| `is_approved` | `boolean` | ✓ | Trạng thái duyệt, mặc định `false` |
| `reviewed_by` | `uuid` | — | UUID người duyệt, tham chiếu `auth.users.id` |
| `reviewed_at` | `timestamptz` | — | Thời điểm duyệt |
| `rejection_reason` | `text` | — | Lý do từ chối (chỉ có khi `is_approved = false` và đã review) |
| `created_by` | `uuid` | ✓ | UUID người tạo, tham chiếu `auth.users.id` |
| `created_at` | `timestamptz` | ✓ | Thời điểm tạo, tự gán `now()` |
| `updated_at` | `timestamptz` | ✓ | Thời điểm cập nhật cuối, tự cập nhật qua trigger |

### Ràng buộc bảng `event_records`

| Tên ràng buộc | Điều kiện |
|---------------|-----------|
| `event_records_kind_check` | `record_kind` phải là `'event'` hoặc `'place'` |
| `event_records_time_pair_check` | `opens_at` và `closes_at` phải cùng null hoặc cùng có giá trị |
| `event_records_goong_coordinates_pair_check` | `goong_latitude` và `goong_longitude` phải cùng null hoặc cùng có giá trị |
| `event_records_goong_latitude_range_check` | `goong_latitude` trong khoảng −90 đến 90 |
| `event_records_goong_longitude_range_check` | `goong_longitude` trong khoảng −180 đến 180 |
| `event_records_review_state_check` | Trạng thái review phải nhất quán: chưa review thì cả 3 cột review phải null và `is_approved = false`; đã review thì `reviewed_at` và `reviewed_by` phải có giá trị, kèm logic approve/reject hợp lệ |

---

## Bảng `event_record_schedules`

Mỗi bản ghi có thể có **0 hoặc nhiều** slot thời gian. Để trống toàn bộ nghĩa là mở tất cả các ngày.

| Cột | Kiểu | Bắt buộc | Mô tả |
|-----|------|----------|-------|
| `id` | `uuid` | ✓ | Khoá chính, tự sinh |
| `event_record_id` | `uuid` | ✓ | FK → `event_records.id`, xoá cascade |
| `slot_order` | `integer` | ✓ | Thứ tự slot (0-based), unique theo từng record |
| `organized_at` | `timestamptz` | — | Ngày giờ cụ thể; có giá trị khi `weekday` là null |
| `weekday` | `smallint` | — | Thứ trong tuần: `1`=Thứ 2 … `7`=Chủ nhật; có giá trị khi `organized_at` là null |
| `opens_at` | `time` | ✓ | Giờ mở cửa |
| `closes_at` | `time` | ✓ | Giờ đóng cửa |
| `created_at` | `timestamptz` | ✓ | Thời điểm tạo, tự gán `now()` |

### Ràng buộc bảng `event_record_schedules`

| Tên ràng buộc | Điều kiện |
|---------------|-----------|
| `event_record_schedules_time_order_check` | `opens_at < closes_at` |
| `event_record_schedules_unique_order` | `(event_record_id, slot_order)` là unique |
| `event_record_schedules_mode_check` | Mỗi slot phải là đúng một trong hai mode: `organized_at IS NOT NULL AND weekday IS NULL` (ngày cụ thể) hoặc `organized_at IS NULL AND weekday BETWEEN 1 AND 7` (thứ trong tuần) |

---

## Bảng `event_record_categories` (quan hệ nhiều-nhiều)

| Cột | Kiểu | Mô tả |
|-----|------|-------|
| `event_record_id` | `uuid` | FK → `event_records.id`, xoá cascade |
| `category_id` | `uuid` | FK → `event_categories.id`, xoá restrict |
| `created_at` | `timestamptz` | Thời điểm tạo |

---

## Bảng `event_record_organizers` (quan hệ nhiều-nhiều)

| Cột | Kiểu | Mô tả |
|-----|------|-------|
| `event_record_id` | `uuid` | FK → `event_records.id`, xoá cascade |
| `organizer_id` | `uuid` | FK → `event_organizers.id`, xoá restrict |
| `created_at` | `timestamptz` | Thời điểm tạo |

---

## Bảng `event_categories`

| Cột | Kiểu | Mô tả |
|-----|------|-------|
| `id` | `uuid` | Khoá chính |
| `name` | `text` | Tên danh mục, unique (case-insensitive) |
| `created_by` | `uuid` | FK → `auth.users.id` |
| `created_at` | `timestamptz` | — |
| `updated_at` | `timestamptz` | Tự cập nhật qua trigger |

---

## Bảng `event_organizers`

| Cột | Kiểu | Mô tả |
|-----|------|-------|
| `id` | `uuid` | Khoá chính |
| `name` | `text` | Tên đơn vị, unique (case-insensitive) |
| `province_code` | `text` | FK → `provinces.code`; phạm vi tỉnh |
| `ward_code` | `text` | FK → `wards.code`; phạm vi xã |
| `created_by` | `uuid` | FK → `auth.users.id` |
| `created_at` | `timestamptz` | — |
| `updated_at` | `timestamptz` | Tự cập nhật qua trigger |

---

## Luồng trạng thái duyệt

```
Tạo mới
  → is_approved = false, reviewed_at = null   [Chờ duyệt]
  → Duyệt: is_approved = true, reviewed_at = now(), reviewed_by = uid   [Đã duyệt]
  → Từ chối: is_approved = false, reviewed_at = now(), reviewed_by = uid, rejection_reason = "..."   [Từ chối]
```

Ai có thể duyệt (`can_review_event_record`):
- `admin`: duyệt tất cả
- `province_manager`: duyệt bản ghi thuộc tỉnh mình quản lý
- `ward_admin`: duyệt bản ghi thuộc xã mình quản lý

---

## RLS (Row Level Security)

- **SELECT**: authenticated user thấy bản ghi nếu đã duyệt, hoặc chính mình tạo, hoặc có quyền review
- **INSERT/UPDATE**: người tạo (chờ duyệt), người review (duyệt/từ chối)
- **DELETE**: admin, hoặc chính người tạo nếu bản ghi chưa duyệt / bị từ chối

---

## Ghi chú về lịch tổ chức

- Để trống toàn bộ `event_record_schedules` = **mở tất cả các ngày**, không có hạn chế thời gian.
- Mỗi slot là **ngày cụ thể** (`organized_at` có giá trị) **hoặc** **lịch theo thứ** (`weekday` 1–7).
- Các cột `organized_at`, `opens_at`, `closes_at` trên `event_records` là bản sao denormalized của slot ngày cụ thể đầu tiên, dùng để tương thích với dữ liệu cũ và truy vấn nhanh.

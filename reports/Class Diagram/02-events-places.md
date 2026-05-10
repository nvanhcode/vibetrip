# Class Diagram – Sự kiện & Địa điểm

Vẽ class diagram cho module quản lý sự kiện và địa điểm du lịch, bao gồm phân loại, ban tổ chức và quy trình duyệt.

## Mermaid

```mermaid
classDiagram
    class AuthUser {
        +UUID id
        +String email
    }

    class Province {
        +String code PK
        +String name
    }

    class Ward {
        +String code PK
        +String name
        +String province_code FK
    }

    class EventCategory {
        +UUID id PK
        +String name
        +UUID created_by FK
        +Timestamp created_at
        +Timestamp updated_at
    }

    class EventOrganizer {
        +UUID id PK
        +String name
        +String province_code FK
        +String ward_code FK
        +UUID created_by FK
        +Timestamp created_at
        +Timestamp updated_at
    }

    class EventRecord {
        +UUID id PK
        +RecordKind record_kind
        +String goong_place_id
        +String province_code FK
        +String ward_code FK
        +String event_name
        +String event_type
        +String event_description
        +Boolean allow_registration
        +Timestamp organized_at
        +Time opens_at
        +Time closes_at
        +String[] excluded_weekdays
        +String schedule_description
        +String contact_phone
        +String contact_email
        +String contact_name
        +String[] image_urls
        +Boolean is_approved
        +UUID reviewed_by FK
        +Timestamp reviewed_at
        +String rejection_reason
        +UUID created_by FK
        +Timestamp created_at
        +Timestamp updated_at
    }

    class EventRecordCategory {
        +UUID event_record_id PK, FK
        +UUID category_id PK, FK
        +Timestamp created_at
    }

    class EventRecordOrganizer {
        +UUID event_record_id PK, FK
        +UUID organizer_id PK, FK
        +Timestamp created_at
    }

    class RecordKind {
        <<enumeration>>
        event
        place
    }

    EventRecord --> RecordKind : record_kind
    EventRecord "0..*" --> "1" Province : belongs to
    EventRecord "0..*" --> "1" Ward : belongs to
    EventRecord "0..*" --> "1" AuthUser : created_by
    EventRecord "0..*" --> "0..1" AuthUser : reviewed_by

    EventCategory "0..*" --> "1" AuthUser : created_by
    EventOrganizer "0..*" --> "1" AuthUser : created_by
    EventOrganizer "0..*" --> "0..1" Province : scoped to
    EventOrganizer "0..*" --> "0..1" Ward : scoped to

    EventRecordCategory --> EventRecord : references
    EventRecordCategory --> EventCategory : references

    EventRecordOrganizer --> EventRecord : references
    EventRecordOrganizer --> EventOrganizer : references
```

## Mô tả

| Bảng | Vai trò |
|---|---|
| `event_records` | Bản ghi sự kiện hoặc địa điểm (record_kind = event/place) |
| `event_categories` | Danh mục phân loại sự kiện |
| `event_organizers` | Đơn vị tổ chức sự kiện, phân phạm vi tỉnh/xã |
| `event_record_categories` | Bảng liên kết nhiều-nhiều: sự kiện ↔ danh mục |
| `event_record_organizers` | Bảng liên kết nhiều-nhiều: sự kiện ↔ ban tổ chức |

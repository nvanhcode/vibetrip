# Class Diagram – RBAC & Quản lý người dùng

Vẽ class diagram cho module phân quyền (RBAC) và quản lý người dùng theo tỉnh/xã.

## Mermaid

```mermaid
classDiagram
    class AuthUser {
        +UUID id
        +String email
        +Timestamp created_at
    }

    class Province {
        +String code PK
        +String name
        +String slug
        +String division_type
        +Int codename
        +Int phone_code
    }

    class Ward {
        +String code PK
        +String name
        +String slug
        +String division_type
        +String province_code FK
    }

    class UserRole {
        +UUID user_id PK, FK
        +AppRole role
        +UUID assigned_by FK
        +Timestamp created_at
        +Timestamp updated_at
    }

    class ProvinceManager {
        +UUID user_id PK, FK
        +String province_code PK, FK
        +UUID assigned_by FK
        +Timestamp created_at
    }

    class WardAdmin {
        +UUID user_id PK, FK
        +String ward_code PK, FK
        +UUID assigned_by FK
        +Timestamp created_at
    }

    class AccessRequest {
        +UUID id PK
        +UUID user_id FK
        +String email
        +String full_name
        +AppRole requested_role
        +String province_code FK
        +AccessRequestStatus status
        +String notes
        +UUID reviewed_by FK
        +Timestamp created_at
        +Timestamp updated_at
    }

    class AppRole {
        <<enumeration>>
        admin
        province_manager
        ward_admin
    }

    class AccessRequestStatus {
        <<enumeration>>
        pending
        approved
        rejected
    }

    AuthUser "1" --> "0..1" UserRole : has
    AuthUser "1" --> "0..*" ProvinceManager : manages
    AuthUser "1" --> "0..*" WardAdmin : administers
    AuthUser "1" --> "0..*" AccessRequest : submits

    Province "1" --> "0..*" Ward : contains
    Province "1" --> "0..*" ProvinceManager : managed by
    Province "1" --> "0..*" AccessRequest : scoped to

    Ward "1" --> "0..*" WardAdmin : administered by

    UserRole --> AppRole : uses
    AccessRequest --> AppRole : requests
    AccessRequest --> AccessRequestStatus : has status
```

## Mô tả

| Bảng | Vai trò |
|---|---|
| `auth.users` | Người dùng hệ thống (Supabase Auth) |
| `user_roles` | Gán vai trò toàn cục cho người dùng |
| `province_managers` | Ánh xạ người dùng quản lý tỉnh |
| `ward_admins` | Ánh xạ người dùng quản lý xã/phường |
| `access_requests` | Yêu cầu cấp quyền từ người dùng |
| `provinces` | Danh sách tỉnh/thành phố |
| `wards` | Danh sách xã/phường/thị trấn |

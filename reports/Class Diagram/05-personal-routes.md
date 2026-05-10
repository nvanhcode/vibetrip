# Class Diagram – Tuyến đường cá nhân

Vẽ class diagram cho module lập và chia sẻ tuyến đường du lịch cá nhân.

## Mermaid

```mermaid
classDiagram
    class AuthUser {
        +UUID id
        +String email
    }

    class EventRecord {
        +UUID id PK
        +String event_name
        +String record_kind
    }

    class UserRoute {
        +UUID id PK
        +UUID owner_id FK
        +String owner_display_name
        +String title
        +Date start_date
        +RouteVisibility visibility
        +String origin_label
        +Float origin_latitude
        +Float origin_longitude
        +String summary
        +Int stop_count
        +Timestamp created_at
        +Timestamp updated_at
    }

    class UserRouteStop {
        +UUID id PK
        +UUID route_id FK
        +Int position
        +StopKind stop_kind
        +String label
        +Float latitude
        +Float longitude
        +UUID event_record_id FK
        +Timestamp created_at
    }

    class RouteVisibility {
        <<enumeration>>
        public
        friends
        private
    }

    class StopKind {
        <<enumeration>>
        origin
        record
    }

    AuthUser "1" --> "0..*" UserRoute : owns
    UserRoute --> RouteVisibility : has visibility
    UserRoute "1" --> "1..*" UserRouteStop : contains
    UserRouteStop --> StopKind : has kind
    UserRouteStop "0..*" --> "0..1" EventRecord : linked to
```

## Mô tả

| Bảng | Vai trò |
|---|---|
| `user_routes` | Tuyến đường du lịch do người dùng tạo, có thể chia sẻ public/friends/private |
| `user_route_stops` | Các điểm dừng trong tuyến đường, theo thứ tự position |

### Ràng buộc nghiệp vụ
- `stop_count` được đồng bộ tự động qua trigger; luôn ≥ 0.
- `(route_id, position)` là unique — không có hai điểm dừng cùng vị trí trong một tuyến.
- Visibility `friends` được kiểm tra qua RLS sử dụng hàm `is_user_friend()`.
- `stop_kind = 'origin'` là điểm xuất phát; `'record'` là điểm dừng gắn với sự kiện/địa điểm.

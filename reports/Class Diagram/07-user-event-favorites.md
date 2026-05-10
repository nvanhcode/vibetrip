# Class Diagram – Yêu thích sự kiện

Vẽ class diagram cho module lưu sự kiện/địa điểm yêu thích của người dùng.

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
        +Boolean is_approved
    }

    class UserEventFavorite {
        +UUID id PK
        +UUID user_id FK
        +UUID event_record_id FK
        +Timestamp created_at
    }

    AuthUser "1" --> "0..*" UserEventFavorite : saves
    EventRecord "1" --> "0..*" UserEventFavorite : saved by
```

## Mô tả

| Bảng | Vai trò |
|---|---|
| `user_event_favorites` | Danh sách sự kiện/địa điểm mà người dùng đánh dấu yêu thích |

### Ràng buộc nghiệp vụ
- Mỗi cặp `(user_id, event_record_id)` là duy nhất — không thể yêu thích cùng một sự kiện hai lần.
- RLS cho phép mọi người dùng đã xác thực xem danh sách yêu thích (public feature).
- Chỉ chủ sở hữu mới có thể thêm hoặc xoá mục yêu thích của mình.
- Khi sự kiện bị xoá, các bản ghi yêu thích liên quan tự động bị xoá theo (ON DELETE CASCADE).

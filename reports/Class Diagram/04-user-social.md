# Class Diagram – Kết bạn & Thông báo người dùng

Vẽ class diagram cho module kết bạn và hệ thống thông báo trong ứng dụng.

## Mermaid

```mermaid
classDiagram
    class AuthUser {
        +UUID id
        +String email
    }

    class UserFriendship {
        +UUID id PK
        +UUID requester_id FK
        +UUID addressee_id FK
        +FriendshipStatus status
        +Timestamp created_at
        +Timestamp updated_at
    }

    class FriendshipStatus {
        <<enumeration>>
        pending
        accepted
        declined
        blocked
    }

    class UserNotification {
        +UUID id PK
        +UUID recipient_user_id FK
        +UUID actor_user_id FK
        +String actor_display_name
        +NotificationType notification_type
        +String title
        +String body
        +String link_path
        +String related_resource_type
        +UUID related_resource_id
        +JSON metadata
        +Boolean is_read
        +Timestamp read_at
        +Timestamp created_at
    }

    class NotificationType {
        <<enumeration>>
        event_record_reviewed
        forum_post_liked
        forum_post_commented
        forum_comment_replied
    }

    AuthUser "1" --> "0..*" UserFriendship : sends (requester)
    AuthUser "1" --> "0..*" UserFriendship : receives (addressee)
    UserFriendship --> FriendshipStatus : has status

    AuthUser "1" --> "0..*" UserNotification : receives (recipient)
    AuthUser "0..1" --> "0..*" UserNotification : triggers (actor)
    UserNotification --> NotificationType : has type
```

## Mô tả

| Bảng | Vai trò |
|---|---|
| `user_friendships` | Quan hệ kết bạn giữa hai người dùng; mỗi cặp chỉ có tối đa một bản ghi |
| `user_notifications` | Thông báo gửi đến người dùng về các sự kiện trong ứng dụng |

### Ràng buộc nghiệp vụ
- `user_friendships`: không thể tự kết bạn với chính mình; unique index trên cặp (least, greatest) đảm bảo không trùng lặp theo chiều.
- `user_notifications`: `is_read = true` khi và chỉ khi `read_at` không null.
- Thông báo hỗ trợ 4 loại: duyệt sự kiện, thích bài viết, bình luận bài viết, trả lời bình luận.

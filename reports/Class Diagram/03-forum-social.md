# Class Diagram – Forum & Tương tác xã hội

Vẽ class diagram cho module diễn đàn cộng đồng: bài viết, lượt thích, bình luận và trả lời.

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
    }

    class ForumPost {
        +UUID id PK
        +UUID author_id FK
        +String author_name
        +String author_avatar_url
        +String content
        +String[] image_urls
        +String checkin_place_id
        +String checkin_place_name
        +String checkin_place_address
        +Float checkin_latitude
        +Float checkin_longitude
        +UUID event_record_id FK
        +Timestamp created_at
        +Timestamp updated_at
    }

    class ForumPostLike {
        +UUID post_id PK, FK
        +UUID user_id PK, FK
        +Timestamp created_at
    }

    class ForumPostComment {
        +UUID id PK
        +UUID post_id FK
        +UUID parent_comment_id FK
        +UUID author_id FK
        +String author_name
        +String author_avatar_url
        +String content
        +Timestamp created_at
        +Timestamp updated_at
    }

    AuthUser "1" --> "0..*" ForumPost : authors
    AuthUser "1" --> "0..*" ForumPostLike : likes
    AuthUser "1" --> "0..*" ForumPostComment : comments

    EventRecord "0..1" <-- "0..*" ForumPost : tagged with

    ForumPost "1" --> "0..*" ForumPostLike : receives
    ForumPost "1" --> "0..*" ForumPostComment : has

    ForumPostComment "0..1" <-- "0..*" ForumPostComment : replies to (parent)
```

## Mô tả

| Bảng | Vai trò |
|---|---|
| `forum_posts` | Bài viết của người dùng, có thể đính kèm ảnh hoặc check-in địa điểm |
| `forum_post_likes` | Lượt thích bài viết (quan hệ nhiều-nhiều user ↔ post) |
| `forum_post_comments` | Bình luận bài viết, hỗ trợ trả lời lồng nhau (parent_comment_id) |

### Ràng buộc nghiệp vụ
- Bài viết phải có ít nhất nội dung text hoặc một ảnh.
- Check-in yêu cầu latitude/longitude đi kèm tên địa điểm.
- Bình luận trả lời (`parent_comment_id`) phải cùng bài viết với bình luận cha.

# Prompt tạo Sequence Diagram - Forum & Tương tác xã hội

Bạn là chuyên gia phân tích hệ thống. Hãy tạo **Sequence Diagram** cho module **diễn đàn cộng đồng**.

## Mục tiêu
Mô tả đầy đủ trình tự tương tác giữa các thành phần khi:
- Người dùng đăng bài viết (text/ảnh/check-in).
- Người dùng khác like bài viết.
- Người dùng bình luận bài viết.
- Người dùng trả lời bình luận (nested comment).
- Hệ thống tạo thông báo cho tác giả sau mỗi tương tác.

## Các actor/participant
- `NguoiDang` — người đăng bài viết
- `NguoiXem` — người dùng tương tác (like/comment/reply)
- `AppServer` — hệ thống ứng dụng (Next.js API)
- `CSDL` — cơ sở dữ liệu (Supabase: forum_posts, forum_post_likes, forum_post_comments, user_notifications)

## Luồng chính cần thể hiện
1. NguoiDang gửi yêu cầu tạo bài viết (content, images, check-in).
2. AppServer validate: phải có `content` hoặc ít nhất 1 ảnh; nếu check-in phải có tên địa điểm và tọa độ.
3. Nếu validate thất bại: AppServer trả lỗi.
4. Nếu thành công: AppServer lưu `forum_posts` vào CSDL và trả xác nhận.
5. NguoiXem gửi yêu cầu like bài viết.
6. AppServer kiểm tra cặp `(user_id, post_id)` đã tồn tại chưa.
7. Nếu chưa: lưu like, tạo thông báo cho NguoiDang.
8. Nếu đã có: trả phản hồi "đã like".
9. NguoiXem gửi bình luận bài viết.
10. AppServer validate và lưu comment vào CSDL; tạo thông báo cho NguoiDang.
11. NguoiXem gửi reply cho một comment (`parent_comment_id`).
12. AppServer validate `parent_comment_id` cùng bài viết, lưu nested comment; tạo thông báo.
13. AppServer trả xác nhận tương tác cho NguoiXem.

## Ràng buộc nghiệp vụ cần thể hiện
- Bài viết phải có ít nhất `content` hoặc ảnh.
- Like là quan hệ unique `(user_id, post_id)`.
- Comment reply phải cùng `post_id` với comment cha.
- Mỗi tương tác tạo ra thông báo cho chủ bài viết.

## Yêu cầu đầu ra
- Xuất duy nhất 1 khối Mermaid dùng `sequenceDiagram`.
- Dùng `alt` / `else` cho nhánh validate và kiểm tra trùng like.
- Dùng `loop` nếu cần thể hiện nhiều tương tác liên tiếp.
- Nhãn thông điệp ngắn gọn bằng tiếng Việt.
- Không thêm giải thích ngoài khối Mermaid.

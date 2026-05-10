# Prompt tạo Activity Diagram - Forum & Tương tác xã hội

Bạn là chuyên gia phân tích hệ thống. Hãy tạo **Activity Diagram** cho module **diễn đàn cộng đồng**.

## Mục tiêu
Mô tả các luồng chính:
- Đăng bài viết (text/ảnh/check-in).
- Validate điều kiện: phải có text hoặc ảnh.
- Người dùng khác thả like bài viết.
- Người dùng bình luận bài viết.
- Người dùng trả lời bình luận (nested comment).
- Hệ thống tạo thông báo liên quan cho tác giả.

## Thành phần tham gia
- Người đăng bài
- Người tương tác (like/comment/reply)
- Hệ thống ứng dụng
- CSDL (forum_posts, forum_post_likes, forum_post_comments)

## Ràng buộc nghiệp vụ cần thể hiện
- Bài viết không hợp lệ nếu thiếu cả text và ảnh.
- Check-in cần đủ tên địa điểm + latitude/longitude.
- Comment trả lời phải cùng bài viết với comment cha.
- Like là quan hệ user-post, tránh trùng cặp.

## Yêu cầu đầu ra
- Xuất duy nhất 1 khối Mermaid dùng `flowchart TD`.
- Có các nhánh cho: đăng bài, like, comment, reply.
- Có xử lý validate thất bại -> trả lỗi.
- Có start/end và các decision node.
- Không thêm giải thích ngoài khối Mermaid.

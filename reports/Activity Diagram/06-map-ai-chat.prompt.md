# Prompt tạo Activity Diagram - AI Chat trên bản đồ

Bạn là chuyên gia phân tích hệ thống. Hãy tạo **Activity Diagram** cho module **AI chat tích hợp bản đồ**.

## Mục tiêu
Mô tả đầy đủ luồng:
- Người dùng tạo cuộc hội thoại mới hoặc mở hội thoại cũ.
- Người dùng gửi tin nhắn kèm attachments (nếu có).
- Hệ thống validate `content` không rỗng, `attachments` đúng dạng mảng JSON.
- Hệ thống lưu tin nhắn user.
- Hệ thống gọi AI để sinh phản hồi.
- Hệ thống lưu tin nhắn assistant.
- Trigger cập nhật `updated_at` của conversation.
- Người dùng xem lịch sử hội thoại.

## Thành phần tham gia
- Người dùng
- Dịch vụ AI
- Hệ thống ứng dụng
- CSDL (map_ai_conversations, map_ai_messages)

## Ràng buộc nghiệp vụ cần thể hiện
- RLS: chỉ chủ sở hữu xem/sửa dữ liệu hội thoại của mình.
- `title` conversation và `content` message không được rỗng.
- `role` chỉ gồm `user` hoặc `assistant`.

## Yêu cầu đầu ra
- Xuất duy nhất 1 khối Mermaid dùng `flowchart TD`.
- Có nhánh xử lý lỗi validate/gọi AI thất bại.
- Có điểm bắt đầu và kết thúc.
- Tên node ngắn gọn bằng tiếng Việt.
- Không thêm giải thích ngoài khối Mermaid.

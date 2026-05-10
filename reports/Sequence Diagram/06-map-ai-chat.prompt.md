# Prompt tạo Sequence Diagram - AI Chat tích hợp bản đồ

Bạn là chuyên gia phân tích hệ thống. Hãy tạo **Sequence Diagram** cho module **AI chat tích hợp bản đồ**.

## Mục tiêu
Mô tả đầy đủ trình tự tương tác giữa các thành phần khi:
- Người dùng tạo cuộc hội thoại mới hoặc mở hội thoại cũ.
- Người dùng gửi tin nhắn kèm attachments.
- Hệ thống lưu tin nhắn, gọi AI sinh phản hồi và lưu tin nhắn assistant.
- Người dùng xem lịch sử hội thoại.

## Các actor/participant
- `NguoiDung` — người dùng đã xác thực
- `AppServer` — hệ thống ứng dụng (Next.js API)
- `DichVuAI` — dịch vụ AI (LLM provider)
- `CSDL` — cơ sở dữ liệu (Supabase: map_ai_conversations, map_ai_messages)

## Luồng chính cần thể hiện
1. NguoiDung gửi yêu cầu tạo hội thoại mới với `title`.
2. AppServer validate `title` không rỗng.
3. AppServer lưu `map_ai_conversations` vào CSDL, trả `conversation_id`.
4. NguoiDung gửi tin nhắn (`content`, `attachments` tùy chọn) với `conversation_id`.
5. AppServer validate:
   - `content` không rỗng.
   - `attachments` đúng dạng mảng JSON (nếu có).
   - `conversation_id` thuộc về NguoiDung (RLS).
6. Nếu validate thất bại: AppServer trả lỗi.
7. Nếu thành công: AppServer lưu tin nhắn `role = user` vào CSDL.
8. AppServer gọi DichVuAI với nội dung hội thoại.
9. DichVuAI trả phản hồi.
10. Nếu DichVuAI thất bại: AppServer xử lý lỗi và trả thông báo lỗi cho NguoiDung.
11. Nếu thành công: AppServer lưu tin nhắn `role = assistant` vào CSDL.
12. Trigger tự động cập nhật `updated_at` của conversation.
13. AppServer trả tin nhắn phản hồi cho NguoiDung.
14. NguoiDung gửi yêu cầu xem lịch sử hội thoại.
15. AppServer truy vấn `map_ai_messages` theo `conversation_id` (RLS kiểm tra chủ sở hữu).
16. AppServer trả danh sách tin nhắn theo thứ tự thời gian.

## Ràng buộc nghiệp vụ cần thể hiện
- RLS: chỉ chủ sở hữu xem/ghi dữ liệu hội thoại của mình.
- `title` của conversation và `content` của message không được rỗng.
- `role` chỉ nhận `user` hoặc `assistant`.
- `attachments` là mảng JSON, mặc định `[]`.

## Yêu cầu đầu ra
- Xuất duy nhất 1 khối Mermaid dùng `sequenceDiagram`.
- Dùng `alt` / `else` cho nhánh validate thất bại và DichVuAI thất bại.
- Dùng `Note` để chú thích RLS và trigger nếu cần.
- Nhãn thông điệp ngắn gọn bằng tiếng Việt.
- Không thêm giải thích ngoài khối Mermaid.

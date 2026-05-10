# Prompt tạo Sequence Diagram - Kết bạn & Thông báo người dùng

Bạn là chuyên gia phân tích hệ thống. Hãy tạo **Sequence Diagram** cho module **kết bạn và thông báo người dùng**.

## Mục tiêu
Mô tả đầy đủ trình tự tương tác giữa các thành phần khi:
- Người dùng gửi lời mời kết bạn.
- Người nhận chấp nhận, từ chối hoặc chặn.
- Trạng thái quan hệ chuyển đổi (`pending → accepted | declined | blocked`).
- Hệ thống tạo thông báo và người dùng đánh dấu đã đọc.

## Các actor/participant
- `NguoiGui` — người gửi lời mời kết bạn
- `NguoiNhan` — người nhận lời mời
- `AppServer` — hệ thống ứng dụng (Next.js API)
- `CSDL` — cơ sở dữ liệu (Supabase: user_friendships, user_notifications)

## Luồng chính cần thể hiện
1. NguoiGui gửi yêu cầu kết bạn với `addressee_id`.
2. AppServer kiểm tra: NguoiGui không tự kết bạn với chính mình.
3. AppServer kiểm tra: cặp `(requester_id, addressee_id)` chưa tồn tại.
4. Nếu vi phạm: AppServer trả lỗi cho NguoiGui.
5. Nếu hợp lệ: AppServer lưu quan hệ trạng thái `pending` vào CSDL.
6. AppServer tạo thông báo kết bạn cho NguoiNhan.
7. AppServer trả xác nhận cho NguoiGui.
8. NguoiNhan truy vấn danh sách thông báo — AppServer trả danh sách.
9. NguoiNhan gửi quyết định (accepted / declined / blocked).
10. AppServer cập nhật trạng thái quan hệ trong CSDL.
11. AppServer tạo thông báo kết quả cho NguoiGui.
12. NguoiGui mở danh sách thông báo, đánh dấu đã đọc (`is_read = true`, `read_at`).
13. AppServer cập nhật CSDL và trả xác nhận.

## Ràng buộc nghiệp vụ cần thể hiện
- Cấm tự kết bạn với chính mình (`requester_id ≠ addressee_id`).
- Mỗi cặp người dùng chỉ có 1 bản ghi `user_friendships` tại một thời điểm.
- Khi `is_read = true` thì `read_at` phải có giá trị.
- Chỉ NguoiNhan mới có thể thay đổi trạng thái lời mời.

## Yêu cầu đầu ra
- Xuất duy nhất 1 khối Mermaid dùng `sequenceDiagram`.
- Dùng `alt` / `else` cho nhánh kiểm tra hợp lệ và quyết định của NguoiNhan.
- Dùng `Note` để chú thích trạng thái quan hệ khi thay đổi.
- Nhãn thông điệp ngắn gọn bằng tiếng Việt.
- Không thêm giải thích ngoài khối Mermaid.

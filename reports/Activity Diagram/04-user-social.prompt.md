# Prompt tạo Activity Diagram - Kết bạn & Thông báo người dùng

Bạn là chuyên gia phân tích hệ thống. Hãy tạo **Activity Diagram** cho module **kết bạn và thông báo**.

## Mục tiêu
Mô tả đầy đủ luồng:
- Người dùng gửi lời mời kết bạn.
- Hệ thống kiểm tra hợp lệ (không tự kết bạn, không trùng cặp).
- Người nhận chấp nhận hoặc từ chối.
- Trạng thái quan hệ chuyển `pending -> accepted | declined | blocked`.
- Hệ thống tạo và cập nhật thông báo (`is_read`, `read_at`).
- Người dùng mở danh sách thông báo và đánh dấu đã đọc.

## Thành phần tham gia
- Người gửi lời mời
- Người nhận lời mời
- Hệ thống ứng dụng
- CSDL (user_friendships, user_notifications)

## Ràng buộc nghiệp vụ cần thể hiện
- Cấm tự kết bạn với chính mình.
- Mỗi cặp người dùng chỉ có 1 quan hệ hữu nghị tại một thời điểm logic.
- `is_read = true` thì `read_at` phải có giá trị.

## Yêu cầu đầu ra
- Xuất duy nhất 1 khối Mermaid dùng `flowchart TD`.
- Có quyết định chấp nhận/từ chối/chặn.
- Có bước phát sinh thông báo và cập nhật trạng thái đọc.
- Có điểm bắt đầu và kết thúc.
- Không thêm giải thích ngoài khối Mermaid.

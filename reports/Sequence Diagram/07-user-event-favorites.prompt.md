# Prompt tạo Sequence Diagram - Yêu thích sự kiện

Bạn là chuyên gia phân tích hệ thống. Hãy tạo **Sequence Diagram** cho module **lưu sự kiện/địa điểm yêu thích**.

## Mục tiêu
Mô tả đầy đủ trình tự tương tác giữa các thành phần khi:
- Người dùng đã xác thực thêm một sự kiện/địa điểm vào danh sách yêu thích.
- Hệ thống kiểm tra trùng lặp trước khi lưu.
- Người dùng bỏ yêu thích.
- Cascade xóa khi event_record bị xóa.

## Các actor/participant
- `NguoiDung` — người dùng đã xác thực
- `AppServer` — hệ thống ứng dụng (Next.js API)
- `CSDL` — cơ sở dữ liệu (Supabase: user_event_favorites, event_records)

## Luồng chính cần thể hiện
1. NguoiDung gửi yêu cầu xem danh sách sự kiện/địa điểm.
2. AppServer truy vấn CSDL lấy danh sách `event_records` đã duyệt.
3. CSDL trả danh sách — AppServer hiển thị cho NguoiDung.
4. NguoiDung chọn thêm yêu thích một `event_record_id`.
5. AppServer kiểm tra cặp `(user_id, event_record_id)` đã tồn tại trong `user_event_favorites` chưa.
6. Nếu đã tồn tại: AppServer trả phản hồi "đã có trong danh sách yêu thích".
7. Nếu chưa tồn tại: AppServer lưu bản ghi favorite vào CSDL.
8. AppServer trả xác nhận thêm thành công cho NguoiDung.
9. NguoiDung gửi yêu cầu xem danh sách yêu thích của mình.
10. AppServer truy vấn `user_event_favorites` theo `user_id` (RLS).
11. CSDL trả danh sách — AppServer trả cho NguoiDung.
12. NguoiDung gửi yêu cầu bỏ yêu thích (`event_record_id`).
13. AppServer xóa bản ghi `(user_id, event_record_id)` khỏi CSDL.
14. AppServer trả xác nhận xóa thành công.

## Ràng buộc nghiệp vụ cần thể hiện
- Unique constraint `(user_id, event_record_id)` — không được thêm trùng.
- Chỉ chủ sở hữu được thêm/xóa favorite của mình (RLS).
- Khi `event_record` bị xóa, các `user_event_favorites` liên quan tự xóa theo cascade.

## Yêu cầu đầu ra
- Xuất duy nhất 1 khối Mermaid dùng `sequenceDiagram`.
- Dùng `alt` / `else` cho nhánh kiểm tra trùng favorite.
- Dùng `Note` để chú thích cascade delete và RLS nếu cần.
- Nhãn thông điệp ngắn gọn bằng tiếng Việt.
- Không thêm giải thích ngoài khối Mermaid.

# Prompt tạo Sequence Diagram - Tuyến đường cá nhân

Bạn là chuyên gia phân tích hệ thống. Hãy tạo **Sequence Diagram** cho module **lập và chia sẻ tuyến đường du lịch cá nhân**.

## Mục tiêu
Mô tả đầy đủ trình tự tương tác giữa các thành phần khi:
- Người dùng tạo tuyến đường mới.
- Người dùng thêm/sửa/xóa điểm dừng.
- Người dùng cập nhật quyền riêng tư của tuyến đường.
- Người xem truy cập tuyến đường và hệ thống kiểm tra quyền theo `visibility`.

## Các actor/participant
- `ChuRoute` — chủ tuyến đường (người tạo)
- `NguoiXem` — người dùng khác muốn xem tuyến đường
- `AppServer` — hệ thống ứng dụng (Next.js API)
- `CSDL` — cơ sở dữ liệu (Supabase: user_routes, user_route_stops)

## Luồng chính cần thể hiện
1. ChuRoute gửi yêu cầu tạo route (`title`, `start_date`, `visibility`, `origin`).
2. AppServer validate dữ liệu bắt buộc.
3. Nếu validate thất bại: AppServer trả lỗi.
4. Nếu thành công: AppServer lưu route vào CSDL, trả xác nhận kèm `route_id`.
5. ChuRoute gửi yêu cầu thêm điểm dừng (`stop_kind`, tên, tọa độ, `position`).
6. AppServer kiểm tra `(route_id, position)` chưa trùng.
7. AppServer lưu điểm dừng, cập nhật `stop_count` của route.
8. AppServer trả xác nhận cho ChuRoute.
9. ChuRoute gửi yêu cầu cập nhật `visibility` (public/friends/private).
10. AppServer cập nhật CSDL và trả xác nhận.
11. NguoiXem gửi yêu cầu xem route.
12. AppServer truy vấn route và kiểm tra quyền truy cập:
    - `public`: cho phép tất cả.
    - `friends`: kiểm tra quan hệ bạn bè (`user_friendships`) với ChuRoute.
    - `private`: chỉ ChuRoute được xem.
13. Nếu không đủ quyền: AppServer trả lỗi 403.
14. Nếu đủ quyền: AppServer trả dữ liệu route và danh sách điểm dừng.

## Ràng buộc nghiệp vụ cần thể hiện
- `(route_id, position)` phải là duy nhất.
- `stop_kind` chỉ nhận `origin` hoặc `record`.
- Visibility `friends` yêu cầu kiểm tra bảng `user_friendships` với status `accepted`.
- `stop_count` được đồng bộ tự động sau mỗi thêm/xóa điểm dừng.

## Yêu cầu đầu ra
- Xuất duy nhất 1 khối Mermaid dùng `sequenceDiagram`.
- Dùng `alt` / `else` cho nhánh validate, kiểm tra quyền, kiểm tra trùng position.
- Dùng `Note` để chú thích logic visibility nếu cần.
- Nhãn thông điệp ngắn gọn bằng tiếng Việt.
- Không thêm giải thích ngoài khối Mermaid.

# Prompt tạo Activity Diagram - Tuyến đường cá nhân

Bạn là chuyên gia phân tích hệ thống. Hãy tạo **Activity Diagram** cho module **lập và chia sẻ tuyến đường du lịch cá nhân**.

## Mục tiêu
Mô tả đầy đủ luồng:
- Người dùng tạo route mới (title, start_date, visibility, origin).
- Hệ thống validate thông tin bắt buộc.
- Người dùng thêm/sửa/xóa điểm dừng theo `position`.
- Hệ thống đồng bộ `stop_count` tự động.
- Người dùng chọn quyền riêng tư `public/friends/private`.
- Người xem truy cập route, hệ thống kiểm tra quyền bằng visibility và quan hệ bạn bè.

## Thành phần tham gia
- Chủ tuyến đường
- Người xem tuyến đường
- Hệ thống ứng dụng
- CSDL (user_routes, user_route_stops)

## Ràng buộc nghiệp vụ cần thể hiện
- `(route_id, position)` là duy nhất.
- `stop_kind` gồm `origin` hoặc `record`.
- Visibility `friends` chỉ cho bạn bè truy cập.
- Route có thể chứa nhiều điểm dừng, sắp xếp theo position.

## Yêu cầu đầu ra
- Xuất duy nhất 1 khối Mermaid dùng `flowchart TD`.
- Có nhánh kiểm tra quyền truy cập route.
- Có các quyết định validate dữ liệu và xử lý lỗi.
- Có start/end rõ ràng.
- Không thêm giải thích ngoài khối Mermaid.

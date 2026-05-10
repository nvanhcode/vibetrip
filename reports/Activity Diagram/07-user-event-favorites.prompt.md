# Prompt tạo Activity Diagram - Yêu thích sự kiện

Bạn là chuyên gia phân tích hệ thống. Hãy tạo **Activity Diagram** cho module **lưu sự kiện/địa điểm yêu thích**.

## Mục tiêu
Mô tả đầy đủ luồng:
- Người dùng đăng nhập và mở danh sách sự kiện/địa điểm.
- Người dùng bấm yêu thích một event_record.
- Hệ thống kiểm tra đã tồn tại cặp `(user_id, event_record_id)` chưa.
- Nếu chưa có: tạo bản ghi favorite.
- Nếu đã có: báo đã yêu thích hoặc bỏ qua.
- Người dùng bỏ yêu thích.
- Hệ thống xóa bản ghi favorite tương ứng.
- Khi event bị xóa, favorite liên quan tự xóa theo cascade.

## Thành phần tham gia
- Người dùng đã xác thực
- Hệ thống ứng dụng
- CSDL (user_event_favorites, event_records)

## Ràng buộc nghiệp vụ cần thể hiện
- Unique `(user_id, event_record_id)`.
- Chỉ chủ sở hữu được thêm/xóa favorite của mình.
- Người dùng đã xác thực có thể xem danh sách favorite (public feature trong nhóm authenticated).

## Yêu cầu đầu ra
- Xuất duy nhất 1 khối Mermaid dùng `flowchart TD`.
- Có nhánh quyết định tồn tại/không tồn tại favorite.
- Có luồng thêm và xóa favorite.
- Có start/end rõ ràng.
- Không thêm giải thích ngoài khối Mermaid.

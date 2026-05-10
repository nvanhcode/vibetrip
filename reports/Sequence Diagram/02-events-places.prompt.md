# Prompt tạo Sequence Diagram - Sự kiện & Địa điểm

Bạn là chuyên gia phân tích hệ thống. Hãy tạo **Sequence Diagram** cho module **quản lý sự kiện/địa điểm và quy trình duyệt**.

## Mục tiêu
Mô tả đầy đủ trình tự tương tác giữa các thành phần khi:
- Người tạo nội dung nhập và gửi thông tin sự kiện/địa điểm.
- Hệ thống validate và lưu bản ghi ở trạng thái chờ duyệt.
- Reviewer duyệt hoặc từ chối.
- Người dùng cuối tra cứu danh sách sự kiện/địa điểm đã duyệt.

## Các actor/participant
- `NguoiTao` — người tạo nội dung (Content Creator)
- `Reviewer` — Admin hoặc Reviewer
- `NguoiDung` — người dùng cuối xem danh sách
- `AppServer` — hệ thống ứng dụng (Next.js API)
- `CSDL` — cơ sở dữ liệu (Supabase: event_records, event_categories, event_organizers, event_record_categories, event_record_organizers, event_record_schedules, event_images)

## Luồng chính cần thể hiện
1. NguoiTao gửi dữ liệu tạo event_record (`record_kind`, tên, mô tả, thông tin liên hệ, lịch, ảnh).
2. AppServer validate dữ liệu (record_kind hợp lệ, thông tin bắt buộc).
3. Nếu validate thất bại: AppServer trả lỗi cho NguoiTao.
4. Nếu validate thành công: AppServer lưu bản ghi `is_approved = false` vào CSDL.
5. AppServer lưu danh mục (`event_record_categories`) và ban tổ chức (`event_record_organizers`).
6. AppServer trả xác nhận cho NguoiTao.
7. Reviewer truy vấn danh sách bản ghi chờ duyệt.
8. CSDL trả kết quả cho Reviewer.
9. Reviewer gửi quyết định duyệt hoặc từ chối.
10. AppServer xử lý quyết định:
    - Nếu `approved`: cập nhật `is_approved = true`, ghi `reviewed_by`, `reviewed_at`.
    - Nếu `rejected`: lưu `rejection_reason`, giữ `is_approved = false`.
11. NguoiDung truy vấn danh sách — AppServer chỉ trả các bản ghi `is_approved = true`.

## Ràng buộc nghiệp vụ cần thể hiện
- `record_kind` chỉ nhận giá trị `event` hoặc `place`.
- Chỉ bản ghi `is_approved = true` mới hiển thị cho người dùng cuối.
- Ghi nhận đầy đủ `reviewed_by` và `reviewed_at` khi có quyết định.

## Yêu cầu đầu ra
- Xuất duy nhất 1 khối Mermaid dùng `sequenceDiagram`.
- Dùng `alt` / `else` cho nhánh validate lỗi và duyệt/từ chối.
- Dùng `Note` để chú thích trạng thái `is_approved` nếu cần.
- Nhãn thông điệp ngắn gọn bằng tiếng Việt.
- Không thêm giải thích ngoài khối Mermaid.

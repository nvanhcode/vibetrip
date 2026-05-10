# Prompt tạo Activity Diagram - Sự kiện & Địa điểm

Bạn là chuyên gia phân tích hệ thống. Hãy tạo **Activity Diagram** cho module **quản lý sự kiện/địa điểm và quy trình duyệt**.

## Mục tiêu
Mô tả đầy đủ luồng:
- Người tạo nội dung nhập thông tin sự kiện/địa điểm.
- Hệ thống validate dữ liệu (record_kind, thông tin liên hệ, lịch, ảnh...).
- Hệ thống lưu bản ghi ở trạng thái chờ duyệt.
- Reviewer duyệt hoặc từ chối.
- Nếu duyệt: bản ghi hiển thị công khai.
- Nếu từ chối: lưu `rejection_reason` và trả kết quả cho người tạo.
- Gắn danh mục và ban tổ chức qua bảng liên kết.

## Thành phần tham gia
- Người tạo nội dung
- Reviewer/Admin
- Hệ thống ứng dụng
- CSDL (event_records, event_categories, event_organizers, event_record_categories, event_record_organizers)

## Ràng buộc nghiệp vụ cần thể hiện
- `record_kind` chỉ gồm `event` hoặc `place`.
- Luồng có 2 nhánh chính: approved/rejected.
- Chỉ bản ghi `is_approved = true` mới hiển thị cho người dùng cuối.
- Ghi nhận `reviewed_by`, `reviewed_at` khi duyệt.

## Yêu cầu đầu ra
- Xuất duy nhất 1 khối Mermaid dùng `flowchart TD`.
- Có start/end, có quyết định duyệt.
- Có các bước validate, lưu dữ liệu, cập nhật trạng thái, thông báo kết quả.
- Tên node ngắn gọn bằng tiếng Việt.
- Không thêm giải thích ngoài khối Mermaid.

# Prompt tạo Activity Diagram - RBAC & Quản lý người dùng

Bạn là chuyên gia phân tích hệ thống. Hãy tạo **Activity Diagram** cho module **RBAC & quản lý người dùng theo tỉnh/xã**.

## Mục tiêu
Mô tả đầy đủ luồng:
- Người dùng gửi yêu cầu cấp quyền.
- Admin/Reviewer xem xét yêu cầu.
- Hệ thống duyệt hoặc từ chối.
- Hệ thống cập nhật `user_roles`, `province_managers`, `ward_admins` theo vai trò được duyệt.
- Người dùng tra cứu quyền hiện tại.

## Thành phần tham gia
- Người dùng (AuthUser)
- Admin/Reviewer
- Hệ thống ứng dụng
- CSDL (access_requests, user_roles, province_managers, ward_admins)

## Ràng buộc nghiệp vụ cần thể hiện
- Trạng thái yêu cầu: `pending -> approved | rejected`.
- Nếu `approved`: tạo/cập nhật vai trò và phạm vi quản lý (tỉnh/xã) tương ứng.
- Nếu `rejected`: lưu lý do từ chối.
- Người dùng chỉ thấy kết quả cuối cùng của yêu cầu.

## Yêu cầu đầu ra
- Xuất duy nhất 1 khối Mermaid dùng `flowchart TD`.
- Có nhánh quyết định rõ ràng cho bước duyệt/từ chối.
- Có điểm bắt đầu và kết thúc.
- Tên node ngắn gọn bằng tiếng Việt.
- Không thêm giải thích ngoài khối Mermaid.

# Prompt tạo Sequence Diagram - RBAC & Quản lý người dùng

Bạn là chuyên gia phân tích hệ thống. Hãy tạo **Sequence Diagram** cho module **RBAC & quản lý người dùng theo tỉnh/xã**.

## Mục tiêu
Mô tả đầy đủ trình tự tương tác giữa các thành phần khi:
- Người dùng gửi yêu cầu cấp quyền (`access_requests`).
- Admin/Reviewer xem xét và duyệt hoặc từ chối yêu cầu.
- Hệ thống cập nhật `user_roles`, `province_managers`, `ward_admins` theo vai trò được duyệt.
- Người dùng tra cứu quyền hiện tại của mình.

## Các actor/participant
- `NguoiDung` — người dùng đã xác thực (AuthUser)
- `AdminReviewer` — Admin hoặc Reviewer
- `AppServer` — hệ thống ứng dụng (Next.js API)
- `CSDL` — cơ sở dữ liệu (Supabase: access_requests, user_roles, province_managers, ward_admins)

## Luồng chính cần thể hiện
1. NguoiDung gửi yêu cầu cấp quyền với `requested_role` và phạm vi (tỉnh/xã).
2. AppServer validate và lưu yêu cầu trạng thái `pending` vào CSDL.
3. AppServer trả phản hồi xác nhận cho NguoiDung.
4. AdminReviewer truy vấn danh sách yêu cầu `pending`.
5. CSDL trả kết quả cho AdminReviewer.
6. AdminReviewer duyệt hoặc từ chối yêu cầu.
7. AppServer xử lý quyết định:
   - Nếu `approved`: cập nhật `user_roles`, tạo bản ghi `province_managers` hoặc `ward_admins`.
   - Nếu `rejected`: lưu `rejection_reason`, cập nhật trạng thái `rejected`.
8. AppServer ghi nhận `reviewed_by`, `reviewed_at`.
9. NguoiDung tra cứu quyền hiện tại — AppServer truy vấn CSDL và trả kết quả.

## Ràng buộc nghiệp vụ cần thể hiện
- Trạng thái yêu cầu: `pending → approved | rejected`.
- Chỉ admin/reviewer mới có thể thay đổi trạng thái.
- Khi approved, phạm vi quản lý (tỉnh/xã) phải khớp với `requested_role`.

## Yêu cầu đầu ra
- Xuất duy nhất 1 khối Mermaid dùng `sequenceDiagram`.
- Dùng `alt` / `else` để thể hiện nhánh approved/rejected.
- Dùng `Note` để chú thích trạng thái quan trọng nếu cần.
- Nhãn thông điệp ngắn gọn bằng tiếng Việt.
- Không thêm giải thích ngoài khối Mermaid.

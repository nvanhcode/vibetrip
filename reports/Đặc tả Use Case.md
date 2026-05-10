# DAC TA USE CASE HE THONG VIBE TRIP

## 1. Muc tieu tai lieu

Tai lieu nay dac ta day du cac use case chinh cua he thong Vibe Trip, bao gom:
- Nhom actor va quyen han.
- Pham vi nghiep vu cua tung module.
- Luong xu ly chinh, luong thay the, ngoai le.
- Tien dieu kien, hau dieu kien va rang buoc du lieu.

Tai lieu duoc viet de phuc vu:
- Phan tich nghiep vu.
- Thiet ke he thong va API.
- Kiem thu chuc nang (functional testing/UAT).

## 2. Pham vi he thong

He thong Vibe Trip la nen tang du lich cong dong gom cac module:
- Xac thuc va tai khoan.
- Quan tri phan quyen theo cap hanh chinh (admin, province_manager, ward_admin).
- Quan ly su kien/dia diem va quy trinh kiem duyet.
- Ban do tuong tac (Goong), loc du lieu theo viewport/danh muc/ban kinh.
- Tao va luu lo trinh ca nhan (public/friends/private).
- Dien dan cong dong (dang bai, check-in, like, comment, reply).
- Quan he ban be va ho so nguoi dung.
- Su kien yeu thich.
- Thong bao realtime.
- AI chat tro ly tren ban do dua tren du lieu noi bo.

## 3. Dinh nghia actor

### 3.1 Actor chinh

1. Khach (Guest)
- Chua dang nhap.
- Duoc truy cap man hinh dang nhap/dang ky, chinh sach, quen mat khau.

2. Nguoi dung da xac thuc (Authenticated User)
- Su dung day du tinh nang nguoi dung thong thuong: ban do, forum, events, routes, profile, favorites.

3. Quan tri he thong (Admin)
- Quan tri cao nhat.
- Quan ly yeu cau nang cap quyen, gan/thu hoi quyen cap tinh, ho tro tao request.
- Kiem duyet su kien toan he thong.

4. Quan ly tinh (Province Manager)
- Quan ly trong pham vi tinh duoc gan.
- Kiem duyet su kien trong tinh.
- Quan ly yeu cau ward_admin va gan ward trong tinh.

5. Quan tri xa (Ward Admin)
- Kiem duyet su kien trong xa duoc gan.

### 3.2 Actor ngoai he thong

1. Supabase Auth/DB/Storage/Realtime
- Xac thuc, luu du lieu, bucket anh, su kien realtime thong bao.

2. Goong Maps Services
- Autocomplete, place detail, reverse geocode, directions.

3. OpenAI Service
- Sinh phan hoi AI chat tren bo ngu canh du lieu noi bo.

## 4. Gia dinh va rang buoc chung

- Nguoi dung phai dang nhap de truy cap cac tab chinh.
- Du lieu su kien hien thi cong khai chi gom ban ghi da duoc duyet.
- Event record chua review (reviewed_at is null) moi duoc sua theo quy tac phan quyen.
- Nguoi tao chi duoc xoa ban ghi do minh tao khi:
	- Chua review, hoac
	- Da review nhung bi tu choi (is_approved = false).
- Luu lo trinh yeu cau toi thieu 2 diem (1 origin + it nhat 1 destination).
- Favorite chi ap dung cho event/place da duyet.
- AI chat chi duoc tra loi dua tren du lieu he thong va map context tu client.

## 5. Ma tran quyen muc cao

| Chuc nang | User | Ward Admin | Province Manager | Admin |
|---|---:|---:|---:|---:|
| Dang ky/Dang nhap/Quan ly tai khoan ca nhan | x | x | x | x |
| Gui yeu cau nang cap quyen | x | x | x | x |
| Duyet/tu choi access request province_manager |  |  |  | x |
| Duyet/tu choi access request ward_admin |  |  | x (pham vi tinh) | x |
| Thu hoi gan quyen province_manager |  |  |  | x |
| Thu hoi gan quyen ward_admin |  |  | x (pham vi tinh) | x |
| Tao/sua/xoa event do minh tao (theo rule trang thai) | x | x | x | x |
| Kiem duyet event |  | x (pham vi xa) | x (pham vi tinh) | x |
| Xem event da duyet, loc, xem chi tiet, yeu thich | x | x | x | x |
| Tao bai forum, like/comment/reply | x | x | x | x |
| Quan ly quan he ban be | x | x | x | x |
| Tao/lưu/cap nhat lo trinh ca nhan | x | x | x | x |
| AI chat ban do | x | x | x | x |

## 6. Danh sach use case tong hop

### 6.1 Nhom xac thuc va tai khoan
- UC-AUTH-01 Dang ky tai khoan.
- UC-AUTH-02 Dang nhap.
- UC-AUTH-03 Quen mat khau.
- UC-AUTH-04 Dat lai mat khau.
- UC-ACC-01 Cap nhat ho so ca nhan (ten hien thi, avatar).
- UC-ACC-02 Gui yeu cau nang cap quyen.

### 6.2 Nhom quan tri phan quyen
- UC-RBAC-01 Admin tao access request.
- UC-RBAC-02 Admin duyet request province_manager.
- UC-RBAC-03 Province manager tao request ward_admin.
- UC-RBAC-04 Province manager duyet request ward_admin.
- UC-RBAC-05 Tu choi access request.
- UC-RBAC-06 Thu hoi quyen province_manager.
- UC-RBAC-07 Thu hoi quyen ward_admin.

### 6.3 Nhom su kien/dia diem
- UC-EVENT-01 Xem danh sach su kien/dia diem da duyet.
- UC-EVENT-02 Loc su kien theo danh muc/tinh/xa/kieu hien thi.
- UC-EVENT-03 Xem chi tiet su kien.
- UC-EVENT-04 Tao ban ghi su kien/dia diem.
- UC-EVENT-05 Chinh sua ban ghi su kien/dia diem.
- UC-EVENT-06 Xoa ban ghi su kien/dia diem.
- UC-EVENT-07 Kiem duyet ban ghi su kien/dia diem.
- UC-EVENT-08 Quan ly danh muc va don vi to chuc trong qua trinh tao/sua.
- UC-EVENT-09 Quan ly lich to chuc (slot date/weekday).

### 6.4 Nhom ban do va lo trinh
- UC-MAP-01 Xem marker su kien tren ban do theo viewport.
- UC-MAP-02 Loc marker theo tu khoa, danh muc, ban kinh.
- UC-MAP-03 Chon diem di chuyen (autocomplete/reverse geocode).
- UC-MAP-04 Tao lo trinh chi duong nhieu diem.
- UC-MAP-05 Luu lo trinh moi.
- UC-MAP-06 Cap nhat lo trinh da so huu.
- UC-MAP-07 Xem lo trinh theo muc hien thi (public/friends/private).
- UC-MAP-08 AI chat tren ban do (quan ly hoi thoai + message).

### 6.5 Nhom forum, ho so, xa hoi
- UC-FORUM-01 Tao bai dang forum.
- UC-FORUM-02 Xem feed forum (phan trang vo han).
- UC-FORUM-03 Like/Unlike bai dang.
- UC-FORUM-04 Binh luan/tra loi binh luan.
- UC-FORUM-05 Xoa bai dang cua chinh minh.
- UC-PROFILE-01 Xem ho so nguoi dung.
- UC-PROFILE-02 Ket ban (gui/chap nhan/tu choi/huy/bo ket ban).
- UC-PROFILE-03 Xem bai dang cua mot nguoi dung.
- UC-PROFILE-04 Xem lo trinh va su kien yeu thich tren profile.

### 6.6 Nhom thong bao va yeu thich
- UC-NOTI-01 Nhan thong bao realtime.
- UC-NOTI-02 Danh dau da doc mot thong bao/tat ca.
- UC-NOTI-03 Xoa mot thong bao/tat ca thong bao.
- UC-FAV-01 Them/Bot su kien yeu thich.

## 7. Dac ta chi tiet use case

## 7.1 Xac thuc va tai khoan

### UC-AUTH-01: Dang ky tai khoan
- Actor: Guest.
- Muc tieu: Tao tai khoan moi.
- Tien dieu kien: Chua dang nhap.
- Hau dieu kien thanh cong:
	- Tai khoan duoc tao tren Auth.
	- Luu metadata (full_name, accepted_policies, accepted_policies_at).
	- Co the tao access_request neu nguoi dung chon role nang cap trong dang ky.
- Luong chinh:
	1. Nguoi dung nhap full name, email, mat khau, xac nhan mat khau.
	2. He thong danh gia do manh mat khau.
	3. Nguoi dung xac nhan dong y policy.
	4. He thong tao tai khoan.
	5. He thong hien thong bao thanh cong (co/khong can xac nhan email).
- Ngoai le:
	- Mat khau yeu/khong khop xac nhan.
	- Chua dong y policy.
	- Loi email da ton tai/loi Auth.

### UC-AUTH-02: Dang nhap
- Actor: Guest.
- Muc tieu: Dang nhap de vao he thong.
- Luong chinh:
	1. Nhap email + password.
	2. He thong xac thuc.
	3. Chuyen huong den tab ban do.
- Ngoai le: Sai thong tin dang nhap.

### UC-AUTH-03: Quen mat khau
- Actor: Guest/User.
- Muc tieu: Nhan email reset password.
- Luong chinh:
	1. Chon quen mat khau.
	2. Nhap email.
	3. He thong gui link reset ve trang reset-password.

### UC-AUTH-04: Dat lai mat khau
- Actor: User co token reset hop le.
- Muc tieu: Dat mat khau moi.
- Hau dieu kien: Mat khau duoc cap nhat.

### UC-ACC-01: Cap nhat ho so ca nhan
- Actor: User.
- Muc tieu: Sua ten hien thi va avatar.
- Luong chinh:
	1. User tai anh moi (tuy chon).
	2. He thong upload bucket avatars.
	3. Cap nhat metadata user.
- Ngoai le: Loi upload/lien ket storage.

### UC-ACC-02: Gui yeu cau nang cap quyen
- Actor: User.
- Muc tieu: Gui request len admin/province_manager.
- Luong chinh:
	1. User chon requested_role (province_manager hoac ward_admin).
	2. Neu ward_admin, bat buoc chon province_code.
	3. He thong tao ban ghi access_requests trang thai pending.
- Ngoai le: Thieu thong tin, duplicate request.

## 7.2 Quan tri phan quyen

### UC-RBAC-01: Admin tao access request
- Actor: Admin.
- Muc tieu: Tao request ho cho nguoi dung (co/khong co user_id).
- Hau dieu kien: access_requests duoc tao pending.

### UC-RBAC-02: Admin duyet request province_manager
- Actor: Admin.
- Muc tieu: Duyet request va gan role/assignment.
- Luong chinh:
	1. Admin mo danh sach request pending.
	2. Chon request hop le.
	3. Gan role vao user_roles.
	4. Neu province_manager: gan province_managers cho cac tinh duoc chon.
	5. Cap nhat request -> approved.
- Ngoai le: Request khong hop le/khong tim thay user.

### UC-RBAC-03: Province manager tao request ward_admin
- Actor: Province Manager.
- Rang buoc: Chi tao cho province manager dang quan ly.

### UC-RBAC-04: Province manager duyet request ward_admin
- Actor: Province Manager.
- Muc tieu: Gan quyen ward_admin theo danh sach ward trong tinh.
- Luong chinh:
	1. Xac minh request pending, requested_role=ward_admin, co province_code.
	2. Xac minh actor quan ly province do.
	3. Xac minh tat ca ward_codes thuoc dung province.
	4. Upsert user_roles = ward_admin.
	5. Upsert ward_admins theo ward duoc chon.
	6. Cap nhat request approved.

### UC-RBAC-05: Tu choi access request
- Actor: Admin hoac Province Manager (pham vi hop le).
- Muc tieu: Chuyen request sang rejected, luu notes.

### UC-RBAC-06: Thu hoi quyen province_manager
- Actor: Admin.
- Luong chinh:
	1. Xoa assignment province_managers theo user + province.
	2. Neu user khong con assignment quan tri nao thi xoa user_roles (tru admin).

### UC-RBAC-07: Thu hoi quyen ward_admin
- Actor: Admin/Province Manager (pham vi tinh).
- Luong chinh:
	1. Kiem tra actor co quyen thu hoi ward do.
	2. Xoa ward_admin assignment.
	3. Neu khong con assignment thi xoa role.

## 7.3 Su kien/dia diem

### UC-EVENT-01: Xem danh sach su kien/dia diem da duyet
- Actor: User.
- Muc tieu: Xem records da approve.
- Du lieu hien thi chinh:
	- event_name, event_type, anh dai dien.
	- province/ward.
	- categories.
	- nut xem chi tiet, xem ban do, yeu thich.

### UC-EVENT-02: Loc su kien
- Actor: User.
- Bo loc: category, province, ward, kieu view (grid/list).
- Hau dieu kien: Danh sach ket qua cap nhat theo bo loc.

### UC-EVENT-03: Xem chi tiet su kien
- Actor: User.
- Muc tieu: Xem noi dung day du cua 1 record.

### UC-EVENT-04: Tao ban ghi su kien/dia diem
- Actor: User da dang nhap.
- Tien dieu kien:
	- Co thong tin vi tri Goong hop le.
	- Co it nhat 1 anh va toi da 10 anh.
	- Moi anh <= 8MB.
- Luong chinh:
	1. Nhap thong tin co ban (kind, ten, loai, mo ta, tinh/xa, contact, lich).
	2. Chon category/organizer co san hoac tao moi theo ten.
	3. Upload anh vao bucket events.
	4. Tao event_records (mac dinh cho duyet).
	5. Tao schedules/categories/organizers lien quan.
- Ngoai le:
	- Loi upload -> rollback anh da upload.
	- Du lieu khong hop le (toa do/thoi gian/so luong anh).

### UC-EVENT-05: Chinh sua ban ghi su kien/dia diem
- Actor: Nguoi tao record, hoac role co quyen review trong pham vi.
- Tien dieu kien: Record chua duoc review.
- Luong chinh:
	1. Tai du lieu record hien tai.
	2. Sua thong tin + quan ly anh giu lai/them moi.
	3. Cap nhat record.
	4. Thay toan bo schedules/categories/organizers theo du lieu moi.
	5. Xoa file anh cu khong con su dung.

### UC-EVENT-06: Xoa ban ghi su kien/dia diem
- Actor: Nguoi tao record.
- Dieu kien xoa:
	- reviewed_at is null, hoac
	- reviewed_at khac null va is_approved = false.

### UC-EVENT-07: Kiem duyet ban ghi su kien/dia diem
- Actor: Admin/Province Manager/Ward Admin.
- Tien dieu kien:
	- Record ton tai, chua duoc review.
	- Actor co pham vi duyet hop le (toan he thong/theo tinh/theo xa).
- Luong chinh:
	1. Chon decision approve hoac reject.
	2. Neu reject bat buoc nhap ly do.
	3. He thong cap nhat is_approved, reviewed_by, reviewed_at, rejection_reason.

### UC-EVENT-08: Quan ly category va organizer trong form
- Actor: User co quyen tao/sua record.
- Luong chinh:
	1. Chon id da ton tai.
	2. Nhap ten moi -> he thong insert neu chua co, neu trung unique thi dung ban ghi ton tai.

### UC-EVENT-09: Quan ly lich to chuc
- Actor: User co quyen tao/sua record.
- Quy tac:
	- Moi slot phai co opens_at < closes_at.
	- Slot o che do date hoac weekday.
	- Co the de trong toan bo schedules de bieu thi mo tat ca ngay.

## 7.4 Ban do va lo trinh

### UC-MAP-01: Xem marker su kien tren ban do theo viewport
- Actor: User.
- Luong chinh:
	1. He thong lay viewport hien tai.
	2. Goi API map/event-records voi bounds.
	3. Hien thi marker event/place, clustering theo muc zoom.

### UC-MAP-02: Loc marker theo tu khoa/danh muc/ban kinh
- Actor: User.
- Bo loc:
	- Tu khoa (event_name/event_type/event_description).
	- Category ids.
	- Ban kinh km quanh vi tri hien tai hoac dia chi dieu huong.

### UC-MAP-03: Chon diem di chuyen
- Actor: User.
- Luong chinh:
	1. Tim dia chi qua Goong autocomplete.
	2. Chon ket qua -> lay place detail + toa do.
	3. Co the lay vi tri hien tai va reverse geocode.

### UC-MAP-04: Tao lo trinh chi duong nhieu diem
- Actor: User.
- Tien dieu kien: Co origin + >=1 diem den.
- Luong chinh:
	1. Them diem den tu record tren map.
	2. Chon vi tri chen diem den trong route.
	3. Goi Goong directions tung chang.
	4. Ve polyline mau theo tung chang + marker A,1,2,...
	5. Tong hop route summary.

### UC-MAP-05: Luu lo trinh moi
- Actor: User.
- Rang buoc:
	- title bat buoc.
	- start_date dung dinh dang YYYY-MM-DD.
	- visibility thuoc {public, friends, private}.
	- So diem >=2, diem dau la origin.
- Hau dieu kien:
	- Tao user_routes.
	- Tao user_route_stops theo thu tu.

### UC-MAP-06: Cap nhat lo trinh da so huu
- Actor: Chu so huu lo trinh.
- Luong chinh:
	1. Xac minh route thuoc owner.
	2. Update route.
	3. Xoa toan bo stops cu.
	4. Chen lai danh sach stops moi.

### UC-MAP-07: Xem lo trinh theo muc hien thi
- Actor: User.
- Muc tieu: Xem danh sach routes duoc phep thay theo visibility.
- Ket qua hien thi theo 3 nhom: public, friends, private.

### UC-MAP-08: AI chat tren ban do
- Actor: User.
- Muc tieu: Hoi dap dua tren context su kien + lo trinh ca nhan + viewport.
- Luong chinh:
	1. User mo/tao hoi thoai.
	2. Gui prompt + map context (vi tri hien tai, viewport).
	3. He thong luu user message.
	4. He thong tap hop context DB (event approved + personal routes/stops).
	5. Goi OpenAI voi schema JSON bat buoc (answer + references).
	6. He thong map references thanh attachments hop le tu DB.
	7. Luu assistant message va tra ve UI.
- Ngoai le:
	- Thieu API key OpenAI.
	- Conversation khong thuoc user.
	- Prompt qua ngan hoac payload sai.

## 7.5 Forum, profile, quan he xa hoi

### UC-FORUM-01: Tao bai dang forum
- Actor: User.
- Du lieu bai dang:
	- Noi dung text (co the rong neu co anh).
	- Danh sach anh upload bucket forum-posts.
	- Check-in place (tuy chon).
	- Event lien ket (tuy chon).
- Rang buoc: Bai dang phai co noi dung hoac it nhat 1 anh.

### UC-FORUM-02: Xem feed forum
- Actor: User.
- Luong chinh:
	1. Tai PAGE_SIZE dau tien.
	2. Infinite scroll tai them theo created_at cursor.
	3. Ho tro focus mo bai qua query post id.

### UC-FORUM-03: Like/Unlike bai dang
- Actor: User.
- Luong chinh:
	1. UI cap nhat optimistic.
	2. Ghi vao forum_post_likes (insert/delete).
	3. Neu loi thi rollback UI.

### UC-FORUM-04: Binh luan/tra loi
- Actor: User.
- Luong chinh:
	1. Nhap noi dung comment.
	2. Co the gan parent_comment_id de reply.
	3. Optimistic update, sau do ghi DB.
	4. Loi thi rollback.

### UC-FORUM-05: Xoa bai dang cua chinh minh
- Actor: Chu bai dang.
- Rang buoc: Chi xoa khi author_id = currentUser.

### UC-PROFILE-01: Xem ho so nguoi dung
- Actor: User.
- Du lieu hien thi:
	- Avatar, ten hien thi.
	- So bai dang, so ban.
	- Danh sach ban chung.
	- Trang thai quan he ban be hien tai.

### UC-PROFILE-02: Ket ban
- Actor: User.
- Luong nghiep vu:
	- Gui loi moi (insert pending).
	- Chap nhan (update accepted).
	- Tu choi (update declined).
	- Huy loi moi (delete pending do minh gui).
	- Huy ket ban (delete accepted).

### UC-PROFILE-03: Xem bai dang cua mot nguoi dung
- Actor: User.
- Luong chinh: Tai bai dang theo author_id + infinite scroll.

### UC-PROFILE-04: Xem lo trinh va su kien yeu thich tren profile
- Actor: User.
- Dieu kien hien thi route phu thuoc rule visibility.

## 7.6 Thong bao va yeu thich

### UC-NOTI-01: Nhan thong bao realtime
- Actor: User.
- Nguon thong bao:
	- event_record_reviewed
	- forum_post_liked
	- forum_post_commented
	- forum_comment_replied
- Luong chinh:
	1. Subscribe channel realtime theo recipient_user_id.
	2. Khi co INSERT thong bao moi -> cap nhat danh sach va toast realtime.

### UC-NOTI-02: Danh dau da doc
- Actor: User.
- Co 2 che do:
	- Mark 1 thong bao.
	- Mark all thong bao chua doc.

### UC-NOTI-03: Xoa thong bao
- Actor: User.
- Co 2 che do:
	- Xoa 1 thong bao.
	- Xoa tat ca thong bao (co xac nhan).

### UC-FAV-01: Them/Bot su kien yeu thich
- Actor: User.
- Luong chinh:
	1. Goi API favorites voi action add/remove.
	2. He thong verify event_record ton tai va da approve.
	3. Add/remove trong user_event_favorites.
- Ngoai le:
	- Event chua duyet -> cam favorite.
	- Add trung -> tra thong bao da yeu thich.

## 8. Quy tac nghiep vu quan trong

1. Kiem duyet su kien theo dia ban
- Admin: toan quoc.
- Province manager: chi tinh duoc gan.
- Ward admin: chi xa duoc gan.

2. Tinh toan quyen xoa role
- Khi thu hoi assignment, neu user khong con assignment nao thi he thong co the xoa role khong phai admin.

3. RLS va pham vi doc/ghi
- Du lieu nhay cam duoc gioi han theo user dang nhap va role.
- Event public list chi hien ban ghi approved.

4. Toan ven du lieu route
- Luu route gom 2 buoc ghi (route + stops), neu buoc sau loi se cleanup route.

5. Toan ven du lieu anh su kien
- Neu ghi record loi sau upload, he thong cleanup file vua upload.

## 9. Du lieu vao/ra tieu bieu theo module

1. Event record
- Input chinh: record_kind, goong_place_id, lat/lng, province_code, ward_code, ten/loai/mo ta, anh, lich.
- Output chinh: id, trang thai duyet, metadata review.

2. Route
- Input chinh: title, start_date, visibility, stops[].
- Output chinh: route id, danh sach stop theo thu tu.

3. Forum post
- Input chinh: content, image_urls, checkin, event_record_id.
- Output chinh: post id, like_count/comment_count (suy ra).

4. Notification
- Output chinh: title, body, link_path, is_read, created_at.

## 10. Tieu chi chap nhan tong quat

1. Bao mat va quyen truy cap
- User khong dang nhap khong vao duoc cac tab chinh.
- Moi thao tac quan tri phai duoc chan dung role/pham vi.

2. Dung quy tac nghiep vu
- Event chi hien thi cong khai khi approved.
- Reject event bat buoc co ly do.
- Route khong hop le khong duoc luu/cap nhat.

3. Tinh nhat quan du lieu
- Cac thao tac co rollback/cleanup can thiet khi loi ghi nhieu bang/bucket.

4. Trai nghiem nguoi dung
- Feed/forum/profile co tai them lieu manh (pagination/infinite scroll).
- Thong bao cap nhat realtime.

## 11. Mo rong de xuat (tham khao)

- Bo sung use case bao cao vi pham noi dung forum.
- Bo sung workflow moderation bai dang forum.
- Bo sung use case chia se lo trinh qua lien ket ngoai.
- Bo sung dashboard KPI du lich theo tinh/xa.

---

Tai lieu nay la baseline use case hien tai dua tren chuc nang da co trong ma nguon va cau truc CSDL cua he thong Vibe Trip.

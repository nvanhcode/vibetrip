# DAC TA TEST CASE HE THONG VIBE TRIP

## 1. Muc tieu tai lieu

Tai lieu nay mo ta chi tiet bo test case chuc nang cho he thong Vibe Trip de phuc vu:
- SIT (System Integration Test).
- UAT (User Acceptance Test).
- Regression test cho cac module chinh.

Pham vi test bao gom:
- Xac thuc va tai khoan.
- Phan quyen va access request.
- Su kien/dia diem.
- Ban do, lo trinh va AI chat.
- Forum, profile, quan he ban be.
- Thong bao va su kien yeu thich.

## 2. Nguyen tac thiet ke test case

- Moi test case co ma dinh danh duy nhat.
- Moi test case ghi ro actor, tien dieu kien, du lieu test, cac buoc thuc hien va ket qua mong doi.
- Bo test uu tien kiem thu ca luong thanh cong, luong thay the va luong loi nghiep vu.
- Ket qua mong doi phai kiem chung duoc tren UI, API hoac du lieu luu tru.

## 3. Moi truong va du lieu test de xuat

### 3.1 Moi truong

- Ung dung Vibe Trip tren moi truong staging.
- Supabase Auth, Database, Storage, Realtime hoat dong binh thuong.
- Goong API key hop le.
- OpenAI API key hop le cho module AI chat.

### 3.2 Tai khoan va vai tro test

- Guest: nguoi dung chua dang nhap.
- User A: nguoi dung thong thuong.
- User B: nguoi dung thong thuong khac.
- Admin A: tai khoan admin.
- Province Manager A: duoc gan quan ly tinh `01`.
- Ward Admin A: duoc gan quan ly xa `00001` thuoc tinh `01`.

### 3.3 Du lieu nghiep vu mau

- Province hop le: `01`.
- Ward hop le: `00001`.
- Event approved: ban ghi da duyet, co toa do hop le.
- Event pending: ban ghi chua review.
- Event rejected: ban ghi da review va bi tu choi.
- Route mau: lo trinh co 1 origin va 2 destination.
- Forum post mau: bai dang co noi dung va 1 anh.

## 4. Muc do uu tien

- P1: Chuc nang loi, anh huong truc tiep dang nhap, phan quyen, luu du lieu, duyet du lieu.
- P2: Chuc nang chinh cua nguoi dung da dang nhap.
- P3: Chuc nang bo tro, thong bao, tinh nang nang cao.

## 5. Danh sach test case tong hop

| Ma TC | Nhom chuc nang | Mo ta ngan | Muc uu tien |
|---|---|---|---:|
| TC-AUTH-01 | Xac thuc | Dang ky thanh cong voi thong tin hop le | P1 |
| TC-AUTH-02 | Xac thuc | Dang ky that bai khi chua dong y policy | P1 |
| TC-AUTH-03 | Xac thuc | Dang nhap thanh cong | P1 |
| TC-AUTH-04 | Xac thuc | Dang nhap that bai voi sai mat khau | P1 |
| TC-AUTH-05 | Xac thuc | Gui email quen mat khau | P2 |
| TC-AUTH-06 | Xac thuc | Dat lai mat khau thanh cong | P2 |
| TC-ACC-01 | Tai khoan | Cap nhat ten hien thi va avatar | P2 |
| TC-ACC-02 | Tai khoan | Gui yeu cau nang cap ward admin hop le | P1 |
| TC-ACC-03 | Tai khoan | Chan gui yeu cau nang cap bi trung pending | P1 |
| TC-RBAC-01 | RBAC | Admin duyet request province manager | P1 |
| TC-RBAC-02 | RBAC | Province manager duyet request ward admin dung pham vi | P1 |
| TC-RBAC-03 | RBAC | Province manager khong duoc duyet ward ngoai tinh | P1 |
| TC-RBAC-04 | RBAC | Tu choi access request va luu ghi chu | P1 |
| TC-RBAC-05 | RBAC | Thu hoi quyen ward admin | P1 |
| TC-EVENT-01 | Su kien | Xem danh sach event approved | P1 |
| TC-EVENT-02 | Su kien | Loc event theo category va dia ban | P2 |
| TC-EVENT-03 | Su kien | Xem chi tiet event approved | P2 |
| TC-EVENT-04 | Su kien | Tao event moi thanh cong | P1 |
| TC-EVENT-05 | Su kien | Tao event that bai khi vuot so luong/kich thuoc anh | P1 |
| TC-EVENT-06 | Su kien | Chinh sua event pending cua chinh minh | P1 |
| TC-EVENT-07 | Su kien | Chan chinh sua event da duoc review | P1 |
| TC-EVENT-08 | Su kien | Xoa event rejected cua chinh minh | P1 |
| TC-EVENT-09 | Su kien | Duyet event trong dung pham vi dia ban | P1 |
| TC-EVENT-10 | Su kien | Tu choi event bat buoc co ly do | P1 |
| TC-MAP-01 | Ban do | Tai marker theo viewport | P1 |
| TC-MAP-02 | Ban do | Loc marker theo tu khoa va ban kinh | P2 |
| TC-MAP-03 | Ban do | Chon diem di chuyen bang autocomplete | P2 |
| TC-ROUTE-01 | Lo trinh | Tao route nhieu diem thanh cong | P1 |
| TC-ROUTE-02 | Lo trinh | Chan luu route khi duoi 2 diem | P1 |
| TC-ROUTE-03 | Lo trinh | Cap nhat route thuoc so huu cua minh | P1 |
| TC-ROUTE-04 | Lo trinh | Chan sua route khong thuoc so huu | P1 |
| TC-ROUTE-05 | Lo trinh | Chi hien route theo visibility phu hop | P1 |
| TC-AI-01 | AI chat | Tao hoi thoai va nhan phan hoi co references | P2 |
| TC-AI-02 | AI chat | Chan truy cap conversation khong thuoc user | P1 |
| TC-FORUM-01 | Forum | Tao bai dang co text va anh | P2 |
| TC-FORUM-02 | Forum | Chan tao bai dang rong khong co anh | P1 |
| TC-FORUM-03 | Forum | Like/Unlike bai dang voi rollback khi loi | P2 |
| TC-FORUM-04 | Forum | Binh luan va reply binh luan | P2 |
| TC-FORUM-05 | Forum | Xoa bai dang cua chinh minh | P1 |
| TC-PROFILE-01 | Profile | Xem ho so va bai dang cua nguoi dung khac | P2 |
| TC-PROFILE-02 | Profile | Gui va chap nhan loi moi ket ban | P2 |
| TC-PROFILE-03 | Profile | Huy ket ban | P2 |
| TC-NOTI-01 | Thong bao | Nhan thong bao realtime | P2 |
| TC-NOTI-02 | Thong bao | Danh dau da doc 1 thong bao va tat ca | P2 |
| TC-NOTI-03 | Thong bao | Xoa 1 thong bao va xoa tat ca | P2 |
| TC-FAV-01 | Yeu thich | Them va bo yeu thich event approved | P2 |
| TC-FAV-02 | Yeu thich | Chan yeu thich event chua duyet | P1 |

## 6. Test case chi tiet

### 6.1 Nhom xac thuc va tai khoan

#### TC-AUTH-01: Dang ky thanh cong voi thong tin hop le
- Muc tieu: Xac minh guest co the tao tai khoan moi khi nhap du lieu hop le va dong y policy.
- Actor: Guest.
- Tien dieu kien: Email chua ton tai trong he thong.
- Du lieu test:
	- Full name: `Nguyen Van Test`
	- Email: `test.user+01@example.com`
	- Password: `VibeTrip@123`
- Buoc thuc hien:
	1. Truy cap trang dang ky.
	2. Nhap day du full name, email, password, confirm password.
	3. Tich chon dong y chinh sach.
	4. Nhan nut dang ky.
- Ket qua mong doi:
	- He thong tao tai khoan thanh cong.
	- Hien thong bao dang ky thanh cong.
	- Metadata nguoi dung luu full_name va thong tin accepted_policies.
	- Neu he thong yeu cau xac thuc email, hien huong dan tiep theo ro rang.

#### TC-AUTH-02: Dang ky that bai khi chua dong y policy
- Muc tieu: Dam bao he thong chan dang ky khi nguoi dung chua chap nhan policy.
- Actor: Guest.
- Tien dieu kien: Email chua ton tai.
- Buoc thuc hien:
	1. Mo form dang ky.
	2. Nhap du lieu hop le nhung khong tich dong y policy.
	3. Nhan dang ky.
- Ket qua mong doi:
	- Form khong duoc submit thanh cong.
	- Hien thong bao yeu cau dong y policy.
	- Khong tao tai khoan moi trong Auth.

#### TC-AUTH-03: Dang nhap thanh cong
- Muc tieu: Xac minh nguoi dung dang nhap thanh cong voi thong tin hop le.
- Actor: Guest.
- Tien dieu kien: Tai khoan da duoc tao va dang hoat dong.
- Buoc thuc hien:
	1. Truy cap trang dang nhap.
	2. Nhap email va password hop le.
	3. Nhan dang nhap.
- Ket qua mong doi:
	- Dang nhap thanh cong.
	- Tao session hop le.
	- Dieu huong toi man hinh tab chinh, mac dinh la ban do.

#### TC-AUTH-04: Dang nhap that bai voi sai mat khau
- Muc tieu: Xac minh he thong tu choi dang nhap khi sai thong tin.
- Actor: Guest.
- Buoc thuc hien:
	1. Nhap email hop le.
	2. Nhap password sai.
	3. Nhan dang nhap.
- Ket qua mong doi:
	- Dang nhap that bai.
	- Hien thong bao sai thong tin dang nhap.
	- Khong tao session nguoi dung.

#### TC-AUTH-05: Gui email quen mat khau
- Muc tieu: Xac minh he thong gui email reset password.
- Actor: Guest.
- Tien dieu kien: Email da ton tai.
- Buoc thuc hien:
	1. Chon quen mat khau.
	2. Nhap email hop le.
	3. Gui yeu cau.
- Ket qua mong doi:
	- He thong chap nhan yeu cau.
	- Gui email reset den dung dia chi.
	- Thong bao thanh cong khong tiet lo thong tin nhay cam.

#### TC-AUTH-06: Dat lai mat khau thanh cong
- Muc tieu: Xac minh nguoi dung dat lai mat khau bang token hop le.
- Actor: User co token reset hop le.
- Tien dieu kien: Link reset con han.
- Buoc thuc hien:
	1. Mo link reset-password.
	2. Nhap mat khau moi va xac nhan.
	3. Luu thay doi.
- Ket qua mong doi:
	- Mat khau duoc cap nhat thanh cong.
	- Co the dang nhap bang mat khau moi.
	- Mat khau cu khong con su dung duoc.

#### TC-ACC-01: Cap nhat ten hien thi va avatar
- Muc tieu: Xac minh user cap nhat ho so ca nhan thanh cong.
- Actor: User A.
- Tien dieu kien: Da dang nhap.
- Du lieu test: 1 anh avatar hop le dung luong nho.
- Buoc thuc hien:
	1. Mo trang tai khoan.
	2. Sua ten hien thi.
	3. Tai len anh avatar moi.
	4. Luu thay doi.
- Ket qua mong doi:
	- Anh duoc upload thanh cong len bucket avatar.
	- Metadata user duoc cap nhat ten hien thi va avatar URL moi.
	- UI hien thong tin moi ngay sau khi luu.

#### TC-ACC-02: Gui yeu cau nang cap ward admin hop le
- Muc tieu: Xac minh nguoi dung gui yeu cau nang cap ward admin dung du lieu.
- Actor: User A.
- Tien dieu kien: User chua co request pending cung role.
- Buoc thuc hien:
	1. Mo form yeu cau nang cap quyen.
	2. Chon `ward_admin`.
	3. Chon province code `01`.
	4. Gui yeu cau.
- Ket qua mong doi:
	- Tao access request trang thai `pending`.
	- Request luu requested_role va province_code dung.
	- UI thong bao gui yeu cau thanh cong.

#### TC-ACC-03: Chan gui yeu cau nang cap bi trung pending
- Muc tieu: Dam bao he thong khong tao request trung cho cung user va role khi dang pending.
- Actor: User A.
- Tien dieu kien: Da ton tai 1 access request `pending` cho `ward_admin`.
- Buoc thuc hien:
	1. Mo lai form yeu cau nang cap.
	2. Gui tiep yeu cau cung role va province.
- Ket qua mong doi:
	- He thong tu choi thao tac.
	- Hien thong bao da ton tai request dang cho xu ly.
	- Khong tao them ban ghi pending moi.

### 6.2 Nhom quan tri phan quyen

#### TC-RBAC-01: Admin duyet request province manager
- Muc tieu: Xac minh admin duyet request province manager va gan scope tinh dung.
- Actor: Admin A.
- Tien dieu kien:
	- Co access request `pending` cho role `province_manager`.
	- User duoc yeu cau ton tai trong he thong.
- Buoc thuc hien:
	1. Admin mo danh sach access request pending.
	2. Chon request province manager.
	3. Chon tinh `01` de gan.
	4. Nhan duyet.
- Ket qua mong doi:
	- Request chuyen sang `approved`.
	- User duoc gan role `province_manager`.
	- Phat sinh assignment trong bang province_managers voi tinh `01`.

#### TC-RBAC-02: Province manager duyet request ward admin dung pham vi
- Muc tieu: Xac minh province manager co the duyet ward admin trong tinh minh quan ly.
- Actor: Province Manager A.
- Tien dieu kien:
	- Province Manager A duoc gan tinh `01`.
	- Request pending co requested_role `ward_admin`, province_code `01`.
	- Ward duoc chon thuoc tinh `01`.
- Buoc thuc hien:
	1. Province manager mo request ward admin.
	2. Chon ward `00001`.
	3. Nhan duyet.
- Ket qua mong doi:
	- Request duoc approved.
	- User duoc gan role `ward_admin`.
	- Phat sinh assignment ward_admin dung ward `00001`.

#### TC-RBAC-03: Province manager khong duoc duyet ward ngoai tinh
- Muc tieu: Dam bao kiem soat pham vi dia ly khi duyet ward admin.
- Actor: Province Manager A.
- Tien dieu kien:
	- Province Manager A chi quan ly tinh `01`.
	- Request co province/ward nam ngoai `01`.
- Buoc thuc hien:
	1. Province manager mo request ward admin ngoai tinh.
	2. Thu thuc hien duyet request.
- Ket qua mong doi:
	- He thong tu choi thao tac.
	- Khong cap nhat role hay assignment ward_admin.
	- Hien thong bao khong du quyen hoac sai pham vi tinh.

#### TC-RBAC-04: Tu choi access request va luu ghi chu
- Muc tieu: Xac minh actor co quyen co the tu choi request va luu notes.
- Actor: Admin A hoac Province Manager A.
- Tien dieu kien: Request dang `pending` va actor co quyen xu ly.
- Buoc thuc hien:
	1. Mo chi tiet request.
	2. Nhap ly do/ghi chu tu choi.
	3. Nhan tu choi.
- Ket qua mong doi:
	- Request chuyen sang `rejected`.
	- Truong ghi chu duoc luu day du.
	- Khong phat sinh role/assignment moi.

#### TC-RBAC-05: Thu hoi quyen ward admin
- Muc tieu: Xac minh quyen ward admin duoc thu hoi dung quy tac.
- Actor: Admin A hoac Province Manager A trong dung tinh.
- Tien dieu kien: User dang co assignment ward_admin.
- Buoc thuc hien:
	1. Mo giao dien quan ly phan quyen.
	2. Chon ward assignment can thu hoi.
	3. Xac nhan thu hoi.
- Ket qua mong doi:
	- Assignment ward_admin bi xoa.
	- Neu user khong con assignment ward_admin nao, role duoc xoa theo quy tac.
	- Neu user con assignment khac, he thong giu role phu hop.

### 6.3 Nhom su kien va dia diem

#### TC-EVENT-01: Xem danh sach event approved
- Muc tieu: Xac minh danh sach cong khai chi hien event da duyet.
- Actor: User A.
- Tien dieu kien: Ton tai event approved, pending va rejected.
- Buoc thuc hien:
	1. Mo danh sach su kien.
	2. Quan sat cac ban ghi hien thi.
- Ket qua mong doi:
	- Chi hien event co `is_approved = true`.
	- Event pending/rejected khong xuat hien trong danh sach cong khai.

#### TC-EVENT-02: Loc event theo category va dia ban
- Muc tieu: Xac minh bo loc cap nhat dung danh sach su kien.
- Actor: User A.
- Tien dieu kien: Co nhieu event approved khac category, province, ward.
- Buoc thuc hien:
	1. Mo trang danh sach su kien.
	2. Chon 1 category cu the.
	3. Chon province `01` va ward `00001`.
	4. Ap dung bo loc.
- Ket qua mong doi:
	- Danh sach chi con cac event thoa tat ca dieu kien loc.
	- Tong so ban ghi thay doi dung theo filter.

#### TC-EVENT-03: Xem chi tiet event approved
- Muc tieu: Xac minh man hinh chi tiet hien du thong tin.
- Actor: User A.
- Tien dieu kien: Co 1 event approved hop le.
- Buoc thuc hien:
	1. Chon 1 event tu danh sach.
	2. Mo chi tiet.
- Ket qua mong doi:
	- Hien event name, type, mo ta, hinh anh, dia chi, category, organizer, lich.
	- Nut yeu thich va thao tac lien quan hien thi dung.

#### TC-EVENT-04: Tao event moi thanh cong
- Muc tieu: Xac minh user co the tao event/place moi thanh cong.
- Actor: User A.
- Tien dieu kien:
	- Da dang nhap.
	- Co thong tin Goong place hop le.
	- Co 1 den 10 anh hop le, moi anh <= 8MB.
- Buoc thuc hien:
	1. Mo form tao event.
	2. Nhap day du kind, ten, loai, mo ta, tinh, xa, contact.
	3. Chon category va organizer.
	4. Them lich to chuc hop le.
	5. Upload bo anh hop le.
	6. Luu ban ghi.
- Ket qua mong doi:
	- Tao event record thanh cong trong trang thai cho duyet.
	- Upload anh len bucket `events` thanh cong.
	- Tao du lieu schedules/categories/organizers lien quan day du.

#### TC-EVENT-05: Tao event that bai khi vuot so luong/kich thuoc anh
- Muc tieu: Xac minh validation du lieu anh.
- Actor: User A.
- Tien dieu kien: Da dang nhap.
- Buoc thuc hien:
	1. Mo form tao event.
	2. Upload hon 10 anh hoac chon 1 anh lon hon 8MB.
	3. Thu luu ban ghi.
- Ket qua mong doi:
	- He thong chan luu.
	- Hien thong bao dung quy tac so luong/dung luong anh.
	- Khong tao event record moi.
	- Khong de lai file rac neu upload da duoc thuc hien mot phan.

#### TC-EVENT-06: Chinh sua event pending cua chinh minh
- Muc tieu: Xac minh nguoi tao co the sua event chua duoc review.
- Actor: User A.
- Tien dieu kien: User A la nguoi tao 1 event pending.
- Buoc thuc hien:
	1. Mo event pending cua minh.
	2. Sua mo ta, category, lich va bo anh.
	3. Luu thay doi.
- Ket qua mong doi:
	- Event duoc cap nhat thanh cong.
	- Cac lien ket schedules/categories/organizers duoc thay moi dung.
	- Anh cu khong con su dung duoc xoa khoi storage neu co.

#### TC-EVENT-07: Chan chinh sua event da duoc review
- Muc tieu: Dam bao event da review khong con duoc sua boi owner thong thuong.
- Actor: User A.
- Tien dieu kien: User A la nguoi tao 1 event da review.
- Buoc thuc hien:
	1. Mo event da review.
	2. Thu chinh sua va luu.
- Ket qua mong doi:
	- He thong tu choi cap nhat.
	- Hien thong bao record khong con o trang thai co the chinh sua.
	- Du lieu goc khong thay doi.

#### TC-EVENT-08: Xoa event rejected cua chinh minh
- Muc tieu: Xac minh owner co the xoa event bi tu choi.
- Actor: User A.
- Tien dieu kien: User A co event da review va `is_approved = false`.
- Buoc thuc hien:
	1. Mo event rejected cua minh.
	2. Chon xoa.
	3. Xac nhan thao tac.
- Ket qua mong doi:
	- Event bi xoa thanh cong.
	- Du lieu lien quan duoc cleanup theo quy tac.
	- Ban ghi khong con xuat hien trong danh sach quan ly cua owner.

#### TC-EVENT-09: Duyet event trong dung pham vi dia ban
- Muc tieu: Xac minh actor review duyet event trong dung scope.
- Actor: Admin A, Province Manager A hoac Ward Admin A.
- Tien dieu kien:
	- Event dang pending.
	- Event nam trong pham vi duyet cua actor.
- Buoc thuc hien:
	1. Mo danh sach event cho duyet.
	2. Chon event pending.
	3. Nhan approve.
- Ket qua mong doi:
	- Event duoc cap nhat `is_approved = true`.
	- Truong `reviewed_by`, `reviewed_at` duoc cap nhat.
	- Event bat dau hien thi o danh sach cong khai va marker ban do.

#### TC-EVENT-10: Tu choi event bat buoc co ly do
- Muc tieu: Xac minh quy tac reject event can co rejection reason.
- Actor: Actor co quyen review.
- Tien dieu kien: Event dang pending trong dung pham vi duyet.
- Buoc thuc hien:
	1. Mo event cho duyet.
	2. Chon reject nhung de trong ly do.
	3. Nhan xac nhan.
	4. Nhap ly do hop le va thu lai.
- Ket qua mong doi:
	- O lan 1, he thong chan thao tac va yeu cau nhap ly do.
	- O lan 2, event duoc cap nhat reject thanh cong.
	- Ly do tu choi duoc luu va co the hien lai cho owner.

### 6.4 Nhom ban do, lo trinh va AI chat

#### TC-MAP-01: Tai marker theo viewport
- Muc tieu: Xac minh ban do tai dung marker trong vung hien thi.
- Actor: User A.
- Tien dieu kien: Co nhieu event approved trong va ngoai viewport.
- Buoc thuc hien:
	1. Dang nhap va mo tab ban do.
	2. Dua ban do den 1 viewport cu the.
	3. Cho he thong tai marker.
- Ket qua mong doi:
	- Chi cac marker nam trong viewport duoc tai ve.
	- Marker duoc cluster dung theo muc zoom.
	- So luong ket qua khong vuot gioi han he thong.

#### TC-MAP-02: Loc marker theo tu khoa va ban kinh
- Muc tieu: Xac minh API va UI loc dung theo keyword va radius.
- Actor: User A.
- Tien dieu kien: Co event approved thoa va khong thoa dieu kien tim kiem.
- Buoc thuc hien:
	1. Mo ban do.
	2. Nhap tu khoa tim kiem.
	3. Chon 1 dia diem trung tam.
	4. Dat ban kinh loc, vi du 5 km.
	5. Ap dung bo loc.
- Ket qua mong doi:
	- Chi marker co noi dung va khoang cach phu hop duoc hien thi.
	- Danh sach ket qua va marker dong bo cung bo loc.

#### TC-MAP-03: Chon diem di chuyen bang autocomplete
- Muc tieu: Xac minh chuc nang Goong autocomplete va place detail.
- Actor: User A.
- Buoc thuc hien:
	1. Nhap tu khoa dia diem vao o tim kiem.
	2. Chon 1 goi y trong danh sach.
- Ket qua mong doi:
	- He thong lay duoc thong tin place detail.
	- Toa do duoc cap nhat dung tren ban do.
	- Co the su dung diem vua chon lam origin hoac destination.

#### TC-ROUTE-01: Tao route nhieu diem thanh cong
- Muc tieu: Xac minh user luu lo trinh hop le voi nhieu diem dung.
- Actor: User A.
- Tien dieu kien: Da dang nhap, da chon du origin va it nhat 1 destination.
- Buoc thuc hien:
	1. Mo trinh lap lo trinh.
	2. Them 1 origin va 2 destination.
	3. Nhap title, start_date hop le, visibility = `friends`.
	4. Nhan luu route.
- Ket qua mong doi:
	- Tao route thanh cong.
	- Tao danh sach stops dung thu tu.
	- Route summary va polyline duoc hien thi dung.

#### TC-ROUTE-02: Chan luu route khi duoi 2 diem
- Muc tieu: Dam bao route khong hop le khong duoc luu.
- Actor: User A.
- Tien dieu kien: Da dang nhap.
- Buoc thuc hien:
	1. Tao route chi co 1 diem origin.
	2. Nhap title hop le.
	3. Nhan luu.
- Ket qua mong doi:
	- He thong chan thao tac.
	- Hien thong bao yeu cau co it nhat 2 diem.
	- Khong tao route moi trong CSDL.

#### TC-ROUTE-03: Cap nhat route thuoc so huu cua minh
- Muc tieu: Xac minh chu so huu duoc phep sua route cua minh.
- Actor: User A.
- Tien dieu kien: User A da co route hop le.
- Buoc thuc hien:
	1. Mo route cua minh.
	2. Thay doi ten, ngay bat dau, visibility va thu tu stops.
	3. Luu cap nhat.
- Ket qua mong doi:
	- Route duoc cap nhat thanh cong.
	- Danh sach stop cu duoc thay bang danh sach moi.
	- UI hien noi dung moi ngay sau khi luu.

#### TC-ROUTE-04: Chan sua route khong thuoc so huu
- Muc tieu: Dam bao user khong the sua route cua nguoi khac.
- Actor: User B.
- Tien dieu kien: Route thuoc User A.
- Buoc thuc hien:
	1. User B truy cap route cua User A bang URL hoac thao tac UI.
	2. Thu cap nhat route.
- Ket qua mong doi:
	- He thong tra loi khong du quyen.
	- Khong cap nhat du lieu route hoac stops.

#### TC-ROUTE-05: Chi hien route theo visibility phu hop
- Muc tieu: Xac minh quy tac hien thi route theo `public`, `friends`, `private`.
- Actor: User A va User B.
- Tien dieu kien:
	- User A co 3 route voi 3 muc visibility.
	- User B la ban cua User A.
- Buoc thuc hien:
	1. User B mo profile cua User A.
	2. Quan sat danh sach route hien thi.
	3. Dang nhap bang tai khoan khong la ban va kiem tra lai.
- Ket qua mong doi:
	- Ban be thay route `public` va `friends`, khong thay `private`.
	- Nguoi la chi thay route `public`.
	- Chu so huu thay du ca 3 loai.

#### TC-AI-01: Tao hoi thoai va nhan phan hoi co references
- Muc tieu: Xac minh module AI chat tao hoi thoai va tra ket qua theo schema mong muon.
- Actor: User A.
- Tien dieu kien:
	- Da dang nhap.
	- OPENAI API key hop le.
	- Co du lieu event approved va route ca nhan de lam context.
- Buoc thuc hien:
	1. Mo khung AI chat tren ban do.
	2. Gui 1 prompt co lien quan den cac dia diem trong viewport.
	3. Cho he thong tra loi.
- Ket qua mong doi:
	- Tao duoc conversation neu day la tin nhan dau tien.
	- Luu user message va assistant message.
	- Phan hoi co `answer` va danh sach `references` hop le.
	- UI hien duoc cau tra loi cung cac doi tuong tham chieu.

#### TC-AI-02: Chan truy cap conversation khong thuoc user
- Muc tieu: Dam bao du lieu hoi thoai AI duoc phan tach theo user.
- Actor: User B.
- Tien dieu kien: User A da co 1 conversation AI ton tai.
- Buoc thuc hien:
	1. User B co gang goi API/URL su dung conversation id cua User A.
	2. Gui them 1 message vao conversation do.
- Ket qua mong doi:
	- He thong tu choi yeu cau.
	- Khong them message moi vao conversation cua User A.
	- Tra ve loi khong du quyen hoac khong tim thay conversation hop le.

### 6.5 Nhom forum, profile va quan he xa hoi

#### TC-FORUM-01: Tao bai dang co text va anh
- Muc tieu: Xac minh user tao bai dang forum hop le.
- Actor: User A.
- Tien dieu kien: Da dang nhap.
- Buoc thuc hien:
	1. Mo form tao bai dang forum.
	2. Nhap noi dung text.
	3. Upload 1 anh hop le.
	4. Gui bai dang.
- Ket qua mong doi:
	- Bai dang duoc tao thanh cong.
	- Anh duoc upload len bucket forum-posts.
	- Bai dang moi xuat hien trong feed.

#### TC-FORUM-02: Chan tao bai dang rong khong co anh
- Muc tieu: Dam bao bai dang phai co text hoac anh.
- Actor: User A.
- Buoc thuc hien:
	1. Mo form tao bai dang.
	2. De trong noi dung va khong chon anh.
	3. Gui bai dang.
- Ket qua mong doi:
	- He thong chan thao tac.
	- Hien thong bao yeu cau co noi dung hoac it nhat 1 anh.
	- Khong tao bai dang moi.

#### TC-FORUM-03: Like/Unlike bai dang voi rollback khi loi
- Muc tieu: Xac minh co che optimistic update va rollback khi thao tac like that bai.
- Actor: User A.
- Tien dieu kien: Co 1 bai dang cua User B trong feed.
- Buoc thuc hien:
	1. Nhan like bai dang.
	2. Xac minh UI tang so like ngay.
	3. Gia lap loi luu DB hoac mat ket noi.
	4. Thu unlike khi he thong hoat dong binh thuong.
- Ket qua mong doi:
	- Khi thanh cong, so like va trang thai tim duoc cap nhat dung.
	- Khi loi, UI rollback ve trang thai truoc do.
	- Khong phat sinh du lieu sai lech giua UI va DB.

#### TC-FORUM-04: Binh luan va reply binh luan
- Muc tieu: Xac minh user them comment va reply hop le.
- Actor: User A.
- Tien dieu kien: Co bai dang ton tai.
- Buoc thuc hien:
	1. Mo bai dang.
	2. Nhap 1 comment moi va gui.
	3. Chon 1 comment da co va gui 1 reply.
- Ket qua mong doi:
	- Comment duoc tao thanh cong.
	- Reply duoc luu dung `parent_comment_id`.
	- So luong binh luan cap nhat dung.

#### TC-FORUM-05: Xoa bai dang cua chinh minh
- Muc tieu: Xac minh chi chu bai dang moi duoc xoa bai dang.
- Actor: User A.
- Tien dieu kien: User A da tao 1 bai dang.
- Buoc thuc hien:
	1. Mo bai dang cua minh.
	2. Chon xoa bai dang.
	3. Xac nhan thao tac.
- Ket qua mong doi:
	- Bai dang bi xoa khoi feed.
	- User khac khong con truy cap duoc bai dang do.

#### TC-PROFILE-01: Xem ho so va bai dang cua nguoi dung khac
- Muc tieu: Xac minh man hinh profile hien thi du thong tin tong quan.
- Actor: User A.
- Tien dieu kien: User B co avatar, bai dang va ban be.
- Buoc thuc hien:
	1. Mo profile User B.
	2. Kiem tra thong tin tong quan va danh sach bai dang.
- Ket qua mong doi:
	- Hien avatar, ten hien thi, so bai dang, so ban.
	- Hien trang thai quan he giua User A va User B.
	- Bai dang duoc tai theo author_id dung.

#### TC-PROFILE-02: Gui va chap nhan loi moi ket ban
- Muc tieu: Xac minh luong ket ban day du tu gui den chap nhan.
- Actor: User A va User B.
- Tien dieu kien: Hai user chua co quan he ban be.
- Buoc thuc hien:
	1. User A gui loi moi ket ban den User B.
	2. Dang nhap User B.
	3. User B chap nhan loi moi.
- Ket qua mong doi:
	- Ban ghi friendship tao trang thai `pending`, sau do chuyen `accepted`.
	- Profile hai ben cap nhat trang thai ban be dung.
	- Route `friends` co the hien thi theo quy tac.

#### TC-PROFILE-03: Huy ket ban
- Muc tieu: Xac minh user co the huy quan he ban be da duoc chap nhan.
- Actor: User A.
- Tien dieu kien: User A va User B da la ban.
- Buoc thuc hien:
	1. User A mo profile User B.
	2. Chon huy ket ban.
	3. Xac nhan thao tac.
- Ket qua mong doi:
	- Quan he accepted bi xoa.
	- Hai ben tro ve trang thai chua ket ban.
	- Route `friends` khong con hien voi doi tuong khong phai ban.

### 6.6 Nhom thong bao va yeu thich

#### TC-NOTI-01: Nhan thong bao realtime
- Muc tieu: Xac minh he thong day thong bao moi qua realtime.
- Actor: User A.
- Tien dieu kien: User A dang online va subscribe kenh thong bao.
- Buoc thuc hien:
	1. Phat sinh hanh dong tao thong bao cho User A, vi du bai dang duoc like.
	2. Quan sat menu thong bao cua User A.
- Ket qua mong doi:
	- Thong bao moi xuat hien gan nhu ngay lap tuc.
	- Toast/thong bao UI hien noi dung dung.
	- So luong thong bao chua doc cap nhat dung.

#### TC-NOTI-02: Danh dau da doc 1 thong bao va tat ca
- Muc tieu: Xac minh user co the mark read theo tung muc va hang loat.
- Actor: User A.
- Tien dieu kien: User A co it nhat 2 thong bao chua doc.
- Buoc thuc hien:
	1. Chon danh dau da doc 1 thong bao.
	2. Kiem tra trang thai.
	3. Chon danh dau da doc tat ca.
- Ket qua mong doi:
	- Thong bao duoc chon co `is_read = true` sau buoc 1.
	- Tat ca thong bao chua doc con lai chuyen sang da doc sau buoc 3.

#### TC-NOTI-03: Xoa 1 thong bao va xoa tat ca
- Muc tieu: Xac minh user co the xoa thong bao o ca 2 che do.
- Actor: User A.
- Tien dieu kien: User A co nhieu thong bao.
- Buoc thuc hien:
	1. Xoa 1 thong bao cu the.
	2. Xac minh danh sach cap nhat.
	3. Chon xoa tat ca thong bao va xac nhan.
- Ket qua mong doi:
	- Thong bao da chon khong con xuat hien sau buoc 1.
	- Sau buoc 3, danh sach thong bao rong.
	- So badge thong bao duoc cap nhat dung.

#### TC-FAV-01: Them va bo yeu thich event approved
- Muc tieu: Xac minh user co the favorite va unfavorite event da duyet.
- Actor: User A.
- Tien dieu kien: Co 1 event approved hop le.
- Buoc thuc hien:
	1. Mo chi tiet event approved.
	2. Nhan them yeu thich.
	3. Mo lai profile/danh sach favorite de kiem tra.
	4. Nhan bo yeu thich.
- Ket qua mong doi:
	- Khi them, tao ban ghi trong user_event_favorites.
	- Event xuat hien trong danh sach yeu thich.
	- Khi bo, ban ghi yeu thich bi xoa va UI cap nhat dung.

#### TC-FAV-02: Chan yeu thich event chua duyet
- Muc tieu: Dam bao quy tac chi cho favorite event approved.
- Actor: User A.
- Tien dieu kien: Co 1 event pending hoac rejected ton tai.
- Buoc thuc hien:
	1. Co gang goi thao tac favorite len event chua duyet.
- Ket qua mong doi:
	- He thong tu choi thao tac.
	- Khong tao ban ghi user_event_favorites.
	- Hien thong bao event chua duoc duyet nen khong the yeu thich.

## 7. Tieu chi dat/khong dat

- Dat: Tat ca buoc trong test case thuc hien duoc va ket qua thuc te khop ket qua mong doi.
- Khong dat: Co it nhat 1 ket qua mong doi khong dat, he thong loi hoac vi pham quy tac nghiep vu.
- Blocked: Khong the thuc hien do thieu moi truong, thieu du lieu test hoac loi ben thu ba.

## 8. De xuat thuc thi kiem thu

- Uu tien chay P1 truoc moi ban build staging.
- Chay day du P1 + P2 truoc UAT.
- Chay lai cac test case lien quan module sau moi thay doi schema, API route hoac logic RLS.
- Doi voi AI chat va realtime, can ghi ro thoi diem test, du lieu context va log quan sat de de doi chieu.

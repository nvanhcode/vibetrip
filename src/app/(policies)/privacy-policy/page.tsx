import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Quyền Riêng Tư | VibeTrip",
  description: "Chính sách quyền riêng tư và cách VibeTrip xử lý dữ liệu người dùng.",
};

export default function PrivacyPolicyPage() {
  return (
    <>
      <h1 className="text-3xl font-black tracking-tight text-foreground">Chính sách quyền riêng tư</h1>
      <p className="mt-3 text-sm text-muted-foreground">
        VibeTrip cam kết minh bạch trong cách thu thập, sử dụng và bảo vệ dữ liệu cá nhân của người dùng.
      </p>

      <section className="mt-6 space-y-4 text-sm leading-6 text-foreground">
        <p>
          1. Dữ liệu thu thập: Chúng tôi có thể thu thập email, tên hiển thị, ảnh đại diện và các dữ liệu cần thiết để cung cấp dịch vụ.
        </p>
        <p>
          2. Mục đích sử dụng: Dữ liệu được dùng để xác thực tài khoản, cá nhân hóa trải nghiệm và cải thiện chất lượng sản phẩm.
        </p>
        <p>
          3. Bảo mật: VibeTrip áp dụng các biện pháp kỹ thuật phù hợp để hạn chế truy cập trái phép và bảo vệ thông tin người dùng.
        </p>
        <p>
          4. Chia sẻ dữ liệu: Chúng tôi không bán dữ liệu cá nhân. Dữ liệu chỉ được chia sẻ với nhà cung cấp hạ tầng cần thiết để vận hành dịch vụ.
        </p>
        <p>
          5. Quyền của người dùng: Bạn có thể yêu cầu cập nhật thông tin, thay đổi mật khẩu hoặc xóa tài khoản theo quy định hiện hành.
        </p>
        <p>
          6. Cập nhật chính sách: Chính sách này có thể được điều chỉnh theo thời gian. Phiên bản mới sẽ được công bố trên ứng dụng.
        </p>
      </section>
    </>
  );
}

import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Nội Quy Cộng Đồng | VibeTrip",
  description: "Nguyên tắc ứng xử khi tham gia cộng đồng VibeTrip.",
};

export default function CommunityGuidelinesPage() {
  return (
    <>
      <h1 className="text-3xl font-black tracking-tight text-foreground">Nội quy cộng đồng VibeTrip</h1>
      <p className="mt-3 text-sm text-muted-foreground">
        VibeTrip mong muốn tạo một không gian tích cực, an toàn và hữu ích cho tất cả thành viên.
      </p>

      <section className="mt-6 space-y-4 text-sm leading-6 text-foreground">
        <p>
          1. Tôn trọng lẫn nhau: Không sử dụng ngôn từ công kích, kỳ thị, đe dọa hoặc quấy rối dưới mọi hình thức.
        </p>
        <p>
          2. Nội dung trung thực: Chỉ chia sẻ thông tin chuyến đi, địa điểm, trải nghiệm dựa trên dữ liệu thực tế và có trách nhiệm.
        </p>
        <p>
          3. Không spam: Không đăng tải nội dung quảng cáo lặp lại, liên kết lừa đảo, hoặc nội dung gây nhiễu cộng đồng.
        </p>
        <p>
          4. Tôn trọng quyền riêng tư: Không công khai thông tin cá nhân của người khác khi chưa được cho phép.
        </p>
        <p>
          5. Tuân thủ pháp luật: Mọi nội dung đăng tải cần tuân thủ quy định pháp luật hiện hành và quy định của nền tảng.
        </p>
        <p>
          6. Cơ chế xử lý vi phạm: VibeTrip có quyền nhắc nhở, ẩn nội dung, tạm khóa hoặc khóa tài khoản nếu phát hiện vi phạm nghiêm trọng.
        </p>
      </section>
    </>
  );
}

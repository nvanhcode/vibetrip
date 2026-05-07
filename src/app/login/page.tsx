import { redirect } from "next/navigation";
import Image from "next/image";
import { AuthForm } from "@/components/app/auth-form";
import { createClient } from "@/lib/supabase/server";

export default async function LoginPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) {
    redirect("/map");
  }

  return (
    <main className="relative min-h-screen overflow-hidden bg-[radial-gradient(circle_at_top,color-mix(in_oklab,var(--color-accent)_12%,transparent),transparent_45%),linear-gradient(135deg,color-mix(in_oklab,var(--color-background)_95%,var(--color-primary)_5%),var(--color-background))] px-4 py-8 sm:px-6 sm:py-12">
      <div className="mx-auto grid w-full max-w-6xl gap-6 lg:grid-cols-[1.2fr_minmax(0,30rem)] lg:items-stretch">
        <section className="relative hidden min-h-128 overflow-hidden rounded-3xl border border-border/70 bg-card/90 shadow-2xl shadow-black/5 lg:block">
          <Image
            src="/images/banner-menu-left.png"
            alt="VibeTrip Banner"
            fill
            priority
            className="object-cover"
          />
          <div className="absolute inset-0 bg-linear-to-t from-black/65 via-black/25 to-transparent" />
          <div className="absolute inset-x-0 bottom-0 p-8 text-white">
            <p className="text-sm font-semibold uppercase tracking-[0.2em] text-white/85">VibeTrip Community</p>
            <h1 className="mt-2 text-4xl font-black leading-tight">Kết nối chuyến đi an toàn, tích cực và đáng nhớ.</h1>
            <p className="mt-3 max-w-md text-sm text-white/85">
              Tham gia cộng đồng để chia sẻ hành trình, khám phá tuyến đường mới và trao đổi kinh nghiệm du lịch.
            </p>
          </div>
        </section>

        <section className="flex items-center">
          <div className="w-full">
            <div className="mb-5 rounded-2xl border border-border/70 bg-background/80 p-4 backdrop-blur lg:p-5">
              <div className="flex items-center gap-3">
                <Image src="/logo.png" alt="VibeTrip Logo" width={44} height={44} className="shrink-0" />
                <h2 className="text-2xl font-black tracking-tight text-foreground">Đăng nhập VibeTrip</h2>
              </div>
              <p className="mt-1 text-sm text-muted-foreground">
                Đăng nhập, đăng ký hoặc khôi phục mật khẩu để tiếp tục hành trình của bạn.
              </p>
            </div>
            <AuthForm />
          </div>
        </section>
      </div>
    </main>
  );
}

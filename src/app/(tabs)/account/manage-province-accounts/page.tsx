import { redirect } from "next/navigation";
import { AdminAccessRequestForm } from "@/components/app/admin-access-request-form";
import { ProvincePicker } from "@/components/app/province-picker";
import { WardPicker } from "@/components/app/ward-picker";
import { RevokeButton } from "@/components/app/revoke-button";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  adminCreateAccessRequestAction,
  approveProvinceManagerRequestAction,
  rejectAccessRequestAction,
  revokeProvinceManagerAction,
} from "@/app/(tabs)/account/management-actions";
import { resolveUserRole } from "@/lib/rbac";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export default async function ManageProvinceAccountsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const role = await resolveUserRole(supabase, user.id);
  if (role !== "admin") {
    redirect("/map");
  }

  const [{ data: requests }, { data: rawAssignments }, { data: provinces }] = await Promise.all([
    supabase
      .from("access_requests")
      .select("id, user_id, email, full_name, requested_role, province_code, status, notes, created_at")
      .eq("status", "pending")
      .order("created_at", { ascending: true })
      .limit(30),
    supabase
      .from("province_managers")
      .select("user_id, province_code, created_at, provinces(name)")
      .order("created_at", { ascending: false })
      .limit(50),
    supabase
      .from("provinces")
      .select("code, name")
      .order("name", { ascending: true }),
  ]);

  const provinceOptions = (provinces ?? []).map((p) => ({ code: p.code, name: p.name }));
  const provinceNameByCode = new Map(provinceOptions.map((province) => [province.code, province.name]));

  // Batch-fetch user info for all unique user IDs in assignments
  const uniqueUserIds = [...new Set((rawAssignments ?? []).map((a) => a.user_id))];
  const userMap: Record<string, { email: string; fullName: string | null; avatarUrl: string | null }> = {};
  if (uniqueUserIds.length > 0) {
    const adminSupabase = createAdminClient();
    await Promise.all(
      uniqueUserIds.map(async (uid) => {
        const { data } = await adminSupabase.auth.admin.getUserById(uid);
        if (data.user) {
          const meta = data.user.user_metadata ?? {};
          userMap[uid] = {
            email: data.user.email ?? "",
            fullName: typeof meta.full_name === "string" ? meta.full_name : null,
            avatarUrl: typeof meta.avatar_url === "string" ? meta.avatar_url : null,
          };
        }
      })
    );
  }

  const assignments = (rawAssignments ?? []).map((a) => ({
    userId: a.user_id,
    provinceCode: a.province_code,
    provinceName: Array.isArray(a.provinces)
      ? (a.provinces[0] as { name: string } | undefined)?.name ?? a.province_code
      : (a.provinces as { name: string } | null)?.name ?? a.province_code,
    createdAt: a.created_at,
    user: userMap[a.user_id] ?? null,
  }));

  return (
    <div className="space-y-4 px-4 py-4 sm:px-6">
      <Card>
        <CardHeader>
          <CardTitle>Quản lý tài khoản cấp tỉnh/xã</CardTitle>
          <CardDescription>
            Admin duyệt yêu cầu và gán vai trò trực tiếp trên giao diện.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-muted-foreground">
          <p>
            Bạn có thể duyệt yêu cầu lên quản lý tỉnh hoặc quản trị xã, rồi gán danh sách mã tỉnh/xã tương ứng.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Tạo yêu cầu mới (admin)</CardTitle>
          <CardDescription>
            Dùng khi quản trị viên muốn chủ động tạo trước yêu cầu cho người dùng, không cần đợi họ tự gửi.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <AdminAccessRequestForm action={adminCreateAccessRequestAction} provinces={provinceOptions} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Yêu cầu chờ duyệt</CardTitle>
          <CardDescription>Duyệt yêu cầu và gán quyền trực tiếp.</CardDescription>
        </CardHeader>
        <CardContent>
          {requests && requests.length > 0 ? (
            <ul className="space-y-3 text-sm">
              {requests.map((request) => (
                <li key={request.id} className="space-y-3 rounded-xl border border-border p-3">
                  <div>
                    <p className="font-medium text-foreground">{request.full_name}</p>
                    <p className="text-muted-foreground">{request.email}</p>
                    <p className="text-xs text-muted-foreground">
                      Vai trò yêu cầu: {request.requested_role === "province_manager" ? "Quản lý tỉnh" : "Quản trị xã"}
                    </p>
                    {request.requested_role === "ward_admin" && request.province_code && (
                      <p className="text-xs text-muted-foreground">
                        Tỉnh yêu cầu: {provinceNameByCode.get(request.province_code) ?? request.province_code}
                      </p>
                    )}
                    <p className="text-xs text-muted-foreground">User ID: {request.user_id ?? "Chưa liên kết"}</p>
                  </div>

                  <form action={approveProvinceManagerRequestAction} className="grid gap-2 md:grid-cols-2">
                    <input type="hidden" name="request_id" value={request.id} />
                    <input type="hidden" name="requested_role" value={request.requested_role ?? "province_manager"} />
                    <div className="space-y-1.5 md:col-span-1">
                      <label className="text-xs font-medium text-foreground">User ID để gán quyền</label>
                      <Input name="user_id" defaultValue={request.user_id ?? ""} required />
                    </div>

                    {request.requested_role === "ward_admin" ? (
                      <div className="space-y-1.5 md:col-span-2">
                        <label className="text-xs font-medium text-foreground">Chọn xã</label>
                        <WardPicker
                          name="ward_codes"
                          provinces={request.province_code
                            ? provinceOptions.filter((province) => province.code === request.province_code)
                            : provinceOptions}
                        />
                      </div>
                    ) : (
                      <div className="space-y-1.5 md:col-span-2">
                        <label className="text-xs font-medium text-foreground">Chọn tỉnh</label>
                        <ProvincePicker name="province_codes" provinces={provinceOptions} />
                      </div>
                    )}

                    <div className="md:col-span-2 flex items-center gap-2">
                      <Button type="submit">Duyệt và phân quyền</Button>
                    </div>
                  </form>

                  <form action={rejectAccessRequestAction} className="grid gap-2 md:grid-cols-2">
                    <input type="hidden" name="request_id" value={request.id} />
                    <div className="space-y-1.5 md:col-span-1">
                      <label className="text-xs font-medium text-foreground">Lý do từ chối</label>
                      <Input name="notes" placeholder="Thiếu thông tin hồ sơ..." />
                    </div>
                    <div className="md:col-span-1 flex items-end">
                      <Button type="submit" variant="destructive">Từ chối</Button>
                    </div>
                  </form>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground">Không có yêu cầu nào đang chờ duyệt.</p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Phân công quản lý tỉnh hiện có</CardTitle>
          <CardDescription>Danh sách các tài khoản đã được gán tỉnh.</CardDescription>
        </CardHeader>
        <CardContent>
          {assignments.length > 0 ? (
            <ul className="space-y-2 text-sm">
              {assignments.map((a) => (
                <li
                  key={`${a.userId}-${a.provinceCode}`}
                  className="flex items-center gap-3 rounded-lg border border-border px-3 py-2"
                >
                  {a.user?.avatarUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={a.user.avatarUrl}
                      alt={a.user.fullName ?? a.user.email}
                      className="h-9 w-9 shrink-0 rounded-full object-cover"
                    />
                  ) : (
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-semibold uppercase text-muted-foreground">
                      {(a.user?.fullName ?? a.user?.email ?? "?").charAt(0)}
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium text-foreground">
                      {a.user?.fullName ?? a.user?.email ?? a.userId}
                    </p>
                    {a.user?.fullName && (
                      <p className="truncate text-xs text-muted-foreground">{a.user.email}</p>
                    )}
                    <p className="text-xs text-muted-foreground">
                      Tỉnh: <span className="font-medium text-foreground">{a.provinceName}</span>
                      <span className="ml-1 text-muted-foreground/60">({a.provinceCode})</span>
                    </p>
                  </div>
                  <RevokeButton
                    fields={{ user_id: a.userId, province_code: a.provinceCode }}
                    action={revokeProvinceManagerAction}
                    confirmTitle="Bỏ phân quyền quản lý tỉnh"
                    confirmDescription={`Bỏ quyền quản lý tỉnh ${a.provinceName} khỏi tài khoản ${a.user?.fullName ?? a.user?.email ?? a.userId}?`}
                  />
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground">Chưa có phân công nào.</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

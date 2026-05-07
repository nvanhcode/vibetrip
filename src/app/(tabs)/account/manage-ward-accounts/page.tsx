import { redirect } from "next/navigation";
import { AdminAccessRequestForm } from "@/components/app/admin-access-request-form";
import { FormSubmitButton } from "@/components/app/form-submit-button";
import { WardPicker } from "@/components/app/ward-picker";
import { RevokeButton } from "@/components/app/revoke-button";
import type { ProvinceOption, WardOption } from "@/components/app/ward-picker";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  approveWardAdminRequestAction,
  provinceManagerCreateWardRequestAction,
  rejectAccessRequestAction,
  revokeWardAdminAction,
} from "@/app/(tabs)/account/management-actions";
import { resolveUserRole } from "@/lib/rbac";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export default async function ManageWardAccountsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const role = await resolveUserRole(supabase, user.id);
  if (role !== "province_manager") {
    redirect("/map");
  }

  const { data: provinceAssignments } = await supabase
    .from("province_managers")
    .select("province_code")
    .eq("user_id", user.id);

  const managedProvinceCodes = (provinceAssignments ?? []).map((item) => item.province_code);
  const adminSupabase = createAdminClient();

  const [{ data: provinces }, wardsResults, { data: requests }] = await Promise.all([
    supabase
      .from("provinces")
      .select("code, name")
      .in("code", managedProvinceCodes.length > 0 ? managedProvinceCodes : ["__none__"])
      .order("name", { ascending: true }),
    managedProvinceCodes.length > 0
      ? supabase
          .from("wards")
          .select("code, province_code, name")
          .in("province_code", managedProvinceCodes)
          .order("name", { ascending: true })
          : Promise.resolve({ data: [] }),
        managedProvinceCodes.length > 0
          ? adminSupabase
            .from("access_requests")
            .select("id, user_id, email, full_name, requested_role, province_code, status, notes, created_at")
            .eq("status", "pending")
            .eq("requested_role", "ward_admin")
            .in("province_code", managedProvinceCodes)
            .order("created_at", { ascending: true })
              .limit(30)
          : Promise.resolve({ data: [] }),
  ]);

  const provinceOptions: ProvinceOption[] = (provinces ?? []).map((p) => ({ code: p.code, name: p.name }));
  const provinceNameByCode = new Map(provinceOptions.map((province) => [province.code, province.name]));

  const wardsByProvince: Record<string, WardOption[]> = {};
  for (const w of (wardsResults.data ?? []) as WardOption[]) {
    if (!wardsByProvince[w.province_code]) wardsByProvince[w.province_code] = [];
    wardsByProvince[w.province_code].push(w);
  }

  const managedWardCodes = (wardsResults.data ?? []).map((ward) => ward.code);
  const { data: rawWardAssignments } = managedWardCodes.length > 0
    ? await adminSupabase
        .from("ward_admins")
        .select("user_id, ward_code, created_at, wards(name, province_code, provinces(name))")
        .in("ward_code", managedWardCodes)
        .order("created_at", { ascending: false })
        .limit(100)
    : { data: [] };

  // Batch-fetch user info for all unique user IDs in ward assignments
  const uniqueUserIds = [...new Set((rawWardAssignments ?? []).map((a) => a.user_id))];
  const userMap: Record<string, { email: string; fullName: string | null; avatarUrl: string | null }> = {};
  if (uniqueUserIds.length > 0) {
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

  type WardRow = { name: string; province_code: string; provinces: { name: string } | { name: string }[] | null };
  const wardAssignments = (rawWardAssignments ?? []).map((a) => {
    const wardRow = a.wards as WardRow | WardRow[] | null;
    const ward = Array.isArray(wardRow) ? wardRow[0] : wardRow;
    const provincesData = ward?.provinces;
    const province = Array.isArray(provincesData) ? provincesData[0] : provincesData;
    return {
      userId: a.user_id,
      wardCode: a.ward_code,
      wardName: ward?.name ?? a.ward_code,
      provinceCode: ward?.province_code ?? "",
      provinceName: province?.name ?? ward?.province_code ?? "",
      createdAt: a.created_at,
      user: userMap[a.user_id] ?? null,
    };
  });

  return (
    <div className="space-y-4 px-4 py-4 sm:px-6">
      <Card>
        <CardHeader>
          <CardTitle>Quản lý tài khoản xã</CardTitle>
          <CardDescription>
            Quản lý tỉnh phân công tài khoản quản trị xã cho các xã thuộc tỉnh mình phụ trách.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-2 text-sm text-muted-foreground">
          {provinceOptions.length > 0 ? (
            <p>
              Bạn đang quản lý các tỉnh: {provinceOptions.map((province) => `${province.name} (${province.code})`).join(", ")}
            </p>
          ) : (
            <p>Bạn chưa được gán tỉnh nào trong bảng province_managers.</p>
          )}
          <p>
            Bạn có thể tạo yêu cầu mới, duyệt yêu cầu, và gán trực tiếp danh sách mã xã.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Tạo yêu cầu quản trị xã</CardTitle>
          <CardDescription>
            Quản lý tỉnh có thể tự tạo request thay cho người dùng để chủ động quy trình phân công.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <AdminAccessRequestForm
            action={provinceManagerCreateWardRequestAction}
            provinces={provinceOptions}
            forcedRole="ward_admin"
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Yêu cầu quản trị xã chờ duyệt</CardTitle>
          <CardDescription>Duyệt và gán mã xã ngay trên giao diện.</CardDescription>
        </CardHeader>
        <CardContent>
          {requests && requests.length > 0 ? (
            <ul className="space-y-3 text-sm">
              {requests.map((request) => (
                <li key={request.id} className="space-y-3 rounded-xl border border-border p-3">
                  <div>
                    <p className="font-medium text-foreground">{request.full_name}</p>
                    <p className="text-muted-foreground">{request.email}</p>
                    <p className="text-xs text-muted-foreground">User ID: {request.user_id ?? "Chưa liên kết"}</p>
                    {request.province_code && (
                      <p className="text-xs text-muted-foreground">
                        Tỉnh yêu cầu: {provinceNameByCode.get(request.province_code) ?? request.province_code}
                      </p>
                    )}
                  </div>

                  <form action={approveWardAdminRequestAction} className="grid gap-2 md:grid-cols-2">
                    <input type="hidden" name="request_id" value={request.id} />
                    <div className="space-y-1.5 md:col-span-1">
                      <label className="text-xs font-medium text-foreground">User ID để gán quyền</label>
                      <Input name="user_id" defaultValue={request.user_id ?? ""} required />
                    </div>
                    <div className="space-y-1.5 md:col-span-2">
                      <label className="text-xs font-medium text-foreground">Chọn xã</label>
                      <WardPicker
                        name="ward_codes"
                        provinces={request.province_code
                          ? provinceOptions.filter((province) => province.code === request.province_code)
                          : provinceOptions}
                        wardsByProvince={wardsByProvince}
                        required
                      />
                    </div>
                    <div className="md:col-span-2 flex items-center gap-2">
                      <FormSubmitButton idleText="Duyệt và gán xã" pendingText="Đang duyệt..." />
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
            <p className="text-sm text-muted-foreground">Không có yêu cầu quản trị xã nào đang chờ duyệt.</p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Phân công quản trị xã hiện có</CardTitle>
          <CardDescription>Danh sách các tài khoản đã được gán xã.</CardDescription>
        </CardHeader>
        <CardContent>
          {wardAssignments.length > 0 ? (
            <ul className="space-y-2 text-sm">
              {wardAssignments.map((a) => (
                <li key={`${a.userId}-${a.wardCode}`} className="flex items-center gap-3 rounded-lg border border-border px-3 py-2">
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
                      Xã: <span className="font-medium text-foreground">{a.wardName}</span>
                      <span className="ml-1 text-muted-foreground/60">({a.wardCode})</span>
                    </p>
                    {a.provinceName && (
                      <p className="text-xs text-muted-foreground">
                        Tỉnh: <span className="text-foreground">{a.provinceName}</span>
                      </p>
                    )}
                  </div>
                  <RevokeButton
                    fields={{ user_id: a.userId, ward_code: a.wardCode }}
                    action={revokeWardAdminAction}
                    confirmTitle="Bỏ phân quyền quản trị xã"
                    confirmDescription={`Bỏ quyền quản trị xã ${a.wardName} khỏi tài khoản ${a.user?.fullName ?? a.user?.email ?? a.userId}?`}
                  />
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground">Chưa có phân công quản trị xã nào.</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

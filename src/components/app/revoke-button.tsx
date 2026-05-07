"use client";

import * as React from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

interface RevokeButtonProps {
  /** Hidden fields to include in the form submission. */
  fields: Record<string, string>;
  /** Server action to call on confirm. */
  action: (formData: FormData) => Promise<void>;
  /** Title shown in the confirm dialog. */
  confirmTitle?: string;
  /** Description shown in the confirm dialog. */
  confirmDescription?: string;
  /** Optional label for the trigger button. */
  label?: string;
}

export function RevokeButton({
  fields,
  action,
  confirmTitle = "Xác nhận bỏ phân quyền",
  confirmDescription = "Hành động này sẽ xoá phân quyền khỏi tài khoản. Bạn có chắc chắn muốn tiếp tục?",
  label = "Bỏ phân quyền",
}: RevokeButtonProps) {
  const [open, setOpen] = React.useState(false);
  const [pending, setPending] = React.useState(false);
  const formRef = React.useRef<HTMLFormElement>(null);

  async function handleConfirm() {
    if (!formRef.current) return;
    setPending(true);
    try {
      const formData = new FormData(formRef.current);
      await action(formData);
      setOpen(false);
    } finally {
      setPending(false);
    }
  }

  return (
    <>
      {/* Hidden form — values submitted programmatically */}
      <form ref={formRef} style={{ display: "none" }}>
        {Object.entries(fields).map(([name, value]) => (
          <input key={name} type="hidden" name={name} value={value} />
        ))}
      </form>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild>
          <Button type="button" variant="destructive" size="sm">
            {label}
          </Button>
        </DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{confirmTitle}</DialogTitle>
            <DialogDescription>{confirmDescription}</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)} disabled={pending}>
              Huỷ
            </Button>
            <Button variant="destructive" onClick={handleConfirm} disabled={pending}>
              {pending ? "Đang xử lý..." : "Xác nhận bỏ"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

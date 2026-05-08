"use client";

import type { ComponentProps } from "react";
import { useFormStatus } from "react-dom";
import { Button } from "@/components/ui/button";

type FormSubmitButtonProps = {
  idleText: string;
  pendingText: string;
  className?: string;
  variant?: ComponentProps<typeof Button>["variant"];
  size?: ComponentProps<typeof Button>["size"];
};

export function FormSubmitButton({
  idleText,
  pendingText,
  className,
  variant = "default",
  size = "default",
}: FormSubmitButtonProps) {
  const { pending } = useFormStatus();

  return (
    <Button type="submit" disabled={pending} className={className} variant={variant} size={size}>
      {pending ? pendingText : idleText}
    </Button>
  );
}

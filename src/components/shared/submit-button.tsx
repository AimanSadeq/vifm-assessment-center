"use client";

import { useFormStatus } from "react-dom";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { ComponentProps, ReactNode } from "react";

type SubmitButtonProps = Omit<ComponentProps<typeof Button>, "type"> & {
  children: ReactNode;
  pendingLabel?: string;
};

/**
 * Drop-in replacement for <Button type="submit"> that shows a spinner
 * and disables itself while the enclosing <form> is pending via
 * useFormStatus. Works only inside a <form>.
 */
export function SubmitButton({
  children,
  pendingLabel,
  disabled,
  className,
  ...rest
}: SubmitButtonProps) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={disabled || pending} className={className} {...rest}>
      {pending ? (
        <>
          <Loader2 className="h-3 w-3 animate-spin" />
          {pendingLabel ?? children}
        </>
      ) : (
        children
      )}
    </Button>
  );
}

"use client";

import { useFormStatus } from "react-dom";

export function SubmitButton({
  children,
  className,
  disabled = false,
  pendingLabel,
}: Readonly<{
  children?: React.ReactNode;
  className?: string;
  disabled?: boolean;
  pendingLabel: string;
}>) {
  const { pending } = useFormStatus();

  return (
    <button className={className} disabled={disabled || pending} type="submit">
      {pending ? pendingLabel : children}
    </button>
  );
}

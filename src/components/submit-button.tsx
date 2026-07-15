"use client";

import { useFormStatus } from "react-dom";

export function SubmitButton({
  children,
  className,
  disabled = false,
}: Readonly<{
  children: React.ReactNode;
  className?: string;
  disabled?: boolean;
}>) {
  const { pending } = useFormStatus();

  return (
    <button className={className} disabled={disabled || pending} type="submit">
      {pending ? "Building your session…" : children}
    </button>
  );
}

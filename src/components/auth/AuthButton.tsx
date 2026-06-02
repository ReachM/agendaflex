"use client";

import { ButtonHTMLAttributes, ReactNode } from "react";

type Variant = "primary" | "ghost";

type AuthButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant;
  loading?: boolean;
  block?: boolean;
  leftIcon?: ReactNode;
  rightIcon?: ReactNode;
};

export function AuthButton({
  variant = "primary",
  loading = false,
  block = false,
  leftIcon,
  rightIcon,
  disabled,
  children,
  className,
  ...rest
}: AuthButtonProps) {
  const classes = [
    "auth-btn",
    `auth-btn--${variant}`,
    block ? "auth-btn--block" : "",
    className ?? ""
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <button className={classes} disabled={disabled || loading} {...rest}>
      {loading ? (
        <span className="auth-btn__spinner" aria-hidden="true" />
      ) : (
        <>
          {leftIcon}
          {children}
          {rightIcon}
        </>
      )}
    </button>
  );
}

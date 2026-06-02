"use client";

import { Eye, EyeOff } from "lucide-react";
import { forwardRef, InputHTMLAttributes, ReactNode, useState } from "react";

type AuthInputProps = Omit<InputHTMLAttributes<HTMLInputElement>, "type"> & {
  label?: string;
  icon?: ReactNode;
  type?: "text" | "email" | "password" | "tel" | "url";
  error?: string;
  hint?: string;
  rightSlot?: ReactNode;
};

export const AuthInput = forwardRef<HTMLInputElement, AuthInputProps>(function AuthInput(
  { label, icon, type = "text", error, hint, rightSlot, id, className, ...rest },
  ref
) {
  const [show, setShow] = useState(false);
  const isPassword = type === "password";
  const effectiveType = isPassword ? (show ? "text" : "password") : type;
  const inputId = id ?? `auth-input-${rest.name ?? Math.random().toString(36).slice(2, 8)}`;
  const hasToggle = isPassword;

  return (
    <div className={`auth-field${error ? " auth-field--error" : ""}${className ? ` ${className}` : ""}`}>
      {(label || rightSlot) && (
        <div className="auth-field__label-row">
          {label ? (
            <label htmlFor={inputId} className="auth-field__label">
              {label}
            </label>
          ) : (
            <span />
          )}
          {rightSlot}
        </div>
      )}
      <div className="auth-field__control">
        {icon ? <span className="auth-field__icon">{icon}</span> : null}
        <input
          ref={ref}
          id={inputId}
          type={effectiveType}
          className={`auth-field__input${icon ? "" : " auth-field__input--no-icon"}${hasToggle ? " auth-field__input--has-toggle" : ""}`}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? `${inputId}-error` : hint ? `${inputId}-hint` : undefined}
          {...rest}
        />
        {hasToggle ? (
          <button
            type="button"
            className="auth-field__toggle"
            onClick={() => setShow((s) => !s)}
            tabIndex={-1}
            aria-label={show ? "Ocultar senha" : "Mostrar senha"}
          >
            {show ? <EyeOff size={18} /> : <Eye size={18} />}
          </button>
        ) : null}
      </div>
      {error ? (
        <span id={`${inputId}-error`} className="auth-field__error">
          {error}
        </span>
      ) : hint ? (
        <span id={`${inputId}-hint`} className="auth-field__hint">
          {hint}
        </span>
      ) : null}
    </div>
  );
});

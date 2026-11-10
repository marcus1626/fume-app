// Input OTP (design-system/components/input-otp.css, DECIDED 13 Oct): a sign-in code in slots, two groups of three.
// The React side of input-otp.js: one real input (autocomplete="one-time-code") lies invisibly over the slots, so
// typing, pasting and the phone's code autofill work as usual; the slots show its characters and the active slot.
// Digits only. onComplete fires when every slot is filled.
// <InputOTP value={code} onChange={setCode} onComplete={submit} aria-label="Sign-in code" />
import { forwardRef, useState, type InputHTMLAttributes } from "react";
import { cx } from "../cx";

export interface InputOTPProps extends Omit<
  InputHTMLAttributes<HTMLInputElement>,
  "value" | "onChange" | "maxLength" | "size"
> {
  value: string;
  onChange: (value: string) => void;
  /** Every slot filled: the whole code. */
  onComplete?: (value: string) => void;
  /** Slots, in two equal groups (default 6). */
  length?: number;
  invalid?: boolean;
}

export const InputOTP = forwardRef<HTMLInputElement, InputOTPProps>(function InputOTP(
  { value, onChange, onComplete, length = 6, invalid, disabled, className, onFocus, onBlur, ...props },
  ref,
) {
  const [focused, setFocused] = useState(false);
  const active = Math.min(value.length, length - 1);
  const half = Math.ceil(length / 2);
  const slot = (i: number) => (
    <div key={i} className="ui-input-otp-slot" data-active={String(focused && !disabled && i === active)}>
      {value[i] ?? ""}
    </div>
  );
  return (
    <div className={cx("ui-input-otp", className)} data-invalid={invalid ? "true" : undefined}>
      <input
        ref={ref}
        className="ui-input-otp-input"
        inputMode="numeric"
        autoComplete="one-time-code"
        maxLength={length}
        value={value}
        disabled={disabled}
        aria-invalid={invalid || undefined}
        onChange={(e) => {
          const clean = e.target.value.replace(/\D/g, "").slice(0, length);
          onChange(clean);
          if (clean.length === length && clean !== value) onComplete?.(clean);
        }}
        onFocus={(e) => {
          setFocused(true);
          onFocus?.(e);
        }}
        onBlur={(e) => {
          setFocused(false);
          onBlur?.(e);
        }}
        {...props}
      />
      <div className="ui-input-otp-group" aria-hidden="true">
        {Array.from({ length: half }, (_, i) => slot(i))}
      </div>
      <div className="ui-input-otp-separator" aria-hidden="true" />
      <div className="ui-input-otp-group" aria-hidden="true">
        {Array.from({ length: length - half }, (_, i) => slot(half + i))}
      </div>
    </div>
  );
});

"use client";
// ─── components/StaffTextInput.tsx ────────────────────────
// Input ที่ใช้ร่วมกันในฝั่งพนักงาน — มี focus ring จริง (ของเดิมไม่มีเลยทั้งแอป)

import { useState } from "react";

export interface StaffTextInputTheme {
  ink: string;
  inkSoft: string;
  panel: string;
  accent: string;
  border: string;
  fontBody: string;
}

export interface StaffTextInputProps {
  type?: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  autoComplete?: string;
  disabled?: boolean;
  autoFocus?: boolean;
  onKeyDown?: (e: React.KeyboardEvent<HTMLInputElement>) => void;
  theme: StaffTextInputTheme;
  style?: React.CSSProperties;
}

export function StaffTextInput({
  type = "text", value, onChange, placeholder, autoComplete, disabled, autoFocus, onKeyDown, theme, style,
}: StaffTextInputProps) {
  const [focused, setFocused] = useState(false);

  return (
    <input
      type={type}
      value={value}
      autoFocus={autoFocus}
      onChange={(e) => onChange(e.target.value)}
      onKeyDown={onKeyDown}
      placeholder={placeholder}
      autoComplete={autoComplete}
      disabled={disabled}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      style={{
        padding: "14px 16px",
        border: `1.5px solid ${focused ? theme.accent : theme.border}`,
        borderRadius: 8,
        fontSize: 16,
        fontFamily: theme.fontBody,
        background: theme.panel,
        color: theme.ink,
        outline: "none",
        boxShadow: focused ? `0 0 0 3px ${theme.accent}33` : "none",
        transition: "border-color .15s ease, box-shadow .15s ease",
        ...style,
      }}
    />
  );
}

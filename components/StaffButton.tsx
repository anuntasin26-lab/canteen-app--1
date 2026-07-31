"use client";
// ─── components/StaffButton.tsx ───────────────────────────
// ปุ่มที่ใช้ร่วมกันในฝั่งพนักงาน (login/forgot-password + แดชบอร์ด)
// มี hover/active/disabled state จริง ผ่าน inline style + local state
// (โปรเจกต์นี้ไม่มี CSS framework จึงทำ state ด้วยมือแทน :hover/:focus จริง)

import { useState } from "react";

export interface StaffButtonTheme {
  ink: string;
  inkSoft: string;
  panel: string;
  accent: string;
  accentText?: string;
  danger: string;
  border: string;
  fontHeading: string;
  radius: number;
}

export interface StaffButtonProps {
  children: React.ReactNode;
  onClick?: () => void;
  type?: "button" | "submit";
  disabled?: boolean;
  variant?: "primary" | "secondary" | "danger" | "ghost";
  fullWidth?: boolean;
  theme: StaffButtonTheme;
  style?: React.CSSProperties;
}

export function StaffButton({
  children, onClick, type = "button", disabled, variant = "primary",
  fullWidth, theme, style,
}: StaffButtonProps) {
  const [hover, setHover] = useState(false);
  const [active, setActive] = useState(false);

  const base: React.CSSProperties = {
    fontFamily: theme.fontHeading,
    fontSize: 15,
    fontWeight: 600,
    borderRadius: Math.max(theme.radius - 4, 4),
    padding: "13px 20px",
    cursor: disabled ? "not-allowed" : "pointer",
    transition: "background-color .15s ease, border-color .15s ease, transform .1s ease, opacity .15s ease",
    transform: active && !disabled ? "scale(0.98)" : "scale(1)",
    opacity: disabled ? 0.55 : 1,
    width: fullWidth ? "100%" : undefined,
  };

  const variants: Record<string, React.CSSProperties> = {
    primary: {
      background: theme.accent,
      color: theme.accentText ?? theme.panel,
      border: "none",
      filter: hover && !disabled ? "brightness(0.92)" : "brightness(1)",
    },
    secondary: {
      background: hover && !disabled ? theme.border : "transparent",
      color: theme.ink,
      border: `1.5px solid ${theme.ink}`,
    },
    danger: {
      background: hover && !disabled ? theme.danger : "transparent",
      color: hover && !disabled ? theme.panel : theme.danger,
      border: `1.5px solid ${theme.danger}`,
    },
    ghost: {
      background: "transparent",
      color: theme.inkSoft,
      border: "none",
      textDecoration: hover ? "underline" : "none",
    },
  };

  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => { setHover(false); setActive(false); }}
      onMouseDown={() => setActive(true)}
      onMouseUp={() => setActive(false)}
      style={{ ...base, ...variants[variant], ...style }}
    >
      {children}
    </button>
  );
}

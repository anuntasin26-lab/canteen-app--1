"use client";
// ─── lib/useStaffAuth.ts ──────────────────────────────────
// Auth state ที่ /kitchen และ /admin ใช้ร่วมกัน: login, logout, ลืมรหัสผ่าน

import { useState } from "react";
import { signInStaff, signOutStaff, requestPasswordReset } from "@/lib/supabase";

export type StaffAuthView = "login" | "forgot" | "forgot-sent";

export function useStaffAuth() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [unlocked, setUnlocked] = useState(false);
  const [loginError, setLoginError] = useState(false);
  const [loggingIn, setLoggingIn] = useState(false);

  const [view, setView] = useState<StaffAuthView>("login");
  const [resetEmail, setResetEmail] = useState("");
  const [resetSending, setResetSending] = useState(false);
  const [resetError, setResetError] = useState(false);

  const handleLogin = async () => {
    if (!email.trim() || !password) return;
    setLoggingIn(true);
    setLoginError(false);
    try {
      await signInStaff(email.trim(), password);
      setUnlocked(true);
    } catch {
      setLoginError(true);
    } finally {
      setLoggingIn(false);
    }
  };

  const handleLogout = async () => {
    await signOutStaff();
    setUnlocked(false);
    setEmail("");
    setPassword("");
  };

  const openForgotPassword = () => {
    setResetEmail(email);
    setResetError(false);
    setView("forgot");
  };

  const backToLogin = () => setView("login");

  const handleRequestReset = async () => {
    if (!resetEmail.trim()) return;
    setResetSending(true);
    setResetError(false);
    try {
      await requestPasswordReset(resetEmail.trim());
      setView("forgot-sent");
    } catch {
      setResetError(true);
    } finally {
      setResetSending(false);
    }
  };

  return {
    email, setEmail, password, setPassword,
    unlocked, setUnlocked, loginError, loggingIn,
    handleLogin, handleLogout,
    view, resetEmail, setResetEmail, resetSending, resetError,
    openForgotPassword, backToLogin, handleRequestReset,
  };
}

export type StaffAuth = ReturnType<typeof useStaffAuth>;

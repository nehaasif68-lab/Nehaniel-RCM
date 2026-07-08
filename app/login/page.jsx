"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

const INK = "#1C2430";
const LINE = "#DCD8CE";
const RED = "#B0473C";

export default function LoginPage() {
  const router = useRouter();
  const supabase = createClient();
  const [mode, setMode] = useState("login"); // login | signup | forgot
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setMessage("");
    setLoading(true);

    if (mode === "forgot") {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/update-password`,
      });
      setLoading(false);
      if (error) {
        setError(error.message);
        return;
      }
      setMessage("Check your email for a password reset link.");
      return;
    }

    const { error } =
      mode === "login"
        ? await supabase.auth.signInWithPassword({ email, password })
        : await supabase.auth.signUp({ email, password });

    setLoading(false);

    if (error) {
      setError(error.message);
      return;
    }

    if (mode === "signup") {
      setMessage("Account created. Check your email to confirm, then log in.");
      setMode("login");
      return;
    }

    router.push("/orgs");
    router.refresh();
  }

  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "100vh" }}>
      <form
        onSubmit={handleSubmit}
        style={{ width: 340, background: "#fff", border: `1px solid ${LINE}`, padding: "36px 32px" }}
      >
        <div style={{ fontSize: 22, fontWeight: 600, textAlign: "center", marginBottom: 24, color: INK }}>
          Nehaniel
        </div>

        <div style={{ marginBottom: 14 }}>
          <div style={{ fontSize: 11.5, color: "#7A7568", marginBottom: 5 }}>Email</div>
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            style={{ width: "100%", padding: "10px 12px", border: `1px solid ${LINE}`, fontSize: 14 }}
          />
        </div>

        {mode !== "forgot" && (
          <div style={{ marginBottom: 18 }}>
            <div style={{ fontSize: 11.5, color: "#7A7568", marginBottom: 5 }}>Password</div>
            <input
              type="password"
              required
              minLength={6}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              style={{ width: "100%", padding: "10px 12px", border: `1px solid ${LINE}`, fontSize: 14 }}
            />
          </div>
        )}

        {error && <div style={{ color: RED, fontSize: 12.5, marginBottom: 14 }}>{error}</div>}
        {message && <div style={{ color: "#3B7A57", fontSize: 12.5, marginBottom: 14 }}>{message}</div>}

        <button
          type="submit"
          disabled={loading}
          style={{ width: "100%", background: INK, color: "#fff", border: "none", padding: "10px 18px", fontSize: 13.5, cursor: "pointer" }}
        >
          {loading
            ? "Please wait…"
            : mode === "login"
            ? "Log in"
            : mode === "signup"
            ? "Create account"
            : "Send reset link"}
        </button>

        <div style={{ display: "flex", justifyContent: "space-between", marginTop: 14 }}>
          <button
            type="button"
            onClick={() => { setMode(mode === "login" ? "signup" : "login"); setError(""); setMessage(""); }}
            style={{ background: "none", border: "none", color: "#2A5C8A", fontSize: 12, cursor: "pointer", padding: 0 }}
          >
            {mode === "login" ? "Need an account? Sign up" : mode === "signup" ? "Already have an account? Log in" : "Back to log in"}
          </button>
          {mode === "login" && (
            <button
              type="button"
              onClick={() => { setMode("forgot"); setError(""); setMessage(""); }}
              style={{ background: "none", border: "none", color: "#7A7568", fontSize: 12, cursor: "pointer", padding: 0 }}
            >
              Forgot password?
            </button>
          )}
        </div>
      </form>
    </div>
  );
}

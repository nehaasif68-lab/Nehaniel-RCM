"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

const INK = "#1C2430";
const LINE = "#DCD8CE";
const RED = "#B0473C";
const GREEN = "#3B7A57";

export default function UpdatePasswordPage() {
  const router = useRouter();
  const supabase = createClient();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");

    if (password !== confirm) {
      setError("Passwords don't match.");
      return;
    }
    if (password.length < 6) {
      setError("Password must be at least 6 characters.");
      return;
    }

    setLoading(true);
    const { error } = await supabase.auth.updateUser({ password });
    setLoading(false);

    if (error) {
      setError(error.message);
      return;
    }

    setDone(true);
    setTimeout(() => {
      router.push("/orgs");
      router.refresh();
    }, 1500);
  }

  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "100vh" }}>
      <div style={{ width: 340, background: "#fff", border: `1px solid ${LINE}`, padding: "36px 32px" }}>
        <div style={{ fontSize: 18, fontWeight: 600, marginBottom: 20, color: INK }}>Set a new password</div>

        {done ? (
          <div style={{ color: GREEN, fontSize: 13.5 }}>Password updated. Taking you to your organizations…</div>
        ) : (
          <form onSubmit={handleSubmit}>
            <div style={{ marginBottom: 14 }}>
              <div style={{ fontSize: 11.5, color: "#7A7568", marginBottom: 5 }}>New password</div>
              <input
                type="password"
                required
                minLength={6}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                style={{ width: "100%", padding: "10px 12px", border: `1px solid ${LINE}`, fontSize: 14 }}
              />
            </div>
            <div style={{ marginBottom: 18 }}>
              <div style={{ fontSize: 11.5, color: "#7A7568", marginBottom: 5 }}>Confirm password</div>
              <input
                type="password"
                required
                minLength={6}
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                style={{ width: "100%", padding: "10px 12px", border: `1px solid ${LINE}`, fontSize: 14 }}
              />
            </div>
            {error && <div style={{ color: RED, fontSize: 12.5, marginBottom: 14 }}>{error}</div>}
            <button
              type="submit"
              disabled={loading}
              style={{ width: "100%", background: INK, color: "#fff", border: "none", padding: "10px 18px", fontSize: 13.5, cursor: "pointer" }}
            >
              {loading ? "Updating…" : "Update password"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}

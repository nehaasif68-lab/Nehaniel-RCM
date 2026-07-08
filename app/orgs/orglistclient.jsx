"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

const INK = "#1C2430";
const LINE = "#DCD8CE";
const MUTE = "#7A7568";
const AMBER = "#B9832E";
const GREEN = "#3B7A57";

export default function OrgListClient({ orgs }) {
  const router = useRouter();
  const supabase = createClient();
  const [showCreate, setShowCreate] = useState(false);
  const [name, setName] = useState("");
  const [specialty, setSpecialty] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function createOrg(e) {
    e.preventDefault();
    setSaving(true);
    setError("");

    const { data: { user } } = await supabase.auth.getUser();

    const { data: org, error: orgError } = await supabase
      .from("organizations")
      .insert({ name, specialty })
      .select()
      .single();

    if (orgError) {
      setError(orgError.message);
      setSaving(false);
      return;
    }

    const { error: memberError } = await supabase
      .from("org_members")
      .insert({ org_id: org.id, user_id: user.id, role: "admin" });

    setSaving(false);

    if (memberError) {
      setError(memberError.message);
      return;
    }

    router.refresh();
    setShowCreate(false);
    setName("");
    setSpecialty("");
  }

  function openOrg(orgId) {
    router.push(`/dashboard?org=${orgId}`);
  }

  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "100vh" }}>
      <div style={{ width: 400, background: "#fff", border: `1px solid ${LINE}`, padding: 32 }}>
        <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 4, color: INK }}>Your organizations</div>
        <div style={{ fontSize: 12.5, color: MUTE, marginBottom: 18 }}>
          Each organization only sees its own data — enforced at the database level.
        </div>

        {orgs.length === 0 && (
          <div style={{ fontSize: 12.5, color: MUTE, marginBottom: 16 }}>
            You're not part of any organization yet.
          </div>
        )}

        {orgs.map((o) => (
          <button
            key={o.id}
            onClick={() => openOrg(o.id)}
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              width: "100%",
              textAlign: "left",
              padding: "14px 16px",
              marginBottom: 8,
              border: `1px solid ${LINE}`,
              background: "#F7F6F2",
              cursor: "pointer",
              fontSize: 13.5,
              color: INK,
            }}
          >
            <div>
              <div style={{ fontWeight: 500 }}>{o.name}</div>
              <div style={{ fontSize: 11.5, color: MUTE }}>{o.specialty || "—"} · {o.role}</div>
            </div>
            <span
              style={{
                fontSize: 11,
                padding: "2px 8px",
                borderRadius: 2,
                background: o.status === "active" ? `${GREEN}18` : `${AMBER}18`,
                color: o.status === "active" ? GREEN : AMBER,
              }}
            >
              {o.status === "active" ? "Active" : "Pending approval"}
            </span>
          </button>
        ))}

        {!showCreate ? (
          <button
            onClick={() => setShowCreate(true)}
            style={{ background: "none", border: `1px solid ${LINE}`, padding: "10px 16px", fontSize: 13, cursor: "pointer", width: "100%", marginTop: 8 }}
          >
            + Add organization
          </button>
        ) : (
          <form onSubmit={createOrg} style={{ marginTop: 12, borderTop: `1px solid ${LINE}`, paddingTop: 14 }}>
            <input
              placeholder="Organization name"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              style={{ width: "100%", padding: "9px 11px", border: `1px solid ${LINE}`, fontSize: 13.5, marginBottom: 8 }}
            />
            <input
              placeholder="Specialty"
              value={specialty}
              onChange={(e) => setSpecialty(e.target.value)}
              style={{ width: "100%", padding: "9px 11px", border: `1px solid ${LINE}`, fontSize: 13.5, marginBottom: 8 }}
            />
            {error && <div style={{ color: "#B0473C", fontSize: 12, marginBottom: 8 }}>{error}</div>}
            <div style={{ display: "flex", gap: 8 }}>
              <button
                type="submit"
                disabled={saving}
                style={{ background: INK, color: "#fff", border: "none", padding: "9px 16px", fontSize: 13, cursor: "pointer" }}
              >
                {saving ? "Creating…" : "Create"}
              </button>
              <button
                type="button"
                onClick={() => setShowCreate(false)}
                style={{ background: "none", border: `1px solid ${LINE}`, padding: "9px 16px", fontSize: 13, cursor: "pointer" }}
              >
                Cancel
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

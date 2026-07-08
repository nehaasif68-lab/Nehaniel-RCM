import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

export default async function DashboardPage({ searchParams }) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const orgId = searchParams.org;
  if (!orgId) redirect("/orgs");

  const { data: membership } = await supabase
    .from("org_members")
    .select("role, organizations(id, name, specialty, status)")
    .eq("org_id", orgId)
    .eq("user_id", user.id)
    .single();

  if (!membership) {
    redirect("/orgs");
  }

  const org = membership.organizations;

  return (
    <div style={{ padding: "40px 32px", maxWidth: 800, margin: "0 auto" }}>
      <div style={{ fontSize: 12, color: "#7A7568", marginBottom: 4 }}>
        <a href="/orgs" style={{ color: "#2A5C8A" }}>← All organizations</a>
      </div>
      <h1 style={{ fontSize: 26, marginBottom: 4 }}>{org.name}</h1>
      <div style={{ fontSize: 13, color: "#7A7568", marginBottom: 24 }}>
        {org.specialty || "—"} · your role: {membership.role} · status: {org.status}
      </div>

      {org.status !== "active" && (
        <div style={{ border: "1px solid #B9832E", background: "#FBEFD9", padding: 14, marginBottom: 20, fontSize: 13 }}>
          This organization is pending approval. Full features unlock once approved.
        </div>
      )}

      <div style={{ border: "1px solid #DCD8CE", background: "#fff", padding: 24 }}>
        <div style={{ fontSize: 13.5, fontWeight: 600, marginBottom: 6 }}>Phase 1 complete: real login and org isolation</div>
        <div style={{ fontSize: 12.5, color: "#7A7568" }}>
          This page proves the core of the system works: you logged in for real, picked a real
          organization, and this data query is protected by the database itself — not just the
          app. Providers, claims, eligibility checks, and remittance screens plug in here next,
          following the same pattern.
        </div>
      </div>
    </div>
  );
}

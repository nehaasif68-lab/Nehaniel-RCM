import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import OrgListClient from "./OrgListClient";

export default async function OrgsPage() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: memberships } = await supabase
    .from("org_members")
    .select("role, organizations(id, name, specialty, status)")
    .eq("user_id", user.id);

  const orgs = (memberships || []).map((m) => ({ ...m.organizations, role: m.role }));

  return <OrgListClient orgs={orgs} />;
}

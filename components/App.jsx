import React, { useState, useEffect, useMemo } from "react";

const INK = "#1C2430";
const PAPER = "#F7F6F2";
const LINE = "#DCD8CE";
const CLAIM_BLUE = "#2A5C8A";
const AMBER = "#B9832E";
const GREEN = "#3B7A57";
const RED = "#B0473C";
const MUTE = "#7A7568";

const STAGES = ["Application Prep", "Submitted", "Payer Review", "Site Visit", "Approved"];
const CLAIM_STATUSES = ["Submitted", "Pending", "Denied", "Paid"];

// Static payer directory — portal links + typical requirements. Submission itself is always manual.
const PAYER_DIRECTORY = [
  {
    name: "PECOS (Medicare)",
    portal: "https://pecos.cms.hhs.gov/",
    requirements: ["Individual NPI (Type 1)", "SSN or ITIN of provider", "CAQH ID (recommended)", "State license", "DEA (if applicable)", "Malpractice insurance"],
  },
  {
    name: "Illinois Medicaid IMPACT",
    portal: "https://www.illinois.gov/hfs/impact",
    requirements: ["NPI", "IL state license", "W-9", "Malpractice insurance", "Practice location details"],
  },
  {
    name: "Molina Healthcare",
    portal: "https://provider.molinahealthcare.com/",
    requirements: ["NPI", "CAQH ID", "State license", "Malpractice insurance", "W-9"],
  },
  {
    name: "Availity (multi-payer commercial)",
    portal: "https://www.availity.com/",
    requirements: ["NPI", "Tax ID", "Payer-specific enrollment forms per plan"],
  },
  {
    name: "CAQH ProView",
    portal: "https://proview.caqh.org/",
    requirements: ["NPI", "State license", "Education/training history", "Work history", "Malpractice insurance", "Attestation every 120 days"],
  },
  {
    name: "BCBS IL",
    portal: "https://www.bcbsil.com/provider",
    requirements: ["NPI", "CAQH ID", "State license", "W-9"],
  },
];

// Reference-only common codes by specialty. Judgment call per encounter stays with the biller/coder — nothing here auto-fills a claim.
const CODING_REFERENCE = {
  "Internal Medicine": {
    icd10: ["I10 – Essential hypertension", "E11.9 – Type 2 diabetes without complications", "Z00.00 – General adult exam", "J06.9 – Upper respiratory infection"],
    cpt: ["99213 – Office visit, established, low complexity", "99214 – Office visit, established, moderate complexity", "80053 – Comprehensive metabolic panel"],
  },
  Pediatrics: {
    icd10: ["Z00.129 – Routine child exam", "J02.9 – Acute pharyngitis", "H66.90 – Otitis media, unspecified"],
    cpt: ["99392 – Preventive visit, established, age 1-4", "99393 – Preventive visit, established, age 5-11", "90460 – Immunization admin"],
  },
  Orthopedics: {
    icd10: ["M54.5 – Low back pain", "M25.561 – Pain in right knee", "S93.401A – Sprain of ankle, initial encounter"],
    cpt: ["99204 – New patient office visit", "20610 – Joint injection, major joint", "73721 – MRI lower extremity"],
  },
};

function uid() {
  return Math.random().toString(36).slice(2, 10);
}

function docStatus(expiry) {
  if (!expiry) return "Current";
  const diff = Math.ceil((new Date(expiry) - new Date()) / 86400000);
  if (diff < 0) return "Expired";
  if (diff <= 45) return "Expiring Soon";
  return "Current";
}

function statusColor(status) {
  if (["Paid", "Approved", "Current"].includes(status)) return GREEN;
  if (["Denied", "Expired", "Overdue"].includes(status)) return RED;
  if (["Pending", "Expiring Soon", "Payer Review", "Site Visit", "Submitted", "Application Prep"].includes(status)) return AMBER;
  return CLAIM_BLUE;
}

function Tag({ children }) {
  const c = statusColor(children);
  return <span style={{ display: "inline-block", padding: "2px 8px", fontSize: 11.5, fontWeight: 500, borderRadius: 2, background: `${c}18`, color: c, whiteSpace: "nowrap" }}>{children}</span>;
}

function Field({ label, children }) {
  return (
    <div style={{ marginBottom: 10 }}>
      <div style={{ fontSize: 11, color: MUTE, marginBottom: 4 }}>{label}</div>
      {children}
    </div>
  );
}

const inputStyle = {
  width: "100%",
  padding: "8px 10px",
  border: `1px solid ${LINE}`,
  fontFamily: "'IBM Plex Sans', sans-serif",
  fontSize: 13.5,
  background: "#fff",
  color: INK,
};

const btnPrimary = {
  background: INK,
  color: "#fff",
  border: "none",
  padding: "8px 16px",
  fontSize: 13,
  cursor: "pointer",
};

const btnGhost = {
  background: "none",
  border: `1px solid ${LINE}`,
  padding: "8px 16px",
  fontSize: 13,
  cursor: "pointer",
  color: INK,
};

function KPI({ label, value, sub, accent }) {
  return (
    <div style={{ border: `1px solid ${LINE}`, background: "#fff", padding: "18px 20px", flex: 1, minWidth: 150 }}>
      <div style={{ fontSize: 11, letterSpacing: "0.08em", textTransform: "uppercase", color: MUTE, marginBottom: 8 }}>{label}</div>
      <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 26, color: accent || INK, fontWeight: 600 }}>{value}</div>
      {sub && <div style={{ fontSize: 12, color: MUTE, marginTop: 4 }}>{sub}</div>}
    </div>
  );
}

function StageTrack({ stage }) {
  const idx = STAGES.indexOf(stage);
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 3, width: 140 }}>
      {STAGES.map((s, i) => (
        <div key={s} title={s} style={{ height: 5, flex: 1, background: i <= idx ? (stage === "Approved" ? GREEN : CLAIM_BLUE) : LINE, borderRadius: 1 }} />
      ))}
    </div>
  );
}

export default function App() {
  const [loading, setLoading] = useState(true);
  const [clients, setClients] = useState([]);
  const [activeClientId, setActiveClientId] = useState(null);
  const [view, setView] = useState("overview");
  const [clientData, setClientData] = useState({ claims: [], providers: [] });
  const [saving, setSaving] = useState(false);
  const [showAddClient, setShowAddClient] = useState(false);
  const [newClient, setNewClient] = useState({ name: "", specialty: "" });
  const [showAddClaim, setShowAddClaim] = useState(false);
  const [newClaim, setNewClaim] = useState({ patient: "", payer: "", amount: "", status: "Submitted", days: "0", denialReason: "" });
  const [showAddProvider, setShowAddProvider] = useState(false);
  const [newProvider, setNewProvider] = useState({ name: "", npi: "" });
  const [npiQuery, setNpiQuery] = useState("");
  const [npiResults, setNpiResults] = useState([]);
  const [npiSearching, setNpiSearching] = useState(false);
  const [npiError, setNpiError] = useState("");
  const [addEnrollFor, setAddEnrollFor] = useState(null);
  const [newEnroll, setNewEnroll] = useState({ payer: "", stage: "Application Prep", target: "", note: "" });
  const [addDocFor, setAddDocFor] = useState(null);
  const [newDoc, setNewDoc] = useState({ name: "", expiry: "" });

  // Load client list on mount
  useEffect(() => {
    (async () => {
      try {
        const res = await window.storage.get("clients", false);
        setClients(res ? JSON.parse(res.value) : []);
      } catch (e) {
        setClients([]);
      }
      setLoading(false);
    })();
  }, []);

  // Load client data whenever active client changes
  useEffect(() => {
    if (!activeClientId) {
      setClientData({ claims: [], providers: [] });
      return;
    }
    (async () => {
      try {
        const res = await window.storage.get(`client-data-${activeClientId}`, false);
        setClientData(res ? JSON.parse(res.value) : { claims: [], providers: [] });
      } catch (e) {
        setClientData({ claims: [], providers: [] });
      }
    })();
  }, [activeClientId]);

  async function saveClients(list) {
    setClients(list);
    try {
      setSaving(true);
      await window.storage.set("clients", JSON.stringify(list), false);
    } catch (e) {
      console.error("Failed to save clients", e);
    } finally {
      setSaving(false);
    }
  }

  async function saveClientData(data) {
    setClientData(data);
    try {
      setSaving(true);
      await window.storage.set(`client-data-${activeClientId}`, JSON.stringify(data), false);
    } catch (e) {
      console.error("Failed to save client data", e);
    } finally {
      setSaving(false);
    }
  }

  async function addClient() {
    if (!newClient.name.trim()) return;
    const c = { id: uid(), name: newClient.name.trim(), specialty: newClient.specialty.trim() || "General" };
    const updated = [...clients, c];
    await saveClients(updated);
    setNewClient({ name: "", specialty: "" });
    setShowAddClient(false);
    setActiveClientId(c.id);
  }

  async function deleteClient(id) {
    if (!window.confirm("Delete this client and all its data? This can't be undone.")) return;
    const updated = clients.filter((c) => c.id !== id);
    await saveClients(updated);
    try {
      await window.storage.delete(`client-data-${id}`, false);
    } catch (e) {}
    if (activeClientId === id) setActiveClientId(updated[0]?.id || null);
  }

  async function addClaim() {
    if (!newClaim.patient.trim() || !newClaim.amount) return;
    const claim = {
      id: "CLM-" + uid().toUpperCase(),
      patient: newClaim.patient.trim(),
      payer: newClaim.payer.trim() || "—",
      amount: parseFloat(newClaim.amount) || 0,
      status: newClaim.status,
      days: parseInt(newClaim.days) || 0,
      denialReason: newClaim.status === "Denied" ? newClaim.denialReason.trim() || "Unspecified" : "",
    };
    await saveClientData({ ...clientData, claims: [claim, ...clientData.claims] });
    setNewClaim({ patient: "", payer: "", amount: "", status: "Submitted", days: "0", denialReason: "" });
    setShowAddClaim(false);
  }

  async function updateClaimStatus(id, status) {
    const claims = clientData.claims.map((c) => (c.id === id ? { ...c, status, denialReason: status === "Denied" ? c.denialReason || "Unspecified" : "" } : c));
    await saveClientData({ ...clientData, claims });
  }

  async function deleteClaim(id) {
    await saveClientData({ ...clientData, claims: clientData.claims.filter((c) => c.id !== id) });
  }

  async function searchNPI() {
    if (!npiQuery.trim()) return;
    setNpiSearching(true);
    setNpiError("");
    setNpiResults([]);
    const isNumber = /^\d{6,10}$/.test(npiQuery.trim());
    try {
      let url;
      if (isNumber) {
        url = `https://npiregistry.cms.hhs.gov/api/?number=${npiQuery.trim()}&version=2.1`;
      } else {
        const parts = npiQuery.trim().split(/\s+/);
        const first = parts[0] || "";
        const last = parts.slice(1).join(" ") || parts[0] || "";
        url = `https://npiregistry.cms.hhs.gov/api/?first_name=${encodeURIComponent(first)}*&last_name=${encodeURIComponent(last)}*&version=2.1&limit=10`;
      }
      const res = await fetch(url);
      const data = await res.json();
      if (data.result_count === 0 || !data.results) {
        setNpiError("No match found in the NPI Registry.");
      } else {
        setNpiResults(data.results);
      }
    } catch (e) {
      setNpiError("Couldn't reach the NPI Registry right now. You can still enter details manually.");
    } finally {
      setNpiSearching(false);
    }
  }

  function selectNPIResult(r) {
    const basic = r.basic || {};
    const name = basic.organization_name || `${basic.first_name || ""} ${basic.last_name || ""}${basic.credential ? ", " + basic.credential : ""}`.trim();
    setNewProvider({ name, npi: r.number });
    setNpiResults([]);
    setNpiQuery("");
  }

  async function addProvider() {
    if (!newProvider.name.trim()) return;
    const p = { id: uid(), name: newProvider.name.trim(), npi: newProvider.npi.trim(), enrollments: [], documents: [] };
    await saveClientData({ ...clientData, providers: [...clientData.providers, p] });
    setNewProvider({ name: "", npi: "" });
    setShowAddProvider(false);
  }

  async function deleteProvider(id) {
    if (!window.confirm("Remove this provider?")) return;
    await saveClientData({ ...clientData, providers: clientData.providers.filter((p) => p.id !== id) });
  }

  async function addEnrollment(providerId) {
    if (!newEnroll.payer.trim()) return;
    const providers = clientData.providers.map((p) =>
      p.id === providerId ? { ...p, enrollments: [...p.enrollments, { ...newEnroll, id: uid() }] } : p
    );
    await saveClientData({ ...clientData, providers });
    setNewEnroll({ payer: "", stage: "Application Prep", target: "", note: "" });
    setAddEnrollFor(null);
  }

  async function updateEnrollStage(providerId, enrollId, stage) {
    const providers = clientData.providers.map((p) =>
      p.id === providerId ? { ...p, enrollments: p.enrollments.map((e) => (e.id === enrollId ? { ...e, stage } : e)) } : p
    );
    await saveClientData({ ...clientData, providers });
  }

  async function deleteEnrollment(providerId, enrollId) {
    const providers = clientData.providers.map((p) =>
      p.id === providerId ? { ...p, enrollments: p.enrollments.filter((e) => e.id !== enrollId) } : p
    );
    await saveClientData({ ...clientData, providers });
  }

  async function addDocument(providerId) {
    if (!newDoc.name.trim() || !newDoc.expiry) return;
    const providers = clientData.providers.map((p) =>
      p.id === providerId ? { ...p, documents: [...p.documents, { ...newDoc, id: uid() }] } : p
    );
    await saveClientData({ ...clientData, providers });
    setNewDoc({ name: "", expiry: "" });
    setAddDocFor(null);
  }

  async function deleteDocument(providerId, docId) {
    const providers = clientData.providers.map((p) =>
      p.id === providerId ? { ...p, documents: p.documents.filter((d) => d.id !== docId) } : p
    );
    await saveClientData({ ...clientData, providers });
  }

  const client = clients.find((c) => c.id === activeClientId);

  const arBuckets = useMemo(() => {
    const b = { "0-30": 0, "31-60": 0, "61-90": 0, "90+": 0 };
    clientData.claims.filter((c) => c.status !== "Paid").forEach((c) => {
      if (c.days <= 30) b["0-30"] += c.amount;
      else if (c.days <= 60) b["31-60"] += c.amount;
      else if (c.days <= 90) b["61-90"] += c.amount;
      else b["90+"] += c.amount;
    });
    return b;
  }, [clientData.claims]);

  const totalAR = Object.values(arBuckets).reduce((s, v) => s + v, 0);
  const maxBucket = Math.max(...Object.values(arBuckets), 1);
  const deniedClaims = clientData.claims.filter((c) => c.status === "Denied");
  const denialGroups = useMemo(() => {
    const map = {};
    deniedClaims.forEach((c) => {
      const key = c.denialReason || "Unspecified";
      if (!map[key]) map[key] = { reason: key, count: 0, value: 0 };
      map[key].count += 1;
      map[key].value += c.amount;
    });
    return Object.values(map);
  }, [deniedClaims]);

  const allEnrollments = clientData.providers.flatMap((p) => p.enrollments.map((e) => ({ ...e, providerId: p.id })));
  const pendingEnrollments = allEnrollments.filter((e) => e.stage !== "Approved").length;
  const overdueEnrollments = allEnrollments.filter((e) => e.target && e.target.toLowerCase() === "overdue").length;
  const allDocs = clientData.providers.flatMap((p) => p.documents);
  const expiringDocs = allDocs.filter((d) => docStatus(d.expiry) !== "Current").length;

  if (loading) {
    return <div style={{ padding: 40, fontFamily: "sans-serif", color: MUTE }}>Loading your workspace…</div>;
  }

  return (
    <div style={{ fontFamily: "'IBM Plex Sans', sans-serif", background: PAPER, minHeight: "100vh", color: INK }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Newsreader:ital,wght@0,500;0,600;1,500&family=IBM+Plex+Sans:wght@400;500;600&family=IBM+Plex+Mono:wght@400;500;600&display=swap');
        * { box-sizing: border-box; }
        table { border-collapse: collapse; width: 100%; }
        th { text-align: left; font-size: 11px; letter-spacing: 0.06em; text-transform: uppercase; color: ${MUTE}; font-weight: 500; padding: 8px 10px; border-bottom: 1px solid ${INK}; }
        td { padding: 9px 10px; border-bottom: 1px solid ${LINE}; font-size: 13.5px; vertical-align: middle; }
        tr:hover td { background: rgba(42,92,138,0.04); }
        .client-btn { cursor: pointer; border: none; background: none; text-align: left; padding: 10px 14px; font-family: 'IBM Plex Sans', sans-serif; font-size: 13.5px; border-left: 2px solid transparent; width: 100%; }
        .client-btn:hover { background: rgba(0,0,0,0.03); }
        .nav-btn { cursor: pointer; border: none; background: none; font-family: 'IBM Plex Sans', sans-serif; font-size: 13.5px; padding: 8px 4px; border-bottom: 2px solid transparent; color: ${MUTE}; }
        .nav-btn.active { color: ${INK}; border-bottom-color: ${CLAIM_BLUE}; font-weight: 500; }
        select { font-family: 'IBM Plex Sans', sans-serif; }
        .icon-btn { background: none; border: none; cursor: pointer; color: ${MUTE}; font-size: 13px; padding: 2px 6px; }
        .icon-btn:hover { color: ${RED}; }
      `}</style>

      <div style={{ display: "flex", minHeight: "100vh" }}>
        {/* Sidebar */}
        <div style={{ width: 230, borderRight: `1px solid ${LINE}`, background: "#fff", paddingTop: 24, display: "flex", flexDirection: "column" }}>
          <div style={{ padding: "0 18px 20px", borderBottom: `1px solid ${LINE}`, marginBottom: 10 }}>
            <div style={{ fontFamily: "'Newsreader', serif", fontStyle: "italic", fontSize: 21, fontWeight: 600 }}>Nehaniel</div>
            <div style={{ fontSize: 10.5, letterSpacing: "0.14em", color: MUTE, textTransform: "uppercase", marginTop: 1 }}>
              RCM Ledger {saving && "· saving…"}
            </div>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "6px 18px" }}>
            <span style={{ fontSize: 10.5, letterSpacing: "0.08em", color: MUTE, textTransform: "uppercase" }}>Clients</span>
            <button onClick={() => setShowAddClient(!showAddClient)} style={{ background: "none", border: "none", color: CLAIM_BLUE, cursor: "pointer", fontSize: 16, lineHeight: 1 }}>+</button>
          </div>

          {showAddClient && (
            <div style={{ padding: "6px 18px 14px" }}>
              <input style={inputStyle} placeholder="Practice name" value={newClient.name} onChange={(e) => setNewClient({ ...newClient, name: e.target.value })} />
              <div style={{ height: 6 }} />
              <input style={inputStyle} placeholder="Specialty" value={newClient.specialty} onChange={(e) => setNewClient({ ...newClient, specialty: e.target.value })} />
              <div style={{ height: 8 }} />
              <button style={btnPrimary} onClick={addClient}>Add client</button>
            </div>
          )}

          {clients.length === 0 && !showAddClient && (
            <div style={{ padding: "10px 18px", fontSize: 12.5, color: MUTE }}>No clients yet. Tap + to add your first one.</div>
          )}

          {clients.map((c) => (
            <div key={c.id} style={{ position: "relative", display: "flex", alignItems: "center" }}>
              <button
                className="client-btn"
                onClick={() => setActiveClientId(c.id)}
                style={{
                  borderLeftColor: activeClientId === c.id ? CLAIM_BLUE : "transparent",
                  background: activeClientId === c.id ? "rgba(42,92,138,0.06)" : "transparent",
                  color: activeClientId === c.id ? INK : "#4b4638",
                }}
              >
                <div style={{ fontWeight: 500 }}>{c.name}</div>
                <div style={{ fontSize: 11.5, color: MUTE, marginTop: 1 }}>{c.specialty}</div>
              </button>
              <button className="icon-btn" onClick={() => deleteClient(c.id)} style={{ position: "absolute", right: 10 }}>✕</button>
            </div>
          ))}
        </div>

        {/* Main */}
        <div style={{ flex: 1, padding: "28px 36px 60px", maxWidth: 1120 }}>
          {!client ? (
            <div style={{ color: MUTE, fontSize: 14, marginTop: 60, textAlign: "center" }}>
              Add a client on the left to start tracking claims and credentialing.
            </div>
          ) : (
            <>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 4 }}>
                <h1 style={{ fontFamily: "'Newsreader', serif", fontSize: 28, fontWeight: 600, margin: 0 }}>{client.name}</h1>
                <span style={{ fontSize: 12.5, color: MUTE }}>{clientData.providers.length} providers tracked</span>
              </div>
              <div style={{ fontSize: 12.5, color: MUTE, marginBottom: 18 }}>Revenue cycle & credentialing</div>

              <div style={{ display: "flex", gap: 22, borderBottom: `1px solid ${LINE}`, marginBottom: 24 }}>
                <button className={`nav-btn ${view === "overview" ? "active" : ""}`} onClick={() => setView("overview")}>Claims & AR</button>
                <button className={`nav-btn ${view === "credentialing" ? "active" : ""}`} onClick={() => setView("credentialing")}>
                  Credentialing {(overdueEnrollments > 0 || expiringDocs > 0) && <span style={{ color: RED }}>●</span>}
                </button>
                <button className={`nav-btn ${view === "resources" ? "active" : ""}`} onClick={() => setView("resources")}>Payers & Codes</button>
              </div>

              {view === "overview" && (
                <>
                  <div style={{ display: "flex", gap: 14, marginBottom: 28, flexWrap: "wrap" }}>
                    <KPI label="Total AR" value={`$${totalAR.toLocaleString()}`} />
                    <KPI label="AR over 90 days" value={`$${arBuckets["90+"].toLocaleString()}`} accent={arBuckets["90+"] > 0 ? RED : INK} />
                    <KPI label="Open denials" value={deniedClaims.length} accent={AMBER} sub={`$${deniedClaims.reduce((s, c) => s + c.amount, 0).toLocaleString()} at risk`} />
                    <KPI label="Credentialing items" value={allEnrollments.length} sub={`${pendingEnrollments} pending`} accent={overdueEnrollments ? RED : INK} />
                  </div>

                  <div style={{ border: `1px solid ${LINE}`, background: "#fff", padding: "20px 24px", marginBottom: 26 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 14 }}>AR Aging</div>
                    <div style={{ display: "flex", alignItems: "flex-end", gap: 20, height: 140 }}>
                      {Object.entries(arBuckets).map(([bucket, amount]) => (
                        <div key={bucket} style={{ flex: 1, textAlign: "center" }}>
                          <div style={{ fontSize: 11.5, fontFamily: "'IBM Plex Mono', monospace", marginBottom: 4 }}>${amount.toLocaleString()}</div>
                          <div style={{ height: Math.max(4, (amount / maxBucket) * 100), background: bucket === "90+" ? RED : bucket === "61-90" ? AMBER : CLAIM_BLUE, borderRadius: "2px 2px 0 0" }} />
                          <div style={{ fontSize: 12, color: MUTE, marginTop: 6 }}>{bucket}</div>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div style={{ display: "flex", gap: 20, marginBottom: 26, flexWrap: "wrap" }}>
                    <div style={{ flex: 2, minWidth: 380, border: `1px solid ${LINE}`, background: "#fff", padding: "18px 22px" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                        <div style={{ fontSize: 13, fontWeight: 600 }}>Claims</div>
                        <button className="icon-btn" style={{ color: CLAIM_BLUE, fontSize: 18 }} onClick={() => setShowAddClaim(!showAddClaim)}>+</button>
                      </div>

                      {showAddClaim && (
                        <div style={{ border: `1px solid ${LINE}`, padding: 14, marginBottom: 14, background: PAPER }}>
                          <Field label="Patient"><input style={inputStyle} value={newClaim.patient} onChange={(e) => setNewClaim({ ...newClaim, patient: e.target.value })} /></Field>
                          <Field label="Payer"><input style={inputStyle} value={newClaim.payer} onChange={(e) => setNewClaim({ ...newClaim, payer: e.target.value })} /></Field>
                          <Field label="Amount ($)"><input style={inputStyle} type="number" value={newClaim.amount} onChange={(e) => setNewClaim({ ...newClaim, amount: e.target.value })} /></Field>
                          <Field label="Days outstanding"><input style={inputStyle} type="number" value={newClaim.days} onChange={(e) => setNewClaim({ ...newClaim, days: e.target.value })} /></Field>
                          <Field label="Status">
                            <select style={inputStyle} value={newClaim.status} onChange={(e) => setNewClaim({ ...newClaim, status: e.target.value })}>
                              {CLAIM_STATUSES.map((s) => <option key={s}>{s}</option>)}
                            </select>
                          </Field>
                          {newClaim.status === "Denied" && (
                            <Field label="Denial reason"><input style={inputStyle} value={newClaim.denialReason} onChange={(e) => setNewClaim({ ...newClaim, denialReason: e.target.value })} /></Field>
                          )}
                          <div style={{ display: "flex", gap: 8, marginTop: 4 }}>
                            <button style={btnPrimary} onClick={addClaim}>Save claim</button>
                            <button style={btnGhost} onClick={() => setShowAddClaim(false)}>Cancel</button>
                          </div>
                        </div>
                      )}

                      {clientData.claims.length === 0 ? (
                        <div style={{ fontSize: 12.5, color: MUTE, padding: "10px 0" }}>No claims yet.</div>
                      ) : (
                        <table>
                          <thead><tr><th>Patient</th><th>Payer</th><th>Amount</th><th>Status</th><th>Days</th><th></th></tr></thead>
                          <tbody>
                            {clientData.claims.map((c) => (
                              <tr key={c.id}>
                                <td>{c.patient}</td>
                                <td>{c.payer}</td>
                                <td style={{ fontFamily: "'IBM Plex Mono', monospace" }}>${c.amount.toLocaleString()}</td>
                                <td>
                                  <select style={{ ...inputStyle, padding: "3px 6px", fontSize: 12, width: "auto" }} value={c.status} onChange={(e) => updateClaimStatus(c.id, e.target.value)}>
                                    {CLAIM_STATUSES.map((s) => <option key={s}>{s}</option>)}
                                  </select>
                                </td>
                                <td style={{ color: c.days > 60 ? RED : MUTE }}>{c.days}d</td>
                                <td><button className="icon-btn" onClick={() => deleteClaim(c.id)}>✕</button></td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      )}
                    </div>

                    <div style={{ flex: 1, minWidth: 260, border: `1px solid ${LINE}`, background: "#fff", padding: "18px 22px" }}>
                      <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 10 }}>Denial Reasons</div>
                      {denialGroups.length === 0 ? (
                        <div style={{ fontSize: 12.5, color: MUTE }}>No denials logged.</div>
                      ) : (
                        denialGroups.map((d, i) => (
                          <div key={i} style={{ padding: "10px 0", borderBottom: i < denialGroups.length - 1 ? `1px solid ${LINE}` : "none" }}>
                            <div style={{ fontSize: 13, marginBottom: 3 }}>{d.reason}</div>
                            <div style={{ fontSize: 11.5, color: MUTE }}>{d.count} claims · <span style={{ fontFamily: "'IBM Plex Mono', monospace" }}>${d.value.toLocaleString()}</span></div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                </>
              )}

              {view === "credentialing" && (
                <>
                  <div style={{ display: "flex", gap: 14, marginBottom: 28, flexWrap: "wrap" }}>
                    <KPI label="Providers tracked" value={clientData.providers.length} />
                    <KPI label="Enrollments in progress" value={pendingEnrollments} accent={AMBER} />
                    <KPI label="Overdue items" value={overdueEnrollments} accent={overdueEnrollments ? RED : INK} />
                    <KPI label="Docs expiring / expired" value={expiringDocs} accent={expiringDocs ? RED : INK} />
                  </div>

                  <div style={{ marginBottom: 16 }}>
                    <button style={btnGhost} onClick={() => setShowAddProvider(!showAddProvider)}>+ Add provider</button>
                  </div>

                  {showAddProvider && (
                    <div style={{ border: `1px solid ${LINE}`, padding: 14, marginBottom: 18, background: "#fff", maxWidth: 380 }}>
                      <Field label="Verify against NPI Registry (number or full name)">
                        <div style={{ display: "flex", gap: 6 }}>
                          <input style={inputStyle} placeholder="e.g. 1234567890 or John Smith" value={npiQuery} onChange={(e) => setNpiQuery(e.target.value)} onKeyDown={(e) => e.key === "Enter" && searchNPI()} />
                          <button style={btnGhost} onClick={searchNPI}>{npiSearching ? "…" : "Search"}</button>
                        </div>
                      </Field>
                      {npiError && <div style={{ fontSize: 12, color: RED, marginBottom: 8 }}>{npiError}</div>}
                      {npiResults.length > 0 && (
                        <div style={{ border: `1px solid ${LINE}`, marginBottom: 12, maxHeight: 180, overflowY: "auto" }}>
                          {npiResults.map((r) => {
                            const b = r.basic || {};
                            const addr = (r.addresses && r.addresses[0]) || {};
                            const label = b.organization_name || `${b.first_name || ""} ${b.last_name || ""}${b.credential ? ", " + b.credential : ""}`.trim();
                            return (
                              <button key={r.number} onClick={() => selectNPIResult(r)} style={{ display: "block", width: "100%", textAlign: "left", background: "none", border: "none", borderBottom: `1px solid ${LINE}`, padding: "8px 10px", cursor: "pointer" }}>
                                <div style={{ fontSize: 12.5 }}>{label}</div>
                                <div style={{ fontSize: 11, color: MUTE, fontFamily: "'IBM Plex Mono', monospace" }}>NPI {r.number} · {addr.city}, {addr.state}</div>
                              </button>
                            );
                          })}
                        </div>
                      )}
                      <div style={{ fontSize: 11, color: MUTE, marginBottom: 10 }}>Pick a match above to auto-fill, or enter details manually below.</div>
                      <Field label="Provider name"><input style={inputStyle} value={newProvider.name} onChange={(e) => setNewProvider({ ...newProvider, name: e.target.value })} /></Field>
                      <Field label="NPI"><input style={inputStyle} value={newProvider.npi} onChange={(e) => setNewProvider({ ...newProvider, npi: e.target.value })} /></Field>
                      <div style={{ display: "flex", gap: 8 }}>
                        <button style={btnPrimary} onClick={addProvider}>Add</button>
                        <button style={btnGhost} onClick={() => setShowAddProvider(false)}>Cancel</button>
                      </div>
                    </div>
                  )}

                  {clientData.providers.length === 0 && !showAddProvider && (
                    <div style={{ fontSize: 12.5, color: MUTE }}>No providers tracked yet.</div>
                  )}

                  {clientData.providers.map((p) => (
                    <div key={p.id} style={{ border: `1px solid ${LINE}`, background: "#fff", padding: "18px 22px", marginBottom: 18 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 14 }}>
                        <div style={{ fontSize: 14.5, fontWeight: 600 }}>{p.name}</div>
                        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                          <span style={{ fontSize: 11.5, color: MUTE, fontFamily: "'IBM Plex Mono', monospace" }}>{p.npi ? `NPI ${p.npi}` : ""}</span>
                          <button className="icon-btn" onClick={() => deleteProvider(p.id)}>✕</button>
                        </div>
                      </div>

                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                        <div style={{ fontSize: 11, letterSpacing: "0.06em", textTransform: "uppercase", color: MUTE }}>Payer Enrollments</div>
                        <button className="icon-btn" style={{ color: CLAIM_BLUE, fontSize: 16 }} onClick={() => setAddEnrollFor(addEnrollFor === p.id ? null : p.id)}>+</button>
                      </div>

                      {addEnrollFor === p.id && (
                        <div style={{ border: `1px solid ${LINE}`, padding: 14, marginBottom: 14, background: PAPER }}>
                          <Field label="Payer"><input style={inputStyle} value={newEnroll.payer} onChange={(e) => setNewEnroll({ ...newEnroll, payer: e.target.value })} /></Field>
                          <Field label="Stage">
                            <select style={inputStyle} value={newEnroll.stage} onChange={(e) => setNewEnroll({ ...newEnroll, stage: e.target.value })}>
                              {STAGES.map((s) => <option key={s}>{s}</option>)}
                            </select>
                          </Field>
                          <Field label="Target date / note (e.g. Aug 5, or Overdue)"><input style={inputStyle} value={newEnroll.target} onChange={(e) => setNewEnroll({ ...newEnroll, target: e.target.value })} /></Field>
                          <Field label="Note"><input style={inputStyle} value={newEnroll.note} onChange={(e) => setNewEnroll({ ...newEnroll, note: e.target.value })} /></Field>
                          <div style={{ display: "flex", gap: 8 }}>
                            <button style={btnPrimary} onClick={() => addEnrollment(p.id)}>Save</button>
                            <button style={btnGhost} onClick={() => setAddEnrollFor(null)}>Cancel</button>
                          </div>
                        </div>
                      )}

                      {p.enrollments.length === 0 ? (
                        <div style={{ fontSize: 12.5, color: MUTE, marginBottom: 14 }}>No enrollments yet.</div>
                      ) : (
                        <table style={{ marginBottom: 16 }}>
                          <thead><tr><th>Payer</th><th>Pipeline</th><th>Stage</th><th>Target</th><th>Note</th><th></th></tr></thead>
                          <tbody>
                            {p.enrollments.map((e) => (
                              <tr key={e.id}>
                                <td>{e.payer}</td>
                                <td><StageTrack stage={e.stage} /></td>
                                <td>
                                  <select style={{ ...inputStyle, padding: "3px 6px", fontSize: 12, width: "auto" }} value={e.stage} onChange={(ev) => updateEnrollStage(p.id, e.id, ev.target.value)}>
                                    {STAGES.map((s) => <option key={s}>{s}</option>)}
                                  </select>
                                </td>
                                <td style={{ color: e.target?.toLowerCase() === "overdue" ? RED : MUTE }}>{e.target || "—"}</td>
                                <td style={{ color: MUTE, fontSize: 12.5 }}>{e.note || "—"}</td>
                                <td><button className="icon-btn" onClick={() => deleteEnrollment(p.id, e.id)}>✕</button></td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      )}

                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                        <div style={{ fontSize: 11, letterSpacing: "0.06em", textTransform: "uppercase", color: MUTE }}>Documents</div>
                        <button className="icon-btn" style={{ color: CLAIM_BLUE, fontSize: 16 }} onClick={() => setAddDocFor(addDocFor === p.id ? null : p.id)}>+</button>
                      </div>

                      {addDocFor === p.id && (
                        <div style={{ border: `1px solid ${LINE}`, padding: 14, marginBottom: 14, background: PAPER, maxWidth: 320 }}>
                          <Field label="Document name"><input style={inputStyle} value={newDoc.name} onChange={(e) => setNewDoc({ ...newDoc, name: e.target.value })} /></Field>
                          <Field label="Expiry date"><input style={inputStyle} type="date" value={newDoc.expiry} onChange={(e) => setNewDoc({ ...newDoc, expiry: e.target.value })} /></Field>
                          <div style={{ display: "flex", gap: 8 }}>
                            <button style={btnPrimary} onClick={() => addDocument(p.id)}>Save</button>
                            <button style={btnGhost} onClick={() => setAddDocFor(null)}>Cancel</button>
                          </div>
                        </div>
                      )}

                      {p.documents.length === 0 ? (
                        <div style={{ fontSize: 12.5, color: MUTE }}>No documents tracked.</div>
                      ) : (
                        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                          {p.documents.map((d) => (
                            <div key={d.id} style={{ border: `1px solid ${LINE}`, padding: "8px 12px", minWidth: 170, position: "relative" }}>
                              <div style={{ fontSize: 12.5, marginBottom: 3 }}>{d.name}</div>
                              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                                <span style={{ fontSize: 11.5, color: MUTE, fontFamily: "'IBM Plex Mono', monospace" }}>{d.expiry}</span>
                                <Tag>{docStatus(d.expiry)}</Tag>
                              </div>
                              <button className="icon-btn" onClick={() => deleteDocument(p.id, d.id)} style={{ position: "absolute", top: 2, right: 2 }}>✕</button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </>
              )}

              {view === "resources" && (
                <>
                  <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 4 }}>Payer Directory</div>
                  <div style={{ fontSize: 12, color: MUTE, marginBottom: 14 }}>Direct portal links and typical requirements. Submission is still done manually in each payer's own system.</div>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 14, marginBottom: 30 }}>
                    {PAYER_DIRECTORY.map((p) => (
                      <div key={p.name} style={{ border: `1px solid ${LINE}`, background: "#fff", padding: "16px 18px", width: 300 }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 8 }}>
                          <div style={{ fontSize: 13.5, fontWeight: 600 }}>{p.name}</div>
                          <a href={p.portal} target="_blank" rel="noopener noreferrer" style={{ fontSize: 11.5, color: CLAIM_BLUE }}>Open portal ↗</a>
                        </div>
                        <div style={{ fontSize: 11, letterSpacing: "0.05em", textTransform: "uppercase", color: MUTE, marginBottom: 6 }}>Typically needs</div>
                        <ul style={{ margin: 0, paddingLeft: 16, fontSize: 12.5, color: "#4b4638" }}>
                          {p.requirements.map((r, i) => <li key={i} style={{ marginBottom: 3 }}>{r}</li>)}
                        </ul>
                      </div>
                    ))}
                  </div>

                  <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 4 }}>Coding Reference</div>
                  <div style={{ fontSize: 12, color: MUTE, marginBottom: 14 }}>Common codes by specialty, for quick reference only — always verify against the actual documented encounter before submitting a claim.</div>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 14 }}>
                    {Object.entries(CODING_REFERENCE).map(([specialty, codes]) => (
                      <div key={specialty} style={{ border: `1px solid ${LINE}`, background: "#fff", padding: "16px 18px", width: 320 }}>
                        <div style={{ fontSize: 13.5, fontWeight: 600, marginBottom: 10 }}>{specialty}</div>
                        <div style={{ fontSize: 11, letterSpacing: "0.05em", textTransform: "uppercase", color: MUTE, marginBottom: 6 }}>Common ICD-10</div>
                        <ul style={{ margin: "0 0 12px", paddingLeft: 16, fontSize: 12.5, color: "#4b4638" }}>
                          {codes.icd10.map((c, i) => <li key={i} style={{ marginBottom: 3 }}>{c}</li>)}
                        </ul>
                        <div style={{ fontSize: 11, letterSpacing: "0.05em", textTransform: "uppercase", color: MUTE, marginBottom: 6 }}>Common CPT</div>
                        <ul style={{ margin: 0, paddingLeft: 16, fontSize: 12.5, color: "#4b4638" }}>
                          {codes.cpt.map((c, i) => <li key={i} style={{ marginBottom: 3 }}>{c}</li>)}
                        </ul>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

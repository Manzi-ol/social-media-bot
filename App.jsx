import { useState, useEffect, useCallback, useRef, createContext, useContext } from "react";

// ─────────────────────────────────────────────────────────────────────────────
// CONFIG
// ─────────────────────────────────────────────────────────────────────────────
const API = "http://127.0.0.1:8000/api";

// ─────────────────────────────────────────────────────────────────────────────
// DESIGN TOKENS
// ─────────────────────────────────────────────────────────────────────────────
const T = {
  green:  "#1a5c38",
  dark:   "#14472b",
  teal:   "#1a7c5c",
  gold:   "#c9973a",
  cream:  "#f5f0e8",
  bg:     "#f4f0e8",
  card:   "#ffffff",
  border: "#e8e0d0",
  muted:  "#8a7e6e",
  red:    "#c0392b",
  blue:   "#1a3a5c",
  purple: "#5c3a8a",
  text:   "#1a1a1a",
  text2:  "#444444",
};

// ─────────────────────────────────────────────────────────────────────────────
// API SERVICE
// ─────────────────────────────────────────────────────────────────────────────
const api = {
  _t: null,
  tok(t) { this._t = t; },
  hdr() {
    return { "Content-Type": "application/json", ...(this._t ? { Authorization: `Bearer ${this._t}` } : {}) };
  },
  async req(method, path, body) {
    const r = await fetch(`${API}${path}`, { method, headers: this.hdr(), ...(body !== undefined ? { body: JSON.stringify(body) } : {}) });
    if (!r.ok) { const e = await r.json().catch(() => ({ detail: r.statusText })); throw new Error(e.detail || JSON.stringify(e)); }
    if (r.status === 204) return null;
    return r.json();
  },
  get:   (p)    => api.req("GET",    p),
  post:  (p, b) => api.req("POST",   p, b),
  patch: (p, b) => api.req("PATCH",  p, b),
  del:   (p)    => api.req("DELETE", p),

  login:   (u, p) => api.post("/auth/login/", { username: u, password: p }),
  signup:  (d)    => api.post("/signup/", d),
  me:      ()     => api.get("/me/"),
  patchMe: (d)    => api.patch("/me/", d),

  dashboard:  () => api.get("/dashboard/"),
  analytics:  () => api.get("/analytics/"),

  residents:       () => api.get("/residents/"),
  addResident:     (d) => api.post("/residents/", d),
  toggleMutuelle:  (id) => api.patch(`/residents/${id}/mutuelle/`),

  needs:             (s) => api.get(`/needs/${s ? `?status=${s}` : ""}`),
  addNeed:           (d) => api.post("/needs/", d),
  updateNeedStatus:  (id, d) => api.patch(`/needs/${id}/status/`, d),

  umuganda:        () => api.get("/umuganda/"),
  addUmuganda:     (d) => api.post("/umuganda/", d),
  upcomingUmuganda:() => api.get("/umuganda/upcoming/"),
  toggleAttendance:(uid, rid) => api.post(`/umuganda/${uid}/attendance/`, { resident_id: rid }),

  announcements:    () => api.get("/announcements/"),
  addAnnouncement:  (d) => api.post("/announcements/", d),
  delAnnouncement:  (id) => api.del(`/announcements/${id}/`),

  chatRooms: () => api.get("/chat/"),
  chatMsgs:  (id) => api.get(`/chat/${id}/messages/`),
  sendMsg:   (id, msg) => api.post(`/chat/${id}/messages/send/`, { message: msg }),

  dmList:   () => api.get("/dm/"),
  dmThread: (pid) => api.get(`/dm/with/${pid}/`),
  sendDM:   (rid, msg) => api.post("/dm/send/", { receiver_id: rid, message: msg }),

  alerts:          () => api.get("/alerts/?active=1"),
  allAlerts:       () => api.get("/alerts/"),
  addAlert:        (d) => api.post("/alerts/", d),
  deactivateAlert: (id) => api.patch(`/alerts/${id}/deactivate/`),

  events:   () => api.get("/events/"),
  addEvent: (d) => api.post("/events/", d),
  rsvp:     (id) => api.post(`/events/${id}/rsvp/`),

  polls:     () => api.get("/polls/"),
  addPoll:   (d) => api.post("/polls/", d),
  vote:      (pid, oid) => api.post(`/polls/${pid}/vote/`, { option_id: oid }),
  closePoll: (id) => api.patch(`/polls/${id}/close/`),

  market:       (t) => api.get(`/market/${t ? `?type=${t}&available=1` : ""}`),
  addListing:   (d) => api.post("/market/", d),
  toggleAvail:  (id) => api.patch(`/market/${id}/toggle-available/`),
  delListing:   (id) => api.del(`/market/${id}/`),

  tasks:      () => api.get("/tasks/"),
  addTask:    (d) => api.post("/tasks/", d),
  updateTask: (id, d) => api.patch(`/tasks/${id}/`, d),
  delTask:    (id) => api.del(`/tasks/${id}/`),

  docs:    (cat) => api.get(`/documents/${cat ? `?category=${cat}` : ""}`),
  addDoc:  (d)   => api.post("/documents/", d),
  delDoc:  (id)  => api.del(`/documents/${id}/`),

  contacts:    () => api.get("/contacts/"),
  addContact:  (d) => api.post("/contacts/", d),
  delContact:  (id) => api.del(`/contacts/${id}/`),

  notifications: () => api.get("/notifications/"),
  notifCount:    () => api.get("/notifications/unread-count/"),
  markAllRead:   () => api.post("/notifications/mark-all-read/"),

  leaderRequests:  (s)      => api.get(`/leader-requests/${s ? `?status=${s}` : ""}`),
  approveRequest:  (id, d)  => api.post(`/leader-requests/${id}/approve/`, d),
  rejectRequest:   (id, d)  => api.post(`/leader-requests/${id}/reject/`, d),
  pendingRequests: ()        => api.get("/leader-requests/count/"),
};

// ─────────────────────────────────────────────────────────────────────────────
// AUTH CONTEXT
// ─────────────────────────────────────────────────────────────────────────────
const Auth = createContext(null);
const useAuth = () => useContext(Auth);

// ─────────────────────────────────────────────────────────────────────────────
// UI ATOMS
// ─────────────────────────────────────────────────────────────────────────────

function Spinner({ size = 24 }) {
  return (
    <div style={{ display: "flex", justifyContent: "center", alignItems: "center", padding: 32 }}>
      <div style={{ width: size, height: size, border: `3px solid ${T.green}20`, borderTop: `3px solid ${T.green}`, borderRadius: "50%", animation: "spin 0.7s linear infinite" }} />
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

function Alert({ type = "error", msg, onClose }) {
  if (!msg) return null;
  const styles = {
    error:   { bg: "#fef2f2", border: "#fca5a5", color: "#991b1b", icon: "⚠" },
    success: { bg: "#f0fdf4", border: "#86efac", color: "#166534", icon: "✓" },
    info:    { bg: "#eff6ff", border: "#93c5fd", color: "#1e40af", icon: "ℹ" },
    warning: { bg: "#fffbeb", border: "#fcd34d", color: "#92400e", icon: "⚠" },
  };
  const s = styles[type] || styles.error;
  return (
    <div style={{ background: s.bg, border: `1px solid ${s.border}`, borderRadius: 10, padding: "12px 16px", marginBottom: 14, display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 10 }}>
      <div style={{ display: "flex", gap: 10, alignItems: "flex-start", flex: 1 }}>
        <span style={{ color: s.color, fontSize: 16, flexShrink: 0, marginTop: 1 }}>{s.icon}</span>
        <span style={{ fontSize: 13, color: s.color, lineHeight: 1.5 }}>{msg}</span>
      </div>
      {onClose && <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", color: s.color, fontSize: 18, lineHeight: 1, flexShrink: 0, padding: 0 }}>×</button>}
    </div>
  );
}

function Card({ children, style, onClick }) {
  return (
    <div onClick={onClick} style={{ background: T.card, borderRadius: 14, padding: 18, border: `1px solid ${T.border}`, boxShadow: "0 1px 4px rgba(0,0,0,0.06)", ...style }}>
      {children}
    </div>
  );
}

function Btn({ children, onClick, variant = "primary", size = "md", disabled, full, style }) {
  const variants = {
    primary: { background: T.green,  color: T.cream  },
    gold:    { background: T.gold,   color: "#fff"   },
    ghost:   { background: "transparent", color: T.green, border: `1.5px solid ${T.green}` },
    danger:  { background: T.red,    color: "#fff"   },
    subtle:  { background: T.bg,     color: T.text2, border: `1px solid ${T.border}` },
  };
  const sizes = { sm: "6px 12px", md: "10px 20px", lg: "13px 28px" };
  const fontSizes = { sm: 12, md: 13, lg: 15 };
  return (
    <button onClick={onClick} disabled={disabled} style={{
      cursor: disabled ? "not-allowed" : "pointer", border: "none", borderRadius: 9,
      fontWeight: 700, fontSize: fontSizes[size], padding: sizes[size],
      opacity: disabled ? 0.5 : 1, width: full ? "100%" : "auto",
      transition: "opacity 0.15s, transform 0.1s",
      ...variants[variant], ...style
    }}>
      {children}
    </button>
  );
}

function Badge({ text, color = T.green, bg }) {
  return (
    <span style={{ fontSize: 11, padding: "3px 9px", borderRadius: 99, background: bg || color + "18", color, fontWeight: 700, letterSpacing: 0.3, whiteSpace: "nowrap" }}>
      {text}
    </span>
  );
}

function Input({ label, value, onChange, placeholder, type = "text", error, required, style }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
      {label && <label style={{ fontSize: 12, fontWeight: 700, color: T.muted, letterSpacing: 0.5 }}>{label}{required && " *"}</label>}
      <input
        type={type} value={value} placeholder={placeholder}
        onChange={e => onChange(e.target.value)}
        style={{
          padding: "11px 14px", borderRadius: 9, fontSize: 13,
          border: `1.5px solid ${error ? T.red : T.border}`,
          outline: "none", width: "100%", boxSizing: "border-box",
          transition: "border-color 0.15s", background: "#fafafa", ...style
        }}
      />
      {error && <span style={{ fontSize: 11, color: T.red }}>{error}</span>}
    </div>
  );
}

function Select({ label, value, onChange, children, style }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
      {label && <label style={{ fontSize: 12, fontWeight: 700, color: T.muted, letterSpacing: 0.5 }}>{label}</label>}
      <select value={value} onChange={e => onChange(e.target.value)} style={{ padding: "11px 14px", borderRadius: 9, border: `1.5px solid ${T.border}`, fontSize: 13, background: "#fafafa", width: "100%", boxSizing: "border-box", ...style }}>
        {children}
      </select>
    </div>
  );
}

function Textarea({ label, value, onChange, placeholder, rows = 3, style }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
      {label && <label style={{ fontSize: 12, fontWeight: 700, color: T.muted, letterSpacing: 0.5 }}>{label}</label>}
      <textarea value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} rows={rows} style={{ padding: "11px 14px", borderRadius: 9, border: `1.5px solid ${T.border}`, fontSize: 13, background: "#fafafa", width: "100%", boxSizing: "border-box", resize: "vertical", ...style }} />
    </div>
  );
}

function PageHeader({ title, subtitle, action }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 20 }}>
      <div>
        <h1 style={{ margin: 0, fontSize: 22, fontWeight: 800, color: T.dark }}>{title}</h1>
        {subtitle && <p style={{ margin: "4px 0 0", fontSize: 13, color: T.muted }}>{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}

function StatCard({ icon, label, value, sub, color = T.green }) {
  return (
    <Card style={{ display: "flex", alignItems: "center", gap: 14 }}>
      <div style={{ width: 48, height: 48, borderRadius: 13, background: color + "15", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22, flexShrink: 0 }}>{icon}</div>
      <div>
        <div style={{ fontSize: 24, fontWeight: 800, color, lineHeight: 1 }}>{value}</div>
        <div style={{ fontSize: 13, fontWeight: 600, color: T.text, marginTop: 3 }}>{label}</div>
        {sub && <div style={{ fontSize: 11, color: T.muted, marginTop: 1 }}>{sub}</div>}
      </div>
    </Card>
  );
}

function EmptyState({ icon, text }) {
  return (
    <div style={{ textAlign: "center", padding: "48px 24px", color: T.muted }}>
      <div style={{ fontSize: 40, marginBottom: 12 }}>{icon}</div>
      <div style={{ fontSize: 14 }}>{text}</div>
    </div>
  );
}

function Avatar({ name = "?", color = T.green, size = 36 }) {
  return (
    <div style={{ width: size, height: size, borderRadius: size / 3, background: color + "22", border: `2px solid ${color}44`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: size * 0.42, fontWeight: 700, color, flexShrink: 0 }}>
      {name.charAt(0).toUpperCase()}
    </div>
  );
}

// Status helpers
const needStatus = (s) => ({
  pending:     { bg: T.gold  + "15", c: T.gold,   l: "Pending"     },
  in_progress: { bg: T.teal  + "15", c: T.teal,   l: "In Progress" },
  resolved:    { bg: T.blue  + "15", c: T.blue,   l: "Resolved"    },
  open:        { bg: T.gold  + "15", c: T.gold,   l: "Open"        },
  done:        { bg: T.teal  + "15", c: T.teal,   l: "Done"        },
}[s] || { bg: "#eee", c: "#666", l: s });

const priColor  = (p) => ({ high: T.red, medium: T.gold, low: T.teal }[p] || "#666");
const sevColor  = (s) => ({ info: T.blue, warning: T.gold, critical: T.red }[s] || "#666");
const sevBg     = (s) => ({ info: T.blue + "10", warning: T.gold + "10", critical: T.red + "10" }[s] || "#eee");
const listColor = (t) => ({
  sell:    { bg: T.teal   + "12", c: T.teal,   l: "For Sale" },
  free:    { bg: T.gold   + "12", c: T.gold,   l: "Free"     },
  request: { bg: T.blue   + "12", c: T.blue,   l: "Wanted"   },
  service: { bg: T.purple + "12", c: T.purple, l: "Service"  },
}[t] || { bg: "#eee", c: "#666", l: t });

const catIcon   = (c) => ({ medical: "🏥", police: "🚔", fire: "🚒", utility: "⚡", community: "👤", other: "📞" }[c] || "📞");
const docIcon   = (c) => ({ health: "🏥", admin: "🏛️", community: "🌍", forms: "📋", other: "📄" }[c] || "📄");

// ─────────────────────────────────────────────────────────────────────────────
// ALERT BANNER
// ─────────────────────────────────────────────────────────────────────────────
function AlertBanner() {
  const [alerts, setA] = useState([]);
  useEffect(() => {
    const load = () => api.alerts().then(a => setA(a || [])).catch(() => {});
    load();
    const t = setInterval(load, 30000);
    return () => clearInterval(t);
  }, []);
  if (!alerts.length) return null;
  return (
    <div>
      {alerts.map(a => (
        <div key={a.id} style={{ background: sevBg(a.severity), borderBottom: `2px solid ${sevColor(a.severity)}`, padding: "10px 20px", display: "flex", gap: 12, alignItems: "center" }}>
          <span style={{ fontSize: 18 }}>{a.severity === "critical" ? "🚨" : a.severity === "warning" ? "⚠️" : "ℹ️"}</span>
          <div>
            <span style={{ fontSize: 14, fontWeight: 700, color: sevColor(a.severity) }}>{a.title}: </span>
            <span style={{ fontSize: 13, color: T.text2 }}>{a.message}</span>
          </div>
        </div>
      ))}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// AUTH SCREEN (LOGIN + SIGNUP)
// ─────────────────────────────────────────────────────────────────────────────
function AuthScreen({ onLogin }) {
  const [tab, setTab]     = useState("login");
  const [loading, setL]   = useState(false);
  const [err, setErr]     = useState("");
  const [success, setOk]  = useState("");

  // Login fields
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");

  // Signup fields
  const [form, setForm] = useState({
    first_name: "", last_name: "", username: "", password: "",
    confirm: "", phone: "", role: "resident", reason: "", umudugudu: "Kacyiru Cell 03",
  });
  const [errors, setErrors] = useState({});

  const setF = (k, v) => { setForm(f => ({ ...f, [k]: v })); setErrors(e => ({ ...e, [k]: "" })); };

  const validateSignup = () => {
    const e = {};
    if (!form.first_name.trim()) e.first_name = "First name is required";
    if (!form.username.trim())   e.username   = "Username is required";
    if (form.password.length < 6) e.password  = "Password must be at least 6 characters";
    if (form.password !== form.confirm) e.confirm = "Passwords do not match";
    if (form.role === "leader" && !form.reason.trim()) e.reason = "Please explain why you want to be a cell leader";
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const login = async () => {
    if (!username || !password) return setErr("Please enter your username and password.");
    setL(true); setErr("");
    try {
      const t = await api.login(username, password);
      api.tok(t.access);
      onLogin(t, await api.me());
    } catch (e) { setErr(e.message.includes("No active account") ? "Invalid username or password." : e.message); }
    finally { setL(false); }
  };

  const signup = async () => {
    if (!validateSignup()) return;
    setL(true); setErr(""); setOk("");
    try {
      const res = await api.signup({ first_name: form.first_name, last_name: form.last_name, username: form.username, password: form.password, phone: form.phone, role: form.role, reason: form.reason, umudugudu: form.umudugudu });
      setOk(res.message);
      if (res.status === "approved") {
        setForm({ first_name:"",last_name:"",username:"",password:"",confirm:"",phone:"",role:"resident",reason:"",umudugudu:"Kacyiru Cell 03" });
        setTimeout(() => { setTab("login"); setOk(""); }, 3000);
      }
    } catch (e) { setErr(e.message); }
    finally { setL(false); }
  };

  return (
    <div style={{ minHeight: "100vh", background: `linear-gradient(145deg, ${T.dark} 0%, ${T.teal} 100%)`, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
      <div style={{ background: T.card, borderRadius: 20, padding: 32, maxWidth: 440, width: "100%", boxShadow: "0 24px 80px rgba(0,0,0,0.3)" }}>

        {/* Logo */}
        <div style={{ textAlign: "center", marginBottom: 24 }}>
          <div style={{ fontSize: 52, marginBottom: 8 }}>🏘️</div>
          <h1 style={{ margin: 0, fontSize: 22, fontWeight: 800, color: T.dark }}>Umudugudu Manager</h1>
          <p style={{ margin: "5px 0 0", fontSize: 13, color: T.muted }}>Kacyiru Cell 03 · Community System</p>
        </div>

        {/* Tab Switcher */}
        <div style={{ display: "flex", marginBottom: 24, background: T.bg, borderRadius: 10, padding: 4 }}>
          {[["login", "Login"], ["signup", "Sign Up"]].map(([t, l]) => (
            <button key={t} onClick={() => { setTab(t); setErr(""); setOk(""); }} style={{ flex: 1, padding: "9px", border: "none", borderRadius: 8, cursor: "pointer", fontWeight: 700, fontSize: 13, background: tab === t ? T.card : "transparent", color: tab === t ? T.green : T.muted, boxShadow: tab === t ? "0 1px 4px rgba(0,0,0,0.1)" : "none", transition: "all 0.2s" }}>
              {l}
            </button>
          ))}
        </div>

        <Alert type="error"   msg={err}     onClose={() => setErr("")} />
        <Alert type="success" msg={success} onClose={() => setOk("")} />

        {/* LOGIN */}
        {tab === "login" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <Input label="Username" value={username} onChange={setUsername} placeholder="Enter your username" />
            <Input label="Password" value={password} onChange={setPassword} placeholder="Enter your password" type="password" />
            <Btn onClick={login} disabled={loading} full size="lg" style={{ marginTop: 4 }}>
              {loading ? "Logging in…" : "Login"}
            </Btn>
            <div style={{ background: T.bg, borderRadius: 10, padding: 14 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: T.muted, marginBottom: 10, letterSpacing: 0.5 }}>DEMO ACCOUNTS</div>
              {[["manzi", "manzi2026", "Super Admin"], ["leader", "leader123", "Cell Leader"], ["uwimana", "resident123", "Resident"]].map(([u, p, role]) => (
                <div key={u} onClick={() => { setUsername(u); setPassword(p); }} style={{ cursor: "pointer", display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 0", borderBottom: `1px solid ${T.border}` }}>
                  <div>
                    <span style={{ fontSize: 13, fontWeight: 700, color: T.green }}>{u}</span>
                    <span style={{ fontSize: 11, color: T.muted, marginLeft: 8 }}>{p}</span>
                  </div>
                  <Badge text={role} color={role === "Super Admin" ? T.purple : role === "Cell Leader" ? T.green : T.blue} />
                </div>
              ))}
              <div style={{ fontSize: 11, color: T.muted, marginTop: 8 }}>↑ Click any row to auto-fill</div>
            </div>
          </div>
        )}

        {/* SIGNUP */}
        {tab === "signup" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <Input label="First Name" value={form.first_name} onChange={v => setF("first_name", v)} placeholder="First name" required error={errors.first_name} />
              <Input label="Last Name"  value={form.last_name}  onChange={v => setF("last_name", v)}  placeholder="Last name" />
            </div>
            <Input label="Username" value={form.username} onChange={v => setF("username", v)} placeholder="Choose a username" required error={errors.username} />
            <Input label="Phone Number" value={form.phone} onChange={v => setF("phone", v)} placeholder="e.g. 078-000-0000" />
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <Input label="Password" value={form.password} onChange={v => setF("password", v)} placeholder="Min 6 characters" type="password" required error={errors.password} />
              <Input label="Confirm Password" value={form.confirm} onChange={v => setF("confirm", v)} placeholder="Repeat password" type="password" error={errors.confirm} />
            </div>

            {/* Role Selector */}
            <div>
              <div style={{ fontSize: 12, fontWeight: 700, color: T.muted, marginBottom: 8, letterSpacing: 0.5 }}>I AM REGISTERING AS</div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                {[["resident", "👥", "Resident", "Instant access"], ["leader", "👤", "Cell Leader", "Requires approval"]].map(([r, icon, label, sub]) => (
                  <div key={r} onClick={() => setF("role", r)} style={{ padding: "12px 14px", borderRadius: 10, border: `2px solid ${form.role === r ? T.green : T.border}`, cursor: "pointer", background: form.role === r ? T.green + "08" : "transparent", transition: "all 0.15s", textAlign: "center" }}>
                    <div style={{ fontSize: 22, marginBottom: 5 }}>{icon}</div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: form.role === r ? T.green : T.text }}>{label}</div>
                    <div style={{ fontSize: 11, color: T.muted, marginTop: 2 }}>{sub}</div>
                  </div>
                ))}
              </div>
            </div>

            {form.role === "leader" && (
              <div style={{ background: T.gold + "08", border: `1px solid ${T.gold}44`, borderRadius: 12, padding: 14 }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: T.gold, marginBottom: 10 }}>⚠ Leader registration requires approval from the system administrator.</div>
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  <Textarea label="Why do you want to be a cell leader?" value={form.reason} onChange={v => setF("reason", v)} placeholder="Describe your experience and motivation..." required />
                  {errors.reason && <span style={{ fontSize: 11, color: T.red }}>{errors.reason}</span>}
                  <Input label="Your Umudugudu" value={form.umudugudu} onChange={v => setF("umudugudu", v)} placeholder="e.g. Kacyiru Cell 03" />
                </div>
              </div>
            )}

            <Btn onClick={signup} disabled={loading} full size="lg" style={{ marginTop: 4 }}>
              {loading ? "Submitting…" : form.role === "leader" ? "Submit Request" : "Create Account"}
            </Btn>
          </div>
        )}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// DASHBOARD / OVERVIEW
// ─────────────────────────────────────────────────────────────────────────────
function Overview() {
  const { profile } = useAuth();
  const [stats, setStats] = useState(null);
  const [loading, setL]   = useState(true);
  const [err, setErr]     = useState("");

  useEffect(() => {
    api.dashboard().then(setStats).catch(e => setErr(e.message)).finally(() => setL(false));
  }, []);

  if (loading) return <Spinner />;
  return (
    <div>
      <PageHeader title="Community Overview" subtitle={`Umudugudu wa Kacyiru — Cell 03`} />
      <Alert type="error" msg={err} onClose={() => setErr("")} />
      {stats && (
        <>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))", gap: 12, marginBottom: 20 }}>
            <StatCard icon="👥" label="Residents"    value={stats.total_residents}  color={T.green} />
            <StatCard icon="🏥" label="Mutuelle"     value={stats.mutuelle_pct + "%"} sub={`${stats.mutuelle_paid}/${stats.total_residents}`} color={T.teal} />
            <StatCard icon="⚠️" label="Pending Needs" value={stats.pending_needs}   color={T.red}  />
            <StatCard icon="🚨" label="Active Alerts" value={stats.active_alerts}   color={stats.active_alerts > 0 ? T.red : T.teal} />
            <StatCard icon="📅" label="Events"       value={stats.upcoming_events}  color={T.gold} />
            <StatCard icon="💬" label="Messages"     value={stats.total_messages}   color={T.blue} />
            {profile?.role === "admin" && stats.pending_requests > 0 && (
              <StatCard icon="🔐" label="Pending Approvals" value={stats.pending_requests} color={T.purple} />
            )}
          </div>

          <Card style={{ marginBottom: 14 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: T.muted, marginBottom: 8, letterSpacing: 0.5 }}>MUTUELLE COVERAGE</div>
            <div style={{ background: T.bg, borderRadius: 99, height: 12, overflow: "hidden", marginBottom: 6 }}>
              <div style={{ background: `linear-gradient(90deg, ${T.teal}, ${T.green})`, height: "100%", width: stats.mutuelle_pct + "%", borderRadius: 99, transition: "width 0.8s ease" }} />
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: T.muted }}>
              <span>{stats.mutuelle_paid} enrolled</span>
              <span>{stats.mutuelle_pct}%</span>
              <span>{stats.mutuelle_unpaid} pending</span>
            </div>
          </Card>

          {stats.next_umuganda && (
            <Card style={{ borderLeft: `4px solid ${T.green}` }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: T.muted, marginBottom: 6, letterSpacing: 0.5 }}>NEXT UMUGANDA</div>
              <div style={{ fontSize: 20, fontWeight: 800, color: T.green }}>{stats.next_umuganda.date}</div>
              <div style={{ fontSize: 14, color: T.text, marginTop: 4 }}>{stats.next_umuganda.activity}</div>
              <div style={{ fontSize: 12, color: T.muted, marginTop: 3 }}>⏰ {stats.next_umuganda.time}</div>
            </Card>
          )}
        </>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// APPROVAL PANEL (Super Admin Only)
// ─────────────────────────────────────────────────────────────────────────────
function ApprovalPanel() {
  const [requests, setR]  = useState([]);
  const [loading, setL]   = useState(true);
  const [err, setErr]     = useState("");
  const [filter, setFilter] = useState("pending");
  const [notes, setNotes] = useState({});
  const [saving, setSaving] = useState(null);

  const load = async () => {
    setL(true);
    try { setR(await api.leaderRequests(filter)); }
    catch (e) { setErr(e.message); }
    finally { setL(false); }
  };
  useEffect(() => { load(); }, [filter]);

  const approve = async (id) => {
    setSaving(id + "_approve");
    try { await api.approveRequest(id, { review_note: notes[id] || "Approved." }); await load(); }
    catch (e) { setErr(e.message); }
    finally { setSaving(null); }
  };

  const reject = async (id) => {
    if (!notes[id]?.trim()) return setErr("Please add a reason for rejection before rejecting.");
    setSaving(id + "_reject");
    try { await api.rejectRequest(id, { review_note: notes[id] }); await load(); }
    catch (e) { setErr(e.message); }
    finally { setSaving(null); }
  };

  const sc = { pending: T.gold, approved: T.teal, rejected: T.red };

  return (
    <div>
      <PageHeader title="Leader Approval Panel" subtitle="Review requests from users who want to become cell leaders" />
      <Alert type="error" msg={err} onClose={() => setErr("")} />

      <div style={{ display: "flex", gap: 8, marginBottom: 20 }}>
        {["pending", "approved", "rejected"].map(s => (
          <button key={s} onClick={() => setFilter(s)} style={{ padding: "7px 16px", borderRadius: 8, border: `1.5px solid ${sc[s]}`, cursor: "pointer", fontWeight: 700, fontSize: 12, textTransform: "capitalize", background: filter === s ? sc[s] : "transparent", color: filter === s ? "#fff" : sc[s], transition: "all 0.15s" }}>
            {s}
          </button>
        ))}
      </div>

      {loading ? <Spinner /> : (
        !requests.length ? <EmptyState icon="🔐" text={`No ${filter} requests`} /> :
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          {requests.map(r => (
            <Card key={r.id} style={{ borderLeft: `4px solid ${sc[r.status]}` }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 10, marginBottom: 12 }}>
                <div>
                  <div style={{ fontSize: 18, fontWeight: 800, color: T.dark }}>{r.full_name}</div>
                  <div style={{ fontSize: 13, color: T.muted, marginTop: 3 }}>@{r.username} · 📞 {r.phone || "Not provided"}</div>
                  <div style={{ fontSize: 13, color: T.muted, marginTop: 2 }}>📍 {r.umudugudu}</div>
                  <div style={{ fontSize: 11, color: T.muted, marginTop: 3 }}>Requested {r.created_at?.slice(0, 10)}</div>
                </div>
                <Badge text={r.status} color={sc[r.status]} />
              </div>

              {r.reason && (
                <div style={{ background: T.bg, borderRadius: 10, padding: "12px 14px", marginBottom: 14 }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: T.muted, marginBottom: 6, letterSpacing: 0.5 }}>REASON</div>
                  <div style={{ fontSize: 13, color: T.text2, lineHeight: 1.6 }}>{r.reason}</div>
                </div>
              )}

              {r.status === "pending" && (
                <div>
                  <Textarea value={notes[r.id] || ""} onChange={v => setNotes(n => ({ ...n, [r.id]: v }))} placeholder="Add a review note (required for rejection)…" rows={2} />
                  <div style={{ display: "flex", gap: 10, marginTop: 12 }}>
                    <Btn onClick={() => approve(r.id)} disabled={saving === r.id + "_approve"} size="sm">
                      {saving === r.id + "_approve" ? "Approving…" : "✓ Approve"}
                    </Btn>
                    <Btn variant="danger" onClick={() => reject(r.id)} disabled={saving === r.id + "_reject"} size="sm">
                      {saving === r.id + "_reject" ? "Rejecting…" : "✗ Reject"}
                    </Btn>
                  </div>
                </div>
              )}

              {r.status !== "pending" && r.review_note && (
                <div style={{ fontSize: 12, color: T.muted, fontStyle: "italic", marginTop: 8 }}>Note: {r.review_note}</div>
              )}
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// ANALYTICS
// ─────────────────────────────────────────────────────────────────────────────
function Analytics() {
  const [data, setD]  = useState(null);
  const [loading, setL] = useState(true);
  const [err, setErr] = useState("");

  useEffect(() => { api.analytics().then(setD).catch(e => setErr(e.message)).finally(() => setL(false)); }, []);
  if (loading) return <Spinner />;

  const Bar = ({ items, labelKey, valueKey, color = T.green, title }) => {
    const max = Math.max(...items.map(i => i[valueKey] || 0), 1);
    return (
      <div>
        <div style={{ fontSize: 11, fontWeight: 700, color: T.muted, marginBottom: 12, letterSpacing: 0.5 }}>{title}</div>
        {items.map((item, i) => (
          <div key={i} style={{ marginBottom: 10 }}>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, marginBottom: 5 }}>
              <span style={{ color: T.text2, textTransform: "capitalize" }}>{String(item[labelKey]).replace(/_/g, " ")}</span>
              <span style={{ fontWeight: 700, color }}>{item[valueKey]}</span>
            </div>
            <div style={{ background: T.bg, borderRadius: 99, height: 8, overflow: "hidden" }}>
              <div style={{ background: color, height: "100%", width: ((item[valueKey] || 0) / max * 100) + "%", borderRadius: 99, transition: "width 0.6s ease" }} />
            </div>
          </div>
        ))}
      </div>
    );
  };

  return (
    <div>
      <PageHeader title="Analytics & Reports" />
      <Alert type="error" msg={err} onClose={() => setErr("")} />
      {data && (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
          <Card><Bar items={data.needs_by_status}   labelKey="status"       valueKey="count" color={T.gold}   title="NEEDS BY STATUS"       /></Card>
          <Card><Bar items={data.needs_by_priority} labelKey="priority"     valueKey="count" color={T.red}    title="NEEDS BY PRIORITY"     /></Card>
          <Card><Bar items={data.tasks_by_status}   labelKey="status"       valueKey="count" color={T.purple} title="TASKS BY STATUS"       /></Card>
          <Card><Bar items={data.market_by_type}    labelKey="listing_type" valueKey="count" color={T.teal}   title="MARKETPLACE LISTINGS"  /></Card>
          <Card style={{ gridColumn: "1/-1" }}>
            <Bar items={data.umuganda_data.map(u => ({ ...u, label: u.activity }))} labelKey="label" valueKey="attended" color={T.green} title="UMUGANDA ATTENDANCE (LAST 5)" />
          </Card>
          <Card style={{ gridColumn: "1/-1" }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: T.muted, marginBottom: 14, letterSpacing: 0.5 }}>MUTUELLE STATUS PER RESIDENT</div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              {data.mutuelle_data.map((r, i) => (
                <div key={i} style={{ padding: "10px 14px", borderRadius: 10, background: r.paid ? T.teal + "10" : T.red + "08", border: `1px solid ${r.paid ? T.teal + "40" : T.red + "30"}` }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: T.text }}>{r.name}</div>
                  <div style={{ fontSize: 11, color: r.paid ? T.teal : T.red, marginTop: 3 }}>{r.paid ? "✓ Paid" : "✗ Unpaid"}</div>
                </div>
              ))}
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// COMMUNITY NEEDS
// ─────────────────────────────────────────────────────────────────────────────
function Needs({ isLeader }) {
  const [needs, setN]     = useState([]);
  const [loading, setL]   = useState(true);
  const [err, setErr]     = useState("");
  const [success, setOk]  = useState("");
  const [showForm, setSF] = useState(false);
  const [saving, setSave] = useState(false);
  const [title, setTitle] = useState("");
  const [desc, setDesc]   = useState("");
  const [priority, setPri]= useState("medium");
  const [filter, setFilt] = useState("");

  const load = useCallback(async () => {
    setL(true);
    try { setN(await api.needs(filter)); }
    catch (e) { setErr(e.message); }
    finally { setL(false); }
  }, [filter]);
  useEffect(() => { load(); }, [load]);

  const save = async () => {
    if (!title.trim()) return setErr("Title is required.");
    setSave(true); setErr("");
    try { await api.addNeed({ title, description: desc, priority }); setTitle(""); setDesc(""); setSF(false); setOk("Need reported successfully!"); setTimeout(() => setOk(""), 3000); await load(); }
    catch (e) { setErr(e.message); }
    finally { setSave(false); }
  };

  const updateStatus = async (id, status) => {
    try { await api.updateNeedStatus(id, { status }); await load(); }
    catch (e) { setErr(e.message); }
  };

  return (
    <div>
      <PageHeader title={isLeader ? "Community Needs" : "My Reported Needs"} subtitle={isLeader ? "Track and manage community issues" : "Report and track issues in your community"} action={<Btn size="sm" onClick={() => setSF(true)}>+ Report Need</Btn>} />
      <Alert type="error"   msg={err}     onClose={() => setErr("")} />
      <Alert type="success" msg={success} onClose={() => setOk("")} />

      {isLeader && (
        <div style={{ display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap" }}>
          {[["", "All"], ["pending", "Pending"], ["in_progress", "In Progress"], ["resolved", "Resolved"]].map(([v, l]) => (
            <button key={v} onClick={() => setFilt(v)} style={{ padding: "6px 14px", borderRadius: 8, border: `1px solid ${filter === v ? T.green : T.border}`, background: filter === v ? T.green : "transparent", color: filter === v ? T.cream : T.muted, fontSize: 12, fontWeight: 700, cursor: "pointer" }}>{l}</button>
          ))}
        </div>
      )}

      {showForm && (
        <Card style={{ marginBottom: 16, border: `2px solid ${T.gold}` }}>
          <div style={{ fontSize: 15, fontWeight: 800, color: T.dark, marginBottom: 16 }}>Report a Community Need</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <Input label="Title" value={title} onChange={setTitle} placeholder="Describe the issue briefly" required />
            <Textarea label="Details (optional)" value={desc} onChange={setDesc} placeholder="Provide more details about the issue…" rows={2} />
            <div>
              <div style={{ fontSize: 12, fontWeight: 700, color: T.muted, marginBottom: 8, letterSpacing: 0.5 }}>PRIORITY</div>
              <div style={{ display: "flex", gap: 8 }}>
                {["low", "medium", "high"].map(p => (
                  <button key={p} onClick={() => setPri(p)} style={{ flex: 1, padding: "8px", borderRadius: 8, border: `1.5px solid ${priority === p ? priColor(p) : T.border}`, background: priority === p ? priColor(p) + "12" : "transparent", color: priority === p ? priColor(p) : T.muted, fontSize: 12, fontWeight: 700, cursor: "pointer", textTransform: "capitalize" }}>{p}</button>
                ))}
              </div>
            </div>
            <div style={{ display: "flex", gap: 10 }}>
              <Btn onClick={save} disabled={saving}>{saving ? "Saving…" : "Submit Need"}</Btn>
              <Btn variant="ghost" onClick={() => setSF(false)}>Cancel</Btn>
            </div>
          </div>
        </Card>
      )}

      {loading ? <Spinner /> : (
        !needs.length ? <EmptyState icon="✅" text="No needs found" /> :
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {needs.map(n => {
            const s = needStatus(n.status);
            return (
              <Card key={n.id}>
                <div style={{ display: "flex", gap: 14, alignItems: "flex-start" }}>
                  <div style={{ width: 4, borderRadius: 99, alignSelf: "stretch", background: priColor(n.priority), flexShrink: 0 }} />
                  <div style={{ flex: 1 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 8, marginBottom: 6 }}>
                      <div>
                        <div style={{ fontSize: 15, fontWeight: 700, color: T.text }}>{n.title}</div>
                        {n.description && <div style={{ fontSize: 12, color: T.muted, marginTop: 3 }}>{n.description}</div>}
                        <div style={{ fontSize: 11, color: T.muted, marginTop: 4 }}>By {n.submitted_by?.full_name} · {n.created_at?.slice(0, 10)}</div>
                      </div>
                      <div style={{ display: "flex", gap: 6 }}>
                        <Badge text={n.priority?.toUpperCase()} color={priColor(n.priority)} />
                        <Badge text={s.l} color={s.c} bg={s.bg} />
                      </div>
                    </div>
                    {n.admin_note && <div style={{ fontSize: 12, color: T.teal, fontStyle: "italic", marginBottom: 8 }}>Leader note: {n.admin_note}</div>}
                    {isLeader && (
                      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 8, paddingTop: 8, borderTop: `1px solid ${T.border}` }}>
                        <span style={{ fontSize: 11, color: T.muted, marginRight: 4, alignSelf: "center" }}>Status:</span>
                        {["pending", "in_progress", "resolved"].map(st => {
                          const ms = needStatus(st);
                          return (
                            <button key={st} onClick={() => updateStatus(n.id, st)} style={{ fontSize: 11, padding: "4px 10px", borderRadius: 6, cursor: "pointer", fontWeight: 700, border: `1px solid ${n.status === st ? ms.c : T.border}`, background: n.status === st ? ms.bg : "transparent", color: n.status === st ? ms.c : T.muted }}>
                              {ms.l}
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// MUTUELLE
// ─────────────────────────────────────────────────────────────────────────────
function Mutuelle() {
  const [residents, setR] = useState([]);
  const [loading, setL]   = useState(true);
  const [err, setErr]     = useState("");
  const [success, setOk]  = useState("");

  const load = async () => { setL(true); try { setR(await api.residents()); } catch (e) { setErr(e.message); } finally { setL(false); } };
  useEffect(() => { load(); }, []);

  const toggle = async (id) => {
    try { await api.toggleMutuelle(id); setOk("Status updated!"); setTimeout(() => setOk(""), 2000); await load(); }
    catch (e) { setErr(e.message); }
  };

  const paid = residents.filter(r => r.mutuelle_paid).length;
  const pct  = residents.length ? Math.round(paid / residents.length * 100) : 0;

  return (
    <div>
      <PageHeader title="Mutuelle de Santé" subtitle="Track health insurance enrollment for all residents" />
      <Alert type="error"   msg={err}     onClose={() => setErr("")} />
      <Alert type="success" msg={success} onClose={() => setOk("")} />

      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12, marginBottom: 18 }}>
        <StatCard icon="✅" label="Enrolled"     value={paid}              color={T.teal}  />
        <StatCard icon="❌" label="Not Enrolled"  value={residents.length - paid} color={T.red}   />
        <StatCard icon="📊" label="Coverage"     value={pct + "%"}         color={T.gold}  />
      </div>

      <Card style={{ marginBottom: 16 }}>
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: T.muted, marginBottom: 8 }}><span>Enrollment Progress</span><span>{paid}/{residents.length}</span></div>
        <div style={{ background: T.bg, borderRadius: 99, height: 12, overflow: "hidden" }}>
          <div style={{ background: `linear-gradient(90deg, ${T.teal}, ${T.green})`, height: "100%", width: pct + "%", borderRadius: 99, transition: "width 0.8s ease" }} />
        </div>
      </Card>

      {loading ? <Spinner /> : (
        <Card>
          {residents.map((r, i) => (
            <div key={r.id} style={{ display: "flex", alignItems: "center", gap: 14, padding: "14px 0", borderBottom: i < residents.length - 1 ? `1px solid ${T.border}` : "none" }}>
              <Avatar name={r.full_name} color={r.avatar_color || T.green} />
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 14, fontWeight: 700, color: T.text }}>{r.full_name}</div>
                <div style={{ fontSize: 12, color: T.muted, marginTop: 2 }}>{r.phone}</div>
              </div>
              <Badge text={r.mutuelle_paid ? "✓ Paid" : "✗ Unpaid"} color={r.mutuelle_paid ? T.teal : T.red} />
              <button onClick={() => toggle(r.id)} style={{ fontSize: 12, padding: "6px 14px", borderRadius: 8, cursor: "pointer", border: `1.5px solid ${r.mutuelle_paid ? T.red : T.teal}`, color: r.mutuelle_paid ? T.red : T.teal, background: "transparent", fontWeight: 700 }}>
                {r.mutuelle_paid ? "Mark Unpaid" : "Mark Paid"}
              </button>
            </div>
          ))}
        </Card>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// UMUGANDA
// ─────────────────────────────────────────────────────────────────────────────
function Umuganda({ isLeader, profile }) {
  const [sessions, setS]  = useState([]);
  const [residents, setR] = useState([]);
  const [loading, setL]   = useState(true);
  const [err, setErr]     = useState("");
  const [adding, setAdd]  = useState(false);
  const [expanded, setExp]= useState(null);
  const [saving, setSave] = useState(false);
  const [form, setForm]   = useState({ date: "", time: "07:00", activity: "", location: "" });

  const load = async () => {
    setL(true);
    try {
      const [s, r] = await Promise.all([api.umuganda(), isLeader ? api.residents() : Promise.resolve([])]);
      setS(s); setR(r);
    } catch (e) { setErr(e.message); }
    finally { setL(false); }
  };
  useEffect(() => { load(); }, []);

  const save = async () => {
    if (!form.date || !form.activity) return setErr("Date and activity are required.");
    setSave(true);
    try { await api.addUmuganda(form); setAdd(false); setForm({ date: "", time: "07:00", activity: "", location: "" }); await load(); }
    catch (e) { setErr(e.message); }
    finally { setSave(false); }
  };

  const toggleAtt = async (sid, rid) => {
    try { const res = await api.toggleAttendance(sid, rid); setS(prev => prev.map(s => s.id === sid ? res.session : s)); }
    catch (e) { setErr(e.message); }
  };

  return (
    <div>
      <PageHeader title="Umuganda" subtitle="Monthly community work sessions" action={isLeader ? <Btn size="sm" onClick={() => setAdd(true)}>+ Schedule</Btn> : null} />
      <Alert type="error" msg={err} onClose={() => setErr("")} />

      {!isLeader && (
        <Card style={{ marginBottom: 16, background: T.green + "08", border: `1px solid ${T.green}22` }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: T.muted, letterSpacing: 0.5 }}>YOUR ATTENDANCE RECORD</div>
          <div style={{ fontSize: 28, fontWeight: 800, color: T.green, marginTop: 6 }}>{profile?.umuganda_count} sessions</div>
          <div style={{ fontSize: 12, color: T.muted }}>out of {sessions.length} total sessions</div>
        </Card>
      )}

      {adding && (
        <Card style={{ marginBottom: 16, border: `2px solid ${T.gold}` }}>
          <div style={{ fontSize: 15, fontWeight: 800, color: T.dark, marginBottom: 16 }}>Schedule New Session</div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 12 }}>
            <Input label="Date" type="date" value={form.date} onChange={v => setForm(f => ({ ...f, date: v }))} required />
            <Input label="Time" value={form.time} onChange={v => setForm(f => ({ ...f, time: v }))} placeholder="07:00" />
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 12, marginBottom: 14 }}>
            <Input label="Activity" value={form.activity} onChange={v => setForm(f => ({ ...f, activity: v }))} placeholder="e.g. Road cleaning - Sector B" required />
            <Input label="Location (optional)" value={form.location} onChange={v => setForm(f => ({ ...f, location: v }))} placeholder="e.g. Sector B main road" />
          </div>
          <div style={{ display: "flex", gap: 10 }}>
            <Btn onClick={save} disabled={saving}>{saving ? "Saving…" : "Schedule"}</Btn>
            <Btn variant="ghost" onClick={() => setAdd(false)}>Cancel</Btn>
          </div>
        </Card>
      )}

      {loading ? <Spinner /> : (
        !sessions.length ? <EmptyState icon="🌿" text="No umuganda sessions yet" /> :
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {sessions.map(u => {
            const attIds = u.attendances?.map(a => a.resident?.id) || [];
            const myAtt  = attIds.includes(profile?.id);
            const isOpen = expanded === u.id;
            return (
              <Card key={u.id}>
                <div style={{ display: "flex", gap: 14, alignItems: "flex-start" }}>
                  {!isLeader && (
                    <div style={{ width: 44, height: 44, borderRadius: 12, background: myAtt ? T.teal + "15" : T.red + "10", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22, flexShrink: 0 }}>
                      {myAtt ? "✅" : "❌"}
                    </div>
                  )}
                  <div style={{ flex: 1 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 8 }}>
                      <div>
                        <div style={{ fontSize: 14, fontWeight: 800, color: T.green }}>{u.date}</div>
                        <div style={{ fontSize: 16, fontWeight: 700, color: T.text, marginTop: 3 }}>{u.activity}</div>
                        <div style={{ fontSize: 12, color: T.muted, marginTop: 3 }}>
                          ⏰ {u.time}{u.location ? ` · 📍 ${u.location}` : ""} · 👥 {u.attendance_count}/{isLeader ? residents.length : "?"} attended
                        </div>
                      </div>
                      {isLeader && (
                        <button onClick={() => setExp(isOpen ? null : u.id)} style={{ padding: "6px 14px", borderRadius: 8, border: `1.5px solid ${T.green}`, background: "transparent", color: T.green, fontSize: 12, fontWeight: 700, cursor: "pointer" }}>
                          {isOpen ? "Close" : "Attendance"}
                        </button>
                      )}
                    </div>

                    {isOpen && isLeader && (
                      <div style={{ marginTop: 14, paddingTop: 14, borderTop: `1px solid ${T.border}` }}>
                        <div style={{ fontSize: 11, fontWeight: 700, color: T.muted, marginBottom: 10, letterSpacing: 0.5 }}>MARK ATTENDANCE</div>
                        <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                          {residents.map(r => {
                            const att = attIds.includes(r.id);
                            return (
                              <button key={r.id} onClick={() => toggleAtt(u.id, r.id)} style={{ padding: "7px 14px", borderRadius: 8, border: `1.5px solid ${att ? T.teal : T.border}`, background: att ? T.teal + "12" : "transparent", color: att ? T.teal : T.muted, fontSize: 12, fontWeight: 600, cursor: "pointer", transition: "all 0.15s" }}>
                                {att ? "✓ " : ""}{r.full_name?.split(" ")[0]}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// ANNOUNCEMENTS
// ─────────────────────────────────────────────────────────────────────────────
function Announcements({ isLeader }) {
  const [items, setI]    = useState([]);
  const [loading, setL]  = useState(true);
  const [err, setErr]    = useState("");
  const [success, setOk] = useState("");
  const [showForm, setSF]= useState(false);
  const [title, setT]    = useState("");
  const [body, setB]     = useState("");
  const [saving, setSave]= useState(false);

  const load = async () => { setL(true); try { setI(await api.announcements()); } catch (e) { setErr(e.message); } finally { setL(false); } };
  useEffect(() => { load(); }, []);

  const post = async () => {
    if (!title.trim() || !body.trim()) return setErr("Title and message are required.");
    setSave(true);
    try { await api.addAnnouncement({ title, body }); setT(""); setB(""); setSF(false); setOk("Announcement posted!"); setTimeout(() => setOk(""), 3000); await load(); }
    catch (e) { setErr(e.message); }
    finally { setSave(false); }
  };

  const del = async (id) => {
    if (!window.confirm("Delete this announcement?")) return;
    try { await api.delAnnouncement(id); await load(); }
    catch (e) { setErr(e.message); }
  };

  return (
    <div>
      <PageHeader title="Announcements" subtitle="Community messages from the cell leader" action={isLeader ? <Btn size="sm" onClick={() => setSF(true)}>+ Post</Btn> : null} />
      <Alert type="error"   msg={err}     onClose={() => setErr("")} />
      <Alert type="success" msg={success} onClose={() => setOk("")} />

      {showForm && (
        <Card style={{ marginBottom: 16, border: `2px solid ${T.gold}` }}>
          <div style={{ fontSize: 15, fontWeight: 800, color: T.dark, marginBottom: 16 }}>New Announcement</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 12, marginBottom: 14 }}>
            <Input label="Title" value={title} onChange={setT} placeholder="Announcement title" required />
            <Textarea label="Message" value={body} onChange={setB} placeholder="Write your message to residents…" rows={4} />
          </div>
          <div style={{ display: "flex", gap: 10 }}>
            <Btn onClick={post} disabled={saving}>{saving ? "Posting…" : "Post Announcement"}</Btn>
            <Btn variant="ghost" onClick={() => setSF(false)}>Cancel</Btn>
          </div>
        </Card>
      )}

      {loading ? <Spinner /> : (
        !items.length ? <EmptyState icon="📢" text="No announcements yet" /> :
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {items.map(a => (
            <Card key={a.id} style={{ borderLeft: `4px solid ${T.gold}` }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8 }}>
                <div style={{ fontSize: 16, fontWeight: 800, color: T.dark, flex: 1 }}>{a.title}</div>
                <div style={{ display: "flex", gap: 10, alignItems: "center", marginLeft: 14, flexShrink: 0 }}>
                  <span style={{ fontSize: 11, color: T.muted }}>{a.created_at?.slice(0, 10)}</span>
                  {isLeader && <button onClick={() => del(a.id)} style={{ background: "none", border: "none", cursor: "pointer", color: T.red, fontSize: 16, padding: 0 }}>🗑</button>}
                </div>
              </div>
              <div style={{ fontSize: 13, color: T.text2, lineHeight: 1.7 }}>{a.body}</div>
              <div style={{ fontSize: 11, color: T.muted, marginTop: 10 }}>— {a.posted_by?.full_name}</div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// CHAT ROOMS
// ─────────────────────────────────────────────────────────────────────────────
function Chat({ isLeader, profile }) {
  const [rooms, setRooms] = useState([]);
  const [active, setAct]  = useState(null);
  const [msgs, setMsgs]   = useState([]);
  const [input, setInput] = useState("");
  const [loading, setL]   = useState(true);
  const [sending, setSend]= useState(false);
  const [err, setErr]     = useState("");
  const bottomRef = useRef(null);
  const pollRef   = useRef(null);

  useEffect(() => {
    api.chatRooms().then(r => { setRooms(r); setL(false); }).catch(e => { setErr(e.message); setL(false); });
  }, []);

  const loadMsgs = useCallback(async (id) => {
    if (!id) return;
    try { setMsgs(await api.chatMsgs(id)); } catch (e) { setErr(e.message); }
  }, []);

  useEffect(() => {
    if (active) {
      loadMsgs(active.id);
      clearInterval(pollRef.current);
      pollRef.current = setInterval(() => loadMsgs(active.id), 4000);
    }
    return () => clearInterval(pollRef.current);
  }, [active, loadMsgs]);

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth" }); }, [msgs]);

  const send = async () => {
    if (!input.trim() || !active) return;
    setSend(true);
    try { const m = await api.sendMsg(active.id, input); setMsgs(p => [...p, m]); setInput(""); api.chatRooms().then(setRooms).catch(() => {}); }
    catch (e) { setErr(e.message); }
    finally { setSend(false); }
  };

  const canSend = active?.room_type !== "broadcast" || isLeader;
  if (loading) return <Spinner />;

  return (
    <div>
      <PageHeader title="Community Chat" subtitle="Stay connected with your community" />
      <div style={{ display: "flex", gap: 14, height: "65vh", minHeight: 380 }}>
        {/* Room list */}
        <div style={{ width: 200, flexShrink: 0, display: "flex", flexDirection: "column", gap: 6 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: T.muted, letterSpacing: 0.5, marginBottom: 4 }}>ROOMS</div>
          {rooms.map(r => (
            <div key={r.id} onClick={() => setAct(r)} style={{ padding: "12px 14px", borderRadius: 12, cursor: "pointer", background: active?.id === r.id ? T.green : T.card, border: `1px solid ${active?.id === r.id ? T.green : T.border}`, transition: "all 0.15s" }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: active?.id === r.id ? T.cream : T.text }}>{r.name}</div>
              <div style={{ fontSize: 10, color: active?.id === r.id ? T.cream + "80" : T.muted, marginTop: 2 }}>
                {r.room_type === "broadcast" ? "📢" : "🌍"} {r.room_type}
              </div>
              {r.last_message && (
                <div style={{ fontSize: 11, color: active?.id === r.id ? T.cream + "70" : T.muted, marginTop: 5, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {r.last_message.message}
                </div>
              )}
            </div>
          ))}
          {!rooms.length && <div style={{ fontSize: 12, color: T.muted }}>No rooms available.</div>}
        </div>

        {/* Message pane */}
        <div style={{ flex: 1, display: "flex", flexDirection: "column", background: T.card, borderRadius: 14, overflow: "hidden", border: `1px solid ${T.border}` }}>
          {!active ? (
            <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center" }}>
              <EmptyState icon="💬" text="Select a room to start chatting" />
            </div>
          ) : (
            <>
              <div style={{ padding: "14px 18px", background: T.green, color: T.cream }}>
                <div style={{ fontSize: 15, fontWeight: 800 }}>{active.name}</div>
                <div style={{ fontSize: 12, opacity: 0.75 }}>{active.description}</div>
              </div>
              <Alert type="error" msg={err} onClose={() => setErr("")} />
              <div style={{ flex: 1, overflowY: "auto", padding: "14px 16px", display: "flex", flexDirection: "column", gap: 10 }}>
                {msgs.map(m => {
                  const mine = m.sender?.id === profile?.id;
                  return (
                    <div key={m.id} style={{ display: "flex", justifyContent: mine ? "flex-end" : "flex-start" }}>
                      <div style={{ maxWidth: "72%" }}>
                        {!mine && <div style={{ fontSize: 11, fontWeight: 700, color: T.green, marginBottom: 4 }}>{m.sender?.full_name}</div>}
                        <div style={{ background: mine ? T.green : T.bg, color: mine ? T.cream : T.text, padding: "10px 14px", borderRadius: mine ? "14px 14px 4px 14px" : "14px 14px 14px 4px", fontSize: 13, lineHeight: 1.5 }}>
                          {m.message}
                        </div>
                        <div style={{ fontSize: 10, color: T.muted, marginTop: 4, textAlign: mine ? "right" : "left" }}>
                          {new Date(m.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                        </div>
                      </div>
                    </div>
                  );
                })}
                <div ref={bottomRef} />
              </div>
              <div style={{ padding: "12px 14px", borderTop: `1px solid ${T.border}`, display: "flex", gap: 10, alignItems: "center" }}>
                {canSend ? (
                  <>
                    <input value={input} onChange={e => setInput(e.target.value)} onKeyDown={e => e.key === "Enter" && !e.shiftKey && send()} placeholder="Type a message…" style={{ flex: 1, padding: "10px 14px", borderRadius: 10, border: `1.5px solid ${T.border}`, fontSize: 13, outline: "none" }} />
                    <Btn onClick={send} disabled={sending || !input.trim()} size="sm">{sending ? "…" : "Send"}</Btn>
                  </>
                ) : (
                  <div style={{ flex: 1, fontSize: 12, color: T.muted, fontStyle: "italic", padding: "8px 4px" }}>This is a broadcast channel — only the leader can post here.</div>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// DIRECT MESSAGES
// ─────────────────────────────────────────────────────────────────────────────
function DMs({ profile, isLeader }) {
  const [convos, setC]   = useState([]);
  const [residents, setR]= useState([]);
  const [active, setAct] = useState(null);
  const [thread, setT]   = useState([]);
  const [input, setInput]= useState("");
  const [loading, setL]  = useState(true);
  const [sending, setSend]= useState(false);
  const [err, setErr]    = useState("");
  const bottomRef = useRef(null);

  useEffect(() => {
    Promise.all([api.dmList(), api.residents()])
      .then(([c, r]) => { setC(c); setR(r); })
      .catch(e => setErr(e.message))
      .finally(() => setL(false));
  }, []);

  const openThread = useCallback(async (pid) => {
    if (!pid) return;
    try { setT(await api.dmThread(pid)); } catch (e) { setErr(e.message); }
  }, []);

  useEffect(() => { if (active?.id) openThread(active.id); }, [active, openThread]);
  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth" }); }, [thread]);

  const send = async () => {
    if (!input.trim() || !active?.id) return;
    setSend(true);
    try { await api.sendDM(active.id, input); setInput(""); await openThread(active.id); api.dmList().then(setC).catch(() => {}); }
    catch (e) { setErr(e.message); }
    finally { setSend(false); }
  };

  const leader      = residents.find(r => r.role === "leader");
  const newPartners = residents.filter(r => r.id !== profile?.id && !convos.find(c => c.partner?.id === r.id));

  if (loading) return <Spinner />;

  return (
    <div>
      <PageHeader title="Direct Messages" subtitle="Private conversations" />
      <div style={{ display: "flex", gap: 14, height: "65vh", minHeight: 380 }}>
        {/* Conversation list */}
        <div style={{ width: 200, flexShrink: 0, display: "flex", flexDirection: "column", gap: 6 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: T.muted, letterSpacing: 0.5, marginBottom: 4 }}>CONVERSATIONS</div>

          {convos.map(c => (
            <div key={c.partner?.id} onClick={() => setAct(c.partner)} style={{ padding: "12px 14px", borderRadius: 12, cursor: "pointer", background: active?.id === c.partner?.id ? T.green : T.card, border: `1px solid ${active?.id === c.partner?.id ? T.green : T.border}`, transition: "all 0.15s" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ fontSize: 13, fontWeight: 700, color: active?.id === c.partner?.id ? T.cream : T.text }}>{c.partner?.full_name}</span>
                {c.unread > 0 && <span style={{ background: T.red, color: "#fff", borderRadius: 99, fontSize: 10, padding: "1px 6px", fontWeight: 800 }}>{c.unread}</span>}
              </div>
              {c.last_message && (
                <div style={{ fontSize: 11, color: active?.id === c.partner?.id ? T.cream + "70" : T.muted, marginTop: 4, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {c.last_message.message}
                </div>
              )}
            </div>
          ))}

          {/* New conversation buttons */}
          {isLeader && newPartners.filter(r => r.role !== "leader" && r.role !== "admin").map(r => (
            <div key={r.id} onClick={() => setAct(r)} style={{ padding: "10px 14px", borderRadius: 12, cursor: "pointer", fontSize: 12, color: T.green, fontWeight: 600, background: T.card, border: `1px dashed ${T.green}60` }}>
              + {r.full_name?.split(" ")[0]}
            </div>
          ))}

          {!isLeader && leader && !convos.find(c => c.partner?.id === leader.id) && (
            <div onClick={() => setAct(leader)} style={{ padding: "12px 14px", borderRadius: 12, cursor: "pointer", background: T.green + "08", border: `1.5px solid ${T.green}`, display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ fontSize: 18 }}>💬</span>
              <div>
                <div style={{ fontSize: 13, fontWeight: 700, color: T.green }}>Message Cell Leader</div>
                <div style={{ fontSize: 11, color: T.muted }}>Start a conversation</div>
              </div>
            </div>
          )}
        </div>

        {/* Thread pane */}
        <div style={{ flex: 1, display: "flex", flexDirection: "column", background: T.card, borderRadius: 14, overflow: "hidden", border: `1px solid ${T.border}` }}>
          {!active ? (
            <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center" }}>
              <EmptyState icon="📩" text="Select a conversation to start messaging" />
            </div>
          ) : (
            <>
              <div style={{ padding: "14px 18px", background: T.green, color: T.cream, display: "flex", alignItems: "center", gap: 12 }}>
                <Avatar name={active.full_name} color={active.avatar_color || "#fff"} size={36} />
                <div style={{ fontSize: 15, fontWeight: 800 }}>{active.full_name}</div>
              </div>
              <Alert type="error" msg={err} onClose={() => setErr("")} />
              <div style={{ flex: 1, overflowY: "auto", padding: "14px 16px", display: "flex", flexDirection: "column", gap: 10 }}>
                {thread.map(m => {
                  const mine = m.sender?.id === profile?.id;
                  return (
                    <div key={m.id} style={{ display: "flex", justifyContent: mine ? "flex-end" : "flex-start" }}>
                      <div style={{ maxWidth: "72%" }}>
                        <div style={{ background: mine ? T.green : T.bg, color: mine ? T.cream : T.text, padding: "10px 14px", borderRadius: mine ? "14px 14px 4px 14px" : "14px 14px 14px 4px", fontSize: 13, lineHeight: 1.5 }}>
                          {m.message}
                        </div>
                        <div style={{ fontSize: 10, color: T.muted, marginTop: 4, textAlign: mine ? "right" : "left" }}>
                          {new Date(m.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                        </div>
                      </div>
                    </div>
                  );
                })}
                {!thread.length && <EmptyState icon="💬" text="No messages yet. Say hello!" />}
                <div ref={bottomRef} />
              </div>
              <div style={{ padding: "12px 14px", borderTop: `1px solid ${T.border}`, display: "flex", gap: 10 }}>
                <input value={input} onChange={e => setInput(e.target.value)} onKeyDown={e => e.key === "Enter" && send()} placeholder="Type a message…" style={{ flex: 1, padding: "10px 14px", borderRadius: 10, border: `1.5px solid ${T.border}`, fontSize: 13, outline: "none" }} />
                <Btn onClick={send} disabled={sending || !input.trim()} size="sm">{sending ? "…" : "Send"}</Btn>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// EVENTS
// ─────────────────────────────────────────────────────────────────────────────
function Events({ isLeader, profile }) {
  const [events, setE]   = useState([]);
  const [loading, setL]  = useState(true);
  const [err, setErr]    = useState("");
  const [success, setOk] = useState("");
  const [adding, setAdd] = useState(false);
  const [saving, setSave]= useState(false);
  const [form, setForm]  = useState({ title: "", description: "", date: "", time: "09:00", location: "" });

  const load = async () => { setL(true); try { setE(await api.events()); } catch (e) { setErr(e.message); } finally { setL(false); } };
  useEffect(() => { load(); }, []);

  const save = async () => {
    if (!form.title || !form.date) return setErr("Title and date are required.");
    setSave(true);
    try { await api.addEvent(form); setAdd(false); setForm({ title: "", description: "", date: "", time: "09:00", location: "" }); setOk("Event created!"); setTimeout(() => setOk(""), 3000); await load(); }
    catch (e) { setErr(e.message); }
    finally { setSave(false); }
  };

  const rsvp = async (id) => {
    try { const r = await api.rsvp(id); setE(prev => prev.map(e => e.id === id ? r.event : e)); setOk("RSVP updated!"); setTimeout(() => setOk(""), 2000); }
    catch (e) { setErr(e.message); }
  };

  return (
    <div>
      <PageHeader title="Community Events" subtitle="Upcoming events and activities" action={isLeader ? <Btn size="sm" onClick={() => setAdd(true)}>+ Create Event</Btn> : null} />
      <Alert type="error"   msg={err}     onClose={() => setErr("")} />
      <Alert type="success" msg={success} onClose={() => setOk("")} />

      {adding && (
        <Card style={{ marginBottom: 16, border: `2px solid ${T.gold}` }}>
          <div style={{ fontSize: 15, fontWeight: 800, color: T.dark, marginBottom: 16 }}>Create New Event</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 12, marginBottom: 14 }}>
            <Input label="Event Title" value={form.title} onChange={v => setForm(f => ({ ...f, title: v }))} placeholder="e.g. Community Health Day" required />
            <Textarea label="Description" value={form.description} onChange={v => setForm(f => ({ ...f, description: v }))} placeholder="Describe the event…" rows={2} />
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <Input label="Date" type="date" value={form.date} onChange={v => setForm(f => ({ ...f, date: v }))} required />
              <Input label="Time" value={form.time} onChange={v => setForm(f => ({ ...f, time: v }))} placeholder="09:00" />
            </div>
            <Input label="Location" value={form.location} onChange={v => setForm(f => ({ ...f, location: v }))} placeholder="e.g. Sector Health Center" />
          </div>
          <div style={{ display: "flex", gap: 10 }}>
            <Btn onClick={save} disabled={saving}>{saving ? "Creating…" : "Create Event"}</Btn>
            <Btn variant="ghost" onClick={() => setAdd(false)}>Cancel</Btn>
          </div>
        </Card>
      )}

      {loading ? <Spinner /> : (
        !events.length ? <EmptyState icon="📅" text="No events scheduled yet" /> :
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {events.map(ev => {
            const attending = ev.attendees?.some(a => a.id === profile?.id);
            const past = new Date(ev.date) < new Date();
            return (
              <Card key={ev.id} style={{ borderLeft: `4px solid ${past ? T.muted : T.gold}` }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 12 }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 16, fontWeight: 800, color: T.dark }}>{ev.title}</div>
                    <div style={{ display: "flex", gap: 14, fontSize: 12, color: T.muted, marginTop: 6, flexWrap: "wrap" }}>
                      <span>📅 {ev.date}</span>
                      <span>⏰ {ev.time}</span>
                      {ev.location && <span>📍 {ev.location}</span>}
                      <span>👥 {ev.attendee_count} attending</span>
                    </div>
                    {ev.description && <div style={{ fontSize: 13, color: T.text2, marginTop: 8, lineHeight: 1.6 }}>{ev.description}</div>}
                  </div>
                  {!past && (
                    <button onClick={() => rsvp(ev.id)} style={{ padding: "9px 18px", borderRadius: 10, border: `1.5px solid ${attending ? T.red : T.teal}`, background: attending ? T.red + "10" : T.teal + "10", color: attending ? T.red : T.teal, fontSize: 13, fontWeight: 700, cursor: "pointer", flexShrink: 0, whiteSpace: "nowrap" }}>
                      {attending ? "Cancel RSVP" : "RSVP →"}
                    </button>
                  )}
                </div>
                {ev.attendees?.length > 0 && (
                  <div style={{ marginTop: 12, paddingTop: 12, borderTop: `1px solid ${T.border}` }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: T.muted, marginBottom: 8, letterSpacing: 0.5 }}>ATTENDING</div>
                    <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                      {ev.attendees.map(a => <Badge key={a.id} text={a.full_name} color={T.teal} />)}
                    </div>
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// POLLS
// ─────────────────────────────────────────────────────────────────────────────
function Polls({ isLeader }) {
  const [polls, setP]    = useState([]);
  const [loading, setL]  = useState(true);
  const [err, setErr]    = useState("");
  const [adding, setAdd] = useState(false);
  const [saving, setSave]= useState(false);
  const [question, setQ] = useState("");
  const [desc, setDesc]  = useState("");
  const [options, setOpts]= useState(["", ""]);

  const load = async () => { setL(true); try { setP(await api.polls()); } catch (e) { setErr(e.message); } finally { setL(false); } };
  useEffect(() => { load(); }, []);

  const save = async () => {
    const opts = options.filter(o => o.trim());
    if (!question.trim() || opts.length < 2) return setErr("Question and at least 2 options are required.");
    setSave(true);
    try { await api.addPoll({ question, description: desc, options: opts }); setQ(""); setDesc(""); setOpts(["", ""]); setAdd(false); await load(); }
    catch (e) { setErr(e.message); }
    finally { setSave(false); }
  };

  const vote = async (pid, oid) => {
    try { const u = await api.vote(pid, oid); setP(prev => prev.map(p => p.id === pid ? u : p)); }
    catch (e) { setErr(e.message); }
  };

  const close = async (id) => {
    try { const u = await api.closePoll(id); setP(prev => prev.map(p => p.id === id ? u : p)); }
    catch (e) { setErr(e.message); }
  };

  return (
    <div>
      <PageHeader title="Community Polls" subtitle="Vote on community decisions" action={isLeader ? <Btn size="sm" onClick={() => setAdd(true)}>+ Create Poll</Btn> : null} />
      <Alert type="error" msg={err} onClose={() => setErr("")} />

      {adding && (
        <Card style={{ marginBottom: 16, border: `2px solid ${T.gold}` }}>
          <div style={{ fontSize: 15, fontWeight: 800, color: T.dark, marginBottom: 16 }}>New Community Poll</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 12, marginBottom: 14 }}>
            <Input label="Question" value={question} onChange={setQ} placeholder="What do you want to ask the community?" required />
            <Textarea label="Description (optional)" value={desc} onChange={setDesc} placeholder="Add more context…" rows={2} />
            <div>
              <div style={{ fontSize: 12, fontWeight: 700, color: T.muted, marginBottom: 8, letterSpacing: 0.5 }}>OPTIONS (minimum 2)</div>
              {options.map((o, i) => (
                <div key={i} style={{ display: "flex", gap: 8, marginBottom: 8 }}>
                  <input value={o} onChange={e => { const n = [...options]; n[i] = e.target.value; setOpts(n); }} placeholder={`Option ${i + 1}`} style={{ flex: 1, padding: "10px 14px", borderRadius: 9, border: `1.5px solid ${T.border}`, fontSize: 13, outline: "none" }} />
                  {options.length > 2 && <button onClick={() => setOpts(options.filter((_, j) => j !== i))} style={{ background: "none", border: "none", color: T.red, cursor: "pointer", fontSize: 18, padding: "0 4px" }}>×</button>}
                </div>
              ))}
              <button onClick={() => setOpts([...options, ""])} style={{ fontSize: 12, color: T.teal, background: "none", border: "none", cursor: "pointer", fontWeight: 700, padding: "4px 0" }}>+ Add Option</button>
            </div>
          </div>
          <div style={{ display: "flex", gap: 10 }}>
            <Btn onClick={save} disabled={saving}>{saving ? "Creating…" : "Create Poll"}</Btn>
            <Btn variant="ghost" onClick={() => setAdd(false)}>Cancel</Btn>
          </div>
        </Card>
      )}

      {loading ? <Spinner /> : (
        !polls.length ? <EmptyState icon="🗳️" text="No polls yet" /> :
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          {polls.map(poll => (
            <Card key={poll.id}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 14 }}>
                <div>
                  <div style={{ fontSize: 16, fontWeight: 800, color: T.dark }}>{poll.question}</div>
                  {poll.description && <div style={{ fontSize: 13, color: T.muted, marginTop: 4 }}>{poll.description}</div>}
                  <div style={{ fontSize: 12, color: T.muted, marginTop: 5 }}>{poll.total_votes} votes · {poll.created_at?.slice(0, 10)}</div>
                </div>
                <div style={{ display: "flex", gap: 8, alignItems: "center", flexShrink: 0, marginLeft: 14 }}>
                  <Badge text={poll.is_active ? "Active" : "Closed"} color={poll.is_active ? T.teal : T.muted} />
                  {isLeader && poll.is_active && <Btn variant="subtle" size="sm" onClick={() => close(poll.id)}>Close</Btn>}
                </div>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {poll.options.map(opt => {
                  const pct   = poll.total_votes ? Math.round(opt.vote_count / poll.total_votes * 100) : 0;
                  const voted = poll.user_vote === opt.id;
                  return (
                    <div key={opt.id} onClick={() => poll.is_active && vote(poll.id, opt.id)} style={{ cursor: poll.is_active ? "pointer" : "default", padding: "12px 14px", borderRadius: 10, border: `1.5px solid ${voted ? T.green : T.border}`, background: voted ? T.green + "06" : "transparent", position: "relative", overflow: "hidden", transition: "all 0.2s" }}>
                      <div style={{ position: "absolute", top: 0, left: 0, height: "100%", background: T.green + "0E", width: pct + "%", transition: "width 0.5s ease", borderRadius: 9 }} />
                      <div style={{ position: "relative", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <span style={{ fontSize: 13, fontWeight: voted ? 700 : 500, color: voted ? T.green : T.text }}>
                          {voted ? "✓ " : ""}{opt.text}
                        </span>
                        <span style={{ fontSize: 12, fontWeight: 700, color: T.muted }}>{pct}% ({opt.vote_count})</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// MARKETPLACE
// ─────────────────────────────────────────────────────────────────────────────
function Marketplace({ profile }) {
  const [listings, setL] = useState([]);
  const [loading, setLd] = useState(true);
  const [err, setErr]    = useState("");
  const [success, setOk] = useState("");
  const [adding, setAdd] = useState(false);
  const [saving, setSave]= useState(false);
  const [typeFilter, setTF] = useState("");
  const [form, setForm]  = useState({ title: "", description: "", price: "", listing_type: "sell", contact: "" });

  const load = async () => { setLd(true); try { setL(await api.market(typeFilter)); } catch (e) { setErr(e.message); } finally { setLd(false); } };
  useEffect(() => { load(); }, [typeFilter]);

  const save = async () => {
    if (!form.title.trim()) return setErr("Title is required.");
    setSave(true);
    try { await api.addListing(form); setForm({ title: "", description: "", price: "", listing_type: "sell", contact: "" }); setAdd(false); setOk("Listing posted!"); setTimeout(() => setOk(""), 3000); await load(); }
    catch (e) { setErr(e.message); }
    finally { setSave(false); }
  };

  const del = async (id) => {
    if (!window.confirm("Remove this listing?")) return;
    try { await api.delListing(id); await load(); } catch (e) { setErr(e.message); }
  };

  const toggle = async (id) => {
    try { const u = await api.toggleAvail(id); setL(prev => prev.map(l => l.id === id ? u : l)); }
    catch (e) { setErr(e.message); }
  };

  return (
    <div>
      <PageHeader title="Community Marketplace" subtitle="Buy, sell, and share within the community" action={<Btn size="sm" onClick={() => setAdd(true)}>+ Post Listing</Btn>} />
      <Alert type="error"   msg={err}     onClose={() => setErr("")} />
      <Alert type="success" msg={success} onClose={() => setOk("")} />

      <div style={{ display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap" }}>
        {[["", "All"], ["sell", "For Sale"], ["free", "Free"], ["request", "Wanted"], ["service", "Services"]].map(([v, l]) => (
          <button key={v} onClick={() => setTF(v)} style={{ padding: "6px 14px", borderRadius: 8, border: `1px solid ${typeFilter === v ? T.green : T.border}`, background: typeFilter === v ? T.green : "transparent", color: typeFilter === v ? T.cream : T.muted, fontSize: 12, fontWeight: 700, cursor: "pointer" }}>{l}</button>
        ))}
      </div>

      {adding && (
        <Card style={{ marginBottom: 16, border: `2px solid ${T.gold}` }}>
          <div style={{ fontSize: 15, fontWeight: 800, color: T.dark, marginBottom: 16 }}>Post New Listing</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 12, marginBottom: 14 }}>
            <Input label="Title" value={form.title} onChange={v => setForm(f => ({ ...f, title: v }))} placeholder="What are you listing?" required />
            <Textarea label="Description" value={form.description} onChange={v => setForm(f => ({ ...f, description: v }))} placeholder="Add more details…" rows={2} />
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <Select label="Type" value={form.listing_type} onChange={v => setForm(f => ({ ...f, listing_type: v }))}>
                <option value="sell">For Sale</option>
                <option value="free">Free</option>
                <option value="request">Wanted</option>
                <option value="service">Service</option>
              </Select>
              <Input label="Price" value={form.price} onChange={v => setForm(f => ({ ...f, price: v }))} placeholder="e.g. 5,000 RWF or Free" />
            </div>
            <Input label="Contact Number" value={form.contact} onChange={v => setForm(f => ({ ...f, contact: v }))} placeholder="Phone number for inquiries" />
          </div>
          <div style={{ display: "flex", gap: 10 }}>
            <Btn onClick={save} disabled={saving}>{saving ? "Posting…" : "Post Listing"}</Btn>
            <Btn variant="ghost" onClick={() => setAdd(false)}>Cancel</Btn>
          </div>
        </Card>
      )}

      {loading ? <Spinner /> : (
        !listings.length ? <EmptyState icon="🛒" text="No listings found" /> :
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(270px, 1fr))", gap: 12 }}>
          {listings.map(l => {
            const lc   = listColor(l.listing_type);
            const mine = l.posted_by?.id === profile?.id;
            return (
              <Card key={l.id} style={{ opacity: l.is_available ? 1 : 0.6, display: "flex", flexDirection: "column" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 10 }}>
                  <Badge text={lc.l} color={lc.c} bg={lc.bg} />
                  {!l.is_available && <Badge text="Sold/Closed" color={T.muted} />}
                </div>
                <div style={{ fontSize: 15, fontWeight: 700, color: T.text, marginBottom: 6 }}>{l.title}</div>
                {l.description && <div style={{ fontSize: 12, color: T.text2, lineHeight: 1.6, marginBottom: 8, flex: 1 }}>{l.description}</div>}
                {l.price && <div style={{ fontSize: 16, fontWeight: 800, color: T.green, marginBottom: 8 }}>{l.price}</div>}
                <div style={{ fontSize: 11, color: T.muted, marginBottom: l.contact ? 6 : 0 }}>By {l.posted_by?.full_name} · {l.created_at?.slice(0, 10)}</div>
                {l.contact && <div style={{ fontSize: 13, color: T.blue, fontWeight: 600 }}>📞 {l.contact}</div>}
                {mine && (
                  <div style={{ display: "flex", gap: 8, marginTop: 12, paddingTop: 12, borderTop: `1px solid ${T.border}` }}>
                    <button onClick={() => toggle(l.id)} style={{ flex: 1, fontSize: 11, padding: "6px", borderRadius: 7, border: `1px solid ${l.is_available ? T.muted : T.teal}`, color: l.is_available ? T.muted : T.teal, background: "transparent", cursor: "pointer", fontWeight: 700 }}>
                      {l.is_available ? "Mark Sold" : "Mark Available"}
                    </button>
                    <button onClick={() => del(l.id)} style={{ fontSize: 11, padding: "6px 10px", borderRadius: 7, border: `1px solid ${T.red}`, color: T.red, background: "transparent", cursor: "pointer", fontWeight: 700 }}>🗑</button>
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// TASK BOARD
// ─────────────────────────────────────────────────────────────────────────────
function TaskBoard({ isLeader, profile }) {
  const [tasks, setT]     = useState([]);
  const [residents, setR] = useState([]);
  const [loading, setL]   = useState(true);
  const [err, setErr]     = useState("");
  const [adding, setAdd]  = useState(false);
  const [saving, setSave] = useState(false);
  const [form, setForm]   = useState({ title: "", description: "", priority: "medium", assigned_to_id: "", due_date: "" });

  const load = async () => {
    setL(true);
    try { const [t, r] = await Promise.all([api.tasks(), isLeader ? api.residents() : Promise.resolve([])]); setT(t); setR(r); }
    catch (e) { setErr(e.message); }
    finally { setL(false); }
  };
  useEffect(() => { load(); }, []);

  const save = async () => {
    if (!form.title.trim()) return setErr("Title is required.");
    setSave(true);
    try { await api.addTask(form); setForm({ title: "", description: "", priority: "medium", assigned_to_id: "", due_date: "" }); setAdd(false); await load(); }
    catch (e) { setErr(e.message); }
    finally { setSave(false); }
  };

  const updateStatus = async (id, status) => {
    try { const u = await api.updateTask(id, { status }); setT(prev => prev.map(t => t.id === id ? u : t)); }
    catch (e) { setErr(e.message); }
  };

  const del = async (id) => {
    if (!window.confirm("Delete this task?")) return;
    try { await api.delTask(id); await load(); } catch (e) { setErr(e.message); }
  };

  const cols = [["open", "Open"], ["in_progress", "In Progress"], ["done", "Done"]];
  return (
    <div>
      <PageHeader title="Task Board" subtitle="Assign and track community tasks" action={isLeader ? <Btn size="sm" onClick={() => setAdd(true)}>+ New Task</Btn> : null} />
      <Alert type="error" msg={err} onClose={() => setErr("")} />

      {adding && (
        <Card style={{ marginBottom: 16, border: `2px solid ${T.gold}` }}>
          <div style={{ fontSize: 15, fontWeight: 800, color: T.dark, marginBottom: 16 }}>Create New Task</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 12, marginBottom: 14 }}>
            <Input label="Task Title" value={form.title} onChange={v => setForm(f => ({ ...f, title: v }))} placeholder="What needs to be done?" required />
            <Textarea label="Description" value={form.description} onChange={v => setForm(f => ({ ...f, description: v }))} placeholder="Add task details…" rows={2} />
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
              <Select label="Priority" value={form.priority} onChange={v => setForm(f => ({ ...f, priority: v }))}>
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
              </Select>
              <Select label="Assign To" value={form.assigned_to_id} onChange={v => setForm(f => ({ ...f, assigned_to_id: v }))}>
                <option value="">Unassigned</option>
                {residents.filter(r => r.role === "resident").map(r => <option key={r.id} value={r.id}>{r.full_name}</option>)}
              </Select>
              <Input label="Due Date" type="date" value={form.due_date} onChange={v => setForm(f => ({ ...f, due_date: v }))} />
            </div>
          </div>
          <div style={{ display: "flex", gap: 10 }}>
            <Btn onClick={save} disabled={saving}>{saving ? "Creating…" : "Create Task"}</Btn>
            <Btn variant="ghost" onClick={() => setAdd(false)}>Cancel</Btn>
          </div>
        </Card>
      )}

      {loading ? <Spinner /> : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 14 }}>
          {cols.map(([status, label]) => {
            const s   = needStatus(status);
            const col = tasks.filter(t => t.status === status);
            return (
              <div key={status}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12, paddingBottom: 10, borderBottom: `2px solid ${s.c}` }}>
                  <Badge text={label} color={s.c} bg={s.bg} />
                  <span style={{ fontSize: 12, color: T.muted, fontWeight: 700 }}>{col.length}</span>
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  {col.map(t => (
                    <Card key={t.id} style={{ borderLeft: `3px solid ${priColor(t.priority)}` }}>
                      <div style={{ fontSize: 13, fontWeight: 700, color: T.text, marginBottom: 6 }}>{t.title}</div>
                      {t.description && <div style={{ fontSize: 11, color: T.muted, lineHeight: 1.4, marginBottom: 8 }}>{t.description}</div>}
                      <div style={{ display: "flex", gap: 5, flexWrap: "wrap", marginBottom: 8 }}>
                        <Badge text={t.priority?.toUpperCase()} color={priColor(t.priority)} />
                        {t.assigned_to && <Badge text={t.assigned_to.full_name?.split(" ")[0]} color={T.blue} />}
                        {t.due_date && <Badge text={"📅 " + t.due_date} color={T.muted} />}
                      </div>
                      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                        {cols.filter(([s]) => s !== status).map(([s, l]) => {
                          const ms = needStatus(s);
                          return <button key={s} onClick={() => updateStatus(t.id, s)} style={{ fontSize: 10, padding: "4px 9px", borderRadius: 6, border: `1px solid ${ms.c}`, color: ms.c, background: "transparent", cursor: "pointer", fontWeight: 700 }}>{l}</button>;
                        })}
                        {isLeader && <button onClick={() => del(t.id)} style={{ fontSize: 10, padding: "4px 8px", borderRadius: 6, border: `1px solid ${T.red}`, color: T.red, background: "transparent", cursor: "pointer", fontWeight: 700 }}>🗑</button>}
                      </div>
                    </Card>
                  ))}
                  {!col.length && <div style={{ textAlign: "center", padding: "20px 0", color: T.muted, fontSize: 12, borderRadius: 10, border: `1.5px dashed ${T.border}` }}>No tasks</div>}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// ALERTS
// ─────────────────────────────────────────────────────────────────────────────
function AlertsPage({ isLeader }) {
  const [alerts, setA]   = useState([]);
  const [loading, setL]  = useState(true);
  const [err, setErr]    = useState("");
  const [adding, setAdd] = useState(false);
  const [saving, setSave]= useState(false);
  const [form, setForm]  = useState({ title: "", message: "", severity: "info" });

  const load = async () => { setL(true); try { setA(isLeader ? await api.allAlerts() : await api.alerts()); } catch (e) { setErr(e.message); } finally { setL(false); } };
  useEffect(() => { load(); }, []);

  const save = async () => {
    if (!form.title || !form.message) return setErr("Title and message are required.");
    setSave(true);
    try { await api.addAlert(form); setAdd(false); setForm({ title: "", message: "", severity: "info" }); await load(); }
    catch (e) { setErr(e.message); }
    finally { setSave(false); }
  };

  const deactivate = async (id) => {
    try { await api.deactivateAlert(id); await load(); } catch (e) { setErr(e.message); }
  };

  return (
    <div>
      <PageHeader title="Emergency Alerts" subtitle="Broadcast urgent messages to all residents" action={isLeader ? <Btn variant="danger" size="sm" onClick={() => setAdd(true)}>+ New Alert</Btn> : null} />
      <Alert type="error" msg={err} onClose={() => setErr("")} />

      {adding && (
        <Card style={{ marginBottom: 16, border: `2px solid ${T.red}` }}>
          <div style={{ fontSize: 15, fontWeight: 800, color: T.red, marginBottom: 16 }}>🚨 New Emergency Alert</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 12, marginBottom: 14 }}>
            <Input label="Alert Title" value={form.title} onChange={v => setForm(f => ({ ...f, title: v }))} placeholder="Brief title for the alert" required />
            <Textarea label="Message" value={form.message} onChange={v => setForm(f => ({ ...f, message: v }))} placeholder="Describe the emergency or situation…" rows={3} />
            <div>
              <div style={{ fontSize: 12, fontWeight: 700, color: T.muted, marginBottom: 8, letterSpacing: 0.5 }}>SEVERITY</div>
              <div style={{ display: "flex", gap: 10 }}>
                {["info", "warning", "critical"].map(s => (
                  <button key={s} onClick={() => setForm(f => ({ ...f, severity: s }))} style={{ flex: 1, padding: "9px", borderRadius: 9, border: `1.5px solid ${form.severity === s ? sevColor(s) : T.border}`, background: form.severity === s ? sevBg(s) : "transparent", color: form.severity === s ? sevColor(s) : T.muted, fontSize: 12, fontWeight: 700, cursor: "pointer", textTransform: "capitalize" }}>{s}</button>
                ))}
              </div>
            </div>
          </div>
          <div style={{ display: "flex", gap: 10 }}>
            <Btn variant="danger" onClick={save} disabled={saving}>{saving ? "Sending…" : "Send Alert"}</Btn>
            <Btn variant="ghost" onClick={() => setAdd(false)}>Cancel</Btn>
          </div>
        </Card>
      )}

      {loading ? <Spinner /> : (
        !alerts.length ? <EmptyState icon="✅" text="No active alerts" /> :
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {alerts.map(a => (
            <Card key={a.id} style={{ borderLeft: `4px solid ${sevColor(a.severity)}`, background: sevBg(a.severity) }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                <div>
                  <div style={{ display: "flex", gap: 10, alignItems: "center", marginBottom: 6 }}>
                    <span style={{ fontSize: 20 }}>{a.severity === "critical" ? "🚨" : a.severity === "warning" ? "⚠️" : "ℹ️"}</span>
                    <span style={{ fontSize: 16, fontWeight: 800, color: sevColor(a.severity) }}>{a.title}</span>
                    <Badge text={a.severity.toUpperCase()} color={sevColor(a.severity)} />
                    {!a.is_active && <Badge text="RESOLVED" color={T.teal} />}
                  </div>
                  <div style={{ fontSize: 13, color: T.text2, lineHeight: 1.6, marginBottom: 8 }}>{a.message}</div>
                  <div style={{ fontSize: 11, color: T.muted }}>{a.created_at?.slice(0, 10)} · {a.created_by?.full_name}</div>
                </div>
                {isLeader && a.is_active && <Btn variant="subtle" size="sm" onClick={() => deactivate(a.id)}>Resolve</Btn>}
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// DOCUMENTS
// ─────────────────────────────────────────────────────────────────────────────
function Documents({ isLeader }) {
  const [docs, setD]     = useState([]);
  const [loading, setL]  = useState(true);
  const [err, setErr]    = useState("");
  const [adding, setAdd] = useState(false);
  const [saving, setSave]= useState(false);
  const [catFilter, setCat] = useState("");
  const [form, setForm]  = useState({ title: "", description: "", category: "other", url: "" });

  const load = async () => { setL(true); try { setD(await api.docs(catFilter)); } catch (e) { setErr(e.message); } finally { setL(false); } };
  useEffect(() => { load(); }, [catFilter]);

  const save = async () => {
    if (!form.title.trim() || !form.url.trim()) return setErr("Title and URL are required.");
    setSave(true);
    try { await api.addDoc(form); setForm({ title: "", description: "", category: "other", url: "" }); setAdd(false); await load(); }
    catch (e) { setErr(e.message); }
    finally { setSave(false); }
  };

  const del = async (id) => {
    if (!window.confirm("Remove this document?")) return;
    try { await api.delDoc(id); await load(); } catch (e) { setErr(e.message); }
  };

  const cats = [["", "All"], ["health", "Health"], ["admin", "Admin"], ["community", "Community"], ["forms", "Forms"], ["other", "Other"]];
  const grouped = docs.reduce((acc, d) => { acc[d.category] = acc[d.category] || []; acc[d.category].push(d); return acc; }, {});

  return (
    <div>
      <PageHeader title="Document Hub" subtitle="Important documents, forms, and guides" action={isLeader ? <Btn size="sm" onClick={() => setAdd(true)}>+ Add Doc</Btn> : null} />
      <Alert type="error" msg={err} onClose={() => setErr("")} />

      <div style={{ display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap" }}>
        {cats.map(([v, l]) => (
          <button key={v} onClick={() => setCat(v)} style={{ padding: "6px 14px", borderRadius: 8, border: `1px solid ${catFilter === v ? T.green : T.border}`, background: catFilter === v ? T.green : "transparent", color: catFilter === v ? T.cream : T.muted, fontSize: 12, fontWeight: 700, cursor: "pointer" }}>{l}</button>
        ))}
      </div>

      {adding && (
        <Card style={{ marginBottom: 16, border: `2px solid ${T.gold}` }}>
          <div style={{ fontSize: 15, fontWeight: 800, color: T.dark, marginBottom: 16 }}>Add Document</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 12, marginBottom: 14 }}>
            <Input label="Title" value={form.title} onChange={v => setForm(f => ({ ...f, title: v }))} placeholder="Document title" required />
            <Textarea label="Description" value={form.description} onChange={v => setForm(f => ({ ...f, description: v }))} placeholder="What is this document about?" rows={2} />
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <Select label="Category" value={form.category} onChange={v => setForm(f => ({ ...f, category: v }))}>
                {cats.filter(([v]) => v).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </Select>
              <Input label="URL / Link" value={form.url} onChange={v => setForm(f => ({ ...f, url: v }))} placeholder="https://…" required />
            </div>
          </div>
          <div style={{ display: "flex", gap: 10 }}>
            <Btn onClick={save} disabled={saving}>{saving ? "Adding…" : "Add Document"}</Btn>
            <Btn variant="ghost" onClick={() => setAdd(false)}>Cancel</Btn>
          </div>
        </Card>
      )}

      {loading ? <Spinner /> : (
        !docs.length ? <EmptyState icon="📁" text="No documents yet" /> :
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          {Object.entries(grouped).map(([cat, items]) => (
            <div key={cat}>
              <div style={{ fontSize: 11, fontWeight: 700, color: T.muted, marginBottom: 12, letterSpacing: 0.5, textTransform: "uppercase" }}>{docIcon(cat)} {cat.replace(/_/g, " ")}</div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))", gap: 10 }}>
                {items.map(d => (
                  <Card key={d.id} style={{ display: "flex", gap: 14, alignItems: "flex-start" }}>
                    <div style={{ fontSize: 30, flexShrink: 0, marginTop: 2 }}>{docIcon(d.category)}</div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 14, fontWeight: 700, color: T.text }}>{d.title}</div>
                      {d.description && <div style={{ fontSize: 12, color: T.muted, marginTop: 3, lineHeight: 1.4 }}>{d.description}</div>}
                      <div style={{ display: "flex", gap: 10, alignItems: "center", marginTop: 10 }}>
                        {d.url && <a href={d.url} target="_blank" rel="noreferrer" style={{ fontSize: 12, color: T.teal, fontWeight: 700, textDecoration: "none" }}>🔗 Open</a>}
                        {isLeader && <button onClick={() => del(d.id)} style={{ fontSize: 11, padding: "3px 8px", borderRadius: 6, border: `1px solid ${T.red}`, color: T.red, background: "transparent", cursor: "pointer", fontWeight: 700 }}>Remove</button>}
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// EMERGENCY CONTACTS
// ─────────────────────────────────────────────────────────────────────────────
function EmergencyContacts({ isLeader }) {
  const [contacts, setC] = useState([]);
  const [loading, setL]  = useState(true);
  const [err, setErr]    = useState("");
  const [adding, setAdd] = useState(false);
  const [saving, setSave]= useState(false);
  const [form, setForm]  = useState({ name: "", category: "other", phone: "", phone2: "", notes: "" });

  const load = async () => { setL(true); try { setC(await api.contacts()); } catch (e) { setErr(e.message); } finally { setL(false); } };
  useEffect(() => { load(); }, []);

  const save = async () => {
    if (!form.name.trim() || !form.phone.trim()) return setErr("Name and phone are required.");
    setSave(true);
    try { await api.addContact(form); setForm({ name: "", category: "other", phone: "", phone2: "", notes: "" }); setAdd(false); await load(); }
    catch (e) { setErr(e.message); }
    finally { setSave(false); }
  };

  const del = async (id) => {
    if (!window.confirm("Remove contact?")) return;
    try { await api.delContact(id); await load(); } catch (e) { setErr(e.message); }
  };

  const grouped = contacts.reduce((acc, c) => { acc[c.category] = acc[c.category] || []; acc[c.category].push(c); return acc; }, {});
  const catLabels = { medical: "Medical", police: "Police / Security", fire: "Fire & Rescue", utility: "Utilities", community: "Community", other: "Other" };

  return (
    <div>
      <PageHeader title="Emergency Contacts" subtitle="Quick access to important phone numbers" action={isLeader ? <Btn variant="danger" size="sm" onClick={() => setAdd(true)}>+ Add Contact</Btn> : null} />
      <Alert type="error" msg={err} onClose={() => setErr("")} />

      <div style={{ background: T.red + "08", border: `1px solid ${T.red}30`, borderRadius: 12, padding: "12px 16px", marginBottom: 18, display: "flex", gap: 10, alignItems: "center" }}>
        <span style={{ fontSize: 20 }}>🚨</span>
        <span style={{ fontSize: 13, color: T.red, fontWeight: 600 }}>In case of emergency, call the appropriate number below. National emergency: <strong>112</strong></span>
      </div>

      {adding && (
        <Card style={{ marginBottom: 16, border: `2px solid ${T.red}` }}>
          <div style={{ fontSize: 15, fontWeight: 800, color: T.red, marginBottom: 16 }}>Add Emergency Contact</div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 12 }}>
            <Input label="Name / Organisation" value={form.name} onChange={v => setForm(f => ({ ...f, name: v }))} placeholder="e.g. King Faisal Hospital" required />
            <Select label="Category" value={form.category} onChange={v => setForm(f => ({ ...f, category: v }))}>
              <option value="medical">Medical</option>
              <option value="police">Police</option>
              <option value="fire">Fire</option>
              <option value="utility">Utility</option>
              <option value="community">Community</option>
              <option value="other">Other</option>
            </Select>
            <Input label="Primary Phone" value={form.phone} onChange={v => setForm(f => ({ ...f, phone: v }))} placeholder="e.g. 112" required />
            <Input label="Secondary Phone" value={form.phone2} onChange={v => setForm(f => ({ ...f, phone2: v }))} placeholder="Optional" />
          </div>
          <Input label="Notes" value={form.notes} onChange={v => setForm(f => ({ ...f, notes: v }))} placeholder="e.g. 24/7 emergency line" style={{ marginBottom: 14 }} />
          <div style={{ display: "flex", gap: 10 }}>
            <Btn variant="danger" onClick={save} disabled={saving}>{saving ? "Adding…" : "Add Contact"}</Btn>
            <Btn variant="ghost" onClick={() => setAdd(false)}>Cancel</Btn>
          </div>
        </Card>
      )}

      {loading ? <Spinner /> : (
        !contacts.length ? <EmptyState icon="☎️" text="No emergency contacts added yet" /> :
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          {Object.entries(grouped).map(([cat, items]) => (
            <div key={cat}>
              <div style={{ fontSize: 11, fontWeight: 700, color: T.muted, marginBottom: 12, letterSpacing: 0.5, textTransform: "uppercase" }}>{catIcon(cat)} {catLabels[cat] || cat}</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {items.map(c => (
                  <Card key={c.id} style={{ display: "flex", gap: 14, alignItems: "center" }}>
                    <div style={{ width: 44, height: 44, borderRadius: 12, background: T.red + "10", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22, flexShrink: 0 }}>
                      {catIcon(c.category)}
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 14, fontWeight: 700, color: T.text }}>{c.name}</div>
                      {c.notes && <div style={{ fontSize: 11, color: T.muted, marginTop: 2 }}>{c.notes}</div>}
                    </div>
                    <div style={{ textAlign: "right", flexShrink: 0 }}>
                      <a href={`tel:${c.phone}`} style={{ display: "block", fontSize: 15, fontWeight: 800, color: T.green, textDecoration: "none" }}>📞 {c.phone}</a>
                      {c.phone2 && <a href={`tel:${c.phone2}`} style={{ display: "block", fontSize: 12, color: T.muted, textDecoration: "none", marginTop: 3 }}>{c.phone2}</a>}
                    </div>
                    {isLeader && <button onClick={() => del(c.id)} style={{ background: "none", border: "none", cursor: "pointer", color: T.red, fontSize: 16, flexShrink: 0, padding: 0 }}>🗑</button>}
                  </Card>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// RESIDENTS DIRECTORY
// ─────────────────────────────────────────────────────────────────────────────
function ResidentsDir() {
  const [residents, setR] = useState([]);
  const [loading, setL]   = useState(true);
  const [err, setErr]     = useState("");
  const [success, setOk]  = useState("");
  const [showForm, setSF] = useState(false);
  const [saving, setSave] = useState(false);
  const [form, setForm]   = useState({ first_name: "", last_name: "", username: "", password: "", phone: "" });

  const load = async () => { setL(true); try { setR(await api.residents()); } catch (e) { setErr(e.message); } finally { setL(false); } };
  useEffect(() => { load(); }, []);

  const add = async () => {
    if (!form.first_name || !form.username || !form.password) return setErr("First name, username and password are required.");
    setSave(true);
    try { await api.addResident({ ...form, role: "resident" }); setForm({ first_name: "", last_name: "", username: "", password: "", phone: "" }); setSF(false); setOk("Resident added!"); setTimeout(() => setOk(""), 3000); await load(); }
    catch (e) { setErr(e.message); }
    finally { setSave(false); }
  };

  return (
    <div>
      <PageHeader title="Residents Directory" subtitle={`${residents.length} registered residents`} action={<Btn size="sm" onClick={() => setSF(true)}>+ Add Resident</Btn>} />
      <Alert type="error"   msg={err}     onClose={() => setErr("")} />
      <Alert type="success" msg={success} onClose={() => setOk("")} />

      {showForm && (
        <Card style={{ marginBottom: 16, border: `2px solid ${T.gold}` }}>
          <div style={{ fontSize: 15, fontWeight: 800, color: T.dark, marginBottom: 16 }}>Add New Resident</div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 12 }}>
            <Input label="First Name" value={form.first_name} onChange={v => setForm(f => ({ ...f, first_name: v }))} placeholder="First name" required />
            <Input label="Last Name"  value={form.last_name}  onChange={v => setForm(f => ({ ...f, last_name: v }))}  placeholder="Last name" />
            <Input label="Username"   value={form.username}   onChange={v => setForm(f => ({ ...f, username: v }))}   placeholder="Username" required />
            <Input label="Phone"      value={form.phone}      onChange={v => setForm(f => ({ ...f, phone: v }))}      placeholder="Phone number" />
          </div>
          <Input label="Password" value={form.password} onChange={v => setForm(f => ({ ...f, password: v }))} placeholder="Password" type="password" style={{ marginBottom: 14 }} required />
          <div style={{ display: "flex", gap: 10 }}>
            <Btn onClick={add} disabled={saving}>{saving ? "Adding…" : "Add Resident"}</Btn>
            <Btn variant="ghost" onClick={() => setSF(false)}>Cancel</Btn>
          </div>
        </Card>
      )}

      {loading ? <Spinner /> : (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {residents.map(r => (
            <Card key={r.id} style={{ display: "flex", alignItems: "center", gap: 14 }}>
              <Avatar name={r.full_name} color={r.avatar_color || T.green} size={42} />
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 14, fontWeight: 700, color: T.text }}>{r.full_name}</div>
                <div style={{ fontSize: 12, color: T.muted, marginTop: 2 }}>{r.phone} · Joined {r.created_at?.slice(0, 10)}</div>
              </div>
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap", justifyContent: "flex-end" }}>
                <Badge text={r.mutuelle_paid ? "✓ Mutuelle" : "✗ Mutuelle"} color={r.mutuelle_paid ? T.teal : T.red} />
                <Badge text={`Umuganda ${r.umuganda_count}x`} color={T.gold} />
                <Badge text={r.role} color={r.role === "leader" ? T.green : r.role === "admin" ? T.purple : T.blue} />
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// PROFILE
// ─────────────────────────────────────────────────────────────────────────────
function ProfilePage({ profile, setProfile }) {
  const [form, setForm]  = useState({ first_name: profile?.user?.first_name || "", last_name: profile?.user?.last_name || "", phone: profile?.phone || "", bio: profile?.bio || "" });
  const [saving, setSave]= useState(false);
  const [err, setErr]    = useState("");
  const [success, setOk] = useState("");

  const save = async () => {
    setSave(true); setErr(""); setOk("");
    try { const u = await api.patchMe(form); setProfile(u); setOk("Profile updated successfully!"); setTimeout(() => setOk(""), 3000); }
    catch (e) { setErr(e.message); }
    finally { setSave(false); }
  };

  return (
    <div>
      <PageHeader title="My Profile" subtitle="Manage your personal information" />
      <Alert type="error"   msg={err}     onClose={() => setErr("")} />
      <Alert type="success" msg={success} onClose={() => setOk("")} />

      <Card style={{ marginBottom: 16 }}>
        <div style={{ display: "flex", gap: 18, alignItems: "center", marginBottom: 22 }}>
          <div style={{ width: 64, height: 64, borderRadius: 18, background: (profile?.avatar_color || T.green) + "20", border: `2px solid ${profile?.avatar_color || T.green}40`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 28, fontWeight: 700, color: profile?.avatar_color || T.green }}>
            {profile?.full_name?.charAt(0)?.toUpperCase()}
          </div>
          <div>
            <div style={{ fontSize: 20, fontWeight: 800, color: T.dark }}>{profile?.full_name}</div>
            <div style={{ fontSize: 13, color: T.muted, marginTop: 3 }}>{profile?.role === "leader" ? "Cell Leader" : profile?.role === "admin" ? "Super Admin" : "Resident"} · {profile?.umudugudu}</div>
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginBottom: 14 }}>
          <Input label="First Name" value={form.first_name} onChange={v => setForm(f => ({ ...f, first_name: v }))} placeholder="First name" />
          <Input label="Last Name"  value={form.last_name}  onChange={v => setForm(f => ({ ...f, last_name: v }))}  placeholder="Last name" />
        </div>
        <div style={{ marginBottom: 14 }}>
          <Input label="Phone Number" value={form.phone} onChange={v => setForm(f => ({ ...f, phone: v }))} placeholder="Phone number" />
        </div>
        <div style={{ marginBottom: 20 }}>
          <Textarea label="Bio" value={form.bio} onChange={v => setForm(f => ({ ...f, bio: v }))} placeholder="Tell the community about yourself…" rows={3} />
        </div>
        <Btn onClick={save} disabled={saving} size="lg">{saving ? "Saving…" : "Save Changes"}</Btn>
      </Card>

      <Card>
        <div style={{ fontSize: 14, fontWeight: 700, color: T.dark, marginBottom: 14 }}>Community Status</div>
        {[
          ["Mutuelle de Santé", profile?.mutuelle_paid ? "✓ Paid" : "✗ Not Paid", profile?.mutuelle_paid ? T.teal : T.red],
          ["Umuganda Sessions", profile?.umuganda_count + " attended", T.gold],
          ["Account Role", profile?.role, profile?.role === "admin" ? T.purple : T.green],
        ].map(([label, value, color]) => (
          <div key={label} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 0", borderBottom: `1px solid ${T.border}` }}>
            <span style={{ fontSize: 13, color: T.text2 }}>{label}</span>
            <Badge text={value} color={color} />
          </div>
        ))}
      </Card>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// NOTIFICATIONS PANEL
// ─────────────────────────────────────────────────────────────────────────────
function NotificationsPanel({ onClose }) {
  const [notifs, setN]  = useState([]);
  const [loading, setL] = useState(true);

  useEffect(() => { api.notifications().then(setN).catch(() => {}).finally(() => setL(false)); }, []);

  const markAll = async () => { await api.markAllRead().catch(() => {}); setN(n => n.map(x => ({ ...x, is_read: true }))); };

  const icons = { need_update: "⚠️", announcement: "📢", dm: "💬", alert: "🚨", event: "📅", umuganda: "🌿", system: "🔔" };

  return (
    <>
      <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", zIndex: 200 }} />
      <div style={{ position: "fixed", top: 0, right: 0, bottom: 0, width: 320, background: T.card, zIndex: 201, boxShadow: "-8px 0 30px rgba(0,0,0,0.2)", display: "flex", flexDirection: "column" }}>
        <div style={{ padding: "16px 20px", background: T.green, color: T.cream, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span style={{ fontSize: 16, fontWeight: 800 }}>Notifications</span>
          <div style={{ display: "flex", gap: 10 }}>
            <button onClick={markAll} style={{ background: "rgba(255,255,255,0.15)", border: "none", color: T.cream, fontSize: 12, padding: "5px 10px", borderRadius: 7, cursor: "pointer", fontWeight: 700 }}>Mark all read</button>
            <button onClick={onClose} style={{ background: "none", border: "none", color: T.cream, fontSize: 22, cursor: "pointer", lineHeight: 1, padding: 0 }}>×</button>
          </div>
        </div>
        {loading ? <Spinner /> : (
          <div style={{ flex: 1, overflowY: "auto" }}>
            {!notifs.length && <EmptyState icon="🔔" text="No notifications yet" />}
            {notifs.map(n => (
              <div key={n.id} style={{ padding: "14px 18px", borderBottom: `1px solid ${T.border}`, background: n.is_read ? "transparent" : T.gold + "08" }}>
                <div style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
                  <span style={{ fontSize: 18, flexShrink: 0 }}>{icons[n.notif_type] || "🔔"}</span>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 13, fontWeight: n.is_read ? 500 : 700, color: T.text }}>{n.title}</div>
                    {n.message && <div style={{ fontSize: 12, color: T.muted, marginTop: 3, lineHeight: 1.4 }}>{n.message}</div>}
                    <div style={{ fontSize: 11, color: T.muted, marginTop: 5 }}>{new Date(n.created_at).toLocaleDateString()}</div>
                  </div>
                  {!n.is_read && <div style={{ width: 8, height: 8, borderRadius: "50%", background: T.gold, flexShrink: 0, marginTop: 5 }} />}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// NAVIGATION
// ─────────────────────────────────────────────────────────────────────────────
const ADMIN_NAV = [
  { id: "overview",  icon: "🏠",  label: "Home"      },
  { id: "approvals", icon: "🔐",  label: "Approvals" },
  { id: "analytics", icon: "📊",  label: "Reports"   },
  { id: "needs",     icon: "⚠️",  label: "Needs"     },
  { id: "mutuelle",  icon: "🏥",  label: "Mutuelle"  },
  { id: "tasks",     icon: "✅",  label: "Tasks"     },
  { id: "polls",     icon: "🗳️",  label: "Polls"     },
  { id: "chat",      icon: "💬",  label: "Chat"      },
  { id: "dm",        icon: "📩",  label: "DMs"       },
  { id: "market",    icon: "🛒",  label: "Market"    },
  { id: "events",    icon: "📅",  label: "Events"    },
  { id: "alerts",    icon: "🚨",  label: "Alerts"    },
  { id: "docs",      icon: "📁",  label: "Docs"      },
  { id: "contacts",  icon: "☎️",  label: "SOS"       },
  { id: "residents", icon: "👥",  label: "People"    },
];

const LEADER_NAV = [
  { id: "overview",  icon: "🏠",  label: "Home"      },
  { id: "analytics", icon: "📊",  label: "Reports"   },
  { id: "needs",     icon: "⚠️",  label: "Needs"     },
  { id: "mutuelle",  icon: "🏥",  label: "Mutuelle"  },
  { id: "tasks",     icon: "✅",  label: "Tasks"     },
  { id: "polls",     icon: "🗳️",  label: "Polls"     },
  { id: "chat",      icon: "💬",  label: "Chat"      },
  { id: "dm",        icon: "📩",  label: "DMs"       },
  { id: "market",    icon: "🛒",  label: "Market"    },
  { id: "events",    icon: "📅",  label: "Events"    },
  { id: "alerts",    icon: "🚨",  label: "Alerts"    },
  { id: "docs",      icon: "📁",  label: "Docs"      },
  { id: "contacts",  icon: "☎️",  label: "SOS"       },
  { id: "residents", icon: "👥",  label: "People"    },
];

const RESIDENT_NAV = [
  { id: "home",     icon: "🏠", label: "Home"    },
  { id: "chat",     icon: "💬", label: "Chat"    },
  { id: "dm",       icon: "📩", label: "DMs"     },
  { id: "polls",    icon: "🗳️", label: "Polls"   },
  { id: "market",   icon: "🛒", label: "Market"  },
  { id: "needs",    icon: "⚠️", label: "Needs"   },
  { id: "events",   icon: "📅", label: "Events"  },
  { id: "docs",     icon: "📁", label: "Docs"    },
  { id: "contacts", icon: "☎️", label: "SOS"     },
  { id: "profile",  icon: "👤", label: "Profile" },
];

// ─────────────────────────────────────────────────────────────────────────────
// ROOT APP
// ─────────────────────────────────────────────────────────────────────────────
export default function App() {
  const [tokens, setTokens]     = useState(null);
  const [profile, setProfile]   = useState(null);
  const [page, setPage]         = useState("overview");
  const [showNotifs, setShowN]  = useState(false);
  const [notifCount, setNC]     = useState(0);
  const [pendingReqs, setPR]    = useState(0);

  const handleLogin = (t, p) => {
    setTokens(t); setProfile(p);
    setPage(p.role === "resident" ? "home" : "overview");
  };

  const logout = () => { setTokens(null); setProfile(null); api.tok(null); };

  // Poll notifications + pending requests
  useEffect(() => {
    if (!tokens) return;
    const fetch = async () => {
      try {
        const [nc, pr] = await Promise.all([
          api.notifCount(),
          profile?.role === "admin" ? api.pendingRequests() : Promise.resolve({ count: 0 }),
        ]);
        setNC(nc.count);
        setPR(pr.count);
      } catch {}
    };
    fetch();
    const t = setInterval(fetch, 20000);
    return () => clearInterval(t);
  }, [tokens, profile?.role]);

  if (!tokens || !profile) return <AuthScreen onLogin={handleLogin} />;

  const isLeaderOrAbove = ["leader", "sector", "admin"].includes(profile.role);
  const isAdmin = profile.role === "admin";
  const nav = isAdmin ? ADMIN_NAV : isLeaderOrAbove ? LEADER_NAV : RESIDENT_NAV;

  const renderPage = () => {
    switch (page) {
      // Common pages
      case "overview":  return <Overview />;
      case "chat":      return <Chat isLeader={isLeaderOrAbove} profile={profile} />;
      case "dm":        return <DMs profile={profile} isLeader={isLeaderOrAbove} />;
      case "polls":     return <Polls isLeader={isLeaderOrAbove} />;
      case "market":    return <Marketplace profile={profile} />;
      case "needs":     return <Needs isLeader={isLeaderOrAbove} />;
      case "events":    return <Events isLeader={isLeaderOrAbove} profile={profile} />;
      case "docs":      return <Documents isLeader={isLeaderOrAbove} />;
      case "contacts":  return <EmergencyContacts isLeader={isLeaderOrAbove} />;
      case "alerts":    return <AlertsPage isLeader={isLeaderOrAbove} />;
      // Leader+ pages
      case "analytics": return <Analytics />;
      case "mutuelle":  return <Mutuelle />;
      case "tasks":     return <TaskBoard isLeader={isLeaderOrAbove} profile={profile} />;
      case "residents": return <ResidentsDir />;
      // Admin only
      case "approvals": return <ApprovalPanel />;
      // Resident pages
      case "home":      return <Announcements isLeader={false} />;
      case "profile":   return <ProfilePage profile={profile} setProfile={setProfile} />;
      default:          return <Overview />;
    }
  };

  return (
    <Auth.Provider value={{ profile, tokens }}>
      <div style={{ minHeight: "100vh", background: T.bg, fontFamily: "'Segoe UI', system-ui, -apple-system, sans-serif" }}>

        {/* Top Bar */}
        <div style={{ background: T.green, padding: "12px 20px", display: "flex", alignItems: "center", justifyContent: "space-between", position: "sticky", top: 0, zIndex: 100, boxShadow: "0 2px 12px rgba(0,0,0,0.2)" }}>
          <div>
            <div style={{ fontSize: 10, color: T.gold, letterSpacing: 3, textTransform: "uppercase", fontWeight: 700 }}>Umudugudu Manager</div>
            <div style={{ fontSize: 15, fontWeight: 800, color: T.cream }}>
              {isAdmin ? "Super Admin" : isLeaderOrAbove ? "Cell Leader Dashboard" : profile.full_name}
            </div>
          </div>
          <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
            {isAdmin && pendingReqs > 0 && (
              <button onClick={() => setPage("approvals")} style={{ background: T.gold, border: "none", color: "#fff", fontSize: 12, padding: "5px 11px", borderRadius: 8, cursor: "pointer", fontWeight: 700, display: "flex", alignItems: "center", gap: 5 }}>
                🔐 {pendingReqs} pending
              </button>
            )}
            <button onClick={() => setShowN(true)} style={{ background: "rgba(255,255,255,0.15)", border: "none", color: T.cream, fontSize: 14, padding: "6px 10px", borderRadius: 9, cursor: "pointer", fontWeight: 700, position: "relative" }}>
              🔔
              {notifCount > 0 && <span style={{ position: "absolute", top: -5, right: -5, background: T.red, color: "#fff", borderRadius: 99, fontSize: 10, padding: "1px 5px", fontWeight: 800, minWidth: 16, textAlign: "center" }}>{notifCount}</span>}
            </button>
            <button onClick={logout} style={{ background: "rgba(255,255,255,0.15)", border: "none", color: T.cream, fontSize: 12, padding: "7px 14px", borderRadius: 9, cursor: "pointer", fontWeight: 700 }}>Logout</button>
          </div>
        </div>

        {/* Alert Banner */}
        <AlertBanner />

        {/* Page Content */}
        <div style={{ maxWidth: 960, margin: "0 auto", padding: "20px 16px 100px" }}>
          {renderPage()}
        </div>

        {/* Bottom Navigation */}
        <div style={{ position: "fixed", bottom: 0, left: 0, right: 0, background: T.card, borderTop: `1px solid ${T.border}`, display: "flex", zIndex: 100, boxShadow: "0 -4px 20px rgba(0,0,0,0.08)", overflowX: "auto" }}>
          {nav.map(n => (
            <button key={n.id} onClick={() => setPage(n.id)} style={{ flex: 1, minWidth: 52, padding: "8px 4px 6px", background: "transparent", border: "none", cursor: "pointer", display: "flex", flexDirection: "column", alignItems: "center", gap: 3, position: "relative" }}>
              <span style={{ fontSize: 20 }}>{n.icon}</span>
              <span style={{ fontSize: 9, fontWeight: 700, color: page === n.id ? T.green : T.muted, whiteSpace: "nowrap" }}>{n.label}</span>
              {page === n.id && <div style={{ position: "absolute", top: 0, left: "50%", transform: "translateX(-50%)", width: 20, height: 3, borderRadius: 99, background: T.green }} />}
            </button>
          ))}
        </div>

        {/* Notifications Panel */}
        {showNotifs && <NotificationsPanel onClose={() => { setShowN(false); setNC(0); }} />}
      </div>
    </Auth.Provider>
  );
}

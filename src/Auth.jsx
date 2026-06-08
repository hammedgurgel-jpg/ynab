import React, { useState } from "react";
import { PiggyBank } from "lucide-react";
import { supabase } from "./supabaseClient";

const C = { page: "#F5F8F0", white: "#FFFFFF", mint: "#E9F6D5", green: "#5BA82E", greenDark: "#2E5E1B", ink: "#171C12", body: "#5C6655", muted: "#9AA38C", line: "#EAEEE2", red: "#E8556A" };
const F = "'Plus Jakarta Sans',-apple-system,sans-serif";
const inputStyle = { width: "100%", boxSizing: "border-box", border: `1px solid ${C.line}`, borderRadius: 13, padding: "13px 14px", fontFamily: F, fontSize: 16, fontWeight: 500, color: C.ink, background: C.page, outline: "none" };

export default function Auth() {
  const [mode, setMode] = useState("login"); // login | signup
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState(null);

  const submit = async () => {
    setMsg(null);
    if (!email || !password) { setMsg({ t: "Preencha e-mail e senha.", err: true }); return; }
    setBusy(true);
    try {
      if (mode === "login") {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      } else {
        const { data, error } = await supabase.auth.signUp({ email, password });
        if (error) throw error;
        if (!data.session) setMsg({ t: "Conta criada! Se a confirmação por e-mail estiver ligada, confirme e depois entre.", err: false });
      }
    } catch (e) {
      setMsg({ t: e.message || "Não foi possível continuar.", err: true });
    }
    setBusy(false);
  };

  return (
    <div style={{ background: C.page, minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap');`}</style>
      <div style={{ width: "100%", maxWidth: 380 }}>
        <div style={{ display: "grid", placeItems: "center", marginBottom: 18 }}>
          <div style={{ width: 64, height: 64, borderRadius: 20, background: C.green, display: "grid", placeItems: "center", marginBottom: 12 }}>
            <PiggyBank size={32} color="#fff" />
          </div>
          <div style={{ fontFamily: F, fontSize: 26, fontWeight: 800, color: C.ink }}>Meu Orçamento</div>
          <div style={{ fontFamily: F, fontSize: 14, color: C.body, marginTop: 2 }}>cada real com a sua função</div>
        </div>

        <div style={{ background: C.white, borderRadius: 24, border: `1px solid ${C.line}`, padding: 22, boxShadow: "0 2px 8px rgba(20,40,10,.05)" }}>
          <div style={{ display: "flex", gap: 8, marginBottom: 18 }}>
            {[["login", "Entrar"], ["signup", "Criar conta"]].map(([k, l]) => (
              <button key={k} onClick={() => { setMode(k); setMsg(null); }} style={{ flex: 1, padding: "10px", borderRadius: 12, border: `1.5px solid ${mode === k ? C.green : C.line}`, background: mode === k ? C.mint : C.white, color: mode === k ? C.greenDark : C.body, fontFamily: F, fontWeight: 700, fontSize: 14, cursor: "pointer" }}>{l}</button>
            ))}
          </div>
          <label style={{ display: "block", marginBottom: 12 }}>
            <div style={{ fontFamily: F, fontSize: 12, fontWeight: 700, color: C.body, marginBottom: 6 }}>E-mail</div>
            <input style={inputStyle} type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="voce@email.com" />
          </label>
          <label style={{ display: "block", marginBottom: 16 }}>
            <div style={{ fontFamily: F, fontSize: 12, fontWeight: 700, color: C.body, marginBottom: 6 }}>Senha</div>
            <input style={inputStyle} type="password" autoComplete={mode === "login" ? "current-password" : "new-password"} value={password} onChange={(e) => setPassword(e.target.value)} onKeyDown={(e) => e.key === "Enter" && submit()} placeholder="••••••••" />
          </label>
          {msg && <div style={{ fontFamily: F, fontSize: 13, fontWeight: 600, color: msg.err ? C.red : C.greenDark, marginBottom: 14 }}>{msg.t}</div>}
          <button onClick={submit} disabled={busy} style={{ width: "100%", background: C.green, color: "#fff", border: "none", borderRadius: 14, padding: "14px", fontFamily: F, fontSize: 16, fontWeight: 700, cursor: busy ? "default" : "pointer", opacity: busy ? .7 : 1 }}>
            {busy ? "Aguarde…" : mode === "login" ? "Entrar" : "Criar conta"}
          </button>
        </div>
        <div style={{ fontFamily: F, fontSize: 12, color: C.muted, textAlign: "center", marginTop: 16 }}>Seu orçamento é privado — só você acessa os seus dados.</div>
      </div>
    </div>
  );
}

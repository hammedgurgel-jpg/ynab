import React, { useState, useEffect, useCallback } from "react";
import {
  Wallet, PiggyBank, Plus, ArrowDownLeft, ArrowUpRight, X,
  Receipt, CreditCard, Trash2, Check, Banknote, BarChart3,
  ChevronLeft, ChevronRight, Lightbulb, LogOut, CornerDownRight, ArrowLeftRight, Pencil,
  Target, CalendarDays, TrendingUp, ShieldCheck, Flag,
} from "lucide-react";
import { supabase } from "./supabaseClient";
import { loadBudget, saveBudget } from "./api";
import Auth from "./Auth";

// ---------- tema ----------
const C = {
  page: "#F5F8F0", white: "#FFFFFF", mint: "#E9F6D5", lime: "#AEE63D",
  green: "#5BA82E", greenDark: "#2E5E1B", ink: "#171C12", body: "#5C6655",
  muted: "#9AA38C", line: "#EAEEE2", red: "#E8556A", amber: "#F2B718",
  blue: "#3B82F6", track: "#EDF1E6",
};
const RING_COLORS = [C.green, C.amber, C.red, C.blue, "#7C5CFF", "#FF8A3D", C.greenDark];
const F = "'Plus Jakarta Sans',-apple-system,sans-serif";
const fmt = (n) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(n || 0);
const clamp = (n, a, b) => Math.max(a, Math.min(b, n));
const todayISO = () => new Date().toISOString().slice(0, 10);
const curMonth = () => new Date().toISOString().slice(0, 7);
const uid = () => Math.random().toString(36).slice(2, 10);

const shiftMonth = (ym, d) => {
  let [y, m] = ym.split("-").map(Number); m += d;
  while (m < 1) { m += 12; y--; } while (m > 12) { m -= 12; y++; }
  return `${y}-${String(m).padStart(2, "0")}`;
};
const monthLabel = (ym) => {
  const [y, m] = ym.split("-").map(Number);
  const s = new Date(y, m - 1, 1).toLocaleDateString("pt-BR", { month: "long", year: "numeric" });
  return s.charAt(0).toUpperCase() + s.slice(1);
};

const seed = () => {
  const g1 = uid(), g2 = uid(), g3 = uid();
  const mk = (groupId, name) => ({ id: uid(), groupId, name });
  return {
    accounts: [{ id: uid(), name: "Conta corrente", type: "cash", initialBalance: 0 }],
    groups: [{ id: g1, name: "Moradia" }, { id: g2, name: "Alimentação" }, { id: g3, name: "Vida" }],
    categories: [
      mk(g1, "Aluguel"), mk(g1, "Luz"), mk(g1, "Água/Internet"),
      mk(g2, "Mercado"), mk(g2, "Restaurantes"), mk(g2, "Delivery"),
      mk(g3, "Combustível"), mk(g3, "Lazer"), mk(g3, "Reserva"),
    ],
    assigned: {}, transactions: [], goals: {},
  };
};
const migrate = (d) => {
  if (!d || !d.accounts) return seed();
  const cm = curMonth(); const a = {};
  for (const [cat, v] of Object.entries(d.assigned || {})) a[cat] = typeof v === "number" ? (v ? { [cm]: v } : {}) : v;
  return { ...d, assigned: a, goals: d.goals || {} };
};

function Ring({ size = 60, stroke = 6, pct = 0, color = C.green, children }) {
  const r = (size - stroke) / 2, circ = 2 * Math.PI * r;
  const off = circ * (1 - clamp(pct, 0, 1));
  return (
    <div style={{ position: "relative", width: size, height: size }}>
      <svg width={size} height={size} style={{ transform: "rotate(-90deg)" }}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={C.track} strokeWidth={stroke} />
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth={stroke} strokeDasharray={circ} strokeDashoffset={off} strokeLinecap="round" style={{ transition: "stroke-dashoffset .5s ease" }} />
      </svg>
      <div style={{ position: "absolute", inset: 0, display: "grid", placeItems: "center" }}>{children}</div>
    </div>
  );
}

// ============================================================
//  Gate de autenticação
// ============================================================
export default function App() {
  const [session, setSession] = useState(undefined); // undefined = carregando
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setSession(s));
    return () => sub.subscription.unsubscribe();
  }, []);
  if (session === undefined) {
    return <div style={{ background: C.page, minHeight: "100vh", display: "grid", placeItems: "center", fontFamily: F, color: C.muted }}>Carregando…</div>;
  }
  if (!session) return <Auth />;
  return <Budgeter />;
}

// ============================================================
//  App do orçamento
// ============================================================
function Budgeter() {
  const [data, setData] = useState(null);
  const [loaded, setLoaded] = useState(false);
  const [tab, setTab] = useState("budget");
  const [month, setMonth] = useState(curMonth());
  const [modal, setModal] = useState(null);
  const [editingCat, setEditingCat] = useState(null);
  const [moving, setMoving] = useState(null);
  const [editingCatMeta, setEditingCatMeta] = useState(null);
  const [editingGroup, setEditingGroup] = useState(null);
  const [editingGoal, setEditingGoal] = useState(null);
  const [editingDebt, setEditingDebt] = useState(null); // conta de crédito para editar dívida

  // carregar do Supabase
  useEffect(() => {
    (async () => {
      try {
        const b = await loadBudget();
        if (b && b.accounts) setData(migrate(b));
        else { const s = seed(); setData(s); await saveBudget(s); }
      } catch (e) { console.error(e); setData(seed()); }
      setLoaded(true);
    })();
  }, []);
  // salvar (com pequeno debounce para não gravar a cada tecla)
  useEffect(() => {
    if (!loaded || !data) return;
    const t = setTimeout(() => { saveBudget(data).catch((e) => console.error(e)); }, 600);
    return () => clearTimeout(t);
  }, [data, loaded]);

  const update = useCallback((fn) => setData((d) => fn({ ...d })), []);

  if (!data) return <div style={{ background: C.page, minHeight: "100vh", display: "grid", placeItems: "center", fontFamily: F, color: C.muted }}>Carregando…</div>;

  // ---------- cálculos ----------
  const catById = (id) => data.categories.find((c) => c.id === id);
  const assignedM = (id, ym) => (data.assigned[id]?.[ym]) || 0;
  const cumAssigned = (id, ym) => Object.entries(data.assigned[id] || {}).reduce((s, [k, v]) => (k <= ym ? s + v : s), 0);
  const spentM = (id, ym) => data.transactions.filter((t) => t.categoryId === id && t.date.slice(0, 7) === ym).reduce((s, t) => s + (t.type === "outflow" ? t.amount : t.type === "inflow" ? -t.amount : 0), 0);
  const cumSpent = (id, ym) => data.transactions.filter((t) => t.categoryId === id && t.date.slice(0, 7) <= ym).reduce((s, t) => s + (t.type === "outflow" ? t.amount : t.type === "inflow" ? -t.amount : 0), 0);

  const creditSpend = (cardId, ym) => data.transactions.filter((t) => t.type === "outflow" && t.accountId === cardId && t.date.slice(0, 7) <= ym).reduce((s, t) => s + t.amount, 0);
  const creditSpendM = (cardId, ym) => data.transactions.filter((t) => t.type === "outflow" && t.accountId === cardId && t.date.slice(0, 7) === ym).reduce((s, t) => s + t.amount, 0);
  const payments = (cardId, ym) => data.transactions.filter((t) => t.type === "payment" && t.cardId === cardId && t.date.slice(0, 7) <= ym).reduce((s, t) => s + t.amount, 0);
  const paymentsM = (cardId, ym) => data.transactions.filter((t) => t.type === "payment" && t.cardId === cardId && t.date.slice(0, 7) === ym).reduce((s, t) => s + t.amount, 0);

  const available = (id, ym) => {
    const c = catById(id);
    if (c?.cardId) return cumAssigned(id, ym) + creditSpend(c.cardId, ym) - payments(c.cardId, ym);
    return cumAssigned(id, ym) - cumSpent(id, ym);
  };
  const carryIn = (id, ym) => available(id, shiftMonth(ym, -1));
  const activityM = (id, ym) => {
    const c = catById(id);
    if (c?.cardId) return creditSpendM(c.cardId, ym) - paymentsM(c.cardId, ym);
    return -spentM(id, ym);
  };

  const cashAsOf = (ym) => data.accounts.filter((a) => a.type === "cash").reduce((s, a) => {
    const ins = data.transactions.filter((t) => t.accountId === a.id && t.type === "inflow" && t.date.slice(0, 7) <= ym).reduce((x, t) => x + t.amount, 0);
    const outs = data.transactions.filter((t) => t.accountId === a.id && t.type === "outflow" && t.date.slice(0, 7) <= ym).reduce((x, t) => x + t.amount, 0);
    const pays = data.transactions.filter((t) => t.type === "payment" && t.fromCash === a.id && t.date.slice(0, 7) <= ym).reduce((x, t) => x + t.amount, 0);
    return s + a.initialBalance + ins - outs - pays;
  }, 0);
  const accBalanceNow = (a) => {
    const ins = data.transactions.filter((t) => t.accountId === a.id && t.type === "inflow").reduce((s, t) => s + t.amount, 0);
    const outs = data.transactions.filter((t) => t.accountId === a.id && t.type === "outflow").reduce((s, t) => s + t.amount, 0);
    if (a.type === "credit") {
      // debtBalance: dívida total informada manualmente (negativa = deve)
      // ponto de partida + compras lançadas - pagamentos realizados
      const base = -(a.debtBalance || 0); // armazenado positivo, saldo é negativo
      return base - outs + ins + payments(a.id, "9999-99");
    }
    const pays = data.transactions.filter((t) => t.type === "payment" && t.fromCash === a.id).reduce((s, t) => s + t.amount, 0);
    return a.initialBalance + ins - outs - pays;
  };
  // dívida total atual do cartão (positiva = quanto deve)
  const cardDebt = (a) => {
    const bal = accBalanceNow(a);
    return bal < 0 ? -bal : 0;
  };
  // quanto já está reservado no envelope de pagamento desse cartão
  const cardReserved = (a) => {
    const paycat = data.categories.find((c) => c.cardId === a.id);
    if (!paycat) return 0;
    return Math.max(0, available(paycat.id, month));
  };

  const cashM = cashAsOf(month);
  const totalAvail = data.categories.reduce((s, c) => s + available(c.id, month), 0);
  const totalAssignedM = data.categories.reduce((s, c) => s + assignedM(c.id, month), 0);
  const totalSpentM = data.categories.filter((c) => !c.cardId).reduce((s, c) => s + Math.max(0, spentM(c.id, month)), 0);
  const rta = cashM - totalAvail;
  const creditAccounts = data.accounts.filter((a) => a.type === "credit");

  // ---------- metas ----------
  // Retorna { needed, progress, onTrack, label } para o mês atual
  const goalStatus = (catId, ym) => {
    const g = data.goals[catId];
    if (!g) return null;
    const av = available(catId, ym);
    const sp = Math.max(0, spentM(catId, ym));

    if (g.type === "target") {
      // Juntar R$ g.amount até g.targetDate
      const [ty, tm] = g.targetDate.split("-").map(Number);
      const [cy, cm] = ym.split("-").map(Number);
      const monthsLeft = Math.max(1, (ty - cy) * 12 + (tm - cm) + 1);
      const saved = av; // disponível acumulado = o que foi poupado
      const needed = Math.max(0, (g.amount - saved) / monthsLeft);
      const progress = Math.min(1, saved / g.amount);
      const onTrack = assignedM(catId, ym) >= needed - 0.005;
      return { needed, progress, saved, total: g.amount, onTrack, label: `${fmt(saved)} de ${fmt(g.amount)}`, monthsLeft };
    }
    if (g.type === "monthly") {
      // Ter R$ g.amount disponível todo mês
      const needed = Math.max(0, g.amount - carryIn(catId, ym));
      const progress = Math.min(1, av / g.amount);
      const onTrack = av >= g.amount - 0.005;
      return { needed, progress, onTrack, label: `${fmt(av)} de ${fmt(g.amount)}` };
    }
    if (g.type === "balance") {
      // Manter pelo menos R$ g.amount no envelope
      const progress = Math.min(1, av / g.amount);
      const onTrack = av >= g.amount - 0.005;
      return { needed: Math.max(0, g.amount - av), progress, onTrack, label: `${fmt(av)} de ${fmt(g.amount)}` };
    }
    return null;
  };

  const MonthNav = () => (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 12, marginTop: 4 }}>
      <button onClick={() => setMonth((m) => shiftMonth(m, -1))} style={navBtn}><ChevronLeft size={18} color={C.green} /></button>
      <div style={{ fontFamily: F, fontSize: 15, fontWeight: 800, color: C.ink, minWidth: 150, textAlign: "center" }}>{monthLabel(month)}</div>
      <button onClick={() => setMonth((m) => shiftMonth(m, 1))} style={navBtn}><ChevronRight size={18} color={C.green} /></button>
    </div>
  );

  const Budget = () => {
    const pct = cashM > 0 ? totalAvail / cashM : 0;
    const tone = rta < -0.005 ? C.red : C.green;
    return (
      <div>
        <MonthNav />
        <div style={{ display: "grid", placeItems: "center", margin: "22px 0 8px" }}>
          <Ring size={204} stroke={18} pct={rta < 0 ? 1 : pct} color={tone}>
            <div style={{ textAlign: "center" }}>
              <div style={{ fontFamily: F, fontSize: 13, fontWeight: 600, color: C.muted }}>Pronto para distribuir</div>
              <div style={{ fontFamily: F, fontSize: 33, fontWeight: 800, color: C.ink, lineHeight: 1.1, marginTop: 2 }}>{fmt(rta)}</div>
              <div style={{ fontFamily: F, fontSize: 12, fontWeight: 600, color: tone, marginTop: 4 }}>
                {rta > 0.005 ? "ainda sem função" : rta < -0.005 ? "além do que você tem" : "tudo distribuído ✓"}
              </div>
            </div>
          </Ring>
        </div>

        <div style={{ background: C.mint, borderRadius: 22, padding: "16px 18px", display: "flex", justifyContent: "space-between" }}>
          {[["Em conta", cashM, C.green], ["Atribuído", totalAssignedM, C.greenDark], ["Gasto", totalSpentM, C.red]].map(([l, v, col]) => (
            <div key={l} style={{ textAlign: "center", flex: 1 }}>
              <div style={{ fontFamily: F, fontSize: 11, fontWeight: 600, color: C.body }}>{l}</div>
              <div style={{ fontFamily: F, fontSize: 16, fontWeight: 800, color: col, marginTop: 3 }}>{fmt(v)}</div>
            </div>
          ))}
        </div>

        <button onClick={() => setMoving(data.categories.find((c) => !c.cardId)?.id || "RTA")} style={{ width: "100%", marginTop: 12, background: C.white, border: `1px solid ${C.line}`, color: C.greenDark, borderRadius: 16, padding: "12px", fontFamily: F, fontSize: 14, fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
          <ArrowLeftRight size={16} color={C.green} /> Mover dinheiro entre envelopes
        </button>

        <div style={{ marginTop: 22 }}>
          {data.groups.map((g) => {
            const cats = data.categories.filter((c) => c.groupId === g.id);
            return (
              <div key={g.id} style={{ marginBottom: 16 }}>
                <div style={{ fontFamily: F, fontSize: 16, fontWeight: 800, color: C.ink, marginBottom: 10, paddingLeft: 4, display: "flex", alignItems: "center", gap: 7 }}>
                  {g.isPayment && <CreditCard size={16} color={C.green} />}
                  <span style={{ flex: 1 }}>{g.name}</span>
                  {!g.isPayment && (
                    <button onClick={(e) => { e.stopPropagation(); setEditingGroup(g); }} style={{ background: "none", border: "none", cursor: "pointer", padding: 4, display: "grid", placeItems: "center" }}>
                      <Pencil size={14} color={C.muted} />
                    </button>
                  )}
                </div>
                <div style={{ background: C.white, borderRadius: 20, border: `1px solid ${C.line}`, overflow: "hidden", boxShadow: "0 1px 3px rgba(20,40,10,.04)" }}>
                  {cats.length === 0 && <div style={{ padding: 16, color: C.muted, fontSize: 14, fontFamily: F }}>Sem categorias.</div>}
                  {cats.map((c, i) => {
                    const av = available(c.id, month), ci = carryIn(c.id, month);
                    const tcol = av < -0.005 ? C.red : av > 0.005 ? C.green : C.muted;
                    const top = i ? `1px solid ${C.line}` : "none";
                    if (c.cardId) {
                      const debt = creditSpend(c.cardId, month) - payments(c.cardId, month);
                      const cover = debt > 0 ? clamp(av / debt, 0, 1) : 1;
                      return (
                        <div key={c.id} onClick={() => setEditingCat(c)} style={{ display: "flex", alignItems: "center", gap: 14, padding: "13px 16px", borderTop: top, cursor: "pointer" }}>
                          <Ring size={42} stroke={5} pct={cover} color={C.green}><CreditCard size={15} color={C.green} /></Ring>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontFamily: F, fontSize: 15, fontWeight: 700, color: C.ink }}>{c.name}</div>
                            <div style={{ fontFamily: F, fontSize: 12, color: C.muted, marginTop: 1 }}>fatura atual {fmt(Math.max(0, debt))}</div>
                          </div>
                          <div style={{ textAlign: "right" }}>
                            <div style={{ fontFamily: F, fontSize: 15, fontWeight: 800, color: tcol }}>{fmt(av)}</div>
                            <div style={{ fontFamily: F, fontSize: 10, fontWeight: 600, color: C.muted }}>reservado p/ pagar</div>
                          </div>
                        </div>
                      );
                    }
                    const a = assignedM(c.id, month), sp = Math.max(0, spentM(c.id, month)), fund = cumAssigned(c.id, month);
                    const p = fund > 0 ? cumSpent(c.id, month) / fund : 0;
                    return (
                      <div key={c.id} onClick={() => setEditingCat(c)} style={{ display: "flex", alignItems: "center", gap: 14, padding: "13px 16px", borderTop: top, cursor: "pointer" }}>
                        <Ring size={42} stroke={5} pct={fund > 0 ? p : 0} color={av < -0.005 ? C.red : C.green}>
                          <span style={{ fontFamily: F, fontSize: 10, fontWeight: 700, color: C.ink }}>{fund > 0 ? Math.round(p * 100) + "%" : "–"}</span>
                        </Ring>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontFamily: F, fontSize: 15, fontWeight: 700, color: C.ink }}>{c.name}</div>
                          <div style={{ fontFamily: F, fontSize: 12, color: C.muted, marginTop: 1 }}>+{fmt(a)} este mês · gasto {fmt(sp)}</div>
                          {Math.abs(ci) > 0.005 && (
                            <div style={{ display: "inline-flex", alignItems: "center", gap: 3, fontFamily: F, fontSize: 11, fontWeight: 600, color: ci < 0 ? C.red : C.green, marginTop: 3 }}>
                              <CornerDownRight size={12} />{fmt(ci)} veio do mês anterior
                            </div>
                          )}
                          {(() => { const gs = goalStatus(c.id, month); if (!gs) return null; return (
                            <div style={{ display: "inline-flex", alignItems: "center", gap: 3, fontFamily: F, fontSize: 11, fontWeight: 600, color: gs.onTrack ? C.green : C.amber, marginTop: 3 }}>
                              <Flag size={11} />{gs.onTrack ? "meta no caminho" : `faltam ${fmt(gs.needed)}`}
                            </div>
                          ); })()}
                        </div>
                        <button onClick={(e) => { e.stopPropagation(); setEditingCatMeta(c); }} style={{ background: "none", border: "none", cursor: "pointer", padding: 4, display: "grid", placeItems: "center" }}>
                          <Pencil size={14} color={C.muted} />
                        </button>
                        <div style={{ fontFamily: F, fontSize: 15, fontWeight: 800, color: tcol, minWidth: 78, textAlign: "right" }}>{fmt(av)}</div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
        <div style={{ display: "flex", gap: 10 }}>
          <Ghost onClick={() => setModal("category")}>+ Categoria</Ghost>
          <Ghost onClick={() => setModal("group")}>+ Grupo</Ghost>
        </div>
      </div>
    );
  };

  const Summary = () => {
    const cats = data.categories.filter((c) => !c.cardId).map((c) => ({ ...c, sp: Math.max(0, spentM(c.id, month)) })).filter((c) => c.sp > 0).sort((a, b) => b.sp - a.sp);
    const totalAvailPos = data.categories.reduce((s, c) => s + Math.max(0, available(c.id, month)), 0);
    return (
      <div>
        <MonthNav /><div style={{ height: 18 }} />
        <div style={{ background: C.white, borderRadius: 20, border: `1px solid ${C.line}`, padding: 18, marginBottom: 14, boxShadow: "0 1px 3px rgba(20,40,10,.04)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
            <Lightbulb size={16} color={C.green} /><span style={{ fontFamily: F, fontSize: 14, fontWeight: 700, color: C.ink }}>Visão geral</span>
          </div>
          <div style={{ background: C.mint, borderRadius: 16, padding: "14px 16px", display: "flex", alignItems: "center", gap: 14 }}>
            <div style={{ width: 42, height: 42, borderRadius: 12, background: C.white, display: "grid", placeItems: "center" }}><Banknote size={20} color={C.green} /></div>
            <div>
              <div style={{ fontFamily: F, fontSize: 20, fontWeight: 800, color: C.ink }}>{fmt(totalAvailPos)}</div>
              <div style={{ fontFamily: F, fontSize: 12, color: C.body }}>reservado nos envelopes</div>
            </div>
          </div>
        </div>
        <div style={{ background: C.white, borderRadius: 20, border: `1px solid ${C.line}`, padding: 18, boxShadow: "0 1px 3px rgba(20,40,10,.04)" }}>
          <div style={{ fontFamily: F, fontSize: 13, fontWeight: 600, color: C.body }}>Gastos do mês</div>
          <div style={{ fontFamily: F, fontSize: 30, fontWeight: 800, color: C.ink, margin: "2px 0 18px" }}>{fmt(totalSpentM)}</div>
          {cats.length === 0 && <div style={{ fontFamily: F, fontSize: 14, color: C.muted }}>Sem gastos neste mês.</div>}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 16 }}>
            {cats.slice(0, 6).map((c, i) => {
              const share = totalSpentM > 0 ? c.sp / totalSpentM : 0;
              return (
                <div key={c.id} style={{ textAlign: "center" }}>
                  <div style={{ display: "grid", placeItems: "center" }}>
                    <Ring size={66} stroke={7} pct={share} color={RING_COLORS[i % RING_COLORS.length]}>
                      <span style={{ fontFamily: F, fontSize: 14, fontWeight: 800, color: C.ink }}>{Math.round(share * 100)}%</span>
                    </Ring>
                  </div>
                  <div style={{ fontFamily: F, fontSize: 12, fontWeight: 600, color: C.body, marginTop: 6 }}>{c.name}</div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    );
  };

  const Accounts = () => (
    <div>
      <H>Contas</H>
      {data.accounts.map((a) => {
        const bal = accBalanceNow(a);
        if (a.type === "credit") {
          const debt = cardDebt(a);
          const reserved = cardReserved(a);
          const pct = debt > 0 ? clamp(reserved / debt, 0, 1) : 1;
          return (
            <div key={a.id} style={{ background: C.white, border: `1px solid ${C.line}`, borderRadius: 20, padding: "16px 18px", marginBottom: 12, boxShadow: "0 1px 3px rgba(20,40,10,.04)" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: debt > 0 ? 14 : 0 }}>
                <div style={{ width: 44, height: 44, borderRadius: 13, background: "#FDE7EC", display: "grid", placeItems: "center", color: C.red }}>
                  <CreditCard size={21} />
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontFamily: F, fontSize: 15, fontWeight: 700, color: C.ink }}>{a.name}</div>
                  <div style={{ fontFamily: F, fontSize: 12, color: C.muted }}>{debt > 0.005 ? `total devido: ${fmt(debt)}` : "quitado ✓"}</div>
                </div>
                <button onClick={() => setEditingDebt(a)} style={{ background: C.page, border: `1px solid ${C.line}`, borderRadius: 10, padding: "6px 10px", fontFamily: F, fontSize: 12, fontWeight: 700, color: C.body, cursor: "pointer" }}>Atualizar</button>
              </div>
              {debt > 0.005 && (
                <>
                  <div style={{ display: "flex", justifyContent: "space-between", fontFamily: F, fontSize: 12, fontWeight: 600, marginBottom: 6 }}>
                    <span style={{ color: C.body }}>Reservado para pagar</span>
                    <span style={{ color: reserved >= debt ? C.green : C.amber }}>{fmt(reserved)} de {fmt(debt)}</span>
                  </div>
                  <div style={{ background: C.track, borderRadius: 999, height: 8, overflow: "hidden", marginBottom: 8 }}>
                    <div style={{ background: pct >= 1 ? C.green : C.amber, height: "100%", width: `${Math.round(pct * 100)}%`, borderRadius: 999, transition: "width .4s ease" }} />
                  </div>
                  <div style={{ fontFamily: F, fontSize: 11, color: C.muted }}>
                    {pct >= 1 ? "✓ dívida totalmente coberta pelos envelopes" : `faltam ${fmt(debt - reserved)} para cobrir a dívida total`}
                  </div>
                </>
              )}
            </div>
          );
        }
        return (
          <div key={a.id} style={{ background: C.white, border: `1px solid ${C.line}`, borderRadius: 20, padding: "16px 18px", marginBottom: 12, display: "flex", alignItems: "center", gap: 14, boxShadow: "0 1px 3px rgba(20,40,10,.04)" }}>
            <div style={{ width: 44, height: 44, borderRadius: 13, background: C.mint, display: "grid", placeItems: "center", color: C.green }}>
              <Banknote size={21} />
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontFamily: F, fontSize: 15, fontWeight: 700, color: C.ink }}>{a.name}</div>
              <div style={{ fontFamily: F, fontSize: 12, color: C.muted }}>Conta / dinheiro</div>
            </div>
            <div style={{ fontFamily: F, fontSize: 18, fontWeight: 800, color: bal < 0 ? C.red : C.ink }}>{fmt(bal)}</div>
          </div>
        );
      })}
      <div style={{ display: "flex", gap: 10 }}>
        <Ghost onClick={() => setModal("account")}>+ Nova conta</Ghost>
        {creditAccounts.length > 0 && <Ghost onClick={() => setModal("pay")}>Pagar fatura</Ghost>}
      </div>
    </div>
  );

  const Transactions = () => {
    const txs = [...data.transactions].sort((a, b) => (a.date < b.date ? 1 : -1));
    const accName = (id) => data.accounts.find((a) => a.id === id)?.name || "—";
    const catName = (id) => data.categories.find((c) => c.id === id)?.name;
    return (
      <div>
        <H>Transações</H>
        {txs.length === 0 && <div style={{ color: C.muted, fontFamily: F, fontSize: 14, padding: "8px 2px" }}>Nenhuma transação. Toque no + para adicionar.</div>}
        {txs.map((t) => {
          if (t.type === "payment") {
            return (
              <div key={t.id} style={{ background: C.white, border: `1px solid ${C.line}`, borderRadius: 18, padding: "13px 16px", marginBottom: 10, display: "flex", alignItems: "center", gap: 12, boxShadow: "0 1px 3px rgba(20,40,10,.04)" }}>
                <div style={{ width: 38, height: 38, borderRadius: 11, display: "grid", placeItems: "center", background: C.mint, color: C.green }}><CreditCard size={18} /></div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontFamily: F, fontSize: 14, fontWeight: 700, color: C.ink }}>Pagamento de fatura</div>
                  <div style={{ fontFamily: F, fontSize: 12, color: C.muted }}>{accName(t.fromCash)} → {accName(t.cardId)} · {t.date.slice(8, 10)}/{t.date.slice(5, 7)}</div>
                </div>
                <div style={{ fontFamily: F, fontSize: 15, fontWeight: 800, color: C.ink }}>{fmt(t.amount)}</div>
                <Trash2 size={16} color={C.muted} style={{ cursor: "pointer" }} onClick={() => update((d) => ({ ...d, transactions: d.transactions.filter((x) => x.id !== t.id) }))} />
              </div>
            );
          }
          const card = data.accounts.find((a) => a.id === t.accountId)?.type === "credit";
          return (
            <div key={t.id} style={{ background: C.white, border: `1px solid ${C.line}`, borderRadius: 18, padding: "13px 16px", marginBottom: 10, display: "flex", alignItems: "center", gap: 12, boxShadow: "0 1px 3px rgba(20,40,10,.04)" }}>
              <div style={{ width: 38, height: 38, borderRadius: 11, display: "grid", placeItems: "center", background: t.type === "inflow" ? C.mint : "#FDE7EC", color: t.type === "inflow" ? C.green : C.red }}>
                {t.type === "inflow" ? <ArrowDownLeft size={18} /> : <ArrowUpRight size={18} />}
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontFamily: F, fontSize: 14, fontWeight: 700, color: C.ink }}>{t.payee || (t.type === "inflow" ? "Entrada" : "Saída")}</div>
                <div style={{ fontFamily: F, fontSize: 12, color: C.muted }}>{accName(t.accountId)}{card ? " 💳" : ""}{t.type === "outflow" && catName(t.categoryId) ? ` · ${catName(t.categoryId)}` : ""} · {t.date.slice(8, 10)}/{t.date.slice(5, 7)}</div>
              </div>
              <div style={{ fontFamily: F, fontSize: 15, fontWeight: 800, color: t.type === "inflow" ? C.green : C.ink }}>{t.type === "inflow" ? "+" : "−"}{fmt(t.amount)}</div>
              <Trash2 size={16} color={C.muted} style={{ cursor: "pointer" }} onClick={() => update((d) => ({ ...d, transactions: d.transactions.filter((x) => x.id !== t.id) }))} />
            </div>
          );
        })}
      </div>
    );
  };

  return (
    <div style={{ background: C.page, minHeight: "100vh", maxWidth: 460, margin: "0 auto", position: "relative", paddingBottom: 100 }}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap');* { -webkit-tap-highlight-color: transparent; }`}</style>
      <header style={{ padding: "20px 20px 6px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ fontFamily: F, fontSize: 24, fontWeight: 800, color: C.ink }}>Meu Orçamento</div>
        <button onClick={() => supabase.auth.signOut()} title="Sair" style={{ width: 38, height: 38, borderRadius: 12, background: C.white, border: `1px solid ${C.line}`, display: "grid", placeItems: "center", cursor: "pointer" }}><LogOut size={17} color={C.green} /></button>
      </header>
      <main style={{ padding: "6px 18px" }}>
        {tab === "budget" && <Budget />}
        {tab === "goals" && <GoalsTab data={data} month={month} goalStatus={goalStatus} setEditingGoal={setEditingGoal} />}
        {tab === "summary" && <Summary />}
        {tab === "accounts" && <Accounts />}
        {tab === "tx" && <Transactions />}
      </main>
      <button onClick={() => setModal("tx")} style={{ position: "fixed", bottom: 88, left: "50%", transform: "translateX(140px)", maxWidth: 460, width: 58, height: 58, borderRadius: "50%", background: C.green, color: "#fff", border: "none", boxShadow: "0 10px 22px rgba(91,168,46,.45)", display: "grid", placeItems: "center", cursor: "pointer", zIndex: 20 }}>
        <Plus size={28} />
      </button>
      <nav style={{ position: "fixed", bottom: 0, left: "50%", transform: "translateX(-50%)", width: "100%", maxWidth: 460, background: C.white, borderTop: `1px solid ${C.line}`, display: "flex", padding: "12px 0 16px", zIndex: 15 }}>
        {[
          { k: "budget", icon: <PiggyBank size={22} />, l: "Orçamento" },
          { k: "goals", icon: <Target size={22} />, l: "Metas" },
          { k: "summary", icon: <BarChart3 size={22} />, l: "Resumo" },
          { k: "accounts", icon: <Wallet size={22} />, l: "Contas" },
          { k: "tx", icon: <Receipt size={22} />, l: "Transações" },
        ].map((n) => (
          <button key={n.k} onClick={() => setTab(n.k)} style={{ flex: 1, background: "none", border: "none", display: "grid", justifyItems: "center", gap: 4, cursor: "pointer", color: tab === n.k ? C.green : C.muted }}>
            {n.icon}<span style={{ fontFamily: F, fontSize: 11, fontWeight: 700 }}>{n.l}</span>
          </button>
        ))}
      </nav>
      {modal === "tx" && <TxModal data={data} update={update} close={() => setModal(null)} />}
      {modal === "pay" && <PayModal data={data} creditAccounts={creditAccounts} update={update} close={() => setModal(null)} />}
      {modal === "account" && <AccountModal update={update} close={() => setModal(null)} />}
      {modal === "category" && <CategoryModal data={data} update={update} close={() => setModal(null)} />}
      {modal === "group" && <GroupModal update={update} close={() => setModal(null)} />}
      {editingCatMeta && <EditCategoryModal cat={editingCatMeta} data={data} update={update} close={() => setEditingCatMeta(null)} />}
      {editingGroup && <EditGroupModal group={editingGroup} data={data} update={update} close={() => setEditingGroup(null)} />}
      {editingGoal !== null && <GoalModal cat={editingGoal} goal={data.goals[editingGoal?.id]} update={update} close={() => setEditingGoal(null)} />}
      {editingDebt && <DebtModal account={editingDebt} update={update} close={() => setEditingDebt(null)} />}
      {editingCat && <AssignModal cat={editingCat} monthName={monthLabel(month)}
        assigned={assignedM(editingCat.id, month)} carryIn={carryIn(editingCat.id, month)} activity={activityM(editingCat.id, month)} month={month}
        onMove={() => { const id = editingCat.id; setEditingCat(null); setMoving(id); }}
        update={update} close={() => setEditingCat(null)} />}
      {moving !== null && <MoveModal month={month} monthName={monthLabel(month)} initialFrom={moving}
        options={[{ id: "RTA", name: "Pronto para distribuir" }, ...data.categories]}
        availOf={(id) => (id === "RTA" ? rta : available(id, month))}
        update={update} close={() => setMoving(null)} />}
    </div>
  );
}

// ---------- helpers ----------
const navBtn = { width: 34, height: 34, borderRadius: 11, background: C.white, border: `1px solid ${C.line}`, display: "grid", placeItems: "center", cursor: "pointer" };
const H = ({ children }) => <div style={{ fontFamily: F, fontSize: 22, fontWeight: 800, color: C.ink, margin: "6px 0 16px" }}>{children}</div>;
const Ghost = ({ children, onClick }) => (
  <button onClick={onClick} style={{ background: C.mint, border: "none", color: C.greenDark, borderRadius: 14, padding: "12px 16px", fontFamily: F, fontSize: 14, fontWeight: 700, cursor: "pointer", marginTop: 4 }}>{children}</button>
);
const Field = ({ label, children }) => (
  <label style={{ display: "block", marginBottom: 14 }}>
    <div style={{ fontFamily: F, fontSize: 12, fontWeight: 700, color: C.body, marginBottom: 6 }}>{label}</div>{children}
  </label>
);
const inputStyle = { width: "100%", boxSizing: "border-box", border: `1px solid ${C.line}`, borderRadius: 13, padding: "13px 14px", fontFamily: F, fontSize: 16, fontWeight: 500, color: C.ink, background: C.page, outline: "none" };
function Shell({ title, children, close }) {
  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(23,28,18,.42)", zIndex: 40, display: "flex", alignItems: "flex-end", justifyContent: "center" }} onClick={close}>
      <div onClick={(e) => e.stopPropagation()} style={{ background: C.white, width: "100%", maxWidth: 460, borderRadius: "26px 26px 0 0", padding: "22px 20px 28px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 18 }}>
          <div style={{ fontFamily: F, fontSize: 19, fontWeight: 800, color: C.ink }}>{title}</div>
          <X size={22} color={C.muted} style={{ cursor: "pointer" }} onClick={close} />
        </div>
        {children}
      </div>
    </div>
  );
}
const SaveBtn = ({ onClick, children }) => (
  <button onClick={onClick} style={{ width: "100%", background: C.green, color: "#fff", border: "none", borderRadius: 15, padding: "15px", fontFamily: F, fontSize: 16, fontWeight: 700, cursor: "pointer", display: "flex", justifyContent: "center", alignItems: "center", gap: 8 }}>
    <Check size={18} />{children}
  </button>
);
const Seg = ({ opts, value, onChange }) => (
  <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
    {opts.map(([k, l]) => (
      <button key={k} onClick={() => onChange(k)} style={{ flex: 1, padding: "11px 6px", borderRadius: 13, border: `1.5px solid ${value === k ? C.green : C.line}`, background: value === k ? C.mint : C.white, color: value === k ? C.greenDark : C.body, fontFamily: F, fontWeight: 700, fontSize: 13, cursor: "pointer" }}>{l}</button>
    ))}
  </div>
);
const Row = ({ l, v, c }) => (
  <div style={{ display: "flex", justifyContent: "space-between", fontFamily: F, fontSize: 13, marginBottom: 6 }}>
    <span style={{ color: C.body }}>{l}</span><span style={{ fontWeight: 700, color: c || C.ink }}>{fmt(v)}</span>
  </div>
);

function TxModal({ data, update, close }) {
  const [type, setType] = useState("outflow");
  const [amount, setAmount] = useState(""); const [payee, setPayee] = useState("");
  const [accountId, setAccountId] = useState(data.accounts[0]?.id || "");
  const realCats = data.categories.filter((c) => !c.cardId);
  const [categoryId, setCategoryId] = useState(realCats[0]?.id || "");
  const [date, setDate] = useState(todayISO());
  const onCard = data.accounts.find((a) => a.id === accountId)?.type === "credit";
  const save = () => {
    const amt = parseFloat(String(amount).replace(",", ".")); if (!amt || !accountId) return;
    update((d) => ({ ...d, transactions: [...d.transactions, { id: uid(), type, amount: Math.abs(amt), payee, accountId, categoryId: type === "outflow" ? categoryId : null, date }] }));
    close();
  };
  return (
    <Shell title="Nova transação" close={close}>
      <Seg opts={[["outflow", "Saída"], ["inflow", "Entrada"]]} value={type} onChange={setType} />
      <Field label="Valor (R$)"><input style={inputStyle} inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0,00" /></Field>
      <Field label={type === "inflow" ? "Origem" : "Beneficiário"}><input style={inputStyle} value={payee} onChange={(e) => setPayee(e.target.value)} placeholder={type === "inflow" ? "Salário, Pix…" : "Mercado, posto…"} /></Field>
      <Field label="Conta / cartão"><select style={inputStyle} value={accountId} onChange={(e) => setAccountId(e.target.value)}>{data.accounts.map((a) => <option key={a.id} value={a.id}>{a.name}{a.type === "credit" ? " (cartão)" : ""}</option>)}</select></Field>
      {type === "outflow" && <Field label="Categoria"><select style={inputStyle} value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>{realCats.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></Field>}
      {type === "outflow" && onCard && <div style={{ background: C.mint, borderRadius: 12, padding: "10px 12px", marginTop: -4, marginBottom: 14, fontFamily: F, fontSize: 12, color: C.greenDark, fontWeight: 600 }}>Compra no crédito: o valor sai do envelope da categoria e vai reservado para o pagamento da fatura.</div>}
      <Field label="Data"><input type="date" style={inputStyle} value={date} onChange={(e) => setDate(e.target.value)} /></Field>
      <SaveBtn onClick={save}>Salvar</SaveBtn>
    </Shell>
  );
}

function PayModal({ data, creditAccounts, update, close }) {
  const cashAccounts = data.accounts.filter((a) => a.type === "cash");
  const [cardId, setCardId] = useState(creditAccounts[0]?.id || "");
  const [fromCash, setFromCash] = useState(cashAccounts[0]?.id || "");
  const [amount, setAmount] = useState(""); const [date, setDate] = useState(todayISO());
  const save = () => {
    const amt = parseFloat(String(amount).replace(",", ".")); if (!amt || !cardId || !fromCash) return;
    update((d) => ({ ...d, transactions: [...d.transactions, { id: uid(), type: "payment", amount: Math.abs(amt), cardId, fromCash, date }] }));
    close();
  };
  return (
    <Shell title="Pagar fatura do cartão" close={close}>
      <Field label="Cartão"><select style={inputStyle} value={cardId} onChange={(e) => setCardId(e.target.value)}>{creditAccounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}</select></Field>
      <Field label="Pagar com"><select style={inputStyle} value={fromCash} onChange={(e) => setFromCash(e.target.value)}>{cashAccounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}</select></Field>
      <Field label="Valor (R$)"><input style={inputStyle} inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0,00" /></Field>
      <Field label="Data"><input type="date" style={inputStyle} value={date} onChange={(e) => setDate(e.target.value)} /></Field>
      <div style={{ background: C.mint, borderRadius: 12, padding: "10px 12px", marginBottom: 16, fontFamily: F, fontSize: 12, color: C.greenDark, fontWeight: 600 }}>O dinheiro sai do caixa, a dívida do cartão diminui e o envelope de pagamento esvazia na mesma medida.</div>
      <SaveBtn onClick={save}>Registrar pagamento</SaveBtn>
    </Shell>
  );
}

function AccountModal({ update, close }) {
  const [name, setName] = useState(""); const [type, setType] = useState("cash"); const [bal, setBal] = useState("");
  const save = () => {
    if (!name.trim()) return;
    update((d) => {
      const acctId = uid();
      const accounts = [...d.accounts, { id: acctId, name: name.trim(), type, initialBalance: type === "credit" ? 0 : (parseFloat(String(bal).replace(",", ".")) || 0) }];
      let groups = d.groups, categories = d.categories;
      if (type === "credit") {
        let pg = d.groups.find((g) => g.isPayment); let gid;
        if (!pg) { gid = uid(); groups = [...d.groups, { id: gid, name: "Cartões de crédito", isPayment: true }]; } else gid = pg.id;
        categories = [...d.categories, { id: uid(), groupId: gid, name: `Pagamento — ${name.trim()}`, cardId: acctId }];
      }
      return { ...d, accounts, groups, categories };
    });
    close();
  };
  return (
    <Shell title="Nova conta" close={close}>
      <Field label="Nome"><input style={inputStyle} value={name} onChange={(e) => setName(e.target.value)} placeholder={type === "credit" ? "Nubank, Itaú…" : "Conta corrente, dinheiro…"} /></Field>
      <Seg opts={[["cash", "Conta / dinheiro"], ["credit", "Cartão de crédito"]]} value={type} onChange={setType} />
      {type === "cash"
        ? <Field label="Saldo inicial (R$)"><input style={inputStyle} inputMode="decimal" value={bal} onChange={(e) => setBal(e.target.value)} placeholder="0,00" /></Field>
        : <div style={{ background: C.mint, borderRadius: 12, padding: "10px 12px", marginBottom: 16, fontFamily: F, fontSize: 12, color: C.greenDark, fontWeight: 600 }}>Será criado automaticamente o envelope "Pagamento — {name.trim() || "cartão"}". O cartão começa zerado e a fatura cresce conforme os gastos.</div>}
      <SaveBtn onClick={save}>Adicionar conta</SaveBtn>
    </Shell>
  );
}
function CategoryModal({ data, update, close }) {
  const realGroups = data.groups.filter((g) => !g.isPayment);
  const [name, setName] = useState(""); const [groupId, setGroupId] = useState(realGroups[0]?.id || "");
  const save = () => { if (!name.trim() || !groupId) return; update((d) => ({ ...d, categories: [...d.categories, { id: uid(), groupId, name: name.trim() }] })); close(); };
  return (
    <Shell title="Nova categoria" close={close}>
      <Field label="Nome"><input style={inputStyle} value={name} onChange={(e) => setName(e.target.value)} placeholder="Academia, Pet, Streaming…" /></Field>
      <Field label="Grupo"><select style={inputStyle} value={groupId} onChange={(e) => setGroupId(e.target.value)}>{realGroups.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}</select></Field>
      <SaveBtn onClick={save}>Adicionar categoria</SaveBtn>
    </Shell>
  );
}
function GroupModal({ update, close }) {
  const [name, setName] = useState("");
  const save = () => { if (!name.trim()) return; update((d) => ({ ...d, groups: [...d.groups, { id: uid(), name: name.trim() }] })); close(); };
  return (
    <Shell title="Novo grupo" close={close}>
      <Field label="Nome"><input style={inputStyle} value={name} onChange={(e) => setName(e.target.value)} placeholder="Moradia, Lazer, Metas…" /></Field>
      <SaveBtn onClick={save}>Adicionar grupo</SaveBtn>
    </Shell>
  );
}
function AssignModal({ cat, monthName, assigned, carryIn, activity, month, onMove, update, close }) {
  const [v, setV] = useState(String(assigned || ""));
  const newAssigned = parseFloat(String(v).replace(",", ".")) || 0;
  const resultado = carryIn + newAssigned + activity;
  const isPay = !!cat.cardId;
  const save = () => {
    update((d) => {
      const catMap = { ...(d.assigned[cat.id] || {}) };
      if (newAssigned) catMap[month] = newAssigned; else delete catMap[month];
      return { ...d, assigned: { ...d.assigned, [cat.id]: catMap } };
    });
    close();
  };
  return (
    <Shell title={cat.name} close={close}>
      <div style={{ fontFamily: F, fontSize: 12, fontWeight: 600, color: C.muted, marginTop: -8, marginBottom: 14 }}>{monthName}{isPay ? " · envelope de pagamento" : ""}</div>
      <Field label="Atribuir a este envelope neste mês (R$)"><input autoFocus style={inputStyle} inputMode="decimal" value={v} onChange={(e) => setV(e.target.value)} placeholder="0,00" /></Field>
      <div style={{ background: C.page, borderRadius: 14, padding: "14px 16px", marginBottom: 18 }}>
        <Row l="Veio do mês anterior" v={carryIn} c={carryIn < 0 ? C.red : C.green} />
        <Row l="Atribuído este mês" v={newAssigned} />
        <Row l={isPay ? "Reservado − pago no mês" : "Gasto este mês"} v={activity} c={activity < 0 ? C.red : C.green} />
        <div style={{ borderTop: `1px solid ${C.line}`, margin: "8px 0" }} />
        <Row l="Disponível" v={resultado} c={resultado < 0 ? C.red : C.green} />
      </div>
      <SaveBtn onClick={save}>Salvar</SaveBtn>
      <button onClick={onMove} style={{ width: "100%", marginTop: 10, background: "transparent", border: "none", color: C.greenDark, fontFamily: F, fontSize: 14, fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 7 }}>
        <ArrowLeftRight size={15} /> Mover dinheiro deste envelope
      </button>
    </Shell>
  );
}
function MoveModal({ month, monthName, initialFrom, options, availOf, update, close }) {
  const [fromId, setFromId] = useState(initialFrom);
  const [toId, setToId] = useState(options.find((o) => o.id !== initialFrom)?.id || "RTA");
  const [amount, setAmount] = useState("");
  const X = parseFloat(String(amount).replace(",", ".")) || 0;
  const fromAvail = availOf(fromId), toAvail = availOf(toId);
  const name = (id) => options.find((o) => o.id === id)?.name;
  const valid = X > 0 && fromId !== toId;
  const save = () => {
    if (!valid) return;
    update((d) => {
      const next = { ...d.assigned };
      const bump = (id, delta) => {
        if (id === "RTA") return;
        const m = { ...(next[id] || {}) }; m[month] = (m[month] || 0) + delta;
        if (Math.abs(m[month]) < 1e-4) delete m[month]; next[id] = m;
      };
      bump(fromId, -X); bump(toId, +X);
      return { ...d, assigned: next };
    });
    close();
  };
  const PreviewRow = ({ id, after, danger }) => (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontFamily: F, fontSize: 13, marginBottom: 6 }}>
      <span style={{ color: C.body, fontWeight: 600 }}>{name(id)}</span>
      <span style={{ fontWeight: 700, color: danger ? C.red : C.ink }}>{fmt(availOf(id))} → {fmt(after)}</span>
    </div>
  );
  return (
    <Shell title="Mover dinheiro" close={close}>
      <div style={{ fontFamily: F, fontSize: 12, fontWeight: 600, color: C.muted, marginTop: -8, marginBottom: 14 }}>{monthName}</div>
      <Field label="De"><select style={inputStyle} value={fromId} onChange={(e) => setFromId(e.target.value)}>{options.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}</select></Field>
      <Field label="Para"><select style={inputStyle} value={toId} onChange={(e) => setToId(e.target.value)}>{options.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}</select></Field>
      <Field label="Valor (R$)"><input autoFocus style={inputStyle} inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0,00" /></Field>
      <div style={{ background: C.page, borderRadius: 14, padding: "14px 16px", marginBottom: 18 }}>
        <PreviewRow id={fromId} after={fromAvail - X} danger={fromAvail - X < -0.005} />
        <PreviewRow id={toId} after={toAvail + X} />
      </div>
      <SaveBtn onClick={save}>Mover</SaveBtn>
    </Shell>
  );
}

// ---- METAS ----
function DebtModal({ account, update, close }) {
  const [debt, setDebt] = useState(String(account.debtBalance || ""));
  const save = () => {
    const val = parseFloat(String(debt).replace(",", ".")) || 0;
    update((d) => ({ ...d, accounts: d.accounts.map((a) => a.id === account.id ? { ...a, debtBalance: val } : a) }));
    close();
  };
  return (
    <Shell title={`Saldo devedor — ${account.name}`} close={close}>
      <div style={{ background: C.mint, borderRadius: 14, padding: "12px 14px", marginBottom: 16, fontFamily: F, fontSize: 13, color: C.greenDark, fontWeight: 600 }}>
        Consulte o total devido no app do banco — inclua fatura atual + todas as parcelas futuras em aberto. Atualize sempre que pagar ou surgir nova parcela.
      </div>
      <Field label="Total devido agora (R$)">
        <input autoFocus style={inputStyle} inputMode="decimal" value={debt} onChange={(e) => setDebt(e.target.value)} placeholder="0,00" />
      </Field>
      <SaveBtn onClick={save}>Salvar</SaveBtn>
    </Shell>
  );
}

const GOAL_TYPES = [
  { k: "target", label: "Valor alvo", icon: <CalendarDays size={16} />, desc: "Juntar R$ X até uma data" },
  { k: "monthly", label: "Gasto mensal", icon: <TrendingUp size={16} />, desc: "Ter R$ X disponível todo mês" },
  { k: "balance", label: "Saldo mínimo", icon: <ShieldCheck size={16} />, desc: "Manter pelo menos R$ X no envelope" },
];

function GoalsTab({ data, month, goalStatus, setEditingGoal }) {
  const cats = data.categories.filter((c) => !c.cardId);
  const withGoal = cats.filter((c) => data.goals[c.id]);
  const withoutGoal = cats.filter((c) => !data.goals[c.id]);
  const done = withGoal.filter((c) => goalStatus(c.id, month)?.onTrack).length;

  return (
    <div>
      <H>Metas</H>
      {withGoal.length > 0 && (
        <div style={{ background: C.mint, borderRadius: 20, padding: "14px 18px", marginBottom: 18, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <div style={{ fontFamily: F, fontSize: 13, fontWeight: 600, color: C.body }}>No caminho este mês</div>
            <div style={{ fontFamily: F, fontSize: 22, fontWeight: 800, color: C.ink }}>{done} de {withGoal.length}</div>
          </div>
          <Ring size={56} stroke={7} pct={withGoal.length > 0 ? done / withGoal.length : 0} color={C.green}>
            <span style={{ fontFamily: F, fontSize: 13, fontWeight: 800, color: C.ink }}>{Math.round(done / Math.max(1, withGoal.length) * 100)}%</span>
          </Ring>
        </div>
      )}

      {withGoal.map((c) => {
        const g = data.goals[c.id];
        const gs = goalStatus(c.id, month);
        const typeInfo = GOAL_TYPES.find((t) => t.k === g.type);
        const barColor = gs?.onTrack ? C.green : C.amber;
        return (
          <div key={c.id} onClick={() => setEditingGoal(c)} style={{ background: C.white, border: `1px solid ${C.line}`, borderRadius: 20, padding: "16px 18px", marginBottom: 12, cursor: "pointer", boxShadow: "0 1px 3px rgba(20,40,10,.04)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 10 }}>
              <div>
                <div style={{ fontFamily: F, fontSize: 15, fontWeight: 700, color: C.ink }}>{c.name}</div>
                <div style={{ display: "inline-flex", alignItems: "center", gap: 4, fontFamily: F, fontSize: 11, fontWeight: 600, color: C.body, marginTop: 3, background: C.page, borderRadius: 999, padding: "2px 8px" }}>
                  {typeInfo?.icon}{typeInfo?.label}
                </div>
              </div>
              <div style={{ textAlign: "right" }}>
                <div style={{ fontFamily: F, fontSize: 14, fontWeight: 800, color: gs?.onTrack ? C.green : C.amber }}>{gs?.onTrack ? "✓ no caminho" : `faltam ${fmt(gs?.needed)}`}</div>
                <div style={{ fontFamily: F, fontSize: 12, color: C.muted, marginTop: 2 }}>{gs?.label}</div>
              </div>
            </div>
            <div style={{ background: C.track, borderRadius: 999, height: 8, overflow: "hidden" }}>
              <div style={{ background: barColor, height: "100%", width: `${Math.round((gs?.progress || 0) * 100)}%`, borderRadius: 999, transition: "width .4s ease" }} />
            </div>
            {g.type === "target" && g.targetDate && (
              <div style={{ fontFamily: F, fontSize: 11, color: C.muted, marginTop: 6 }}>
                até {new Date(g.targetDate + "-01").toLocaleDateString("pt-BR", { month: "long", year: "numeric" })} · {gs?.monthsLeft} {gs?.monthsLeft === 1 ? "mês" : "meses"} restantes
              </div>
            )}
          </div>
        );
      })}

      {withoutGoal.length > 0 && (
        <>
          <div style={{ fontFamily: F, fontSize: 13, fontWeight: 700, color: C.muted, margin: "18px 0 10px 4px" }}>SEM META</div>
          {withoutGoal.map((c) => (
            <div key={c.id} onClick={() => setEditingGoal(c)} style={{ background: C.white, border: `1.5px dashed ${C.line}`, borderRadius: 20, padding: "14px 18px", marginBottom: 10, display: "flex", justifyContent: "space-between", alignItems: "center", cursor: "pointer" }}>
              <div style={{ fontFamily: F, fontSize: 15, fontWeight: 600, color: C.ink }}>{c.name}</div>
              <div style={{ display: "flex", alignItems: "center", gap: 6, fontFamily: F, fontSize: 13, fontWeight: 700, color: C.green }}>
                <Plus size={14} /> Definir meta
              </div>
            </div>
          ))}
        </>
      )}
    </div>
  );
}

function GoalModal({ cat, goal, update, close }) {
  const [type, setType] = useState(goal?.type || "target");
  const [amount, setAmount] = useState(String(goal?.amount || ""));
  const [targetDate, setTargetDate] = useState(goal?.targetDate || "");

  const save = () => {
    const amt = parseFloat(String(amount).replace(",", "."));
    if (!amt) return;
    const g = { type, amount: amt };
    if (type === "target") { if (!targetDate) return; g.targetDate = targetDate; }
    update((d) => ({ ...d, goals: { ...d.goals, [cat.id]: g } }));
    close();
  };
  const remove = () => {
    update((d) => { const goals = { ...d.goals }; delete goals[cat.id]; return { ...d, goals }; });
    close();
  };

  return (
    <Shell title={`Meta — ${cat.name}`} close={close}>
      <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 16 }}>
        {GOAL_TYPES.map((t) => (
          <button key={t.k} onClick={() => setType(t.k)} style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 14px", borderRadius: 14, border: `1.5px solid ${type === t.k ? C.green : C.line}`, background: type === t.k ? C.mint : C.white, cursor: "pointer", textAlign: "left" }}>
            <div style={{ color: C.green }}>{t.icon}</div>
            <div>
              <div style={{ fontFamily: F, fontSize: 14, fontWeight: 700, color: C.ink }}>{t.label}</div>
              <div style={{ fontFamily: F, fontSize: 12, color: C.muted }}>{t.desc}</div>
            </div>
          </button>
        ))}
      </div>
      <Field label={type === "target" ? "Valor total a poupar (R$)" : type === "monthly" ? "Valor mensal desejado (R$)" : "Saldo mínimo (R$)"}>
        <input style={inputStyle} inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0,00" />
      </Field>
      {type === "target" && (
        <Field label="Data alvo (mês/ano)">
          <input type="month" style={inputStyle} value={targetDate} onChange={(e) => setTargetDate(e.target.value)} />
        </Field>
      )}
      <SaveBtn onClick={save}>Salvar meta</SaveBtn>
      {goal && (
        <button onClick={remove} style={{ width: "100%", marginTop: 10, background: "transparent", border: "none", color: C.red, fontFamily: F, fontSize: 14, fontWeight: 700, cursor: "pointer", padding: "10px", display: "flex", alignItems: "center", justifyContent: "center", gap: 7 }}>
          <Trash2 size={15} /> Remover meta
        </button>
      )}
    </Shell>
  );
}

function EditCategoryModal({ cat, data, update, close }) {
  const realGroups = data.groups.filter((g) => !g.isPayment);
  const [name, setName] = useState(cat.name);
  const [groupId, setGroupId] = useState(cat.groupId);
  const [confirming, setConfirming] = useState(false);

  const save = () => {
    if (!name.trim()) return;
    update((d) => ({ ...d, categories: d.categories.map((c) => c.id === cat.id ? { ...c, name: name.trim(), groupId } : c) }));
    close();
  };
  const remove = () => {
    update((d) => {
      const assigned = { ...d.assigned };
      delete assigned[cat.id];
      return { ...d, categories: d.categories.filter((c) => c.id !== cat.id), assigned };
    });
    close();
  };

  return (
    <Shell title="Editar categoria" close={close}>
      <Field label="Nome"><input autoFocus style={inputStyle} value={name} onChange={(e) => setName(e.target.value)} /></Field>
      <Field label="Grupo">
        <select style={inputStyle} value={groupId} onChange={(e) => setGroupId(e.target.value)}>
          {realGroups.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
        </select>
      </Field>
      <SaveBtn onClick={save}>Salvar alterações</SaveBtn>
      {!confirming
        ? <button onClick={() => setConfirming(true)} style={{ width: "100%", marginTop: 10, background: "transparent", border: "none", color: C.red, fontFamily: F, fontSize: 14, fontWeight: 700, cursor: "pointer", padding: "10px", display: "flex", alignItems: "center", justifyContent: "center", gap: 7 }}>
            <Trash2 size={15} /> Apagar categoria
          </button>
        : <div style={{ marginTop: 10, background: "#FDE7EC", borderRadius: 14, padding: "14px 16px" }}>
            <div style={{ fontFamily: F, fontSize: 13, fontWeight: 600, color: C.red, marginBottom: 12 }}>Apagar "{cat.name}"? Os lançamentos vinculados ficam sem categoria, mas não são apagados.</div>
            <div style={{ display: "flex", gap: 8 }}>
              <button onClick={() => setConfirming(false)} style={{ flex: 1, padding: "10px", borderRadius: 12, border: `1px solid ${C.line}`, background: C.white, fontFamily: F, fontWeight: 700, fontSize: 14, cursor: "pointer", color: C.body }}>Cancelar</button>
              <button onClick={remove} style={{ flex: 1, padding: "10px", borderRadius: 12, border: "none", background: C.red, color: "#fff", fontFamily: F, fontWeight: 700, fontSize: 14, cursor: "pointer" }}>Confirmar</button>
            </div>
          </div>
      }
    </Shell>
  );
}

function EditGroupModal({ group, data, update, close }) {
  const [name, setName] = useState(group.name);
  const [confirming, setConfirming] = useState(false);
  const hasCats = data.categories.some((c) => c.groupId === group.id);

  const save = () => {
    if (!name.trim()) return;
    update((d) => ({ ...d, groups: d.groups.map((g) => g.id === group.id ? { ...g, name: name.trim() } : g) }));
    close();
  };
  const remove = () => {
    update((d) => ({ ...d, groups: d.groups.filter((g) => g.id !== group.id) }));
    close();
  };

  return (
    <Shell title="Editar grupo" close={close}>
      <Field label="Nome"><input autoFocus style={inputStyle} value={name} onChange={(e) => setName(e.target.value)} /></Field>
      <SaveBtn onClick={save}>Salvar alterações</SaveBtn>
      {!hasCats && !confirming &&
        <button onClick={() => setConfirming(true)} style={{ width: "100%", marginTop: 10, background: "transparent", border: "none", color: C.red, fontFamily: F, fontSize: 14, fontWeight: 700, cursor: "pointer", padding: "10px", display: "flex", alignItems: "center", justifyContent: "center", gap: 7 }}>
          <Trash2 size={15} /> Apagar grupo
        </button>
      }
      {hasCats &&
        <div style={{ marginTop: 10, fontFamily: F, fontSize: 12, color: C.muted, textAlign: "center" }}>Mova ou apague as categorias antes de apagar o grupo.</div>
      }
      {confirming &&
        <div style={{ marginTop: 10, background: "#FDE7EC", borderRadius: 14, padding: "14px 16px" }}>
          <div style={{ fontFamily: F, fontSize: 13, fontWeight: 600, color: C.red, marginBottom: 12 }}>Apagar o grupo "{group.name}"?</div>
          <div style={{ display: "flex", gap: 8 }}>
            <button onClick={() => setConfirming(false)} style={{ flex: 1, padding: "10px", borderRadius: 12, border: `1px solid ${C.line}`, background: C.white, fontFamily: F, fontWeight: 700, fontSize: 14, cursor: "pointer", color: C.body }}>Cancelar</button>
            <button onClick={remove} style={{ flex: 1, padding: "10px", borderRadius: 12, border: "none", background: C.red, color: "#fff", fontFamily: F, fontWeight: 700, fontSize: 14, cursor: "pointer" }}>Confirmar</button>
          </div>
        </div>
      }
    </Shell>
  );
}

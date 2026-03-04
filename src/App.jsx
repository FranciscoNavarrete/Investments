import { useState, useEffect, useRef, useCallback } from "react";

/* ═══ API ═══ */
let _needsKey = false;

async function askClaude(msgs, sys) {
  const apiKey = localStorage.getItem("meridian_api_key") || "";
  
  const r = await fetch("/.netlify/functions/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ 
      model: "claude-sonnet-4-20250514", max_tokens: 4096, system: sys, 
      messages: msgs, tools: [{ type: "web_search_20250305", name: "web_search" }],
      apiKey: apiKey
    }),
  });

  if (r.status === 401 || r.status === 403) { 
    localStorage.removeItem("meridian_api_key"); 
    _needsKey = true; 
    throw new Error("NEEDS_KEY"); 
  }
  
  if (!r.ok) {
    const err = await r.json().catch(() => ({}));
    if (err.error === "NO_KEY") { _needsKey = true; throw new Error("NEEDS_KEY"); }
    throw new Error("API_ERROR");
  }
  const d = await r.json();
  return (d.content || []).filter(b => b.type === "text").map(b => b.text).join("\n");
}

const D = new Date().toLocaleDateString("es-AR", { day: "numeric", month: "long", year: "numeric" });

const HOME_SYS = `Eres Meridian, analista de inversiones institucional. Hoy ${D}. Genera dashboard JSON PURO (sin markdown/backticks). Buscá info actual con web search.
JSON:{"macro":{"fase":"...","sentimiento":"risk-on/risk-off/mixto","resumen":"2-3 oraciones"},"oportunidades":[{"rank":1,"activo":"...","ticker":"...","clase":"...","tesis":"1 oración","horizonte":"corto/mediano/largo","riesgo":"bajo/medio/alto","señal":"compra/acumular/watchlist"}],"tendencias":[{"sector":"...","direccion":"alcista/bajista/lateral","motivo":"1 oración","picks":[{"activo":"...","ticker":"...","tesis":"1 oración corta","riesgo":"bajo/medio/alto"},{"activo":"...","ticker":"...","tesis":"...","riesgo":"..."},{"activo":"...","ticker":"...","tesis":"...","riesgo":"..."},{"activo":"...","ticker":"...","tesis":"...","riesgo":"..."},{"activo":"...","ticker":"...","tesis":"...","riesgo":"..."}]}],"riesgos":["...","..",".."]}
6 oportunidades variadas (global+emergentes+argentina), 5 tendencias con 5 picks de inversión CADA UNA (activos concretos con ticker real), 3 riesgos. Datos REALES. SOLO JSON.`;

const RES_SYS = `Eres Meridian, analista de inversiones institucional. Hoy ${D}. Buscá info actualizada con web search.

IMPORTANTE: NO uses etiquetas HTML de citación en tu respuesta. No uses <cite>,  ni ningún tag similar. Solo texto plano con markdown.

FORMATO OBLIGATORIO — usá EXACTAMENTE estos bloques markdown:

## 📊 Resumen de tu Estrategia
[1 párrafo explicando la estrategia general para este perfil]

## 💼 Portafolio Recomendado

| Activo | Ticker | Clase | Peso | Horizonte | Riesgo |
|--------|--------|-------|------|-----------|--------|
[tabla con cada posición]

## 📋 Detalle por Posición

### 1. [Nombre] ([TICKER])
**Clase:** ... | **Peso:** ...% | **Riesgo:** ...
**Tesis:** 2-3 puntos concretos de por qué ahora
**Catalizadores:** eventos próximos
**Stop-loss:** condición de salida

[repetir para cada posición]

## 🌍 Diversificación
- Por geografía: ...
- Por clase de activo: ...
- Por riesgo: ...

## ⚠️ Riesgos Principales
[3 riesgos a monitorear]

## 📰 Fuentes
[medios y datos consultados]

---
*Esto es análisis informativo, no asesoramiento financiero regulado.*

REGLAS: Si argentino, incluí bonos locales, CEDEARs, cepo. Sé CONCRETO con tickers reales. NUNCA uses tags de citación HTML.`;

/* ═══ Strip citation tags + Markdown renderer ═══ */
function cleanCites(t) {
  if (!t) return "";
  // Remove ... and any other cite-like tags
  let c = t.replace(/]*>/gi, "").replace(/<\/antml:cite>/gi, "");
  c = c.replace(/<cite[^>]*>/gi, "").replace(/<\/cite>/gi, "");
  // Remove any remaining xml-like tags from API
  c = c.replace(/<\/?antml:[^>]*>/gi, "");
  return c;
}

function renderMd(raw) {
  if (!raw) return "";
  let t = cleanCites(raw);
  t = t.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  // Tables
  t = t.replace(/^(\|.+\|)\n(\|[-| :]+\|)\n((?:\|.+\|\n?)*)/gm, (_, hdr, sep, body) => {
    const ths = hdr.split("|").filter(c => c.trim()).map(c => `<th>${c.trim()}</th>`).join("");
    const rows = body.trim().split("\n").map(row => {
      const tds = row.split("|").filter(c => c.trim()).map(c => `<td>${c.trim()}</td>`).join("");
      return `<tr>${tds}</tr>`;
    }).join("");
    return `<div class="tbl-wrap"><table class="pro-tbl"><thead><tr>${ths}</tr></thead><tbody>${rows}</tbody></table></div>`;
  });
  t = t.replace(/^### (.+)$/gm, '<h3 class="rh3">$1</h3>')
    .replace(/^## (.+)$/gm, '<h2 class="rh2">$1</h2>')
    .replace(/^# (.+)$/gm, '<h1 class="rh1">$1</h1>')
    .replace(/\*\*(.+?)\*\*/g, '<strong class="rbold">$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/`(.+?)`/g, '<code class="rcode">$1</code>')
    .replace(/^- (.+)$/gm, '<li class="rli">$1</li>')
    .replace(/^(\d+)\. (.+)$/gm, '<li class="rlin">$2</li>')
    .replace(/---/g, '<hr class="rhr"/>')
    .replace(/\n{2,}/g, '<br/><br/>').replace(/\n/g, '<br/>');
  return t;
}

/* ═══ Components ═══ */
function Sk({ w = "100%", h = 16 }) {
  return <div style={{ width: w, height: h, borderRadius: 6, background: "linear-gradient(90deg,rgba(59,130,246,.04) 25%,rgba(59,130,246,.1) 50%,rgba(59,130,246,.04) 75%)", backgroundSize: "200% 100%", animation: "shimmer 2s infinite" }} />;
}
function SkCard() {
  return <div style={{ background: "rgba(255,255,255,.02)", border: "1px solid rgba(59,130,246,.07)", borderRadius: 16, padding: 20 }}>
    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 14 }}><Sk w={55} h={11} /><Sk w={52} h={22} /></div>
    <Sk w="65%" h={20} /><div style={{ height: 6 }} /><Sk w={80} h={13} /><div style={{ height: 12 }} />
    <Sk w="100%" h={12} /><div style={{ height: 5 }} /><Sk w="80%" h={12} /><div style={{ height: 14 }} />
    <div style={{ display: "flex", gap: 8 }}><Sk w={72} h={24} /><Sk w={72} h={24} /></div>
  </div>;
}

const SIG = { compra: { bg: "linear-gradient(135deg,#22D3EE18,#06B6D418)", border: "#22D3EE35", color: "#22D3EE", l: "COMPRA" }, acumular: { bg: "linear-gradient(135deg,#818CF818,#6366F118)", border: "#818CF835", color: "#818CF8", l: "ACUMULAR" }, watchlist: { bg: "linear-gradient(135deg,#94A3B810,#64748B10)", border: "#94A3B825", color: "#94A3B8", l: "WATCHLIST" } };
const RSK = { bajo: { color: "#34D399" }, medio: { color: "#818CF8" }, alto: { color: "#FB7185" } };
const DIR = { alcista: { color: "#34D399", icon: "▲", bg: "rgba(52,211,153,.04)" }, bajista: { color: "#FB7185", icon: "▼", bg: "rgba(251,113,133,.04)" }, lateral: { color: "#94A3B8", icon: "■", bg: "rgba(148,163,184,.03)" } };

/* ═══ Wizard ═══ */
const STEPS = [
  { id: "capital", emoji: "💰", q: "¿Con cuánto capital contás?", sub: "Seleccioná el rango más cercano a tu disponibilidad", opts: [
    { l: "USD 100 — 500", v: "entre USD 100 y 500" },
    { l: "USD 500 — 1.000", v: "entre USD 500 y 1.000" },
    { l: "USD 1K — 3K", v: "entre USD 1.000 y 3.000" },
    { l: "USD 3K — 10K", v: "entre USD 3.000 y 10.000" },
    { l: "USD 10K — 30K", v: "entre USD 10.000 y 30.000" },
    { l: "USD 30K+", v: "más de USD 30.000" }
  ]},
  { id: "horizonte", emoji: "⏳", q: "¿Cuál es tu horizonte de inversión?", sub: "¿En cuánto tiempo podrías necesitar este dinero?", opts: [
    { l: "Corto plazo", d: "Menos de 1 año", v: "corto plazo (menos de 1 año)" },
    { l: "Mediano plazo", d: "1 a 3 años", v: "mediano plazo (1 a 3 años)" },
    { l: "Largo plazo", d: "Más de 3 años", v: "largo plazo (más de 3 años)" }
  ]},
  { id: "riesgo", emoji: "📊", q: "¿Cuánta volatilidad tolerás?", sub: "Tu tolerancia al riesgo define la composición del portafolio", opts: [
    { l: "Conservador", d: "Priorizo no perder, aunque gane poco", v: "conservador", ic: "🛡" },
    { l: "Moderado", d: "Acepto vaivenes por mejor retorno", v: "moderado", ic: "⚖️" },
    { l: "Agresivo", d: "Busco máximo crecimiento, tolero caídas -30%", v: "agresivo", ic: "⚡" }
  ]},
  { id: "pais", emoji: "🌐", q: "¿Desde dónde operás?", sub: "Regulaciones, impuestos y acceso a mercados varían por país", opts: [
    { l: "🇦🇷  Argentina", v: "Argentina (pesos, considerar cepo y riesgo cambiario)" },
    { l: "🇲🇽  México", v: "México (pesos mexicanos)" }, { l: "🇨🇱  Chile", v: "Chile (pesos chilenos)" },
    { l: "🇨🇴  Colombia", v: "Colombia (pesos colombianos)" }, { l: "🇧🇷  Brasil", v: "Brasil (reales)" },
    { l: "🇺🇸  Estados Unidos", v: "Estados Unidos (dólares)" }, { l: "🇪🇸  España/EU", v: "España (euros)" },
    { l: "🌍  Otro país", v: "otro país" }
  ]},
  { id: "objetivo", emoji: "🎯", q: "¿Cuál es tu objetivo principal?", sub: "Esto determina la estrategia general", opts: [
    { l: "Preservar capital", d: "No perder poder adquisitivo", v: "preservar capital", ic: "🔒" },
    { l: "Renta pasiva", d: "Dividendos e intereses periódicos", v: "generar renta pasiva", ic: "💵" },
    { l: "Crecimiento", d: "Hacer crecer mi capital sostenidamente", v: "crecimiento de capital", ic: "📈" },
    { l: "Máximo retorno", d: "Asumo riesgo alto por alto retorno", v: "crecimiento agresivo máximo retorno", ic: "🚀" }
  ]},
  { id: "restricciones", emoji: "⚙️", q: "¿Alguna preferencia especial?", sub: "Podés elegir varias o ninguna", multi: true, opts: [
    { l: "Sin restricciones", v: "sin restricciones" }, { l: "No cripto", v: "no criptomonedas" },
    { l: "Solo renta fija", v: "preferencia renta fija" }, { l: "ESG / Sustentable", v: "inversiones ESG" },
    { l: "Solo mercado local", v: "solo mercado local" }, { l: "Diversificación global", v: "diversificación global" }
  ]}
];

/* ═══ TrendCard with picks ═══ */
function TrendCard({ trend, dir, onInvest }) {
  const [open, setOpen] = useState(false);
  const rk = RSK;
  return (
    <div style={{ borderRadius: 16, border: "1px solid rgba(59,130,246,.05)", overflow: "hidden", background: dir.bg }}>
      {/* Header */}
      <div onClick={() => setOpen(!open)} style={{ padding: "14px 18px", display: "flex", alignItems: "center", gap: 14, cursor: "pointer", transition: "background .15s", background: open ? "rgba(59,130,246,.03)" : "transparent" }}>
        <span style={{ fontSize: 14, color: dir.color, fontWeight: 800, fontFamily: "'Azeret Mono',monospace", width: 20, textAlign: "center" }}>{dir.icon}</span>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 14, fontWeight: 600, color: "#D6E4F7", marginBottom: 3 }}>{trend.sector}</div>
          <div style={{ fontSize: 12.5, color: "#6B82A0", lineHeight: 1.5 }}>{trend.motivo}</div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ fontSize: 10, fontFamily: "'Azeret Mono',monospace", color: dir.color, fontWeight: 600, letterSpacing: ".06em", textTransform: "uppercase" }}>{trend.direccion}</span>
          <span style={{ fontSize: 14, color: "#3B6EB5", transition: "transform .2s", transform: open ? "rotate(180deg)" : "rotate(0deg)" }}>▾</span>
        </div>
      </div>
      {/* Picks */}
      {open && trend.picks && trend.picks.length > 0 && (
        <div style={{ padding: "0 18px 16px", animation: "fadeIn .25s ease" }}>
          <div style={{ fontSize: 10, fontFamily: "'Azeret Mono',monospace", color: "#3B6EB5", letterSpacing: ".1em", textTransform: "uppercase", marginBottom: 10, paddingTop: 4 }}>Dónde invertir en esta tendencia</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {trend.picks.map((p, j) => {
              const rc = rk[p.riesgo] || rk.medio;
              return (
                <div key={j} className="card-h" onClick={(e) => { e.stopPropagation(); onInvest(); }} style={{
                  background: "rgba(255,255,255,.02)", border: "1px solid rgba(59,130,246,.06)",
                  borderRadius: 12, padding: "12px 16px", display: "flex", alignItems: "center", gap: 14
                }}>
                  <div style={{ width: 28, height: 28, borderRadius: 8, background: "rgba(59,130,246,.06)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 700, color: "#3B82F6", fontFamily: "'Azeret Mono',monospace", flexShrink: 0 }}>{j + 1}</div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginBottom: 2 }}>
                      <span style={{ fontSize: 13.5, fontWeight: 600, color: "#D6E4F7" }}>{p.activo}</span>
                      <span style={{ fontSize: 11, color: "#3B82F6", fontFamily: "'Azeret Mono',monospace", fontWeight: 500 }}>{p.ticker}</span>
                    </div>
                    <div style={{ fontSize: 12, color: "#6B82A0", lineHeight: 1.5 }}>{p.tesis}</div>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 4, flexShrink: 0 }}>
                    <span style={{ width: 5, height: 5, borderRadius: "50%", background: rc.color, opacity: .6 }} />
                    <span style={{ fontSize: 10, color: rc.color, fontWeight: 600, fontFamily: "'Azeret Mono',monospace" }}>{p.riesgo}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

/* ═══ API Key Screen ═══ */
function ApiKeyScreen({ onSave }) {
  const [key, setKey] = useState("");
  const [show, setShow] = useState(false);
  const save = () => { if (key.trim()) { localStorage.setItem("meridian_api_key", key.trim()); onSave(); } };
  return (
    <div style={{ height: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#000", padding: 20 }}>
      <div style={{ maxWidth: 440, width: "100%", animation: "slideUp .5s ease" }}>
        <div style={{ textAlign: "center", marginBottom: 32 }}>
          <span style={{ fontFamily: "'Fraunces',serif", fontSize: 28, fontWeight: 700, background: "linear-gradient(135deg,#3B82F6,#7CB3FF)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>Meridian</span>
          <p style={{ color: "#3B6EB5", fontSize: 13, marginTop: 8 }}>Necesitás una API key de Anthropic para conectarte</p>
        </div>
        <div style={{ background: "rgba(255,255,255,.02)", border: "1px solid rgba(59,130,246,.08)", borderRadius: 16, padding: 24 }}>
          <label style={{ fontSize: 12, fontWeight: 600, color: "#7CB3FF", fontFamily: "'Azeret Mono',monospace", letterSpacing: ".08em", display: "block", marginBottom: 8 }}>API KEY</label>
          <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
            <div style={{ flex: 1, background: "rgba(255,255,255,.03)", border: "1px solid rgba(59,130,246,.1)", borderRadius: 10, padding: "10px 14px", display: "flex", alignItems: "center" }}>
              <input value={key} onChange={e => setKey(e.target.value)} onKeyDown={e => e.key === "Enter" && save()}
                type={show ? "text" : "password"} placeholder="sk-ant-..."
                style={{ flex: 1, background: "none", border: "none", outline: "none", color: "#D6E4F7", fontSize: 13.5, fontFamily: "'Azeret Mono',monospace" }} />
              <button onClick={() => setShow(!show)} style={{ background: "none", border: "none", color: "#3B6EB5", cursor: "pointer", fontSize: 12, padding: "0 4px" }}>{show ? "ocultar" : "ver"}</button>
            </div>
          </div>
          <button onClick={save} className="cta" style={{
            width: "100%", padding: 14, borderRadius: 12, border: "none",
            background: key.trim() ? "linear-gradient(135deg,#1D4ED8,#3B82F6)" : "rgba(59,130,246,.06)",
            color: key.trim() ? "#fff" : "#2A4A7A", fontSize: 14, fontWeight: 700,
            cursor: key.trim() ? "pointer" : "default",
            boxShadow: key.trim() ? "0 8px 30px rgba(29,78,216,.2)" : "none"
          }}>Conectar</button>
        </div>
        <div style={{ marginTop: 20, padding: 16, background: "rgba(59,130,246,.02)", border: "1px solid rgba(59,130,246,.06)", borderRadius: 12 }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: "#4B6FA0", marginBottom: 6 }}>¿Cómo obtengo una API key?</div>
          <ol style={{ fontSize: 12, color: "#3B6EB5", lineHeight: 1.8, paddingLeft: 16 }}>
            <li>Andá a <span style={{ color: "#7CB3FF" }}>console.anthropic.com</span></li>
            <li>Creá una cuenta o logueate</li>
            <li>En "API Keys" hacé click en "Create Key"</li>
            <li>Copiá la key y pegala acá arriba</li>
          </ol>
        </div>
        <p style={{ textAlign: "center", fontSize: 10.5, color: "#1E3355", marginTop: 16 }}>Tu key se guarda solo en este navegador. Nunca se envía a terceros.</p>
      </div>
    </div>
  );
}

/* ══════════════════════════════════ */
export default function App() {
  const [view, setView] = useState("home");
  const [needsKey, setNeedsKey] = useState(false);
  const [hd, setHd] = useState(null);
  const [hLoad, setHL] = useState(true);
  const [hErr, setHE] = useState(false);
  const [ws, setWs] = useState(0);
  const [wa, setWa] = useState({});
  const [msel, setMsel] = useState([]);
  const [res, setRes] = useState("");
  const [rLoad, setRL] = useState(false);

  const loadHome = useCallback(async () => {
    setHL(true); setHE(false);
    try {
      const raw = await askClaude([{ role: "user", content: "Dashboard de mercado hoy. Buscá web. SOLO JSON." }], HOME_SYS);
      setHd(JSON.parse(raw.replace(/```json\s?/g, "").replace(/```/g, "").trim()));
    } catch (e) {
      if (e.message === "NEEDS_KEY") { setNeedsKey(true); setHL(false); return; }
      setHE(true);
    }
    setHL(false);
  }, []);
  useEffect(() => { loadHome(); }, [loadHome]);

  const pick = (v) => {
    const s = STEPS[ws]; if (s.multi) return;
    const u = { ...wa, [s.id]: v }; setWa(u);
    if (ws < STEPS.length - 1) setTimeout(() => setWs(ws + 1), 180);
    else genRes(u);
  };
  const togM = (v) => v === "sin restricciones" ? setMsel(["sin restricciones"]) : setMsel(p => { const f = p.filter(x => x !== "sin restricciones"); return f.includes(v) ? f.filter(x => x !== v) : [...f, v]; });
  const confirmM = () => { const u = { ...wa, restricciones: (msel.length ? msel : ["sin restricciones"]).join(", ") }; setWa(u); genRes(u); };

  const genRes = async (a) => {
    setView("results"); setRL(true); setRes("");
    const p = `Perfil:\n- Capital: ${a.capital}\n- Horizonte: ${a.horizonte}\n- Riesgo: ${a.riesgo}\n- País: ${a.pais}\n- Objetivo: ${a.objetivo}\n- Restricciones: ${a.restricciones}\n\nArmame un portafolio personalizado con recomendaciones concretas.`;
    try { const r = await askClaude([{ role: "user", content: p }], RES_SYS); setRes(r || "Error al generar."); }
    catch (e) { if (e.message === "NEEDS_KEY") { setNeedsKey(true); } else setRes("⚠️ Error de conexión. Intentá de nuevo."); }
    setRL(false);
  };

  const resetW = () => { setWs(0); setWa({}); setMsel([]); setRes(""); };
  const goBack = () => { if (view === "wizard" && ws > 0) setWs(ws - 1); else if (view === "wizard") setView("home"); else if (view === "results") { resetW(); setView("wizard"); } else setView("home"); };

  const step = STEPS[ws];
  const prog = ((ws + 1) / STEPS.length) * 100;

  if (needsKey) {
    return <ApiKeyScreen onSave={() => { setNeedsKey(false); _needsKey = false; loadHome(); }} />;
  }

  return (
    <div style={{ height: "100vh", width: "100vw", display: "flex", flexDirection: "column", background: "#000000", color: "#E1E7EF", fontFamily: "'Outfit',system-ui,sans-serif", overflow: "hidden", position: "relative" }}>
      {/* BG */}
      <div style={{ position: "fixed", inset: 0, zIndex: 0, pointerEvents: "none", background: "radial-gradient(ellipse 70% 50% at 50% 0%, rgba(29,78,216,.06) 0%, transparent 70%)" }} />
      <div style={{ position: "fixed", inset: 0, zIndex: 0, pointerEvents: "none", opacity: .015, backgroundImage: "radial-gradient(rgba(59,130,246,.7) 1px, transparent 1px)", backgroundSize: "36px 36px" }} />

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700;800&family=Azeret+Mono:wght@400;500;600&family=Fraunces:ital,opsz,wght@0,9..144,300;0,9..144,500;0,9..144,700;0,9..144,800;1,9..144,400&display=swap');
        @keyframes dotP{0%,100%{opacity:.2;transform:scale(.8)}50%{opacity:1;transform:scale(1.15)}}
        @keyframes slideUp{from{opacity:0;transform:translateY(18px)}to{opacity:1;transform:translateY(0)}}
        @keyframes slideIn{from{opacity:0;transform:translateX(24px)}to{opacity:1;transform:translateX(0)}}
        @keyframes shimmer{0%{background-position:-200% 0}100%{background-position:200% 0}}
        @keyframes fadeIn{from{opacity:0}to{opacity:1}}
        @keyframes pop{0%{transform:scale(1)}50%{transform:scale(.97)}100%{transform:scale(1)}}
        *{box-sizing:border-box;margin:0;padding:0}
        ::-webkit-scrollbar{width:5px}::-webkit-scrollbar-track{background:transparent}::-webkit-scrollbar-thumb{background:rgba(59,130,246,.1);border-radius:8px}

        .rh1{font-family:'Fraunces',serif;font-size:1.4em;font-weight:700;color:#7CB3FF;margin:20px 0 10px;letter-spacing:-.01em}
        .rh2{font-family:'Fraunces',serif;font-size:1.2em;font-weight:600;color:#7CB3FF;margin:22px 0 10px;padding-bottom:8px;border-bottom:1px solid rgba(59,130,246,.1);letter-spacing:-.01em}
        .rh3{font-size:1.05em;font-weight:600;color:#93C5FD;margin:16px 0 6px}
        .rbold{color:#D6E4F7}
        .rcode{background:rgba(59,130,246,.08);color:#7CB3FF;padding:2px 7px;border-radius:4px;font-family:'Azeret Mono',monospace;font-size:.82em}
        .rli,.rlin{margin:4px 0;line-height:1.65;color:#A0B4CC;padding-left:4px}
        .rhr{border:none;height:1px;background:linear-gradient(90deg,transparent,rgba(59,130,246,.12),transparent);margin:18px 0}

        .tbl-wrap{overflow-x:auto;margin:14px 0;border-radius:12px;border:1px solid rgba(59,130,246,.08);background:rgba(255,255,255,.015)}
        .pro-tbl{width:100%;border-collapse:collapse;font-size:12.5px}
        .pro-tbl thead{background:rgba(59,130,246,.05)}
        .pro-tbl th{padding:10px 14px;text-align:left;font-family:'Azeret Mono',monospace;font-size:10px;font-weight:600;color:#3B82F6;letter-spacing:.08em;text-transform:uppercase;border-bottom:1px solid rgba(59,130,246,.08)}
        .pro-tbl td{padding:10px 14px;border-bottom:1px solid rgba(59,130,246,.04);color:#A0B4CC;font-size:13px}
        .pro-tbl tbody tr:last-child td{border-bottom:none}
        .pro-tbl tbody tr:hover{background:rgba(59,130,246,.03)}

        .card-h{transition:all .25s cubic-bezier(.4,0,.2,1);cursor:pointer}
        .card-h:hover{transform:translateY(-3px);border-color:rgba(59,130,246,.2)!important;box-shadow:0 12px 40px rgba(0,0,0,.5),0 0 0 1px rgba(59,130,246,.08)}
        .opt-btn{transition:all .2s cubic-bezier(.4,0,.2,1);cursor:pointer}
        .opt-btn:hover{border-color:rgba(59,130,246,.3)!important;background:rgba(59,130,246,.05)!important;transform:translateY(-1px)}
        .opt-btn:active{animation:pop .18s ease}
        .opt-btn.sel{border-color:rgba(59,130,246,.45)!important;background:rgba(59,130,246,.07)!important;box-shadow:0 0 24px rgba(59,130,246,.06)}
        .cta{transition:all .25s cubic-bezier(.4,0,.2,1);cursor:pointer}
        .cta:hover{transform:translateY(-1px);box-shadow:0 8px 30px rgba(59,130,246,.15)!important}
        .back-b{transition:all .15s ease;cursor:pointer}.back-b:hover{color:#7CB3FF!important;background:rgba(59,130,246,.06)!important}
        .ref-b{transition:all .2s ease;cursor:pointer}.ref-b:hover{background:rgba(59,130,246,.08)!important;color:#7CB3FF!important;border-color:rgba(59,130,246,.18)!important}
      `}</style>

      {/* ── HEADER ── */}
      <div style={{ height: 56, display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 20px", borderBottom: "1px solid rgba(59,130,246,.05)", background: "rgba(0,0,0,.85)", backdropFilter: "blur(20px)", flexShrink: 0, zIndex: 20, position: "relative" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          {view !== "home" && <button className="back-b" onClick={goBack} style={{ background: "none", border: "none", color: "#3B6EB5", fontSize: 20, padding: "3px 8px", borderRadius: 6, display: "flex", alignItems: "center", fontWeight: 300 }}>‹</button>}
          <div onClick={() => setView("home")} style={{ cursor: "pointer", display: "flex", alignItems: "baseline", gap: 6 }}>
            <span style={{ fontFamily: "'Fraunces',serif", fontSize: 23, fontWeight: 700, background: "linear-gradient(135deg,#3B82F6,#7CB3FF,#93C5FD)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>Meridian</span>
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 10, fontFamily: "'Azeret Mono',monospace", color: "#2A4A7A" }}>
          <span>{new Date().toLocaleDateString("es-AR", { day: "2-digit", month: "short", year: "numeric" }).toUpperCase()}</span>
          <button onClick={() => { if (confirm("¿Querés cambiar o borrar tu API key?")) { localStorage.removeItem("meridian_api_key"); setNeedsKey(true); } }} className="back-b" style={{ background: "none", border: "none", color: "#2A4A7A", fontSize: 15, padding: "3px 6px", borderRadius: 6, cursor: "pointer", display: "flex", alignItems: "center" }} title="Configuración">⚙</button>
        </div>
      </div>

      {/* ════ HOME ════ */}
      {view === "home" && (
        <div style={{ flex: 1, overflowY: "auto", position: "relative", zIndex: 1 }}>
          <div style={{ maxWidth: 960, margin: "0 auto", padding: "24px 20px 40px" }}>

            {/* CTA */}
            <div onClick={() => { resetW(); setView("wizard"); }} className="cta" style={{
              background: "linear-gradient(135deg,rgba(59,130,246,.07),rgba(29,78,216,.03))",
              border: "1px solid rgba(59,130,246,.12)", borderRadius: 18, padding: "22px 26px",
              marginBottom: 28, display: "flex", alignItems: "center", justifyContent: "space-between",
              position: "relative", overflow: "hidden"
            }}>
              <div style={{ position: "absolute", top: -40, right: -40, width: 140, height: 140, borderRadius: "50%", background: "radial-gradient(circle,rgba(59,130,246,.06),transparent 70%)" }} />
              <div style={{ position: "relative" }}>
                <div style={{ fontFamily: "'Fraunces',serif", fontSize: 19, fontWeight: 700, color: "#7CB3FF", marginBottom: 5 }}>Analizar mi perfil</div>
                <div style={{ fontSize: 13, color: "#4B6FA0" }}>6 preguntas rápidas → portafolio personalizado</div>
              </div>
              <div style={{ width: 44, height: 44, borderRadius: 12, background: "rgba(59,130,246,.08)", border: "1px solid rgba(59,130,246,.12)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20, color: "#7CB3FF", flexShrink: 0, position: "relative" }}>→</div>
            </div>

            {/* MACRO */}
            <section style={{ marginBottom: 28 }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
                <h2 style={{ fontFamily: "'Fraunces',serif", fontSize: 19, fontWeight: 600, color: "#D6E4F7" }}>Resumen Macro</h2>
                {!hLoad && <button className="ref-b" onClick={loadHome} style={{ background: "rgba(59,130,246,.03)", border: "1px solid rgba(59,130,246,.07)", borderRadius: 8, padding: "5px 14px", fontSize: 11, color: "#3B6EB5", fontFamily: "'Azeret Mono',monospace" }}>↻ Actualizar</button>}
              </div>
              {hLoad ? <div style={{ background: "rgba(255,255,255,.02)", border: "1px solid rgba(59,130,246,.05)", borderRadius: 16, padding: 22 }}><Sk w="28%" h={15} /><div style={{ height: 10 }} /><Sk w="100%" h={13} /><div style={{ height: 5 }} /><Sk w="88%" h={13} /></div>
                : hErr ? <div style={{ background: "rgba(251,113,133,.03)", border: "1px solid rgba(251,113,133,.1)", borderRadius: 16, padding: 22, fontSize: 13, color: "#FB7185" }}>No se pudieron cargar datos. Tocá Actualizar.</div>
                  : hd?.macro && (
                    <div style={{ background: "rgba(255,255,255,.02)", border: "1px solid rgba(59,130,246,.05)", borderRadius: 16, padding: 22, animation: "fadeIn .5s" }}>
                      <div style={{ display: "flex", gap: 8, marginBottom: 12, flexWrap: "wrap" }}>
                        <span style={{ background: "rgba(59,130,246,.08)", color: "#7CB3FF", padding: "4px 12px", borderRadius: 20, fontSize: 11, fontWeight: 600, fontFamily: "'Azeret Mono',monospace", letterSpacing: ".04em" }}>{hd.macro.fase?.toUpperCase()}</span>
                        <span style={{ background: hd.macro.sentimiento?.includes("off") ? "rgba(251,113,133,.06)" : "rgba(52,211,153,.06)", color: hd.macro.sentimiento?.includes("off") ? "#FB7185" : "#34D399", padding: "4px 12px", borderRadius: 20, fontSize: 11, fontWeight: 600, fontFamily: "'Azeret Mono',monospace" }}>{hd.macro.sentimiento?.toUpperCase()}</span>
                      </div>
                      <p style={{ fontSize: 14, lineHeight: 1.75, color: "#8A9DB8" }}>{hd.macro.resumen}</p>
                    </div>
                  )}
            </section>

            {/* OPORTUNIDADES */}
            <section style={{ marginBottom: 28 }}>
              <h2 style={{ fontFamily: "'Fraunces',serif", fontSize: 19, fontWeight: 600, color: "#D6E4F7", marginBottom: 14 }}>Top Oportunidades</h2>
              {hLoad ? <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(270px,1fr))", gap: 14 }}>{[0, 1, 2, 3, 4, 5].map(i => <SkCard key={i} />)}</div>
                : hd?.oportunidades && (
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(270px,1fr))", gap: 14, animation: "fadeIn .5s" }}>
                    {hd.oportunidades.map((o, i) => { const s = SIG[o.señal] || SIG.watchlist, rk = RSK[o.riesgo] || RSK.medio; return (
                      <div key={i} className="card-h" onClick={() => { resetW(); setView("wizard"); }} style={{ background: "rgba(255,255,255,.02)", border: "1px solid rgba(59,130,246,.06)", borderRadius: 16, padding: 20, position: "relative", overflow: "hidden" }}>
                        <div style={{ position: "absolute", top: 0, right: 0, width: 80, height: 80, background: `radial-gradient(circle at top right,${s.color}06,transparent 70%)` }} />
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 10, position: "relative" }}>
                          <span style={{ fontSize: 10, color: "#3B6EB5", fontFamily: "'Azeret Mono',monospace", fontWeight: 600, letterSpacing: ".06em" }}>#{o.rank} · {o.clase?.toUpperCase()}</span>
                          <span style={{ background: s.bg, border: `1px solid ${s.border}`, color: s.color, padding: "3px 10px", borderRadius: 20, fontSize: 9.5, fontWeight: 700, fontFamily: "'Azeret Mono',monospace", letterSpacing: ".06em" }}>{s.l}</span>
                        </div>
                        <div style={{ fontSize: 17, fontWeight: 700, color: "#E1E7EF", marginBottom: 3, letterSpacing: "-.01em" }}>{o.activo}</div>
                        <div style={{ fontSize: 12.5, color: "#3B82F6", fontFamily: "'Azeret Mono',monospace", fontWeight: 500, marginBottom: 10 }}>{o.ticker}</div>
                        <p style={{ fontSize: 12.5, color: "#6B82A0", lineHeight: 1.6, marginBottom: 14 }}>{o.tesis}</p>
                        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                          <span style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 10.5, color: rk.color, fontWeight: 600 }}>
                            <span style={{ width: 6, height: 6, borderRadius: "50%", background: rk.color, opacity: .6 }} />{o.riesgo}
                          </span>
                          <span style={{ fontSize: 10.5, color: "#3B6EB5" }}>· {o.horizonte}</span>
                        </div>
                      </div>
                    ); })}
                  </div>
                )}
            </section>

            {/* TENDENCIAS */}
            <section style={{ marginBottom: 28 }}>
              <h2 style={{ fontFamily: "'Fraunces',serif", fontSize: 19, fontWeight: 600, color: "#D6E4F7", marginBottom: 14 }}>Tendencias</h2>
              {hLoad ? <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>{[0, 1, 2, 3].map(i => <div key={i} style={{ background: "rgba(255,255,255,.02)", border: "1px solid rgba(59,130,246,.05)", borderRadius: 14, padding: 16 }}><Sk w="35%" h={15} /><div style={{ height: 7 }} /><Sk w="85%" h={12} /></div>)}</div>
                : hd?.tendencias && (
                  <div style={{ display: "flex", flexDirection: "column", gap: 12, animation: "fadeIn .5s" }}>
                    {hd.tendencias.map((t, i) => { const d = DIR[t.direccion] || DIR.lateral; return (
                      <TrendCard key={i} trend={t} dir={d} onInvest={() => { resetW(); setView("wizard"); }} />
                    ); })}
                  </div>
                )}
            </section>

            {/* RIESGOS */}
            {hd?.riesgos && !hLoad && (
              <section style={{ marginBottom: 28, animation: "fadeIn .5s" }}>
                <h2 style={{ fontFamily: "'Fraunces',serif", fontSize: 19, fontWeight: 600, color: "#D6E4F7", marginBottom: 14 }}>Riesgos a Monitorear</h2>
                <div style={{ background: "rgba(251,113,133,.02)", border: "1px solid rgba(251,113,133,.07)", borderRadius: 16, padding: 20 }}>
                  {hd.riesgos.map((r, i) => <div key={i} style={{ display: "flex", gap: 12, padding: "8px 0", borderBottom: i < hd.riesgos.length - 1 ? "1px solid rgba(255,255,255,.03)" : "none" }}>
                    <span style={{ width: 20, height: 20, borderRadius: 6, background: "rgba(251,113,133,.06)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, color: "#FB7185", fontWeight: 700, flexShrink: 0, marginTop: 1 }}>{i + 1}</span>
                    <span style={{ fontSize: 13.5, color: "#8A9DB8", lineHeight: 1.6 }}>{r}</span>
                  </div>)}
                </div>
              </section>
            )}

            <div style={{ textAlign: "center", fontSize: 10, color: "#1E3355", fontFamily: "'Azeret Mono',monospace", paddingBottom: 8 }}>Análisis informativo · No constituye asesoramiento financiero regulado</div>
          </div>
        </div>
      )}

      {/* ════ WIZARD ════ */}
      {view === "wizard" && (
        <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden", position: "relative", zIndex: 1 }}>
          <div style={{ padding: "20px 24px 0", flexShrink: 0 }}>
            <div style={{ maxWidth: 560, margin: "0 auto" }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8, fontSize: 11, fontFamily: "'Azeret Mono',monospace", color: "#2A4A7A" }}>
                <span>Paso {ws + 1}/{STEPS.length}</span><span>{Math.round(prog)}%</span>
              </div>
              <div style={{ height: 3, background: "rgba(59,130,246,.05)", borderRadius: 4 }}>
                <div style={{ height: "100%", width: `${prog}%`, background: "linear-gradient(90deg,#1D4ED8,#3B82F6,#7CB3FF)", borderRadius: 4, transition: "width .35s cubic-bezier(.4,0,.2,1)" }} />
              </div>
            </div>
          </div>

          <div style={{ flex: 1, overflowY: "auto", padding: "28px 24px", display: "flex", alignItems: "flex-start", justifyContent: "center" }}>
            <div key={ws} style={{ maxWidth: 560, width: "100%", animation: "slideIn .4s cubic-bezier(.4,0,.2,1)" }}>
              <div style={{ fontSize: 44, marginBottom: 14 }}>{step.emoji}</div>
              <h2 style={{ fontFamily: "'Fraunces',serif", fontSize: 26, fontWeight: 700, color: "#E1E7EF", marginBottom: 6, letterSpacing: "-.02em" }}>{step.q}</h2>
              <p style={{ fontSize: 13.5, color: "#3B6EB5", marginBottom: 28 }}>{step.sub}</p>

              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {step.opts.map((o, i) => {
                  const sel = step.multi ? msel.includes(o.v) : wa[step.id] === o.v;
                  return (
                    <button key={i} className={`opt-btn ${sel ? "sel" : ""}`} onClick={() => step.multi ? togM(o.v) : pick(o.v)} style={{
                      background: sel ? "rgba(59,130,246,.05)" : "rgba(255,255,255,.02)",
                      border: `1px solid ${sel ? "rgba(59,130,246,.3)" : "rgba(59,130,246,.06)"}`,
                      borderRadius: 14, padding: "15px 20px", textAlign: "left", display: "flex", alignItems: "center", gap: 14,
                      position: "relative"
                    }}>
                      {o.ic && <span style={{ fontSize: 22, flexShrink: 0 }}>{o.ic}</span>}
                      {sel && <span style={{ position: "absolute", top: 12, right: 16, color: "#3B82F6", fontWeight: 700, fontSize: 15 }}>✓</span>}
                      <div>
                        <div style={{ fontSize: 15, fontWeight: 600, color: sel ? "#7CB3FF" : "#D6E4F7" }}>{o.l}</div>
                        {o.d && <div style={{ fontSize: 12.5, color: "#3B6EB5", marginTop: 3 }}>{o.d}</div>}
                      </div>
                    </button>
                  );
                })}
              </div>

              {step.multi && (
                <button onClick={confirmM} className="cta" style={{
                  marginTop: 24, width: "100%", padding: "16px", borderRadius: 14, border: "none",
                  background: msel.length ? "linear-gradient(135deg,#1D4ED8,#3B82F6)" : "rgba(59,130,246,.06)",
                  color: msel.length ? "#fff" : "#2A4A7A", fontSize: 15, fontWeight: 700,
                  cursor: msel.length ? "pointer" : "default",
                  boxShadow: msel.length ? "0 8px 30px rgba(29,78,216,.2)" : "none"
                }}>Generar mi portafolio →</button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ════ RESULTS ════ */}
      {view === "results" && (
        <div style={{ flex: 1, overflowY: "auto", position: "relative", zIndex: 1 }}>
          <div style={{ maxWidth: 860, margin: "0 auto", padding: "24px 20px 40px" }}>
            {/* Profile */}
            <div style={{ background: "rgba(59,130,246,.02)", border: "1px solid rgba(59,130,246,.07)", borderRadius: 16, padding: "16px 20px", marginBottom: 24, animation: "fadeIn .4s" }}>
              <div style={{ fontSize: 10, fontFamily: "'Azeret Mono',monospace", color: "#3B82F6", letterSpacing: ".14em", textTransform: "uppercase", marginBottom: 10 }}>TU PERFIL</div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                {Object.entries(wa).map(([k, v]) => <span key={k} style={{ background: "rgba(59,130,246,.05)", border: "1px solid rgba(59,130,246,.07)", padding: "5px 12px", borderRadius: 20, fontSize: 11.5, color: "#7CB3FF", fontWeight: 500 }}>{v.length > 45 ? v.slice(0, 45) + "…" : v}</span>)}
              </div>
            </div>

            {rLoad ? (
              <div style={{ animation: "fadeIn .4s" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 24 }}>
                  <div style={{ display: "flex", gap: 5 }}>{[0, 1, 2].map(i => <div key={i} style={{ width: 8, height: 8, borderRadius: "50%", background: "#3B82F6", animation: `dotP 1.4s ease-in-out ${i * .15}s infinite` }} />)}</div>
                  <span style={{ fontSize: 14, color: "#4B6FA0" }}>Analizando mercados y armando tu portafolio…</span>
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                  {[0, 1, 2].map(i => <div key={i} style={{ background: "rgba(255,255,255,.02)", border: "1px solid rgba(59,130,246,.05)", borderRadius: 16, padding: 22 }}>
                    <Sk w="35%" h={18} /><div style={{ height: 10 }} /><Sk w="100%" h={13} /><div style={{ height: 5 }} /><Sk w="92%" h={13} /><div style={{ height: 5 }} /><Sk w="78%" h={13} />
                  </div>)}
                </div>
              </div>
            ) : (
              <div style={{ animation: "slideUp .5s ease" }}>
                <div style={{ background: "rgba(255,255,255,.02)", border: "1px solid rgba(59,130,246,.05)", borderRadius: 18, padding: "26px 28px" }}>
                  <div style={{ fontSize: 14, lineHeight: 1.8, color: "#8A9DB8" }} dangerouslySetInnerHTML={{ __html: renderMd(res) }} />
                </div>
                <div style={{ display: "flex", gap: 12, marginTop: 24, flexWrap: "wrap" }}>
                  <button onClick={() => { resetW(); setView("wizard"); }} className="cta" style={{ flex: 1, minWidth: 200, padding: "15px", borderRadius: 14, border: "1px solid rgba(59,130,246,.12)", background: "rgba(59,130,246,.04)", color: "#7CB3FF", fontSize: 14, fontWeight: 600 }}>↻ Recalcular</button>
                  <button onClick={() => setView("home")} className="cta" style={{ flex: 1, minWidth: 200, padding: "15px", borderRadius: 14, border: "1px solid rgba(59,130,246,.06)", background: "rgba(255,255,255,.02)", color: "#4B6FA0", fontSize: 14, fontWeight: 600 }}>← Volver al Home</button>
                </div>
              </div>
            )}
            <div style={{ textAlign: "center", fontSize: 10, color: "#1E3355", fontFamily: "'Azeret Mono',monospace", padding: "24px 0 8px" }}>Análisis informativo · No constituye asesoramiento financiero regulado</div>
          </div>
        </div>
      )}
    </div>
  );
}

import { useState, useEffect, useCallback } from "react";

/* ═══ API ═══ */
const API_URL = "/.netlify/functions/chat";

function getApiKey() { return localStorage.getItem("meridian_api_key") || ""; }
function setApiKey(k) { localStorage.setItem("meridian_api_key", k); }

async function askClaude(msgs, sys) {
  const body = { model: "claude-haiku-4-5-20251001", max_tokens: 4096, system: sys, messages: msgs, tools: [{ type: "web_search_20250305", name: "web_search" }] };
  const key = getApiKey();
  if (key) body.apiKey = key;
  const r = await fetch(API_URL, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const d = await r.json();
  if (d.error) throw new Error(d.error?.message || d.error);
  return (d.content || []).filter(b => b.type === "text").map(b => b.text).join("\n");
}
async function askClaudeFast(msgs, sys) {
  const body = { model: "claude-haiku-4-5-20251001", max_tokens: 4096, system: sys, messages: msgs };
  const key = getApiKey();
  if (key) body.apiKey = key;
  const r = await fetch(API_URL, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const d = await r.json();
  if (d.error) throw new Error(d.error?.message || d.error);
  return (d.content || []).filter(b => b.type === "text").map(b => b.text).join("\n");
}

const D = new Date().toLocaleDateString("es-AR", { day: "numeric", month: "long", year: "numeric" });

/* ═══ PROMPTS ═══ */
const DAILY_SYS = `Eres Meridian. Hoy ${D}. Buscá info ACTUAL con web search sobre mercados.
SOLO JSON PURO:{"titulo":"qué pasó hoy en 1 oración","detalle":"2 oraciones resumen","manana":"1 oración qué mirar mañana","fuentes":["f1","f2"]}
Foco argentino. SOLO JSON.`;

const HOME_SYS = `Eres Meridian, analista institucional argentino. Hoy ${D}. Buscá info ACTUAL con web search.
Devolvé SOLO JSON PURO (sin backticks, sin markdown):
{"macro":{"fase":"...","sentimiento":"risk-on/risk-off/mixto","resumen":"2 oraciones"},"oportunidades":[{"rank":1,"activo":"...","ticker":"...","clase":"...","tesis":"1 oración","horizonte":"corto/mediano/largo","riesgo":"bajo/medio/alto","señal":"compra/acumular/watchlist","fuente":"..."},...(6)],"tendencias":[{"sector":"...","direccion":"alcista/bajista/lateral","motivo":"1 oración","picks":[{"activo":"...","ticker":"...","tesis":"1 oración","riesgo":"bajo/medio/alto"},...(4)],"fuente":"..."},...(5)],"riesgos":["..","..",".."],"fuentes_generales":["f1","f2","f3"]}
Foco argentino: cauciones, CEDEARs, acciones arg, plazo fijo, FCIs. DATOS REALES. SOLO JSON.`;

const RF_SYS = `Eres Meridian, analista de renta fija argentino. Hoy ${D}. Buscá info ACTUAL con web search.
SOLO JSON PURO (sin backticks):
{"resumen":"1 oración","tasas":{"fed":"...","bcra":"...","caucion_1d":"...%","caucion_7d":"...%","plazo_fijo":"...%"},"secciones":[{"nombre":"Cauciones","icono":"🔄","items":[{"activo":"...","ticker":"...","tipo":"caución","moneda":"ARS/USD","tir":"...%","duration":"...","riesgo":"bajo","tesis":"1 oración","señal":"compra/acumular/watchlist","fuente":"..."},...(4)]},{"nombre":"Plazo Fijo y FCIs","icono":"🏦","items":[..4]},{"nombre":"Bonos Soberanos","icono":"🏛","items":[..4]},{"nombre":"Letras y Corto Plazo","icono":"📄","items":[..4]},{"nombre":"ONs Corporativas","icono":"🏢","items":[..4]}],"movimientos":[{"activo":"...","cambio":"sube/baja","detalle":"1 oración"},...(3)],"fuentes":["f1","f2","f3"]}
Cauciones: ARS 1d,7d + USD 1d,7d. Plazo fijo: tasas actuales bancos, FCIs money market. Bonos: AL30, GD35, Treasury. DATOS REALES. SOLO JSON.`;

const RV_SYS = `Eres Meridian, analista de renta variable argentino. Hoy ${D}. Buscá info ACTUAL con web search.
SOLO JSON PURO (sin backticks):
{"resumen":"1 oración","indices":{"sp500":{"valor":"...","cambio":"...%"},"merval":{"valor":"...","cambio":"...%"},"ccl":{"valor":"...","cambio":"...%"}},"secciones":[{"nombre":"Acciones Argentinas","icono":"🇦🇷","items":[{"activo":"...","ticker":"...","tipo":"acción","mercado":"AR","precio":"...","cambio_dia":"...%","riesgo":"bajo/medio/alto","tesis":"1 oración","señal":"compra/acumular/watchlist","sector":"...","fuente":"..."},...(4)]},{"nombre":"CEDEARs","icono":"🔗","items":[..4]},{"nombre":"ETFs","icono":"📊","items":[..4]},{"nombre":"Acciones US","icono":"🇺🇸","items":[..4]}],"movimientos":[{"activo":"...","cambio":"sube/baja","detalle":"1 oración"},...(3)],"fuentes":["f1","f2","f3"]}
Foco: GGAL, YPF, VIST, PAMP, BBAR + CEDEARs más operados. DATOS REALES. SOLO JSON.`;

const CAL_SYS = `Eres Meridian. Hoy ${D}. Listá los próximos eventos económicos importantes para un inversor argentino de los próximos 15 días.
SOLO JSON PURO:{"eventos":[{"fecha":"DD/MM","titulo":"...","pais":"AR/US/EU","impacto":"alto/medio/bajo","detalle":"1 oración","tipo":"tasa/dato macro/earnings/vencimiento/licitación"},...(12)],"fuentes":["investing.com","bcra.gob.ar"]}
Incluí: Fed, BCRA, inflación AR/US, licitaciones Tesoro, vencimientos, earnings. SOLO JSON.`;

const RES_SYS = `Eres Meridian, analista institucional. Hoy ${D}. Buscá info ACTUAL con web search.
NO uses etiquetas HTML de citación. Solo markdown.
FORMATO:
## 📊 Estrategia
[1 párrafo]
## 💼 Portafolio
| Activo | Ticker | Clase | Peso | Horizonte | Riesgo |
|--------|--------|-------|------|-----------|--------|
[tabla]
## 📋 Detalle
### 1. [Nombre] ([TICKER])
**Clase:** ... | **Peso:** ...% | **Riesgo:** ...
**Tesis:** 2-3 puntos
**Catalizadores:** próximos
**Stop-loss:** salida
## 🌍 Diversificación
## ⚠️ Riesgos
## 📰 Fuentes
---
*Análisis informativo, no asesoramiento financiero regulado.*
Foco argentino: cauciones, CEDEARs, acciones arg, plazo fijo, FCIs. Tickers REALES.`;

/* ═══ Helpers ═══ */
function cleanCites(t) { return t ? t.replace(/<\/?antml:[^>]*>/gi, "").replace(/<\/?cite[^>]*>/gi, "").replace(/<[^>]*index="[^"]*"[^>]*>/gi, "").replace(/<\/[^>]*>/gi, "") : ""; }
function cleanObj(o) {
  if (typeof o === "string") return cleanCites(o);
  if (Array.isArray(o)) return o.map(cleanObj);
  if (o && typeof o === "object") { const n = {}; for (const k in o) n[k] = cleanObj(o[k]); return n; }
  return o;
}
function renderMd(raw) {
  if (!raw) return "";
  let t = cleanCites(raw).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  t = t.replace(/^(\|.+\|)\n(\|[-| :]+\|)\n((?:\|.+\|\n?)*)/gm, (_, h, s, b) => {
    const ths = h.split("|").filter(c => c.trim()).map(c => `<th>${c.trim()}</th>`).join("");
    const rows = b.trim().split("\n").map(r => `<tr>${r.split("|").filter(c => c.trim()).map(c => `<td>${c.trim()}</td>`).join("")}</tr>`).join("");
    return `<div class="tw"><table class="pt"><thead><tr>${ths}</tr></thead><tbody>${rows}</tbody></table></div>`;
  });
  return t.replace(/^### (.+)$/gm,'<h3 class="h3">$1</h3>').replace(/^## (.+)$/gm,'<h2 class="h2">$1</h2>')
    .replace(/\*\*(.+?)\*\*/g,'<strong class="bd">$1</strong>').replace(/\*(.+?)\*/g,'<em>$1</em>')
    .replace(/`(.+?)`/g,'<code class="cd">$1</code>').replace(/^- (.+)$/gm,'<li class="li">$1</li>')
    .replace(/^(\d+)\. (.+)$/gm,'<li class="li">$2</li>').replace(/---/g,'<hr class="hr"/>')
    .replace(/\n{2,}/g,'<br/><br/>').replace(/\n/g,'<br/>');
}

/* ═══ Shared UI ═══ */
function Sk({ w="100%", h=16 }) { return <div style={{ width:w, height:h, borderRadius:6, background:"linear-gradient(90deg,rgba(59,130,246,.04) 25%,rgba(59,130,246,.1) 50%,rgba(59,130,246,.04) 75%)", backgroundSize:"200% 100%", animation:"shimmer 2s infinite" }}/>; }
function SkCard() { return <div style={{ background:"rgba(255,255,255,.02)", border:"1px solid rgba(59,130,246,.06)", borderRadius:14, padding:18 }}><div style={{ display:"flex", justifyContent:"space-between", marginBottom:12 }}><Sk w={55} h={11}/><Sk w={50} h={22}/></div><Sk w="60%" h={18}/><div style={{height:6}}/><Sk w={80} h={13}/><div style={{height:10}}/><Sk w="100%" h={12}/><div style={{height:4}}/><Sk w="80%" h={12}/></div>; }
function Dots({ text="Buscando datos…" }) { return <div style={{ display:"flex", alignItems:"center", gap:10, padding:"28px 0" }}><div style={{ display:"flex", gap:5 }}>{[0,1,2].map(i=><div key={i} style={{ width:8, height:8, borderRadius:"50%", background:"#3B82F6", animation:`dotP 1.4s ease-in-out ${i*.15}s infinite` }}/>)}</div><span style={{ fontSize:13, color:"#4B6FA0" }}>{text}</span></div>; }
function Badge({ type, children }) {
  const m = { compra:{bg:"#22D3EE15",border:"#22D3EE30",color:"#22D3EE"}, acumular:{bg:"#818CF815",border:"#818CF830",color:"#818CF8"}, watchlist:{bg:"#94A3B810",border:"#94A3B820",color:"#94A3B8"}, bajo:{color:"#34D399"}, medio:{color:"#818CF8"}, alto:{color:"#FB7185"} };
  const s = m[type] || m.watchlist;
  return <span style={{ background:s.bg||"transparent", border:s.border?`1px solid ${s.border}`:"none", color:s.color, padding:"3px 9px", borderRadius:20, fontSize:9.5, fontWeight:700, fontFamily:"'Azeret Mono',monospace", letterSpacing:".05em", textTransform:"uppercase" }}>{children}</span>;
}
function Sources({ list }) {
  if (!list?.length) return null;
  return <div style={{ marginTop:10, padding:"8px 12px", background:"rgba(59,130,246,.02)", borderRadius:8, border:"1px solid rgba(59,130,246,.04)" }}>
    <span style={{ fontSize:9, fontFamily:"'Azeret Mono',monospace", color:"#3B6EB5", letterSpacing:".08em" }}>FUENTES: </span>
    <span style={{ fontSize:10.5, color:"#4B6FA0" }}>{list.join(" · ")}</span>
  </div>;
}

const RSK = { bajo:{color:"#34D399"}, medio:{color:"#818CF8"}, alto:{color:"#FB7185"} };
const DIR = { alcista:{color:"#34D399",icon:"▲",bg:"rgba(52,211,153,.04)"}, bajista:{color:"#FB7185",icon:"▼",bg:"rgba(251,113,133,.04)"}, lateral:{color:"#94A3B8",icon:"■",bg:"rgba(148,163,184,.03)"} };

function AssetCard({ item }) {
  const rk = RSK[item.riesgo] || RSK.medio;
  return <div className="card-h" style={{ background:"rgba(255,255,255,.02)", border:"1px solid rgba(59,130,246,.05)", borderRadius:14, padding:"14px 16px", position:"relative", overflow:"hidden" }}>
    <div style={{ position:"absolute", top:0, right:0, width:60, height:60, background:`radial-gradient(circle at top right,${rk.color}06,transparent 70%)` }}/>
    <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:7 }}>
      <div style={{ display:"flex", alignItems:"center", gap:5, flexWrap:"wrap" }}>
        <span style={{ fontSize:9.5, color:"#3B6EB5", fontFamily:"'Azeret Mono',monospace", fontWeight:600 }}>{(item.tipo||item.clase||"").toUpperCase()}</span>
        {item.moneda && <span style={{ fontSize:8.5, color:"#2A4A7A", fontFamily:"'Azeret Mono',monospace", background:"rgba(59,130,246,.06)", padding:"1px 5px", borderRadius:7 }}>{item.moneda}</span>}
        {item.mercado && <span style={{ fontSize:8.5, color:"#2A4A7A", fontFamily:"'Azeret Mono',monospace", background:"rgba(59,130,246,.06)", padding:"1px 5px", borderRadius:7 }}>{item.mercado}</span>}
      </div>
      <Badge type={item.señal || "watchlist"}>{(item.señal||"watchlist").toUpperCase()}</Badge>
    </div>
    <div style={{ fontSize:15, fontWeight:700, color:"#E1E7EF", marginBottom:2 }}>{item.activo}</div>
    <div style={{ display:"flex", alignItems:"baseline", gap:7, marginBottom:7, flexWrap:"wrap" }}>
      <span style={{ fontSize:11.5, color:"#3B82F6", fontFamily:"'Azeret Mono',monospace", fontWeight:500 }}>{item.ticker}</span>
      {item.tir && <span style={{ fontSize:11, color:"#34D399", fontFamily:"'Azeret Mono',monospace", fontWeight:600 }}>TIR {item.tir}</span>}
      {item.precio && <span style={{ fontSize:11, color:"#94A3B8", fontFamily:"'Azeret Mono',monospace" }}>{item.precio}</span>}
      {item.cambio_dia && <span style={{ fontSize:11, color:item.cambio_dia?.startsWith("-")?"#FB7185":"#34D399", fontFamily:"'Azeret Mono',monospace", fontWeight:600 }}>{item.cambio_dia}</span>}
    </div>
    <p style={{ fontSize:11.5, color:"#6B82A0", lineHeight:1.5, marginBottom:8 }}>{item.tesis}</p>
    <div style={{ display:"flex", gap:7, alignItems:"center", flexWrap:"wrap" }}>
      <span style={{ display:"flex", alignItems:"center", gap:3, fontSize:10, color:rk.color, fontWeight:600 }}><span style={{ width:5, height:5, borderRadius:"50%", background:rk.color, opacity:.6 }}/>{item.riesgo}</span>
      {item.duration && <span style={{ fontSize:10, color:"#3B6EB5" }}>{item.duration}</span>}
      {item.sector && <span style={{ fontSize:10, color:"#3B6EB5" }}>{item.sector}</span>}
      {item.fuente && <span style={{ fontSize:9, color:"#2A4A7A", fontStyle:"italic" }}>{item.fuente}</span>}
    </div>
  </div>;
}
function MovRow({ mov }) {
  const up = mov.cambio === "sube";
  return <div style={{ display:"flex", gap:10, padding:"8px 0", borderBottom:"1px solid rgba(255,255,255,.02)" }}>
    <span style={{ width:20, height:20, borderRadius:5, background:up?"rgba(52,211,153,.06)":"rgba(251,113,133,.06)", display:"flex", alignItems:"center", justifyContent:"center", fontSize:10, color:up?"#34D399":"#FB7185", fontWeight:800, flexShrink:0 }}>{up?"▲":"▼"}</span>
    <div style={{ flex:1 }}><span style={{ fontSize:12.5, fontWeight:600, color:"#D6E4F7" }}>{mov.activo}</span><span style={{ fontSize:11.5, color:"#6B82A0", marginLeft:7 }}>{mov.detalle}</span></div>
  </div>;
}
function TrendCard({ trend, dir }) {
  const [open, setOpen] = useState(false);
  return <div style={{ borderRadius:14, border:"1px solid rgba(59,130,246,.05)", overflow:"hidden", background:dir.bg, marginBottom:6 }}>
    <div onClick={()=>setOpen(!open)} style={{ padding:"12px 16px", display:"flex", alignItems:"center", gap:11, cursor:"pointer", background:open?"rgba(59,130,246,.02)":"transparent" }}>
      <span style={{ fontSize:13, color:dir.color, fontWeight:800, fontFamily:"'Azeret Mono',monospace", width:18, textAlign:"center" }}>{dir.icon}</span>
      <div style={{ flex:1 }}><div style={{ fontSize:13, fontWeight:600, color:"#D6E4F7", marginBottom:1 }}>{trend.sector}</div><div style={{ fontSize:11.5, color:"#6B82A0", lineHeight:1.4 }}>{trend.motivo}</div></div>
      <span style={{ fontSize:10, fontFamily:"'Azeret Mono',monospace", color:dir.color, fontWeight:600, textTransform:"uppercase" }}>{trend.direccion}</span>
      <span style={{ fontSize:13, color:"#3B6EB5", transition:"transform .2s", transform:open?"rotate(180deg)":"rotate(0)" }}>▾</span>
    </div>
    {open && trend.picks?.length > 0 && <div style={{ padding:"0 16px 12px", animation:"fadeIn .25s" }}>
      <div style={{ display:"flex", flexDirection:"column", gap:5 }}>
        {trend.picks.map((p,j)=>{ const rc=RSK[p.riesgo]||RSK.medio; return <div key={j} style={{ background:"rgba(255,255,255,.015)", border:"1px solid rgba(59,130,246,.04)", borderRadius:10, padding:"9px 13px", display:"flex", alignItems:"center", gap:11 }}>
          <div style={{ width:22, height:22, borderRadius:6, background:"rgba(59,130,246,.06)", display:"flex", alignItems:"center", justifyContent:"center", fontSize:10, fontWeight:700, color:"#3B82F6", fontFamily:"'Azeret Mono',monospace", flexShrink:0 }}>{j+1}</div>
          <div style={{ flex:1, minWidth:0 }}><span style={{ fontSize:12.5, fontWeight:600, color:"#D6E4F7" }}>{p.activo}</span><span style={{ fontSize:10.5, color:"#3B82F6", fontFamily:"'Azeret Mono',monospace", marginLeft:5 }}>{p.ticker}</span><div style={{ fontSize:11, color:"#6B82A0", marginTop:1 }}>{p.tesis}</div></div>
          <span style={{ width:5, height:5, borderRadius:"50%", background:rc.color, opacity:.7, flexShrink:0 }}/>
        </div>; })}
      </div>
      {trend.fuente && <div style={{ fontSize:9, color:"#2A4A7A", fontStyle:"italic", marginTop:6 }}>Fuente: {trend.fuente}</div>}
    </div>}
  </div>;
}
function SectionAccordion({ section }) {
  const [open, setOpen] = useState(false);
  return <div style={{ borderRadius:14, border:"1px solid rgba(59,130,246,.05)", overflow:"hidden", marginBottom:8, background:"rgba(255,255,255,.01)" }}>
    <div onClick={()=>setOpen(!open)} style={{ padding:"13px 16px", display:"flex", alignItems:"center", gap:11, cursor:"pointer", background:open?"rgba(59,130,246,.02)":"transparent", transition:"background .15s" }}>
      <span style={{ fontSize:18, flexShrink:0 }}>{section.icono}</span>
      <div style={{ flex:1, fontSize:14, fontWeight:700, color:"#D6E4F7" }}>{section.nombre}</div>
      <span style={{ fontSize:10, fontFamily:"'Azeret Mono',monospace", color:"#3B6EB5", background:"rgba(59,130,246,.06)", padding:"2px 8px", borderRadius:10 }}>{section.items?.length||0}</span>
      <span style={{ fontSize:13, color:"#3B6EB5", transition:"transform .2s", transform:open?"rotate(180deg)":"rotate(0)" }}>▾</span>
    </div>
    {open && section.items?.length > 0 && <div style={{ padding:"0 12px 12px", animation:"fadeIn .25s" }}>
      <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill,minmax(250px,1fr))", gap:8 }}>
        {section.items.map((item,j)=><AssetCard key={j} item={item}/>)}
      </div>
    </div>}
  </div>;
}

/* ═══ Calendar Event ═══ */
const IMP_COLORS = { alto:"#FB7185", medio:"#818CF8", bajo:"#34D399" };
function CalEvent({ ev }) {
  const c = IMP_COLORS[ev.impacto] || IMP_COLORS.medio;
  return <div style={{ display:"flex", gap:12, padding:"11px 0", borderBottom:"1px solid rgba(255,255,255,.02)" }}>
    <div style={{ width:44, flexShrink:0, textAlign:"center" }}>
      <div style={{ fontSize:13, fontWeight:700, color:"#7CB3FF", fontFamily:"'Azeret Mono',monospace" }}>{ev.fecha}</div>
      <div style={{ width:8, height:8, borderRadius:"50%", background:c, margin:"4px auto 0", opacity:.7 }}/>
    </div>
    <div style={{ flex:1 }}>
      <div style={{ display:"flex", alignItems:"center", gap:6, marginBottom:2 }}>
        <span style={{ fontSize:13, fontWeight:600, color:"#D6E4F7" }}>{ev.titulo}</span>
        <span style={{ fontSize:8.5, fontFamily:"'Azeret Mono',monospace", color:"#3B6EB5", background:"rgba(59,130,246,.06)", padding:"1px 6px", borderRadius:7 }}>{ev.pais}</span>
      </div>
      <div style={{ fontSize:11.5, color:"#6B82A0", lineHeight:1.45 }}>{ev.detalle}</div>
    </div>
    <span style={{ fontSize:9, fontFamily:"'Azeret Mono',monospace", color:c, fontWeight:600, textTransform:"uppercase", flexShrink:0, marginTop:2 }}>{ev.impacto}</span>
  </div>;
}

/* ═══ WIZARD ═══ */
const STEPS = [
  { id:"capital", emoji:"💰", q:"¿Con cuánto capital contás?", sub:"Rango más cercano a tu disponibilidad", opts:[
    { l:"USD 100 — 500", v:"entre USD 100 y 500" }, { l:"USD 500 — 1K", v:"entre USD 500 y 1.000" },
    { l:"USD 1K — 3K", v:"entre USD 1.000 y 3.000" }, { l:"USD 3K — 10K", v:"entre USD 3.000 y 10.000" },
    { l:"USD 10K — 30K", v:"entre USD 10.000 y 30.000" }, { l:"USD 30K+", v:"más de USD 30.000" }
  ]},
  { id:"horizonte", emoji:"⏳", q:"¿Tu horizonte de inversión?", sub:"¿Cuándo necesitarías el dinero?", opts:[
    { l:"Corto", d:"< 1 año", v:"corto plazo" }, { l:"Mediano", d:"1–3 años", v:"mediano plazo" }, { l:"Largo", d:"+3 años", v:"largo plazo" }
  ]},
  { id:"riesgo", emoji:"📊", q:"¿Cuánta volatilidad tolerás?", sub:"Define la composición", opts:[
    { l:"Conservador", d:"Priorizo no perder", v:"conservador", ic:"🛡" }, { l:"Moderado", d:"Acepto vaivenes", v:"moderado", ic:"⚖️" }, { l:"Agresivo", d:"Máximo crecimiento", v:"agresivo", ic:"⚡" }
  ]},
  { id:"pais", emoji:"🌐", q:"¿Desde dónde operás?", sub:"Regulaciones e impuestos", opts:[
    { l:"🇦🇷 Argentina", v:"Argentina (pesos, cepo)" }, { l:"🇲🇽 México", v:"México" }, { l:"🇨🇱 Chile", v:"Chile" },
    { l:"🇧🇷 Brasil", v:"Brasil" }, { l:"🇺🇸 EEUU", v:"EEUU" }, { l:"🇪🇸 España", v:"España" }, { l:"🌍 Otro", v:"otro" }
  ]},
  { id:"objetivo", emoji:"🎯", q:"¿Tu objetivo?", sub:"Determina la estrategia", opts:[
    { l:"Preservar", d:"No perder poder adquisitivo", v:"preservar capital", ic:"🔒" },
    { l:"Renta pasiva", d:"Dividendos e intereses", v:"renta pasiva", ic:"💵" },
    { l:"Crecimiento", d:"Crecer sostenidamente", v:"crecimiento", ic:"📈" },
    { l:"Máximo retorno", d:"Alto riesgo, alto retorno", v:"crecimiento agresivo", ic:"🚀" }
  ]},
  { id:"restricciones", emoji:"⚙️", q:"¿Preferencias?", sub:"Elegí varias o ninguna", multi:true, opts:[
    { l:"Sin restricciones", v:"sin restricciones" }, { l:"No cripto", v:"no cripto" },
    { l:"Solo renta fija", v:"preferencia renta fija" }, { l:"Solo local", v:"solo mercado local" }, { l:"Global", v:"diversificación global" }
  ]}
];

/* ══════════════════ APP ══════════════════ */
export default function App() {
  const [needsKey, setNeedsKey] = useState(!getApiKey());
  const [keyInput, setKeyInput] = useState("");
  const [showSettings, setShowSettings] = useState(false);
  const [tab, setTab] = useState("home");
  const [daily, setDaily] = useState(null); const [dL, setDL] = useState(true);
  const [hd, setHd] = useState(null); const [hL, setHL] = useState(true); const [hE, setHE] = useState(false);
  const [rf, setRf] = useState(null); const [rfL, setRfL] = useState(false); const [rfE, setRfE] = useState(false);
  const [rv, setRv] = useState(null); const [rvL, setRvL] = useState(false); const [rvE, setRvE] = useState(false);
  const [cal, setCal] = useState(null); const [calL, setCalL] = useState(false); const [calE, setCalE] = useState(false);
  const [view, setView] = useState(null);
  const [ws, setWs] = useState(0); const [wa, setWa] = useState({}); const [msel, setMsel] = useState([]);
  const [res, setRes] = useState(""); const [rL, setRL] = useState(false);

  const parse = (r) => {
    let c = r.replace(/```json\s?/g,"").replace(/```/g,"").trim();
    c = c.replace(/<\/?antml:[^>]*>/gi,"").replace(/<\/?cite[^>]*>/gi,"").replace(/<[^>]*index="[^"]*"[^>]*>/gi,"");
    const fi = c.indexOf("{"); const li = c.lastIndexOf("}");
    if (fi !== -1 && li !== -1) c = c.substring(fi, li + 1);
    return cleanObj(JSON.parse(c));
  };
  const loadDaily = useCallback(async()=>{ setDL(true);try{ const r=await askClaude([{role:"user",content:"Resumen mercados hoy. SOLO JSON."}],DAILY_SYS);setDaily(parse(r));}catch(e){console.error("Daily:",e);}setDL(false); },[]);
  const loadHome = useCallback(async()=>{ setHL(true);setHE(false);try{ const r=await askClaude([{role:"user",content:"Dashboard mercado. SOLO JSON."}],HOME_SYS);setHd(parse(r));}catch(e){console.error("Home:",e);setHE(true);}setHL(false); },[]);
  const loadRF = useCallback(async()=>{ setRfL(true);setRfE(false);try{ const r=await askClaude([{role:"user",content:"Renta fija hoy. SOLO JSON."}],RF_SYS);setRf(parse(r));}catch(e){console.error("RF:",e);setRfE(true);}setRfL(false); },[]);
  const loadRV = useCallback(async()=>{ setRvL(true);setRvE(false);try{ const r=await askClaude([{role:"user",content:"Renta variable hoy. SOLO JSON."}],RV_SYS);setRv(parse(r));}catch(e){console.error("RV:",e);setRvE(true);}setRvL(false); },[]);
  const loadCal = useCallback(async()=>{ setCalL(true);setCalE(false);try{ const r=await askClaude([{role:"user",content:"Calendario económico próximos 15 días inversor argentino. SOLO JSON."}],CAL_SYS);setCal(parse(r));}catch(e){console.error("Cal:",e);setCalE(true);}setCalL(false); },[]);

  useEffect(()=>{loadDaily();loadHome();},[loadDaily,loadHome]);
  useEffect(()=>{if(tab==="fija"&&!rf&&!rfL)loadRF();},[tab,rf,rfL,loadRF]);
  useEffect(()=>{if(tab==="variable"&&!rv&&!rvL)loadRV();},[tab,rv,rvL,loadRV]);
  useEffect(()=>{if(tab==="calendario"&&!cal&&!calL)loadCal();},[tab,cal,calL,loadCal]);

  const pick=(v)=>{const s=STEPS[ws];if(s.multi)return;const u={...wa,[s.id]:v};setWa(u);if(ws<STEPS.length-1)setTimeout(()=>setWs(ws+1),180);else genRes(u);};
  const togM=(v)=>v==="sin restricciones"?setMsel(["sin restricciones"]):setMsel(p=>{const f=p.filter(x=>x!=="sin restricciones");return f.includes(v)?f.filter(x=>x!==v):[...f,v];});
  const confirmM=()=>{const u={...wa,restricciones:(msel.length?msel:["sin restricciones"]).join(", ")};setWa(u);genRes(u);};
  const genRes=async(a)=>{setView("results");setRL(true);setRes("");try{const r=await askClaude([{role:"user",content:`Perfil:\n- Capital: ${a.capital}\n- Horizonte: ${a.horizonte}\n- Riesgo: ${a.riesgo}\n- País: ${a.pais}\n- Objetivo: ${a.objetivo}\n- Restricciones: ${a.restricciones}\n\nPortafolio personalizado.`}],RES_SYS);setRes(r||"Error.");}catch{setRes("⚠️ Error de conexión.");}setRL(false);};
  const resetW=()=>{setWs(0);setWa({});setMsel([]);setRes("");};
  const openWiz=()=>{resetW();setView("wizard");};
  const goBack=()=>{if(view==="wizard"&&ws>0)setWs(ws-1);else if(view==="wizard")setView(null);else if(view==="results"){resetW();setView("wizard");}else setView(null);};

  const step=STEPS[ws], prog=((ws+1)/STEPS.length)*100;
  const TABS=[{id:"home",label:"Hoy",icon:"◉"},{id:"fija",label:"Renta Fija",icon:"◫"},{id:"variable",label:"Variable",icon:"◈"},{id:"calendario",label:"Calendario",icon:"◷"},{id:"perfil",label:"Mi Perfil",icon:"◎"}];

  const Err=({onRetry})=><div style={{background:"rgba(251,113,133,.03)",border:"1px solid rgba(251,113,133,.08)",borderRadius:14,padding:18,fontSize:13,color:"#FB7185",display:"flex",justifyContent:"space-between",alignItems:"center"}}>Error al cargar<button className="ref" onClick={onRetry} style={{background:"rgba(59,130,246,.05)",border:"1px solid rgba(59,130,246,.08)",borderRadius:7,padding:"4px 12px",fontSize:10,color:"#7CB3FF",fontFamily:"'Azeret Mono',monospace",cursor:"pointer"}}>↻ Reintentar</button></div>;

  const saveKey = () => { if (keyInput.trim()) { setApiKey(keyInput.trim()); setNeedsKey(false); setKeyInput(""); } };
  const clearKey = () => { localStorage.removeItem("meridian_api_key"); setNeedsKey(true); setShowSettings(false); };

  if (needsKey) return (
    <div style={{ height:"100vh", width:"100vw", display:"flex", alignItems:"center", justifyContent:"center", background:"#000", fontFamily:"'Outfit',system-ui,sans-serif" }}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700;800&family=Azeret+Mono:wght@400;500;600&family=Fraunces:opsz,wght@9..144,400;9..144,600;9..144,700;9..144,800&display=swap');`}</style>
      <div style={{ maxWidth:400, width:"90%", textAlign:"center" }}>
        <div style={{ fontFamily:"'Fraunces',serif", fontSize:32, fontWeight:700, background:"linear-gradient(135deg,#3B82F6,#7CB3FF)", WebkitBackgroundClip:"text", WebkitTextFillColor:"transparent", marginBottom:8 }}>Meridian</div>
        <p style={{ fontSize:14, color:"#4B6FA0", marginBottom:28 }}>Ingresá tu API key de Anthropic para comenzar</p>
        <input value={keyInput} onChange={e=>setKeyInput(e.target.value)} onKeyDown={e=>e.key==="Enter"&&saveKey()} placeholder="sk-ant-api03-..." style={{ width:"100%", padding:"14px 16px", borderRadius:12, border:"1px solid rgba(59,130,246,.15)", background:"rgba(255,255,255,.03)", color:"#E1E7EF", fontSize:14, fontFamily:"'Azeret Mono',monospace", outline:"none", marginBottom:14, boxSizing:"border-box" }}/>
        <button onClick={saveKey} style={{ width:"100%", padding:14, borderRadius:12, border:"none", background:keyInput.trim()?"linear-gradient(135deg,#1D4ED8,#3B82F6)":"rgba(59,130,246,.05)", color:keyInput.trim()?"#fff":"#2A4A7A", fontSize:15, fontWeight:700, cursor:"pointer" }}>Comenzar →</button>
        <p style={{ fontSize:11, color:"#1E3355", marginTop:16 }}>Tu key se guarda solo en este navegador (localStorage)</p>
      </div>
    </div>
  );

  return (
    <div style={{ height:"100vh", width:"100vw", display:"flex", flexDirection:"column", background:"#000", color:"#E1E7EF", fontFamily:"'Outfit',system-ui,sans-serif", overflow:"hidden" }}>
      <div style={{ position:"fixed", inset:0, zIndex:0, pointerEvents:"none", background:"radial-gradient(ellipse 70% 50% at 50% 0%, rgba(29,78,216,.05) 0%, transparent 70%)" }}/>
      <div style={{ position:"fixed", inset:0, zIndex:0, pointerEvents:"none", opacity:.012, backgroundImage:"radial-gradient(rgba(59,130,246,.7) 1px, transparent 1px)", backgroundSize:"36px 36px" }}/>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700;800&family=Azeret+Mono:wght@400;500;600&family=Fraunces:opsz,wght@9..144,400;9..144,600;9..144,700;9..144,800&display=swap');
        @keyframes dotP{0%,100%{opacity:.2;transform:scale(.8)}50%{opacity:1;transform:scale(1.15)}}
        @keyframes slideUp{from{opacity:0;transform:translateY(16px)}to{opacity:1;transform:translateY(0)}}
        @keyframes slideIn{from{opacity:0;transform:translateX(20px)}to{opacity:1;transform:translateX(0)}}
        @keyframes shimmer{0%{background-position:-200% 0}100%{background-position:200% 0}}
        @keyframes fadeIn{from{opacity:0}to{opacity:1}}
        @keyframes pop{0%{transform:scale(1)}50%{transform:scale(.97)}100%{transform:scale(1)}}
        *{box-sizing:border-box;margin:0;padding:0}
        ::-webkit-scrollbar{width:4px}::-webkit-scrollbar-track{background:transparent}::-webkit-scrollbar-thumb{background:rgba(59,130,246,.08);border-radius:8px}
        .h2{font-family:'Fraunces',serif;font-size:1.15em;font-weight:600;color:#7CB3FF;margin:18px 0 8px;padding-bottom:6px;border-bottom:1px solid rgba(59,130,246,.08)}
        .h3{font-size:1em;font-weight:600;color:#93C5FD;margin:12px 0 4px}
        .bd{color:#D6E4F7}.cd{background:rgba(59,130,246,.08);color:#7CB3FF;padding:1px 6px;border-radius:4px;font-family:'Azeret Mono',monospace;font-size:.82em}
        .li{margin:3px 0;line-height:1.6;color:#A0B4CC;padding-left:4px}
        .hr{border:none;height:1px;background:linear-gradient(90deg,transparent,rgba(59,130,246,.1),transparent);margin:14px 0}
        .tw{overflow-x:auto;margin:12px 0;border-radius:10px;border:1px solid rgba(59,130,246,.07);background:rgba(255,255,255,.015)}
        .pt{width:100%;border-collapse:collapse;font-size:12px}.pt thead{background:rgba(59,130,246,.04)}
        .pt th{padding:8px 11px;text-align:left;font-family:'Azeret Mono',monospace;font-size:9px;font-weight:600;color:#3B82F6;letter-spacing:.06em;text-transform:uppercase;border-bottom:1px solid rgba(59,130,246,.07)}
        .pt td{padding:8px 11px;border-bottom:1px solid rgba(59,130,246,.03);color:#A0B4CC;font-size:12px}.pt tbody tr:last-child td{border-bottom:none}.pt tbody tr:hover{background:rgba(59,130,246,.02)}
        .card-h{transition:all .22s cubic-bezier(.4,0,.2,1)}.card-h:hover{transform:translateY(-2px);border-color:rgba(59,130,246,.18)!important;box-shadow:0 8px 24px rgba(0,0,0,.4)}
        .opt{transition:all .18s cubic-bezier(.4,0,.2,1);cursor:pointer}.opt:hover{border-color:rgba(59,130,246,.28)!important;background:rgba(59,130,246,.04)!important;transform:translateY(-1px)}.opt:active{animation:pop .15s}.opt.sel{border-color:rgba(59,130,246,.4)!important;background:rgba(59,130,246,.06)!important}
        .cta{transition:all .22s cubic-bezier(.4,0,.2,1);cursor:pointer}.cta:hover{transform:translateY(-1px);box-shadow:0 6px 20px rgba(59,130,246,.1)!important}
        .ref{transition:all .15s;cursor:pointer}.ref:hover{background:rgba(59,130,246,.08)!important;color:#7CB3FF!important}
        .back{transition:all .12s;cursor:pointer}.back:hover{color:#7CB3FF!important;background:rgba(59,130,246,.06)!important}
      `}</style>

      {/* HEADER */}
      <div style={{ height:50, display:"flex", alignItems:"center", justifyContent:"space-between", padding:"0 16px", borderBottom:"1px solid rgba(59,130,246,.04)", background:"rgba(0,0,0,.85)", backdropFilter:"blur(20px)", flexShrink:0, zIndex:20 }}>
        <div style={{ display:"flex", alignItems:"center", gap:8 }}>
          {view && <button className="back" onClick={goBack} style={{ background:"none", border:"none", color:"#3B6EB5", fontSize:18, padding:"2px 6px", borderRadius:5 }}>‹</button>}
          <span onClick={()=>{setView(null);setTab("home");}} style={{ fontFamily:"'Fraunces',serif", fontSize:20, fontWeight:700, background:"linear-gradient(135deg,#3B82F6,#7CB3FF)", WebkitBackgroundClip:"text", WebkitTextFillColor:"transparent", cursor:"pointer" }}>Meridian</span>
        </div>
        <span style={{ fontSize:9.5, fontFamily:"'Azeret Mono',monospace", color:"#1E3355" }}>{new Date().toLocaleDateString("es-AR",{day:"2-digit",month:"short",year:"numeric"}).toUpperCase()}</span>
        <button onClick={()=>setShowSettings(!showSettings)} style={{ background:"none", border:"none", color:"#2A4A7A", fontSize:16, cursor:"pointer", padding:"2px 4px" }}>⚙</button>
      </div>
      {showSettings && <div style={{ position:"absolute", top:50, right:12, zIndex:30, background:"rgba(10,10,20,.95)", border:"1px solid rgba(59,130,246,.1)", borderRadius:12, padding:16, width:260, backdropFilter:"blur(20px)" }}>
        <div style={{ fontSize:10, fontFamily:"'Azeret Mono',monospace", color:"#3B6EB5", marginBottom:8 }}>API KEY</div>
        <div style={{ fontSize:11, color:"#4B6FA0", marginBottom:10, wordBreak:"break-all" }}>{getApiKey().slice(0,12)}...{getApiKey().slice(-6)}</div>
        <button onClick={clearKey} style={{ width:"100%", padding:10, borderRadius:8, border:"1px solid rgba(251,113,133,.15)", background:"rgba(251,113,133,.04)", color:"#FB7185", fontSize:12, fontWeight:600, cursor:"pointer" }}>Cambiar API Key</button>
      </div>}

        {/* TABS */}
      {!view && <div style={{ display:"flex", borderBottom:"1px solid rgba(59,130,246,.04)", background:"rgba(0,0,0,.6)", flexShrink:0, zIndex:15, overflowX:"auto" }}>
        {TABS.map(t=><button key={t.id} onClick={()=>{if(t.id==="perfil")openWiz();else setTab(t.id);}}
          style={{ flex:1, padding:"10px 0", background:"none", border:"none", borderBottom:`2px solid ${tab===t.id?"rgba(59,130,246,.5)":"transparent"}`, color:tab===t.id?"#7CB3FF":"#2A4A7A", fontSize:10, fontWeight:600, fontFamily:"'Azeret Mono',monospace", cursor:"pointer", display:"flex", flexDirection:"column", alignItems:"center", gap:1, minWidth:65, transition:"all .15s" }}>
          <span style={{ fontSize:13 }}>{t.icon}</span>{t.label}
        </button>)}
      </div>}

      {/* CONTENT */}
      <div style={{ flex:1, overflowY:"auto", position:"relative", zIndex:1 }}>
        <div style={{ maxWidth:920, margin:"0 auto", padding:"18px 16px 34px" }}>

          {/* ──── HOME ──── */}
          {!view && tab==="home" && <>
            {/* Resumen diario - carga rápido */}
            {dL ? <div style={{ background:"rgba(59,130,246,.03)", border:"1px solid rgba(59,130,246,.06)", borderRadius:16, padding:20, marginBottom:20 }}><Sk w="50%" h={16}/><div style={{height:8}}/><Sk w="100%" h={12}/><div style={{height:4}}/><Sk w="90%" h={12}/><div style={{height:4}}/><Sk w="70%" h={12}/></div>
            : daily && <div style={{ background:"linear-gradient(135deg,rgba(59,130,246,.04),rgba(29,78,216,.02))", border:"1px solid rgba(59,130,246,.08)", borderRadius:16, padding:20, marginBottom:20, animation:"fadeIn .5s" }}>
              <div style={{ fontSize:10, fontFamily:"'Azeret Mono',monospace", color:"#3B82F6", letterSpacing:".1em", marginBottom:6 }}>📋 RESUMEN DEL DÍA</div>
              <div style={{ fontSize:16, fontWeight:700, color:"#E1E7EF", marginBottom:6 }}>{daily.titulo}</div>
              <p style={{ fontSize:13, lineHeight:1.7, color:"#8A9DB8", marginBottom:8 }}>{daily.detalle}</p>
              <div style={{ background:"rgba(59,130,246,.04)", borderRadius:10, padding:"10px 14px", marginBottom:6 }}>
                <span style={{ fontSize:10, fontFamily:"'Azeret Mono',monospace", color:"#7CB3FF", fontWeight:600 }}>👀 MAÑANA: </span>
                <span style={{ fontSize:12.5, color:"#93C5FD" }}>{daily.manana}</span>
              </div>
              <Sources list={daily.fuentes}/>
            </div>}

            {/* CTA */}
            <div onClick={openWiz} className="cta" style={{ background:"rgba(59,130,246,.04)", border:"1px solid rgba(59,130,246,.08)", borderRadius:14, padding:"16px 20px", marginBottom:20, display:"flex", alignItems:"center", justifyContent:"space-between", cursor:"pointer" }}>
              <div><div style={{ fontFamily:"'Fraunces',serif", fontSize:16, fontWeight:700, color:"#7CB3FF", marginBottom:2 }}>Analizar mi perfil</div><div style={{ fontSize:12, color:"#4B6FA0" }}>6 preguntas → portafolio personalizado</div></div>
              <div style={{ width:36, height:36, borderRadius:9, background:"rgba(59,130,246,.07)", display:"flex", alignItems:"center", justifyContent:"center", fontSize:16, color:"#7CB3FF" }}>→</div>
            </div>

            {/* Macro */}
            <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:10 }}>
              <h2 style={{ fontFamily:"'Fraunces',serif", fontSize:16, fontWeight:600, color:"#D6E4F7" }}>Macro</h2>
              {!hL&&<button className="ref" onClick={()=>{setHd(null);setDaily(null);loadDaily();loadHome();}} style={{ background:"rgba(59,130,246,.03)", border:"1px solid rgba(59,130,246,.06)", borderRadius:7, padding:"3px 10px", fontSize:10, color:"#3B6EB5", fontFamily:"'Azeret Mono',monospace" }}>↻</button>}
            </div>
            {hL ? <div style={{ background:"rgba(255,255,255,.02)", border:"1px solid rgba(59,130,246,.04)", borderRadius:14, padding:18, marginBottom:16 }}><Sk w="30%" h={14}/><div style={{height:7}}/><Sk w="100%" h={12}/></div>
            : hE ? <Err onRetry={()=>{setHE(false);setHd(null);loadHome();}}/>
            : hd?.macro && <div style={{ background:"rgba(255,255,255,.02)", border:"1px solid rgba(59,130,246,.04)", borderRadius:14, padding:16, marginBottom:16, animation:"fadeIn .5s" }}>
              <div style={{ display:"flex", gap:6, marginBottom:8, flexWrap:"wrap" }}>
                <span style={{ background:"rgba(59,130,246,.07)", color:"#7CB3FF", padding:"3px 10px", borderRadius:18, fontSize:10, fontWeight:600, fontFamily:"'Azeret Mono',monospace" }}>{hd.macro.fase?.toUpperCase()}</span>
                <span style={{ background:hd.macro.sentimiento?.includes("off")?"rgba(251,113,133,.06)":"rgba(52,211,153,.06)", color:hd.macro.sentimiento?.includes("off")?"#FB7185":"#34D399", padding:"3px 10px", borderRadius:18, fontSize:10, fontWeight:600, fontFamily:"'Azeret Mono',monospace" }}>{hd.macro.sentimiento?.toUpperCase()}</span>
              </div>
              <p style={{ fontSize:13, lineHeight:1.65, color:"#8A9DB8" }}>{hd.macro.resumen}</p>
            </div>}

            {/* Oportunidades */}
            <h2 style={{ fontFamily:"'Fraunces',serif", fontSize:16, fontWeight:600, color:"#D6E4F7", marginBottom:10 }}>Top Oportunidades</h2>
            {hL ? <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill,minmax(255px,1fr))", gap:10, marginBottom:16 }}>{[...Array(6)].map((_,i)=><SkCard key={i}/>)}</div>
            : hd?.oportunidades && <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill,minmax(255px,1fr))", gap:10, marginBottom:16, animation:"fadeIn .5s" }}>{hd.oportunidades.map((o,i)=><AssetCard key={i} item={o}/>)}</div>}

            {/* Tendencias */}
            <h2 style={{ fontFamily:"'Fraunces',serif", fontSize:16, fontWeight:600, color:"#D6E4F7", marginBottom:10 }}>Tendencias</h2>
            {hL ? <div style={{ marginBottom:16 }}>{[...Array(4)].map((_,i)=><div key={i} style={{ background:"rgba(255,255,255,.02)", border:"1px solid rgba(59,130,246,.04)", borderRadius:12, padding:14, marginBottom:6 }}><Sk w="35%" h={14}/><div style={{height:5}}/><Sk w="80%" h={12}/></div>)}</div>
            : hd?.tendencias && <div style={{ marginBottom:16, animation:"fadeIn .5s" }}>{hd.tendencias.map((t,i)=><TrendCard key={i} trend={t} dir={DIR[t.direccion]||DIR.lateral}/>)}</div>}

            {/* Riesgos */}
            {hd?.riesgos&&!hL&& <div style={{ marginBottom:16, animation:"fadeIn .5s" }}>
              <h2 style={{ fontFamily:"'Fraunces',serif", fontSize:16, fontWeight:600, color:"#D6E4F7", marginBottom:10 }}>Riesgos</h2>
              <div style={{ background:"rgba(251,113,133,.02)", border:"1px solid rgba(251,113,133,.06)", borderRadius:14, padding:14 }}>
                {hd.riesgos.map((r,i)=><div key={i} style={{ display:"flex", gap:10, padding:"6px 0", borderBottom:i<hd.riesgos.length-1?"1px solid rgba(255,255,255,.02)":"none" }}>
                  <span style={{ width:18, height:18, borderRadius:5, background:"rgba(251,113,133,.06)", display:"flex", alignItems:"center", justifyContent:"center", fontSize:9, color:"#FB7185", fontWeight:700, flexShrink:0 }}>{i+1}</span>
                  <span style={{ fontSize:12.5, color:"#8A9DB8", lineHeight:1.5 }}>{r}</span>
                </div>)}
              </div>
            </div>}
            {hd?.fuentes_generales && !hL && <Sources list={hd.fuentes_generales}/>}
          </>}

          {/* ──── RENTA FIJA ──── */}
          {!view && tab==="fija" && <>
            <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:14 }}>
              <div><h1 style={{ fontFamily:"'Fraunces',serif", fontSize:20, fontWeight:700, color:"#D6E4F7" }}>Renta Fija</h1><p style={{ fontSize:11.5, color:"#3B6EB5", marginTop:1 }}>Cauciones, bonos, letras, plazos fijos, FCIs</p></div>
              {!rfL&&<button className="ref" onClick={()=>{setRf(null);loadRF();}} style={{ background:"rgba(59,130,246,.03)", border:"1px solid rgba(59,130,246,.06)", borderRadius:7, padding:"4px 12px", fontSize:10, color:"#3B6EB5", fontFamily:"'Azeret Mono',monospace" }}>↻</button>}
            </div>
            {rfL ? <Dots text="Cargando renta fija…"/>
            : rfE ? <Err onRetry={()=>{setRfE(false);setRf(null);loadRF();}}/>
            : rf && <div style={{ animation:"fadeIn .5s" }}>
              <p style={{ fontSize:13, lineHeight:1.65, color:"#8A9DB8", marginBottom:14 }}>{rf.resumen}</p>
              {rf.tasas && <div style={{ display:"flex", gap:8, marginBottom:16, flexWrap:"wrap" }}>
                {Object.entries(rf.tasas).map(([k,v])=><div key={k} style={{ background:"rgba(59,130,246,.04)", border:"1px solid rgba(59,130,246,.06)", borderRadius:10, padding:"9px 14px", flex:1, minWidth:85 }}>
                  <div style={{ fontSize:8.5, fontFamily:"'Azeret Mono',monospace", color:"#3B6EB5", letterSpacing:".07em", textTransform:"uppercase", marginBottom:3 }}>{k.replace(/_/g," ")}</div>
                  <div style={{ fontSize:17, fontWeight:700, color:"#7CB3FF", fontFamily:"'Azeret Mono',monospace" }}>{v}</div>
                </div>)}
              </div>}
              {rf.movimientos?.length>0 && <div style={{ marginBottom:14 }}><div style={{ fontSize:9, fontFamily:"'Azeret Mono',monospace", color:"#3B6EB5", letterSpacing:".1em", marginBottom:6 }}>MOVIMIENTOS</div><div style={{ background:"rgba(255,255,255,.015)", border:"1px solid rgba(59,130,246,.04)", borderRadius:12, padding:"3px 12px" }}>{rf.movimientos.map((m,i)=><MovRow key={i} mov={m}/>)}</div></div>}
              {rf.secciones?.map((sec,i)=><SectionAccordion key={i} section={sec}/>)}
              <Sources list={rf.fuentes}/>
            </div>}
          </>}

          {/* ──── RENTA VARIABLE ──── */}
          {!view && tab==="variable" && <>
            <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:14 }}>
              <div><h1 style={{ fontFamily:"'Fraunces',serif", fontSize:20, fontWeight:700, color:"#D6E4F7" }}>Renta Variable</h1><p style={{ fontSize:11.5, color:"#3B6EB5", marginTop:1 }}>Acciones, ETFs, CEDEARs</p></div>
              {!rvL&&<button className="ref" onClick={()=>{setRv(null);loadRV();}} style={{ background:"rgba(59,130,246,.03)", border:"1px solid rgba(59,130,246,.06)", borderRadius:7, padding:"4px 12px", fontSize:10, color:"#3B6EB5", fontFamily:"'Azeret Mono',monospace" }}>↻</button>}
            </div>
            {rvL ? <Dots text="Cargando renta variable…"/>
            : rvE ? <Err onRetry={()=>{setRvE(false);setRv(null);loadRV();}}/>
            : rv && <div style={{ animation:"fadeIn .5s" }}>
              <p style={{ fontSize:13, lineHeight:1.65, color:"#8A9DB8", marginBottom:14 }}>{rv.resumen}</p>
              {rv.indices && <div style={{ display:"flex", gap:8, marginBottom:16, flexWrap:"wrap" }}>
                {Object.entries(rv.indices).map(([k,v])=><div key={k} style={{ background:"rgba(59,130,246,.04)", border:"1px solid rgba(59,130,246,.06)", borderRadius:10, padding:"9px 14px", flex:1, minWidth:90 }}>
                  <div style={{ fontSize:8.5, fontFamily:"'Azeret Mono',monospace", color:"#3B6EB5", letterSpacing:".07em", textTransform:"uppercase", marginBottom:3 }}>{k}</div>
                  <div style={{ fontSize:17, fontWeight:700, color:"#7CB3FF", fontFamily:"'Azeret Mono',monospace" }}>{v.valor}</div>
                  <div style={{ fontSize:11, color:v.cambio?.startsWith("-")?"#FB7185":"#34D399", fontFamily:"'Azeret Mono',monospace", fontWeight:600 }}>{v.cambio}</div>
                </div>)}
              </div>}
              {rv.movimientos?.length>0 && <div style={{ marginBottom:14 }}><div style={{ fontSize:9, fontFamily:"'Azeret Mono',monospace", color:"#3B6EB5", letterSpacing:".1em", marginBottom:6 }}>MOVIMIENTOS</div><div style={{ background:"rgba(255,255,255,.015)", border:"1px solid rgba(59,130,246,.04)", borderRadius:12, padding:"3px 12px" }}>{rv.movimientos.map((m,i)=><MovRow key={i} mov={m}/>)}</div></div>}
              {rv.secciones?.map((sec,i)=><SectionAccordion key={i} section={sec}/>)}
              <Sources list={rv.fuentes}/>
            </div>}
          </>}

          {/* ──── CALENDARIO ──── */}
          {!view && tab==="calendario" && <>
            <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:14 }}>
              <div><h1 style={{ fontFamily:"'Fraunces',serif", fontSize:20, fontWeight:700, color:"#D6E4F7" }}>Calendario Económico</h1><p style={{ fontSize:11.5, color:"#3B6EB5", marginTop:1 }}>Próximos 15 días · Eventos que mueven mercados</p></div>
              {!calL&&<button className="ref" onClick={()=>{setCal(null);loadCal();}} style={{ background:"rgba(59,130,246,.03)", border:"1px solid rgba(59,130,246,.06)", borderRadius:7, padding:"4px 12px", fontSize:10, color:"#3B6EB5", fontFamily:"'Azeret Mono',monospace" }}>↻</button>}
            </div>
            {calL ? <Dots text="Buscando eventos…"/>
            : calE ? <Err onRetry={()=>{setCalE(false);setCal(null);loadCal();}}/>
            : cal && <div style={{ animation:"fadeIn .5s" }}>
              <div style={{ display:"flex", gap:12, marginBottom:16, flexWrap:"wrap" }}>
                {[{l:"Alto",c:"#FB7185"},{l:"Medio",c:"#818CF8"},{l:"Bajo",c:"#34D399"}].map(x=><div key={x.l} style={{ display:"flex", alignItems:"center", gap:4 }}><div style={{ width:8, height:8, borderRadius:"50%", background:x.c, opacity:.7 }}/><span style={{ fontSize:10, color:"#4B6FA0" }}>Impacto {x.l}</span></div>)}
              </div>
              <div style={{ background:"rgba(255,255,255,.015)", border:"1px solid rgba(59,130,246,.04)", borderRadius:14, padding:"4px 16px" }}>
                {cal.eventos?.map((ev,i)=><CalEvent key={i} ev={ev}/>)}
              </div>
              <Sources list={cal.fuentes}/>
            </div>}
          </>}

          {/* ──── WIZARD ──── */}
          {view==="wizard" && <div style={{ maxWidth:520, margin:"0 auto" }}>
            <div style={{ display:"flex", justifyContent:"space-between", marginBottom:6, fontSize:10, fontFamily:"'Azeret Mono',monospace", color:"#2A4A7A" }}><span>Paso {ws+1}/{STEPS.length}</span><span>{Math.round(prog)}%</span></div>
            <div style={{ height:3, background:"rgba(59,130,246,.05)", borderRadius:4, marginBottom:24 }}><div style={{ height:"100%", width:`${prog}%`, background:"linear-gradient(90deg,#1D4ED8,#3B82F6,#7CB3FF)", borderRadius:4, transition:"width .3s" }}/></div>
            <div key={ws} style={{ animation:"slideIn .35s" }}>
              <div style={{ fontSize:38, marginBottom:10 }}>{step.emoji}</div>
              <h2 style={{ fontFamily:"'Fraunces',serif", fontSize:22, fontWeight:700, color:"#E1E7EF", marginBottom:3 }}>{step.q}</h2>
              <p style={{ fontSize:12.5, color:"#3B6EB5", marginBottom:22 }}>{step.sub}</p>
              <div style={{ display:"flex", flexDirection:"column", gap:7 }}>
                {step.opts.map((o,i)=>{
                  const sel = step.multi ? msel.includes(o.v) : wa[step.id]===o.v;
                  return <button key={i} className={`opt ${sel?"sel":""}`} onClick={()=>step.multi?togM(o.v):pick(o.v)} style={{ background:sel?"rgba(59,130,246,.05)":"rgba(255,255,255,.02)", border:`1px solid ${sel?"rgba(59,130,246,.3)":"rgba(59,130,246,.05)"}`, borderRadius:12, padding:"12px 16px", textAlign:"left", display:"flex", alignItems:"center", gap:11, position:"relative" }}>
                    {o.ic&&<span style={{ fontSize:18, flexShrink:0 }}>{o.ic}</span>}
                    {sel&&<span style={{ position:"absolute", top:10, right:14, color:"#3B82F6", fontWeight:700, fontSize:13 }}>✓</span>}
                    <div><div style={{ fontSize:13.5, fontWeight:600, color:sel?"#7CB3FF":"#D6E4F7" }}>{o.l}</div>{o.d&&<div style={{ fontSize:11.5, color:"#3B6EB5", marginTop:1 }}>{o.d}</div>}</div>
                  </button>;
                })}
              </div>
              {step.multi && <button onClick={confirmM} className="cta" style={{ marginTop:18, width:"100%", padding:13, borderRadius:12, border:"none", background:msel.length?"linear-gradient(135deg,#1D4ED8,#3B82F6)":"rgba(59,130,246,.05)", color:msel.length?"#fff":"#2A4A7A", fontSize:14, fontWeight:700, boxShadow:msel.length?"0 8px 24px rgba(29,78,216,.18)":"none" }}>Generar portafolio →</button>}
            </div>
          </div>}

          {/* ──── RESULTS ──── */}
          {view==="results" && <>
            <div style={{ background:"rgba(59,130,246,.02)", border:"1px solid rgba(59,130,246,.06)", borderRadius:14, padding:"13px 16px", marginBottom:18, animation:"fadeIn .4s" }}>
              <div style={{ fontSize:9, fontFamily:"'Azeret Mono',monospace", color:"#3B82F6", letterSpacing:".12em", marginBottom:7 }}>TU PERFIL</div>
              <div style={{ display:"flex", flexWrap:"wrap", gap:5 }}>{Object.entries(wa).map(([k,v])=><span key={k} style={{ background:"rgba(59,130,246,.05)", border:"1px solid rgba(59,130,246,.06)", padding:"4px 9px", borderRadius:16, fontSize:11, color:"#7CB3FF", fontWeight:500 }}>{v.length>38?v.slice(0,38)+"…":v}</span>)}</div>
            </div>
            {rL ? <Dots text="Armando tu portafolio…"/> : <div style={{ animation:"slideUp .4s" }}>
              <div style={{ background:"rgba(255,255,255,.02)", border:"1px solid rgba(59,130,246,.04)", borderRadius:16, padding:"20px 22px" }}>
                <div style={{ fontSize:13, lineHeight:1.75, color:"#8A9DB8" }} dangerouslySetInnerHTML={{ __html:renderMd(res) }}/>
              </div>
              <div style={{ display:"flex", gap:10, marginTop:18, flexWrap:"wrap" }}>
                <button onClick={()=>{resetW();setView("wizard");}} className="cta" style={{ flex:1, minWidth:170, padding:13, borderRadius:12, border:"1px solid rgba(59,130,246,.1)", background:"rgba(59,130,246,.04)", color:"#7CB3FF", fontSize:13, fontWeight:600 }}>↻ Recalcular</button>
                <button onClick={()=>setView(null)} className="cta" style={{ flex:1, minWidth:170, padding:13, borderRadius:12, border:"1px solid rgba(59,130,246,.05)", background:"rgba(255,255,255,.02)", color:"#4B6FA0", fontSize:13, fontWeight:600 }}>← Volver</button>
              </div>
            </div>}
          </>}

          <div style={{ textAlign:"center", fontSize:9, color:"#1E3355", fontFamily:"'Azeret Mono',monospace", paddingTop:14 }}>Análisis informativo · No constituye asesoramiento financiero regulado</div>
        </div>
      </div>
    </div>
  );
}

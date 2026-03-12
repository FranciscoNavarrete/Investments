import { getStore } from "@netlify/blobs";

/* ═══ CONFIG ═══ */
const API_URL = "https://api.anthropic.com/v1/messages";
const HAIKU = "claude-haiku-4-5-20251001";
const SONNET = "claude-sonnet-4-20250514";

const CACHE_TTL = {
  market_data: 30 * 60 * 1000,   // 30 min - datos de mercado
  daily: 30 * 60 * 1000,          // 30 min - resumen diario
  home: 2 * 60 * 60 * 1000,       // 2 horas - macro + oportunidades
  rf: 60 * 60 * 1000,             // 1 hora - renta fija
  rv: 30 * 60 * 1000,             // 30 min - renta variable
  cal: 12 * 60 * 60 * 1000,       // 12 horas - calendario
};

const D = new Date().toLocaleDateString("es-AR", { day: "numeric", month: "long", year: "numeric" });

/* ═══ CORS ═══ */
const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
  "Content-Type": "application/json",
};

/* ═══ PROMPTS POR AGENTE ═══ */

// DATA AGENT: Solo busca datos crudos de mercado
const DATA_PROMPT = `Hoy ${D}. Datos de mercado argentino y global.
SOLO JSON:
{"indices":{"sp500":"val","merval":"val","ccl":"val"},"tasas":{"bcra":"x%","caucion_1d":"x%","caucion_7d":"x%","plazo_fijo":"x%"},"bonos":{"al30":"precio","gd35":"precio"},"acciones":{"ggal":"precio","ypf":"precio","vist":"precio","pamp":"precio"},"dolar":{"oficial":"x","mep":"x","ccl":"x"},"noticias":["noticia1","noticia2"]}
SOLO JSON.`;

// DAILY AGENT: Resumen del día (recibe datos, sin web search)
const DAILY_PROMPT = `Eres Meridian. Hoy ${D}. Con estos datos de mercado, hacé un resumen del día.
Respondé ÚNICAMENTE con JSON:
{"titulo":"qué pasó hoy en 1 oración","detalle":"2 oraciones resumen","manana":"1 oración qué mirar mañana","fuentes":["fuente1","fuente2"]}
SOLO JSON.`;

// MACRO AGENT: Análisis macro (recibe datos, sin web search)
const MACRO_PROMPT = `Eres Meridian, analista macro argentino. Hoy ${D}. Con estos datos de mercado, analizá la situación.
Respondé ÚNICAMENTE con JSON:
{"macro":{"fase":"expansión/contracción/estancamiento","sentimiento":"risk-on/risk-off/mixto","resumen":"2 oraciones"},"oportunidades":[{"rank":1,"activo":"nombre","ticker":"TICK","clase":"tipo","tesis":"1 oración","horizonte":"corto/mediano/largo","riesgo":"bajo/medio/alto","señal":"compra/acumular/watchlist"},{"rank":2,"activo":"...","ticker":"...","clase":"...","tesis":"...","horizonte":"...","riesgo":"...","señal":"..."},{"rank":3,"activo":"...","ticker":"...","clase":"...","tesis":"...","horizonte":"...","riesgo":"...","señal":"..."},{"rank":4,"activo":"...","ticker":"...","clase":"...","tesis":"...","horizonte":"...","riesgo":"...","señal":"..."}],"tendencias":[{"sector":"nombre","direccion":"alcista/bajista/lateral","motivo":"1 oración","picks":[{"activo":"...","ticker":"...","tesis":"...","riesgo":"bajo/medio/alto"}]},{"sector":"...","direccion":"...","motivo":"...","picks":[{"activo":"...","ticker":"...","tesis":"...","riesgo":"..."}]},{"sector":"...","direccion":"...","motivo":"...","picks":[{"activo":"...","ticker":"...","tesis":"...","riesgo":"..."}]}],"riesgos":["riesgo 1","riesgo 2","riesgo 3"]}
4 oportunidades, 3 tendencias. Foco argentino. SOLO JSON.`;

// RF AGENT: Renta fija (recibe datos, sin web search)
const RF_PROMPT = `Eres Meridian, analista de renta fija argentino. Hoy ${D}. Con estos datos, analizá renta fija.
Respondé ÚNICAMENTE con JSON:
{"resumen":"1 oración panorama","tasas":{"bcra":"x%","caucion_1d":"x%","caucion_7d":"x%","plazo_fijo":"x%"},"secciones":[{"nombre":"Cauciones","icono":"🔄","items":[{"activo":"...","ticker":"...","tipo":"caución","moneda":"ARS/USD","tir":"x%","duration":"...","riesgo":"bajo","tesis":"1 oración","señal":"compra/acumular/watchlist"},...3]},{"nombre":"Plazo Fijo y FCIs","icono":"🏦","items":[...3]},{"nombre":"Bonos Soberanos","icono":"🏛","items":[...3]}],"movimientos":[{"activo":"...","cambio":"sube/baja","detalle":"1 oración"},...2]}
3 secciones, 3 items cada una. SOLO JSON.`;

// RV AGENT: Renta variable (recibe datos, sin web search)
const RV_PROMPT = `Eres Meridian, analista de renta variable argentino. Hoy ${D}. Con estos datos, analizá renta variable.
Respondé ÚNICAMENTE con JSON:
{"resumen":"1 oración panorama","indices":{"sp500":{"valor":"...","cambio":"x%"},"merval":{"valor":"...","cambio":"x%"},"ccl":{"valor":"...","cambio":"x%"}},"secciones":[{"nombre":"Acciones Argentinas","icono":"🇦🇷","items":[{"activo":"...","ticker":"...","tipo":"acción","mercado":"AR","precio":"...","cambio_dia":"x%","riesgo":"bajo/medio/alto","tesis":"1 oración","señal":"compra/acumular/watchlist","sector":"..."},...3]},{"nombre":"CEDEARs","icono":"🔗","items":[...3]},{"nombre":"ETFs","icono":"📊","items":[...3]}],"movimientos":[{"activo":"...","cambio":"sube/baja","detalle":"1 oración"},...2]}
3 secciones, 3 items cada una. SOLO JSON.`;

// CALENDAR AGENT: Calendario económico (sin web search, usa conocimiento)
const CAL_PROMPT = `Eres Meridian. Hoy ${D}. Listá eventos económicos importantes de los próximos 15 días para inversor argentino.
ÚNICAMENTE JSON:
{"eventos":[{"fecha":"DD/MM","titulo":"...","pais":"AR/US/EU","impacto":"alto/medio/bajo","detalle":"1 oración","tipo":"tasa/dato macro/earnings/vencimiento/licitación"},...12],"fuentes":["investing.com","bcra.gob.ar"]}
12 eventos. SOLO JSON.`;

// PORTFOLIO AGENT: Portafolio personalizado (usa Sonnet + web search)
const PORTFOLIO_PROMPT = `Eres Meridian, analista institucional. Hoy ${D}. Buscá info actualizada.
NO uses etiquetas HTML de citación. Solo markdown.
FORMATO:
## 📊 Estrategia
[1 párrafo]
## 💼 Portafolio
| Activo | Ticker | Clase | Peso | Horizonte | Riesgo |
[tabla]
## 📋 Detalle
### 1. [Nombre] ([TICKER])
**Clase:** ... | **Peso:** ...% | **Riesgo:** ...
**Tesis:** 2-3 puntos
## ⚠️ Riesgos
---
*Análisis informativo, no asesoramiento financiero regulado.*
Foco argentino: cauciones, CEDEARs, acciones arg, plazo fijo, FCIs. Tickers REALES.`;

/* ═══ HELPERS ═══ */

function cleanResponse(text) {
  if (!text) return "";
  let c = text.replace(/<\/?antml:[^>]*>/gi, "").replace(/<\/?cite[^>]*>/gi, "")
    .replace(/<[^>]*index="[^"]*"[^>]*>/gi, "").replace(/```json\s?/g, "").replace(/```/g, "").trim();
  return c;
}

function parseJSON(text) {
  const c = cleanResponse(text);
  const fi = c.indexOf("{");
  const li = c.lastIndexOf("}");
  if (fi !== -1 && li !== -1) return JSON.parse(c.substring(fi, li + 1));
  throw new Error("No JSON found in response");
}

async function callClaude(apiKey, { model = HAIKU, system, userMsg, webSearch = false, maxTokens = 2048 }) {
  const body = {
    model,
    max_tokens: maxTokens,
    system,
    messages: [{ role: "user", content: userMsg }],
  };
  if (webSearch) {
    body.tools = [{ type: "web_search_20250305", name: "web_search" }];
  }

  const r = await fetch(API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify(body),
  });

  const d = await r.json();
  if (d.error) throw new Error(d.error?.message || JSON.stringify(d.error));
  return (d.content || []).filter(b => b.type === "text").map(b => b.text).join("\n");
}

/* ═══ CACHE ═══ */

async function getCache(key) {
  try {
    const store = getStore({ name: "meridian", consistency: "eventual" });
    const raw = await store.get(key);
    if (!raw) return null;
    const cached = JSON.parse(raw);
    const ttl = CACHE_TTL[key] || 30 * 60 * 1000;
    if (Date.now() - cached.ts > ttl) return null; // expired
    return cached.data;
  } catch { return null; }
}

async function setCache(key, data) {
  try {
    const store = getStore({ name: "meridian", consistency: "eventual" });
    await store.set(key, JSON.stringify({ data, ts: Date.now() }));
  } catch (e) { console.error("Cache set error:", e); }
}

/* ═══ AGENTS ═══ */

// Data Agent: DATOS REALES de APIs gratuitas (0 tokens de Claude)
async function dataAgent(apiKey) {
  const cached = await getCache("market_data");
  if (cached) return cached;

  const data = { dolar: {}, indices: {}, tasas: {}, bonos: {}, acciones: {}, noticias: [], fci: {}, _source: "APIs reales", _timestamp: new Date().toISOString() };

  // Fetch all APIs in parallel
  const [dolaresR, riesgoPaisR, plazoFijoR, dep30R, inflacionR, fciMMR, fciRFR, rendR] = await Promise.all([
    fetch("https://dolarapi.com/v1/dolares").then(r=>r.json()).catch(()=>[]),
    fetch("https://api.argentinadatos.com/v1/finanzas/indices/riesgo-pais/ultimo").then(r=>r.json()).catch(()=>null),
    fetch("https://api.argentinadatos.com/v1/finanzas/tasas/plazoFijo").then(r=>r.json()).catch(()=>[]),
    fetch("https://api.argentinadatos.com/v1/finanzas/tasas/depositos30Dias").then(r=>r.json()).catch(()=>[]),
    fetch("https://api.argentinadatos.com/v1/finanzas/indices/inflacion").then(r=>r.json()).catch(()=>[]),
    fetch("https://api.argentinadatos.com/v1/finanzas/fci/mercadoDinero/ultimo").then(r=>r.json()).catch(()=>[]),
    fetch("https://api.argentinadatos.com/v1/finanzas/fci/rentaFija/ultimo").then(r=>r.json()).catch(()=>[]),
    fetch("https://api.argentinadatos.com/v1/finanzas/rendimientos").then(r=>r.json()).catch(()=>[]),
  ]);

  // 1. Dólares
  for (const d of dolaresR) {
    if (d.casa === "oficial") data.dolar.oficial = `$${d.venta}`;
    if (d.casa === "blue") data.dolar.blue = `$${d.venta}`;
    if (d.casa === "bolsa") data.dolar.mep = `$${d.venta}`;
    if (d.casa === "contadoconliqui") data.dolar.ccl = `$${d.venta}`;
    if (d.casa === "mayorista") data.dolar.mayorista = `$${d.venta}`;
  }
  data.indices.ccl = data.dolar.ccl || "N/D";

  // 2. Riesgo país
  if (riesgoPaisR?.valor) {
    data.indices.riesgo_pais = riesgoPaisR.valor;
    data.noticias.push(`Riesgo país: ${riesgoPaisR.valor} puntos`);
  }

  // 3. Tasas
  if (plazoFijoR?.length > 0) {
    const ultima = plazoFijoR[plazoFijoR.length - 1];
    data.tasas.plazo_fijo = `${ultima.tnaClientes || ultima.valor || "N/D"}%`;
  }
  if (dep30R?.length > 0) {
    const ultima = dep30R[dep30R.length - 1];
    data.tasas.depositos_30d = `${ultima.valor || "N/D"}%`;
  }
  data.tasas.bcra = data.tasas.depositos_30d || data.tasas.plazo_fijo || "N/D";

  // 4. Inflación
  if (inflacionR?.length > 0) {
    const ultima = inflacionR[inflacionR.length - 1];
    data.indices.inflacion_mensual = `${ultima.valor}%`;
    data.noticias.push(`Inflación último dato: ${ultima.valor}% (${ultima.fecha})`);
  }

  // 5. FCIs Money Market
  if (fciMMR?.length > 0) {
    data.fci.money_market = fciMMR.slice(0, 5).map(f => ({ fondo: f.fondo, vcp: f.vcp, ccp: f.ccp, patrimonio: f.patrimonio }));
  }

  // 6. FCIs Renta Fija
  if (fciRFR?.length > 0) {
    data.fci.renta_fija = fciRFR.slice(0, 5).map(f => ({ fondo: f.fondo, vcp: f.vcp, ccp: f.ccp, patrimonio: f.patrimonio }));
  }

  // 7. Rendimientos de entidades
  if (rendR?.length > 0) {
    data.tasas.rendimientos = rendR.slice(0, 5).map(r => ({ entidad: r.entidad, tnaClientes: r.tnaClientes, tnaNoClientes: r.tnaNoClientes }));
    data.noticias.push(`Mejores tasas plazo fijo: ${rendR[0]?.entidad} ${rendR[0]?.tnaClientes}%`);
  }

  // 8. Cauciones (no hay API gratuita - se indica)
  data.tasas.caucion_1d = "Consultar broker";
  data.tasas.caucion_7d = "Consultar broker";

  // 9. Brecha
  const blueVal = parseFloat((data.dolar.blue || "0").replace("$", ""));
  const oficialVal = parseFloat((data.dolar.oficial || "0").replace("$", ""));
  if (blueVal && oficialVal) {
    const brecha = (((blueVal / oficialVal) - 1) * 100).toFixed(1);
    data.indices.brecha = `${brecha}%`;
    data.noticias.push(`Brecha cambiaria: ${brecha}%`);
  }

  // 10. Resumen dólar
  data.noticias.push(`Dólar: Oficial ${data.dolar.oficial || "N/D"} | Blue ${data.dolar.blue || "N/D"} | MEP ${data.dolar.mep || "N/D"} | CCL ${data.dolar.ccl || "N/D"}`);

  // Datos que no tenemos de APIs gratuitas
  data.indices.sp500 = "N/D (sin API)";
  data.indices.merval = "N/D (sin API)";
  data.bonos = { al30: "N/D (sin API)", gd35: "N/D (sin API)" };
  data.acciones = { ggal: "N/D", ypf: "N/D", vist: "N/D", pamp: "N/D" };

  await setCache("market_data", data);
  return data;
}

// Daily Agent: resumen del día
async function dailyAgent(apiKey, marketData) {
  const raw = await callClaude(apiKey, {
    system: DAILY_PROMPT,
    userMsg: `Datos de mercado hoy:\n${JSON.stringify(marketData)}\n\nHacé el resumen. SOLO JSON.`,
    webSearch: false,
  });
  return parseJSON(raw);
}

// Macro Agent: análisis macro + oportunidades + tendencias
async function macroAgent(apiKey, marketData) {
  const raw = await callClaude(apiKey, {
    system: MACRO_PROMPT,
    userMsg: `Datos de mercado:\n${JSON.stringify(marketData)}\n\nAnalizá. SOLO JSON.`,
    webSearch: false,
  });
  return parseJSON(raw);
}

// RF Agent: renta fija
async function rfAgent(apiKey, marketData) {
  const raw = await callClaude(apiKey, {
    system: RF_PROMPT,
    userMsg: `Datos de mercado:\n${JSON.stringify(marketData)}\n\nAnalizá renta fija. SOLO JSON.`,
    webSearch: false,
    maxTokens: 3500,
  });
  return parseJSON(raw);
}

// RV Agent: renta variable
async function rvAgent(apiKey, marketData) {
  const raw = await callClaude(apiKey, {
    system: RV_PROMPT,
    userMsg: `Datos de mercado:\n${JSON.stringify(marketData)}\n\nAnalizá renta variable. SOLO JSON.`,
    webSearch: false,
    maxTokens: 3500,
  });
  return parseJSON(raw);
}

// Calendar Agent: no necesita datos de mercado
async function calAgent(apiKey) {
  const raw = await callClaude(apiKey, {
    system: CAL_PROMPT,
    userMsg: `Listá los próximos eventos económicos. SOLO JSON.`,
    webSearch: false,
  });
  return parseJSON(raw);
}

// Portfolio Agent: usa Sonnet (solo cuando el usuario lo pide)
async function portfolioAgent(apiKey, profile) {
  const raw = await callClaude(apiKey, {
    model: SONNET,
    system: PORTFOLIO_PROMPT,
    userMsg: profile,
    webSearch: false,
    maxTokens: 2048,
  });
  return cleanResponse(raw);
}

/* ═══ ORCHESTRATOR ═══ */

export const handler = async (event) => {
  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 200, headers: CORS, body: "" };
  }
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, headers: CORS, body: JSON.stringify({ error: "Method not allowed" }) };
  }

  try {
    const body = JSON.parse(event.body);
    const { action, profile } = body;

    const apiKey = process.env.ANTHROPIC_API_KEY || body.apiKey;
    if (!apiKey) {
      return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: "No API key" }) };
    }

    let result;

    // ── DAILY: resumen del día ──
    if (action === "daily") {
      const cached = await getCache("daily");
      if (cached) return { statusCode: 200, headers: CORS, body: JSON.stringify({ data: cached, cached: true }) };

      const marketData = await dataAgent(apiKey);
      result = await dailyAgent(apiKey, marketData);
      await setCache("daily", result);
    }

    // ── HOME: macro + oportunidades + tendencias ──
    else if (action === "home") {
      const cached = await getCache("home");
      if (cached) return { statusCode: 200, headers: CORS, body: JSON.stringify({ data: cached, cached: true }) };

      const marketData = await dataAgent(apiKey);
      result = await macroAgent(apiKey, marketData);
      await setCache("home", result);
    }

    // ── RENTA FIJA ──
    else if (action === "rf") {
      const cached = await getCache("rf");
      if (cached) return { statusCode: 200, headers: CORS, body: JSON.stringify({ data: cached, cached: true }) };

      const marketData = await dataAgent(apiKey);
      result = await rfAgent(apiKey, marketData);
      await setCache("rf", result);
    }

    // ── RENTA VARIABLE ──
    else if (action === "rv") {
      const cached = await getCache("rv");
      if (cached) return { statusCode: 200, headers: CORS, body: JSON.stringify({ data: cached, cached: true }) };

      const marketData = await dataAgent(apiKey);
      result = await rvAgent(apiKey, marketData);
      await setCache("rv", result);
    }

    // ── CALENDARIO ──
    else if (action === "cal") {
      const cached = await getCache("cal");
      if (cached) return { statusCode: 200, headers: CORS, body: JSON.stringify({ data: cached, cached: true }) };

      result = await calAgent(apiKey);
      await setCache("cal", result);
    }

    // ── PORTFOLIO (sin cache, siempre personalizado) ──
    else if (action === "portfolio") {
      result = await portfolioAgent(apiKey, profile);
      return { statusCode: 200, headers: CORS, body: JSON.stringify({ data: result, type: "markdown" }) };
    }

    else {
      return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: "Unknown action" }) };
    }

    return { statusCode: 200, headers: CORS, body: JSON.stringify({ data: result, cached: false }) };

  } catch (err) {
    console.error("Orchestrator error:", err);
    return { statusCode: 500, headers: CORS, body: JSON.stringify({ error: err.message }) };
  }
};

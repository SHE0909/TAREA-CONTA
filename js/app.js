(function () {
  "use strict";

  const fmt = (n, decimals = 2) => {
    if (!isFinite(n)) return "—";
    const sign = n < 0 ? "-" : "";
    return sign + "$ " + Math.abs(n).toLocaleString("en-US", {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    });
  };
  const pct = (n, decimals = 4) => (isFinite(n) ? n.toLocaleString("en-US", { maximumFractionDigits: decimals }) + "%" : "—");
  const el = (tag, cls, html) => {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (html !== undefined) e.innerHTML = html;
    return e;
  };
  const qs = (sel, root = document) => root.querySelector(sel);
  const qsa = (sel, root = document) => Array.from(root.querySelectorAll(sel));

  const TIPO_LUMPSUM = {
    id: "tipo", label: "Tipo de operación", type: "select",
    options: [
      { value: "inversion", label: "Inversión / depósito (usted entrega P hoy y recibe F después)" },
      { value: "prestamo", label: "Préstamo recibido (usted recibe P hoy y paga F después)" },
    ],
  };
  const TIPO_SERIE = {
    id: "tipo", label: "Tipo de serie", type: "select",
    options: [
      { value: "ingreso", label: "Serie de ingresos (usted recibe los pagos)" },
      { value: "egreso", label: "Serie de egresos (usted realiza los pagos)" },
    ],
  };

  function readNumber(raw) {
    if (raw === null || raw === undefined || String(raw).trim() === "") return null;
    const v = Number(String(raw).replace(",", "."));
    return isFinite(v) ? v : NaN;
  }

  function validate(values, rules) {
    const errors = [];
    const parsed = {};
    for (const rule of rules) {
      const raw = values[rule.id];
      if (rule.type === "select") { parsed[rule.id] = raw; continue; }
      const v = readNumber(raw);
      if (v === null) { errors.push(`"${rule.label}" es obligatorio.`); continue; }
      if (Number.isNaN(v)) { errors.push(`"${rule.label}" debe ser un número válido.`); continue; }
      if (rule.integer && !Number.isInteger(v)) { errors.push(`"${rule.label}" debe ser un número entero.`); continue; }
      if (rule.min !== undefined && v < rule.min) { errors.push(`"${rule.label}" debe ser mayor o igual a ${rule.min}.`); continue; }
      if (rule.max !== undefined && v > rule.max) { errors.push(`"${rule.label}" debe ser menor o igual a ${rule.max}.`); continue; }
      if (rule.notEq !== undefined && v === rule.notEq) { errors.push(`"${rule.label}" no puede ser ${rule.notEq}.`); continue; }
      parsed[rule.id] = v;
    }
    return { errors, parsed };
  }

  function engineSimple(p) {
    const { P, iPct, n, tipo } = p;
    const i = iPct / 100;
    const I = P * i * n;
    const F = P + I;
    const pIsOut = tipo === "inversion";
    const flows = [
      { t: 0, amount: P, kind: pIsOut ? "out" : "in", tag: "P" },
      { t: n, amount: F, kind: pIsOut ? "in" : "out", tag: "F" },
    ];
    const rows = [];
    for (let t = 0; t <= n; t++) {
      const interesAcum = P * i * t;
      rows.push([t, fmt(interesAcum), fmt(P + interesAcum)]);
    }
    return {
      flows,
      table: { cols: ["Periodo", "Interés acumulado", "Saldo"], rows },
      summary: [
        { label: "Capital inicial (P)", value: fmt(P) },
        { label: "Interés total (I = P·i·n)", value: fmt(I) },
        { label: "Valor futuro (F = P + I)", value: fmt(F), tone: pIsOut ? "in" : "out" },
      ],
      warnings: [],
    };
  }

  function engineCompuesto(p) {
    const { P, iPct, n, tipo } = p;
    const i = iPct / 100;
    const F = P * Math.pow(1 + i, n);
    const pIsOut = tipo === "inversion";
    const flows = [
      { t: 0, amount: P, kind: pIsOut ? "out" : "in", tag: "P" },
      { t: n, amount: F, kind: pIsOut ? "in" : "out", tag: "F" },
    ];
    const rows = [];
    let prevBal = P;
    rows.push([0, "—", fmt(P)]);
    for (let t = 1; t <= n; t++) {
      const bal = P * Math.pow(1 + i, t);
      rows.push([t, fmt(bal - prevBal), fmt(bal)]);
      prevBal = bal;
    }
    return {
      flows,
      table: { cols: ["Periodo", "Interés del periodo", "Saldo"], rows },
      summary: [
        { label: "Capital inicial (P)", value: fmt(P) },
        { label: "Interés total ganado", value: fmt(F - P) },
        { label: "Valor futuro (F = P·(1+i)ⁿ)", value: fmt(F), tone: pIsOut ? "in" : "out" },
      ],
      warnings: [],
    };
  }

  function engineAritmetico(p) {
    const { A1, G, iPct, n, tipo } = p;
    const i = iPct / 100;
    const kind = tipo === "ingreso" ? "in" : "out";
    const dashedKind = kind === "in" ? "out" : "in";
    const flows = [];
    const rows = [];
    let P = 0;
    const warnings = [];
    for (let t = 1; t <= n; t++) {
      const amount = A1 + (t - 1) * G;
      if (amount < 0) warnings.push(`El pago calculado en el periodo ${t} es negativo (${fmt(amount)}). Revise A1 y G.`);
      const factor = Math.pow(1 + i, -t);
      const vp = amount * factor;
      P += vp;
      flows.push({ t, amount, kind, tag: `A${t}` });
      rows.push([t, fmt(amount), factor.toFixed(6), fmt(vp)]);
    }
    const F = P * Math.pow(1 + i, n);
    flows.push({ t: 0, amount: P, kind: dashedKind, dashed: true, tag: "P" });
    return {
      flows,
      table: { cols: ["Periodo", "Pago (A1 + (t-1)·G)", "Factor (1+i)⁻ᵗ", "Valor presente"], rows },
      summary: [
        { label: "Primer pago (A1)", value: fmt(A1) },
        { label: "Gradiente (G) por periodo", value: fmt(G) },
        { label: "Valor presente (P)", value: fmt(P), tone: dashedKind === "in" ? "in" : "out" },
        { label: "Valor futuro (F = P·(1+i)ⁿ)", value: fmt(F) },
      ],
      warnings,
    };
  }

  function engineGeometrico(p) {
    const { A1, gPct, iPct, n, tipo } = p;
    const i = iPct / 100;
    const g = gPct / 100;
    const kind = tipo === "ingreso" ? "in" : "out";
    const dashedKind = kind === "in" ? "out" : "in";
    const flows = [];
    const rows = [];
    let P = 0;
    for (let t = 1; t <= n; t++) {
      const amount = A1 * Math.pow(1 + g, t - 1);
      const factor = Math.pow(1 + i, -t);
      const vp = amount * factor;
      P += vp;
      flows.push({ t, amount, kind, tag: `A${t}` });
      rows.push([t, fmt(amount), factor.toFixed(6), fmt(vp)]);
    }
    const F = P * Math.pow(1 + i, n);
    flows.push({ t: 0, amount: P, kind: dashedKind, dashed: true, tag: "P" });
    return {
      flows,
      table: { cols: ["Periodo", "Pago A1·(1+g)ᵗ⁻¹", "Factor (1+i)⁻ᵗ", "Valor presente"], rows },
      summary: [
        { label: "Primer pago (A1)", value: fmt(A1) },
        { label: "Tasa de crecimiento (g)", value: pct(gPct) },
        { label: "Valor presente (P)", value: fmt(P), tone: dashedKind === "in" ? "in" : "out" },
        { label: "Valor futuro (F = P·(1+i)ⁿ)", value: fmt(F) },
      ],
      warnings: [],
    };
  }

  const ACTIVITIES = {
    simple: {
      title: "Interés simple",
      kicker: "Actividad 01",
      formula: "I = P · i · n        F = P + I",
      hint: "El interés se calcula siempre sobre el capital inicial P, sin importar cuántos periodos transcurran.",
      fields: [
        { id: "P", label: "Capital inicial (P)", unit: "$", type: "number", step: "0.01", placeholder: "1000000", min: 0.01 },
        { id: "iPct", label: "Tasa de interés (i)", unit: "% por periodo", type: "number", step: "0.0001", placeholder: "2.5", min: -99.9999, max: 1000 },
        { id: "n", label: "Número de periodos (n)", unit: "", type: "number", step: "1", placeholder: "12", min: 1, max: 200, integer: true },
        TIPO_LUMPSUM,
      ],
      engine: engineSimple,
    },
    compuesto: {
      title: "Interés compuesto",
      kicker: "Actividad 02",
      formula: "F = P · (1 + i)ⁿ",
      hint: "El interés se calcula sobre el saldo acumulado de cada periodo, por lo que el capital crece de forma exponencial.",
      fields: [
        { id: "P", label: "Capital inicial (P)", unit: "$", type: "number", step: "0.01", placeholder: "1000000", min: 0.01 },
        { id: "iPct", label: "Tasa de interés (i)", unit: "% por periodo", type: "number", step: "0.0001", placeholder: "1.8", min: -99.9999, max: 1000 },
        { id: "n", label: "Número de periodos (n)", unit: "", type: "number", step: "1", placeholder: "12", min: 1, max: 200, integer: true },
        TIPO_LUMPSUM,
      ],
      engine: engineCompuesto,
    },
    aritmetico: {
      title: "Anualidad con gradiente aritmético",
      kicker: "Actividad 03",
      formula: "At = A1 + (t − 1) · G\nP = Σ At · (1+i)⁻ᵗ\nF = P · (1+i)ⁿ",
      hint: "G puede ser positivo (pagos crecientes) o negativo (pagos decrecientes). Un G muy negativo puede generar pagos por debajo de cero.",
      fields: [
        { id: "A1", label: "Primer pago (A1)", unit: "$", type: "number", step: "0.01", placeholder: "500000", min: 0 },
        { id: "G", label: "Gradiente (G)", unit: "$ por periodo, puede ser negativo", type: "number", step: "0.01", placeholder: "25000" },
        { id: "iPct", label: "Tasa de interés (i)", unit: "% por periodo", type: "number", step: "0.0001", placeholder: "2", min: -99.9999, max: 1000 },
        { id: "n", label: "Número de pagos (n)", unit: "", type: "number", step: "1", placeholder: "8", min: 1, max: 200, integer: true },
        TIPO_SERIE,
      ],
      engine: engineAritmetico,
    },
    geometrico: {
      title: "Anualidad con gradiente geométrico",
      kicker: "Actividad 04",
      formula: "At = A1 · (1+g)ᵗ⁻¹\nP = Σ At · (1+i)⁻ᵗ\nF = P · (1+i)ⁿ",
      hint: "g es una tasa de crecimiento porcentual constante entre pagos; puede ser negativa para representar una serie decreciente.",
      fields: [
        { id: "A1", label: "Primer pago (A1)", unit: "$", type: "number", step: "0.01", placeholder: "500000", min: 0.01 },
        { id: "gPct", label: "Tasa de crecimiento (g)", unit: "% por periodo, puede ser negativa", type: "number", step: "0.0001", placeholder: "3", min: -99.9999, max: 1000 },
        { id: "iPct", label: "Tasa de interés (i)", unit: "% por periodo", type: "number", step: "0.0001", placeholder: "2", min: -99.9999, max: 1000 },
        { id: "n", label: "Número de pagos (n)", unit: "", type: "number", step: "1", placeholder: "8", min: 1, max: 200, integer: true },
        TIPO_SERIE,
      ],
      engine: engineGeometrico,
    },
  };

  function renderFields(activity) {
    const container = qs("#calc-fields");
    container.innerHTML = "";
    activity.fields.forEach((f) => {
      const wrap = el("div", "field");
      const label = el("label", null, `${f.label}${f.unit ? ` <span class="unit">(${f.unit})</span>` : ""}`);
      label.setAttribute("for", "f-" + f.id);
      wrap.appendChild(label);

      if (f.type === "select") {
        const select = el("select");
        select.id = "f-" + f.id;
        select.name = f.id;
        f.options.forEach((o) => {
          const opt = el("option", null, o.label);
          opt.value = o.value;
          select.appendChild(opt);
        });
        wrap.appendChild(select);
      } else {
        const input = el("input");
        input.type = "number";
        input.step = f.step || "any";
        input.id = "f-" + f.id;
        input.name = f.id;
        if (f.placeholder) input.placeholder = f.placeholder;
        wrap.appendChild(input);
      }
      container.appendChild(wrap);
    });
  }

  function renderResults(summary, warnings) {
    const box = qs("#results");
    box.innerHTML = "";
    summary.forEach((s) => {
      const card = el("div", "result-card");
      card.appendChild(el("div", "result-card__label", s.label));
      card.appendChild(el("div", "result-card__value" + (s.tone ? ` is-${s.tone}` : ""), s.value));
      box.appendChild(card);
    });

    const warn = qs("#warning-note");
    if (warnings && warnings.length) {
      warn.innerHTML = warnings.map((w) => "⚠ " + w).join("<br>");
      warn.classList.remove("is-hidden");
    } else {
      warn.classList.add("is-hidden");
      warn.innerHTML = "";
    }
  }

  let lastTable = null;

  function renderTable(table) {
    lastTable = table;
    const t = qs("#flow-table");
    t.innerHTML = "";
    const thead = el("thead");
    const trh = el("tr");
    table.cols.forEach((c) => trh.appendChild(el("th", null, c)));
    thead.appendChild(trh);
    t.appendChild(thead);

    const tbody = el("tbody");
    table.rows.forEach((row) => {
      const tr = el("tr");
      row.forEach((cell) => tr.appendChild(el("td", null, String(cell))));
      tbody.appendChild(tr);
    });
    t.appendChild(tbody);
  }

  function downloadCSV() {
    if (!lastTable) return;
    const lines = [lastTable.cols.join(",")];
    lastTable.rows.forEach((row) => {
      lines.push(row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(","));
    });
    const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = el("a");
    a.href = url;
    a.download = `tabla-${currentActivity || "flujos"}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  function drawTimeline(flows, n) {
    const svg = qs("#timeline");
    const MARGIN_X = 60;
    const STEP = 80;
    const WIDTH = MARGIN_X * 2 + n * STEP;
    const HEIGHT = 300;
    const BASE_Y = 160;
    const MAX_ARROW = 96;
    const MIN_ARROW = 22;

    const maxAmount = Math.max(1e-9, ...flows.map((f) => Math.abs(f.amount)));
    const scale = (amt) => {
      const ratio = Math.abs(amt) / maxAmount;
      return MIN_ARROW + ratio * (MAX_ARROW - MIN_ARROW);
    };
    const xOf = (t) => MARGIN_X + t * STEP;

    let defs = `
      <defs>
        <marker id="arrow-in" markerWidth="8" markerHeight="8" refX="4" refY="4" orient="auto">
          <path d="M0,0 L8,4 L0,8 Z" fill="var(--accent)"></path>
        </marker>
        <marker id="arrow-out" markerWidth="8" markerHeight="8" refX="4" refY="4" orient="auto">
          <path d="M0,0 L8,4 L0,8 Z" fill="var(--warm)"></path>
        </marker>
      </defs>`;

    let axis = `<line x1="${MARGIN_X - 12}" y1="${BASE_Y}" x2="${WIDTH - MARGIN_X + 12}" y2="${BASE_Y}" stroke="var(--ink-dim)" stroke-width="1.5"></line>`;
    let ticks = "";
    for (let t = 0; t <= n; t++) {
      const x = xOf(t);
      ticks += `<line x1="${x}" y1="${BASE_Y - 5}" x2="${x}" y2="${BASE_Y + 5}" stroke="var(--ink-dim)" stroke-width="1"></line>`;
      ticks += `<text x="${x}" y="${BASE_Y + 22}" text-anchor="middle" font-family="var(--mono)" font-size="12" fill="var(--ink-dim)">${t}</text>`;
    }

    let arrows = "";
    flows.forEach((f) => {
      const x = xOf(f.t);
      const len = scale(f.amount);
      const isIn = f.kind === "in";
      const color = isIn ? "var(--accent)" : "var(--warm)";
      const marker = isIn ? "url(#arrow-in)" : "url(#arrow-out)";
      const dash = f.dashed ? ' stroke-dasharray="5,4"' : "";
      const y1 = BASE_Y;
      const y2 = isIn ? BASE_Y - len : BASE_Y + len;
      const labelY = isIn ? y2 - 10 : y2 + 18;
      arrows += `<line x1="${x}" y1="${y1}" x2="${x}" y2="${y2}" stroke="${color}" stroke-width="2"${dash} marker-end="${marker}"></line>`;
      const shortAmt = Math.abs(f.amount) >= 1000
        ? (f.amount / 1000).toLocaleString("en-US", { maximumFractionDigits: 1 }) + "k"
        : f.amount.toLocaleString("en-US", { maximumFractionDigits: 0 });
      arrows += `<text x="${x}" y="${labelY}" text-anchor="middle" font-family="var(--mono)" font-size="11.5" fill="${color}">${f.tag ? f.tag + " · " : ""}${shortAmt}</text>`;
    });

    svg.setAttribute("viewBox", `0 0 ${WIDTH} ${HEIGHT}`);
    svg.setAttribute("width", WIDTH);
    svg.setAttribute("height", HEIGHT);
    svg.innerHTML = defs + axis + ticks + arrows;
  }

  function renderLegend() {
    qs("#timeline-legend").innerHTML =
      `<span><span class="legend-swatch" style="background:var(--accent)"></span>Entrada de efectivo</span>` +
      `<span><span class="legend-swatch" style="background:var(--warm)"></span>Salida de efectivo</span>` +
      `<span><span class="legend-swatch" style="background:var(--violet); opacity:.7"></span>Línea punteada = valor equivalente (P) traído a hoy</span>`;
  }

  let currentActivity = null;

  function selectActivity(key) {
    currentActivity = key;
    const activity = ACTIVITIES[key];

    qsa(".tab").forEach((btn) => btn.classList.toggle("is-active", btn.dataset.activity === key));
    qs("#intro").classList.add("is-hidden");
    qs("#workspace").classList.remove("is-hidden");
    qs("#results-wrap").classList.add("is-hidden");
    qs("#error-box").classList.add("is-hidden");

    qs("#activity-kicker").textContent = activity.kicker;
    qs("#activity-title").textContent = activity.title;
    qs("#activity-formula").textContent = activity.formula;
    qs("#activity-hint").textContent = activity.hint;

    renderFields(activity);
    qs("#calc-form").reset();
  }

  function handleSubmit(evt) {
    evt.preventDefault();
    const activity = ACTIVITIES[currentActivity];
    const formData = new FormData(qs("#calc-form"));
    const values = Object.fromEntries(formData.entries());

    const { errors, parsed } = validate(values, activity.fields);
    const errorBox = qs("#error-box");

    if (errors.length) {
      errorBox.innerHTML = "<strong>Revise los siguientes datos:</strong><ul>" + errors.map((e) => `<li>${e}</li>`).join("") + "</ul>";
      errorBox.classList.remove("is-hidden");
      qs("#results-wrap").classList.add("is-hidden");
      return;
    }
    errorBox.classList.add("is-hidden");

    let out;
    try {
      out = activity.engine(parsed);
    } catch (err) {
      errorBox.innerHTML = `<strong>No se pudo calcular:</strong> ${err.message}`;
      errorBox.classList.remove("is-hidden");
      return;
    }

    renderResults(out.summary, out.warnings);
    renderTable(out.table);
    drawTimeline(out.flows, parsed.n);
    renderLegend();
    qs("#results-wrap").classList.remove("is-hidden");
    qs("#results-wrap").scrollIntoView({ behavior: "smooth", block: "nearest" });
  }

  document.addEventListener("DOMContentLoaded", () => {
    qsa(".tab").forEach((btn) => {
      btn.addEventListener("click", () => selectActivity(btn.dataset.activity));
    });
    qs("#calc-form").addEventListener("submit", handleSubmit);
    qs("#btn-reset").addEventListener("click", () => {
      qs("#results-wrap").classList.add("is-hidden");
      qs("#error-box").classList.add("is-hidden");
    });
    qs("#btn-csv").addEventListener("click", downloadCSV);
  });
})();

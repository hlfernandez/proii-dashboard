(function () {
  const D = window.PROII_DATA;
  const NS = "http://www.w3.org/2000/svg";
  const pct = (a, b) => (b ? (100 * a) / b : 0);
  const f1 = (x) => x.toFixed(1);

  // ---------- Global ----------
  const FIELDS = [
    { id: "matriculados", label: "Matriculados", row: (c) => [100, `${c.matriculados}`] },
    { id: "presentados", label: "Presentados", row: (c) => [pct(c.presentados, c.matriculados), `${f1(pct(c.presentados, c.matriculados))}% (${c.presentados}/${c.matriculados})`] },
    { id: "aprobados1", label: "Aprobados 1ª", row: (c) => [pct(c.aprobados1, c.presentados), `${f1(pct(c.aprobados1, c.presentados))}% (${c.aprobados1}/${c.presentados})`] },
    { id: "aprobadosCurso", label: "Aprobados tot.", row: (c) => [pct(c.aprobadosCurso, c.presentados), `${f1(pct(c.aprobadosCurso, c.presentados))}% (${c.aprobadosCurso}/${c.presentados})`] },
  ];
  const active = new Set(FIELDS.map((f) => f.id));
  const gc = document.getElementById("global-charts");
  const filters = document.getElementById("filters");
  const fieldsArg = document.getElementById("fields-arg");

  function renderGlobal() {
    gc.replaceChildren();
    const sel = FIELDS.filter((f) => active.has(f.id));
    fieldsArg.textContent = sel.length === FIELDS.length ? "" : ` --fields ${sel.map((f) => f.id).join(",") || '""'}`;
    if (!sel.length) {
      const p = document.createElement("p");
      p.className = "dim";
      p.textContent = "# ningún campo seleccionado";
      gc.appendChild(p);
      return;
    }
    D.global.forEach((c) => {
      const h = document.createElement("h3");
      h.textContent = "> " + c.curso;
      gc.appendChild(h);
      sel.forEach((f) => {
        const [p, v] = f.row(c);
        const r = document.createElement("div");
        r.className = "row";
        r.innerHTML = `<span>${f.label}</span><div class="bar"><i style="width:${p}%"></i></div><span class="val">${v}</span>`;
        gc.appendChild(r);
      });
    });
    const note = document.createElement("p");
    note.className = "dim";
    note.textContent = "# presentados sobre matriculados; aprobados sobre presentados";
    gc.appendChild(note);
  }

  FIELDS.forEach((f) => {
    const l = document.createElement("label");
    l.innerHTML = `<input type="checkbox" checked><span>${f.label}</span>`;
    l.firstChild.onchange = (e) => {
      e.target.checked ? active.add(f.id) : active.delete(f.id);
      renderGlobal();
    };
    filters.appendChild(l);
  });
  renderGlobal();

  // ---------- Violin ----------
  const el = (n, a, t) => {
    const e = document.createElementNS(NS, n);
    for (const k in a) e.setAttribute(k, a[k]);
    if (t != null) e.textContent = t;
    return e;
  };
  const quant = (s, q) => {
    const p = (s.length - 1) * q, i = Math.floor(p);
    return s[i] + (s[Math.min(i + 1, s.length - 1)] - s[i]) * (p - i);
  };
  function kde(data, bw) {
    const pts = [];
    const lo = Math.min(...data), hi = Math.max(...data);
    for (let y = lo; y <= hi + 1e-9; y += (hi - lo) / 80 || 1) {
      let d = 0;
      for (const x of data) d += Math.exp(-0.5 * ((y - x) / bw) ** 2);
      pts.push([y, d / (data.length * bw * Math.sqrt(2 * Math.PI))]);
    }
    return pts;
  }

  // ---------- Boxplot comparativa ----------
  const MODES = {
    "1": { label: "1ª conv.", arg: "1", note: "notas da 1ª convocatoria", get: (g) => g.conv1 },
    "2": { label: "2ª conv.", arg: "2", note: "notas da 2ª convocatoria", get: (g) => g.conv2 },
    "1,2": { label: "1ª + 2ª", arg: "1,2", note: "notas de ambas convocatorias (un alumno pode contar dúas veces)", get: (g) => [...g.conv1, ...g.conv2] },
  };
  function drawBox(mode) {
    const m = MODES[mode];
    document.getElementById("box-arg").textContent = m.arg;
    document.getElementById("box-note").textContent = `# ${m.note} · + media · puntos: valores atípicos`;
    const years = Object.keys(D.grades).sort().filter((y) => m.get(D.grades[y]).length);
    const W = 800, H = 380, top = 20, bot = 40, left = 40;
    const Y = (v) => top + (H - top - bot) * (1 - v / 10);
    const svg = el("svg", { viewBox: `0 0 ${W} ${H}` });
    for (let v = 0; v <= 10; v++) {
      svg.appendChild(el("line", { x1: left, x2: W - 10, y1: Y(v), y2: Y(v), stroke: v === 5 ? "#ffb000" : "#2a1d00", "stroke-dasharray": v === 5 ? "4 4" : "" }));
      svg.appendChild(el("text", { x: left - 8, y: Y(v) + 4, "text-anchor": "end", class: "dimt" }, v));
    }
    const slot = (W - left - 10) / years.length;
    const bw = Math.min(44, slot * 0.4);
    years.forEach((y, i) => {
      const data = m.get(D.grades[y]);
      const cx = left + slot * (i + 0.5);
      const s = [...data].sort((a, b) => a - b);
      const q1 = quant(s, 0.25), med = quant(s, 0.5), q3 = quant(s, 0.75);
      const iqr = q3 - q1;
      const inside = s.filter((v) => v >= q1 - 1.5 * iqr && v <= q3 + 1.5 * iqr);
      const lo = inside[0], hi = inside[inside.length - 1];
      const mean = data.reduce((a, b) => a + b, 0) / data.length;
      const st = { stroke: "#ffb000", fill: "none" };
      svg.appendChild(el("line", { x1: cx, x2: cx, y1: Y(hi), y2: Y(q3), ...st }));
      svg.appendChild(el("line", { x1: cx, x2: cx, y1: Y(lo), y2: Y(q1), ...st }));
      svg.appendChild(el("line", { x1: cx - bw / 4, x2: cx + bw / 4, y1: Y(hi), y2: Y(hi), ...st }));
      svg.appendChild(el("line", { x1: cx - bw / 4, x2: cx + bw / 4, y1: Y(lo), y2: Y(lo), ...st }));
      svg.appendChild(el("rect", { x: cx - bw / 2, y: Y(q3), width: bw, height: Y(q1) - Y(q3), fill: "rgba(255,176,0,.25)", stroke: "#ffb000" }));
      svg.appendChild(el("line", { x1: cx - bw / 2, x2: cx + bw / 2, y1: Y(med), y2: Y(med), stroke: "#ffd060", "stroke-width": 2 }));
      s.filter((v) => v < lo || v > hi).forEach((v) => svg.appendChild(el("circle", { cx, cy: Y(v), r: 3, fill: "#ffb000" })));
      svg.appendChild(el("text", { x: cx, y: Y(mean) + 4, "text-anchor": "middle", style: "fill:#ffd060;font-weight:bold" }, "+"));
      svg.appendChild(el("text", { x: cx, y: H - 20, "text-anchor": "middle" }, y));
      svg.appendChild(el("text", { x: cx, y: H - 6, "text-anchor": "middle", class: "dimt" }, `n=${data.length} med=${f1(med)}`));
    });
    document.getElementById("boxplot").replaceChildren(svg);
  }
  const boxSel = document.getElementById("box-conv");
  boxSel.onchange = () => drawBox(boxSel.value);
  drawBox(boxSel.value);

  function draw(year) {
    const g = D.grades[year];
    const W = 800, H = 380, top = 20, bot = 40, left = 40;
    const ph = H - top - bot;
    const Y = (v) => top + ph * (1 - v / 10);
    const svg = el("svg", { viewBox: `0 0 ${W} ${H}` });

    for (let v = 0; v <= 10; v++) {
      svg.appendChild(el("line", { x1: left, x2: W - 10, y1: Y(v), y2: Y(v), stroke: v === 5 ? "#ffb000" : "#2a1d00", "stroke-dasharray": v === 5 ? "4 4" : "" }));
      svg.appendChild(el("text", { x: left - 8, y: Y(v) + 4, "text-anchor": "end", class: "dimt" }, v));
    }

    const series = [["1ª conv. (xuño)", g.conv1], ["2ª conv. (xullo)", g.conv2]];
    const dens = series.map(([, d]) => (d.length ? kde(d, 0.5) : []));
    const maxD = Math.max(...dens.flat().map((p) => p[1]));
    const slot = (W - left - 10) / 2;
    const half = slot * 0.35;

    series.forEach(([label, data], i) => {
      const cx = left + slot * (i + 0.5);
      if (!data.length) return;
      const s = [...data].sort((a, b) => a - b);
      const pts = dens[i];
      const right = pts.map(([y, d]) => `${cx + (d / maxD) * half},${Y(y)}`);
      const lft = pts.map(([y, d]) => `${cx - (d / maxD) * half},${Y(y)}`).reverse();
      svg.appendChild(el("polygon", { points: [...right, ...lft].join(" "), fill: "rgba(255,176,0,.25)", stroke: "#ffb000" }));
      const q1 = quant(s, 0.25), med = quant(s, 0.5), q3 = quant(s, 0.75);
      svg.appendChild(el("line", { x1: cx, x2: cx, y1: Y(s[0]), y2: Y(s[s.length - 1]), stroke: "#ffd060" }));
      svg.appendChild(el("rect", { x: cx - 5, y: Y(q3), width: 10, height: Y(q1) - Y(q3), fill: "#ffb000" }));
      svg.appendChild(el("line", { x1: cx - 12, x2: cx + 12, y1: Y(med), y2: Y(med), stroke: "#000", "stroke-width": 2 }));
      svg.appendChild(el("line", { x1: cx - 12, x2: cx + 12, y1: Y(med), y2: Y(med), stroke: "#ffd060", "stroke-dasharray": "3 2" }));
      svg.appendChild(el("text", { x: cx, y: H - 20, "text-anchor": "middle" }, label));
      svg.appendChild(el("text", { x: cx, y: H - 6, "text-anchor": "middle", class: "dimt" },
        `n=${data.length} med=${f1(med)} media=${f1(data.reduce((a, b) => a + b, 0) / data.length)}`));
    });
    return svg;
  }

  const box = document.getElementById("violin");
  const sel = document.getElementById("years");
  const arg = document.getElementById("year-arg");
  function show(year) {
    arg.textContent = `"${year}"`;
    box.replaceChildren(draw(year));
    sel.querySelectorAll("button").forEach((b) => b.setAttribute("aria-pressed", b.textContent === year));
  }
  Object.keys(D.grades).sort().reverse().forEach((y) => {
    const b = document.createElement("button");
    b.textContent = y;
    b.onclick = () => show(y);
    sel.appendChild(b);
  });
  show(Object.keys(D.grades).sort().reverse()[0]);
})();

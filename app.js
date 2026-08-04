/* ══ PULI LIFE — app ══ */
'use strict';

const CFG = window.PULI_CONFIG || {};
const keyFromConfig = CFG.key && !CFG.key.startsWith('DOPLN');
const SB_KEY = keyFromConfig ? CFG.key : localStorage.getItem('puli_sb_key');
if (!SB_KEY) {
  document.body.innerHTML = `
    <div class="auth-screen"><div class="auth-card">
      <div class="auth-logo">PULI <span>LIFE</span></div>
      <p class="auth-sub">Prvé spustenie — pripoj svoju Supabase databázu (spraví sa to len raz).</p>
      <ol style="font-size:13px;color:#c3c2b7;line-height:1.7;margin:0 0 18px 18px">
        <li>Otvor <a href="https://supabase.com/dashboard/project/sozcumhzaqfakowlbtla/settings/api-keys" target="_blank" style="color:#3987e5">Supabase → API Keys</a></li>
        <li>Skopíruj <b>anon / publishable</b> kľúč</li>
        <li>Vlož ho sem:</li>
      </ol>
      <form id="setup-form">
        <label>Supabase kľúč
          <input id="setup-key" required placeholder="sb_publishable_… alebo eyJ…" autocomplete="off">
        </label>
        <button type="submit" class="btn btn-primary">Uložiť a pokračovať</button>
        <p class="auth-msg" style="color:#898781">Kľúč sa uloží v tomto prehliadači. Dáta chráni prihlásenie + Row Level Security, nie tento kľúč.</p>
      </form>
    </div></div>`;
  document.getElementById('setup-form').onsubmit = e => {
    e.preventDefault();
    const k = document.getElementById('setup-key').value.trim();
    if (!k) return;
    localStorage.setItem('puli_sb_key', k);
    location.reload();
  };
  throw new Error('Missing Supabase config');
}
const sb = window.supabase.createClient(CFG.url, SB_KEY);
if (!keyFromConfig) {
  // key came from localStorage — offer a way to re-enter it if it's wrong
  const authCard = document.querySelector('.auth-card');
  if (authCard) {
    const reset = document.createElement('button');
    reset.type = 'button';
    reset.className = 'btn btn-ghost';
    reset.textContent = 'Zmeniť Supabase kľúč';
    reset.onclick = () => { localStorage.removeItem('puli_sb_key'); location.reload(); };
    authCard.appendChild(reset);
  }
}

/* ── helpers ── */
const $ = (s, el) => (el || document).querySelector(s);
const $$ = (s, el) => [...(el || document).querySelectorAll(s)];

const EUR = new Intl.NumberFormat('sk-SK', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 });
const EUR2 = new Intl.NumberFormat('sk-SK', { style: 'currency', currency: 'EUR', minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fmtEur = v => EUR.format(v);
const fmtEur2 = v => EUR2.format(v);
const signEur = v => (v > 0 ? '+' : '') + EUR2.format(v);
const signEur0 = v => (v > 0 ? '+' : '') + EUR.format(v);

const todayISO = () => {
  const d = new Date();
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
};
const addDays = (iso, n) => {
  const d = new Date(iso + 'T12:00:00');
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
};
const fmtDate = iso => {
  const d = new Date(iso + 'T12:00:00');
  return d.getDate() + '.' + (d.getMonth() + 1) + '.' + d.getFullYear();
};
const fmtDateShort = iso => {
  const d = new Date(iso + 'T12:00:00');
  return d.getDate() + '.' + (d.getMonth() + 1) + '.';
};
const MONTHS_SK = ['Jan', 'Feb', 'Mar', 'Apr', 'Máj', 'Jún', 'Júl', 'Aug', 'Sep', 'Okt', 'Nov', 'Dec'];
const DAYS_SK = ['Po', 'Ut', 'St', 'Št', 'Pi', 'So', 'Ne'];
const isoWeekday = iso => (new Date(iso + 'T12:00:00').getDay() + 6) % 7 + 1; // 1=Po .. 7=Ne
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

let toastTimer;
function toast(msg) {
  const t = $('#toast');
  t.textContent = msg;
  t.classList.remove('hidden');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.add('hidden'), 2200);
}

function openModal(html) {
  $('#modal').innerHTML = html;
  $('#modal-backdrop').classList.remove('hidden');
}
function closeModal() {
  $('#modal-backdrop').classList.add('hidden');
  $('#modal').innerHTML = '';
}
$('#modal-backdrop').addEventListener('click', e => { if (e.target.id === 'modal-backdrop') closeModal(); });

async function guard(promise, okMsg) {
  const { error, data } = await promise;
  if (error) { console.error(error); toast('Chyba: ' + error.message); throw error; }
  if (okMsg) toast(okMsg);
  return data;
}

/* ══ CHARTS (SVG, dark palette) ══ */
const C = {
  blue: '#3987e5', orange: '#d95926', aqua: '#199e70',
  good: '#0ca30c', bad: '#d03b3b',
  grid: '#2c2c2a', axis: '#383835', muted: '#898781'
};

function niceTicks(min, max, n) {
  if (min === max) { min -= 1; max += 1; }
  const span = max - min;
  const step0 = span / Math.max(1, n);
  const mag = Math.pow(10, Math.floor(Math.log10(step0)));
  let step = mag;
  for (const m of [1, 2, 2.5, 5, 10]) { if (step0 <= m * mag) { step = m * mag; break; } }
  const lo = Math.floor(min / step) * step;
  const hi = Math.ceil(max / step) * step;
  const ticks = [];
  for (let v = lo; v <= hi + step * 0.001; v += step) ticks.push(Math.round(v * 100) / 100);
  return { lo, hi, ticks };
}
const fmtAxis = v => {
  const a = Math.abs(v);
  if (a >= 1000000) return (v / 1000000).toFixed(1).replace('.0', '') + 'M';
  if (a >= 1000) return (v / 1000).toFixed(1).replace('.0', '') + 'k';
  return String(Math.round(v * 100) / 100);
};

/* line chart: points = [{label, value}] */
function lineChart(container, points, opts = {}) {
  container.innerHTML = '';
  if (!points || !points.length) {
    container.innerHTML = '<div class="chart-empty">' + (opts.empty || 'Zatiaľ málo dát na graf.') + '</div>';
    return;
  }
  let singlePoint = false;
  if (points.length === 1) {
    // jediný zápis — rovná čiara s bodom na konci, nech graf nie je prázdny
    points = [{ ...points[0], label: '' }, points[0]];
    singlePoint = true;
  }
  const W = 640, H = 220, padL = 44, padR = 12, padT = 12, padB = 26;
  const vals = points.map(p => p.value);
  let minV = opts.zero ? Math.min(0, ...vals) : Math.min(...vals);
  let maxV = Math.max(...vals);
  if (minV === maxV) { const pad = Math.max(1, Math.abs(maxV) * 0.08); minV -= pad; maxV += pad; }
  const { lo, hi, ticks } = niceTicks(minV, maxV, 4);
  const X = i => padL + (i / (points.length - 1)) * (W - padL - padR);
  const Y = v => padT + (1 - (v - lo) / (hi - lo || 1)) * (H - padT - padB);
  const color = opts.color || C.blue;

  let g = '';
  for (const t of ticks) {
    g += `<line x1="${padL}" y1="${Y(t)}" x2="${W - padR}" y2="${Y(t)}" stroke="${C.grid}" stroke-width="1"/>`;
    g += `<text x="${padL - 8}" y="${Y(t) + 3.5}" text-anchor="end" font-size="10.5" fill="${C.muted}">${fmtAxis(t)}</text>`;
  }
  const n = points.length;
  const labStep = Math.max(1, Math.ceil(n / 6));
  let xl = '';
  for (let i = 0; i < n; i += labStep) {
    xl += `<text x="${X(i)}" y="${H - 8}" text-anchor="middle" font-size="10.5" fill="${C.muted}">${esc(points[i].label)}</text>`;
  }
  const path = points.map((p, i) => (i ? 'L' : 'M') + X(i).toFixed(1) + ' ' + Y(p.value).toFixed(1)).join(' ');
  const area = path + ` L ${X(n - 1).toFixed(1)} ${Y(lo).toFixed(1)} L ${X(0).toFixed(1)} ${Y(lo).toFixed(1)} Z`;

  container.innerHTML = `
    <svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMid meet">
      ${g}${xl}
      <path d="${area}" fill="${color}" opacity="0.10"/>
      <path d="${path}" fill="none" stroke="${color}" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/>
      ${singlePoint ? `<circle cx="${X(n - 1)}" cy="${Y(points[n - 1].value)}" r="4.5" fill="${color}" stroke="#1a1a19" stroke-width="2"/>` : ''}
      <line id="ch-cross" x1="0" y1="${padT}" x2="0" y2="${H - padB}" stroke="${C.muted}" stroke-width="1" stroke-dasharray="3 3" style="display:none"/>
      <circle id="ch-dot" r="4.5" fill="${color}" stroke="#1a1a19" stroke-width="2" style="display:none"/>
    </svg>
    <div class="chart-tip"></div>`;

  const svg = $('svg', container), tip = $('.chart-tip', container);
  const cross = $('#ch-cross', container), dot = $('#ch-dot', container);
  const fmt = opts.fmt || fmtEur;
  function move(clientX) {
    const r = svg.getBoundingClientRect();
    const relX = (clientX - r.left) / r.width * W;
    let i = Math.round((relX - padL) / ((W - padL - padR) / (n - 1)));
    i = Math.max(0, Math.min(n - 1, i));
    const p = points[i];
    cross.style.display = dot.style.display = '';
    cross.setAttribute('x1', X(i)); cross.setAttribute('x2', X(i));
    dot.setAttribute('cx', X(i)); dot.setAttribute('cy', Y(p.value));
    tip.style.display = 'block';
    tip.style.left = (X(i) / W * r.width) + 'px';
    tip.style.top = (Y(p.value) / H * r.height) + 'px';
    tip.innerHTML = `<div class="t-label">${esc(p.tipLabel || p.label)}</div><div class="t-val">${fmt(p.value)}</div>`;
  }
  function hide() { cross.style.display = dot.style.display = 'none'; tip.style.display = 'none'; }
  svg.addEventListener('mousemove', e => move(e.clientX));
  svg.addEventListener('mouseleave', hide);
  svg.addEventListener('touchstart', e => move(e.touches[0].clientX), { passive: true });
  svg.addEventListener('touchmove', e => move(e.touches[0].clientX), { passive: true });
  svg.addEventListener('touchend', hide);
}

/* bar chart with pos/neg polarity: bars = [{label, value, tipLabel}] */
function pnlBarChart(container, bars, opts = {}) {
  container.innerHTML = '';
  if (!bars || !bars.length) {
    container.innerHTML = '<div class="chart-empty">' + (opts.empty || 'Zatiaľ žiadne dáta.') + '</div>';
    return;
  }
  const W = 640, H = 200, padL = 44, padR = 12, padT = 12, padB = 26;
  const vals = bars.map(b => b.value);
  const { lo, hi, ticks } = niceTicks(Math.min(0, ...vals), Math.max(0, ...vals), 4);
  const Y = v => padT + (1 - (v - lo) / (hi - lo || 1)) * (H - padT - padB);
  const n = bars.length;
  const slot = (W - padL - padR) / n;
  const bw = Math.max(3, Math.min(26, slot - 2));

  let g = '';
  for (const t of ticks) {
    g += `<line x1="${padL}" y1="${Y(t)}" x2="${W - padR}" y2="${Y(t)}" stroke="${C.grid}" stroke-width="1"/>`;
    g += `<text x="${padL - 8}" y="${Y(t) + 3.5}" text-anchor="end" font-size="10.5" fill="${C.muted}">${fmtAxis(t)}</text>`;
  }
  let rects = '', xl = '';
  const labStep = Math.max(1, Math.ceil(n / 7));
  bars.forEach((b, i) => {
    const x = padL + i * slot + (slot - bw) / 2;
    const y0 = Y(0), y1 = Y(b.value);
    const top = Math.min(y0, y1), h = Math.max(1.5, Math.abs(y0 - y1));
    const col = b.value >= 0 ? C.good : C.bad;
    const rx = Math.min(4, bw / 2);
    rects += `<path d="${b.value >= 0
      ? `M${x} ${top + h} V${top + rx} Q${x} ${top} ${x + rx} ${top} H${x + bw - rx} Q${x + bw} ${top} ${x + bw} ${top + rx} V${top + h} Z`
      : `M${x} ${top} V${top + h - rx} Q${x} ${top + h} ${x + rx} ${top + h} H${x + bw - rx} Q${x + bw} ${top + h} ${x + bw} ${top + h - rx} V${top} Z`}"
      fill="${col}" data-i="${i}"/>`;
    if (i % labStep === 0) xl += `<text x="${x + bw / 2}" y="${H - 8}" text-anchor="middle" font-size="10.5" fill="${C.muted}">${esc(b.label)}</text>`;
  });
  container.innerHTML = `
    <svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMid meet">
      ${g}
      <line x1="${padL}" y1="${Y(0)}" x2="${W - padR}" y2="${Y(0)}" stroke="${C.axis}" stroke-width="1.5"/>
      ${rects}${xl}
    </svg>
    <div class="chart-tip"></div>`;
  attachBarTips(container, bars, opts.fmt || signEur, W, H, Y, i => padL + i * slot + slot / 2);
}

/* grouped bars: groups = [{label, a, b}], two series */
function groupedBarChart(container, groups, opts = {}) {
  container.innerHTML = '';
  if (!groups || !groups.length || groups.every(g2 => !g2.a && !g2.b)) {
    container.innerHTML = '<div class="chart-empty">' + (opts.empty || 'Zatiaľ žiadne dáta.') + '</div>';
    return;
  }
  const W = 640, H = 200, padL = 44, padR = 12, padT = 12, padB = 26;
  const vals = groups.flatMap(g2 => [g2.a, g2.b]);
  const { lo, hi, ticks } = niceTicks(0, Math.max(1, ...vals), 4);
  const Y = v => padT + (1 - (v - lo) / (hi - lo || 1)) * (H - padT - padB);
  const n = groups.length;
  const slot = (W - padL - padR) / n;
  const bw = Math.max(4, Math.min(20, (slot - 14) / 2));

  let g = '';
  for (const t of ticks) {
    g += `<line x1="${padL}" y1="${Y(t)}" x2="${W - padR}" y2="${Y(t)}" stroke="${C.grid}" stroke-width="1"/>`;
    g += `<text x="${padL - 8}" y="${Y(t) + 3.5}" text-anchor="end" font-size="10.5" fill="${C.muted}">${fmtAxis(t)}</text>`;
  }
  let rects = '', xl = '';
  const bar = (x, v, col) => {
    if (v <= 0) return '';
    const y = Y(v), h = Math.max(1.5, Y(0) - y), rx = Math.min(4, bw / 2);
    return `<path d="M${x} ${y + h} V${y + rx} Q${x} ${y} ${x + rx} ${y} H${x + bw - rx} Q${x + bw} ${y} ${x + bw} ${y + rx} V${y + h} Z" fill="${col}"/>`;
  };
  groups.forEach((gr, i) => {
    const cx = padL + i * slot + slot / 2;
    rects += bar(cx - bw - 1, gr.a, C.blue) + bar(cx + 1, gr.b, C.orange);
    xl += `<text x="${cx}" y="${H - 8}" text-anchor="middle" font-size="10.5" fill="${C.muted}">${esc(gr.label)}</text>`;
  });
  container.innerHTML = `
    <svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMid meet">
      ${g}
      <line x1="${padL}" y1="${Y(0)}" x2="${W - padR}" y2="${Y(0)}" stroke="${C.axis}" stroke-width="1.5"/>
      ${rects}${xl}
    </svg>
    <div class="chart-tip"></div>
    <div class="legend">
      <span class="legend-item"><span class="legend-swatch" style="background:${C.blue}"></span>${esc(opts.labelA || 'A')}</span>
      <span class="legend-item"><span class="legend-swatch" style="background:${C.orange}"></span>${esc(opts.labelB || 'B')}</span>
    </div>`;
  const bars = groups.map(gr => ({ label: gr.label, tip: `${opts.labelA}: ${fmtEur(gr.a)} · ${opts.labelB}: ${fmtEur(gr.b)}` }));
  const svg = $('svg', container), tip = $('.chart-tip', container);
  function move(clientX) {
    const r = svg.getBoundingClientRect();
    const relX = (clientX - r.left) / r.width * W;
    let i = Math.floor((relX - padL) / slot);
    i = Math.max(0, Math.min(n - 1, i));
    tip.style.display = 'block';
    tip.style.left = ((padL + i * slot + slot / 2) / W * r.width) + 'px';
    tip.style.top = (padT / H * r.height + 14) + 'px';
    tip.innerHTML = `<div class="t-label">${esc(bars[i].label)}</div><div class="t-val">${esc(bars[i].tip)}</div>`;
  }
  svg.addEventListener('mousemove', e => move(e.clientX));
  svg.addEventListener('mouseleave', () => tip.style.display = 'none');
  svg.addEventListener('touchstart', e => move(e.touches[0].clientX), { passive: true });
  svg.addEventListener('touchmove', e => move(e.touches[0].clientX), { passive: true });
  svg.addEventListener('touchend', () => tip.style.display = 'none');
}

function attachBarTips(container, bars, fmt, W, H, Y, centerX) {
  const svg = $('svg', container), tip = $('.chart-tip', container);
  const n = bars.length;
  function move(clientX) {
    const r = svg.getBoundingClientRect();
    const relX = (clientX - r.left) / r.width * W;
    let best = 0, bd = Infinity;
    for (let i = 0; i < n; i++) { const d = Math.abs(centerX(i) - relX); if (d < bd) { bd = d; best = i; } }
    const b = bars[best];
    tip.style.display = 'block';
    tip.style.left = (centerX(best) / W * r.width) + 'px';
    tip.style.top = (Y(Math.max(0, b.value)) / H * r.height) + 'px';
    tip.innerHTML = `<div class="t-label">${esc(b.tipLabel || b.label)}</div><div class="t-val">${fmt(b.value)}</div>`;
  }
  svg.addEventListener('mousemove', e => move(e.clientX));
  svg.addEventListener('mouseleave', () => tip.style.display = 'none');
  svg.addEventListener('touchstart', e => move(e.touches[0].clientX), { passive: true });
  svg.addEventListener('touchmove', e => move(e.touches[0].clientX), { passive: true });
  svg.addEventListener('touchend', () => tip.style.display = 'none');
}

/* ══ STATE ══ */
const S = {
  user: null,
  accounts: [], snapshots: [], transactions: [], financeGoals: [], pnl: [],
  habits: [], habitLogs: [], goals: [], goalSteps: [], journal: [], fitness: [],
  tasks: [], taskLogs: [],
  loaded: false
};

/* ── net worth series from snapshots (carry-forward per account) ── */
function netWorthSeries() {
  const snaps = [...S.snapshots].sort((a, b) => a.date.localeCompare(b.date));
  if (!snaps.length) return [];
  const dates = [...new Set(snaps.map(s => s.date))].sort();
  const last = {};
  const byDate = {};
  for (const s of snaps) (byDate[s.date] = byDate[s.date] || []).push(s);
  const out = [];
  for (const d of dates) {
    for (const s of byDate[d]) last[s.account_id] = Number(s.balance);
    out.push({ date: d, value: Object.values(last).reduce((a, b) => a + b, 0) });
  }
  return out;
}
function currentBalances() {
  const last = {};
  for (const s of [...S.snapshots].sort((a, b) => a.date.localeCompare(b.date))) {
    last[s.account_id] = { balance: Number(s.balance), date: s.date };
  }
  return last;
}
function netWorthNow() {
  const nw = netWorthSeries();
  return nw.length ? nw[nw.length - 1].value : 0;
}

/* dnešné úlohy: jednorazové na dnes (+ zmeškané) a opakované, ktorých deň je dnes */
function tasksForToday() {
  const today = todayISO(), wd = isoWeekday(today);
  const out = [];
  for (const t of S.tasks) {
    if (t.kind === 'once') {
      if (!t.date) continue;
      if (t.date === today) out.push({ t, done: t.done, overdue: false });
      else if (t.date < today && !t.done) out.push({ t, done: false, overdue: true });
    } else if ((t.weekdays || []).includes(wd)) {
      out.push({ t, done: S.taskLogs.some(l => l.task_id === t.id && l.date === today), overdue: false });
    }
  }
  return out.sort((a, b) => (a.t.time || '99:99').localeCompare(b.t.time || '99:99'));
}

function taskRow({ t, done, overdue }, manage) {
  const sub = [
    t.time ? '🕐 ' + t.time : '',
    overdue ? 'mešká od ' + fmtDate(t.date) : '',
    t.kind === 'recurring' ? (t.weekdays || []).map(d => DAYS_SK[d - 1]).join(' ') : ''
  ].filter(Boolean).join(' · ');
  return `<div class="habit-row">
    <button class="habit-check ${done ? 'done' : ''}" onclick="toggleTask('${t.id}')">✓</button>
    <div class="row-main">
      <span class="habit-name ${done ? 'done' : ''}" style="display:block">${esc(t.title)}</span>
      ${sub ? `<span class="row-sub ${overdue ? 'neg' : ''}">${sub}</span>` : ''}
    </div>
    ${manage ? `<button class="icon-btn" onclick="deleteTask('${t.id}')" title="Zmazať">✕</button>` : ''}
  </div>`;
}

function renderTaskList(container, manage) {
  if (!S.tasksReady) {
    container.innerHTML = '<p class="muted small">Checklist úloh potrebuje malé rozšírenie databázy — spusti SQL zo súboru <b>supabase/migrations/20260804_tasks.sql</b> (návod v README).</p>';
    return;
  }
  const list = tasksForToday();
  container.innerHTML = list.length
    ? list.map(x => taskRow(x, manage)).join('')
    : '<p class="muted small">Na dnes žiadne úlohy. Pridaj jednorazovú na konkrétny deň alebo opakovanú na vybrané dni v týždni.</p>';
}

window.toggleTask = async id => {
  const t = S.tasks.find(x => x.id === id);
  const today = todayISO();
  if (t.kind === 'once') {
    await guard(sb.from('tasks').update({ done: !t.done }).eq('id', id));
  } else {
    const log = S.taskLogs.find(l => l.task_id === id && l.date === today);
    if (log) await guard(sb.from('task_logs').delete().eq('id', log.id));
    else await guard(sb.from('task_logs').insert({ user_id: S.user.id, task_id: id, date: today }));
  }
  await refresh();
};

window.deleteTask = async id => {
  if (!confirm('Zmazať úlohu?')) return;
  await guard(sb.from('tasks').delete().eq('id', id), 'Zmazané');
  await refresh();
};

window.openTaskModal = () => {
  openModal(`<h3>Nová úloha</h3>
    <form id="f-task">
      <label>Čo treba spraviť <input name="title" required autofocus placeholder="napr. Vybaviť poistku"></label>
      <label>Typ <select name="kind" id="task-kind">
        <option value="once">Jednorazová (konkrétny deň)</option>
        <option value="recurring">Opakovaná (vybrané dni)</option>
      </select></label>
      <label id="task-date-wrap">Dátum <input name="date" type="date" value="${todayISO()}"></label>
      <div id="task-days-wrap" style="display:none">
        <span class="small" style="color:var(--text2)">Dni v týždni</span>
        <div class="day-chips">${DAYS_SK.map((d, i) => `<button type="button" class="day-chip" data-d="${i + 1}">${d}</button>`).join('')}</div>
      </div>
      <label class="mt">Čas (voliteľné) <input name="time" type="time"></label>
      <div class="modal-actions">
        <button type="button" class="btn" onclick="closeModal()">Zrušiť</button>
        <button type="submit" class="btn btn-primary">Uložiť</button>
      </div>
    </form>`);
  $('#task-kind').onchange = e => {
    const rec = e.target.value === 'recurring';
    $('#task-date-wrap').style.display = rec ? 'none' : '';
    $('#task-days-wrap').style.display = rec ? '' : 'none';
  };
  $$('.day-chip').forEach(c => c.onclick = () => c.classList.toggle('on'));
  $('#f-task').onsubmit = async e => {
    e.preventDefault();
    const f = new FormData(e.target);
    const kind = f.get('kind');
    const weekdays = $$('.day-chip.on').map(c => Number(c.dataset.d));
    if (kind === 'recurring' && !weekdays.length) { toast('Vyber aspoň jeden deň'); return; }
    await guard(sb.from('tasks').insert({
      user_id: S.user.id, title: f.get('title'), kind,
      date: kind === 'once' ? f.get('date') : null,
      weekdays: kind === 'recurring' ? weekdays : null,
      time: f.get('time') || null
    }), 'Úloha pridaná');
    closeModal(); await refresh();
  };
};

function habitStreak(habitId) {
  const dates = new Set(S.habitLogs.filter(l => l.habit_id === habitId).map(l => l.date));
  let d = todayISO(), streak = 0;
  if (!dates.has(d)) d = addDays(d, -1);
  while (dates.has(d)) { streak++; d = addDays(d, -1); }
  return streak;
}

/* ══ DATA LOADING ══ */
async function loadAll() {
  const uid = S.user.id;
  const q = (t, sel, ord) => sb.from(t).select(sel || '*').order(ord || 'created_at', { ascending: false });
  const [acc, snap, tx, fg, pnl, hab, hlog, goals, steps, jour, fit, tasks, tlog] = await Promise.all([
    sb.from('accounts').select('*').eq('archived', false).order('sort_order'),
    sb.from('account_snapshots').select('*'),
    sb.from('transactions').select('*').order('date', { ascending: false }).limit(400),
    sb.from('finance_goals').select('*').order('created_at'),
    sb.from('daily_pnl').select('*').order('date', { ascending: false }).limit(200),
    sb.from('habits').select('*').eq('active', true).order('sort_order'),
    sb.from('habit_logs').select('*').gte('date', addDays(todayISO(), -370)),
    sb.from('goals').select('*').order('created_at'),
    sb.from('goal_steps').select('*').order('sort_order'),
    sb.from('journal').select('*').order('date', { ascending: false }).limit(120),
    sb.from('fitness_logs').select('*').order('date', { ascending: false }).limit(300),
    sb.from('tasks').select('*').eq('active', true).order('created_at'),
    sb.from('task_logs').select('*').gte('date', addDays(todayISO(), -30))
  ]);
  for (const r of [acc, snap, tx, fg, pnl, hab, hlog, goals, steps, jour, fit]) {
    if (r.error) { console.error(r.error); toast('Chyba načítania: ' + r.error.message); }
  }
  // tasks tables may not exist yet (migration pending) — degrade quietly
  S.tasks = tasks.error ? [] : (tasks.data || []);
  S.taskLogs = tlog.error ? [] : (tlog.data || []);
  S.tasksReady = !tasks.error;
  S.accounts = acc.data || []; S.snapshots = snap.data || []; S.transactions = tx.data || [];
  S.financeGoals = fg.data || []; S.pnl = pnl.data || []; S.habits = hab.data || [];
  S.habitLogs = hlog.data || []; S.goals = goals.data || []; S.goalSteps = steps.data || [];
  S.journal = jour.data || []; S.fitness = fit.data || [];
  S.loaded = true;
}

/* ══ VIEWS ══ */
let currentView = 'overview';
function showView(id) {
  currentView = id;
  $$('.section').forEach(s => s.classList.remove('active'));
  $('#view-' + id).classList.add('active');
  $$('.nav-btn').forEach(b => b.classList.toggle('active', b.dataset.view === id));
  render();
  const m = $('main');
  if (m) m.scrollTo(0, 0);
}
$$('.nav-btn').forEach(b => b.addEventListener('click', () => showView(b.dataset.view)));

function render() {
  if (!S.loaded) return;
  ({ overview: renderOverview, finance: renderFinance, life: renderLife, journal: renderJournal, fitness: renderFitness })[currentView]();
}
async function refresh() { await loadAll(); render(); }

/* ── OVERVIEW ── */
function renderOverview() {
  const el = $('#view-overview');
  const today = todayISO();
  const nwSeries = netWorthSeries();
  const nw = nwSeries.length ? nwSeries[nwSeries.length - 1].value : 0;
  const nwPrev = nwSeries.length > 1 ? nwSeries[nwSeries.length - 2].value : null;

  const ym = today.slice(0, 7);
  const monthTx = S.transactions.filter(t => t.date.startsWith(ym));
  const inc = monthTx.filter(t => t.type === 'income').reduce((a, t) => a + Number(t.amount), 0);
  const exp = monthTx.filter(t => t.type === 'expense').reduce((a, t) => a + Number(t.amount), 0);

  const todayPnl = S.pnl.find(p => p.date === today);
  const monthPnl = S.pnl.filter(p => p.date.startsWith(ym)).reduce((a, p) => a + Number(p.amount), 0);

  const doneToday = S.habits.filter(h => S.habitLogs.some(l => l.habit_id === h.id && l.date === today));
  const journalToday = S.journal.find(j => j.date === today);

  el.innerHTML = `
    <div class="card">
      <div class="card-head"><span class="card-title">Net worth</span>
        <span class="card-sub">${nwSeries.length ? 'k ' + fmtDate(nwSeries[nwSeries.length - 1].date) : ''}</span></div>
      <div class="hero-value">${fmtEur(nw)}</div>
      ${nwPrev !== null ? `<div class="tile-delta ${nw - nwPrev >= 0 ? 'pos' : 'neg'}">${nw - nwPrev >= 0 ? '↑' : '↓'} ${fmtEur(Math.abs(nw - nwPrev))} od predchádzajúceho zápisu</div>` : ''}
      <div class="chart-wrap mt" id="ov-nw-chart"></div>
    </div>

    <div class="tiles">
      <div class="tile"><div class="tile-label">Dnešný P&L</div>
        <div class="tile-value ${todayPnl ? (Number(todayPnl.amount) >= 0 ? 'pos' : 'neg') : 'muted'}">${todayPnl ? signEur(Number(todayPnl.amount)) : '—'}</div>
        <div class="tile-delta">mesiac: <span class="${monthPnl >= 0 ? 'pos' : 'neg'}">${signEur0(monthPnl)}</span></div></div>
      <div class="tile"><div class="tile-label">Cashflow ${MONTHS_SK[Number(ym.slice(5)) - 1]}</div>
        <div class="tile-value ${inc - exp >= 0 ? 'pos' : 'neg'}">${signEur0(inc - exp)}</div>
        <div class="tile-delta">+${fmtEur(inc)} / −${fmtEur(exp)}</div></div>
      <div class="tile"><div class="tile-label">Pravidlá dnes</div>
        <div class="tile-value">${doneToday.length}/${S.habits.length}</div>
        <div class="tile-delta">${doneToday.length === S.habits.length && S.habits.length ? '✓ všetko splnené' : 'ešte máš čo robiť'}</div></div>
      <div class="tile"><div class="tile-label">Žurnál dnes</div>
        <div class="tile-value">${journalToday ? '★'.repeat(journalToday.rating || 0) || '✓' : '—'}</div>
        <div class="tile-delta">${journalToday ? 'zapísané' : 'ešte nezapísané'}</div></div>
    </div>

    <div class="card">
      <div class="card-head"><span class="card-title">Dnešné úlohy</span>
        <button class="btn btn-sm btn-primary" onclick="openTaskModal()">+ Úloha</button></div>
      <div id="ov-tasks"></div>
    </div>

    <div class="card">
      <div class="card-head"><span class="card-title">Dnešné pravidlá</span>
        <button class="btn btn-sm" onclick="showView('life')">Spravovať</button></div>
      <div id="ov-habits">${S.habits.length ? '' : '<p class="muted small">Zatiaľ žiadne pravidlá — pridaj si ich v sekcii Život.</p>'}</div>
    </div>

    <div class="card">
      <div class="card-head"><span class="card-title">Ciele</span>
        <button class="btn btn-sm" onclick="showView('life')">Detail</button></div>
      <div id="ov-goals"></div>
    </div>`;

  const nwPts = nwSeries.slice(-30).map(p => ({ label: fmtDateShort(p.date), tipLabel: fmtDate(p.date), value: p.value }));
  lineChart($('#ov-nw-chart'), nwPts, { empty: 'Pridaj účty a zapíš zostatky — graf sa vykreslí sám.' });

  renderTaskList($('#ov-tasks'), false);
  renderHabitList($('#ov-habits'));
  renderGoalsMini($('#ov-goals'));
}

function renderHabitList(container) {
  if (!S.habits.length) return;
  const today = todayISO();
  container.innerHTML = S.habits.map(h => {
    const done = S.habitLogs.some(l => l.habit_id === h.id && l.date === today);
    const st = habitStreak(h.id);
    return `<div class="habit-row">
      <button class="habit-check ${done ? 'done' : ''}" onclick="toggleHabit('${h.id}')">✓</button>
      <span class="habit-name ${done ? 'done' : ''}">${h.emoji ? esc(h.emoji) + ' ' : ''}${esc(h.name)}</span>
      <span class="habit-streak">${st > 0 ? '🔥 ' + st + ' d' : ''}</span>
    </div>`;
  }).join('');
}

function goalProgress(goal) {
  const steps = S.goalSteps.filter(s => s.goal_id === goal.id);
  if (!steps.length) return goal.status === 'done' ? 100 : 0;
  return Math.round(steps.filter(s => s.done).length / steps.length * 100);
}

function renderGoalsMini(container) {
  const active = S.goals.filter(g => g.status === 'active');
  const finGoals = S.financeGoals.filter(g => !g.done);
  if (!active.length && !finGoals.length) {
    container.innerHTML = '<p class="muted small">Žiadne aktívne ciele.</p>';
    return;
  }
  const nw = netWorthNow();
  container.innerHTML =
    finGoals.map(g => {
      const cur = g.track_networth ? nw : Number(g.current_amount);
      const pct = Math.min(100, Math.round(cur / Number(g.target_amount) * 100));
      return `<div class="row"><div class="row-main">
        <div class="row-title">💶 ${esc(g.name)}</div>
        <div class="progress"><div style="width:${pct}%" class="${pct >= 100 ? 'full' : ''}"></div></div>
        <div class="row-sub mt" style="margin-top:5px">${fmtEur(cur)} / ${fmtEur(Number(g.target_amount))} · ${pct}%</div>
      </div></div>`;
    }).join('') +
    active.map(g => {
      const pct = goalProgress(g);
      return `<div class="row"><div class="row-main">
        <div class="row-title">${esc(g.title)}</div>
        <div class="progress"><div style="width:${pct}%" class="${pct >= 100 ? 'full' : ''}"></div></div>
        <div class="row-sub" style="margin-top:5px">${pct}%${g.deadline ? ' · do ' + fmtDate(g.deadline) : ''}</div>
      </div></div>`;
    }).join('');
}

/* ── FINANCE ── */
let financeTab = 'networth';
function renderFinance() {
  const el = $('#view-finance');
  el.innerHTML = `
    <div class="seg">
      <button class="${financeTab === 'networth' ? 'active' : ''}" onclick="setFinanceTab('networth')">Net worth</button>
      <button class="${financeTab === 'cashflow' ? 'active' : ''}" onclick="setFinanceTab('cashflow')">Cashflow</button>
      <button class="${financeTab === 'pnl' ? 'active' : ''}" onclick="setFinanceTab('pnl')">P&L</button>
      <button class="${financeTab === 'goals' ? 'active' : ''}" onclick="setFinanceTab('goals')">Ciele</button>
    </div>
    <div id="finance-body"></div>`;
  ({ networth: renderNetworthTab, cashflow: renderCashflowTab, pnl: renderPnlTab, goals: renderFinGoalsTab })[financeTab]($('#finance-body'));
}
window.setFinanceTab = t => { financeTab = t; renderFinance(); };

function renderNetworthTab(el) {
  const series = netWorthSeries();
  const nw = series.length ? series[series.length - 1].value : 0;
  const balances = currentBalances();
  el.innerHTML = `
    <div class="card">
      <div class="card-head"><span class="card-title">Vývoj net worth</span></div>
      <div class="hero-value">${fmtEur(nw)}</div>
      <div class="chart-wrap mt" id="nw-chart"></div>
    </div>
    <div class="card">
      <div class="card-head"><span class="card-title">Účty</span>
        <button class="btn btn-sm btn-primary" onclick="openAccountModal()">+ Účet</button></div>
      ${S.accounts.length ? S.accounts.map(a => {
        const b = balances[a.id];
        return `<div class="row">
          <div class="row-main">
            <div class="row-title">${esc(a.name)}</div>
            <div class="row-sub">${({ cash: 'Hotovosť', bank: 'Banka', crypto: 'Krypto', broker: 'Broker', other: 'Iné' })[a.type] || a.type}${b ? ' · aktualizované ' + fmtDate(b.date) : ''}</div>
          </div>
          <span class="row-amount">${b ? fmtEur2(b.balance) : '—'}</span>
          <button class="btn btn-sm" onclick="openBalanceModal('${a.id}')">Zapísať</button>
        </div>`;
      }).join('') : '<p class="muted small">Pridaj si prvý účet (banka, hotovosť, krypto, broker…) a priebežne zapisuj zostatky — net worth sa počíta automaticky.</p>'}
    </div>`;
  const pts = series.slice(-60).map(p => ({ label: fmtDateShort(p.date), tipLabel: fmtDate(p.date), value: p.value }));
  lineChart($('#nw-chart'), pts, { empty: 'Zapíš aspoň dva zostatky a uvidíš vývoj.' });
}

window.openAccountModal = () => {
  openModal(`<h3>Nový účet</h3>
    <form id="f-acc">
      <label>Názov <input name="name" required placeholder="napr. Tatra banka"></label>
      <label>Typ <select name="type">
        <option value="bank">Banka</option><option value="cash">Hotovosť</option>
        <option value="crypto">Krypto</option><option value="broker">Broker</option>
        <option value="other">Iné</option></select></label>
      <label>Aktuálny zostatok (€) <input name="balance" type="number" step="0.01" required placeholder="0.00"></label>
      <div class="modal-actions">
        <button type="button" class="btn" onclick="closeModal()">Zrušiť</button>
        <button type="submit" class="btn btn-primary">Uložiť</button>
      </div>
    </form>`);
  $('#f-acc').onsubmit = async e => {
    e.preventDefault();
    const f = new FormData(e.target);
    const acc = await guard(sb.from('accounts').insert({
      user_id: S.user.id, name: f.get('name'), type: f.get('type'), sort_order: S.accounts.length
    }).select().single());
    await guard(sb.from('account_snapshots').insert({
      user_id: S.user.id, account_id: acc.id, date: todayISO(), balance: Number(f.get('balance'))
    }), 'Účet pridaný');
    closeModal(); await refresh();
  };
};

window.openBalanceModal = accId => {
  const a = S.accounts.find(x => x.id === accId);
  openModal(`<h3>Zostatok — ${esc(a.name)}</h3>
    <form id="f-bal">
      <label>Dátum <input name="date" type="date" value="${todayISO()}" required></label>
      <label>Zostatok (€) <input name="balance" type="number" step="0.01" required autofocus></label>
      <div class="modal-actions">
        <button type="button" class="btn btn-danger" onclick="deleteAccount('${accId}')">Zmazať účet</button>
        <button type="submit" class="btn btn-primary">Uložiť</button>
      </div>
    </form>`);
  $('#f-bal').onsubmit = async e => {
    e.preventDefault();
    const f = new FormData(e.target);
    await guard(sb.from('account_snapshots').upsert({
      user_id: S.user.id, account_id: accId, date: f.get('date'), balance: Number(f.get('balance'))
    }, { onConflict: 'account_id,date' }), 'Zostatok zapísaný');
    closeModal(); await refresh();
  };
};

window.deleteAccount = async accId => {
  if (!confirm('Naozaj zmazať účet aj jeho históriu zostatkov?')) return;
  await guard(sb.from('accounts').delete().eq('id', accId), 'Účet zmazaný');
  closeModal(); await refresh();
};

const CATEGORIES = ['Bývanie', 'Jedlo', 'Doprava', 'Zábava', 'Zdravie', 'Oblečenie', 'Predplatné', 'Výplata', 'Podnikanie', 'Trading', 'Iné'];

function renderCashflowTab(el) {
  const today = todayISO(), ym = today.slice(0, 7);
  const monthTx = S.transactions.filter(t => t.date.startsWith(ym));
  const inc = monthTx.filter(t => t.type === 'income').reduce((a, t) => a + Number(t.amount), 0);
  const exp = monthTx.filter(t => t.type === 'expense').reduce((a, t) => a + Number(t.amount), 0);

  const months = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date(); d.setDate(1); d.setMonth(d.getMonth() - i);
    const key = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0');
    const tx = S.transactions.filter(t => t.date.startsWith(key));
    months.push({
      label: MONTHS_SK[d.getMonth()],
      a: tx.filter(t => t.type === 'income').reduce((s, t) => s + Number(t.amount), 0),
      b: tx.filter(t => t.type === 'expense').reduce((s, t) => s + Number(t.amount), 0)
    });
  }

  const catTotals = {};
  for (const t of monthTx.filter(t => t.type === 'expense')) catTotals[t.category] = (catTotals[t.category] || 0) + Number(t.amount);
  const topCats = Object.entries(catTotals).sort((a, b) => b[1] - a[1]).slice(0, 5);
  const maxCat = topCats.length ? topCats[0][1] : 1;

  el.innerHTML = `
    <div class="tiles t3">
      <div class="tile"><div class="tile-label">Príjmy</div><div class="tile-value pos">${fmtEur(inc)}</div></div>
      <div class="tile"><div class="tile-label">Výdavky</div><div class="tile-value neg">${fmtEur(exp)}</div></div>
      <div class="tile"><div class="tile-label">Bilancia</div><div class="tile-value ${inc - exp >= 0 ? 'pos' : 'neg'}">${signEur(inc - exp)}</div></div>
    </div>
    <div class="card">
      <div class="card-head"><span class="card-title">Posledných 6 mesiacov</span></div>
      <div class="chart-wrap" id="cf-chart"></div>
    </div>
    ${topCats.length ? `<div class="card">
      <div class="card-head"><span class="card-title">Top kategórie výdavkov (${MONTHS_SK[Number(ym.slice(5)) - 1]})</span></div>
      ${topCats.map(([c, v]) => `<div class="row"><div class="row-main">
        <div class="row-title">${esc(c)}</div>
        <div class="progress"><div style="width:${Math.round(v / maxCat * 100)}%;background:var(--orange)"></div></div>
      </div><span class="row-amount">${fmtEur(v)}</span></div>`).join('')}
    </div>` : ''}
    <div class="card">
      <div class="card-head"><span class="card-title">Transakcie</span>
        <button class="btn btn-sm btn-primary" onclick="openTxModal()">+ Pridať</button></div>
      ${S.transactions.slice(0, 25).map(t => `<div class="row">
        <div class="row-main">
          <div class="row-title">${esc(t.category)}${t.note ? ' · <span class="muted">' + esc(t.note) + '</span>' : ''}</div>
          <div class="row-sub">${fmtDate(t.date)}</div>
        </div>
        <span class="row-amount ${t.type === 'income' ? 'pos' : ''}">${t.type === 'income' ? '+' : '−'}${fmtEur2(Number(t.amount))}</span>
        <button class="icon-btn" onclick="deleteTx('${t.id}')" title="Zmazať">✕</button>
      </div>`).join('') || '<p class="muted small">Zapisuj príjmy a výdavky — mesačný prehľad sa spraví sám.</p>'}
    </div>`;
  groupedBarChart($('#cf-chart'), months, { labelA: 'Príjmy', labelB: 'Výdavky' });
}

window.openTxModal = () => {
  openModal(`<h3>Nová transakcia</h3>
    <form id="f-tx">
      <label>Typ <select name="type"><option value="expense">Výdavok</option><option value="income">Príjem</option></select></label>
      <label>Suma (€) <input name="amount" type="number" step="0.01" min="0.01" required autofocus></label>
      <label>Kategória <select name="category">${CATEGORIES.map(c => `<option>${c}</option>`).join('')}</select></label>
      <label>Dátum <input name="date" type="date" value="${todayISO()}" required></label>
      <label>Poznámka <input name="note" placeholder="voliteľné"></label>
      <div class="modal-actions">
        <button type="button" class="btn" onclick="closeModal()">Zrušiť</button>
        <button type="submit" class="btn btn-primary">Uložiť</button>
      </div>
    </form>`);
  $('#f-tx').onsubmit = async e => {
    e.preventDefault();
    const f = new FormData(e.target);
    await guard(sb.from('transactions').insert({
      user_id: S.user.id, type: f.get('type'), amount: Number(f.get('amount')),
      category: f.get('category'), date: f.get('date'), note: f.get('note') || null
    }), 'Uložené');
    closeModal(); await refresh();
  };
};
window.deleteTx = async id => {
  if (!confirm('Zmazať transakciu?')) return;
  await guard(sb.from('transactions').delete().eq('id', id), 'Zmazané');
  await refresh();
};

function renderPnlTab(el) {
  const today = todayISO(), ym = today.slice(0, 7);
  const monthPnl = S.pnl.filter(p => p.date.startsWith(ym));
  const monthSum = monthPnl.reduce((a, p) => a + Number(p.amount), 0);
  const greenDays = monthPnl.filter(p => Number(p.amount) > 0).length;
  const todayPnl = S.pnl.find(p => p.date === today);
  const last30 = [...S.pnl].sort((a, b) => a.date.localeCompare(b.date)).slice(-30);

  el.innerHTML = `
    <div class="tiles t3">
      <div class="tile"><div class="tile-label">Dnes</div>
        <div class="tile-value ${todayPnl ? (Number(todayPnl.amount) >= 0 ? 'pos' : 'neg') : 'muted'}">${todayPnl ? signEur(Number(todayPnl.amount)) : '—'}</div></div>
      <div class="tile"><div class="tile-label">Mesiac</div>
        <div class="tile-value ${monthSum >= 0 ? 'pos' : 'neg'}">${signEur(monthSum)}</div></div>
      <div class="tile"><div class="tile-label">Zelené dni</div>
        <div class="tile-value">${greenDays}/${monthPnl.length}</div></div>
    </div>
    <div class="card">
      <div class="card-head"><span class="card-title">Denný P&L</span>
        <button class="btn btn-sm btn-primary" onclick="openPnlModal()">+ Zapísať deň</button></div>
      <div class="chart-wrap" id="pnl-chart"></div>
    </div>
    <div class="card">
      <div class="card-head"><span class="card-title">História</span></div>
      ${S.pnl.slice(0, 20).map(p => `<div class="row">
        <div class="row-main"><div class="row-title">${fmtDate(p.date)}</div>${p.note ? `<div class="row-sub">${esc(p.note)}</div>` : ''}</div>
        <span class="row-amount ${Number(p.amount) >= 0 ? 'pos' : 'neg'}">${signEur(Number(p.amount))}</span>
        <button class="icon-btn" onclick="deletePnl('${p.id}')" title="Zmazať">✕</button>
      </div>`).join('') || '<p class="muted small">Zapíš si na konci obchodného dňa svoj P&L — štatistiky sa počítajú samé.</p>'}
    </div>`;
  const bars = last30.map(p => ({ label: fmtDateShort(p.date), tipLabel: fmtDate(p.date), value: Number(p.amount) }));
  pnlBarChart($('#pnl-chart'), bars, { empty: 'Zatiaľ žiadne zapísané dni.' });
}

window.openPnlModal = () => {
  const today = todayISO();
  const existing = S.pnl.find(p => p.date === today);
  openModal(`<h3>Denný P&L</h3>
    <form id="f-pnl">
      <label>Dátum <input name="date" type="date" value="${today}" required></label>
      <label>P&L (€) — zisk kladný, strata záporná <input name="amount" type="number" step="0.01" required value="${existing ? Number(existing.amount) : ''}" autofocus></label>
      <label>Poznámka <input name="note" placeholder="napr. 2 obchody, dodržané pravidlá" value="${existing && existing.note ? esc(existing.note) : ''}"></label>
      <div class="modal-actions">
        <button type="button" class="btn" onclick="closeModal()">Zrušiť</button>
        <button type="submit" class="btn btn-primary">Uložiť</button>
      </div>
    </form>`);
  $('#f-pnl').onsubmit = async e => {
    e.preventDefault();
    const f = new FormData(e.target);
    await guard(sb.from('daily_pnl').upsert({
      user_id: S.user.id, date: f.get('date'), amount: Number(f.get('amount')), note: f.get('note') || null
    }, { onConflict: 'user_id,date' }), 'P&L zapísaný');
    closeModal(); await refresh();
  };
};
window.deletePnl = async id => {
  if (!confirm('Zmazať záznam?')) return;
  await guard(sb.from('daily_pnl').delete().eq('id', id), 'Zmazané');
  await refresh();
};

function renderFinGoalsTab(el) {
  const nw = netWorthNow();
  el.innerHTML = `
    <div class="card">
      <div class="card-head"><span class="card-title">Finančné ciele</span>
        <button class="btn btn-sm btn-primary" onclick="openFinGoalModal()">+ Cieľ</button></div>
      ${S.financeGoals.length ? S.financeGoals.map(g => {
        const cur = g.track_networth ? nw : Number(g.current_amount);
        const pct = Math.min(100, Math.round(cur / Number(g.target_amount) * 100));
        return `<div class="row">
          <div class="row-main">
            <div class="row-title">${esc(g.name)} ${g.done ? '<span class="chip good">splnený</span>' : ''}</div>
            <div class="progress"><div style="width:${pct}%" class="${pct >= 100 ? 'full' : ''}"></div></div>
            <div class="row-sub" style="margin-top:5px">${fmtEur(cur)} / ${fmtEur(Number(g.target_amount))} · ${pct}%${g.deadline ? ' · do ' + fmtDate(g.deadline) : ''}${g.track_networth ? ' · sleduje net worth' : ''}</div>
          </div>
          ${g.track_networth ? '' : `<button class="btn btn-sm" onclick="openFinGoalUpdate('${g.id}')">Vklad</button>`}
          <button class="icon-btn" onclick="deleteFinGoal('${g.id}')" title="Zmazať">✕</button>
        </div>`;
      }).join('') : '<p class="muted small">Napr. „Železná rezerva 10 000 €“ alebo „Net worth 100 000 €“.</p>'}
    </div>`;
}

window.openFinGoalModal = () => {
  openModal(`<h3>Nový finančný cieľ</h3>
    <form id="f-fg">
      <label>Názov <input name="name" required placeholder="napr. Rezerva 10k"></label>
      <label>Cieľová suma (€) <input name="target" type="number" step="1" min="1" required></label>
      <label><input type="checkbox" name="tracknw" style="width:auto;margin-right:8px">Automaticky sledovať net worth</label>
      <label>Aktuálne nasporené (€) <input name="current" type="number" step="0.01" value="0"></label>
      <label>Termín <input name="deadline" type="date"></label>
      <div class="modal-actions">
        <button type="button" class="btn" onclick="closeModal()">Zrušiť</button>
        <button type="submit" class="btn btn-primary">Uložiť</button>
      </div>
    </form>`);
  $('#f-fg').onsubmit = async e => {
    e.preventDefault();
    const f = new FormData(e.target);
    await guard(sb.from('finance_goals').insert({
      user_id: S.user.id, name: f.get('name'), target_amount: Number(f.get('target')),
      current_amount: Number(f.get('current') || 0), track_networth: !!f.get('tracknw'),
      deadline: f.get('deadline') || null
    }), 'Cieľ pridaný');
    closeModal(); await refresh();
  };
};
window.openFinGoalUpdate = id => {
  const g = S.financeGoals.find(x => x.id === id);
  openModal(`<h3>${esc(g.name)}</h3>
    <form id="f-fgu">
      <label>Aktuálne nasporené (€) <input name="current" type="number" step="0.01" value="${Number(g.current_amount)}" required autofocus></label>
      <div class="modal-actions">
        <button type="button" class="btn" onclick="closeModal()">Zrušiť</button>
        <button type="submit" class="btn btn-primary">Uložiť</button>
      </div>
    </form>`);
  $('#f-fgu').onsubmit = async e => {
    e.preventDefault();
    const cur = Number(new FormData(e.target).get('current'));
    await guard(sb.from('finance_goals').update({ current_amount: cur, done: cur >= Number(g.target_amount) }).eq('id', id), 'Uložené');
    closeModal(); await refresh();
  };
};
window.deleteFinGoal = async id => {
  if (!confirm('Zmazať cieľ?')) return;
  await guard(sb.from('finance_goals').delete().eq('id', id), 'Zmazané');
  await refresh();
};

/* ── LIFE (habits + goals) ── */
function renderLife() {
  const el = $('#view-life');
  const today = todayISO();
  el.innerHTML = `
    <div class="card">
      <div class="card-head"><span class="card-title">Dnešné úlohy</span>
        <button class="btn btn-sm btn-primary" onclick="openTaskModal()">+ Úloha</button></div>
      <div id="life-tasks"></div>
      <div id="life-tasks-upcoming"></div>
    </div>
    <div class="card">
      <div class="card-head"><span class="card-title">Denné pravidlá</span>
        <button class="btn btn-sm btn-primary" onclick="openHabitModal()">+ Pravidlo</button></div>
      <div id="life-habits">${S.habits.length ? '' : '<p class="muted small">Pravidlá, ktoré chceš dodržiavať každý deň — napr. „Max 2 obchody“, „Tréning“, „Bez alkoholu“. Streak ukazuje, koľko dní po sebe ich držíš.</p>'}</div>
    </div>
    <div class="card">
      <div class="card-head"><span class="card-title">Posledných 7 dní</span></div>
      <div id="life-week"></div>
    </div>
    <div class="card">
      <div class="card-head"><span class="card-title">Ciele</span>
        <button class="btn btn-sm btn-primary" onclick="openGoalModal()">+ Cieľ</button></div>
      <div id="life-goals"></div>
    </div>`;

  renderTaskList($('#life-tasks'), true);
  if (S.tasksReady) {
    const upcoming = S.tasks.filter(t => t.kind === 'once' && t.date && t.date > today && !t.done)
      .sort((a, b) => a.date.localeCompare(b.date)).slice(0, 10);
    const otherDays = S.tasks.filter(t => t.kind === 'recurring' && !(t.weekdays || []).includes(isoWeekday(today)));
    let html = '';
    if (upcoming.length) html += '<p class="small muted" style="margin:14px 0 2px">Naplánované</p>' +
      upcoming.map(t => `<div class="row"><div class="row-main"><div class="row-title">${esc(t.title)}</div>
        <div class="row-sub">${fmtDate(t.date)}${t.time ? ' · ' + t.time : ''}</div></div>
        <button class="icon-btn" onclick="deleteTask('${t.id}')" title="Zmazať">✕</button></div>`).join('');
    if (otherDays.length) html += '<p class="small muted" style="margin:14px 0 2px">Opakované (iné dni)</p>' +
      otherDays.map(t => `<div class="row"><div class="row-main"><div class="row-title">${esc(t.title)}</div>
        <div class="row-sub">${(t.weekdays || []).map(d => DAYS_SK[d - 1]).join(' ')}${t.time ? ' · ' + t.time : ''}</div></div>
        <button class="icon-btn" onclick="deleteTask('${t.id}')" title="Zmazať">✕</button></div>`).join('');
    $('#life-tasks-upcoming').innerHTML = html;
  }

  if (S.habits.length) {
    $('#life-habits').innerHTML = S.habits.map(h => {
      const done = S.habitLogs.some(l => l.habit_id === h.id && l.date === today);
      const st = habitStreak(h.id);
      return `<div class="habit-row">
        <button class="habit-check ${done ? 'done' : ''}" onclick="toggleHabit('${h.id}')">✓</button>
        <span class="habit-name ${done ? 'done' : ''}">${h.emoji ? esc(h.emoji) + ' ' : ''}${esc(h.name)}</span>
        <span class="habit-streak">${st > 0 ? '🔥 ' + st + ' d' : ''}</span>
        <button class="icon-btn" onclick="archiveHabit('${h.id}')" title="Odstrániť">✕</button>
      </div>`;
    }).join('');

    const days = [];
    for (let i = 6; i >= 0; i--) days.push(addDays(today, -i));
    $('#life-week').innerHTML = S.habits.map(h => {
      const set = new Set(S.habitLogs.filter(l => l.habit_id === h.id).map(l => l.date));
      return `<div class="row">
        <div class="row-main"><div class="row-title">${esc(h.name)}</div></div>
        <div class="week-dots">${days.map(d => `<span class="week-dot ${set.has(d) ? 'on' : ''}" title="${fmtDate(d)}"></span>`).join('')}</div>
      </div>`;
    }).join('');
  } else {
    $('#life-week').innerHTML = '<p class="muted small">—</p>';
  }

  const goals = S.goals.filter(g => g.status !== 'done');
  const doneGoals = S.goals.filter(g => g.status === 'done');
  $('#life-goals').innerHTML = (goals.length || doneGoals.length) ? goals.map(goalCard).join('') +
    (doneGoals.length ? `<p class="muted small mt">Splnené: ${doneGoals.map(g => esc(g.title)).join(', ')}</p>` : '')
    : '<p class="muted small">Dlhodobé ciele rozbité na kroky — napr. „Funded účet“, „Schudnúť 5 kg“.</p>';
}

function goalCard(g) {
  const steps = S.goalSteps.filter(s => s.goal_id === g.id);
  const pct = goalProgress(g);
  return `<div class="row" style="display:block">
    <div style="display:flex;justify-content:space-between;align-items:center;gap:8px">
      <div class="row-title">${esc(g.title)}</div>
      <div style="display:flex;gap:4px">
        <button class="btn btn-sm" onclick="addStep('${g.id}')">+ Krok</button>
        <button class="btn btn-sm" onclick="markGoalDone('${g.id}')" title="Označiť ako splnený">✓</button>
        <button class="icon-btn" onclick="deleteGoal('${g.id}')" title="Zmazať">✕</button>
      </div>
    </div>
    ${g.description ? `<div class="row-sub">${esc(g.description)}</div>` : ''}
    <div class="progress"><div style="width:${pct}%" class="${pct >= 100 ? 'full' : ''}"></div></div>
    <div class="row-sub" style="margin-top:5px">${pct}%${g.deadline ? ' · do ' + fmtDate(g.deadline) : ''}</div>
    ${steps.map(s => `<div class="step-row">
      <button class="step-check ${s.done ? 'done' : ''}" onclick="toggleStep('${s.id}', ${!s.done})">✓</button>
      <span class="step-title ${s.done ? 'done' : ''}">${esc(s.title)}</span>
    </div>`).join('')}
  </div>`;
}

window.toggleHabit = async habitId => {
  const today = todayISO();
  const log = S.habitLogs.find(l => l.habit_id === habitId && l.date === today);
  if (log) await guard(sb.from('habit_logs').delete().eq('id', log.id));
  else await guard(sb.from('habit_logs').insert({ user_id: S.user.id, habit_id: habitId, date: today }));
  await refresh();
};
window.openHabitModal = () => {
  openModal(`<h3>Nové pravidlo</h3>
    <form id="f-hab">
      <label>Názov <input name="name" required placeholder="napr. Max 2 obchody denne" autofocus></label>
      <label>Emoji <input name="emoji" placeholder="voliteľné, napr. 📈" maxlength="4"></label>
      <div class="modal-actions">
        <button type="button" class="btn" onclick="closeModal()">Zrušiť</button>
        <button type="submit" class="btn btn-primary">Uložiť</button>
      </div>
    </form>`);
  $('#f-hab').onsubmit = async e => {
    e.preventDefault();
    const f = new FormData(e.target);
    await guard(sb.from('habits').insert({
      user_id: S.user.id, name: f.get('name'), emoji: f.get('emoji') || null, sort_order: S.habits.length
    }), 'Pravidlo pridané');
    closeModal(); await refresh();
  };
};
window.archiveHabit = async id => {
  if (!confirm('Odstrániť pravidlo? (história ostane v databáze)')) return;
  await guard(sb.from('habits').update({ active: false }).eq('id', id), 'Odstránené');
  await refresh();
};

window.openGoalModal = () => {
  openModal(`<h3>Nový cieľ</h3>
    <form id="f-goal">
      <label>Názov <input name="title" required autofocus></label>
      <label>Popis <input name="description" placeholder="voliteľné"></label>
      <label>Termín <input name="deadline" type="date"></label>
      <div class="modal-actions">
        <button type="button" class="btn" onclick="closeModal()">Zrušiť</button>
        <button type="submit" class="btn btn-primary">Uložiť</button>
      </div>
    </form>`);
  $('#f-goal').onsubmit = async e => {
    e.preventDefault();
    const f = new FormData(e.target);
    await guard(sb.from('goals').insert({
      user_id: S.user.id, title: f.get('title'), description: f.get('description') || null, deadline: f.get('deadline') || null
    }), 'Cieľ pridaný');
    closeModal(); await refresh();
  };
};
window.addStep = async goalId => {
  const title = prompt('Názov kroku:');
  if (!title) return;
  const count = S.goalSteps.filter(s => s.goal_id === goalId).length;
  await guard(sb.from('goal_steps').insert({ user_id: S.user.id, goal_id: goalId, title, sort_order: count }), 'Krok pridaný');
  await refresh();
};
window.toggleStep = async (stepId, done) => {
  await guard(sb.from('goal_steps').update({ done }).eq('id', stepId));
  await refresh();
};
window.markGoalDone = async id => {
  await guard(sb.from('goals').update({ status: 'done' }).eq('id', id), 'Gratulujem! 🎉');
  await refresh();
};
window.deleteGoal = async id => {
  if (!confirm('Zmazať cieľ aj jeho kroky?')) return;
  await guard(sb.from('goals').delete().eq('id', id), 'Zmazané');
  await refresh();
};

/* ── JOURNAL ── */
function renderJournal() {
  const el = $('#view-journal');
  const today = todayISO();
  const entry = S.journal.find(j => j.date === today);
  el.innerHTML = `
    <div class="card">
      <div class="card-head"><span class="card-title">Dnešný zápis — ${fmtDate(today)}</span></div>
      <p class="small muted" style="margin-bottom:8px">Ako hodnotíš dnešný deň?</p>
      <div class="stars" id="j-stars">${[1, 2, 3, 4, 5].map(i =>
        `<button class="star ${entry && entry.rating >= i ? 'on' : ''}" data-r="${i}">★</button>`).join('')}</div>
      <textarea id="j-text" class="mt" placeholder="Čo sa dnes podarilo? Čo zlepšíš zajtra?">${entry ? esc(entry.entry || '') : ''}</textarea>
      <button class="btn btn-primary mt" id="j-save">Uložiť zápis</button>
    </div>
    <div class="card">
      <div class="card-head"><span class="card-title">História</span></div>
      ${S.journal.filter(j => j.date !== today).slice(0, 30).map(j => `<div class="row">
        <div class="row-main">
          <div class="row-title">${fmtDate(j.date)} <span style="color:var(--warn)">${'★'.repeat(j.rating || 0)}</span></div>
          ${j.entry ? `<div class="row-sub" style="white-space:pre-wrap">${esc(j.entry)}</div>` : ''}
        </div>
      </div>`).join('') || '<p class="muted small">Zatiaľ žiadne zápisy.</p>'}
    </div>`;

  let rating = entry ? entry.rating : 0;
  $$('#j-stars .star').forEach(s => s.addEventListener('click', () => {
    rating = Number(s.dataset.r);
    $$('#j-stars .star').forEach(x => x.classList.toggle('on', Number(x.dataset.r) <= rating));
  }));
  $('#j-save').addEventListener('click', async () => {
    await guard(sb.from('journal').upsert({
      user_id: S.user.id, date: today, rating: rating || null, entry: $('#j-text').value || null
    }, { onConflict: 'user_id,date' }), 'Zápis uložený');
    await refresh();
  });
}

/* ── FITNESS ── */
function renderFitness() {
  const el = $('#view-fitness');
  const weights = S.fitness.filter(f => f.weight != null).sort((a, b) => a.date.localeCompare(b.date));
  const latest = weights.length ? weights[weights.length - 1] : null;
  const first = weights.length ? weights[0] : null;
  const workouts = S.fitness.filter(f => f.workout);
  const weekAgo = addDays(todayISO(), -7);
  const weekWorkouts = workouts.filter(w => w.date >= weekAgo).length;

  el.innerHTML = `
    <div class="tiles t3">
      <div class="tile"><div class="tile-label">Váha</div>
        <div class="tile-value">${latest ? Number(latest.weight).toFixed(1) + ' kg' : '—'}</div>
        ${latest && first && latest !== first ? `<div class="tile-delta ${Number(latest.weight) <= Number(first.weight) ? 'pos' : 'neg'}">${(Number(latest.weight) - Number(first.weight) > 0 ? '+' : '')}${(Number(latest.weight) - Number(first.weight)).toFixed(1)} kg celkovo</div>` : ''}</div>
      <div class="tile"><div class="tile-label">Tréningy / 7 dní</div><div class="tile-value">${weekWorkouts}</div></div>
      <div class="tile"><div class="tile-label">Spolu tréningov</div><div class="tile-value">${workouts.length}</div></div>
    </div>
    <div class="card">
      <div class="card-head"><span class="card-title">Vývoj váhy</span>
        <button class="btn btn-sm btn-primary" onclick="openWeightModal()">+ Váha</button></div>
      <div class="chart-wrap" id="w-chart"></div>
    </div>
    <div class="card">
      <div class="card-head"><span class="card-title">Tréningy</span>
        <button class="btn btn-sm btn-primary" onclick="openWorkoutModal()">+ Tréning</button></div>
      ${workouts.slice(0, 15).map(w => `<div class="row">
        <div class="row-main">
          <div class="row-title">${esc(w.workout)}${w.duration_min ? ' · ' + w.duration_min + ' min' : ''}</div>
          <div class="row-sub">${fmtDate(w.date)}${w.note ? ' · ' + esc(w.note) : ''}</div>
        </div>
        <button class="icon-btn" onclick="deleteFitness('${w.id}')" title="Zmazať">✕</button>
      </div>`).join('') || '<p class="muted small">Zapíš si tréningy — nech vidíš konzistenciu.</p>'}
    </div>`;

  const pts = weights.slice(-40).map(w => ({ label: fmtDateShort(w.date), tipLabel: fmtDate(w.date), value: Number(w.weight) }));
  lineChart($('#w-chart'), pts, { color: C.aqua, fmt: v => v.toFixed(1) + ' kg', empty: 'Zapíš aspoň dve váženia.' });
}

window.openWeightModal = () => {
  openModal(`<h3>Zapísať váhu</h3>
    <form id="f-w">
      <label>Dátum <input name="date" type="date" value="${todayISO()}" required></label>
      <label>Váha (kg) <input name="weight" type="number" step="0.1" min="20" max="300" required autofocus></label>
      <div class="modal-actions">
        <button type="button" class="btn" onclick="closeModal()">Zrušiť</button>
        <button type="submit" class="btn btn-primary">Uložiť</button>
      </div>
    </form>`);
  $('#f-w').onsubmit = async e => {
    e.preventDefault();
    const f = new FormData(e.target);
    await guard(sb.from('fitness_logs').insert({
      user_id: S.user.id, date: f.get('date'), weight: Number(f.get('weight'))
    }), 'Váha zapísaná');
    closeModal(); await refresh();
  };
};
window.openWorkoutModal = () => {
  openModal(`<h3>Zapísať tréning</h3>
    <form id="f-wo">
      <label>Typ <input name="workout" required placeholder="napr. Sila — vrch tela" autofocus></label>
      <label>Trvanie (min) <input name="duration" type="number" min="1"></label>
      <label>Dátum <input name="date" type="date" value="${todayISO()}" required></label>
      <label>Poznámka <input name="note" placeholder="voliteľné"></label>
      <div class="modal-actions">
        <button type="button" class="btn" onclick="closeModal()">Zrušiť</button>
        <button type="submit" class="btn btn-primary">Uložiť</button>
      </div>
    </form>`);
  $('#f-wo').onsubmit = async e => {
    e.preventDefault();
    const f = new FormData(e.target);
    await guard(sb.from('fitness_logs').insert({
      user_id: S.user.id, date: f.get('date'), workout: f.get('workout'),
      duration_min: f.get('duration') ? Number(f.get('duration')) : null, note: f.get('note') || null
    }), 'Tréning zapísaný');
    closeModal(); await refresh();
  };
};
window.deleteFitness = async id => {
  if (!confirm('Zmazať záznam?')) return;
  await guard(sb.from('fitness_logs').delete().eq('id', id), 'Zmazané');
  await refresh();
};

window.showView = showView;
window.closeModal = closeModal;

/* ══ AUTH ══ */
let authMode = 'login';
$('#auth-toggle').addEventListener('click', () => {
  authMode = authMode === 'login' ? 'signup' : 'login';
  $('#auth-submit').textContent = authMode === 'login' ? 'Prihlásiť sa' : 'Vytvoriť účet';
  $('#auth-toggle').textContent = authMode === 'login' ? 'Nemám účet — registrovať' : 'Už mám účet — prihlásiť';
  $('#auth-msg').textContent = '';
});
$('#auth-form').addEventListener('submit', async e => {
  e.preventDefault();
  const email = $('#auth-email').value.trim(), password = $('#auth-pass').value;
  const msg = $('#auth-msg');
  msg.classList.remove('ok');
  msg.textContent = 'Moment…';
  const { data, error } = authMode === 'login'
    ? await sb.auth.signInWithPassword({ email, password })
    : await sb.auth.signUp({ email, password });
  if (error) { msg.textContent = error.message; return; }
  if (authMode === 'signup' && data.user && !data.session) {
    msg.classList.add('ok');
    msg.textContent = 'Účet vytvorený! Skontroluj si e-mail a potvrď registráciu, potom sa prihlás.';
    return;
  }
  msg.textContent = '';
});

$('#logout-btn').addEventListener('click', async () => {
  if (!confirm('Odhlásiť sa?')) return;
  await sb.auth.signOut();
});

async function boot(session) {
  if (!session) {
    $('#auth-screen').classList.remove('hidden');
    $('#app').classList.add('hidden');
    return;
  }
  S.user = session.user;
  $('#auth-screen').classList.add('hidden');
  $('#app').classList.remove('hidden');
  const d = new Date();
  $('#today-label').textContent = d.getDate() + '. ' + MONTHS_SK[d.getMonth()].toLowerCase() + ' ' + d.getFullYear();
  $('#view-' + currentView).innerHTML = '<div class="loading">Načítavam…</div>';
  await loadAll();
  render();
}

sb.auth.onAuthStateChange((event, session) => {
  if (event === 'INITIAL_SESSION' || event === 'TOKEN_REFRESHED') return;
  if (event === 'SIGNED_IN' && S.user && session && S.user.id === session.user.id) return;
  boot(session);
});
sb.auth.getSession().then(({ data }) => boot(data.session));

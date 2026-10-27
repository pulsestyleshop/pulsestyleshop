/* =========================================================
   MortgagePro — Calculator Logic
   Tip: change CURRENCY / LOCALE below to adapt to your market.
   ========================================================= */
const CURRENCY = 'USD';   // e.g. 'INR', 'PKR', 'EUR', 'GBP'
const LOCALE   = 'en-US'; // e.g. 'en-IN', 'en-PK', 'de-DE'

const fmt = new Intl.NumberFormat(LOCALE, {
  style: 'currency',
  currency: CURRENCY,
  maximumFractionDigits: 0
});

/* ---------- Element references ---------- */
const $ = (id) => document.getElementById(id);

const homePriceEl = $('homePrice');
const dpEl        = $('downPayment');
const dpPctEl     = $('downPaymentPct');
const termEl      = $('loanTerm');
const rateEl      = $('interestRate');
const taxEl       = $('propertyTax');
const insEl       = $('homeInsurance');
const hoaEl       = $('hoa');

const monthlyPaymentEl = $('monthlyPayment');
const chartTotalEl     = $('chartTotal');
const breakdownEl      = $('breakdown');
const loanAmountEl     = $('loanAmount');
const totalInterestEl  = $('totalInterest');
const totalCostEl      = $('totalCost');

const amortToggle = $('amortToggle');
const amortWrap   = $('amortWrap');
const amortBody   = $('amortBody');

/* ---------- Helpers ---------- */
function num(el) {
  const v = parseFloat(el.value);
  return Number.isFinite(v) ? v : 0;
}

const COLORS = {
  pi:  '#2563eb',
  tax: '#f59e0b',
  ins: '#10b981',
  hoa: '#8b5cf6'
};

/* ---------- Core calculation ---------- */
function calculate() {
  const homePrice = Math.max(0, num(homePriceEl));
  let downPayment = Math.max(0, num(dpEl));
  if (downPayment > homePrice) downPayment = homePrice;

  const termYears  = Math.max(1, num(termEl));
  const rate       = Math.max(0, num(rateEl));
  const taxAnnual  = Math.max(0, num(taxEl));
  const insAnnual  = Math.max(0, num(insEl));
  const hoaMonthly = Math.max(0, num(hoaEl));

  const principal   = Math.max(0, homePrice - downPayment);
  const monthlyRate = rate / 100 / 12;
  const n           = termYears * 12;

  let pi = 0;
  if (principal > 0 && n > 0) {
    if (monthlyRate === 0) {
      pi = principal / n;
    } else {
      const pow = Math.pow(1 + monthlyRate, n);
      pi = principal * (monthlyRate * pow) / (pow - 1);
    }
  }

  const monthlyTax = taxAnnual / 12;
  const monthlyIns = insAnnual / 12;
  const totalMonthly = pi + monthlyTax + monthlyIns + hoaMonthly;

  const totalInterest = Math.max(0, pi * n - principal);
  const totalCost = totalMonthly * n;

  /* ---------- Update UI ---------- */
  monthlyPaymentEl.textContent = fmt.format(totalMonthly);
  chartTotalEl.textContent     = fmt.format(totalMonthly);
  loanAmountEl.textContent     = fmt.format(principal);
  totalInterestEl.textContent  = fmt.format(totalInterest);
  totalCostEl.textContent      = fmt.format(totalCost);

  const parts = [
    { label: 'Principal & Interest', value: pi,          color: COLORS.pi },
    { label: 'Property Tax',         value: monthlyTax,  color: COLORS.tax },
    { label: 'Home Insurance',       value: monthlyIns,  color: COLORS.ins },
    { label: 'HOA Fees',             value: hoaMonthly,  color: COLORS.hoa }
  ];

  breakdownEl.innerHTML = parts.map(p => `
    <li>
      <span class="bd-label">
        <span class="dot" style="background:${p.color}"></span>
        ${p.label}
      </span>
      <span class="bd-value">${fmt.format(p.value)}</span>
    </li>
  `).join('');

  drawChart(parts);
  renderAmortization(principal, rate, n, pi);
  return { principal, rate, n, pi };
}

/* ---------- Donut Chart ---------- */
function drawChart(segments) {
  const canvas = $('chart');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const dpr = window.devicePixelRatio || 1;
  const rect = canvas.getBoundingClientRect();
  const size = Math.min(rect.width, rect.height);
  if (size < 10) return;

  canvas.width  = Math.round(size * dpr);
  canvas.height = Math.round(size * dpr);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, size, size);

  const total = segments.reduce((s, x) => s + x.value, 0);
  const cx = size / 2;
  const cy = size / 2;
  const radius = size / 2 - 14;
  const lineWidth = 26;

  // Background ring
  ctx.beginPath();
  ctx.arc(cx, cy, radius, 0, Math.PI * 2);
  ctx.strokeStyle = '#f1f5f9';
  ctx.lineWidth = lineWidth;
  ctx.stroke();

  if (total <= 0) return;

  let start = -Math.PI / 2;
  segments.forEach((seg) => {
    if (seg.value <= 0) return;
    const angle = (seg.value / total) * Math.PI * 2;
    ctx.beginPath();
    ctx.arc(cx, cy, radius, start, start + angle);
    ctx.strokeStyle = seg.color;
    ctx.lineWidth = lineWidth;
    ctx.lineCap = 'butt';
    ctx.stroke();
    start += angle;
  });
}

/* ---------- Amortization ---------- */
function renderAmortization(principal, rate, n, pi) {
  if (!amortBody) return;
  const monthlyRate = rate / 100 / 12;
  const years = Math.ceil(n / 12);
  let balance = principal;
  const rows = [];

  for (let y = 1; y <= years; y++) {
    let yearInterest = 0;
    let yearPrincipal = 0;
    const monthsThisYear = Math.min(12, n - (y - 1) * 12);

    for (let m = 0; m < monthsThisYear; m++) {
      const interest = balance * monthlyRate;
      let princ = pi - interest;
      if (princ > balance) princ = balance;
      if (princ < 0) princ = 0;
      balance -= princ;
      yearInterest  += interest;
      yearPrincipal += princ;
    }

    rows.push({
      year: y,
      interest: yearInterest,
      principal: yearPrincipal,
      balance: Math.max(0, balance)
    });
  }

  amortBody.innerHTML = rows.map(r => `
    <tr>
      <td>${r.year}</td>
      <td>${fmt.format(r.principal)}</td>
      <td>${fmt.format(r.interest)}</td>
      <td>${fmt.format(r.balance)}</td>
    </tr>
  `).join('');
}

/* ---------- Down Payment sync ---------- */
function syncFromAmount() {
  const price = Math.max(0, num(homePriceEl));
  const dp = Math.max(0, num(dpEl));
  dpPctEl.value = price > 0 ? ((dp / price) * 100).toFixed(1) : '0';
}

function syncFromPercent() {
  const price = Math.max(0, num(homePriceEl));
  const pct = Math.max(0, Math.min(100, num(dpPctEl)));
  dpEl.value = Math.round(price * pct / 100);
}

/* ---------- Event wiring ---------- */
function init() {
  const yearEl = $('year');
  if (yearEl) yearEl.textContent = new Date().getFullYear();

  if (!homePriceEl) return; // Not on calculator page

  // Down payment sync
  homePriceEl.addEventListener('input', () => { syncFromPercent(); calculate(); });
  dpEl.addEventListener('input', () => { syncFromAmount(); calculate(); });
  dpPctEl.addEventListener('input', () => { syncFromPercent(); calculate(); });

  // Other inputs
  [termEl, rateEl, taxEl, insEl, hoaEl].forEach(el => {
    if (el) el.addEventListener('input', calculate);
    if (el) el.addEventListener('change', calculate);
  });

  // Amortization toggle
  if (amortToggle && amortWrap) {
    amortToggle.addEventListener('click', () => {
      const open = amortWrap.hasAttribute('hidden');
      if (open) amortWrap.removeAttribute('hidden');
      else amortWrap.setAttribute('hidden', '');
      amortToggle.setAttribute('aria-expanded', String(open));
      amortToggle.textContent = open ? 'Hide Amortization Schedule' : 'Show Amortization Schedule';
    });
  }

  // Redraw chart on resize
  let resizeTimer;
  window.addEventListener('resize', () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(calculate, 150);
  });

  calculate();
}

/* ---------- Mobile nav ---------- */
function initNav() {
  const navToggle = $('navToggle');
  const nav = $('nav');
  if (!navToggle || !nav) return;

  navToggle.addEventListener('click', () => {
    const open = nav.classList.toggle('open');
    navToggle.setAttribute('aria-expanded', String(open));
  });

  nav.querySelectorAll('a').forEach(a => {
    a.addEventListener('click', () => {
      nav.classList.remove('open');
      navToggle.setAttribute('aria-expanded', 'false');
    });
  });
}

/* ---------- Boot ---------- */
document.addEventListener('DOMContentLoaded', () => {
  initNav();
  init();
});

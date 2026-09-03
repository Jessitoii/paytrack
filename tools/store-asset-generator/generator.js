const SCREEN_DATA = [
  {
    id: '01-dashboard',
    name: 'Dashboard (Live Working & Overview)',
    headline: 'Real-Time Pay & Hours',
    subtitle: 'Track your live shift, weekly hours, and estimated take-home pay.',
    imageSrc: '../../docs/screenshots/01-dashboard.png'
  },
  {
    id: '02-salary',
    name: 'Payroll Engine (Gross-to-Net Breakdown)',
    headline: 'Deterministic Dutch Payroll',
    subtitle: 'Automatic gross-to-net calculation with ADV, holiday pay & taxes.',
    imageSrc: '../../docs/screenshots/02-salary.png'
  },
  {
    id: '03-work',
    name: 'Work & Sessions (1-Tap Clock In / Out)',
    headline: 'One-Tap Work & Break Tracking',
    subtitle: 'Automatic clock-in adjustments and 15-minute payroll rounding.',
    imageSrc: '../../docs/screenshots/03-work.png'
  },
  {
    id: '04-payslips',
    name: 'Payslip Audit (OCR & Variance Check)',
    headline: 'Payslip Ingestion & Audit',
    subtitle: 'Scan official PDF payslips and reconcile against actual logged hours.',
    imageSrc: '../../docs/screenshots/04-payslips.png'
  },
  {
    id: '05-finance',
    name: 'Personal Finance (Cash Flow & Goals)',
    headline: 'Cash Flow & Savings Goals',
    subtitle: 'Manage monthly income, fixed bills, variable spend, and savings targets.',
    imageSrc: '../../docs/screenshots/05-finance.png'
  },
  {
    id: '06-simulator',
    name: 'Shift Simulator (What-If Modeling)',
    headline: 'Interactive Shift Simulator',
    subtitle: 'Simulate extra shifts, overtime rates, and forecast net take-home pay.',
    imageSrc: '../../docs/screenshots/06-simulator.png'
  }
];

const screenSelect = document.getElementById('screenSelect');
const headlineInput = document.getElementById('headlineInput');
const subtitleInput = document.getElementById('subtitleInput');
const brandInput = document.getElementById('brandInput');

const previewTag = document.getElementById('previewTag');
const previewHeadline = document.getElementById('previewHeadline');
const previewSubtitle = document.getElementById('previewSubtitle');
const previewImg = document.getElementById('previewImg');

// Populate select
SCREEN_DATA.forEach((s, idx) => {
  const opt = document.createElement('option');
  opt.value = idx;
  opt.textContent = s.name;
  screenSelect.appendChild(opt);
});

function updatePreview() {
  const current = SCREEN_DATA[screenSelect.value];
  previewHeadline.textContent = headlineInput.value;
  previewSubtitle.textContent = subtitleInput.value;
  previewTag.textContent = brandInput.value;
  previewImg.src = current.imageSrc;
}

screenSelect.addEventListener('change', () => {
  const current = SCREEN_DATA[screenSelect.value];
  headlineInput.value = current.headline;
  subtitleInput.value = current.subtitle;
  updatePreview();
});

headlineInput.addEventListener('input', updatePreview);
subtitleInput.addEventListener('input', updatePreview);
brandInput.addEventListener('input', updatePreview);

// Init
screenSelect.value = 0;
headlineInput.value = SCREEN_DATA[0].headline;
subtitleInput.value = SCREEN_DATA[0].subtitle;
updatePreview();

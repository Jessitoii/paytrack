export interface ScreenDefinition {
  id: string;
  title: string;
  subtitle: string;
  tabActive: string;
  htmlBody: string;
  storeHeadline: string;
  storeSubtitle: string;
}

const COMMON_CSS = `
  * {
    box-sizing: border-box;
    margin: 0;
    padding: 0;
    -webkit-font-smoothing: antialiased;
  }
  body {
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
    background-color: #0B1120;
    color: #F8FAFC;
    width: 412px;
    height: 915px;
    overflow: hidden;
    display: flex;
    flex-direction: column;
    position: relative;
    user-select: none;
  }
  .status-bar {
    height: 44px;
    padding: 0 20px;
    display: flex;
    justify-content: space-between;
    align-items: center;
    font-size: 13px;
    font-weight: 600;
    color: #94A3B8;
    z-index: 10;
  }
  .status-icons {
    display: flex;
    align-items: center;
    gap: 6px;
  }
  .app-header {
    padding: 8px 20px 14px 20px;
    display: flex;
    justify-content: space-between;
    align-items: center;
    border-bottom: 1px solid #1E293B;
  }
  .app-brand-title {
    font-size: 20px;
    font-weight: 800;
    letter-spacing: -0.5px;
    color: #F8FAFC;
    display: flex;
    align-items: center;
    gap: 8px;
  }
  .brand-badge {
    background: rgba(16, 185, 129, 0.15);
    color: #10B981;
    font-size: 11px;
    font-weight: 700;
    padding: 2px 8px;
    border-radius: 999px;
    border: 1px solid rgba(16, 185, 129, 0.3);
  }
  .header-sub {
    font-size: 11px;
    color: #94A3B8;
    margin-top: 2px;
  }
  .header-action {
    width: 36px;
    height: 36px;
    border-radius: 10px;
    background: #131C31;
    border: 1px solid #1E293B;
    display: flex;
    align-items: center;
    justify-content: center;
    color: #94A3B8;
  }
  .screen-content {
    flex: 1;
    overflow-y: hidden;
    padding: 16px 20px;
    display: flex;
    flex-direction: column;
    gap: 14px;
  }
  .card {
    background: #131C31;
    border: 1px solid #1E293B;
    border-radius: 16px;
    padding: 16px;
  }
  .card-highlight {
    background: linear-gradient(135deg, rgba(16, 185, 129, 0.08) 0%, rgba(19, 28, 49, 1) 100%);
    border: 1px solid rgba(16, 185, 129, 0.25);
  }
  .tab-bar {
    height: 72px;
    background: #131C31;
    border-top: 1px solid #1E293B;
    display: flex;
    justify-content: space-around;
    align-items: center;
    padding-bottom: 8px;
    z-index: 10;
  }
  .tab-item {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 4px;
    color: #64748B;
    font-size: 10px;
    font-weight: 700;
  }
  .tab-item.active {
    color: #10B981;
  }
  .icon-svg {
    width: 20px;
    height: 20px;
    stroke: currentColor;
    stroke-width: 2;
    fill: none;
    stroke-linecap: round;
    stroke-linejoin: round;
  }
  .pill {
    font-size: 11px;
    font-weight: 700;
    padding: 3px 8px;
    border-radius: 6px;
    display: inline-flex;
    align-items: center;
    gap: 4px;
  }
  .pill-emerald {
    background: rgba(16, 185, 129, 0.15);
    color: #10B981;
  }
  .pill-indigo {
    background: rgba(129, 140, 248, 0.15);
    color: #818CF8;
  }
  .pill-amber {
    background: rgba(251, 191, 36, 0.15);
    color: #FBBF24;
  }
  .pill-slate {
    background: rgba(148, 163, 184, 0.12);
    color: #94A3B8;
  }
`;

function renderTabBar(activeTab: string): string {
  const tabs = [
    { id: 'dashboard', label: 'Dashboard', icon: '<rect width="7" height="9" x="3" y="3" rx="1"/><rect width="7" height="5" x="14" y="3" rx="1"/><rect width="7" height="9" x="14" y="12" rx="1"/><rect width="7" height="5" x="3" y="16" rx="1"/>' },
    { id: 'work', label: 'Work', icon: '<circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>' },
    { id: 'shifts', label: 'Shifts', icon: '<rect width="18" height="18" x="3" y="4" rx="2"/><line x1="16" x2="16" y1="2" y2="6"/><line x1="8" x2="8" y1="2" y2="6"/><line x1="3" x2="21" y1="10" y2="10"/>' },
    { id: 'payslips', label: 'Payslips', icon: '<path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z"/><path d="M14 2v4a2 2 0 0 0 2 2h4"/><path d="M10 9H8"/><path d="M16 13H8"/><path d="M16 17H8"/>' },
    { id: 'finance', label: 'Finance', icon: '<path d="M19 7V4a1 1 0 0 0-1-1H5a2 2 0 0 0 0 4h15a1 1 0 0 1 1 1v4h-3a2 2 0 0 0 0 4h3a1 1 0 0 0 1-1v-2a1 1 0 0 0-1-1"/><path d="M3 5v14a2 2 0 0 0 2 2h15a1 1 0 0 0 1-1v-4"/>' },
    { id: 'settings', label: 'Settings', icon: '<path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/><circle cx="12" cy="12" r="3"/>' },
  ];

  return `
    <nav class="tab-bar">
      ${tabs
        .map(
          (t) => `
        <div class="tab-item ${t.id === activeTab ? 'active' : ''}">
          <svg class="icon-svg" viewBox="0 0 24 24">${t.icon}</svg>
          <span>${t.label}</span>
        </div>
      `
        )
        .join('')}
    </nav>
  `;
}

export const SCREENS: ScreenDefinition[] = [
  // 1. DASHBOARD
  {
    id: '01-dashboard',
    title: 'Dashboard',
    subtitle: 'Albert Heijn Bleiswijk • Order Picker',
    tabActive: 'dashboard',
    storeHeadline: 'Real-Time Pay & Hours',
    storeSubtitle: 'Track your live shift, weekly hours, and estimated take-home pay.',
    htmlBody: `
      <!-- Active Work Session Card -->
      <div class="card card-highlight">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:10px;">
          <div style="display:flex; align-items:center; gap:8px;">
            <div style="width:8px; height:8px; border-radius:50%; background:#10B981; box-shadow:0 0 10px #10B981;"></div>
            <span style="font-size:12px; font-weight:700; color:#10B981; letter-spacing:0.5px;">ON THE CLOCK</span>
          </div>
          <span class="pill pill-indigo">Afternoon Shift</span>
        </div>
        <div style="display:flex; justify-content:space-between; align-items:flex-end;">
          <div>
            <div style="font-size:12px; color:#94A3B8;">Started at 14:15 (Adjusted: 14:30)</div>
            <div style="font-size:28px; font-weight:800; color:#F8FAFC; margin-top:2px;">06h 45m <span style="font-size:14px; font-weight:500; color:#94A3B8;">elapsed</span></div>
          </div>
          <div style="text-align:right;">
            <div style="font-size:11px; color:#94A3B8;">Paid Time</div>
            <div style="font-size:18px; font-weight:700; color:#38BDF8;">6h 15m</div>
          </div>
        </div>
        <div style="margin-top:12px; padding-top:10px; border-top:1px solid rgba(255,255,255,0.08); display:flex; justify-content:space-between; align-items:center;">
          <span style="font-size:11px; color:#94A3B8;">30m Unpaid Meal Break deducted</span>
          <button style="background:#10B981; color:#041F14; border:none; border-radius:8px; padding:6px 14px; font-size:12px; font-weight:700;">Finish Shift</button>
        </div>
      </div>

      <!-- Weekly Earnings & Hours -->
      <div class="card">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px;">
          <div>
            <div style="font-size:11px; font-weight:700; color:#94A3B8; text-transform:uppercase; letter-spacing:0.5px;">Week 35 • Estimated Payroll</div>
            <div style="font-size:24px; font-weight:800; color:#F8FAFC; margin-top:2px;">€564.80 <span style="font-size:12px; font-weight:600; color:#10B981;">Net Bank</span></div>
          </div>
          <div style="text-align:right;">
            <span class="pill pill-emerald">38.0 Hours</span>
            <div style="font-size:11px; color:#94A3B8; margin-top:4px;">€14.99 / hr CAO</div>
          </div>
        </div>
        <div style="display:grid; grid-template-columns:1fr 1fr 1fr; gap:8px; padding:10px; background:#0B1120; border-radius:10px; border:1px solid #1E293B;">
          <div>
            <div style="font-size:10px; color:#64748B;">Base Gross</div>
            <div style="font-size:12px; font-weight:700; color:#F8FAFC; margin-top:2px;">€569.62</div>
          </div>
          <div>
            <div style="font-size:10px; color:#64748B;">ADV (9.0%)</div>
            <div style="font-size:12px; font-weight:700; color:#38BDF8; margin-top:2px;">+€51.30</div>
          </div>
          <div>
            <div style="font-size:10px; color:#64748B;">Holiday (8%)</div>
            <div style="font-size:12px; font-weight:700; color:#FBBF24; margin-top:2px;">+€45.57</div>
          </div>
        </div>
      </div>

      <!-- Weekly Shift Timeline -->
      <div class="card">
        <div style="font-size:11px; font-weight:700; color:#94A3B8; text-transform:uppercase; margin-bottom:10px;">This Week's Schedule</div>
        <div style="display:flex; flex-direction:column; gap:8px;">
          <div style="display:flex; justify-content:space-between; align-items:center; font-size:12px;">
            <div style="display:flex; align-items:center; gap:8px;">
              <span style="width:24px; font-weight:700; color:#94A3B8;">Mon</span>
              <span class="pill pill-indigo">14:30 - 23:00</span>
            </div>
            <span style="color:#10B981; font-weight:600;">7.5h Paid</span>
          </div>
          <div style="display:flex; justify-content:space-between; align-items:center; font-size:12px;">
            <div style="display:flex; align-items:center; gap:8px;">
              <span style="width:24px; font-weight:700; color:#94A3B8;">Tue</span>
              <span class="pill pill-indigo">14:30 - 23:00</span>
            </div>
            <span style="color:#10B981; font-weight:600;">7.5h Paid</span>
          </div>
          <div style="display:flex; justify-content:space-between; align-items:center; font-size:12px;">
            <div style="display:flex; align-items:center; gap:8px;">
              <span style="width:24px; font-weight:700; color:#94A3B8;">Wed</span>
              <span class="pill pill-indigo">14:30 - 23:00</span>
            </div>
            <span style="color:#10B981; font-weight:600;">7.5h Paid</span>
          </div>
          <div style="display:flex; justify-content:space-between; align-items:center; font-size:12px;">
            <div style="display:flex; align-items:center; gap:8px;">
              <span style="width:24px; font-weight:700; color:#10B981;">Thu</span>
              <span class="pill pill-emerald">Active Shift</span>
            </div>
            <span style="color:#38BDF8; font-weight:600;">In Progress</span>
          </div>
          <div style="display:flex; justify-content:space-between; align-items:center; font-size:12px;">
            <div style="display:flex; align-items:center; gap:8px;">
              <span style="width:24px; font-weight:700; color:#94A3B8;">Fri</span>
              <span class="pill pill-indigo">14:30 - 23:00</span>
            </div>
            <span style="color:#64748B;">Scheduled</span>
          </div>
        </div>
      </div>
    `,
  },

  // 2. SALARY / PAYROLL CALCULATION
  {
    id: '02-salary',
    title: 'Payroll Engine',
    subtitle: 'Deterministic Dutch CAO Calculation',
    tabActive: 'work',
    storeHeadline: 'Deterministic Dutch Payroll',
    storeSubtitle: 'Automatic gross-to-net calculation with ADV, holiday pay & taxes.',
    htmlBody: `
      <!-- Calculation Summary Card -->
      <div class="card card-highlight">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px;">
          <span class="pill pill-emerald">ISO Week 35 • Verified</span>
          <span style="font-size:11px; color:#94A3B8;">CAO 2026-W13+</span>
        </div>
        <div style="font-size:12px; color:#94A3B8;">Calculated Net Bank Transfer</div>
        <div style="font-size:32px; font-weight:800; color:#10B981; margin:4px 0 12px 0;">€564.80</div>
        <div style="display:flex; justify-content:space-between; font-size:12px; color:#94A3B8; border-top:1px solid rgba(255,255,255,0.08); padding-top:10px;">
          <span>38.00 Paid Hours</span>
          <span>Base: €14.99 / hr</span>
        </div>
      </div>

      <!-- Itemized Payroll Deductions Table -->
      <div class="card" style="padding:14px;">
        <div style="font-size:11px; font-weight:700; color:#94A3B8; text-transform:uppercase; margin-bottom:10px;">Component Breakdown</div>
        <div style="display:flex; flex-direction:column; gap:8px; font-size:12px;">
          <div style="display:flex; justify-content:space-between;">
            <span style="color:#F8FAFC;">Base Gross Wage (38.0h)</span>
            <span style="font-weight:700; color:#F8FAFC;">€569.62</span>
          </div>
          <div style="display:flex; justify-content:space-between;">
            <span style="color:#94A3B8;">+ ADV Compensatie (9.005%)</span>
            <span style="font-weight:600; color:#38BDF8;">+€51.30</span>
          </div>
          <div style="display:flex; justify-content:space-between;">
            <span style="color:#94A3B8;">+ Vakantiebijslag (8.00%)</span>
            <span style="font-weight:600; color:#FBBF24;">+€45.57</span>
          </div>
          <div style="display:flex; justify-content:space-between;">
            <span style="color:#94A3B8;">+ Vakantiedagenopbouw (10.49%)</span>
            <span style="font-weight:600; color:#FBBF24;">+€59.80</span>
          </div>
          <div style="height:1px; background:#1E293B; margin:4px 0;"></div>
          <div style="display:flex; justify-content:space-between;">
            <span style="color:#F8FAFC; font-weight:600;">Total Gross Taxable (Loon SV)</span>
            <span style="font-weight:700; color:#F8FAFC;">€666.49</span>
          </div>
          <div style="display:flex; justify-content:space-between;">
            <span style="color:#EF4444;">- Pensioenpremie StiPP (7.50%)</span>
            <span style="font-weight:600; color:#EF4444;">-€49.99</span>
          </div>
          <div style="display:flex; justify-content:space-between;">
            <span style="color:#EF4444;">- PAWW / AZV / WGA (1.205%)</span>
            <span style="font-weight:600; color:#EF4444;">-€8.03</span>
          </div>
          <div style="display:flex; justify-content:space-between;">
            <span style="color:#EF4444;">- Estimated Loonheffing (Tax)</span>
            <span style="font-weight:600; color:#EF4444;">-€103.67</span>
          </div>
          <div style="display:flex; justify-content:space-between;">
            <span style="color:#EF4444;">- Zorgverzekering (Weekly)</span>
            <span style="font-weight:600; color:#EF4444;">-€38.01</span>
          </div>
          <div style="display:flex; justify-content:space-between;">
            <span style="color:#10B981;">+ ET Exchange Reimbursement</span>
            <span style="font-weight:600; color:#10B981;">+€38.01</span>
          </div>
        </div>
      </div>

      <!-- Verification Badge -->
      <div style="background:#070C18; border:1px solid #1E293B; border-radius:12px; padding:10px 14px; display:flex; align-items:center; gap:10px;">
        <svg class="icon-svg" style="color:#10B981; min-width:20px;" viewBox="0 0 24 24"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
        <span style="font-size:11px; color:#94A3B8;">Verified against 18 reference payslips from Carrière Uitzendbureau. 100% test pass.</span>
      </div>
    `,
  },

  // 3. TRACK WORK & SESSIONS
  {
    id: '03-work',
    title: 'Track Work',
    subtitle: 'Shift Clocks & Precision Rounding',
    tabActive: 'work',
    storeHeadline: 'One-Tap Work & Break Tracking',
    storeSubtitle: 'Automatic clock-in adjustments and 15-minute payroll rounding.',
    htmlBody: `
      <!-- Active Work Session Clock -->
      <div class="card card-highlight">
        <div style="display:flex; justify-content:space-between; align-items:center;">
          <span class="pill pill-emerald">Live Session</span>
          <span style="font-size:11px; color:#94A3B8;">Thu, 28 Aug</span>
        </div>
        <div style="text-align:center; margin:16px 0;">
          <div style="font-size:38px; font-weight:800; letter-spacing:-1px; color:#F8FAFC;">06:45:22</div>
          <div style="font-size:12px; color:#94A3B8; margin-top:2px;">Actual Start: 14:15 • Expected: 14:30 (-15m prep)</div>
        </div>
        <div style="display:grid; grid-template-columns:1fr 1fr; gap:10px; margin-bottom:12px;">
          <div style="background:#0B1120; padding:10px; border-radius:10px; text-align:center; border:1px solid #1E293B;">
            <div style="font-size:10px; color:#64748B;">Paid Time</div>
            <div style="font-size:16px; font-weight:700; color:#38BDF8; margin-top:2px;">6h 15m</div>
          </div>
          <div style="background:#0B1120; padding:10px; border-radius:10px; text-align:center; border:1px solid #1E293B;">
            <div style="font-size:10px; color:#64748B;">Unpaid Breaks</div>
            <div style="font-size:16px; font-weight:700; color:#FBBF24; margin-top:2px;">30m</div>
          </div>
        </div>
        <div style="display:flex; gap:8px;">
          <button style="flex:1; background:#1E293B; color:#F8FAFC; border:1px solid #334155; border-radius:8px; padding:10px; font-size:12px; font-weight:700;">+ Log Break</button>
          <button style="flex:1; background:#10B981; color:#041F14; border:none; border-radius:8px; padding:10px; font-size:12px; font-weight:700;">Finish Work</button>
        </div>
      </div>

      <!-- Past Sessions Log -->
      <div class="card">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:10px;">
          <span style="font-size:11px; font-weight:700; color:#94A3B8; text-transform:uppercase;">Recent Completed Shifts</span>
          <span style="font-size:11px; color:#10B981; font-weight:600;">Auto-Rounded</span>
        </div>
        <div style="display:flex; flex-direction:column; gap:10px;">
          <div style="background:#0B1120; padding:10px 12px; border-radius:10px; border:1px solid #1E293B; display:flex; justify-content:space-between; align-items:center;">
            <div>
              <div style="font-size:12px; font-weight:700; color:#F8FAFC;">Wednesday, 27 Aug</div>
              <div style="font-size:11px; color:#94A3B8;">14:15 – 23:08 (Rounded: 23:00)</div>
            </div>
            <div style="text-align:right;">
              <div style="font-size:12px; font-weight:700; color:#10B981;">7h 30m</div>
              <div style="font-size:10px; color:#64748B;">€112.43</div>
            </div>
          </div>
          <div style="background:#0B1120; padding:10px 12px; border-radius:10px; border:1px solid #1E293B; display:flex; justify-content:space-between; align-items:center;">
            <div>
              <div style="font-size:12px; font-weight:700; color:#F8FAFC;">Tuesday, 26 Aug</div>
              <div style="font-size:11px; color:#94A3B8;">14:20 – 23:02 (Rounded: 23:00)</div>
            </div>
            <div style="text-align:right;">
              <div style="font-size:12px; font-weight:700; color:#10B981;">7h 30m</div>
              <div style="font-size:10px; color:#64748B;">€112.43</div>
            </div>
          </div>
        </div>
      </div>
    `,
  },

  // 4. PAYSLIP INGESTION & AUDIT
  {
    id: '04-payslips',
    title: 'Payslips',
    subtitle: 'PDF Ingestion & Cross-Reconciliation',
    tabActive: 'payslips',
    storeHeadline: 'Payslip Ingestion & Audit',
    storeSubtitle: 'Scan official PDF payslips and reconcile against actual logged hours.',
    htmlBody: `
      <!-- Upload Payslip Action -->
      <div style="background:linear-gradient(135deg, rgba(56, 189, 248, 0.12) 0%, rgba(19, 28, 49, 1) 100%); border:1px dashed #38BDF8; border-radius:14px; padding:14px; text-align:center;">
        <div style="font-size:13px; font-weight:700; color:#38BDF8;">Upload Official Payslip PDF</div>
        <div style="font-size:11px; color:#94A3B8; margin-top:2px;">Deterministic PDF text extraction & OCR reconciliation</div>
      </div>

      <!-- Latest Verified Payslip -->
      <div class="card card-highlight">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:10px;">
          <div>
            <span class="pill pill-emerald">Verified • 100% Match</span>
            <div style="font-size:13px; font-weight:700; color:#F8FAFC; margin-top:4px;">Carrière Personeelsdiensten</div>
          </div>
          <div style="text-align:right;">
            <div style="font-size:10px; color:#94A3B8;">Period</div>
            <div style="font-size:12px; font-weight:700; color:#F8FAFC;">2026 W34</div>
          </div>
        </div>
        <div style="display:flex; justify-content:space-between; align-items:flex-end; padding:10px 0; border-top:1px solid rgba(255,255,255,0.08);">
          <div>
            <div style="font-size:11px; color:#94A3B8;">Official Net Paid</div>
            <div style="font-size:26px; font-weight:800; color:#10B981;">€485.95</div>
          </div>
          <div style="text-align:right;">
            <div style="font-size:11px; color:#94A3B8;">Tracked Estimate</div>
            <div style="font-size:14px; font-weight:700; color:#F8FAFC;">€485.95</div>
            <div style="font-size:11px; font-weight:700; color:#10B981;">Diff: €0.00</div>
          </div>
        </div>
      </div>

      <!-- Detailed Components Audit -->
      <div class="card">
        <div style="font-size:11px; font-weight:700; color:#94A3B8; text-transform:uppercase; margin-bottom:10px;">Parsed Payslip Lines</div>
        <div style="display:flex; flex-direction:column; gap:8px; font-size:12px;">
          <div style="display:flex; justify-content:space-between;">
            <span>1000 Basisloon (37.5 hrs @ €14.99)</span>
            <span style="font-weight:700; color:#F8FAFC;">€562.13</span>
          </div>
          <div style="display:flex; justify-content:space-between;">
            <span style="color:#94A3B8;">1010 ADV Compensatie</span>
            <span style="font-weight:600; color:#38BDF8;">€50.62</span>
          </div>
          <div style="display:flex; justify-content:space-between;">
            <span style="color:#94A3B8;">5000 Pensioenpremie StiPP (7.5%)</span>
            <span style="font-weight:600; color:#EF4444;">-€42.16</span>
          </div>
          <div style="display:flex; justify-content:space-between;">
            <span style="color:#94A3B8;">6000 Loonheffing (Inhouding)</span>
            <span style="font-weight:600; color:#EF4444;">-€98.42</span>
          </div>
          <div style="display:flex; justify-content:space-between;">
            <span style="color:#94A3B8;">7000 Zorgverzekering HollandZorg</span>
            <span style="font-weight:600; color:#EF4444;">-€38.01</span>
          </div>
        </div>
      </div>
    `,
  },

  // 5. PERSONAL FINANCE & SAVINGS GOALS
  {
    id: '05-finance',
    title: 'Personal Finance',
    subtitle: 'Cash Flow & Savings Targets',
    tabActive: 'finance',
    storeHeadline: 'Cash Flow & Savings Goals',
    storeSubtitle: 'Manage monthly income, fixed bills, variable spend, and savings targets.',
    htmlBody: `
      <!-- Cash Flow Summary -->
      <div class="card card-highlight">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:10px;">
          <span class="pill pill-emerald">August 2026</span>
          <span style="font-size:11px; color:#10B981; font-weight:700;">+44.8% Saved</span>
        </div>
        <div style="display:grid; grid-template-columns:1fr 1fr; gap:12px;">
          <div>
            <div style="font-size:11px; color:#94A3B8;">Net Income</div>
            <div style="font-size:22px; font-weight:800; color:#10B981;">€2,184.20</div>
          </div>
          <div>
            <div style="font-size:11px; color:#94A3B8;">Total Expenses</div>
            <div style="font-size:22px; font-weight:800; color:#EF4444;">€1,205.50</div>
          </div>
        </div>
        <div style="margin-top:12px; padding-top:10px; border-top:1px solid rgba(255,255,255,0.08); display:flex; justify-content:space-between;">
          <span style="font-size:12px; color:#94A3B8;">Net Monthly Surplus:</span>
          <span style="font-size:14px; font-weight:800; color:#38BDF8;">+€978.70</span>
        </div>
      </div>

      <!-- Categorized Expenses -->
      <div class="card">
        <div style="font-size:11px; font-weight:700; color:#94A3B8; text-transform:uppercase; margin-bottom:10px;">Monthly Expense Allocation</div>
        <div style="display:flex; flex-direction:column; gap:8px;">
          <div>
            <div style="display:flex; justify-content:space-between; font-size:12px; margin-bottom:4px;">
              <span style="color:#F8FAFC;">Housing & Rent</span>
              <span style="font-weight:700; color:#F8FAFC;">€650.00 (54%)</span>
            </div>
            <div style="height:6px; background:#0B1120; border-radius:3px; overflow:hidden;">
              <div style="width:54%; height:100%; background:#38BDF8; border-radius:3px;"></div>
            </div>
          </div>
          <div>
            <div style="display:flex; justify-content:space-between; font-size:12px; margin-bottom:4px;">
              <span style="color:#F8FAFC;">Groceries & Food</span>
              <span style="font-weight:700; color:#F8FAFC;">€280.00 (23%)</span>
            </div>
            <div style="height:6px; background:#0B1120; border-radius:3px; overflow:hidden;">
              <div style="width:23%; height:100%; background:#10B981; border-radius:3px;"></div>
            </div>
          </div>
          <div>
            <div style="display:flex; justify-content:space-between; font-size:12px; margin-bottom:4px;">
              <span style="color:#F8FAFC;">Transportation</span>
              <span style="font-weight:700; color:#F8FAFC;">€115.00 (10%)</span>
            </div>
            <div style="height:6px; background:#0B1120; border-radius:3px; overflow:hidden;">
              <div style="width:10%; height:100%; background:#FBBF24; border-radius:3px;"></div>
            </div>
          </div>
        </div>
      </div>

      <!-- Savings Goal Progress -->
      <div class="card">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:10px;">
          <div style="display:flex; align-items:center; gap:8px;">
            <div style="width:28px; height:28px; border-radius:8px; background:rgba(16,185,129,0.15); display:flex; align-items:center; justify-content:center; color:#10B981;">
              <svg class="icon-svg" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/></svg>
            </div>
            <div>
              <div style="font-size:12px; font-weight:700; color:#F8FAFC;">Emergency Fund</div>
              <div style="font-size:10px; color:#94A3B8;">Target: Dec 2026</div>
            </div>
          </div>
          <span class="pill pill-emerald">80% Done</span>
        </div>
        <div style="height:6px; background:#0B1120; border-radius:3px; overflow:hidden; margin-bottom:6px;">
          <div style="width:80%; height:100%; background:#10B981; border-radius:3px;"></div>
        </div>
        <div style="display:flex; justify-content:space-between; font-size:11px; color:#94A3B8;">
          <span>Current: €1,200</span>
          <span>Target: €1,500</span>
        </div>
      </div>
    `,
  },

  // 6. SHIFT & WAGE SIMULATOR / SETTINGS
  {
    id: '06-simulator',
    title: 'Shift Simulator',
    subtitle: 'What-If Shift & Earnings Modeling',
    tabActive: 'settings',
    storeHeadline: 'Interactive Shift Simulator',
    storeSubtitle: 'Simulate extra shifts, overtime rates, and forecast net take-home pay.',
    htmlBody: `
      <!-- Simulator Controls -->
      <div class="card card-highlight">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:10px;">
          <span class="pill pill-indigo">What-If Modeling</span>
          <span style="font-size:11px; color:#94A3B8;">Active Configuration</span>
        </div>
        <div style="font-size:12px; color:#94A3B8;">Projected Net Pay for Week:</div>
        <div style="font-size:32px; font-weight:800; color:#10B981; margin:2px 0 10px 0;">€638.45</div>
        <div style="display:flex; justify-content:space-between; font-size:12px; color:#38BDF8; font-weight:600; padding-top:8px; border-top:1px solid rgba(255,255,255,0.08);">
          <span>+1 Extra Shift Added (+7.5 hrs)</span>
          <span>+€73.65 Net</span>
        </div>
      </div>

      <!-- Simulated Shift Parameters -->
      <div class="card">
        <div style="font-size:11px; font-weight:700; color:#94A3B8; text-transform:uppercase; margin-bottom:10px;">Simulation Parameters</div>
        <div style="display:flex; flex-direction:column; gap:10px; font-size:12px;">
          <div style="display:flex; justify-content:space-between; align-items:center;">
            <span style="color:#94A3B8;">Scheduled Shifts</span>
            <span style="font-weight:700; color:#F8FAFC;">5 Shifts (37.5 hrs)</span>
          </div>
          <div style="display:flex; justify-content:space-between; align-items:center;">
            <span style="color:#94A3B8;">Extra Overtime Shift</span>
            <span class="pill pill-emerald">+1 Shift (Sunday 150%)</span>
          </div>
          <div style="display:flex; justify-content:space-between; align-items:center;">
            <span style="color:#94A3B8;">Base Hourly Rate</span>
            <span style="font-weight:700; color:#F8FAFC;">€14.99 / hr</span>
          </div>
          <div style="display:flex; justify-content:space-between; align-items:center;">
            <span style="color:#94A3B8;">ADV Compensation</span>
            <span style="font-weight:700; color:#38BDF8;">9.005% (€1.35/h)</span>
          </div>
          <div style="display:flex; justify-content:space-between; align-items:center;">
            <span style="color:#94A3B8;">Holiday Allowance (8%)</span>
            <span style="font-weight:700; color:#FBBF24;">Included</span>
          </div>
        </div>
      </div>

      <!-- Local-First Privacy Guarantee -->
      <div class="card" style="border-color:#10B981; background:rgba(16, 185, 129, 0.05);">
        <div style="display:flex; align-items:center; gap:8px; margin-bottom:6px;">
          <svg class="icon-svg" style="color:#10B981;" viewBox="0 0 24 24"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
          <span style="font-size:12px; font-weight:800; color:#10B981;">100% Local SQLite Storage</span>
        </div>
        <p style="font-size:11px; color:#94A3B8; line-height:1.4;">All calculations, shifts, and payslip data are processed exclusively on your device. Zero telemetry, zero external tracking.</p>
      </div>
    `,
  },
];

export function buildRawScreenHtml(screen: ScreenDefinition): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>${screen.title} - PayTrack</title>
  <style>
    ${COMMON_CSS}
  </style>
</head>
<body>
  <div class="status-bar">
    <span>09:41</span>
    <div class="status-icons">
      <span>5G</span>
      <svg class="icon-svg" style="width:16px;height:16px;" viewBox="0 0 24 24"><path d="M5 12.55a11 11 0 0 1 14.08 0"/><path d="M1.42 9a16 16 0 0 1 21.16 0"/><path d="M8.53 16.11a6 6 0 0 1 6.95 0"/><line x1="12" y1="20" x2="12.01" y2="20"/></svg>
      <div style="width:20px; height:10px; border:1.5px solid #94A3B8; border-radius:3px; padding:1px; display:flex;">
        <div style="width:100%; height:100%; background:#10B981; border-radius:1px;"></div>
      </div>
    </div>
  </div>

  <header class="app-header">
    <div>
      <div class="app-brand-title">
        <span>${screen.title}</span>
        <span class="brand-badge">PayTrack</span>
      </div>
      <div class="header-sub">${screen.subtitle}</div>
    </div>
    <div class="header-action">
      <svg class="icon-svg" viewBox="0 0 24 24"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>
    </div>
  </header>

  <main class="screen-content">
    ${screen.htmlBody}
  </main>

  ${renderTabBar(screen.tabActive)}
</body>
</html>`;
}

export function buildStoreAssetHtml(screen: ScreenDefinition): string {
  const rawHtml = buildRawScreenHtml(screen);
  const rawSrcDoc = rawHtml.replace(/"/g, '&quot;');

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Store Asset - ${screen.id}</title>
  <style>
    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
      -webkit-font-smoothing: antialiased;
    }
    body {
      width: 1080px;
      height: 1920px;
      overflow: hidden;
      background: #060A13;
      background-image:
        radial-gradient(circle at 50% 10%, rgba(16, 185, 129, 0.12) 0%, transparent 50%),
        radial-gradient(circle at 50% 90%, rgba(56, 189, 248, 0.08) 0%, transparent 60%),
        linear-gradient(180deg, #070C18 0%, #0B1120 40%, #080D1A 100%);
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      color: #F8FAFC;
      display: flex;
      flex-direction: column;
      align-items: center;
      position: relative;
    }

    /* Top Marketing Typography */
    .store-header {
      width: 920px;
      padding-top: 110px;
      text-align: center;
      z-index: 5;
    }
    .brand-tag {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      background: rgba(16, 185, 129, 0.12);
      border: 1px solid rgba(16, 185, 129, 0.3);
      color: #10B981;
      padding: 8px 20px;
      border-radius: 999px;
      font-size: 15px;
      font-weight: 800;
      letter-spacing: 2px;
      text-transform: uppercase;
      margin-bottom: 24px;
    }
    .store-headline {
      font-size: 58px;
      font-weight: 900;
      letter-spacing: -1.5px;
      line-height: 1.15;
      color: #FFFFFF;
      margin-bottom: 18px;
    }
    .store-subtitle {
      font-size: 26px;
      font-weight: 500;
      line-height: 1.4;
      color: #94A3B8;
      max-width: 820px;
      margin: 0 auto;
    }

    /* Phone Mockup Frame */
    .mockup-container {
      position: absolute;
      bottom: -60px;
      width: 720px;
      height: 1400px;
      display: flex;
      justify-content: center;
      z-index: 10;
    }
    .phone-bezel {
      width: 680px;
      height: 1400px;
      background: #111827;
      border-radius: 64px 64px 0 0;
      padding: 16px 16px 0 16px;
      box-shadow:
        0 -20px 60px rgba(0, 0, 0, 0.8),
        0 0 0 4px #1E293B,
        0 0 0 8px #0F172A,
        inset 0 2px 4px rgba(255, 255, 255, 0.2);
      position: relative;
    }
    .phone-camera-island {
      position: absolute;
      top: 26px;
      left: 50%;
      transform: translateX(-50%);
      width: 120px;
      height: 28px;
      background: #000;
      border-radius: 20px;
      z-index: 20;
    }
    .phone-screen {
      width: 100%;
      height: 100%;
      background: #0B1120;
      border-radius: 48px 48px 0 0;
      overflow: hidden;
      position: relative;
    }
    .scaled-screen-frame {
      width: 412px;
      height: 915px;
      transform-origin: top left;
      transform: scale(1.5728);
      border: none;
    }
  </style>
</head>
<body>
  <div class="store-header">
    <div class="brand-tag">
      <span style="width:8px; height:8px; border-radius:50%; background:#10B981;"></span>
      PAYTRACK • OFFLINE-FIRST
    </div>
    <h1 class="store-headline">${screen.storeHeadline}</h1>
    <p class="store-subtitle">${screen.storeSubtitle}</p>
  </div>

  <div class="mockup-container">
    <div class="phone-bezel">
      <div class="phone-camera-island"></div>
      <div class="phone-screen">
        <iframe class="scaled-screen-frame" srcdoc="${rawSrcDoc}" scrolling="no"></iframe>
      </div>
    </div>
  </div>
</body>
</html>`;
}

/**
 * WealthPulse — Financial Calculators Page
 */
const CalculatorsPage = {
  activeCalc: null,

  async render() {
    return `
      <div class="section-header">
        <div>
          <h2 class="section-title">Financial Calculators</h2>
          <p class="text-muted" style="font-size:0.85rem; margin-top:4px">Plan your investments with powerful calculators</p>
        </div>
      </div>
      <div id="calcContent"></div>
    `;
  },

  async init() {
    this.activeCalc = null;
    this.renderHome();
  },

  renderHome() {
    const calcs = [
      { id: 'sip', icon: '📈', title: 'SIP Calculator', desc: 'Calculate returns on Systematic Investment Plans' },
      { id: 'stepupSip', icon: '🚀', title: 'Step-up SIP Calculator', desc: 'SIP with annual step-up/increase' },
      { id: 'lumpsum', icon: '💰', title: 'Lumpsum Calculator', desc: 'One-time investment return calculator' },
      { id: 'swp', icon: '💸', title: 'SWP Calculator', desc: 'Systematic Withdrawal Plan calculator' },
      { id: 'inflation', icon: '📊', title: 'Inflation Calculator', desc: 'See future value adjusted for inflation' },
      { id: 'fd', icon: '🏦', title: 'FD Calculator', desc: 'Fixed Deposit maturity value calculator' },
      { id: 'emi', icon: '🏠', title: 'EMI Calculator', desc: 'Equated Monthly Installment calculator' },
      { id: 'goalPlanner', icon: '🎯', title: 'Goal Planner', desc: 'How much to invest to reach your goal' },
      { id: 'epf', icon: '🏛️', title: 'EPF Calculator', desc: 'Employee Provident Fund projection' },
      { id: 'fire', icon: '🔥', title: 'FIRE Calculator', desc: 'Financial Independence, Retire Early' },
      { id: 'goldSilver', icon: '🥇', title: 'Gold-Silver Ratio', desc: 'Track the gold-silver ratio and valuation signals' },
      { id: 'cagr', icon: '📐', title: 'CAGR Calculator', desc: 'Compound Annual Growth Rate calculator' },
      { id: 'xirr', icon: '📉', title: 'XIRR Calculator', desc: 'Extended IRR for irregular cash flows' },
      { id: 'ppf', icon: '🏦', title: 'PPF Calculator', desc: 'Public Provident Fund maturity calculator' },
      { id: 'nps', icon: '🏛️', title: 'NPS Calculator', desc: 'National Pension System projection' },
      { id: 'ssy', icon: '👧', title: 'SSY Calculator', desc: 'Sukanya Samriddhi Yojana calculator' },
      { id: 'rd', icon: '💳', title: 'RD Calculator', desc: 'Recurring Deposit maturity calculator' },
      { id: 'gratuity', icon: '🎁', title: 'Gratuity Calculator', desc: 'Estimate your gratuity payout' },
      { id: 'hra', icon: '🏘️', title: 'HRA Calculator', desc: 'House Rent Allowance exemption calculator' },
      { id: 'incomeTax', icon: '🧾', title: 'Income Tax Calculator', desc: 'Old vs New regime tax comparison' },
      { id: 'compoundInterest', icon: '🔄', title: 'Compound Interest', desc: 'CI with flexible compounding frequency' },
      { id: 'simpleInterest', icon: '📝', title: 'Simple Interest', desc: 'Basic simple interest calculator' },
      { id: 'flatVsReducing', icon: '⚖️', title: 'Flat vs Reducing Rate', desc: 'Compare flat and reducing rate loans' },
      { id: 'salary', icon: '💼', title: 'Salary Calculator', desc: 'CTC to take-home salary breakdown' },
      { id: 'retirementCorpus', icon: '🏖️', title: 'Retirement Corpus', desc: 'How much you need to retire comfortably' },
      { id: 'nsc', icon: '📜', title: 'NSC Calculator', desc: 'National Savings Certificate returns' },
      { id: 'scss', icon: '👴', title: 'SCSS Calculator', desc: 'Senior Citizens Savings Scheme calculator' },
      { id: 'apy', icon: '🛡️', title: 'APY Calculator', desc: 'Atal Pension Yojana contribution lookup' },
      { id: 'stockAvg', icon: '📊', title: 'Stock Average Calculator', desc: 'Weighted average cost of multiple buys' },
    ];

    document.getElementById('calcContent').innerHTML = `
      <div class="calc-grid">
        ${calcs.map(c => `
          <div class="calc-card" onclick="CalculatorsPage.openCalc('${c.id}')">
            <div class="calc-card-icon">${c.icon}</div>
            <h3>${c.title}</h3>
            <p>${c.desc}</p>
          </div>
        `).join('')}
      </div>
    `;
  },

  openCalc(id) {
    this.activeCalc = id;
    const el = document.getElementById('calcContent');
    const back = `<button class="btn btn-outline btn-sm mb-16" onclick="CalculatorsPage.renderHome()">← Back to Calculators</button>`;

    switch (id) {
      case 'sip': el.innerHTML = back + this.sipCalcHTML(); break;
      case 'stepupSip': el.innerHTML = back + this.stepupSipCalcHTML(); break;
      case 'lumpsum': el.innerHTML = back + this.lumpsumCalcHTML(); break;
      case 'swp': el.innerHTML = back + this.swpCalcHTML(); break;
      case 'inflation': el.innerHTML = back + this.inflationCalcHTML(); break;
      case 'fd': el.innerHTML = back + this.fdCalcHTML(); break;
      case 'emi': el.innerHTML = back + this.emiCalcHTML(); break;
      case 'goalPlanner': el.innerHTML = back + this.goalPlannerHTML(); break;
      case 'epf': el.innerHTML = back + this.epfCalcHTML(); break;
      case 'fire': el.innerHTML = back + this.fireCalcHTML(); break;
      case 'goldSilver': el.innerHTML = back; this.loadGoldSilverRatio(el, back); break;
      case 'cagr': el.innerHTML = back + this.cagrCalcHTML(); break;
      case 'xirr': el.innerHTML = back + this.xirrCalcHTML(); break;
      case 'ppf': el.innerHTML = back + this.ppfCalcHTML(); break;
      case 'nps': el.innerHTML = back + this.npsCalcHTML(); break;
      case 'ssy': el.innerHTML = back + this.ssyCalcHTML(); break;
      case 'rd': el.innerHTML = back + this.rdCalcHTML(); break;
      case 'gratuity': el.innerHTML = back + this.gratuityCalcHTML(); break;
      case 'hra': el.innerHTML = back + this.hraCalcHTML(); break;
      case 'incomeTax': el.innerHTML = back + this.incomeTaxCalcHTML(); break;
      case 'compoundInterest': el.innerHTML = back + this.compoundInterestCalcHTML(); break;
      case 'simpleInterest': el.innerHTML = back + this.simpleInterestCalcHTML(); break;
      case 'flatVsReducing': el.innerHTML = back + this.flatVsReducingCalcHTML(); break;
      case 'salary': el.innerHTML = back + this.salaryCalcHTML(); break;
      case 'retirementCorpus': el.innerHTML = back + this.retirementCorpusCalcHTML(); break;
      case 'nsc': el.innerHTML = back + this.nscCalcHTML(); break;
      case 'scss': el.innerHTML = back + this.scssCalcHTML(); break;
      case 'apy': el.innerHTML = back + this.apyCalcHTML(); break;
      case 'stockAvg': el.innerHTML = back + this.stockAvgCalcHTML(); break;
    }
  },

  // ─── Growth Chart Helper ──────────────────
  _renderGrowthChart(canvasId, labels, investedData, projectedData) {
    requestAnimationFrame(() => {
      Charts.line(canvasId, labels, [
        { label: 'Invested', data: investedData, color: '#6366f1', fill: false },
        { label: 'Projected Value', data: projectedData, color: '#10b981', fill: true },
      ]);
    });
  },

  // ─── SIP Calculator ──────────────────
  sipCalcHTML() {
    return `
      <div class="card">
        <div class="card-header"><div class="card-title">📈 SIP Calculator</div></div>
        <div class="form-row-3">
          <div class="form-group"><label>Monthly Investment (₹)</label><input class="form-control" type="number" id="sipAmount" value="10000"></div>
          <div class="form-group"><label>Expected Return (% p.a.)</label><input class="form-control" type="number" step="0.1" id="sipRate" value="12"></div>
          <div class="form-group"><label>Duration (Years)</label><input class="form-control" type="number" id="sipYears" value="10"></div>
        </div>
        <button class="btn btn-primary btn-sm" onclick="CalculatorsPage.calcSIP()">Calculate</button>
        <div id="sipResult"></div>
      </div>
    `;
  },

  calcSIP() {
    const P = Number(document.getElementById('sipAmount').value);
    const r = Number(document.getElementById('sipRate').value) / 100 / 12;
    const years = Number(document.getElementById('sipYears').value);
    const n = years * 12;
    const fv = P * ((Math.pow(1 + r, n) - 1) / r) * (1 + r);
    const invested = P * n;
    const gain = fv - invested;
    const chartLabels = [], chartInvested = [], chartProjected = [];
    for (let y = 1; y <= years; y++) {
      chartLabels.push('Year ' + y);
      chartInvested.push(P * 12 * y);
      chartProjected.push(P * ((Math.pow(1 + r, y * 12) - 1) / r) * (1 + r));
    }
    document.getElementById('sipResult').innerHTML = `
      <div class="calc-result-box">
        <h4>Results</h4>
        <div class="calc-result-row"><span>Total Invested</span><strong>${Utils.currencyFull(invested)}</strong></div>
        <div class="calc-result-row"><span>Estimated Returns</span><strong class="text-green">${Utils.currencyFull(gain)}</strong></div>
        <div class="calc-result-row"><span>Total Value</span><strong>${Utils.currencyFull(fv)}</strong></div>
        <div class="chart-container" style="height:250px;margin-top:16px"><canvas id="calcChart_sip"></canvas></div>
      </div>
    `;
    this._renderGrowthChart('calcChart_sip', chartLabels, chartInvested, chartProjected);
  },

  // ─── Step-up SIP ──────────────────
  stepupSipCalcHTML() {
    return `
      <div class="card">
        <div class="card-header"><div class="card-title">🚀 Step-up SIP Calculator</div></div>
        <div class="form-row">
          <div class="form-group"><label>Starting Monthly SIP (₹)</label><input class="form-control" type="number" id="stepSipAmount" value="10000"></div>
          <div class="form-group"><label>Annual Step-up (%)</label><input class="form-control" type="number" step="1" id="stepSipStepup" value="10"></div>
        </div>
        <div class="form-row">
          <div class="form-group"><label>Expected Return (% p.a.)</label><input class="form-control" type="number" step="0.1" id="stepSipRate" value="12"></div>
          <div class="form-group"><label>Duration (Years)</label><input class="form-control" type="number" id="stepSipYears" value="10"></div>
        </div>
        <button class="btn btn-primary btn-sm" onclick="CalculatorsPage.calcStepupSIP()">Calculate</button>
        <div id="stepSipResult"></div>
      </div>
    `;
  },

  calcStepupSIP() {
    let P = Number(document.getElementById('stepSipAmount').value);
    const stepup = Number(document.getElementById('stepSipStepup').value) / 100;
    const annualRate = Number(document.getElementById('stepSipRate').value) / 100;
    const r = annualRate / 12;
    const years = Number(document.getElementById('stepSipYears').value);
    let totalInvested = 0, totalValue = 0, balance = 0;
    const chartLabels = [], chartInvested = [], chartProjected = [];
    for (let y = 0; y < years; y++) {
      const monthlyP = P * Math.pow(1 + stepup, y);
      for (let m = 0; m < 12; m++) {
        const monthsRemaining = (years - y) * 12 - m;
        totalInvested += monthlyP;
        totalValue += monthlyP * Math.pow(1 + r, monthsRemaining);
        balance = (balance + monthlyP) * (1 + r);
      }
      chartLabels.push('Year ' + (y + 1));
      chartInvested.push(totalInvested);
      chartProjected.push(balance);
    }
    const gain = totalValue - totalInvested;
    document.getElementById('stepSipResult').innerHTML = `
      <div class="calc-result-box">
        <h4>Results</h4>
        <div class="calc-result-row"><span>Total Invested</span><strong>${Utils.currencyFull(totalInvested)}</strong></div>
        <div class="calc-result-row"><span>Estimated Returns</span><strong class="text-green">${Utils.currencyFull(gain)}</strong></div>
        <div class="calc-result-row"><span>Total Value</span><strong>${Utils.currencyFull(totalValue)}</strong></div>
        <div class="chart-container" style="height:250px;margin-top:16px"><canvas id="calcChart_stepupSip"></canvas></div>
      </div>
    `;
    this._renderGrowthChart('calcChart_stepupSip', chartLabels, chartInvested, chartProjected);
  },

  // ─── Lumpsum ──────────────────
  lumpsumCalcHTML() {
    return `
      <div class="card">
        <div class="card-header"><div class="card-title">💰 Lumpsum Calculator</div></div>
        <div class="form-row-3">
          <div class="form-group"><label>Investment Amount (₹)</label><input class="form-control" type="number" id="lsAmount" value="100000"></div>
          <div class="form-group"><label>Expected Return (% p.a.)</label><input class="form-control" type="number" step="0.1" id="lsRate" value="12"></div>
          <div class="form-group"><label>Duration (Years)</label><input class="form-control" type="number" id="lsYears" value="10"></div>
        </div>
        <button class="btn btn-primary btn-sm" onclick="CalculatorsPage.calcLumpsum()">Calculate</button>
        <div id="lsResult"></div>
      </div>
    `;
  },

  calcLumpsum() {
    const P = Number(document.getElementById('lsAmount').value);
    const r = Number(document.getElementById('lsRate').value) / 100;
    const n = Number(document.getElementById('lsYears').value);
    const fv = P * Math.pow(1 + r, n);
    const chartLabels = [], chartInvested = [], chartProjected = [];
    for (let y = 1; y <= n; y++) {
      chartLabels.push('Year ' + y);
      chartInvested.push(P);
      chartProjected.push(P * Math.pow(1 + r, y));
    }
    document.getElementById('lsResult').innerHTML = `
      <div class="calc-result-box">
        <h4>Results</h4>
        <div class="calc-result-row"><span>Invested</span><strong>${Utils.currencyFull(P)}</strong></div>
        <div class="calc-result-row"><span>Returns</span><strong class="text-green">${Utils.currencyFull(fv - P)}</strong></div>
        <div class="calc-result-row"><span>Maturity Value</span><strong>${Utils.currencyFull(fv)}</strong></div>
        <div class="chart-container" style="height:250px;margin-top:16px"><canvas id="calcChart_lumpsum"></canvas></div>
      </div>
    `;
    this._renderGrowthChart('calcChart_lumpsum', chartLabels, chartInvested, chartProjected);
  },

  // ─── SWP ──────────────────
  swpCalcHTML() {
    return `
      <div class="card">
        <div class="card-header"><div class="card-title">💸 SWP Calculator</div></div>
        <div class="form-row">
          <div class="form-group"><label>Total Investment (₹)</label><input class="form-control" type="number" id="swpAmount" value="1000000"></div>
          <div class="form-group"><label>Monthly Withdrawal (₹)</label><input class="form-control" type="number" id="swpWithdrawal" value="10000"></div>
        </div>
        <div class="form-row">
          <div class="form-group"><label>Expected Return (% p.a.)</label><input class="form-control" type="number" step="0.1" id="swpRate" value="8"></div>
          <div class="form-group"><label>Duration (Years)</label><input class="form-control" type="number" id="swpYears" value="10"></div>
        </div>
        <button class="btn btn-primary btn-sm" onclick="CalculatorsPage.calcSWP()">Calculate</button>
        <div id="swpResult"></div>
      </div>
    `;
  },

  calcSWP() {
    const initialBalance = Number(document.getElementById('swpAmount').value);
    let balance = initialBalance;
    const w = Number(document.getElementById('swpWithdrawal').value);
    const r = Number(document.getElementById('swpRate').value) / 100 / 12;
    const years = Number(document.getElementById('swpYears').value);
    const months = years * 12;
    let totalWithdrawn = 0;
    const chartLabels = [], chartBalance = [], chartWithdrawn = [];
    for (let i = 0; i < months && balance > 0; i++) {
      balance = balance * (1 + r) - w;
      totalWithdrawn += w;
      if ((i + 1) % 12 === 0) {
        const yr = (i + 1) / 12;
        chartLabels.push('Year ' + yr);
        chartBalance.push(Math.max(0, balance));
        chartWithdrawn.push(totalWithdrawn);
      }
    }
    if (balance < 0) balance = 0;
    // If months not divisible by 12, capture the last partial year
    if (months % 12 !== 0 && chartLabels.length < Math.ceil(months / 12)) {
      chartLabels.push('Year ' + Math.ceil(months / 12));
      chartBalance.push(Math.max(0, balance));
      chartWithdrawn.push(totalWithdrawn);
    }
    document.getElementById('swpResult').innerHTML = `
      <div class="calc-result-box">
        <h4>Results</h4>
        <div class="calc-result-row"><span>Total Withdrawn</span><strong>${Utils.currencyFull(totalWithdrawn)}</strong></div>
        <div class="calc-result-row"><span>Remaining Balance</span><strong>${Utils.currencyFull(balance)}</strong></div>
        <div class="chart-container" style="height:250px;margin-top:16px"><canvas id="calcChart_swp"></canvas></div>
      </div>
    `;
    this._renderGrowthChart('calcChart_swp', chartLabels, chartWithdrawn, chartBalance);
  },

  // ─── Inflation ──────────────────
  inflationCalcHTML() {
    return `
      <div class="card">
        <div class="card-header"><div class="card-title">📊 Inflation Calculator</div></div>
        <div class="form-row-3">
          <div class="form-group"><label>Current Amount (₹)</label><input class="form-control" type="number" id="infAmount" value="100000"></div>
          <div class="form-group"><label>Inflation Rate (%)</label><input class="form-control" type="number" step="0.1" id="infRate" value="6"></div>
          <div class="form-group"><label>Years</label><input class="form-control" type="number" id="infYears" value="10"></div>
        </div>
        <button class="btn btn-primary btn-sm" onclick="CalculatorsPage.calcInflation()">Calculate</button>
        <div id="infResult"></div>
      </div>
    `;
  },

  calcInflation() {
    const P = Number(document.getElementById('infAmount').value);
    const r = Number(document.getElementById('infRate').value) / 100;
    const n = Number(document.getElementById('infYears').value);
    const fv = P * Math.pow(1 + r, n);
    const purchasing = P / Math.pow(1 + r, n);
    const chartLabels = [], chartCurrent = [], chartInflated = [];
    for (let y = 1; y <= n; y++) {
      chartLabels.push('Year ' + y);
      chartCurrent.push(P);
      chartInflated.push(P * Math.pow(1 + r, y));
    }
    document.getElementById('infResult').innerHTML = `
      <div class="calc-result-box">
        <h4>Results</h4>
        <div class="calc-result-row"><span>Future cost of ₹${P.toLocaleString('en-IN')} items</span><strong class="text-red">${Utils.currencyFull(fv)}</strong></div>
        <div class="calc-result-row"><span>Purchasing power of ₹${P.toLocaleString('en-IN')}</span><strong>${Utils.currencyFull(purchasing)}</strong></div>
        <div class="chart-container" style="height:250px;margin-top:16px"><canvas id="calcChart_inflation"></canvas></div>
      </div>
    `;
    requestAnimationFrame(() => {
      Charts.line('calcChart_inflation', chartLabels, [
        { label: 'Current Value', data: chartCurrent, color: '#6366f1', fill: false },
        { label: 'Inflated Cost', data: chartInflated, color: '#10b981', fill: true },
      ]);
    });
  },

  // ─── FD ──────────────────
  fdCalcHTML() {
    return `
      <div class="card">
        <div class="card-header"><div class="card-title">🏦 FD Calculator</div></div>
        <div class="form-row-3">
          <div class="form-group"><label>Principal (₹)</label><input class="form-control" type="number" id="fdAmount" value="100000"></div>
          <div class="form-group"><label>Interest Rate (%)</label><input class="form-control" type="number" step="0.1" id="fdRate" value="7"></div>
          <div class="form-group"><label>Tenure (Years)</label><input class="form-control" type="number" step="0.5" id="fdYears" value="5"></div>
        </div>
        <button class="btn btn-primary btn-sm" onclick="CalculatorsPage.calcFD()">Calculate</button>
        <div id="fdResult"></div>
      </div>
    `;
  },

  calcFD() {
    const P = Number(document.getElementById('fdAmount').value);
    const r = Number(document.getElementById('fdRate').value) / 100;
    const n = Number(document.getElementById('fdYears').value);
    const quarterly = P * Math.pow(1 + r / 4, 4 * n);
    const interest = quarterly - P;
    const chartLabels = [], chartInvested = [], chartProjected = [];
    const maxYears = Math.ceil(n);
    for (let y = 1; y <= maxYears; y++) {
      const yr = Math.min(y, n);
      chartLabels.push('Year ' + y);
      chartInvested.push(P);
      chartProjected.push(P * Math.pow(1 + r / 4, 4 * yr));
    }
    document.getElementById('fdResult').innerHTML = `
      <div class="calc-result-box">
        <h4>Results (Quarterly Compounding)</h4>
        <div class="calc-result-row"><span>Principal</span><strong>${Utils.currencyFull(P)}</strong></div>
        <div class="calc-result-row"><span>Interest Earned</span><strong class="text-green">${Utils.currencyFull(interest)}</strong></div>
        <div class="calc-result-row"><span>Maturity Amount</span><strong>${Utils.currencyFull(quarterly)}</strong></div>
        <div class="chart-container" style="height:250px;margin-top:16px"><canvas id="calcChart_fd"></canvas></div>
      </div>
    `;
    this._renderGrowthChart('calcChart_fd', chartLabels, chartInvested, chartProjected);
  },

  // ─── EMI ──────────────────
  emiCalcHTML() {
    return `
      <div class="card">
        <div class="card-header"><div class="card-title">🏠 EMI Calculator</div></div>
        <div class="form-row-3">
          <div class="form-group"><label>Loan Amount (₹)</label><input class="form-control" type="number" id="emiAmount" value="3000000"></div>
          <div class="form-group"><label>Interest Rate (%)</label><input class="form-control" type="number" step="0.1" id="emiRate" value="8.5"></div>
          <div class="form-group"><label>Tenure (Years)</label><input class="form-control" type="number" id="emiYears" value="20"></div>
        </div>
        <button class="btn btn-primary btn-sm" onclick="CalculatorsPage.calcEMI()">Calculate</button>
        <div id="emiResult"></div>
      </div>
    `;
  },

  calcEMI() {
    const P = Number(document.getElementById('emiAmount').value);
    const r = Number(document.getElementById('emiRate').value) / 100 / 12;
    const years = Number(document.getElementById('emiYears').value);
    const n = years * 12;
    const emi = P * r * Math.pow(1 + r, n) / (Math.pow(1 + r, n) - 1);
    const totalPay = emi * n;
    const totalInterest = totalPay - P;
    const chartLabels = [], chartPrincipal = [], chartInterest = [], chartRemaining = [];
    let outstanding = P, cumPrincipal = 0, cumInterest = 0;
    for (let y = 1; y <= years; y++) {
      for (let m = 0; m < 12; m++) {
        const intPart = outstanding * r;
        const prinPart = emi - intPart;
        cumInterest += intPart;
        cumPrincipal += prinPart;
        outstanding -= prinPart;
      }
      chartLabels.push('Yr ' + y);
      chartPrincipal.push(cumPrincipal);
      chartInterest.push(cumInterest);
      chartRemaining.push(Math.max(0, outstanding));
    }
    document.getElementById('emiResult').innerHTML = `
      <div class="calc-result-box">
        <h4>Results</h4>
        <div class="calc-result-row"><span>Monthly EMI</span><strong>${Utils.currencyFull(emi)}</strong></div>
        <div class="calc-result-row"><span>Total Interest</span><strong class="text-red">${Utils.currencyFull(totalInterest)}</strong></div>
        <div class="calc-result-row"><span>Total Payment</span><strong>${Utils.currencyFull(totalPay)}</strong></div>
        <div class="chart-container" style="height:220px;margin-top:16px"><canvas id="emiChart"></canvas></div>
      </div>
    `;
    requestAnimationFrame(async () => {
      await Charts.line('emiChart', chartLabels, [
        { label: 'Principal Paid', data: chartPrincipal, color: '#6366f1', fill: false },
        { label: 'Interest Paid', data: chartInterest, color: '#f59e0b', fill: false },
        { label: 'Remaining Balance', data: chartRemaining, color: '#10b981', fill: false }
      ]);
    });
  },

  // ─── Goal Planner ──────────────────
  goalPlannerHTML() {
    return `
      <div class="card">
        <div class="card-header"><div class="card-title">🎯 Goal Planner</div></div>
        <div class="form-row">
          <div class="form-group"><label>Goal Amount (₹)</label><input class="form-control" type="number" id="goalAmt" value="5000000"></div>
          <div class="form-group"><label>Years to Goal</label><input class="form-control" type="number" id="goalYears" value="10"></div>
        </div>
        <div class="form-row">
          <div class="form-group"><label>Expected Return (%)</label><input class="form-control" type="number" step="0.1" id="goalRate" value="12"></div>
          <div class="form-group"><label>Inflation (%)</label><input class="form-control" type="number" step="0.1" id="goalInflation" value="6"></div>
        </div>
        <button class="btn btn-primary btn-sm" onclick="CalculatorsPage.calcGoal()">Calculate</button>
        <div id="goalResult"></div>
      </div>
    `;
  },

  calcGoal() {
    const target = Number(document.getElementById('goalAmt').value);
    const years = Number(document.getElementById('goalYears').value);
    const ret = Number(document.getElementById('goalRate').value) / 100;
    const inf = Number(document.getElementById('goalInflation').value) / 100;
    const inflAdj = target * Math.pow(1 + inf, years);
    const r = ret / 12;
    const n = years * 12;
    const sip = inflAdj * r / (Math.pow(1 + r, n) - 1) / (1 + r);
    const lumpsum = inflAdj / Math.pow(1 + ret, years);
    const chartLabels = [], chartInvested = [], chartProjected = [], chartGoalLine = [];
    for (let y = 1; y <= years; y++) {
      chartLabels.push('Yr ' + y);
      chartInvested.push(sip * 12 * y);
      chartProjected.push(sip * ((Math.pow(1 + r, y * 12) - 1) / r) * (1 + r));
      chartGoalLine.push(inflAdj);
    }
    document.getElementById('goalResult').innerHTML = `
      <div class="calc-result-box">
        <h4>Results</h4>
        <div class="calc-result-row"><span>Inflation-adjusted Goal</span><strong>${Utils.currencyFull(inflAdj)}</strong></div>
        <div class="calc-result-row"><span>Required Monthly SIP</span><strong class="text-accent">${Utils.currencyFull(sip)}</strong></div>
        <div class="calc-result-row"><span>Or One-time Lumpsum</span><strong>${Utils.currencyFull(lumpsum)}</strong></div>
        <div class="chart-container" style="height:220px;margin-top:16px"><canvas id="goalChart"></canvas></div>
      </div>
    `;
    requestAnimationFrame(async () => {
      await Charts.line('goalChart', chartLabels, [
        { label: 'Invested', data: chartInvested, color: '#6366f1', fill: false },
        { label: 'SIP Accumulation', data: chartProjected, color: '#10b981', fill: false },
        { label: 'Goal Target', data: chartGoalLine, color: '#ef4444', fill: false, borderDash: [6, 3], pointRadius: 0 }
      ]);
    });
  },

  // ─── EPF ──────────────────
  epfCalcHTML() {
    return `
      <div class="card">
        <div class="card-header"><div class="card-title">🏛️ EPF Calculator</div></div>
        <div class="form-row">
          <div class="form-group"><label>Monthly Basic Salary (₹)</label><input class="form-control" type="number" id="epfBasic" value="28000"></div>
          <div class="form-group"><label>EPF Rate (% of Basic)</label><input class="form-control" type="number" step="0.1" id="epfRate" value="24"></div>
        </div>
        <div class="form-row">
          <div class="form-group"><label>Interest Rate (% p.a.)</label><input class="form-control" type="number" step="0.1" id="epfInterest" value="8.15"></div>
          <div class="form-group"><label>Years to Retirement</label><input class="form-control" type="number" id="epfYears" value="25"></div>
        </div>
        <div class="form-group"><label>Annual Salary Increment (%)</label><input class="form-control" type="number" step="0.5" id="epfIncrement" value="5" style="max-width:200px"></div>
        <button class="btn btn-primary btn-sm" onclick="CalculatorsPage.calcEPF()">Calculate</button>
        <div id="epfResult"></div>
      </div>
    `;
  },

  calcEPF() {
    let basic = Number(document.getElementById('epfBasic').value);
    const epfPct = Number(document.getElementById('epfRate').value) / 100;
    const interest = Number(document.getElementById('epfInterest').value) / 100;
    const years = Number(document.getElementById('epfYears').value);
    const increment = Number(document.getElementById('epfIncrement').value) / 100;
    let balance = 0, totalContrib = 0;
    const chartLabels = [], chartInvested = [], chartProjected = [];
    for (let y = 0; y < years; y++) {
      const monthly = basic * epfPct;
      for (let m = 0; m < 12; m++) {
        balance += monthly;
        totalContrib += monthly;
        balance *= (1 + interest / 12);
      }
      basic *= (1 + increment);
      chartLabels.push('Year ' + (y + 1));
      chartInvested.push(totalContrib);
      chartProjected.push(balance);
    }
    document.getElementById('epfResult').innerHTML = `
      <div class="calc-result-box">
        <h4>Results</h4>
        <div class="calc-result-row"><span>Total Contribution</span><strong>${Utils.currencyFull(totalContrib)}</strong></div>
        <div class="calc-result-row"><span>Interest Earned</span><strong class="text-green">${Utils.currencyFull(balance - totalContrib)}</strong></div>
        <div class="calc-result-row"><span>Maturity Value</span><strong>${Utils.currencyFull(balance)}</strong></div>
        <div class="chart-container" style="height:250px;margin-top:16px"><canvas id="calcChart_epf"></canvas></div>
      </div>
    `;
    this._renderGrowthChart('calcChart_epf', chartLabels, chartInvested, chartProjected);
  },

  // ─── FIRE ──────────────────
  fireCalcHTML() {
    return `
      <div class="card">
        <div class="card-header"><div class="card-title">🔥 FIRE Calculator</div></div>
        <div class="form-row">
          <div class="form-group"><label>Monthly Expenses (₹)</label><input class="form-control" type="number" id="fireExpense" value="50000"></div>
          <div class="form-group"><label>Current Portfolio (₹)</label><input class="form-control" type="number" id="firePortfolio" value="1000000"></div>
        </div>
        <div class="form-row">
          <div class="form-group"><label>Monthly Investment (₹)</label><input class="form-control" type="number" id="fireInvest" value="30000"></div>
          <div class="form-group"><label>Expected Return (%)</label><input class="form-control" type="number" step="0.1" id="fireReturn" value="10"></div>
        </div>
        <div class="form-row">
          <div class="form-group"><label>Safe Withdrawal Rate (%)</label><input class="form-control" type="number" step="0.1" id="fireSWR" value="4"></div>
          <div class="form-group"><label>Inflation (%)</label><input class="form-control" type="number" step="0.1" id="fireInflation" value="6"></div>
        </div>
        <button class="btn btn-primary btn-sm" onclick="CalculatorsPage.calcFIRE()">Calculate</button>
        <div id="fireResult"></div>
      </div>
    `;
  },

  calcFIRE() {
    const monthlyExp = Number(document.getElementById('fireExpense').value);
    const annualExp = monthlyExp * 12;
    const swr = Number(document.getElementById('fireSWR').value) / 100;
    const fireNumber = annualExp / swr;
    let portfolio = Number(document.getElementById('firePortfolio').value);
    const monthlyInvest = Number(document.getElementById('fireInvest').value);
    const ret = Number(document.getElementById('fireReturn').value) / 100 / 12;
    let months = 0;
    const chartLabels = [], chartInvested = [], chartProjected = [];
    let cumInvested = Number(document.getElementById('firePortfolio').value);
    let portfolioTrack = Number(document.getElementById('firePortfolio').value);
    while (portfolioTrack < fireNumber && months < 1200) {
      portfolioTrack = portfolioTrack * (1 + ret) + monthlyInvest;
      cumInvested += monthlyInvest;
      months++;
      if (months % 12 === 0) {
        chartLabels.push('Year ' + (months / 12));
        chartInvested.push(cumInvested);
        chartProjected.push(portfolioTrack);
      }
    }
    const years = months / 12;
    // Capture last partial year if needed
    if (months % 12 !== 0) {
      chartLabels.push('Year ' + Math.ceil(years));
      chartInvested.push(cumInvested);
      chartProjected.push(portfolioTrack);
    }
    portfolio = portfolioTrack;
    document.getElementById('fireResult').innerHTML = `
      <div class="calc-result-box">
        <h4>Results</h4>
        <div class="calc-result-row"><span>FIRE Number (Annual Exp / SWR)</span><strong>${Utils.currencyFull(fireNumber)}</strong></div>
        <div class="calc-result-row"><span>Years to FIRE</span><strong class="text-accent">${Math.ceil(years)} years</strong></div>
        <div class="calc-result-row"><span>FIRE Age (if started at 25)</span><strong>${25 + Math.ceil(years)} years old</strong></div>
        <div class="chart-container" style="height:220px;margin-top:16px"><canvas id="fireChart"></canvas></div>
      </div>
    `;
    const chartFireLine = chartLabels.map(() => fireNumber);
    requestAnimationFrame(async () => {
      await Charts.line('fireChart', chartLabels, [
        { label: 'Invested', data: chartInvested, color: '#6366f1', fill: false },
        { label: 'Portfolio', data: chartProjected, color: '#10b981', fill: false },
        { label: 'FIRE Number', data: chartFireLine, color: '#ef4444', fill: false, borderDash: [6, 3], pointRadius: 0 }
      ]);
    });
  },

  // ─── Gold-Silver Ratio ──────────────────
  async loadGoldSilverRatio(el, back) {
    el.innerHTML = back + '<div class="card"><div class="loading" style="padding:20px"><div class="spinner"></div> Loading...</div></div>';
    try {
      const res = await API.getGoldSilverRatio();
      if (!res.success) {
        el.innerHTML = back + `<div class="card"><p class="text-muted" style="padding:20px">${res.error}</p></div>`;
        return;
      }
      const ratioColor = res.ratio > 80 ? 'var(--green)' : res.ratio < 50 ? 'var(--yellow)' : 'var(--accent)';
      el.innerHTML = back + `
        <div class="card">
          <div class="card-header"><div class="card-title">🥇 Gold-Silver Ratio Analysis</div></div>
          <div class="calc-result-box">
            <div class="calc-result-row"><span>Gold Price (per gram)</span><strong>${Utils.currencyFull(res.goldPrice)}</strong></div>
            <div class="calc-result-row"><span>Silver Price (per gram)</span><strong>${Utils.currencyFull(res.silverPrice)}</strong></div>
            <div class="calc-result-row"><span>Current Ratio</span><strong style="color:${ratioColor};font-size:1.3rem">${res.ratio}</strong></div>
            <div class="calc-result-row"><span>Historical Average</span><strong>${res.historicalAvg}</strong></div>
            <div class="calc-result-row"><span>Assessment</span><strong>${res.assessment}</strong></div>
          </div>
          <div style="padding:16px;margin-top:12px;background:var(--bg-secondary);border-radius:8px">
            <p style="font-size:0.88rem;line-height:1.5">${res.suggestion}</p>
          </div>
        </div>
      `;
    } catch (e) {
      el.innerHTML = back + `<div class="card"><p class="text-muted" style="padding:20px">Error: ${e.message}</p></div>`;
    }
  },

  // ─── CAGR Calculator ──────────────────
  cagrCalcHTML() {
    return `
      <div class="card">
        <div class="card-header"><div class="card-title">📐 CAGR Calculator</div></div>
        <div class="form-row-3">
          <div class="form-group"><label>Initial Value (₹)</label><input class="form-control" type="number" id="cagrInitial" value="100000"></div>
          <div class="form-group"><label>Final Value (₹)</label><input class="form-control" type="number" id="cagrFinal" value="200000"></div>
          <div class="form-group"><label>Time Period (Years)</label><input class="form-control" type="number" step="0.5" id="cagrYears" value="5"></div>
        </div>
        <button class="btn btn-primary btn-sm" onclick="CalculatorsPage.calcCAGR()">Calculate</button>
        <div id="cagrResult"></div>
      </div>
    `;
  },

  calcCAGR() {
    const pv = +document.getElementById('cagrInitial').value;
    const fv = +document.getElementById('cagrFinal').value;
    const n = +document.getElementById('cagrYears').value;
    if (pv <= 0 || n <= 0) { document.getElementById('cagrResult').innerHTML = '<p class="text-red" style="margin-top:12px">Enter valid positive values.</p>'; return; }
    const cagr = (Math.pow(fv / pv, 1 / n) - 1) * 100;
    const absRet = ((fv - pv) / pv) * 100;
    document.getElementById('cagrResult').innerHTML = `
      <div class="calc-result-box">
        <h4>Results</h4>
        <div class="calc-result-row"><span>CAGR</span><strong class="${cagr >= 0 ? 'text-green' : 'text-red'}">${cagr.toFixed(2)}%</strong></div>
        <div class="calc-result-row"><span>Absolute Return</span><strong>${absRet.toFixed(2)}%</strong></div>
        <div class="calc-result-row"><span>Total Gain / Loss</span><strong class="${fv - pv >= 0 ? 'text-green' : 'text-red'}">${Utils.currencyFull(fv - pv)}</strong></div>
      </div>
    `;
  },

  // ─── XIRR Calculator ──────────────────
  xirrCalcHTML() {
    const today = new Date().toISOString().split('T')[0];
    const oneYearAgo = new Date(Date.now() - 365 * 86400000).toISOString().split('T')[0];
    const sixMonthsAgo = new Date(Date.now() - 182 * 86400000).toISOString().split('T')[0];
    if (!this._xirrCashflows) {
      this._xirrCashflows = [
        { date: oneYearAgo, amount: -100000 },
        { date: sixMonthsAgo, amount: -50000 },
        { date: today, amount: 180000 }
      ];
    }
    return `
      <div class="card">
        <div class="card-header"><div class="card-title">📉 XIRR Calculator</div></div>
        <p style="font-size:0.85rem;color:var(--text-muted);margin-bottom:12px">Enter cash flows: negative for investments, positive for redemptions</p>
        <div id="xirrTableWrap">${this._renderXirrTable()}</div>
        <div style="margin:12px 0;display:flex;gap:8px;flex-wrap:wrap">
          <button class="btn btn-outline btn-sm" onclick="CalculatorsPage.addXirrRow()">+ Add Row</button>
          <button class="btn btn-primary btn-sm" onclick="CalculatorsPage.calcXIRR()">Calculate XIRR</button>
        </div>
        <div id="xirrResult"></div>
      </div>
    `;
  },

  _renderXirrTable() {
    return `
      <div style="overflow-x:auto">
      <table class="data-table" style="margin-bottom:8px">
        <thead><tr><th>Date</th><th>Amount (₹)</th><th></th></tr></thead>
        <tbody>
          ${this._xirrCashflows.map((cf, i) => `
            <tr>
              <td><input class="form-control" type="date" id="xirrDate${i}" value="${cf.date}" style="min-width:140px"></td>
              <td><input class="form-control" type="number" id="xirrAmt${i}" value="${cf.amount}"></td>
              <td><button class="btn btn-outline btn-sm" onclick="CalculatorsPage.removeXirrRow(${i})" style="color:var(--red)">&times;</button></td>
            </tr>
          `).join('')}
        </tbody>
      </table>
      </div>
    `;
  },

  _saveXirrInputs() {
    this._xirrCashflows = this._xirrCashflows.map((cf, i) => ({
      date: document.getElementById('xirrDate' + i)?.value || cf.date,
      amount: Number(document.getElementById('xirrAmt' + i)?.value ?? cf.amount)
    }));
  },

  addXirrRow() {
    this._saveXirrInputs();
    this._xirrCashflows.push({ date: new Date().toISOString().split('T')[0], amount: 0 });
    document.getElementById('xirrTableWrap').innerHTML = this._renderXirrTable();
  },

  removeXirrRow(idx) {
    if (this._xirrCashflows.length <= 2) return;
    this._saveXirrInputs();
    this._xirrCashflows.splice(idx, 1);
    document.getElementById('xirrTableWrap').innerHTML = this._renderXirrTable();
  },

  calcXIRR() {
    this._saveXirrInputs();
    const cfs = [...this._xirrCashflows].sort((a, b) => new Date(a.date) - new Date(b.date));
    if (cfs.length < 2) { document.getElementById('xirrResult').innerHTML = '<p class="text-red" style="margin-top:12px">Need at least 2 cash flows.</p>'; return; }
    const dates = cfs.map(c => new Date(c.date));
    const amounts = cfs.map(c => c.amount);
    const d0 = dates[0];
    const yearFracs = dates.map(d => (d - d0) / (365.25 * 86400000));
    let rate = 0.1;
    for (let iter = 0; iter < 1000; iter++) {
      let f = 0, df = 0;
      for (let i = 0; i < amounts.length; i++) {
        const t = yearFracs[i];
        const denom = Math.pow(1 + rate, t);
        f += amounts[i] / denom;
        if (t !== 0) df -= t * amounts[i] / Math.pow(1 + rate, t + 1);
      }
      if (Math.abs(df) < 1e-14) break;
      const newRate = rate - f / df;
      if (Math.abs(newRate - rate) < 1e-10) { rate = newRate; break; }
      rate = newRate;
      if (rate < -0.99) { rate = -0.99; break; }
    }
    const xirrPct = rate * 100;
    const totalInv = cfs.filter(c => c.amount < 0).reduce((s, c) => s + Math.abs(c.amount), 0);
    const totalRed = cfs.filter(c => c.amount > 0).reduce((s, c) => s + c.amount, 0);
    document.getElementById('xirrResult').innerHTML = `
      <div class="calc-result-box">
        <h4>Results</h4>
        <div class="calc-result-row"><span>XIRR (Annualized)</span><strong class="${xirrPct >= 0 ? 'text-green' : 'text-red'}">${xirrPct.toFixed(2)}%</strong></div>
        <div class="calc-result-row"><span>Total Invested</span><strong>${Utils.currencyFull(totalInv)}</strong></div>
        <div class="calc-result-row"><span>Total Redeemed</span><strong>${Utils.currencyFull(totalRed)}</strong></div>
        <div class="calc-result-row"><span>Net Gain / Loss</span><strong class="${totalRed - totalInv >= 0 ? 'text-green' : 'text-red'}">${Utils.currencyFull(totalRed - totalInv)}</strong></div>
      </div>
    `;
  },

  // ─── PPF Calculator ──────────────────
  ppfCalcHTML() {
    return `
      <div class="card">
        <div class="card-header"><div class="card-title">🏦 PPF Calculator</div></div>
        <div class="form-row-3">
          <div class="form-group"><label>Annual Deposit (₹)</label><input class="form-control" type="number" id="ppfDeposit" value="150000"></div>
          <div class="form-group"><label>Duration (Years, 15-50)</label><input class="form-control" type="number" id="ppfYears" value="15" min="15" max="50"></div>
          <div class="form-group"><label>Interest Rate (%)</label><input class="form-control" type="number" step="0.1" id="ppfRate" value="7.1"></div>
        </div>
        <button class="btn btn-primary btn-sm" onclick="CalculatorsPage.calcPPF()">Calculate</button>
        <div id="ppfResult"></div>
      </div>
    `;
  },

  calcPPF() {
    const deposit = +document.getElementById('ppfDeposit').value;
    let years = +document.getElementById('ppfYears').value;
    const rate = +document.getElementById('ppfRate').value / 100;
    if (years < 15) years = 15;
    // PPF: deposits allowed for first 15 years, then extended in 5-year blocks with or without deposits
    // For simplicity, allow deposits every year for full duration
    let balance = 0;
    let totalDeposited = 0;
    let tableRows = '';
    const chartLabels = [], chartInvested = [], chartProjected = [];
    for (let y = 1; y <= years; y++) {
      balance += deposit;
      totalDeposited += deposit;
      const interest = balance * rate;
      balance += interest;
      tableRows += `<tr><td>${y}</td><td>${Utils.currencyFull(deposit)}</td><td>${Utils.currencyFull(interest)}</td><td>${Utils.currencyFull(balance)}</td></tr>`;
      chartLabels.push('Year ' + y);
      chartInvested.push(totalDeposited);
      chartProjected.push(balance);
    }
    const totalInterest = balance - totalDeposited;
    document.getElementById('ppfResult').innerHTML = `
      <div class="calc-result-box">
        <h4>Results</h4>
        <div class="calc-result-row"><span>Total Deposited</span><strong>${Utils.currencyFull(totalDeposited)}</strong></div>
        <div class="calc-result-row"><span>Total Interest Earned</span><strong class="text-green">${Utils.currencyFull(totalInterest)}</strong></div>
        <div class="calc-result-row"><span>Maturity Value</span><strong>${Utils.currencyFull(balance)}</strong></div>
        <div class="chart-container" style="height:250px;margin-top:16px"><canvas id="calcChart_ppf"></canvas></div>
      </div>
      <details style="margin-top:12px"><summary style="cursor:pointer;font-weight:600;font-size:0.9rem">Year-wise Breakdown</summary>
        <div style="overflow-x:auto;margin-top:8px">
        <table class="data-table"><thead><tr><th>Year</th><th>Deposit</th><th>Interest</th><th>Balance</th></tr></thead>
        <tbody>${tableRows}</tbody></table>
        </div>
      </details>
    `;
    this._renderGrowthChart('calcChart_ppf', chartLabels, chartInvested, chartProjected);
  },

  // ─── NPS Calculator ──────────────────
  npsCalcHTML() {
    return `
      <div class="card">
        <div class="card-header"><div class="card-title">🏛️ NPS Calculator</div></div>
        <div class="form-row-3">
          <div class="form-group"><label>Monthly Contribution (₹)</label><input class="form-control" type="number" id="npsContrib" value="5000"></div>
          <div class="form-group"><label>Current Age</label><input class="form-control" type="number" id="npsAge" value="30"></div>
          <div class="form-group"><label>Retirement Age</label><input class="form-control" type="number" id="npsRetAge" value="60"></div>
        </div>
        <div class="form-row-3">
          <div class="form-group"><label>Equity Allocation (%)</label><input class="form-control" type="number" id="npsEquity" value="50"></div>
          <div class="form-group"><label>Corporate Debt (%)</label><input class="form-control" type="number" id="npsDebt" value="30"></div>
          <div class="form-group"><label>Govt Securities (%)</label><input class="form-control" type="number" id="npsGovt" value="20"></div>
        </div>
        <div class="form-row">
          <div class="form-group"><label>Annuity Purchase (%, min 40)</label><input class="form-control" type="number" id="npsAnnuity" value="40" min="40" max="100"></div>
          <div class="form-group"><label>Annuity Interest Rate (%)</label><input class="form-control" type="number" step="0.1" id="npsAnnuityRate" value="6"></div>
        </div>
        <p style="font-size:0.8rem;color:var(--text-muted);margin-bottom:8px">Assumed returns: Equity 12%, Corporate Debt 8%, Govt Securities 7%</p>
        <button class="btn btn-primary btn-sm" onclick="CalculatorsPage.calcNPS()">Calculate</button>
        <div id="npsResult"></div>
      </div>
    `;
  },

  calcNPS() {
    const monthly = +document.getElementById('npsContrib').value;
    const curAge = +document.getElementById('npsAge').value;
    const retAge = +document.getElementById('npsRetAge').value;
    const eqPct = +document.getElementById('npsEquity').value / 100;
    const debtPct = +document.getElementById('npsDebt').value / 100;
    const govtPct = +document.getElementById('npsGovt').value / 100;
    let annuityPct = +document.getElementById('npsAnnuity').value / 100;
    const annuityRate = +document.getElementById('npsAnnuityRate').value / 100;
    if (annuityPct < 0.4) annuityPct = 0.4;
    const totalAlloc = eqPct + debtPct + govtPct;
    if (Math.abs(totalAlloc - 1) > 0.01) {
      document.getElementById('npsResult').innerHTML = '<p class="text-red" style="margin-top:12px">Equity + Debt + Govt allocations must total 100%.</p>';
      return;
    }
    const blendedReturn = eqPct * 0.12 + debtPct * 0.08 + govtPct * 0.07;
    const r = blendedReturn / 12;
    const yearsToRetire = retAge - curAge;
    const n = yearsToRetire * 12;
    const totalInvested = monthly * n;
    const corpus = monthly * ((Math.pow(1 + r, n) - 1) / r) * (1 + r);
    const lumpSum = corpus * (1 - annuityPct);
    const annuityCorpus = corpus * annuityPct;
    const monthlyPension = (annuityCorpus * annuityRate) / 12;
    const chartLabels = [], chartInvested = [], chartProjected = [];
    for (let y = 1; y <= yearsToRetire; y++) {
      chartLabels.push('Year ' + y);
      chartInvested.push(monthly * 12 * y);
      chartProjected.push(monthly * ((Math.pow(1 + r, y * 12) - 1) / r) * (1 + r));
    }
    document.getElementById('npsResult').innerHTML = `
      <div class="calc-result-box">
        <h4>Results</h4>
        <div class="calc-result-row"><span>Blended Expected Return</span><strong>${(blendedReturn * 100).toFixed(2)}% p.a.</strong></div>
        <div class="calc-result-row"><span>Total Invested</span><strong>${Utils.currencyFull(totalInvested)}</strong></div>
        <div class="calc-result-row"><span>Projected Corpus at ${retAge}</span><strong>${Utils.currencyFull(corpus)}</strong></div>
        <div class="calc-result-row"><span>Lump Sum Withdrawal (${((1 - annuityPct) * 100).toFixed(0)}%)</span><strong class="text-green">${Utils.currencyFull(lumpSum)}</strong></div>
        <div class="calc-result-row"><span>Annuity Corpus (${(annuityPct * 100).toFixed(0)}%)</span><strong>${Utils.currencyFull(annuityCorpus)}</strong></div>
        <div class="calc-result-row"><span>Estimated Monthly Pension</span><strong class="text-accent">${Utils.currencyFull(monthlyPension)}</strong></div>
        <div class="chart-container" style="height:250px;margin-top:16px"><canvas id="calcChart_nps"></canvas></div>
      </div>
    `;
    this._renderGrowthChart('calcChart_nps', chartLabels, chartInvested, chartProjected);
  },

  // ─── SSY Calculator ──────────────────
  ssyCalcHTML() {
    return `
      <div class="card">
        <div class="card-header"><div class="card-title">👧 SSY Calculator (Sukanya Samriddhi Yojana)</div></div>
        <div class="form-row-3">
          <div class="form-group"><label>Annual Deposit (₹)</label><input class="form-control" type="number" id="ssyDeposit" value="150000"></div>
          <div class="form-group"><label>Girl Child's Current Age</label><input class="form-control" type="number" id="ssyAge" value="5" min="0" max="10"></div>
          <div class="form-group"><label>Interest Rate (%)</label><input class="form-control" type="number" step="0.1" id="ssyRate" value="8.2"></div>
        </div>
        <p style="font-size:0.8rem;color:var(--text-muted);margin-bottom:8px">Deposits for 15 years from account opening. Account matures when girl turns 21.</p>
        <button class="btn btn-primary btn-sm" onclick="CalculatorsPage.calcSSY()">Calculate</button>
        <div id="ssyResult"></div>
      </div>
    `;
  },

  calcSSY() {
    const deposit = +document.getElementById('ssyDeposit').value;
    let childAge = +document.getElementById('ssyAge').value;
    const rate = +document.getElementById('ssyRate').value / 100;
    if (childAge > 10) childAge = 10;
    const depositYears = 15;
    const maturityYear = 21 - childAge; // years from now until maturity
    let balance = 0;
    let totalDeposited = 0;
    let tableRows = '';
    const chartLabels = [], chartInvested = [], chartProjected = [];
    for (let y = 1; y <= maturityYear; y++) {
      if (y <= depositYears) {
        balance += deposit;
        totalDeposited += deposit;
      }
      const interest = balance * rate;
      balance += interest;
      tableRows += `<tr><td>${y}</td><td>Age ${childAge + y}</td><td>${y <= depositYears ? Utils.currencyFull(deposit) : '—'}</td><td>${Utils.currencyFull(interest)}</td><td>${Utils.currencyFull(balance)}</td></tr>`;
      chartLabels.push('Year ' + y);
      chartInvested.push(totalDeposited);
      chartProjected.push(balance);
    }
    document.getElementById('ssyResult').innerHTML = `
      <div class="calc-result-box">
        <h4>Results</h4>
        <div class="calc-result-row"><span>Total Deposited (15 years)</span><strong>${Utils.currencyFull(totalDeposited)}</strong></div>
        <div class="calc-result-row"><span>Total Interest Earned</span><strong class="text-green">${Utils.currencyFull(balance - totalDeposited)}</strong></div>
        <div class="calc-result-row"><span>Maturity Value (at age 21)</span><strong>${Utils.currencyFull(balance)}</strong></div>
        <div class="chart-container" style="height:250px;margin-top:16px"><canvas id="calcChart_ssy"></canvas></div>
      </div>
      <details style="margin-top:12px"><summary style="cursor:pointer;font-weight:600;font-size:0.9rem">Year-wise Breakdown</summary>
        <div style="overflow-x:auto;margin-top:8px">
        <table class="data-table"><thead><tr><th>Year</th><th>Age</th><th>Deposit</th><th>Interest</th><th>Balance</th></tr></thead>
        <tbody>${tableRows}</tbody></table>
        </div>
      </details>
    `;
    this._renderGrowthChart('calcChart_ssy', chartLabels, chartInvested, chartProjected);
  },

  // ─── RD Calculator ──────────────────
  rdCalcHTML() {
    return `
      <div class="card">
        <div class="card-header"><div class="card-title">💳 RD Calculator (Recurring Deposit)</div></div>
        <div class="form-row-3">
          <div class="form-group"><label>Monthly Deposit (₹)</label><input class="form-control" type="number" id="rdDeposit" value="5000"></div>
          <div class="form-group"><label>Interest Rate (% p.a.)</label><input class="form-control" type="number" step="0.1" id="rdRate" value="6.5"></div>
          <div class="form-group"><label>Duration (Months)</label><input class="form-control" type="number" id="rdMonths" value="60"></div>
        </div>
        <p style="font-size:0.8rem;color:var(--text-muted);margin-bottom:8px">Indian RDs use quarterly compounding.</p>
        <button class="btn btn-primary btn-sm" onclick="CalculatorsPage.calcRD()">Calculate</button>
        <div id="rdResult"></div>
      </div>
    `;
  },

  calcRD() {
    const P = +document.getElementById('rdDeposit').value;
    const rate = +document.getElementById('rdRate').value / 100;
    const months = +document.getElementById('rdMonths').value;
    const qr = rate / 4;
    let balance = 0;
    const chartLabels = [], chartInvested = [], chartProjected = [];
    for (let m = 1; m <= months; m++) {
      balance += P;
      if (m % 3 === 0) {
        balance += balance * qr;
      }
      if (m % 12 === 0 || m === months) {
        chartLabels.push(m % 12 === 0 ? 'Year ' + (m / 12) : 'M' + m);
        chartInvested.push(P * m);
        chartProjected.push(balance);
      }
    }
    // If remaining months not divisible by 3, apply proportional interest
    const leftover = months % 3;
    if (leftover > 0) {
      balance += balance * (rate / 12) * leftover;
      // Update last projected value with final balance
      chartProjected[chartProjected.length - 1] = balance;
    }
    const totalDeposited = P * months;
    const interest = balance - totalDeposited;
    document.getElementById('rdResult').innerHTML = `
      <div class="calc-result-box">
        <h4>Results (Quarterly Compounding)</h4>
        <div class="calc-result-row"><span>Total Deposited</span><strong>${Utils.currencyFull(totalDeposited)}</strong></div>
        <div class="calc-result-row"><span>Interest Earned</span><strong class="text-green">${Utils.currencyFull(interest)}</strong></div>
        <div class="calc-result-row"><span>Maturity Value</span><strong>${Utils.currencyFull(balance)}</strong></div>
        <div class="chart-container" style="height:250px;margin-top:16px"><canvas id="calcChart_rd"></canvas></div>
      </div>
    `;
    this._renderGrowthChart('calcChart_rd', chartLabels, chartInvested, chartProjected);
  },

  // ─── Gratuity Calculator ──────────────────
  gratuityCalcHTML() {
    return `
      <div class="card">
        <div class="card-header"><div class="card-title">🎁 Gratuity Calculator</div></div>
        <div class="form-row">
          <div class="form-group"><label>Last Drawn Salary — Basic + DA (₹/month)</label><input class="form-control" type="number" id="gratSalary" value="50000"></div>
          <div class="form-group"><label>Years of Service</label><input class="form-control" type="number" step="0.5" id="gratYears" value="10"></div>
        </div>
        <p style="font-size:0.8rem;color:var(--text-muted);margin-bottom:8px">Formula: (15 &times; Last Drawn Salary &times; Years of Service) / 26. Applicable after 5 years of service.</p>
        <button class="btn btn-primary btn-sm" onclick="CalculatorsPage.calcGratuity()">Calculate</button>
        <div id="gratResult"></div>
      </div>
    `;
  },

  calcGratuity() {
    const salary = +document.getElementById('gratSalary').value;
    const years = +document.getElementById('gratYears').value;
    const gratuity = (15 * salary * years) / 26;
    const taxFree = Math.min(gratuity, 2000000); // max tax-free gratuity is ₹20 lakh
    const taxable = Math.max(0, gratuity - 2000000);
    document.getElementById('gratResult').innerHTML = `
      <div class="calc-result-box">
        <h4>Results</h4>
        <div class="calc-result-row"><span>Gratuity Amount</span><strong class="text-green">${Utils.currencyFull(gratuity)}</strong></div>
        <div class="calc-result-row"><span>Tax-Free Portion (max ₹20L)</span><strong>${Utils.currencyFull(taxFree)}</strong></div>
        <div class="calc-result-row"><span>Taxable Portion</span><strong>${Utils.currencyFull(taxable)}</strong></div>
        ${years < 5 ? '<p class="text-red" style="margin-top:8px;font-size:0.85rem">Note: Gratuity is typically payable only after 5 years of continuous service.</p>' : ''}
      </div>
    `;
  },

  // ─── HRA Calculator ──────────────────
  hraCalcHTML() {
    return `
      <div class="card">
        <div class="card-header"><div class="card-title">🏘️ HRA Exemption Calculator</div></div>
        <div class="form-row">
          <div class="form-group"><label>Basic Salary (Annual ₹)</label><input class="form-control" type="number" id="hraBasic" value="600000"></div>
          <div class="form-group"><label>HRA Received (Annual ₹)</label><input class="form-control" type="number" id="hraReceived" value="300000"></div>
        </div>
        <div class="form-row">
          <div class="form-group"><label>Rent Paid (Annual ₹)</label><input class="form-control" type="number" id="hraRent" value="240000"></div>
          <div class="form-group">
            <label>City Type</label>
            <select class="form-control" id="hraMetro">
              <option value="metro">Metro (Delhi, Mumbai, Kolkata, Chennai)</option>
              <option value="nonmetro">Non-Metro</option>
            </select>
          </div>
        </div>
        <button class="btn btn-primary btn-sm" onclick="CalculatorsPage.calcHRA()">Calculate</button>
        <div id="hraResult"></div>
      </div>
    `;
  },

  calcHRA() {
    const basic = +document.getElementById('hraBasic').value;
    const hraRcvd = +document.getElementById('hraReceived').value;
    const rent = +document.getElementById('hraRent').value;
    const isMetro = document.getElementById('hraMetro').value === 'metro';
    const pctOfBasic = isMetro ? 0.50 : 0.40;
    const a = hraRcvd;
    const b = basic * pctOfBasic;
    const c = Math.max(0, rent - basic * 0.10);
    const exemption = Math.min(a, b, c);
    const taxableHRA = hraRcvd - exemption;
    document.getElementById('hraResult').innerHTML = `
      <div class="calc-result-box">
        <h4>Results</h4>
        <div class="calc-result-row"><span>Actual HRA Received</span><strong>${Utils.currencyFull(a)}</strong></div>
        <div class="calc-result-row"><span>${isMetro ? '50%' : '40%'} of Basic Salary</span><strong>${Utils.currencyFull(b)}</strong></div>
        <div class="calc-result-row"><span>Rent Paid − 10% of Basic</span><strong>${Utils.currencyFull(c)}</strong></div>
        <div class="calc-result-row"><span>HRA Exemption (minimum of above)</span><strong class="text-green">${Utils.currencyFull(exemption)}</strong></div>
        <div class="calc-result-row"><span>Taxable HRA</span><strong class="text-red">${Utils.currencyFull(taxableHRA)}</strong></div>
      </div>
    `;
  },

  // ─── Income Tax Calculator ──────────────────
  incomeTaxCalcHTML() {
    return `
      <div class="card">
        <div class="card-header"><div class="card-title">🧾 Income Tax Calculator (FY 2024-25)</div></div>
        <div class="form-row">
          <div class="form-group"><label>Gross Annual Income (₹)</label><input class="form-control" type="number" id="taxGross" value="1200000"></div>
          <div class="form-group"><label>80C Deductions (₹, max 1.5L)</label><input class="form-control" type="number" id="tax80C" value="150000"></div>
        </div>
        <div class="form-row">
          <div class="form-group"><label>80D — Medical Insurance (₹)</label><input class="form-control" type="number" id="tax80D" value="25000"></div>
          <div class="form-group"><label>HRA Exemption (₹)</label><input class="form-control" type="number" id="taxHRA" value="0"></div>
        </div>
        <div class="form-row">
          <div class="form-group"><label>NPS 80CCD(1B) (₹, max 50K)</label><input class="form-control" type="number" id="taxNPS" value="50000"></div>
          <div class="form-group"><label>Other Deductions (₹)</label><input class="form-control" type="number" id="taxOther" value="0"></div>
        </div>
        <button class="btn btn-primary btn-sm" onclick="CalculatorsPage.calcIncomeTax()">Calculate & Compare</button>
        <div id="taxResult"></div>
      </div>
    `;
  },

  _calcOldRegimeTax(taxableIncome) {
    if (taxableIncome <= 0) return 0;
    let tax = 0;
    let remaining = taxableIncome;
    if (remaining > 1000000) { tax += (remaining - 1000000) * 0.30; remaining = 1000000; }
    if (remaining > 500000) { tax += (remaining - 500000) * 0.20; remaining = 500000; }
    if (remaining > 250000) { tax += (remaining - 250000) * 0.05; }
    // Section 87A rebate: if taxable income <= 5L, rebate up to ₹12,500
    if (taxableIncome <= 500000) tax = Math.max(0, tax - 12500);
    return tax;
  },

  _calcNewRegimeTax(taxableIncome) {
    if (taxableIncome <= 0) return 0;
    let tax = 0;
    let remaining = taxableIncome;
    if (remaining > 1500000) { tax += (remaining - 1500000) * 0.30; remaining = 1500000; }
    if (remaining > 1200000) { tax += (remaining - 1200000) * 0.20; remaining = 1200000; }
    if (remaining > 1000000) { tax += (remaining - 1000000) * 0.15; remaining = 1000000; }
    if (remaining > 700000) { tax += (remaining - 700000) * 0.10; remaining = 700000; }
    if (remaining > 300000) { tax += (remaining - 300000) * 0.05; }
    // Section 87A rebate: if taxable income <= 7L, rebate up to ₹25,000
    if (taxableIncome <= 700000) tax = Math.max(0, tax - 25000);
    return tax;
  },

  calcIncomeTax() {
    const gross = +document.getElementById('taxGross').value;
    const ded80C = Math.min(+document.getElementById('tax80C').value, 150000);
    const ded80D = +document.getElementById('tax80D').value;
    const hraExempt = +document.getElementById('taxHRA').value;
    const nps80CCD = Math.min(+document.getElementById('taxNPS').value, 50000);
    const otherDed = +document.getElementById('taxOther').value;
    // Old Regime
    const oldStdDed = 50000;
    const oldTotalDed = oldStdDed + ded80C + ded80D + hraExempt + nps80CCD + otherDed;
    const oldTaxable = Math.max(0, gross - oldTotalDed);
    const oldTaxBeforeCess = this._calcOldRegimeTax(oldTaxable);
    const oldCess = oldTaxBeforeCess * 0.04;
    const oldTotalTax = oldTaxBeforeCess + oldCess;
    // New Regime
    const newStdDed = 75000;
    const newTaxable = Math.max(0, gross - newStdDed);
    const newTaxBeforeCess = this._calcNewRegimeTax(newTaxable);
    const newCess = newTaxBeforeCess * 0.04;
    const newTotalTax = newTaxBeforeCess + newCess;
    const better = oldTotalTax <= newTotalTax ? 'Old' : 'New';
    const savings = Math.abs(oldTotalTax - newTotalTax);
    document.getElementById('taxResult').innerHTML = `
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-top:16px">
        <div class="calc-result-box">
          <h4>Old Regime</h4>
          <div class="calc-result-row"><span>Standard Deduction</span><strong>${Utils.currencyFull(oldStdDed)}</strong></div>
          <div class="calc-result-row"><span>Total Deductions</span><strong>${Utils.currencyFull(oldTotalDed)}</strong></div>
          <div class="calc-result-row"><span>Taxable Income</span><strong>${Utils.currencyFull(oldTaxable)}</strong></div>
          <div class="calc-result-row"><span>Tax</span><strong>${Utils.currencyFull(oldTaxBeforeCess)}</strong></div>
          <div class="calc-result-row"><span>Cess (4%)</span><strong>${Utils.currencyFull(oldCess)}</strong></div>
          <div class="calc-result-row"><span>Total Tax</span><strong class="text-red">${Utils.currencyFull(oldTotalTax)}</strong></div>
        </div>
        <div class="calc-result-box">
          <h4>New Regime</h4>
          <div class="calc-result-row"><span>Standard Deduction</span><strong>${Utils.currencyFull(newStdDed)}</strong></div>
          <div class="calc-result-row"><span>Deductions Allowed</span><strong>${Utils.currencyFull(newStdDed)}</strong></div>
          <div class="calc-result-row"><span>Taxable Income</span><strong>${Utils.currencyFull(newTaxable)}</strong></div>
          <div class="calc-result-row"><span>Tax</span><strong>${Utils.currencyFull(newTaxBeforeCess)}</strong></div>
          <div class="calc-result-row"><span>Cess (4%)</span><strong>${Utils.currencyFull(newCess)}</strong></div>
          <div class="calc-result-row"><span>Total Tax</span><strong class="text-red">${Utils.currencyFull(newTotalTax)}</strong></div>
        </div>
      </div>
      <div class="calc-result-box" style="margin-top:12px;border:2px solid var(--green)">
        <div class="calc-result-row"><span>Recommended Regime</span><strong class="text-green">${better} Regime</strong></div>
        <div class="calc-result-row"><span>Tax Savings</span><strong class="text-green">${Utils.currencyFull(savings)}</strong></div>
      </div>
    `;
  },

  // ─── Compound Interest Calculator ──────────────────
  compoundInterestCalcHTML() {
    return `
      <div class="card">
        <div class="card-header"><div class="card-title">🔄 Compound Interest Calculator</div></div>
        <div class="form-row">
          <div class="form-group"><label>Principal (₹)</label><input class="form-control" type="number" id="ciPrincipal" value="100000"></div>
          <div class="form-group"><label>Interest Rate (% p.a.)</label><input class="form-control" type="number" step="0.1" id="ciRate" value="8"></div>
        </div>
        <div class="form-row">
          <div class="form-group"><label>Time (Years)</label><input class="form-control" type="number" step="0.5" id="ciTime" value="5"></div>
          <div class="form-group">
            <label>Compounding Frequency</label>
            <select class="form-control" id="ciFreq">
              <option value="1">Yearly</option>
              <option value="2">Half-Yearly</option>
              <option value="4" selected>Quarterly</option>
              <option value="12">Monthly</option>
            </select>
          </div>
        </div>
        <button class="btn btn-primary btn-sm" onclick="CalculatorsPage.calcCI()">Calculate</button>
        <div id="ciResult"></div>
      </div>
    `;
  },

  calcCI() {
    const P = +document.getElementById('ciPrincipal').value;
    const r = +document.getElementById('ciRate').value / 100;
    const t = +document.getElementById('ciTime').value;
    const n = +document.getElementById('ciFreq').value;
    const A = P * Math.pow(1 + r / n, n * t);
    const ci = A - P;
    const freqLabel = { 1: 'Yearly', 2: 'Half-Yearly', 4: 'Quarterly', 12: 'Monthly' }[n];
    const chartLabels = [], chartInvested = [], chartProjected = [];
    const maxYears = Math.ceil(t);
    for (let y = 1; y <= maxYears; y++) {
      const yr = Math.min(y, t);
      chartLabels.push('Year ' + y);
      chartInvested.push(P);
      chartProjected.push(P * Math.pow(1 + r / n, n * yr));
    }
    document.getElementById('ciResult').innerHTML = `
      <div class="calc-result-box">
        <h4>Results (${freqLabel} Compounding)</h4>
        <div class="calc-result-row"><span>Principal</span><strong>${Utils.currencyFull(P)}</strong></div>
        <div class="calc-result-row"><span>Compound Interest</span><strong class="text-green">${Utils.currencyFull(ci)}</strong></div>
        <div class="calc-result-row"><span>Total Amount</span><strong>${Utils.currencyFull(A)}</strong></div>
        <div class="chart-container" style="height:250px;margin-top:16px"><canvas id="calcChart_ci"></canvas></div>
      </div>
    `;
    this._renderGrowthChart('calcChart_ci', chartLabels, chartInvested, chartProjected);
  },

  // ─── Simple Interest Calculator ──────────────────
  simpleInterestCalcHTML() {
    return `
      <div class="card">
        <div class="card-header"><div class="card-title">📝 Simple Interest Calculator</div></div>
        <div class="form-row-3">
          <div class="form-group"><label>Principal (₹)</label><input class="form-control" type="number" id="siPrincipal" value="100000"></div>
          <div class="form-group"><label>Interest Rate (% p.a.)</label><input class="form-control" type="number" step="0.1" id="siRate" value="8"></div>
          <div class="form-group"><label>Time (Years)</label><input class="form-control" type="number" step="0.5" id="siTime" value="5"></div>
        </div>
        <button class="btn btn-primary btn-sm" onclick="CalculatorsPage.calcSI()">Calculate</button>
        <div id="siResult"></div>
      </div>
    `;
  },

  calcSI() {
    const P = +document.getElementById('siPrincipal').value;
    const R = +document.getElementById('siRate').value;
    const T = +document.getElementById('siTime').value;
    const si = (P * R * T) / 100;
    const chartLabels = [], chartInvested = [], chartProjected = [];
    const maxYears = Math.ceil(T);
    for (let y = 1; y <= maxYears; y++) {
      const yr = Math.min(y, T);
      chartLabels.push('Year ' + y);
      chartInvested.push(P);
      chartProjected.push(P + (P * R * yr) / 100);
    }
    document.getElementById('siResult').innerHTML = `
      <div class="calc-result-box">
        <h4>Results</h4>
        <div class="calc-result-row"><span>Principal</span><strong>${Utils.currencyFull(P)}</strong></div>
        <div class="calc-result-row"><span>Simple Interest</span><strong class="text-green">${Utils.currencyFull(si)}</strong></div>
        <div class="calc-result-row"><span>Total Amount</span><strong>${Utils.currencyFull(P + si)}</strong></div>
        <div class="chart-container" style="height:250px;margin-top:16px"><canvas id="calcChart_si"></canvas></div>
      </div>
    `;
    this._renderGrowthChart('calcChart_si', chartLabels, chartInvested, chartProjected);
  },

  // ─── Flat vs Reducing Rate Calculator ──────────────────
  flatVsReducingCalcHTML() {
    return `
      <div class="card">
        <div class="card-header"><div class="card-title">⚖️ Flat vs Reducing Rate Loan Comparison</div></div>
        <div class="form-row">
          <div class="form-group"><label>Loan Amount (₹)</label><input class="form-control" type="number" id="fvrLoan" value="1000000"></div>
          <div class="form-group"><label>Tenure (Years)</label><input class="form-control" type="number" id="fvrYears" value="5"></div>
        </div>
        <div class="form-row">
          <div class="form-group"><label>Flat Interest Rate (%)</label><input class="form-control" type="number" step="0.1" id="fvrFlat" value="10"></div>
          <div class="form-group"><label>Reducing Interest Rate (%)</label><input class="form-control" type="number" step="0.1" id="fvrReducing" value="17"></div>
        </div>
        <button class="btn btn-primary btn-sm" onclick="CalculatorsPage.calcFlatVsReducing()">Compare</button>
        <div id="fvrResult"></div>
      </div>
    `;
  },

  calcFlatVsReducing() {
    const loan = +document.getElementById('fvrLoan').value;
    const years = +document.getElementById('fvrYears').value;
    const flatRate = +document.getElementById('fvrFlat').value / 100;
    const redRate = +document.getElementById('fvrReducing').value / 100;
    const months = years * 12;
    // Flat rate method
    const flatInterest = loan * flatRate * years;
    const flatTotal = loan + flatInterest;
    const flatEMI = flatTotal / months;
    // Reducing rate method (standard EMI)
    const r = redRate / 12;
    const redEMI = loan * r * Math.pow(1 + r, months) / (Math.pow(1 + r, months) - 1);
    const redTotal = redEMI * months;
    const redInterest = redTotal - loan;
    document.getElementById('fvrResult').innerHTML = `
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-top:16px">
        <div class="calc-result-box">
          <h4>Flat Rate (${(flatRate * 100).toFixed(1)}%)</h4>
          <div class="calc-result-row"><span>Monthly EMI</span><strong>${Utils.currencyFull(flatEMI)}</strong></div>
          <div class="calc-result-row"><span>Total Interest</span><strong class="text-red">${Utils.currencyFull(flatInterest)}</strong></div>
          <div class="calc-result-row"><span>Total Payment</span><strong>${Utils.currencyFull(flatTotal)}</strong></div>
        </div>
        <div class="calc-result-box">
          <h4>Reducing Rate (${(redRate * 100).toFixed(1)}%)</h4>
          <div class="calc-result-row"><span>Monthly EMI</span><strong>${Utils.currencyFull(redEMI)}</strong></div>
          <div class="calc-result-row"><span>Total Interest</span><strong class="text-red">${Utils.currencyFull(redInterest)}</strong></div>
          <div class="calc-result-row"><span>Total Payment</span><strong>${Utils.currencyFull(redTotal)}</strong></div>
        </div>
      </div>
      <div class="calc-result-box" style="margin-top:12px">
        <div class="calc-result-row"><span>Cheaper Option</span><strong class="text-green">${flatTotal <= redTotal ? 'Flat Rate' : 'Reducing Rate'}</strong></div>
        <div class="calc-result-row"><span>Interest Difference</span><strong class="text-green">${Utils.currencyFull(Math.abs(flatInterest - redInterest))}</strong></div>
      </div>
    `;
  },

  // ─── Salary Calculator ──────────────────
  salaryCalcHTML() {
    return `
      <div class="card">
        <div class="card-header"><div class="card-title">💼 Salary Calculator (CTC to Take-Home)</div></div>
        <div class="form-row-3">
          <div class="form-group"><label>Annual CTC (₹)</label><input class="form-control" type="number" id="salCTC" value="1200000"></div>
          <div class="form-group"><label>Basic (% of CTC)</label><input class="form-control" type="number" id="salBasicPct" value="40"></div>
          <div class="form-group"><label>HRA (% of Basic)</label><input class="form-control" type="number" id="salHRAPct" value="50"></div>
        </div>
        <div class="form-row">
          <div class="form-group"><label>PF Contribution (% of Basic)</label><input class="form-control" type="number" id="salPFPct" value="12"></div>
          <div class="form-group"><label>Professional Tax (₹/month)</label><input class="form-control" type="number" id="salPT" value="200"></div>
        </div>
        <button class="btn btn-primary btn-sm" onclick="CalculatorsPage.calcSalary()">Calculate</button>
        <div id="salResult"></div>
      </div>
    `;
  },

  calcSalary() {
    const ctc = +document.getElementById('salCTC').value;
    const basicPct = +document.getElementById('salBasicPct').value / 100;
    const hraPct = +document.getElementById('salHRAPct').value / 100;
    const pfPct = +document.getElementById('salPFPct').value / 100;
    const ptMonthly = +document.getElementById('salPT').value;
    const basic = ctc * basicPct;
    const hra = basic * hraPct;
    const employerPF = basic * pfPct;
    const employeePF = basic * pfPct;
    const gross = ctc - employerPF;
    const specialAllowance = Math.max(0, gross - basic - hra);
    const ptAnnual = ptMonthly * 12;
    const netAnnual = gross - employeePF - ptAnnual;
    const netMonthly = netAnnual / 12;
    document.getElementById('salResult').innerHTML = `
      <div class="calc-result-box">
        <h4>Annual Salary Breakdown</h4>
        <div class="calc-result-row" style="border-bottom:1px solid var(--border)"><span><strong>Cost to Company (CTC)</strong></span><strong>${Utils.currencyFull(ctc)}</strong></div>
        <div class="calc-result-row"><span>Basic Salary</span><strong>${Utils.currencyFull(basic)}</strong></div>
        <div class="calc-result-row"><span>HRA</span><strong>${Utils.currencyFull(hra)}</strong></div>
        <div class="calc-result-row"><span>Special Allowance</span><strong>${Utils.currencyFull(specialAllowance)}</strong></div>
        <div class="calc-result-row" style="border-bottom:1px solid var(--border)"><span>Employer PF</span><strong>${Utils.currencyFull(employerPF)}</strong></div>
        <div class="calc-result-row" style="border-bottom:1px solid var(--border)"><span><strong>Gross Salary</strong></span><strong>${Utils.currencyFull(gross)}</strong></div>
        <div class="calc-result-row"><span>Employee PF (−)</span><strong class="text-red">${Utils.currencyFull(employeePF)}</strong></div>
        <div class="calc-result-row" style="border-bottom:1px solid var(--border)"><span>Professional Tax (−)</span><strong class="text-red">${Utils.currencyFull(ptAnnual)}</strong></div>
        <div class="calc-result-row"><span><strong>Net Annual (before tax)</strong></span><strong class="text-green">${Utils.currencyFull(netAnnual)}</strong></div>
        <div class="calc-result-row"><span><strong>Monthly Take-Home (approx)</strong></span><strong class="text-accent">${Utils.currencyFull(netMonthly)}</strong></div>
      </div>
      <p style="font-size:0.8rem;color:var(--text-muted);margin-top:8px">* Income tax not deducted. Use the Income Tax Calculator for exact tax computation.</p>
    `;
  },

  // ─── Retirement Corpus Calculator ──────────────────
  retirementCorpusCalcHTML() {
    return `
      <div class="card">
        <div class="card-header"><div class="card-title">🏖️ Retirement Corpus Calculator</div></div>
        <div class="form-row-3">
          <div class="form-group"><label>Current Monthly Expenses (₹)</label><input class="form-control" type="number" id="retExpense" value="50000"></div>
          <div class="form-group"><label>Current Age</label><input class="form-control" type="number" id="retCurAge" value="30"></div>
          <div class="form-group"><label>Retirement Age</label><input class="form-control" type="number" id="retRetAge" value="60"></div>
        </div>
        <div class="form-row-3">
          <div class="form-group"><label>Life Expectancy</label><input class="form-control" type="number" id="retLifeExp" value="85"></div>
          <div class="form-group"><label>Inflation Rate (%)</label><input class="form-control" type="number" step="0.1" id="retInflation" value="6"></div>
          <div class="form-group"><label>Post-Retirement Return (%)</label><input class="form-control" type="number" step="0.1" id="retReturn" value="8"></div>
        </div>
        <button class="btn btn-primary btn-sm" onclick="CalculatorsPage.calcRetirementCorpus()">Calculate</button>
        <div id="retResult"></div>
      </div>
    `;
  },

  calcRetirementCorpus() {
    const monthlyExp = +document.getElementById('retExpense').value;
    const curAge = +document.getElementById('retCurAge').value;
    const retAge = +document.getElementById('retRetAge').value;
    const lifeExp = +document.getElementById('retLifeExp').value;
    const inflation = +document.getElementById('retInflation').value / 100;
    const postRetReturn = +document.getElementById('retReturn').value / 100;
    const yearsToRetirement = retAge - curAge;
    const yearsInRetirement = lifeExp - retAge;
    const annualExpNow = monthlyExp * 12;
    const annualExpAtRetirement = annualExpNow * Math.pow(1 + inflation, yearsToRetirement);
    const monthlyExpAtRetirement = annualExpAtRetirement / 12;
    // Real rate of return post-retirement
    const realRate = (1 + postRetReturn) / (1 + inflation) - 1;
    // Required corpus = present value of annuity (expenses during retirement adjusted for inflation)
    let requiredCorpus;
    if (Math.abs(realRate) < 0.0001) {
      requiredCorpus = annualExpAtRetirement * yearsInRetirement;
    } else {
      requiredCorpus = annualExpAtRetirement * (1 - Math.pow(1 + realRate, -yearsInRetirement)) / realRate;
    }
    const sipRate = 0.12 / 12;
    const monthlySIP = requiredCorpus * sipRate / (Math.pow(1 + sipRate, yearsToRetirement * 12) - 1) / (1 + sipRate);
    const chartLabels = [], chartSavings = [], chartCorpusLine = [];
    for (let y = 1; y <= yearsToRetirement; y++) {
      chartLabels.push('Yr ' + y);
      chartSavings.push(monthlySIP * ((Math.pow(1 + sipRate, y * 12) - 1) / sipRate) * (1 + sipRate));
      chartCorpusLine.push(requiredCorpus);
    }
    document.getElementById('retResult').innerHTML = `
      <div class="calc-result-box">
        <h4>Results</h4>
        <div class="calc-result-row"><span>Monthly Expenses at Retirement</span><strong>${Utils.currencyFull(monthlyExpAtRetirement)}</strong></div>
        <div class="calc-result-row"><span>Annual Expenses at Retirement</span><strong>${Utils.currencyFull(annualExpAtRetirement)}</strong></div>
        <div class="calc-result-row"><span>Years in Retirement</span><strong>${yearsInRetirement} years</strong></div>
        <div class="calc-result-row"><span>Required Corpus at Retirement</span><strong class="text-accent" style="font-size:1.2rem">${Utils.currencyFull(requiredCorpus)}</strong></div>
        <div class="chart-container" style="height:220px;margin-top:16px"><canvas id="retCorpusChart"></canvas></div>
      </div>
      <div class="calc-result-box" style="margin-top:12px">
        <h4>How to Build This Corpus?</h4>
        <div class="calc-result-row"><span>Monthly SIP needed (at 12% return)</span><strong class="text-green">${Utils.currencyFull(monthlySIP)}</strong></div>
        <div class="calc-result-row"><span>Lumpsum needed today (at 12% return)</span><strong>${Utils.currencyFull(requiredCorpus / Math.pow(1.12, yearsToRetirement))}</strong></div>
      </div>
    `;
    requestAnimationFrame(async () => {
      await Charts.line('retCorpusChart', chartLabels, [
        { label: 'Savings Growth', data: chartSavings, color: '#10b981', fill: false },
        { label: 'Required Corpus', data: chartCorpusLine, color: '#ef4444', fill: false, borderDash: [6, 3], pointRadius: 0 }
      ]);
    });
  },

  // ─── NSC Calculator ──────────────────
  nscCalcHTML() {
    return `
      <div class="card">
        <div class="card-header"><div class="card-title">📜 NSC Calculator (National Savings Certificate)</div></div>
        <div class="form-row-3">
          <div class="form-group"><label>Investment Amount (₹)</label><input class="form-control" type="number" id="nscAmount" value="100000"></div>
          <div class="form-group"><label>Interest Rate (%)</label><input class="form-control" type="number" step="0.1" id="nscRate" value="7.7"></div>
          <div class="form-group"><label>Duration (Years)</label><input class="form-control" type="number" id="nscYears" value="5" min="5" max="5"></div>
        </div>
        <p style="font-size:0.8rem;color:var(--text-muted);margin-bottom:8px">Interest compounded annually, reinvested. Paid at maturity.</p>
        <button class="btn btn-primary btn-sm" onclick="CalculatorsPage.calcNSC()">Calculate</button>
        <div id="nscResult"></div>
      </div>
    `;
  },

  calcNSC() {
    const P = +document.getElementById('nscAmount').value;
    const rate = +document.getElementById('nscRate').value / 100;
    const years = 5;
    let balance = P;
    let tableRows = '';
    const chartLabels = [], chartInvested = [], chartProjected = [];
    for (let y = 1; y <= years; y++) {
      const interest = balance * rate;
      balance += interest;
      tableRows += `<tr><td>${y}</td><td>${Utils.currencyFull(balance - interest)}</td><td>${Utils.currencyFull(interest)}</td><td>${Utils.currencyFull(balance)}</td></tr>`;
      chartLabels.push('Year ' + y);
      chartInvested.push(P);
      chartProjected.push(balance);
    }
    document.getElementById('nscResult').innerHTML = `
      <div class="calc-result-box">
        <h4>Results</h4>
        <div class="calc-result-row"><span>Investment</span><strong>${Utils.currencyFull(P)}</strong></div>
        <div class="calc-result-row"><span>Total Interest</span><strong class="text-green">${Utils.currencyFull(balance - P)}</strong></div>
        <div class="calc-result-row"><span>Maturity Value (5 years)</span><strong>${Utils.currencyFull(balance)}</strong></div>
        <div class="chart-container" style="height:250px;margin-top:16px"><canvas id="calcChart_nsc"></canvas></div>
      </div>
      <details style="margin-top:12px"><summary style="cursor:pointer;font-weight:600;font-size:0.9rem">Year-wise Growth</summary>
        <div style="overflow-x:auto;margin-top:8px">
        <table class="data-table"><thead><tr><th>Year</th><th>Opening</th><th>Interest</th><th>Closing</th></tr></thead>
        <tbody>${tableRows}</tbody></table>
        </div>
      </details>
    `;
    this._renderGrowthChart('calcChart_nsc', chartLabels, chartInvested, chartProjected);
  },

  // ─── SCSS Calculator ──────────────────
  scssCalcHTML() {
    return `
      <div class="card">
        <div class="card-header"><div class="card-title">👴 SCSS Calculator (Senior Citizens Savings Scheme)</div></div>
        <div class="form-row">
          <div class="form-group"><label>Investment Amount (₹)</label><input class="form-control" type="number" id="scssAmount" value="1500000"></div>
          <div class="form-group"><label>Interest Rate (% p.a.)</label><input class="form-control" type="number" step="0.1" id="scssRate" value="8.2"></div>
        </div>
        <p style="font-size:0.8rem;color:var(--text-muted);margin-bottom:8px">5-year tenure. Quarterly interest payouts (not compounded). Max investment ₹30 lakh.</p>
        <button class="btn btn-primary btn-sm" onclick="CalculatorsPage.calcSCSS()">Calculate</button>
        <div id="scssResult"></div>
      </div>
    `;
  },

  calcSCSS() {
    const P = +document.getElementById('scssAmount').value;
    const rate = +document.getElementById('scssRate').value / 100;
    const quarterlyPayout = P * (rate / 4);
    const annualPayout = quarterlyPayout * 4;
    const totalInterest = annualPayout * 5;
    let tableRows = '';
    for (let q = 1; q <= 20; q++) {
      const yr = Math.ceil(q / 4);
      tableRows += `<tr><td>Y${yr} Q${((q - 1) % 4) + 1}</td><td>${Utils.currencyFull(quarterlyPayout)}</td></tr>`;
    }
    document.getElementById('scssResult').innerHTML = `
      <div class="calc-result-box">
        <h4>Results</h4>
        <div class="calc-result-row"><span>Investment Amount</span><strong>${Utils.currencyFull(P)}</strong></div>
        <div class="calc-result-row"><span>Quarterly Payout</span><strong class="text-green">${Utils.currencyFull(quarterlyPayout)}</strong></div>
        <div class="calc-result-row"><span>Annual Income</span><strong class="text-green">${Utils.currencyFull(annualPayout)}</strong></div>
        <div class="calc-result-row"><span>Total Interest (5 years)</span><strong class="text-green">${Utils.currencyFull(totalInterest)}</strong></div>
        <div class="calc-result-row"><span>Maturity (Principal + Interest)</span><strong>${Utils.currencyFull(P + totalInterest)}</strong></div>
      </div>
      <details style="margin-top:12px"><summary style="cursor:pointer;font-weight:600;font-size:0.9rem">Quarterly Payout Schedule</summary>
        <div style="overflow-x:auto;margin-top:8px">
        <table class="data-table"><thead><tr><th>Quarter</th><th>Payout</th></tr></thead>
        <tbody>${tableRows}</tbody></table>
        </div>
      </details>
    `;
  },

  // ─── APY Calculator ──────────────────
  apyCalcHTML() {
    return `
      <div class="card">
        <div class="card-header"><div class="card-title">🛡️ APY Calculator (Atal Pension Yojana)</div></div>
        <div class="form-row">
          <div class="form-group"><label>Current Age (18-40)</label><input class="form-control" type="number" id="apyAge" value="25" min="18" max="40"></div>
          <div class="form-group">
            <label>Desired Monthly Pension (₹)</label>
            <select class="form-control" id="apyPension">
              <option value="1000">₹1,000</option>
              <option value="2000">₹2,000</option>
              <option value="3000" selected>₹3,000</option>
              <option value="4000">₹4,000</option>
              <option value="5000">₹5,000</option>
            </select>
          </div>
        </div>
        <button class="btn btn-primary btn-sm" onclick="CalculatorsPage.calcAPY()">Calculate</button>
        <div id="apyResult"></div>
      </div>
    `;
  },

  _apyTable: {
    18: [42,84,126,168,210], 19: [46,92,138,183,228], 20: [50,100,150,198,248],
    21: [54,108,162,215,269], 22: [59,117,177,234,292], 23: [64,127,192,254,318],
    24: [70,139,208,277,346], 25: [76,151,226,301,376], 26: [82,164,246,327,409],
    27: [90,178,268,356,446], 28: [97,194,292,388,485], 29: [106,212,318,423,529],
    30: [116,231,347,462,577], 31: [126,252,379,504,630], 32: [138,276,414,551,689],
    33: [151,302,453,602,752], 34: [165,330,495,659,824], 35: [181,362,543,722,902],
    36: [198,396,594,792,990], 37: [218,436,654,870,1087], 38: [240,480,720,957,1196],
    39: [264,528,792,1054,1318], 40: [291,582,873,1164,1454]
  },

  calcAPY() {
    const age = +document.getElementById('apyAge').value;
    const pension = +document.getElementById('apyPension').value;
    if (age < 18 || age > 40) {
      document.getElementById('apyResult').innerHTML = '<p class="text-red" style="margin-top:12px">Age must be between 18 and 40.</p>';
      return;
    }
    const pensionIdx = { 1000: 0, 2000: 1, 3000: 2, 4000: 3, 5000: 4 }[pension];
    const monthlyContrib = this._apyTable[age][pensionIdx];
    const yearsToContribute = 60 - age;
    const totalContrib = monthlyContrib * 12 * yearsToContribute;
    const corpusAtRetirement = { 1000: 170000, 2000: 340000, 3000: 510000, 4000: 680000, 5000: 850000 }[pension];
    document.getElementById('apyResult').innerHTML = `
      <div class="calc-result-box">
        <h4>Results</h4>
        <div class="calc-result-row"><span>Monthly Contribution Required</span><strong class="text-accent" style="font-size:1.2rem">${Utils.currencyFull(monthlyContrib)}</strong></div>
        <div class="calc-result-row"><span>Years of Contribution</span><strong>${yearsToContribute} years</strong></div>
        <div class="calc-result-row"><span>Total Amount Contributed</span><strong>${Utils.currencyFull(totalContrib)}</strong></div>
        <div class="calc-result-row"><span>Pension Corpus at 60</span><strong>${Utils.currencyFull(corpusAtRetirement)}</strong></div>
        <div class="calc-result-row"><span>Monthly Pension (after 60)</span><strong class="text-green">${Utils.currencyFull(pension)}</strong></div>
        <div class="calc-result-row"><span>Nominee Receives (on death)</span><strong>${Utils.currencyFull(corpusAtRetirement)}</strong></div>
      </div>
      <p style="font-size:0.8rem;color:var(--text-muted);margin-top:8px">Contributions based on PFRDA APY contribution chart. Pension is guaranteed by Government of India.</p>
    `;
  },

  // ─── Stock Average Calculator ──────────────────
  stockAvgCalcHTML() {
    if (!this._stockAvgTranches) {
      this._stockAvgTranches = [
        { qty: 100, price: 150 },
        { qty: 50, price: 200 }
      ];
    }
    return `
      <div class="card">
        <div class="card-header"><div class="card-title">📊 Stock Average Calculator</div></div>
        <p style="font-size:0.85rem;color:var(--text-muted);margin-bottom:12px">Enter multiple buy tranches to find your weighted average cost price.</p>
        <div id="stockAvgTableWrap">${this._renderStockAvgTable()}</div>
        <div style="margin:12px 0;display:flex;gap:8px;flex-wrap:wrap">
          <button class="btn btn-outline btn-sm" onclick="CalculatorsPage.addStockAvgRow()">+ Add Tranche</button>
          <button class="btn btn-primary btn-sm" onclick="CalculatorsPage.calcStockAvg()">Calculate Average</button>
        </div>
        <div id="stockAvgResult"></div>
      </div>
    `;
  },

  _renderStockAvgTable() {
    return `
      <div style="overflow-x:auto">
      <table class="data-table" style="margin-bottom:8px">
        <thead><tr><th>Quantity</th><th>Buy Price (₹)</th><th></th></tr></thead>
        <tbody>
          ${this._stockAvgTranches.map((t, i) => `
            <tr>
              <td><input class="form-control" type="number" id="saQty${i}" value="${t.qty}" style="min-width:100px"></td>
              <td><input class="form-control" type="number" step="0.01" id="saPrice${i}" value="${t.price}" style="min-width:120px"></td>
              <td><button class="btn btn-outline btn-sm" onclick="CalculatorsPage.removeStockAvgRow(${i})" style="color:var(--red)">&times;</button></td>
            </tr>
          `).join('')}
        </tbody>
      </table>
      </div>
    `;
  },

  _saveStockAvgInputs() {
    this._stockAvgTranches = this._stockAvgTranches.map((t, i) => ({
      qty: Number(document.getElementById('saQty' + i)?.value ?? t.qty),
      price: Number(document.getElementById('saPrice' + i)?.value ?? t.price)
    }));
  },

  addStockAvgRow() {
    this._saveStockAvgInputs();
    this._stockAvgTranches.push({ qty: 0, price: 0 });
    document.getElementById('stockAvgTableWrap').innerHTML = this._renderStockAvgTable();
  },

  removeStockAvgRow(idx) {
    if (this._stockAvgTranches.length <= 1) return;
    this._saveStockAvgInputs();
    this._stockAvgTranches.splice(idx, 1);
    document.getElementById('stockAvgTableWrap').innerHTML = this._renderStockAvgTable();
  },

  calcStockAvg() {
    this._saveStockAvgInputs();
    let totalQty = 0, totalValue = 0;
    const rows = this._stockAvgTranches.filter(t => t.qty > 0 && t.price > 0);
    if (rows.length === 0) {
      document.getElementById('stockAvgResult').innerHTML = '<p class="text-red" style="margin-top:12px">Add at least one valid tranche.</p>';
      return;
    }
    let tableRows = '';
    rows.forEach((t, i) => {
      const val = t.qty * t.price;
      totalQty += t.qty;
      totalValue += val;
      tableRows += `<tr><td>${i + 1}</td><td>${t.qty}</td><td>${Utils.currencyFull(t.price)}</td><td>${Utils.currencyFull(val)}</td></tr>`;
    });
    const avgPrice = totalValue / totalQty;
    document.getElementById('stockAvgResult').innerHTML = `
      <div class="calc-result-box">
        <h4>Results</h4>
        <div class="calc-result-row"><span>Total Shares</span><strong>${totalQty.toLocaleString('en-IN')}</strong></div>
        <div class="calc-result-row"><span>Total Investment</span><strong>${Utils.currencyFull(totalValue)}</strong></div>
        <div class="calc-result-row"><span>Weighted Average Price</span><strong class="text-accent" style="font-size:1.2rem">${Utils.currencyFull(avgPrice)}</strong></div>
      </div>
      <details style="margin-top:12px"><summary style="cursor:pointer;font-weight:600;font-size:0.9rem">Tranche Details</summary>
        <div style="overflow-x:auto;margin-top:8px">
        <table class="data-table"><thead><tr><th>#</th><th>Qty</th><th>Price</th><th>Value</th></tr></thead>
        <tbody>${tableRows}</tbody></table>
        </div>
      </details>
    `;
  },
};

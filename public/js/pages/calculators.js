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
    }
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
    const n = Number(document.getElementById('sipYears').value) * 12;
    const fv = P * ((Math.pow(1 + r, n) - 1) / r) * (1 + r);
    const invested = P * n;
    const gain = fv - invested;
    document.getElementById('sipResult').innerHTML = `
      <div class="calc-result-box">
        <h4>Results</h4>
        <div class="calc-result-row"><span>Total Invested</span><strong>${Utils.currencyFull(invested)}</strong></div>
        <div class="calc-result-row"><span>Estimated Returns</span><strong class="text-green">${Utils.currencyFull(gain)}</strong></div>
        <div class="calc-result-row"><span>Total Value</span><strong>${Utils.currencyFull(fv)}</strong></div>
      </div>
    `;
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
    let totalInvested = 0, totalValue = 0;
    for (let y = 0; y < years; y++) {
      const monthlyP = P * Math.pow(1 + stepup, y);
      for (let m = 0; m < 12; m++) {
        const monthsRemaining = (years - y) * 12 - m;
        totalInvested += monthlyP;
        totalValue += monthlyP * Math.pow(1 + r, monthsRemaining);
      }
    }
    const gain = totalValue - totalInvested;
    document.getElementById('stepSipResult').innerHTML = `
      <div class="calc-result-box">
        <h4>Results</h4>
        <div class="calc-result-row"><span>Total Invested</span><strong>${Utils.currencyFull(totalInvested)}</strong></div>
        <div class="calc-result-row"><span>Estimated Returns</span><strong class="text-green">${Utils.currencyFull(gain)}</strong></div>
        <div class="calc-result-row"><span>Total Value</span><strong>${Utils.currencyFull(totalValue)}</strong></div>
      </div>
    `;
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
    document.getElementById('lsResult').innerHTML = `
      <div class="calc-result-box">
        <h4>Results</h4>
        <div class="calc-result-row"><span>Invested</span><strong>${Utils.currencyFull(P)}</strong></div>
        <div class="calc-result-row"><span>Returns</span><strong class="text-green">${Utils.currencyFull(fv - P)}</strong></div>
        <div class="calc-result-row"><span>Maturity Value</span><strong>${Utils.currencyFull(fv)}</strong></div>
      </div>
    `;
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
    let balance = Number(document.getElementById('swpAmount').value);
    const w = Number(document.getElementById('swpWithdrawal').value);
    const r = Number(document.getElementById('swpRate').value) / 100 / 12;
    const months = Number(document.getElementById('swpYears').value) * 12;
    let totalWithdrawn = 0;
    for (let i = 0; i < months && balance > 0; i++) {
      balance = balance * (1 + r) - w;
      totalWithdrawn += w;
    }
    if (balance < 0) balance = 0;
    document.getElementById('swpResult').innerHTML = `
      <div class="calc-result-box">
        <h4>Results</h4>
        <div class="calc-result-row"><span>Total Withdrawn</span><strong>${Utils.currencyFull(totalWithdrawn)}</strong></div>
        <div class="calc-result-row"><span>Remaining Balance</span><strong>${Utils.currencyFull(balance)}</strong></div>
      </div>
    `;
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
    document.getElementById('infResult').innerHTML = `
      <div class="calc-result-box">
        <h4>Results</h4>
        <div class="calc-result-row"><span>Future cost of ₹${P.toLocaleString('en-IN')} items</span><strong class="text-red">${Utils.currencyFull(fv)}</strong></div>
        <div class="calc-result-row"><span>Purchasing power of ₹${P.toLocaleString('en-IN')}</span><strong>${Utils.currencyFull(purchasing)}</strong></div>
      </div>
    `;
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
    document.getElementById('fdResult').innerHTML = `
      <div class="calc-result-box">
        <h4>Results (Quarterly Compounding)</h4>
        <div class="calc-result-row"><span>Principal</span><strong>${Utils.currencyFull(P)}</strong></div>
        <div class="calc-result-row"><span>Interest Earned</span><strong class="text-green">${Utils.currencyFull(interest)}</strong></div>
        <div class="calc-result-row"><span>Maturity Amount</span><strong>${Utils.currencyFull(quarterly)}</strong></div>
      </div>
    `;
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
    const n = Number(document.getElementById('emiYears').value) * 12;
    const emi = P * r * Math.pow(1 + r, n) / (Math.pow(1 + r, n) - 1);
    const totalPay = emi * n;
    const totalInterest = totalPay - P;
    document.getElementById('emiResult').innerHTML = `
      <div class="calc-result-box">
        <h4>Results</h4>
        <div class="calc-result-row"><span>Monthly EMI</span><strong>${Utils.currencyFull(emi)}</strong></div>
        <div class="calc-result-row"><span>Total Interest</span><strong class="text-red">${Utils.currencyFull(totalInterest)}</strong></div>
        <div class="calc-result-row"><span>Total Payment</span><strong>${Utils.currencyFull(totalPay)}</strong></div>
      </div>
    `;
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
    document.getElementById('goalResult').innerHTML = `
      <div class="calc-result-box">
        <h4>Results</h4>
        <div class="calc-result-row"><span>Inflation-adjusted Goal</span><strong>${Utils.currencyFull(inflAdj)}</strong></div>
        <div class="calc-result-row"><span>Required Monthly SIP</span><strong class="text-accent">${Utils.currencyFull(sip)}</strong></div>
        <div class="calc-result-row"><span>Or One-time Lumpsum</span><strong>${Utils.currencyFull(lumpsum)}</strong></div>
      </div>
    `;
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
    for (let y = 0; y < years; y++) {
      const monthly = basic * epfPct;
      for (let m = 0; m < 12; m++) {
        balance += monthly;
        totalContrib += monthly;
        balance *= (1 + interest / 12);
      }
      basic *= (1 + increment);
    }
    document.getElementById('epfResult').innerHTML = `
      <div class="calc-result-box">
        <h4>Results</h4>
        <div class="calc-result-row"><span>Total Contribution</span><strong>${Utils.currencyFull(totalContrib)}</strong></div>
        <div class="calc-result-row"><span>Interest Earned</span><strong class="text-green">${Utils.currencyFull(balance - totalContrib)}</strong></div>
        <div class="calc-result-row"><span>Maturity Value</span><strong>${Utils.currencyFull(balance)}</strong></div>
      </div>
    `;
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
    let years = 0;
    while (portfolio < fireNumber && years < 100) {
      portfolio = portfolio * (1 + ret) + monthlyInvest;
      years += 1 / 12;
    }
    document.getElementById('fireResult').innerHTML = `
      <div class="calc-result-box">
        <h4>Results</h4>
        <div class="calc-result-row"><span>FIRE Number (Annual Exp / SWR)</span><strong>${Utils.currencyFull(fireNumber)}</strong></div>
        <div class="calc-result-row"><span>Years to FIRE</span><strong class="text-accent">${Math.ceil(years)} years</strong></div>
        <div class="calc-result-row"><span>FIRE Age (if started at 25)</span><strong>${25 + Math.ceil(years)} years old</strong></div>
      </div>
    `;
  },
};

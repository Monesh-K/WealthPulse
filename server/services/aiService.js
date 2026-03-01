/**
 * WealthPulse — AI Service
 * Powered by Groq (free tier) — fast inference on top open-source models
 * Auto-fallback across free models + retry on rate limits
 */
const Groq = require('groq-sdk');

const SYSTEM_PROMPT = `You are WealthPulse AI, an expert Indian personal finance advisor. 
You provide concise, actionable financial insights based on the user's portfolio data.
Rules:
- Keep responses brief (2-4 bullet points max)
- Use ₹ for Indian currency, $ for USD
- Be specific with numbers from the data provided
- Focus on actionable advice, not generic tips
- Consider Indian tax laws (80C, 80CCD, etc.) when relevant
- If data is insufficient, say so briefly
- Never recommend specific stocks/funds by name
- Format response as clean markdown with bullet points`;

// Free Groq models in preference order (best quality first)
const FREE_MODELS = [
  'llama-3.3-70b-versatile',      // Best quality — Meta Llama 3.3 70B
  'llama-3.1-8b-instant',         // Fast and capable
  'gemma2-9b-it',                 // Google Gemma 2 9B
  'mixtral-8x7b-32768',           // Mistral MoE — large context
];

class AIService {
  constructor() {
    this.client = null;
    this.enabled = false;
    this.init();
  }

  init() {
    const apiKey = process.env.GROQ_API_KEY;
    if (apiKey) {
      this.client = new Groq({ apiKey });
      this.enabled = true;
      const preferred = process.env.GROQ_MODEL || FREE_MODELS[0];
      console.log(`[AI] ✅ Groq enabled (preferred: ${preferred}, fallbacks: ${FREE_MODELS.join(', ')})`);
    } else {
      console.log('[AI] ⚠️  No GROQ_API_KEY found. AI insights disabled.');
      console.log('[AI]    Get a free key at https://console.groq.com/keys');
    }
  }

  _sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  async _tryGenerate(modelName, userPrompt) {
    const chatCompletion = await this.client.chat.completions.create({
      model: modelName,
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: userPrompt },
      ],
      max_tokens: 500,
      temperature: 0.7,
    });
    return chatCompletion.choices?.[0]?.message?.content || 'No insight available.';
  }

  async getInsight(type, data) {
    if (!this.enabled) {
      return { success: false, error: 'AI not configured. Add GROQ_API_KEY to .env (free at https://console.groq.com/keys)' };
    }

    const prompts = {
      dashboard: this.buildDashboardPrompt(data),
      portfolio: this.buildPortfolioPrompt(data),
      allocation: this.buildAllocationPrompt(data),
      spending: this.buildSpendingPrompt(data),
      goals: this.buildGoalsPrompt(data),
      salary: this.buildSalaryPrompt(data),
      general: data.question || 'Analyze my finances',
    };

    const userPrompt = prompts[type] || prompts.general;

    // Build model list: env-preferred first, then remaining fallbacks
    const preferred = process.env.GROQ_MODEL || FREE_MODELS[0];
    const modelsToTry = [preferred, ...FREE_MODELS.filter(m => m !== preferred)];

    for (let i = 0; i < modelsToTry.length; i++) {
      const modelName = modelsToTry[i];
      try {
        console.log(`[AI] Trying model: ${modelName}...`);
        const content = await this._tryGenerate(modelName, userPrompt);
        console.log(`[AI] ✅ Success with ${modelName}`);
        return { success: true, insight: content, type, model: modelName };
      } catch (err) {
        const msg = err.message || '';
        const status = err.status || err.statusCode || 0;
        const isRateLimit = status === 429 || msg.includes('429') || msg.includes('rate_limit') || msg.includes('quota') || msg.includes('Too Many Requests');

        if (isRateLimit) {
          console.log(`[AI] ⚠️  ${modelName} rate-limited, trying next...`);

          // If last model, wait and retry the lightest model once
          if (i === modelsToTry.length - 1) {
            const retryMatch = msg.match(/try again in ([\d.]+)s/i) || msg.match(/retry.after.*?([\d.]+)/i);
            const wait = retryMatch ? Math.min(parseFloat(retryMatch[1]), 20) : 10;
            console.log(`[AI] All models rate-limited. Waiting ${wait}s for retry...`);
            await this._sleep(wait * 1000);
            try {
              const content = await this._tryGenerate('llama-3.1-8b-instant', userPrompt);
              return { success: true, insight: content, type, model: 'llama-3.1-8b-instant (retry)' };
            } catch (retryErr) {
              console.error('[AI] Final retry failed:', retryErr.message);
              return { success: false, error: 'All AI models are rate-limited. Please try again in a minute.' };
            }
          }
          continue;
        }

        // Non-rate-limit error — try next model
        console.error(`[AI] ${modelName} error (${status}):`, msg);
        continue;
      }
    }

    return { success: false, error: 'All AI models failed. Please try again later.' };
  }

  // ── Prompt builders ──────────────────────────────────────────────

  buildDashboardPrompt(d) {
    return `Analyze this portfolio overview and give 3-4 key insights:
- Net Worth: ₹${d.netWorth?.toLocaleString()}
- Total Invested: ₹${d.totalInvested?.toLocaleString()}
- Current Value: ₹${d.totalCurrent?.toLocaleString()}
- Gain/Loss: ₹${d.gainLoss?.toLocaleString()} (${d.totalInvested > 0 ? ((d.gainLoss / d.totalInvested) * 100).toFixed(1) : 0}%)
- Liabilities: ₹${d.totalLiabilities?.toLocaleString()}
- Monthly Income: ₹${d.monthlyIncome?.toLocaleString()}
- Monthly Expenses: ₹${d.monthlyExpenses?.toLocaleString()}
- Assets: ${d.assetCount} | Liabilities: ${d.liabilityCount} | Goals: ${d.goalCount}
- Allocation: ${d.allocationByCategory ? Object.entries(d.allocationByCategory).map(([k, v]) => `${k}: ₹${v.toLocaleString()}`).join(', ') : 'N/A'}

Highlight strengths, risks, and one improvement suggestion.`;
  }

  buildPortfolioPrompt(d) {
    const assetList = (d.assets || []).slice(0, 15).map(a =>
      `${a.name} (${a.category}/${a.subtype}): Invested ₹${a.invested_value?.toLocaleString()}, Current ₹${a.current_value?.toLocaleString()}`
    ).join('\n');
    return `Analyze this portfolio and suggest improvements:
${assetList}

Total Invested: ₹${d.totalInvested?.toLocaleString()}
Total Current: ₹${d.totalCurrent?.toLocaleString()}

Focus on: diversification, concentration risk, and rebalancing needs.`;
  }

  buildAllocationPrompt(d) {
    const alloc = d.allocation || {};
    const target = d.targetAllocation || {};
    return `Compare current vs target asset allocation:
Current: ${Object.entries(alloc).map(([k, v]) => `${k}: ${v.toFixed(1)}%`).join(', ')}
Target: ${Object.entries(target).map(([k, v]) => `${k}: ${v}%`).join(', ')}

Suggest rebalancing moves with specific categories to increase/decrease.`;
  }

  buildSpendingPrompt(d) {
    const cats = (d.categories || []).map(c =>
      `${c.category}: ₹${c.total?.toLocaleString()} (${c.count} transactions)`
    ).join('\n');
    return `Analyze spending patterns and suggest optimizations:
Monthly Income: ₹${d.monthlyIncome?.toLocaleString()}
Monthly Expenses: ₹${d.monthlyExpenses?.toLocaleString()}
Savings Rate: ${d.savingsRate?.toFixed(1)}%

Spending by Category:
${cats || 'No data'}

Highlight overspending areas and suggest a budget improvement.`;
  }

  buildGoalsPrompt(d) {
    const goals = (d.goals || []).map(g =>
      `${g.name}: Target ₹${g.target_amount?.toLocaleString()} by ${g.target_year}, Current ₹${g.current_value?.toLocaleString()}, Inflation ${g.inflation}%`
    ).join('\n');
    return `Evaluate financial goals progress:
${goals || 'No goals set'}

Monthly Income: ₹${d.monthlyIncome?.toLocaleString()}
Net Worth: ₹${d.netWorth?.toLocaleString()}

Assess which goals are on track, at risk, and suggest adjustments.`;
  }

  buildSalaryPrompt(d) {
    return `Analyze this salary structure for tax optimization:
Basic Pay: ₹${d.basic_pay?.toLocaleString()}/month
HRA: ₹${d.hra?.toLocaleString()}/month
DA: ₹${d.da?.toLocaleString()}/month
Special Allowance: ₹${d.special_allowance?.toLocaleString()}/month
Other: ₹${d.other_allowances?.toLocaleString()}/month
Gross: ₹${d.gross_salary?.toLocaleString()}/month
EPF Employee: ${d.epf_employee_pct || 12}%
EPF Employer: ${d.epf_employer_pct || 12}%
NPS: ${d.nps_pct || 0}%

Suggest tax-saving strategies under 80C, 80CCD, HRA exemption, and NPS benefits.`;
  }
}

module.exports = new AIService();

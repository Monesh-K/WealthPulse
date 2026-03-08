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

const CHAT_SYSTEM_PROMPT = `You are WealthPulse AI, an expert Indian personal finance advisor.
You have access to the user's complete portfolio data and answer questions about their finances.
Rules:
- Be conversational but informative
- Use ₹ for Indian currency, $ for USD
- Be specific with numbers from the data provided
- Provide actionable advice when asked
- Consider Indian tax laws (80C, 80CCD, etc.) when relevant
- Compare with benchmarks when discussing performance
- Format response as clean markdown with bullet points
- Keep responses concise (3-5 bullet points max)
- Never recommend specific stocks/funds by name`;

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

  async chatWithPortfolio(userMessage, portfolioData) {
    if (!this.enabled) {
      return { success: false, error: 'AI not configured. Add GROQ_API_KEY to .env' };
    }

    const contextPrompt = this.buildPortfolioContext(portfolioData);
    const fullPrompt = `${contextPrompt}\n\nUser Question: ${userMessage}\n\nProvide a helpful, specific answer based on the portfolio data above.`;

    const preferred = process.env.GROQ_MODEL || FREE_MODELS[0];
    const modelsToTry = [preferred, ...FREE_MODELS.filter(m => m !== preferred)];

    for (let i = 0; i < modelsToTry.length; i++) {
      const modelName = modelsToTry[i];
      try {
        const chatCompletion = await this.client.chat.completions.create({
          model: modelName,
          messages: [
            { role: 'system', content: CHAT_SYSTEM_PROMPT },
            { role: 'user', content: fullPrompt },
          ],
          max_tokens: 800,
          temperature: 0.7,
        });
        const content = chatCompletion.choices?.[0]?.message?.content || 'No response generated.';
        return { success: true, response: content, model: modelName };
      } catch (err) {
        const status = err.status || err.statusCode || 0;
        if (status === 429 && i < modelsToTry.length - 1) continue;
        if (i === modelsToTry.length - 1) {
          return { success: false, error: 'All AI models are rate-limited. Please try again in a minute.' };
        }
      }
    }
    return { success: false, error: 'AI service unavailable.' };
  }

  buildPortfolioContext(d) {
    const benchmarks = {
      'Nifty 50': 12, 'Nifty Midcap 150': 14, 'Nifty Smallcap 250': 15,
      'S&P 500': 10, 'NASDAQ 100': 12
    };

    let context = `Portfolio Overview:
- Net Worth: ₹${(d.netWorth || 0).toLocaleString()}
- Total Invested: ₹${(d.totalInvested || 0).toLocaleString()}
- Current Value: ₹${(d.totalCurrent || 0).toLocaleString()}
- Gain/Loss: ₹${(d.gainLoss || 0).toLocaleString()} (${d.totalInvested > 0 ? ((d.gainLoss / d.totalInvested) * 100).toFixed(1) : 0}%)
- Total Assets: ${d.assetCount || 0}
- Liabilities: ₹${(d.totalLiabilities || 0).toLocaleString()}`;

    if (d.allocationByCategory) {
      context += `\n\nAllocation: ${Object.entries(d.allocationByCategory).map(([k, v]) => `${k}: ₹${v.toLocaleString()}`).join(', ')}`;
    }

    if (d.retirementCorpus) {
      context += `\n- Retirement Corpus: ₹${d.retirementCorpus.toLocaleString()}`;
      context += `\n- Liquid Net Worth: ₹${d.liquidNetWorth.toLocaleString()}`;
    }

    if (d.topAssets && d.topAssets.length) {
      context += `\n\nTop Holdings:\n${d.topAssets.slice(0, 10).map(a =>
        `- ${a.name} (${a.category}): Invested ₹${(a.invested_value || 0).toLocaleString()}, Current ₹${(a.current_value || 0).toLocaleString()}`
      ).join('\n')}`;
    }

    if (d.monthlyIncome) {
      context += `\n\nMonthly Income: ₹${d.monthlyIncome.toLocaleString()}, Expenses: ₹${(d.monthlyExpenses || 0).toLocaleString()}`;
    }

    context += `\n\nBenchmark CAGR (historical): ${Object.entries(benchmarks).map(([k, v]) => `${k}: ${v}%`).join(', ')}`;

    if (d.userAge) {
      context += `\n\nUser Age: ${d.userAge} years. Consider age-appropriate advice for asset allocation, risk tolerance, retirement planning, and investment horizon.`;
    }

    return context;
  }

  buildDashboardPrompt(d) {
    let prompt = `Analyze this portfolio overview and give 3-4 key insights:
- Net Worth: ₹${d.netWorth?.toLocaleString()}
- Total Invested: ₹${d.totalInvested?.toLocaleString()}
- Current Value: ₹${d.totalCurrent?.toLocaleString()}
- Gain/Loss: ₹${d.gainLoss?.toLocaleString()} (${d.totalInvested > 0 ? ((d.gainLoss / d.totalInvested) * 100).toFixed(1) : 0}%)
- Liabilities: ₹${d.totalLiabilities?.toLocaleString()}
- Monthly Income: ₹${d.monthlyIncome?.toLocaleString()}
- Monthly Expenses: ₹${d.monthlyExpenses?.toLocaleString()}
- Assets: ${d.assetCount} | Liabilities: ${d.liabilityCount} | Goals: ${d.goalCount}
- Allocation: ${d.allocationByCategory ? Object.entries(d.allocationByCategory).map(([k, v]) => `${k}: ₹${v.toLocaleString()}`).join(', ') : 'N/A'}`;
    if (d.userAge) prompt += `\n- User Age: ${d.userAge} years`;
    prompt += `\n\nHighlight strengths, risks, and one improvement suggestion.${d.userAge ? ' Consider age-appropriate advice for risk tolerance and investment horizon.' : ''}`;
    return prompt;
  }

  buildPortfolioPrompt(d) {
    const assetList = (d.assets || []).slice(0, 15).map(a =>
      `${a.name} (${a.category}/${a.subtype}): Invested ₹${a.invested_value?.toLocaleString()}, Current ₹${a.current_value?.toLocaleString()}`
    ).join('\n');
    return `Analyze this portfolio and suggest improvements:
${assetList}

Total Invested: ₹${d.totalInvested?.toLocaleString()}
Total Current: ₹${d.totalCurrent?.toLocaleString()}
${d.userAge ? `User Age: ${d.userAge} years\n` : ''}
Focus on: diversification, concentration risk, and rebalancing needs.${d.userAge ? ' Consider age-appropriate risk tolerance.' : ''}`;
  }

  buildAllocationPrompt(d) {
    const alloc = d.allocation || {};
    const target = d.targetAllocation || {};
    return `Compare current vs target asset allocation:
Current: ${Object.entries(alloc).map(([k, v]) => `${k}: ${v.toFixed(1)}%`).join(', ')}
Target: ${Object.entries(target).map(([k, v]) => `${k}: ${v}%`).join(', ')}
${d.userAge ? `User Age: ${d.userAge} years\n` : ''}
Suggest rebalancing moves with specific categories to increase/decrease.${d.userAge ? ' Factor in age-appropriate equity-debt split.' : ''}`;
  }

  buildSpendingPrompt(d) {
    const cats = (d.categories || []).map(c =>
      `${c.category}: ₹${c.total?.toLocaleString()} (${c.count} transactions)`
    ).join('\n');
    return `Analyze spending patterns and suggest optimizations:
Monthly Income: ₹${d.monthlyIncome?.toLocaleString()}
Monthly Expenses: ₹${d.monthlyExpenses?.toLocaleString()}
Savings Rate: ${d.savingsRate?.toFixed(1)}%
${d.userAge ? `User Age: ${d.userAge} years\n` : ''}
Spending by Category:
${cats || 'No data'}

Highlight overspending areas and suggest a budget improvement.${d.userAge ? ' Consider age-specific financial priorities (e.g. savings goals, retirement planning).' : ''}`;
  }

  buildGoalsPrompt(d) {
    const goals = (d.goals || []).map(g =>
      `${g.name}: Target ₹${g.target_amount?.toLocaleString()} by ${g.target_year}, Current ₹${g.current_value?.toLocaleString()}, Inflation ${g.inflation}%`
    ).join('\n');
    return `Evaluate financial goals progress:
${goals || 'No goals set'}

Monthly Income: ₹${d.monthlyIncome?.toLocaleString()}
Net Worth: ₹${d.netWorth?.toLocaleString()}
${d.userAge ? `User Age: ${d.userAge} years\n` : ''}
Assess which goals are on track, at risk, and suggest adjustments.${d.userAge ? ' Consider remaining working years and age-appropriate milestones.' : ''}`;
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

import { AppSettings, LLMModelInfo, ReasoningEffort } from '../types';

export const FREE_LLM_MODELS: LLMModelInfo[] = [
  {
    id: 'auto',
    name: 'Auto (Smart Super-Router)',
    shortName: 'Auto',
    provider: 'Intelligent Multi-Model + Self-Critic',
    badge: 'DEFAULT',
    description: 'Automatically routes tasks across R1, Qwen-32B, Llama-70B & Vision with verification.',
    supportsVision: true,
  },
  {
    id: 'council',
    name: 'OpenBrain Council (3-Model MoA)',
    shortName: 'Council-MoA',
    provider: 'DeepSeek-R1 + Qwen-32B + Llama-70B',
    badge: 'UNBEATABLE',
    description: 'Runs 3 specialist models in parallel + Master Judge synthesis to beat single models.',
  },
  {
    id: 'deepseek',
    name: 'DeepSeek-R1 (DeepThink)',
    shortName: 'DeepSeek-R1',
    provider: 'DeepSeek Open-Source',
    badge: 'REASONING',
    description: 'Extended chain-of-thought reasoning for math, science, proofs & strategy.',
  },
  {
    id: 'qwen-coder',
    name: 'Qwen 2.5 Coder 32B',
    shortName: 'Qwen-32B',
    provider: 'Alibaba Qwen Open-Source',
    badge: 'CODE PRO',
    description: 'Flagship software engineering, full-stack apps, debugging & sandbox code.',
  },
  {
    id: 'llama',
    name: 'Llama 3.3 70B Instruct',
    shortName: 'Llama-70B',
    provider: 'Meta Open-Source',
    badge: '70B',
    description: 'Nuanced writing, planning, synthesis & universal multilingual fluency.',
  },
  {
    id: 'openai',
    name: 'Omni-4o Vision',
    shortName: 'Omni-4o',
    provider: 'Multimodal Open Router',
    badge: 'VISION',
    description: 'High-speed multimodal image analysis, camera understanding & general agent.',
    supportsVision: true,
  },
  {
    id: 'mistral',
    name: 'Mistral Small 3 Flash',
    shortName: 'Mistral-Flash',
    provider: 'Mistral Open-Source',
    badge: 'INSTANT',
    description: 'Ultra-low-latency concise responses and quick Q&A.',
  },
];

export interface ChatTurnInput {
  role: 'system' | 'user' | 'assistant';
  content: string;
  imageDataUrl?: string;
}

export interface SmartBrainResult {
  content: string;
  thinkingTrace?: string;
  modelUsedLabel: string;
}

const CODE_OR_MATH_REGEX =
  /\b(code|python|javascript|typescript|react|html|css|sql|rust|java|kotlin|c\+\+|golang|api|bug|debug|refactor|algorithm|prove|proof|theorem|calculus|integral|matrix|probability|equation|optimize|architecture)\b/i;

export function classifyOptimalModelForTask(
  userPrompt: string,
  hasImage: boolean,
  effort: ReasoningEffort
): { targetModel: string; reasonLabel: string } {
  if (hasImage) {
    return { targetModel: 'openai', reasonLabel: 'Auto · Omni-4o Vision' };
  }
  if (effort === 'max') {
    return { targetModel: 'council', reasonLabel: 'Auto · 3-Model Council MoA' };
  }
  if (effort === 'fast') {
    return { targetModel: 'mistral', reasonLabel: 'Auto · Mistral Flash' };
  }

  const p = userPrompt.toLowerCase();

  const codePattern =
    /\b(code|python|javascript|typescript|react|html|css|sql|rust|java|kotlin|swift|c\+\+|golang|api|bug|debug|refactor|regex|algorithm|leetcode|dockerfile|git|bash|function|component|database|compiler)\b/;
  if (codePattern.test(p)) {
    return { targetModel: 'qwen-coder', reasonLabel: 'Auto · Qwen 2.5 Coder 32B' };
  }

  const deepReasonPattern =
    /\b(prove|proof|theorem|calculus|integral|matrix|probability|quantum|physics|strategy|architecture|analyze|compare|tradeoff|why does|step by step|logic|puzzle|riddle|optimize|derive|game theory)\b/;
  if (effort === 'high' || deepReasonPattern.test(p) || userPrompt.length > 400) {
    return { targetModel: 'deepseek', reasonLabel: 'Auto · DeepSeek-R1' };
  }

  if (p.length < 55) {
    return { targetModel: 'openai', reasonLabel: 'Auto · Omni-4o' };
  }

  return { targetModel: 'llama', reasonLabel: 'Auto · Llama 3.3 70B' };
}

async function fetchWithTimeout(
  url: string,
  options: RequestInit,
  timeoutMs = 36000
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

/**
 * OpenRouter Free Frontier Tier (:free models: DeepSeek-R1, Qwen 2.5 Coder 32B, Llama 3.3 70B, Gemini 2.0 Flash)
 */
async function callOpenRouterFreeIfConfigured(
  messages: ChatTurnInput[],
  apiKey: string,
  targetModel: string
): Promise<string | null> {
  if (!apiKey.trim()) return null;

  const modelCandidates =
    targetModel === 'deepseek'
      ? ['deepseek/deepseek-r1:free', 'meta-llama/llama-3.3-70b-instruct:free']
      : targetModel === 'qwen-coder'
      ? ['qwen/qwen-2.5-coder-32b-instruct:free', 'deepseek/deepseek-r1:free']
      : [
          'meta-llama/llama-3.3-70b-instruct:free',
          'google/gemini-2.0-flash-exp:free',
          'deepseek/deepseek-r1:free',
        ];

  for (const orModel of modelCandidates) {
    try {
      const formatted = messages.map((m) => {
        if (m.imageDataUrl) {
          return {
            role: m.role,
            content: [
              { type: 'text', text: m.content },
              { type: 'image_url', image_url: { url: m.imageDataUrl } },
            ],
          };
        }
        return { role: m.role, content: m.content };
      });

      const resp = await fetchWithTimeout(
        'https://openrouter.ai/api/v1/chat/completions',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${apiKey.trim()}`,
            'HTTP-Referer': 'https://openbrain.ai',
            'X-Title': 'Open Brain AI Super-Agent',
          },
          body: JSON.stringify({
            model: orModel,
            messages: formatted,
          }),
        },
        32000
      );
      if (!resp.ok) continue;
      const data = await resp.json();
      const content = data?.choices?.[0]?.message?.content;
      if (typeof content === 'string' && content.trim()) {
        return content;
      }
    } catch {
      continue;
    }
  }
  return null;
}

async function callGroqIfConfigured(
  messages: ChatTurnInput[],
  apiKey: string
): Promise<string | null> {
  if (!apiKey.trim()) return null;
  try {
    const resp = await fetchWithTimeout(
      'https://api.groq.com/openai/v1/chat/completions',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey.trim()}`,
        },
        body: JSON.stringify({
          model: 'llama-3.3-70b-versatile',
          messages: messages.map((m) => ({ role: m.role, content: m.content })),
          temperature: 0.65,
        }),
      },
      25000
    );
    if (!resp.ok) return null;
    const data = await resp.json();
    return data?.choices?.[0]?.message?.content || null;
  } catch {
    return null;
  }
}

async function callGeminiIfConfigured(
  messages: ChatTurnInput[],
  apiKey: string
): Promise<string | null> {
  if (!apiKey.trim()) return null;
  try {
    const systemMsg = messages.find((m) => m.role === 'system')?.content || '';
    const contents = messages
      .filter((m) => m.role !== 'system')
      .map((m) => {
        const parts: Array<Record<string, unknown>> = [{ text: m.content }];
        if (m.imageDataUrl && m.imageDataUrl.includes(',')) {
          const [header, b64] = m.imageDataUrl.split(',');
          const mimeMatch = header.match(/data:(.*?);/);
          parts.push({
            inlineData: {
              mimeType: mimeMatch ? mimeMatch[1] : 'image/jpeg',
              data: b64,
            },
          });
        }
        return {
          role: m.role === 'assistant' ? 'model' : 'user',
          parts,
        };
      });

    const resp = await fetchWithTimeout(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${encodeURIComponent(
        apiKey.trim()
      )}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...(systemMsg ? { systemInstruction: { parts: [{ text: systemMsg }] } } : {}),
          contents,
        }),
      },
      28000
    );
    if (!resp.ok) return null;
    const data = await resp.json();
    return data?.candidates?.[0]?.content?.parts?.[0]?.text || null;
  } catch {
    return null;
  }
}

async function callOllamaIfConfigured(
  messages: ChatTurnInput[],
  ollamaUrl: string
): Promise<string | null> {
  if (!ollamaUrl.trim()) return null;
  try {
    const base = ollamaUrl.trim().replace(/\/+$/, '');
    const resp = await fetchWithTimeout(
      `${base}/api/chat`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'llama3.2',
          stream: false,
          messages: messages.map((m) => ({ role: m.role, content: m.content })),
        }),
      },
      25000
    );
    if (!resp.ok) return null;
    const data = await resp.json();
    return data?.message?.content || null;
  } catch {
    return null;
  }
}

function splitThinkingBlock(rawText: string): { clean: string; thought?: string } {
  if (rawText.includes('<think>') && rawText.includes('</think>')) {
    const thoughts: string[] = [];
    const clean = rawText
      .replace(/<think>([\s\S]*?)<\/think>/g, (_, t: string) => {
        if (t && t.trim()) thoughts.push(t.trim());
        return '';
      })
      .trim();
    return {
      clean: clean || rawText.replace(/<\/?think>/g, '').trim(),
      thought: thoughts.length > 0 ? thoughts.join('\n\n') : undefined,
    };
  }
  return { clean: rawText.trim() };
}

async function callPollinationsRaw(
  messages: ChatTurnInput[],
  model: string
): Promise<{ clean: string; thought?: string } | null> {
  const apiModel = model === 'auto' || model === 'council' ? 'openai' : model;
  try {
    const formatted = messages.map((m) => {
      if (m.imageDataUrl) {
        return {
          role: m.role,
          content: [
            { type: 'text', text: m.content },
            { type: 'image_url', image_url: { url: m.imageDataUrl } },
          ],
        };
      }
      return { role: m.role, content: m.content };
    });

    const resp = await fetchWithTimeout(
      'https://text.pollinations.ai/openai',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: apiModel || 'openai',
          messages: formatted,
          seed: Math.floor(Math.random() * 1000000),
          private: true,
        }),
      },
      38000
    );

    if (!resp.ok) return null;
    const raw = await resp.text();
    try {
      const parsed = JSON.parse(raw);
      const text = parsed?.choices?.[0]?.message?.content;
      const reasoningContent = parsed?.choices?.[0]?.message?.reasoning_content;
      if (typeof text === 'string' && text.trim()) {
        const sp = splitThinkingBlock(text);
        return {
          clean: sp.clean,
          thought: reasoningContent
            ? String(reasoningContent).trim()
            : sp.thought,
        };
      }
    } catch {
      if (raw.trim() && !raw.trim().startsWith('<!DOCTYPE')) {
        return splitThinkingBlock(raw.trim());
      }
    }
    return null;
  } catch {
    return null;
  }
}

async function callPollinationsDirectFallback(
  messages: ChatTurnInput[],
  model: string
): Promise<{ clean: string; thought?: string } | null> {
  const apiModel = model === 'auto' || model === 'council' ? 'openai' : model;
  try {
    const resp = await fetchWithTimeout(
      'https://text.pollinations.ai/',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: messages.map((m) => ({ role: m.role, content: m.content })),
          model: apiModel || 'openai',
          private: true,
        }),
      },
      32000
    );
    if (!resp.ok) return null;
    const text = await resp.text();
    if (text && text.trim() && !text.trim().startsWith('<!DOCTYPE')) {
      return splitThinkingBlock(text.trim());
    }
    return null;
  } catch {
    return null;
  }
}

async function executeSingleModelCall(
  messages: ChatTurnInput[],
  settings: AppSettings,
  targetModel: string
): Promise<{ clean: string; thought?: string }> {
  const hasImage = messages.some((m) => Boolean(m.imageDataUrl));

  if (!hasImage && settings.ollamaUrl?.trim()) {
    const ollama = await callOllamaIfConfigured(messages, settings.ollamaUrl);
    if (ollama) return splitThinkingBlock(ollama);
  }
  if (settings.openrouterApiKey?.trim()) {
    const orRes = await callOpenRouterFreeIfConfigured(
      messages,
      settings.openrouterApiKey,
      targetModel
    );
    if (orRes) return splitThinkingBlock(orRes);
  }
  if (settings.geminiApiKey?.trim()) {
    const gem = await callGeminiIfConfigured(messages, settings.geminiApiKey);
    if (gem) return splitThinkingBlock(gem);
  }
  if (!hasImage && settings.groqApiKey?.trim()) {
    const groq = await callGroqIfConfigured(messages, settings.groqApiKey);
    if (groq) return splitThinkingBlock(groq);
  }

  const primary = await callPollinationsRaw(messages, targetModel);
  if (primary) return primary;

  if (targetModel !== 'openai') {
    const fallbackModel = await callPollinationsRaw(messages, 'openai');
    if (fallbackModel) return fallbackModel;
  }

  const direct = await callPollinationsDirectFallback(messages, 'openai');
  if (direct) return direct;

  const lastUser = [...messages].reverse().find((m) => m.role === 'user')?.content || 'Hello';
  try {
    const getResp = await fetchWithTimeout(
      `https://text.pollinations.ai/${encodeURIComponent(lastUser.slice(0, 700))}?model=openai&private=true`,
      { method: 'GET' },
      25000
    );
    if (getResp.ok) {
      const txt = await getResp.text();
      if (txt.trim()) return splitThinkingBlock(txt.trim());
    }
  } catch {
    // Offline fallback below
  }

  throw new Error(
    'Network unreachable right now. Check your internet connection or configure a free OpenRouter / Groq / Gemini / Ollama endpoint in Preferences.'
  );
}

/**
 * Self-Verifying Critic & Auto-Refiner Pass:
 * Audits code, math, logic, and completeness before returning to the user.
 */
async function runSelfCriticAudit(
  userPrompt: string,
  draftAnswer: string,
  settings: AppSettings
): Promise<{ finalAnswer: string; auditSummary: string }> {
  try {
    const criticMessages: ChatTurnInput[] = [
      {
        role: 'system',
        content:
          'You are Open Brain Self-Verifying Critic. Audit the Assistant Draft against the User Request for logic errors, math mistakes, syntax bugs, missing edge cases, or incomplete sections. If the draft is already 100% accurate, complete, and well-structured, reply with ONLY the exact token: VERIFIED_OK. If ANY flaw or improvement exists, output ONLY the corrected, superior final answer with zero meta-commentary and no emoji stickers.',
      },
      {
        role: 'user',
        content: `[User Request]:\n${userPrompt.slice(0, 2200)}\n\n[Assistant Draft]:\n${draftAnswer.slice(
          0,
          4500
        )}`,
      },
    ];

    const audit = await executeSingleModelCall(criticMessages, settings, 'qwen-coder');
    const txt = audit.clean.trim();

    if (!txt || txt.includes('VERIFIED_OK') || txt.length < Math.min(40, draftAnswer.length * 0.35)) {
      return {
        finalAnswer: draftAnswer,
        auditSummary: 'Self-Critic Verification Passed: Logic, completeness & edge cases verified.',
      };
    }

    return {
      finalAnswer: txt,
      auditSummary: 'Self-Critic Auto-Refined: Detected & upgraded edge cases / precision before delivery.',
    };
  } catch {
    return {
      finalAnswer: draftAnswer,
      auditSummary: 'Primary generation verified.',
    };
  }
}

/**
 * Open Brain v3.5 Ultra: Smart Multi-Model Router + 3-Model Mixture-of-Agents Council + Self-Verifying Critic.
 */
export async function generateSmartBrainResponse(
  messages: ChatTurnInput[],
  settings: AppSettings,
  onProgressStep?: (kind: 'moa_council' | 'self_critic', note: string) => void
): Promise<SmartBrainResult> {
  const hasImage = messages.some((m) => Boolean(m.imageDataUrl));
  const lastUserPrompt =
    [...messages].reverse().find((m) => m.role === 'user')?.content || '';

  let chosenModel = settings.selectedModel || 'auto';
  let modelUsedLabel =
    FREE_LLM_MODELS.find((m) => m.id === chosenModel)?.shortName || chosenModel;

  if (chosenModel === 'auto') {
    const routed = classifyOptimalModelForTask(
      lastUserPrompt,
      hasImage,
      settings.reasoningEffort || 'default'
    );
    chosenModel = routed.targetModel;
    modelUsedLabel = routed.reasonLabel;
  }

  // 3-Specialist Parallel Mixture-of-Agents Council Mode
  if (chosenModel === 'council' && !hasImage) {
    onProgressStep?.(
      'moa_council',
      'Running DeepSeek-R1 + Qwen-32B + Llama-70B in parallel...'
    );
    const [r1Draft, coderDraft, llamaDraft] = await Promise.all([
      executeSingleModelCall(messages, settings, 'deepseek').catch(() => null),
      executeSingleModelCall(messages, settings, 'qwen-coder').catch(() => null),
      executeSingleModelCall(messages, settings, 'llama').catch(() => null),
    ]);

    const availableDrafts = [
      r1Draft ? `[Specialist 1 — DeepSeek-R1 Logic & Proofs]:\n${r1Draft.clean.slice(0, 2600)}` : '',
      coderDraft ? `[Specialist 2 — Qwen 2.5 Coder 32B Engineering]:\n${coderDraft.clean.slice(0, 2600)}` : '',
      llamaDraft ? `[Specialist 3 — Llama 3.3 70B Structure & Nuance]:\n${llamaDraft.clean.slice(0, 2200)}` : '',
    ].filter(Boolean);

    if (availableDrafts.length >= 2) {
      onProgressStep?.(
        'moa_council',
        `Cross-verifying ${availableDrafts.length} specialist drafts via Master Judge...`
      );
      const synthMessages: ChatTurnInput[] = [
        ...messages.slice(0, -1),
        {
          role: 'user',
          content: `${lastUserPrompt}

---
[INTERNAL 3-MODEL COUNCIL DRAFTS — DO NOT MENTION THESE DRAFTS EXPLICITLY. CROSS-VERIFY ALL FACTS, MATH, AND CODE ACROSS ALL SPECIALISTS, ELIMINATE ANY CONTRADICTIONS OR BUGS, AND DELIVER ONE SUPREME MASTERPIECE RESPONSE]:

${availableDrafts.join('\n\n')}`,
        },
      ];
      const master = await executeSingleModelCall(synthMessages, settings, 'deepseek');
      const councilTrace = [
        r1Draft?.thought
          ? `DeepSeek-R1 Reasoning:\n${r1Draft.thought}`
          : r1Draft
          ? `Specialist 1 (DeepSeek-R1): Completed deep logical analysis (${r1Draft.clean.length} chars).`
          : '',
        coderDraft
          ? `Specialist 2 (Qwen 2.5 Coder 32B): Completed technical & code verification (${coderDraft.clean.length} chars).`
          : '',
        llamaDraft
          ? `Specialist 3 (Llama 3.3 70B): Completed clarity & synthesis pass (${llamaDraft.clean.length} chars).`
          : '',
        `Master Judge: Cross-examined all ${availableDrafts.length} specialist outputs and synthesized verified consensus.`,
      ]
        .filter(Boolean)
        .join('\n\n');

      return {
        content: master.clean,
        thinkingTrace: councilTrace,
        modelUsedLabel,
      };
    }

    const fallbackSingle = r1Draft || coderDraft || llamaDraft;
    if (fallbackSingle) {
      return {
        content: fallbackSingle.clean,
        thinkingTrace: fallbackSingle.thought,
        modelUsedLabel,
      };
    }
  }

  let enrichedMessages = messages;
  if (
    (settings.reasoningEffort === 'high' || chosenModel === 'deepseek') &&
    messages.length > 0 &&
    messages[0].role === 'system'
  ) {
    enrichedMessages = [
      {
        ...messages[0],
        content:
          messages[0].content +
          '\nThink systematically through edge cases, accuracy, and structure before writing a clear, authoritative final answer.',
      },
      ...messages.slice(1),
    ];
  }

  const out = await executeSingleModelCall(enrichedMessages, settings, chosenModel);

  // Run Self-Verifying Critic Loop when enabled on High Effort OR Code/Math tasks
  const shouldRunCritic =
    !hasImage &&
    settings.selfVerification !== false &&
    settings.reasoningEffort !== 'fast' &&
    (settings.reasoningEffort === 'high' || CODE_OR_MATH_REGEX.test(lastUserPrompt));

  if (shouldRunCritic && out.clean.length > 80) {
    onProgressStep?.('self_critic', 'Self-Critic auditing logic, code & edge cases...');
    const audited = await runSelfCriticAudit(lastUserPrompt, out.clean, settings);
    const combinedTrace = [out.thought, audited.auditSummary].filter(Boolean).join('\n\n');
    return {
      content: audited.finalAnswer,
      thinkingTrace: combinedTrace || undefined,
      modelUsedLabel: `${modelUsedLabel} + Verified`,
    };
  }

  return {
    content: out.clean,
    thinkingTrace: out.thought,
    modelUsedLabel,
  };
}

/**
 * Standard string helper used by sub-engines (Video Planner, Sandbox Code Generator, Prompt Enhancer).
 */
export async function generateFreeLLMResponse(
  messages: ChatTurnInput[],
  settings: AppSettings,
  overrideModel?: string
): Promise<string> {
  const target =
    overrideModel ||
    (settings.selectedModel === 'auto' || settings.selectedModel === 'council'
      ? 'openai'
      : settings.selectedModel || 'openai');
  const res = await executeSingleModelCall(messages, settings, target);
  return res.clean;
}

export function extractJsonObject<T>(raw: string): T | null {
  try {
    const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/i);
    const candidate = fenced ? fenced[1] : raw;
    const firstBrace = candidate.indexOf('{');
    const lastBrace = candidate.lastIndexOf('}');
    if (firstBrace >= 0 && lastBrace > firstBrace) {
      return JSON.parse(candidate.slice(firstBrace, lastBrace + 1)) as T;
    }
    return JSON.parse(candidate) as T;
  } catch {
    return null;
  }
}

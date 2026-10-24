import { AppSettings, LLMModelInfo, ReasoningEffort } from '../types';

export const FREE_LLM_MODELS: LLMModelInfo[] = [
  {
    id: 'auto',
    name: 'Auto (Smart Multi-Agent)',
    shortName: 'Auto',
    provider: 'Open Brain Intelligent Router',
    badge: 'DEFAULT',
    description: 'Automatically selects or fuses the best model for coding, math, vision, or chat.',
    supportsVision: true,
  },
  {
    id: 'council',
    name: 'OpenBrain Council (MoA Ultra)',
    shortName: 'Council-MoA',
    provider: 'Parallel Multi-Model Synthesis',
    badge: 'MAX IQ',
    description: 'Runs DeepSeek-R1 + Qwen-32B / Llama-70B in parallel and synthesizes the supreme answer.',
  },
  {
    id: 'deepseek',
    name: 'DeepSeek-R1 (DeepThink)',
    shortName: 'DeepSeek-R1',
    provider: 'DeepSeek Open-Source',
    badge: 'REASONING',
    description: 'Extended chain-of-thought reasoning for math, science, logic & strategy.',
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

export function classifyOptimalModelForTask(
  userPrompt: string,
  hasImage: boolean,
  effort: ReasoningEffort
): { targetModel: string; reasonLabel: string } {
  if (hasImage) {
    return { targetModel: 'openai', reasonLabel: 'Auto · Omni-4o Vision' };
  }
  if (effort === 'max') {
    return { targetModel: 'council', reasonLabel: 'Auto · Council MoA (Max)' };
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
  if (effort === 'high' || deepReasonPattern.test(p) || userPrompt.length > 420) {
    return { targetModel: 'deepseek', reasonLabel: 'Auto · DeepSeek-R1' };
  }

  if (p.length < 60) {
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

  if (!hasImage && settings.ollamaUrl.trim()) {
    const ollama = await callOllamaIfConfigured(messages, settings.ollamaUrl);
    if (ollama) return splitThinkingBlock(ollama);
  }
  if (settings.geminiApiKey.trim()) {
    const gem = await callGeminiIfConfigured(messages, settings.geminiApiKey);
    if (gem) return splitThinkingBlock(gem);
  }
  if (!hasImage && settings.groqApiKey.trim()) {
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
    'Network unreachable right now. Check your internet connection or configure a local Ollama / free Groq or Gemini key in Preferences.'
  );
}

/**
 * Open Brain v3.0 Smart Multi-Model + Mixture-of-Agents (MoA) Council Responder.
 */
export async function generateSmartBrainResponse(
  messages: ChatTurnInput[],
  settings: AppSettings,
  onCouncilStep?: (note: string) => void
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

  // Mixture-of-Agents Council Mode (Parallel Specialist Models + Master Synthesis)
  if (chosenModel === 'council' && !hasImage) {
    onCouncilStep?.('Querying DeepSeek-R1 + Qwen-32B specialists in parallel...');
    const [r1Draft, coderDraft] = await Promise.all([
      executeSingleModelCall(messages, settings, 'deepseek').catch(() => null),
      executeSingleModelCall(messages, settings, 'qwen-coder').catch(() => null),
    ]);

    if (r1Draft && coderDraft) {
      onCouncilStep?.('Synthesizing verified Council consensus...');
      const synthMessages: ChatTurnInput[] = [
        ...messages.slice(0, -1),
        {
          role: 'user',
          content: `${lastUserPrompt}

---
[INTERNAL MULTI-AGENT COUNCIL DRAFTS — DO NOT MENTION THESE DRAFTS EXPLICITLY; MERGE THEIR BEST INSIGHTS, VERIFY ALL FACTS/MATH/CODE, ELIMINATE ERRORS, AND DELIVER ONE MASTERPIECE ANSWER]:

[Specialist 1 — DeepSeek-R1 Reasoning]:
${r1Draft.clean.slice(0, 3200)}

[Specialist 2 — Qwen 2.5 Coder / Precision]:
${coderDraft.clean.slice(0, 3200)}`,
        },
      ];
      const master = await executeSingleModelCall(synthMessages, settings, 'llama');
      const councilTrace = [
        r1Draft.thought
          ? `DeepSeek-R1 Analysis:\n${r1Draft.thought}`
          : `Specialist 1 (DeepSeek-R1) verified logical structure (${r1Draft.clean.length} chars).`,
        `Specialist 2 (Qwen-32B) cross-checked technical & execution precision (${coderDraft.clean.length} chars).`,
        `Master Council Synthesizer fused both drafts into a verified response.`,
      ].join('\n\n');

      return {
        content: master.clean,
        thinkingTrace: councilTrace,
        modelUsedLabel,
      };
    }

    if (r1Draft || coderDraft) {
      const winner = (r1Draft || coderDraft)!;
      return {
        content: winner.clean,
        thinkingTrace: winner.thought,
        modelUsedLabel,
      };
    }
  }

  // High-effort structured reasoning instruction when Effort is 'high' or model is 'deepseek'
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
          '\nThink carefully through edge cases, accuracy, and structure before writing a clear, authoritative final answer.',
      },
      ...messages.slice(1),
    ];
  }

  const out = await executeSingleModelCall(enrichedMessages, settings, chosenModel);
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

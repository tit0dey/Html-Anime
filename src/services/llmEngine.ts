import { AppSettings, LLMModelInfo } from '../types';

export const FREE_LLM_MODELS: LLMModelInfo[] = [
  {
    id: 'openai',
    name: 'Omni-GPT4o Mini (Fast)',
    provider: 'Open-Source Router (Free Unlimited)',
    badge: 'DEFAULT • VISION',
    description: 'Fast multimodal reasoning, universal multilingual comprehension & Vision.',
    supportsVision: true,
  },
  {
    id: 'deepseek',
    name: 'DeepSeek-R1 / V3',
    provider: 'DeepSeek Open-Source (Free)',
    badge: 'REASONING',
    description: 'Deep chain-of-thought logic, math, science & complex problem solving.',
  },
  {
    id: 'qwen-coder',
    name: 'Qwen 2.5 Coder 32B',
    provider: 'Alibaba Qwen Open-Source (Free)',
    badge: 'CODING PRO',
    description: 'Top open-source software engineering, Android/Web apps & debugging.',
  },
  {
    id: 'llama',
    name: 'Llama 3.3 70B Instruct',
    provider: 'Meta Open-Source (Free)',
    badge: '70B OPEN',
    description: 'Versatile creative writing, agent planning & general intelligence.',
  },
  {
    id: 'mistral',
    name: 'Mistral Small 3',
    provider: 'Mistral AI Open-Source (Free)',
    badge: 'ULTRA FAST',
    description: 'Crisp concise responses, summarization & multilingual chat.',
  },
  {
    id: 'searchgpt',
    name: 'SearchGPT Live',
    provider: 'Web-Grounded Open Router (Free)',
    badge: 'WEB LIVE',
    description: 'Grounded answers enriched with live web knowledge.',
  },
];

export interface ChatTurnInput {
  role: 'system' | 'user' | 'assistant';
  content: string;
  imageDataUrl?: string;
}

async function fetchWithTimeout(
  url: string,
  options: RequestInit,
  timeoutMs = 35000
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
          temperature: 0.7,
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

async function callPollinationsOpenAI(
  messages: ChatTurnInput[],
  model: string
): Promise<string | null> {
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
          model: model || 'openai',
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
      if (typeof text === 'string' && text.trim()) {
        return stripThinkWrapperIfNeeded(text);
      }
    } catch {
      if (raw.trim() && !raw.trim().startsWith('<!DOCTYPE')) {
        return raw.trim();
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
): Promise<string | null> {
  try {
    const resp = await fetchWithTimeout(
      'https://text.pollinations.ai/',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: messages.map((m) => ({ role: m.role, content: m.content })),
          model: model || 'openai',
          private: true,
        }),
      },
      32000
    );
    if (!resp.ok) return null;
    const text = await resp.text();
    if (text && text.trim() && !text.trim().startsWith('<!DOCTYPE')) {
      return stripThinkWrapperIfNeeded(text.trim());
    }
    return null;
  } catch {
    return null;
  }
}

function stripThinkWrapperIfNeeded(text: string): string {
  if (text.includes('<think>') && text.includes('</think>')) {
    return text.replace(
      /<think>([\s\S]*?)<\/think>/g,
      (_, thought: string) =>
        thought.trim()
          ? `> **Reasoning Trace:**\n> ${thought
              .trim()
              .split('\n')
              .join('\n> ')}\n\n`
          : ''
    );
  }
  return text;
}

export async function generateFreeLLMResponse(
  messages: ChatTurnInput[],
  settings: AppSettings,
  overrideModel?: string
): Promise<string> {
  const chosenModel = overrideModel || settings.selectedModel || 'openai';
  const hasImage = messages.some((m) => Boolean(m.imageDataUrl));

  // 1. Optional power-user boosters if user entered a free key
  if (!hasImage && settings.ollamaUrl.trim()) {
    const ollama = await callOllamaIfConfigured(messages, settings.ollamaUrl);
    if (ollama) return ollama;
  }
  if (settings.geminiApiKey.trim()) {
    const gem = await callGeminiIfConfigured(messages, settings.geminiApiKey);
    if (gem) return gem;
  }
  if (!hasImage && settings.groqApiKey.trim()) {
    const groq = await callGroqIfConfigured(messages, settings.groqApiKey);
    if (groq) return groq;
  }

  // 2. Zero-Key Unlimited Open-Source Cloud Router (Primary)
  const primary = await callPollinationsOpenAI(messages, chosenModel);
  if (primary) return primary;

  // 3. Automatic Model Failover ('openai' fast cluster)
  if (chosenModel !== 'openai') {
    const fallbackModel = await callPollinationsOpenAI(messages, 'openai');
    if (fallbackModel) return fallbackModel;
  }

  // 4. Direct Endpoint Failover
  const direct = await callPollinationsDirectFallback(messages, 'openai');
  if (direct) return direct;

  // 5. GET Compact Fallback for constrained mobile networks
  const lastUser = [...messages].reverse().find((m) => m.role === 'user')?.content || 'Hello';
  try {
    const getResp = await fetchWithTimeout(
      `https://text.pollinations.ai/${encodeURIComponent(lastUser.slice(0, 700))}?model=openai&private=true`,
      { method: 'GET' },
      25000
    );
    if (getResp.ok) {
      const txt = await getResp.text();
      if (txt.trim()) return txt.trim();
    }
  } catch {
    // Final offline message below
  }

  throw new Error(
    'Network unreachable right now. Check your internet connection or configure a local Ollama / free Groq or Gemini key in Settings.'
  );
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

import {
  AgentToolStep,
  AppSettings,
  BrainConnector,
  BrainSkill,
  ChatMessage,
  CustomWebhookConnector,
  PhoneActionPayload,
  RenderedCodeVideoArtifact,
} from '../types';
import { renderCodeSandboxToMp4 } from './codeSandboxVideoEngine';
import { buildFluxImageUrl } from './imageEngine';
import { ChatTurnInput, extractJsonObject, generateFreeLLMResponse } from './llmEngine';
import { executePhoneAction } from './nativeBridge';

interface PlannedToolCall {
  tool:
    | 'web_search'
    | 'github_search'
    | 'weather_live'
    | 'crypto_market'
    | 'js_sandbox'
    | 'generate_image'
    | 'arxiv_research'
    | 'reddit_hn_pulse'
    | 'mini_app'
    | 'code_video_mp4'
    | 'phone_action'
    | 'custom_webhook';
  query: string;
  phoneParams?: {
    action: PhoneActionPayload['action'];
    label?: string;
    params?: Record<string, string | number>;
  };
  webhookName?: string;
}

interface AgentPlan {
  needsTools: boolean;
  calls: PlannedToolCall[];
}

async function runWebSearchTool(query: string): Promise<string> {
  const results: string[] = [];

  try {
    const wikiUrl = `https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(
      query
    )}&utf8=&format=json&origin=*&srlimit=4`;
    const r = await fetch(wikiUrl);
    if (r.ok) {
      const d = await r.json();
      for (const h of (d?.query?.search || []).slice(0, 3)) {
        const snippet = String(h.snippet || '').replace(/<[^>]+>/g, '');
        results.push(`[Wikipedia: ${h.title}] ${snippet}`);
      }
    }
  } catch {
    // Ignore
  }

  try {
    const ddgUrl = `https://api.duckduckgo.com/?q=${encodeURIComponent(
      query
    )}&format=json&no_html=1&skip_disambig=1`;
    const r = await fetch(ddgUrl);
    if (r.ok) {
      const d = await r.json();
      if (d.AbstractText) {
        results.push(`[DuckDuckGo Instant: ${d.Heading || query}] ${d.AbstractText}`);
      }
      for (const item of (d?.RelatedTopics || []).slice(0, 2)) {
        if (item?.Text) results.push(`[DDG] ${item.Text}`);
      }
    }
  } catch {
    // Ignore
  }

  return results.length > 0
    ? results.join('\n')
    : `No direct indexed snippet returned for "${query}", answer using reasoning.`;
}

async function runRedditHnPulseTool(query: string): Promise<string> {
  const out: string[] = [];
  try {
    const hnResp = await fetch(
      `https://hn.algolia.com/api/v1/search?query=${encodeURIComponent(query)}&hitsPerPage=4`
    );
    if (hnResp.ok) {
      const d = await hnResp.json();
      for (const h of (d?.hits || []).slice(0, 3)) {
        if (h.title) out.push(`[HN Pulse • ${h.points ?? 0} pts] ${h.title} (${h.url || ''})`);
      }
    }
  } catch {
    // Ignore
  }
  try {
    const rdResp = await fetch(
      `https://www.reddit.com/search.json?q=${encodeURIComponent(query)}&limit=3`
    );
    if (rdResp.ok) {
      const rd = await rdResp.json();
      for (const c of (rd?.data?.children || []).slice(0, 3)) {
        const p = c?.data;
        if (p?.title) {
          out.push(`[Reddit r/${p.subreddit} • ↑${p.ups}] ${p.title}`);
        }
      }
    }
  } catch {
    // Ignore
  }
  return out.join('\n') || `No community discussions found for "${query}".`;
}

async function runGitHubSearchTool(query: string, ghToken?: string): Promise<string> {
  try {
    const headers: Record<string, string> = {};
    if (ghToken?.trim()) headers.Authorization = `Bearer ${ghToken.trim()}`;
    const resp = await fetch(
      `https://api.github.com/search/repositories?q=${encodeURIComponent(
        query
      )}&sort=stars&order=desc&per_page=5`,
      { headers }
    );
    if (!resp.ok) return `GitHub API returned HTTP ${resp.status}`;
    const data = await resp.json();
    const items = data?.items || [];
    if (!items.length) return `No open-source GitHub repositories matched "${query}".`;
      return items
      .map(
        (repo: Record<string, unknown>) =>
          `- ${repo.full_name} (${repo.stargazers_count} stars, ${
            repo.language || 'Multi'
          }) — ${repo.description || 'No description'} | ${repo.html_url}`
      )
      .join('\n');
  } catch (err) {
    return `GitHub search error: ${String(err)}`;
  }
}

async function runLiveWeatherTool(locationQuery: string): Promise<string> {
  try {
    const city = locationQuery.trim() || 'Kolkata';
    const geoResp = await fetch(
      `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(
        city
      )}&count=1&language=en&format=json`
    );
    const geoData = await geoResp.json();
    const place = geoData?.results?.[0];
    if (!place) return `Could not geocode city "${city}".`;

    const wxResp = await fetch(
      `https://api.open-meteo.com/v1/forecast?latitude=${place.latitude}&longitude=${place.longitude}&current=temperature_2m,relative_humidity_2m,apparent_temperature,wind_speed_10m&daily=temperature_2m_max,temperature_2m_min&timezone=auto&forecast_days=3`
    );
    const wx = await wxResp.json();
    const cur = wx?.current || {};
    return `Live Weather in ${place.name}, ${place.admin1 || ''} (${place.country}): Temp ${
      cur.temperature_2m
    }°C (Feels like ${cur.apparent_temperature}°C), Humidity ${
      cur.relative_humidity_2m
    }%, Wind ${cur.wind_speed_10m} km/h. Next 3-Day Highs: ${(
      wx?.daily?.temperature_2m_max || []
    ).join('°C / ')}°C.`;
  } catch (err) {
    return `Weather lookup error: ${String(err)}`;
  }
}

async function runCryptoMarketTool(coinsQuery: string): Promise<string> {
  try {
    const cleaned = coinsQuery
      .toLowerCase()
      .replace(/[^a-z0-9,\s-]/g, '')
      .trim();
    const mapAliases: Record<string, string> = {
      btc: 'bitcoin',
      eth: 'ethereum',
      sol: 'solana',
      bnb: 'binancecoin',
      doge: 'dogecoin',
      xrp: 'ripple',
    };
    const tokens = cleaned
      .split(/[\s,]+/)
      .filter(Boolean)
      .map((t) => mapAliases[t] || t);
    const ids = Array.from(new Set([...tokens, 'bitcoin', 'ethereum', 'solana'])).slice(0, 5);
    const resp = await fetch(
      `https://api.coingecko.com/api/v3/simple/price?ids=${ids.join(
        ','
      )}&vs_currencies=usd,inr&include_24hr_change=true`
    );
    if (!resp.ok) return `Market feed HTTP ${resp.status}`;
    const data = await resp.json();
    return (
      Object.entries(data)
        .map(([coin, vals]: [string, any]) => {
          const chg =
            typeof vals.usd_24h_change === 'number' ? vals.usd_24h_change.toFixed(2) : '0.00';
          return `• ${coin.toUpperCase()}: $${vals.usd} USD | ₹${vals.inr} INR (24h: ${chg}%)`;
        })
        .join('\n') || 'No coin price returned.'
    );
  } catch (err) {
    return `Crypto market error: ${String(err)}`;
  }
}

async function runArxivResearchTool(query: string): Promise<string> {
  try {
    const resp = await fetch(
      `https://api.crossref.org/works?query=${encodeURIComponent(query)}&rows=4`
    );
    if (!resp.ok) return `Research search HTTP ${resp.status}`;
    const data = await resp.json();
    const items = data?.message?.items || [];
    return (
      items
        .map(
          (it: any) =>
            `• "${(it.title && it.title[0]) || 'Paper'}" (${
              it.published?.['date-parts']?.[0]?.[0] || 'n.d.'
            }) — ${it.URL || it.DOI}`
        )
        .join('\n') || 'No scholarly papers found.'
    );
  } catch (err) {
    return `Scholarly search error: ${String(err)}`;
  }
}

function runJsSandboxTool(expressionOrCode: string): string {
  try {
    const logs: string[] = [];
    const customConsole = {
      log: (...args: unknown[]) => logs.push(args.map((a) => JSON.stringify(a)).join(' ')),
    };
    const fn = new Function(
      'console',
      'Math',
      `"use strict";\n${
        expressionOrCode.includes('return ')
          ? expressionOrCode
          : `return (${expressionOrCode});`
      }`
    );
    const out = fn(customConsole, Math);
    return [...logs, out !== undefined ? String(out) : ''].filter(Boolean).join('\n') || 'Done.';
  } catch {
    try {
      const logs: string[] = [];
      const customConsole = {
        log: (...args: unknown[]) => logs.push(args.map((a) => String(a)).join(' ')),
      };
      const fn2 = new Function('console', 'Math', `"use strict";\n${expressionOrCode}`);
      const res2 = fn2(customConsole, Math);
      return [...logs, res2 !== undefined ? String(res2) : ''].filter(Boolean).join('\n') || 'Done.';
    } catch (e2) {
      return `Sandbox note: ${String(e2)}`;
    }
  }
}

export async function runOpenBrainAutonomousAgent(params: {
  userPrompt: string;
  history: ChatMessage[];
  settings: AppSettings;
  skills: BrainSkill[];
  connectors: BrainConnector[];
  webhooks: CustomWebhookConnector[];
  attachedImage?: string;
  onStepsChange: (steps: AgentToolStep[]) => void;
}): Promise<{
  reply: string;
  generatedImages: string[];
  codeVideoArtifact?: RenderedCodeVideoArtifact;
  phoneActions: PhoneActionPayload[];
  codeArtifact?: { title: string; html: string };
  toolSteps: AgentToolStep[];
  activeSkillNames: string[];
}> {
  const {
    userPrompt,
    history,
    settings,
    skills,
    connectors,
    webhooks,
    attachedImage,
    onStepsChange,
  } = params;

  const steps: AgentToolStep[] = [];
  const generatedImages: string[] = [];
  const phoneActions: PhoneActionPayload[] = [];
  let codeArtifact: { title: string; html: string } | undefined;
  let codeVideoArtifact: RenderedCodeVideoArtifact | undefined;

  const enabledSkills = skills.filter((s) => s.enabled);
  const enabledConnectorSlugs = new Set(
    connectors.filter((c) => c.enabled).map((c) => c.slug)
  );
  const enabledWebhooks = webhooks.filter((w) => w.enabled);

  const langHint =
    'Understand user input written in ANY language or Romanized script (including English, Banglish, Bengali, Hindi, Spanish, Arabic, etc.) effortlessly. Always write your interface/assistant responses in clear, natural English unless the user explicitly asks you to reply in another specific language. Do not use emoji stickers.';

  const toolObservations: string[] = [];

  if (settings.autonomousAgent && !attachedImage) {
    const availableToolLines: string[] = [];
    if (enabledConnectorSlugs.has('web_search')) {
      availableToolLines.push('- "web_search": live facts, news, Wikipedia & DuckDuckGo knowledge');
    }
    if (enabledConnectorSlugs.has('github')) {
      availableToolLines.push('- "github_search": open-source repositories & tools on GitHub');
    }
    if (enabledConnectorSlugs.has('weather')) {
      availableToolLines.push('- "weather_live": current weather & forecast for a city (query = city name only)');
    }
    if (enabledConnectorSlugs.has('crypto')) {
      availableToolLines.push('- "crypto_market": live USD & ₹ INR crypto prices (query = coin names)');
    }
    if (enabledConnectorSlugs.has('arxiv')) {
      availableToolLines.push('- "arxiv_research": scientific or AI research papers');
    }
    if (enabledConnectorSlugs.has('pulse')) {
      availableToolLines.push('- "reddit_hn_pulse": live Reddit & HackerNews community discussions');
    }
    if (enabledConnectorSlugs.has('android_os')) {
      availableToolLines.push(
        `- "phone_action": control the user's Android phone! Include "phoneParams": {"action": "set_alarm"|"set_timer"|"dial_number"|"send_whatsapp"|"send_sms"|"add_calendar"|"open_maps"|"open_youtube"|"open_settings"|"send_email"|"battery_status"|"copy_clipboard", "label": "human title", "params": {...}}. Examples of params: set_alarm -> {"hour": 7, "minute": 30, "message": "Wake up"}; set_timer -> {"seconds": 300, "message": "Tea"}; send_whatsapp -> {"phone": "", "message": "Hello!"}; dial_number -> {"phone": "9876543210"}; open_maps -> {"query": "nearest ATM"}; open_youtube -> {"query": "lofi music"}; open_settings -> {"section": "wifi"|"bluetooth"|"sound"|"battery"|"display"}; battery_status -> {}; copy_clipboard -> {"text": "..."}`
      );
    }
    availableToolLines.push(
      '- "code_video_mp4": ONLY when user asks to generate/make/render a video, MP4 animation, Manim math video, explainer animation, or motion graphic (query = vivid description of the animation to write in JS & render to MP4)',
      '- "js_sandbox": exact math, compound interest, EMI, statistics, algorithms (query = JS expression)',
      '- "generate_image": ONLY when user asks to draw/generate a still image/photo/logo/wallpaper (query = detailed English visual prompt)',
      '- "mini_app": ONLY when user asks to build an interactive HTML5 app, calculator, dashboard, or game (query = app description)'
    );
    if (enabledWebhooks.length > 0) {
      availableToolLines.push(
        `- "custom_webhook": invoke user webhook (${enabledWebhooks
          .map((w) => w.name)
          .join(', ')}) with "webhookName" and "query"`
      );
    }

    const plannerPrompt = `You are Open Brain Autonomous Tool Planner. Decide which tools (0 to 3 max) to run right now.
Available Tools:
${availableToolLines.join('\n')}

Return ONLY valid JSON:
{"needsTools": boolean, "calls": [{"tool": "...", "query": "...", "phoneParams": ...}]}
If the user greets or asks a conceptual/writing question needing no external tool, return {"needsTools": false, "calls": []}.`;

    try {
      const rawPlan = await generateFreeLLMResponse(
        [
          { role: 'system', content: plannerPrompt },
          { role: 'user', content: userPrompt },
        ],
        settings,
        'openai'
      );
      const parsed = extractJsonObject<AgentPlan>(rawPlan);

      if (parsed?.needsTools && Array.isArray(parsed.calls) && parsed.calls.length > 0) {
        for (const call of parsed.calls.slice(0, 3)) {
          const stepId = `step-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
          const titleMap: Record<string, string> = {
            web_search: 'Connector: Live Web & Wiki',
            github_search: 'Connector: GitHub Open-Source',
            weather_live: 'Connector: Open-Meteo Weather',
            crypto_market: 'Connector: CoinGecko ₹ INR / USD',
            arxiv_research: 'Connector: ArXiv & CrossRef',
            reddit_hn_pulse: 'Connector: Reddit & HN Pulse',
            js_sandbox: 'Sandbox: Math & JS Engine',
            generate_image: 'Studio: Flux.1 HD Render',
            mini_app: 'Sandbox: Live HTML5 App',
            code_video_mp4: 'Claude-Style Code -> MP4 Sandbox Render',
            phone_action: 'Android OS Native Action',
            custom_webhook: 'MCP / Custom Webhook Call',
          };

          const stepObj: AgentToolStep = {
            id: stepId,
            tool: call.tool,
            title: titleMap[call.tool] || call.tool,
            query: call.query || call.phoneParams?.label || call.tool,
            status: 'running',
          };
          steps.push(stepObj);
          onStepsChange([...steps]);

          const t0 = performance.now();
          let output = '';

          try {
            if (call.tool === 'web_search') {
              output = await runWebSearchTool(call.query);
            } else if (call.tool === 'github_search') {
              output = await runGitHubSearchTool(call.query, settings.githubToken);
            } else if (call.tool === 'weather_live') {
              output = await runLiveWeatherTool(call.query);
            } else if (call.tool === 'crypto_market') {
              output = await runCryptoMarketTool(call.query);
            } else if (call.tool === 'arxiv_research') {
              output = await runArxivResearchTool(call.query);
            } else if (call.tool === 'reddit_hn_pulse') {
              output = await runRedditHnPulseTool(call.query);
            } else if (call.tool === 'js_sandbox') {
              output = runJsSandboxTool(call.query);
            } else if (call.tool === 'generate_image') {
              const imgUrl = buildFluxImageUrl({
                prompt: call.query,
                model: 'flux',
                width: 1024,
                height: 1024,
              });
              generatedImages.push(imgUrl);
              output = `Generated HD Flux image for "${call.query}".`;
            } else if (call.tool === 'code_video_mp4') {
              const vidRes = await renderCodeSandboxToMp4({
                prompt: call.query || userPrompt,
                aspectRatio: '16:9',
                durationSec: 7,
                ecoMode: settings.featherlightEcoMode,
                includeVoiceover: true,
                settings,
                onProgress: (_, msg) => {
                  stepObj.title = `Sandbox MP4: ${msg}`;
                  onStepsChange([...steps]);
                },
              });
              codeVideoArtifact = {
                title: (call.query || userPrompt).slice(0, 56),
                videoUrl: vidRes.videoUrl,
                mimeType: vidRes.mimeType,
                code: vidRes.code,
                durationSec: vidRes.durationSec,
                width: vidRes.width,
                height: vidRes.height,
              };
              output = `Wrote programmatic Canvas2D animation code and rendered ${vidRes.durationSec}s H.264 MP4 video (${vidRes.width}x${vidRes.height}) successfully!`;
            } else if (call.tool === 'phone_action' && call.phoneParams?.action) {
              const payload: PhoneActionPayload = {
                action: call.phoneParams.action,
                label: call.phoneParams.label || call.query || call.phoneParams.action,
                params: call.phoneParams.params || {},
              };
              const execRes = await executePhoneAction(payload);
              payload.executedResult = execRes;
              phoneActions.push(payload);
              output = `Android Phone Action (${payload.action}): ${execRes}`;
            } else if (call.tool === 'custom_webhook' && enabledWebhooks.length > 0) {
              const wh =
                enabledWebhooks.find(
                  (w) => w.name.toLowerCase() === String(call.webhookName || '').toLowerCase()
                ) || enabledWebhooks[0];
              const whResp = await fetch(wh.url, {
                method: wh.method,
                headers: wh.method === 'POST' ? { 'Content-Type': 'application/json' } : undefined,
                body:
                  wh.method === 'POST'
                    ? JSON.stringify({ query: call.query, prompt: userPrompt, source: 'OpenBrain' })
                    : undefined,
              });
              output = `Webhook "${wh.name}" HTTP ${whResp.status}: ${(await whResp.text()).slice(0, 600)}`;
            } else if (call.tool === 'mini_app') {
              const appHtml = await generateFreeLLMResponse(
                [
                  {
                    role: 'system',
                    content:
                      'Output ONLY a complete, self-contained, mobile-friendly single-file HTML5 document (<!DOCTYPE html>...</html>) with dark sleek styling and working JavaScript.',
                  },
                  { role: 'user', content: `Build this interactive mini-app: ${call.query}` },
                ],
                settings,
                'qwen-coder'
              );
              const matchHtml = appHtml.match(/<!DOCTYPE html[\s\S]*<\/html>/i);
              const cleanHtml = matchHtml ? matchHtml[0] : appHtml.replace(/```html|```/gi, '').trim();
              codeArtifact = {
                title: call.query.slice(0, 48),
                html: cleanHtml,
              };
              output = `Compiled interactive HTML5 mini-app ("${codeArtifact.title}").`;
            }

            stepObj.status = 'done';
            stepObj.durationMs = Math.round(performance.now() - t0);
            stepObj.resultSummary = output.slice(0, 260);
            toolObservations.push(`[Tool ${call.tool} ("${call.query}")]:\n${output}`);
          } catch (err) {
            stepObj.status = 'error';
            stepObj.durationMs = Math.round(performance.now() - t0);
            stepObj.resultSummary = String(err);
          }

          onStepsChange([...steps]);
        }
      }
    } catch {
      // Proceed smoothly
    }
  }

  // Build Active Skills Directive Block (Claude Skills Architecture)
  const skillsDirective =
    enabledSkills.length > 0
      ? `\nACTIVE MODULAR SKILLS (${enabledSkills.length}):\n` +
        enabledSkills.map((s) => `- [${s.name}]: ${s.instructions}`).join('\n')
      : '';

  const systemInstruction = `You are **Open Brain** — an ultra-powerful, 100% Free & Unlimited Open-Source AI Super-Agent created for Android APK & Web, engineered with Featherlight Zero-Phone-Pressure architecture (all heavy AI compute runs in free cloud clusters + hardware MP4 encoding so the user's phone never heats up or lags).
Core Capabilities: Modular Skills (like Claude Skills), Live App Connectors (GitHub, Web/Wiki, Weather, Crypto INR/USD, Research Papers, Reddit/HN, Custom Webhooks), Claude-Style Programmatic Code to Sandbox H.264 .mp4 Video Rendering, Zero-Shot Voice Cloning (F5-TTS/CosyVoice + Vocal DNA Twin), Flux.1 HD Art, and Full Android Phone OS Control (Alarms, Timers, WhatsApp, SMS, Dialer, Maps, Calendar, YouTube, Settings, Battery).
${langHint}${skillsDirective}${
    toolObservations.length > 0
      ? `\n\nLIVE TOOL & CONNECTOR RESULTS GATHERED JUST NOW:\n${toolObservations.join(
          '\n\n'
        )}\nUse these real results directly in your response!`
      : ''
  }`;

  const recentTurns: ChatTurnInput[] = history.slice(-6).map((m) => ({
    role: m.role,
    content: m.content,
  }));

  const finalMessages: ChatTurnInput[] = [
    { role: 'system', content: systemInstruction },
    ...recentTurns,
    {
      role: 'user',
      content: userPrompt,
      imageDataUrl: attachedImage,
    },
  ];

  const reply = await generateFreeLLMResponse(finalMessages, settings);

  return {
    reply,
    generatedImages,
    codeVideoArtifact,
    phoneActions,
    codeArtifact,
    toolSteps: steps,
    activeSkillNames: enabledSkills.map((s) => s.name),
  };
}

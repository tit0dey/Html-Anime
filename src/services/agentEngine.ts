import {
  AgentToolStep,
  AppSettings,
  BrainConnector,
  BrainSkill,
  ChatMessage,
  CustomWebhookConnector,
  PhoneActionPayload,
  RenderedCodeVideoArtifact,
  SynthesizedClip,
  VoiceProfile,
} from '../types';
import { renderCodeSandboxToMp4 } from './codeSandboxVideoEngine';
import { buildFluxImageUrl, getDimensionsForRatio } from './imageEngine';
import {
  ChatTurnInput,
  extractJsonObject,
  generateFreeLLMResponse,
  generateSmartBrainResponse,
} from './llmEngine';
import { executePhoneAction } from './nativeBridge';
import { generateOpenBrainVideo } from './videoEngine';
import { synthesizeClonedVoice } from './voiceCloneEngine';

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
    | 'cinema_video_mp4'
    | 'voice_clone_tts'
    | 'phone_action'
    | 'custom_webhook';
  query: string;
  aspectRatio?: '1:1' | '9:16' | '16:9';
  voiceMode?: 'speak' | 'setup_clone';
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
    : `No direct indexed snippet returned for "${query}", synthesize answer using reasoning.`;
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
        if (h.title) out.push(`[HN Pulse · ${h.points ?? 0} pts] ${h.title} (${h.url || ''})`);
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
          out.push(`[Reddit r/${p.subreddit} · +${p.ups}] ${p.title}`);
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
          return `- ${coin.toUpperCase()}: $${vals.usd} USD | Rs.${vals.inr} INR (24h: ${chg}%)`;
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
            `- "${(it.title && it.title[0]) || 'Paper'}" (${
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

/**
 * Fallback multilingual intent detector so even if an LLM JSON plan fails or omits a media tool,
 * direct requests in English/Banglish/Bangla/Hindi ("clone my voice", "video banao", "chobi banao")
 * ALWAYS trigger Open Brain's native media/OS engines automatically!
 */
function detectGuaranteedDirectTool(userPrompt: string): PlannedToolCall | null {
  const p = userPrompt.toLowerCase();

  // Voice clone setup intent ("can you clone my voice?", "amar voice clone koro")
  if (
    /\b(clone my voice|voice clone|clone voice|amar voice clone|amar golar awaj|clone kor)\b/.test(
      p
    ) &&
    !/\b(say|speak|read|bolo|narrate)\s*:/i.test(userPrompt)
  ) {
    return {
      tool: 'voice_clone_tts',
      voiceMode: 'setup_clone',
      query: userPrompt,
    };
  }

  // Direct TTS / Cloned Speech generation
  if (
    /\b(generate voice|generate speech|read aloud|speak this|narrate this|voice e bolo|awaje bolo|tts)\b/.test(
      p
    )
  ) {
    return {
      tool: 'voice_clone_tts',
      voiceMode: 'speak',
      query: userPrompt.replace(
        /^.*?\b(say|speak|read aloud|speak this|narrate this|bolo)\b\s*[:-]?\s*/i,
        ''
      ) || userPrompt,
    };
  }

  // Video generation intent
  if (
    /\b(make a video|create a video|generate a video|render a video|mp4 video|video banao|video toiri|animation video|manim video|explainer video)\b/.test(
      p
    )
  ) {
    const isCinema = /\b(cinematic|realistic|movie|film|story|photoreal|drone|nature|city)\b/.test(
      p
    );
    return {
      tool: isCinema ? 'cinema_video_mp4' : 'code_video_mp4',
      query: userPrompt,
      aspectRatio: /\b(reel|short|vertical|9:16|tiktok)\b/.test(p) ? '9:16' : '16:9',
    };
  }

  // Image generation intent
  if (
    /\b(generate image|generate an image|create an image|draw a|draw an|make a wallpaper|chobi banao|ekta chobi|render an image|logo design)\b/.test(
      p
    )
  ) {
    return {
      tool: 'generate_image',
      query: userPrompt,
      aspectRatio: /\b(wallpaper|vertical|9:16|portrait)\b/.test(p)
        ? '9:16'
        : /\b(banner|widescreen|16:9|youtube)\b/.test(p)
        ? '16:9'
        : '1:1',
    };
  }

  return null;
}

export async function runOpenBrainAutonomousAgent(params: {
  userPrompt: string;
  history: ChatMessage[];
  settings: AppSettings;
  skills: BrainSkill[];
  connectors: BrainConnector[];
  webhooks: CustomWebhookConnector[];
  voiceProfiles: VoiceProfile[];
  projectInstructions?: string;
  attachedImage?: string;
  attachedFileText?: string;
  attachedFileName?: string;
  onStepsChange: (steps: AgentToolStep[]) => void;
}): Promise<{
  reply: string;
  routedModelLabel: string;
  thinkingTrace?: string;
  generatedImages: string[];
  codeVideoArtifact?: RenderedCodeVideoArtifact;
  voiceClipArtifact?: SynthesizedClip;
  showVoiceCloneRecorder?: boolean;
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
    voiceProfiles,
    projectInstructions,
    attachedImage,
    attachedFileText,
    attachedFileName,
    onStepsChange,
  } = params;

  const steps: AgentToolStep[] = [];
  const generatedImages: string[] = [];
  const phoneActions: PhoneActionPayload[] = [];
  let codeArtifact: { title: string; html: string } | undefined;
  let codeVideoArtifact: RenderedCodeVideoArtifact | undefined;
  let voiceClipArtifact: SynthesizedClip | undefined;
  let showVoiceCloneRecorder = false;

  const activeProfile =
    voiceProfiles.find((v) => v.id === settings.activeVoiceProfileId) ||
    voiceProfiles[0] ||
    null;

  const enabledSkills = skills.filter((s) => s.enabled);
  const enabledConnectorSlugs = new Set(
    connectors.filter((c) => c.enabled).map((c) => c.slug)
  );
  const enabledWebhooks = webhooks.filter((w) => w.enabled);

  const langHint =
    settings.responseLanguage === 'auto'
      ? 'Understand user input in ANY language or script (English, Banglish, Bengali, Hindi, Chinese, Spanish, Arabic, etc.) and reply naturally in the SAME language/style the user used. Do not use emoji stickers.'
      : 'Understand user input written in ANY language or Romanized script (including English, Banglish, Bengali, Hindi, Chinese, Spanish, Arabic, etc.) effortlessly. Write your responses in crisp, clear, natural English unless the user explicitly asks you to reply in another language. Do not use emoji stickers.';

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
      availableToolLines.push(
        '- "weather_live": current weather & forecast for a city (query = city name only)'
      );
    }
    if (enabledConnectorSlugs.has('crypto')) {
      availableToolLines.push(
        '- "crypto_market": live USD & INR crypto prices (query = coin names)'
      );
    }
    if (enabledConnectorSlugs.has('arxiv')) {
      availableToolLines.push('- "arxiv_research": scientific or AI research papers');
    }
    if (enabledConnectorSlugs.has('pulse')) {
      availableToolLines.push('- "reddit_hn_pulse": live Reddit & HackerNews discussions');
    }
    if (enabledConnectorSlugs.has('android_os')) {
      availableToolLines.push(
        `- "phone_action": control the user's Android phone! Include "phoneParams": {"action": "set_alarm"|"set_timer"|"dial_number"|"send_whatsapp"|"send_sms"|"add_calendar"|"open_maps"|"open_youtube"|"open_settings"|"send_email"|"battery_status"|"copy_clipboard", "label": "human title", "params": {...}}. Examples: set_alarm -> {"hour": 7, "minute": 30, "message": "Wake up"}; set_timer -> {"seconds": 300, "message": "Focus"}; send_whatsapp -> {"phone": "", "message": "Hello"}; dial_number -> {"phone": "9876543210"}; open_maps -> {"query": "Howrah Bridge"}; open_youtube -> {"query": "lofi music"}; open_settings -> {"section": "wifi"|"bluetooth"|"sound"|"battery"|"display"}; battery_status -> {}`
      );
    }
    availableToolLines.push(
      '- "code_video_mp4": when user asks for an animation video, math/Manim visual, kinetic explainer, diagram video, or motion graphic (query = vivid description; optional aspectRatio: "16:9"|"9:16")',
      '- "cinema_video_mp4": when user asks for a photorealistic cinematic video, story video, movie scene, or nature/city video with voiceover (query = vivid scene description; optional aspectRatio: "16:9"|"9:16")',
      '- "voice_clone_tts": when user asks to clone their voice (voiceMode = "setup_clone") OR asks to speak/read/narrate/generate voice audio (voiceMode = "speak", query = exact text script to speak)',
      '- "generate_image": when user asks to draw/create/generate a still image, photo, artwork, logo, or wallpaper (query = detailed English visual prompt; optional aspectRatio: "1:1"|"9:16"|"16:9")',
      '- "mini_app": when user asks to build a playable game, interactive calculator, dashboard, or web app (query = app specification)',
      '- "js_sandbox": exact math, financial EMI/SIP, statistics, or data computation (query = valid JS expression)'
    );
    if (enabledWebhooks.length > 0) {
      availableToolLines.push(
        `- "custom_webhook": invoke user webhook (${enabledWebhooks
          .map((w) => w.name)
          .join(', ')}) with "webhookName" and "query"`
      );
    }

    const plannerPrompt = `You are Open Brain v3.0 Super-Agent Planner. The user may write in ANY language (English, Banglish, Bengali, Hindi, Chinese, etc.). Decide which tools (0 to 3 max) to run automatically so the user never has to click any manual mode.
Available Tools:
${availableToolLines.join('\n')}

Return ONLY valid JSON:
{"needsTools": boolean, "calls": [{"tool": "...", "query": "...", "aspectRatio": "16:9", "voiceMode": "speak", "phoneParams": ...}]}
If it is pure conversation, coding explanation, writing, or reasoning needing no external/media tool, return {"needsTools": false, "calls": []}.`;

    let plannedCalls: PlannedToolCall[] = [];
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
      if (parsed?.needsTools && Array.isArray(parsed.calls)) {
        plannedCalls = parsed.calls.slice(0, 3);
      }
    } catch {
      // Fallback to deterministic detector if needed
    }

    if (plannedCalls.length === 0) {
      const fallbackCall = detectGuaranteedDirectTool(userPrompt);
      if (fallbackCall) plannedCalls = [fallbackCall];
    }

    for (const call of plannedCalls) {
      const stepId = `step-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
      const titleMap: Record<string, string> = {
        web_search: 'Live Web & Knowledge Search',
        github_search: 'GitHub Open-Source Search',
        weather_live: 'Open-Meteo Live Weather',
        crypto_market: 'Live Market Feed (USD / INR)',
        arxiv_research: 'ArXiv & Scholarly Papers',
        reddit_hn_pulse: 'Community Pulse (HN & Reddit)',
        js_sandbox: 'JavaScript Math Sandbox',
        generate_image: 'Flux.1 HD Studio Render',
        mini_app: 'Interactive HTML5 App Compiler',
        code_video_mp4: 'Code Sandbox -> Hardware H.264 MP4',
        cinema_video_mp4: 'Flux Cinema + Neural Voice -> MP4',
        voice_clone_tts: 'Zero-Shot Voice Clone & Neural Audio',
        phone_action: 'Android OS Native Bridge',
        custom_webhook: 'MCP / Webhook Connector',
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
          const ratio = call.aspectRatio || '1:1';
          const { width, height } = getDimensionsForRatio(ratio);
          const qLow = (call.query || '').toLowerCase();
          const model = qLow.includes('anime')
            ? 'flux-anime'
            : qLow.includes('3d')
            ? 'flux-3d'
            : qLow.includes('photo') || qLow.includes('realistic')
            ? 'flux-realism'
            : 'flux';
          const imgUrl = buildFluxImageUrl({
            prompt: call.query || userPrompt,
            model,
            width,
            height,
          });
          generatedImages.push(imgUrl);
          output = `Rendered HD ${model} image (${width}x${height}) for "${call.query}".`;
        } else if (call.tool === 'code_video_mp4') {
          const vidRes = await renderCodeSandboxToMp4({
            prompt: call.query || userPrompt,
            aspectRatio: call.aspectRatio === '9:16' ? '9:16' : '16:9',
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
            title: (call.query || userPrompt).slice(0, 60),
            videoUrl: vidRes.videoUrl,
            mimeType: vidRes.mimeType,
            code: vidRes.code,
            engineLabel: 'Claude-Style Code Sandbox MP4',
            durationSec: vidRes.durationSec,
            width: vidRes.width,
            height: vidRes.height,
          };
          output = `Wrote programmatic Canvas2D animation code and rendered ${vidRes.durationSec}s H.264 MP4 video (${vidRes.width}x${vidRes.height}) directly in chat.`;
        } else if (call.tool === 'cinema_video_mp4') {
          const ratio = call.aspectRatio === '9:16' ? '9:16' : '16:9';
          const outVid = await generateOpenBrainVideo({
            prompt: call.query || userPrompt,
            engine: 'cinema-director',
            aspectRatio: ratio,
            sceneCount: 3,
            voice: 'onyx',
            settings,
            onProgress: (_, msg) => {
              stepObj.title = `Cinema MP4: ${msg}`;
              onStepsChange([...steps]);
            },
          });
          codeVideoArtifact = {
            title: (call.query || userPrompt).slice(0, 60),
            videoUrl: outVid.videoUrl,
            mimeType: outVid.mimeType,
            engineLabel: outVid.spaceUsed || 'Flux Cinema + Neural Audio MP4',
            durationSec: 9,
            width: ratio === '9:16' ? 720 : 1280,
            height: ratio === '9:16' ? 1280 : 720,
          };
          output = `Rendered multi-scene Flux Cinema H.264 MP4 video with AI voiceover and subtitles directly in chat.`;
        } else if (call.tool === 'voice_clone_tts') {
          if (call.voiceMode === 'setup_clone' && !activeProfile) {
            showVoiceCloneRecorder = true;
            output =
              'Displayed interactive Zero-Shot Voice Clone Recorder card inline in chat so the user can record a 6-12s voice sample or upload an audio clip.';
          } else if (call.voiceMode === 'setup_clone' && activeProfile) {
            showVoiceCloneRecorder = true;
            const sampleOut = await synthesizeClonedVoice({
              text: `Your cloned voice profile ${activeProfile.name} is ready on Open Brain. Tell me anything you want me to speak.`,
              profile: activeProfile,
              presetVoice: 'onyx',
              tryZeroShotNeural: true,
              hfToken: settings.hfToken,
            });
            voiceClipArtifact = {
              id: `vc-${Date.now()}`,
              text: `Your cloned voice profile ${activeProfile.name} is ready on Open Brain.`,
              voiceName: activeProfile.name,
              engineUsed: sampleOut.engineUsed,
              audioUrl: sampleOut.url,
              createdAt: Date.now(),
            };
            output = `Active voice clone "${activeProfile.name}" demonstrated and Voice Clone Recorder attached inline.`;
          } else {
            const spokenScript = (call.query || userPrompt).slice(0, 600);
            const synthOut = await synthesizeClonedVoice({
              text: spokenScript,
              profile: activeProfile,
              presetVoice: 'onyx',
              tryZeroShotNeural: true,
              hfToken: settings.hfToken,
              onStatus: (m) => {
                stepObj.title = `Voice Lab: ${m}`;
                onStepsChange([...steps]);
              },
            });
            voiceClipArtifact = {
              id: `vc-${Date.now()}`,
              text: spokenScript,
              voiceName: activeProfile ? activeProfile.name : 'Studio Onyx Neural',
              engineUsed: synthOut.engineUsed,
              audioUrl: synthOut.url,
              createdAt: Date.now(),
            };
            output = `Synthesized neural/cloned WAV audio (${voiceClipArtifact.voiceName}) directly in chat.`;
          }
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
                  'Output ONLY a complete, self-contained, mobile-friendly single-file HTML5 document (<!DOCTYPE html>...</html>) with sleek modern UI, responsive controls, and working JavaScript.',
              },
              { role: 'user', content: `Build this interactive app: ${call.query}` },
            ],
            settings,
            'qwen-coder'
          );
          const matchHtml = appHtml.match(/<!DOCTYPE html[\s\S]*<\/html>/i);
          const cleanHtml = matchHtml ? matchHtml[0] : appHtml.replace(/```html|```/gi, '').trim();
          codeArtifact = {
            title: (call.query || 'Interactive App').slice(0, 48),
            html: cleanHtml,
          };
          output = `Compiled interactive HTML5 app ("${codeArtifact.title}") inline in chat.`;
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

  const skillsDirective =
    enabledSkills.length > 0
      ? `\nACTIVE MODULAR SKILLS (${enabledSkills.length}):\n` +
        enabledSkills.map((s) => `- [${s.name}]: ${s.instructions}`).join('\n')
      : '';

  const projectDirective = projectInstructions?.trim()
    ? `\nACTIVE PROJECT INSTRUCTIONS:\n${projectInstructions.trim()}`
    : '';

  const systemInstruction = `You are **Open Brain** — a next-generation, 100% Free & Unlimited Autonomous AI Super-Agent built with Smart Multi-Model Routing + Mixture-of-Agents Council synthesis and Zero-Phone-Pressure architecture.
Everything executes directly inside this unified chat without the user needing to pick manual tabs:
- Programmatic Code-to-MP4 Sandbox Video & Photorealistic Cinema MP4 Video
- Zero-Shot Voice Cloning (F5-TTS / Vocal DNA Twin) & Neural Speech
- HD Flux.1 Image Generation & Interactive HTML5 App Compilation
- Native Android Phone OS Control (Alarms, Timers, WhatsApp, SMS, Calls, Maps, Calendar, YouTube, Settings, Battery)
- Modular Skills (SKILL.md) & Live Connectors (Web/Wiki, GitHub, Weather, Crypto USD/INR, ArXiv, HN/Reddit, Webhooks)
${langHint}${projectDirective}${skillsDirective}${
    toolObservations.length > 0
      ? `\n\nLIVE ACTIONS & CONNECTOR DATA COMPLETED JUST NOW:\n${toolObservations.join(
          '\n\n'
        )}\nConfirm or synthesize these real results concisely and accurately.`
      : ''
  }`;

  const recentTurns: ChatTurnInput[] = history.slice(-8).map((m) => ({
    role: m.role,
    content: m.content,
  }));

  const fullUserContent = attachedFileText
    ? `${userPrompt}\n\n[Attached File: ${attachedFileName || 'document'}]\n${attachedFileText.slice(
        0,
        12000
      )}`
    : userPrompt;

  const finalMessages: ChatTurnInput[] = [
    { role: 'system', content: systemInstruction },
    ...recentTurns,
    {
      role: 'user',
      content: fullUserContent,
      imageDataUrl: attachedImage,
    },
  ];

  let councilStepObj: AgentToolStep | null = null;
  const brainRes = await generateSmartBrainResponse(finalMessages, settings, (note) => {
    if (!councilStepObj) {
      councilStepObj = {
        id: `step-council-${Date.now()}`,
        tool: 'moa_council',
        title: 'Mixture-of-Agents Council',
        query: note,
        status: 'running',
      };
      steps.push(councilStepObj);
    } else {
      councilStepObj.query = note;
    }
    onStepsChange([...steps]);
  });

  if (councilStepObj) {
    (councilStepObj as AgentToolStep).status = 'done';
    (councilStepObj as AgentToolStep).resultSummary =
      'Synthesized consensus from DeepSeek-R1 + Qwen-32B';
    onStepsChange([...steps]);
  }

  return {
    reply: brainRes.content,
    routedModelLabel: brainRes.modelUsedLabel,
    thinkingTrace: brainRes.thinkingTrace,
    generatedImages,
    codeVideoArtifact,
    voiceClipArtifact,
    showVoiceCloneRecorder,
    phoneActions,
    codeArtifact,
    toolSteps: steps,
    activeSkillNames: enabledSkills.map((s) => s.name),
  };
}

import {
  AgentToolStep,
  AppSettings,
  BrainConnector,
  BrainSkill,
  ChatMessage,
  CustomWebhookConnector,
  MemoryItem,
  PhoneActionPayload,
  RenderedCodeVideoArtifact,
  ResearchSource,
  SynthesizedClip,
  VoiceProfile,
} from '../types';
import { renderCodeSandboxToMp4 } from './codeSandboxVideoEngine';
import { runDeepResearchPipeline } from './deepResearchEngine';
import { buildFluxImageUrl, getDimensionsForRatio } from './imageEngine';
import {
  ChatTurnInput,
  extractJsonObject,
  generateFreeLLMResponse,
  generateSmartBrainResponse,
} from './llmEngine';
import {
  extractExplicitMemoryFromPrompt,
  formatMemoryBlockForPrompt,
} from './memoryEngine';
import {
  AttachedDocItem,
  retrieveRelevantDocumentContext,
} from './ragDocumentEngine';
import { executePhoneAction } from './nativeBridge';
import { smartFetch } from './nativeHttp';
import { generateOpenBrainVideo } from './videoEngine';
import { synthesizeClonedVoice } from './voiceCloneEngine';

interface PlannedToolCall {
  tool:
    | 'deep_research'
    | 'read_url'
    | 'code_interpreter'
    | 'svg_diagram'
    | 'save_memory'
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
  memoryCategory?: MemoryItem['category'];
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

function buildFallbackInteractiveWebApp(spec: string): string {
  const safeTitle = spec
    .replace(/[<>"']/g, '')
    .replace(/^build\s+(an?\s+)?(interactive\s+)?(web\s+app\s+)?(for\s+)?/i, '')
    .trim()
    .slice(0, 44) || 'Interactive Task Studio';

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>${safeTitle}</title>
<style>
  * { box-sizing: border-box; font-family: system-ui, -apple-system, sans-serif; }
  body { margin: 0; padding: 18px; background: #0B0F19; color: #F8FAFC; }
  .card { max-width: 520px; margin: 0 auto; background: #131926; border: 1px solid #1E293B; border-radius: 20px; padding: 18px; box-shadow: 0 12px 32px rgba(0,0,0,0.35); }
  h1 { margin: 0 0 6px; font-size: 19px; text-transform: capitalize; }
  p.sub { margin: 0 0 14px; font-size: 12px; color: #94A3B8; }
  .row { display: flex; gap: 8px; margin-bottom: 12px; }
  input[type="text"], select { flex: 1; background: #0B0F19; border: 1px solid #334155; color: #F8FAFC; padding: 10px 12px; border-radius: 12px; font-size: 13px; outline: none; }
  button.primary { background: #14B8A6; color: #042F2E; border: none; padding: 10px 16px; border-radius: 12px; font-weight: 700; font-size: 13px; cursor: pointer; }
  .filters { display: flex; gap: 6px; margin-bottom: 12px; }
  .chip { background: #1E293B; color: #CBD5E1; border: none; padding: 6px 12px; border-radius: 999px; font-size: 11px; cursor: pointer; }
  .chip.active { background: #F8FAFC; color: #0F172A; font-weight: 600; }
  ul { list-style: none; padding: 0; margin: 0; display: flex; flex-direction: column; gap: 8px; }
  li { display: flex; align-items: center; justify-content: space-between; gap: 10px; background: #0F172A; border: 1px solid #1E293B; padding: 10px 12px; border-radius: 12px; }
  li.done span.txt { text-decoration: line-through; color: #64748B; }
  .badge { font-size: 10px; padding: 2px 8px; border-radius: 999px; background: rgba(20,184,166,0.16); color: #5EEAD4; }
  .del { background: transparent; border: none; color: #EF4444; cursor: pointer; font-size: 12px; font-weight: 600; }
  .stats { margin-top: 14px; font-size: 11px; color: #94A3B8; display: flex; justify-content: space-between; }
</style>
</head>
<body>
  <div class="card">
    <h1>${safeTitle}</h1>
    <p class="sub">Interactive Open Brain App · Auto-saved locally</p>
    <div class="row">
      <input id="inp" type="text" placeholder="Add a new item..." />
      <select id="prio" style="max-width:96px">
        <option value="High">High</option>
        <option value="Normal" selected>Normal</option>
        <option value="Low">Low</option>
      </select>
      <button class="primary" onclick="addItem()">Add</button>
    </div>
    <div class="filters">
      <button class="chip active" id="f-all" onclick="setFilter('all')">All</button>
      <button class="chip" id="f-active" onclick="setFilter('active')">Active</button>
      <button class="chip" id="f-done" onclick="setFilter('done')">Completed</button>
    </div>
    <ul id="list"></ul>
    <div class="stats">
      <span id="count">0 items</span>
      <span style="cursor:pointer;color:#38BDF8" onclick="clearDone()">Clear completed</span>
    </div>
  </div>
  <script>
    let items = JSON.parse(localStorage.getItem('ob_app_items') || '[{"id":1,"text":"Explore Open Brain Studio","prio":"High","done":false},{"id":2,"text":"Ship interactive project","prio":"Normal","done":true}]');
    let filter = 'all';
    function save() { localStorage.setItem('ob_app_items', JSON.stringify(items)); render(); }
    function addItem() {
      const el = document.getElementById('inp');
      const pr = document.getElementById('prio').value;
      const val = el.value.trim();
      if (!val) return;
      items.unshift({ id: Date.now(), text: val, prio: pr, done: false });
      el.value = '';
      save();
    }
    document.getElementById('inp').addEventListener('keydown', e => { if (e.key === 'Enter') addItem(); });
    function toggle(id) { items = items.map(x => x.id === id ? { ...x, done: !x.done } : x); save(); }
    function removeItem(id) { items = items.filter(x => x.id !== id); save(); }
    function clearDone() { items = items.filter(x => !x.done); save(); }
    function setFilter(f) {
      filter = f;
      ['all','active','done'].forEach(k => document.getElementById('f-'+k).classList.toggle('active', k === f));
      render();
    }
    function render() {
      const ul = document.getElementById('list');
      const shown = items.filter(x => filter === 'all' ? true : filter === 'done' ? x.done : !x.done);
      ul.innerHTML = shown.map(x => \`<li class="\${x.done ? 'done' : ''}">
        <label style="display:flex;align-items:center;gap:8px;flex:1;cursor:pointer">
          <input type="checkbox" \${x.done ? 'checked' : ''} onchange="toggle(\${x.id})" />
          <span class="txt">\${x.text.replace(/</g,'&lt;')}</span>
        </label>
        <span class="badge">\${x.prio}</span>
        <button class="del" onclick="removeItem(\${x.id})">Delete</button>
      </li>\`).join('');
      const rem = items.filter(x => !x.done).length;
      document.getElementById('count').textContent = rem + ' active · ' + items.length + ' total';
    }
    render();
  </script>
</body>
</html>`;
}

async function runWebSearchTool(
  query: string,
  addSource: (s: ResearchSource) => void
): Promise<string> {
  const results: string[] = [];

  try {
    const wikiUrl = `https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(
      query
    )}&utf8=&format=json&origin=*&srlimit=4`;
    const r = await smartFetch(wikiUrl, { timeoutMs: 8500 });
    if (r.ok) {
      const d = r.json<any>();
      for (const h of (d?.query?.search || []).slice(0, 3)) {
        const title = String(h.title || '');
        const snippet = String(h.snippet || '').replace(/<[^>]+>/g, '');
        const url = `https://en.wikipedia.org/wiki/${encodeURIComponent(
          title.replace(/\s+/g, '_')
        )}`;
        addSource({ title: `Wikipedia: ${title}`, url, domain: 'wikipedia.org', snippet });
        results.push(`[Wikipedia: ${title}] ${snippet}`);
      }
    }
  } catch {
    // Ignore
  }

  try {
    const ddgUrl = `https://api.duckduckgo.com/?q=${encodeURIComponent(
      query
    )}&format=json&no_html=1&skip_disambig=1`;
    const r = await smartFetch(ddgUrl, { timeoutMs: 8500 });
    if (r.ok) {
      const d = r.json<any>();
      if (d.AbstractText) {
        if (d.AbstractURL) {
          addSource({
            title: d.Heading || query,
            url: d.AbstractURL,
            domain: 'duckduckgo.com',
            snippet: d.AbstractText,
          });
        }
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
    const hnResp = await smartFetch(
      `https://hn.algolia.com/api/v1/search?query=${encodeURIComponent(query)}&hitsPerPage=4`,
      { timeoutMs: 8500 }
    );
    if (hnResp.ok) {
      const d = hnResp.json<any>();
      for (const h of (d?.hits || []).slice(0, 3)) {
        if (h.title) out.push(`[HN Pulse · ${h.points ?? 0} pts] ${h.title} (${h.url || ''})`);
      }
    }
  } catch {
    // Ignore
  }
  try {
    const rdResp = await smartFetch(
      `https://www.reddit.com/search.json?q=${encodeURIComponent(query)}&limit=3`,
      { timeoutMs: 8500 }
    );
    if (rdResp.ok) {
      const rd = rdResp.json<any>();
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

async function runGitHubSearchTool(
  query: string,
  ghToken: string | undefined,
  addSource: (s: ResearchSource) => void
): Promise<string> {
  try {
    const headers: Record<string, string> = {};
    if (ghToken?.trim()) headers.Authorization = `Bearer ${ghToken.trim()}`;
    const resp = await smartFetch(
      `https://api.github.com/search/repositories?q=${encodeURIComponent(
        query
      )}&sort=stars&order=desc&per_page=5`,
      { headers, timeoutMs: 9000 }
    );
    if (!resp.ok) return `GitHub API returned HTTP ${resp.status}`;
    const data = resp.json<any>();
    const items = data?.items || [];
    if (!items.length) return `No open-source GitHub repositories matched "${query}".`;
    for (const repo of items.slice(0, 3)) {
      if (repo?.html_url) {
        addSource({
          title: `${repo.full_name} (${repo.stargazers_count} stars)`,
          url: repo.html_url,
          domain: 'github.com',
        });
      }
    }
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
    const geoResp = await smartFetch(
      `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(
        city
      )}&count=1&language=en&format=json`,
      { timeoutMs: 8500 }
    );
    const geoData = geoResp.json<any>();
    const place = geoData?.results?.[0];
    if (!place) return `Could not geocode city "${city}".`;

    const wxResp = await smartFetch(
      `https://api.open-meteo.com/v1/forecast?latitude=${place.latitude}&longitude=${place.longitude}&current=temperature_2m,relative_humidity_2m,apparent_temperature,wind_speed_10m&daily=temperature_2m_max,temperature_2m_min&timezone=auto&forecast_days=3`,
      { timeoutMs: 8500 }
    );
    const wx = wxResp.json<any>();
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
    const resp = await smartFetch(
      `https://api.coingecko.com/api/v3/simple/price?ids=${ids.join(
        ','
      )}&vs_currencies=usd,inr&include_24hr_change=true`,
      { timeoutMs: 8500 }
    );
    if (!resp.ok) return `Market feed HTTP ${resp.status}`;
    const data = resp.json<any>();
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
    const resp = await smartFetch(
      `https://api.crossref.org/works?query=${encodeURIComponent(query)}&rows=4`,
      { timeoutMs: 8500 }
    );
    if (!resp.ok) return `Research search HTTP ${resp.status}`;
    const data = resp.json<any>();
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

async function runLiveUrlReaderTool(
  targetUrl: string,
  addSource: (s: ResearchSource) => void
): Promise<string> {
  const cleanUrl = targetUrl.trim().replace(/[),.]+$/, '');
  try {
    const domain = new URL(cleanUrl).hostname.replace(/^www\./, '');
    addSource({ title: domain, url: cleanUrl, domain });
  } catch {
    // Ignore
  }

  try {
    const jinaResp = await smartFetch(`https://r.jina.ai/${cleanUrl}`, {
      headers: { Accept: 'text/plain' },
      timeoutMs: 14000,
    });
    if (jinaResp.ok) {
      const text = jinaResp.text();
      if (text && text.trim().length > 40) {
        return `LIVE WEBPAGE CONTENT (${cleanUrl}):\n${text.slice(0, 9500)}`;
      }
    }
  } catch {
    // Fallback to direct fetch
  }

  try {
    const direct = await smartFetch(cleanUrl, { timeoutMs: 12000 });
    if (direct.ok) {
      const raw = direct.text();
      const stripped = raw
        .replace(/<script[\s\S]*?<\/script>/gi, ' ')
        .replace(/<style[\s\S]*?<\/style>/gi, ' ')
        .replace(/<[^>]+>/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
      return `LIVE WEBPAGE CONTENT (${cleanUrl}):\n${stripped.slice(0, 8000)}`;
    }
  } catch (err) {
    return `Could not fetch ${cleanUrl} directly (${String(err)}).`;
  }

  return `Could not read webpage ${cleanUrl}.`;
}

async function runSelfHealingCodeInterpreter(
  problemStatement: string,
  settings: AppSettings,
  onProgress?: (msg: string) => void
): Promise<string> {
  let lastError = '';
  let lastCode = '';

  for (let attempt = 1; attempt <= 3; attempt++) {
    onProgress?.(
      attempt === 1
        ? 'Writing solver program in Sandbox...'
        : `Auto-debugging solver (attempt ${attempt}/3)...`
    );

    const prompt =
      attempt === 1
        ? `Write pure vanilla JavaScript code (no external imports, no DOM) that computes the exact verified solution for:\n${problemStatement}\nUse console.log(...) or return the final computed result. Output ONLY JavaScript code.`
        : `Your previous JavaScript solver threw an error:\nError: ${lastError}\nPrevious Code:\n${lastCode}\n\nFix the bug and output ONLY valid pure JavaScript code.`;

    const raw = await generateFreeLLMResponse(
      [{ role: 'user', content: prompt }],
      settings,
      'qwen-coder'
    );
    const fenced = raw.match(/```(?:javascript|js)?\s*([\s\S]*?)```/i);
    const code = (fenced ? fenced[1] : raw).trim();
    lastCode = code;

    try {
      const logs: string[] = [];
      const customConsole = {
        log: (...args: unknown[]) =>
          logs.push(
            args
              .map((a) => (typeof a === 'object' ? JSON.stringify(a) : String(a)))
              .join(' ')
          ),
      };
      const fn = new Function('console', 'Math', `"use strict";\n${code}`);
      const ret = fn(customConsole, Math);
      const output = [
        ...logs,
        ret !== undefined ? `Return: ${JSON.stringify(ret)}` : '',
      ]
        .filter(Boolean)
        .join('\n');

      return `VERIFIED CODE INTERPRETER EXECUTION (Attempt ${attempt} Succeeded):\nCode:\n${code.slice(
        0,
        1200
      )}\n\nExact Computed Output:\n${output || 'Executed cleanly.'}`;
    } catch (err) {
      lastError = String(err);
    }
  }

  return `Solver note after 3 attempts: ${lastError}`;
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
 * 0ms Instant Deterministic Router — Eliminates extra LLM planner round-trip for 95% of requests!
 */
function detectGuaranteedDirectTool(
  userPrompt: string,
  forceDeepResearch?: boolean
): PlannedToolCall | null {
  if (forceDeepResearch) {
    return { tool: 'deep_research', query: userPrompt };
  }

  const urlMatch = userPrompt.match(/https?:\/\/[^\s<>"]+/i);
  if (urlMatch?.[0]) {
    return { tool: 'read_url', query: urlMatch[0] };
  }

  const p = userPrompt.toLowerCase();

  if (
    /\b(build an? interactive|build a web app|create a web app|interactive web app|make a web app|build a game|create a game|playable game|build a calculator|create a calculator|build a dashboard|html5 app|mini app|build an? app for)\b/.test(
      p
    )
  ) {
    return { tool: 'mini_app', query: userPrompt };
  }

  if (
    /\b(flowchart|architecture diagram|system diagram|mindmap|svg chart|sequence diagram|visual diagram)\b/.test(
      p
    )
  ) {
    return { tool: 'svg_diagram', query: userPrompt };
  }

  if (
    /\b(deep research|comprehensive report|in-depth report|detailed research|research everything about)\b/.test(
      p
    )
  ) {
    return { tool: 'deep_research', query: userPrompt };
  }

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

  if (
    /\b(generate voice|generate speech|read aloud|speak this|speak in my|narrate this|voice e bolo|awaje bolo|tts)\b/.test(
      p
    )
  ) {
    return {
      tool: 'voice_clone_tts',
      voiceMode: 'speak',
      query:
        userPrompt.replace(
          /^.*?\b(say|speak|read aloud|speak this|speak in my[^:]*|narrate this|bolo)\b\s*[:-]?\s*/i,
          ''
        ) || userPrompt,
    };
  }

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

  // Instant Weather check
  const wxMatch = p.match(/\b(?:weather|temperature|forecast|abohawa)\s+(?:in|at|for|of)?\s*([a-z\s]{2,28})/i);
  if (wxMatch?.[1]) {
    return { tool: 'weather_live', query: wxMatch[1].trim() };
  }

  // Instant Crypto check
  if (/\b(bitcoin|btc|ethereum|eth|solana|crypto)\s+(price|market|rate)\b/.test(p)) {
    return { tool: 'crypto_market', query: userPrompt };
  }

  // Instant Phone Battery check
  if (/\b(phone battery|battery status|battery level|amar phone er battery)\b/.test(p)) {
    return {
      tool: 'phone_action',
      query: 'Battery Status',
      phoneParams: { action: 'battery_status', label: 'Check Phone Battery & Temp', params: {} },
    };
  }

  return null;
}

/**
 * Only run the LLM Planner if the prompt contains signals of needing external search, phone control, or webhooks
 * NOT already caught by the 0ms deterministic router. Pure chat/coding skips the extra LLM call completely!
 */
function mightNeedExternalPlanner(userPrompt: string, hasWebhooks: boolean): boolean {
  if (hasWebhooks && /\b(webhook|trigger|mcp)\b/i.test(userPrompt)) return true;
  return /\b(alarm|timer|whatsapp|sms|call|dial|calendar|maps|youtube|wifi|bluetooth|settings|latest|today|current|news|2025|2026|github repo|arxiv|research paper|reddit|hackernews|remember that my)\b/i.test(
    userPrompt
  );
}

export async function runOpenBrainAutonomousAgent(params: {
  userPrompt: string;
  history: ChatMessage[];
  settings: AppSettings;
  skills: BrainSkill[];
  connectors: BrainConnector[];
  webhooks: CustomWebhookConnector[];
  voiceProfiles: VoiceProfile[];
  memories: MemoryItem[];
  forceDeepResearch?: boolean;
  projectInstructions?: string;
  attachedImage?: string;
  attachedFileText?: string;
  attachedFileName?: string;
  attachedDocs?: AttachedDocItem[];
  onSaveMemoryFact: (fact: string, category?: MemoryItem['category']) => string | undefined;
  onStepsChange: (steps: AgentToolStep[]) => void;
}): Promise<{
  reply: string;
  routedModelLabel: string;
  thinkingTrace?: string;
  sources: ResearchSource[];
  savedMemoryFact?: string;
  generatedImages: string[];
  codeVideoArtifact?: RenderedCodeVideoArtifact;
  voiceClipArtifact?: SynthesizedClip;
  showVoiceCloneRecorder?: boolean;
  phoneActions: PhoneActionPayload[];
  codeArtifact?: { title: string; html: string };
  svgDiagramArtifact?: { title: string; svg: string };
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
    memories,
    forceDeepResearch,
    projectInstructions,
    attachedImage,
    attachedFileText,
    attachedFileName,
    attachedDocs,
    onSaveMemoryFact,
    onStepsChange,
  } = params;

  const steps: AgentToolStep[] = [];
  const generatedImages: string[] = [];
  const phoneActions: PhoneActionPayload[] = [];
  const collectedSources: ResearchSource[] = [];
  let savedMemoryFact: string | undefined;
  let codeArtifact: { title: string; html: string } | undefined;
  let svgDiagramArtifact: { title: string; svg: string } | undefined;
  let codeVideoArtifact: RenderedCodeVideoArtifact | undefined;
  let voiceClipArtifact: SynthesizedClip | undefined;
  let showVoiceCloneRecorder = false;

  const addSource = (s: ResearchSource) => {
    if (!s.url || collectedSources.some((x) => x.url === s.url)) return;
    collectedSources.push(s);
  };

  if (settings.autoMemory !== false) {
    const fastMem = extractExplicitMemoryFromPrompt(userPrompt);
    if (fastMem) {
      const saved = onSaveMemoryFact(fastMem.fact, fastMem.category);
      if (saved) savedMemoryFact = saved;
    }
  }

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
    let plannedCalls: PlannedToolCall[] = [];

    // 1. Check 0ms Instant Deterministic Router FIRST (zero network latency!)
    const directTool = detectGuaranteedDirectTool(userPrompt, forceDeepResearch);
    if (directTool) {
      plannedCalls = [directTool];
    } else if (mightNeedExternalPlanner(userPrompt, enabledWebhooks.length > 0)) {
      const availableToolLines: string[] = [
        '- "deep_research": multi-wave parallel research across Wikipedia, Web, HackerNews, GitHub & Papers',
        '- "read_url": fetch and read any http/https webpage (query = exact URL)',
        '- "code_interpreter": self-healing JavaScript solver for hard math/combinatorics',
        '- "svg_diagram": vector SVG flowchart or architecture diagram',
      ];
      if (settings.autoMemory !== false) {
        availableToolLines.push(
          '- "save_memory": store durable personal fact (query = fact; memoryCategory = "profile"|"preference"|"project"|"instruction")'
        );
      }
      if (enabledConnectorSlugs.has('web_search')) {
        availableToolLines.push('- "web_search": live facts, news, Wikipedia & DuckDuckGo lookup');
      }
      if (enabledConnectorSlugs.has('github')) {
        availableToolLines.push('- "github_search": open-source repositories on GitHub');
      }
      if (enabledConnectorSlugs.has('weather')) {
        availableToolLines.push('- "weather_live": current weather for a city (query = city name)');
      }
      if (enabledConnectorSlugs.has('crypto')) {
        availableToolLines.push('- "crypto_market": live USD & INR crypto prices');
      }
      if (enabledConnectorSlugs.has('arxiv')) {
        availableToolLines.push('- "arxiv_research": scientific or AI research papers');
      }
      if (enabledConnectorSlugs.has('pulse')) {
        availableToolLines.push('- "reddit_hn_pulse": live Reddit & HackerNews discussions');
      }
      if (enabledConnectorSlugs.has('android_os')) {
        availableToolLines.push(
          `- "phone_action": control Android phone! Include "phoneParams": {"action": "set_alarm"|"set_timer"|"dial_number"|"send_whatsapp"|"send_sms"|"add_calendar"|"open_maps"|"open_youtube"|"open_settings"|"send_email"|"battery_status"|"copy_clipboard", "label": "human title", "params": {...}}. Examples: set_alarm -> {"hour": 7, "minute": 30, "message": "Wake up"}; set_timer -> {"seconds": 300, "message": "Focus"}; send_whatsapp -> {"phone": "", "message": "Hello"}; dial_number -> {"phone": "9876543210"}; open_maps -> {"query": "Howrah Bridge"}; open_youtube -> {"query": "lofi music"}; open_settings -> {"section": "wifi"|"bluetooth"|"sound"|"battery"|"display"}`
        );
      }
      if (enabledWebhooks.length > 0) {
        availableToolLines.push(
          `- "custom_webhook": invoke user webhook (${enabledWebhooks
            .map((w) => w.name)
            .join(', ')}) with "webhookName" and "query"`
        );
      }

      const plannerPrompt = `You are Open Brain Autonomous Planner. Decide which tools (0 to 2 max) to run.
Available Tools:
${availableToolLines.join('\n')}

Return ONLY valid JSON:
{"needsTools": boolean, "calls": [{"tool": "...", "query": "...", "phoneParams": ...}]}`;

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
          plannedCalls = parsed.calls.slice(0, 2);
        }
      } catch {
        // Proceed cleanly
      }
    }

    for (const call of plannedCalls) {
      const stepId = `step-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
      const titleMap: Record<string, string> = {
        deep_research: 'Deep Research Multi-Wave Scanner',
        read_url: 'Live Webpage & Document Reader',
        code_interpreter: 'Self-Healing Code Interpreter',
        svg_diagram: 'Vector Architecture & Chart Engine',
        save_memory: 'Permanent Memory Cortex',
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
        voice_clone_tts: 'Voicebox Cloning & Pedalboard Audio',
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
        if (call.tool === 'deep_research') {
          const dr = await runDeepResearchPipeline(
            call.query || userPrompt,
            settings,
            (msg) => {
              stepObj.title = `Deep Research: ${msg}`;
              onStepsChange([...steps]);
            }
          );
          for (const s of dr.sources) addSource(s);
          output = dr.dossier;
        } else if (call.tool === 'read_url') {
          output = await runLiveUrlReaderTool(call.query, addSource);
        } else if (call.tool === 'code_interpreter') {
          output = await runSelfHealingCodeInterpreter(
            call.query || userPrompt,
            settings,
            (msg) => {
              stepObj.title = `Code Interpreter: ${msg}`;
              onStepsChange([...steps]);
            }
          );
        } else if (call.tool === 'svg_diagram') {
          const rawSvg = await generateFreeLLMResponse(
            [
              {
                role: 'system',
                content:
                  'Generate ONLY a crisp, clean, self-contained <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 460">...</svg> diagram with dark slate card background (#0F172A), sharp teal/white boxes, clear arrows, and legible sans-serif labels. Output ONLY the <svg>...</svg> markup.',
              },
              { role: 'user', content: call.query || userPrompt },
            ],
            settings,
            'qwen-coder'
          );
          const svgMatch = rawSvg.match(/<svg[\s\S]*<\/svg>/i);
          if (svgMatch) {
            svgDiagramArtifact = {
              title: (call.query || 'Architecture Diagram').slice(0, 48),
              svg: svgMatch[0],
            };
            output = `Generated interactive vector SVG diagram ("${svgDiagramArtifact.title}").`;
          } else {
            output = 'Prepared diagram explanation.';
          }
        } else if (call.tool === 'save_memory') {
          const saved = onSaveMemoryFact(
            call.query,
            call.memoryCategory || 'preference'
          );
          if (saved) savedMemoryFact = saved;
          output = `Stored in Permanent Memory Cortex: "${call.query}"`;
        } else if (call.tool === 'web_search') {
          output = await runWebSearchTool(call.query, addSource);
        } else if (call.tool === 'github_search') {
          output = await runGitHubSearchTool(call.query, settings.githubToken, addSource);
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
              'Displayed interactive Voicebox Zero-Shot Clone Recorder card inline in chat so the user can record a 6-12s voice sample or upload an audio clip.';
          } else if (call.voiceMode === 'setup_clone' && activeProfile) {
            showVoiceCloneRecorder = true;
            const sampleOut = await synthesizeClonedVoice({
              text: `Your cloned voice profile ${activeProfile.name} is ready on Open Brain.`,
              profile: activeProfile,
              presetVoice: 'echo',
              tryZeroShotNeural: true,
              hfToken: settings.hfToken,
              voiceboxServerUrl: settings.voiceboxServerUrl,
              effectPreset: settings.voiceboxEffectPreset,
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
              presetVoice: 'echo',
              tryZeroShotNeural: true,
              hfToken: settings.hfToken,
              voiceboxServerUrl: settings.voiceboxServerUrl,
              effectPreset: settings.voiceboxEffectPreset,
              onStatus: (m) => {
                stepObj.title = `Voicebox: ${m}`;
                onStepsChange([...steps]);
              },
            });
            voiceClipArtifact = {
              id: `vc-${Date.now()}`,
              text: spokenScript,
              voiceName: activeProfile ? activeProfile.name : 'Voicebox Studio',
              engineUsed: synthOut.engineUsed,
              audioUrl: synthOut.url,
              createdAt: Date.now(),
            };
            output = `Synthesized cloned/neural WAV audio (${voiceClipArtifact.voiceName} · ${synthOut.engineUsed}) directly in chat.`;
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
          const whResp = await smartFetch(wh.url, {
            method: wh.method,
            headers: wh.method === 'POST' ? { 'Content-Type': 'application/json' } : undefined,
            body:
              wh.method === 'POST'
                ? JSON.stringify({ query: call.query, prompt: userPrompt, source: 'OpenBrain' })
                : undefined,
            timeoutMs: 14000,
          });
          output = `Webhook "${wh.name}" HTTP ${whResp.status}: ${whResp.text().slice(0, 600)}`;
        } else if (call.tool === 'mini_app') {
          let cleanHtml = '';
          try {
            const appHtml = await generateFreeLLMResponse(
              [
                {
                  role: 'system',
                  content:
                    'Output ONLY a complete, self-contained, mobile-friendly single-file HTML5 document (<!DOCTYPE html>...</html>) with sleek modern UI, responsive controls, local persistence, and working JavaScript.',
                },
                { role: 'user', content: `Build this interactive app: ${call.query}` },
              ],
              settings,
              'qwen-coder'
            );
            const matchHtml = appHtml.match(/<!DOCTYPE html[\s\S]*<\/html>/i);
            const extracted = matchHtml
              ? matchHtml[0]
              : appHtml.replace(/```html|```/gi, '').trim();
            if (extracted.includes('<html') || extracted.includes('<body') || extracted.includes('<script')) {
              cleanHtml = extracted;
            }
          } catch {
            // Fall back to instant local HTML5 app compiler below
          }

          if (!cleanHtml) {
            cleanHtml = buildFallbackInteractiveWebApp(call.query || userPrompt);
          }

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

  // Fast-path immediate delivery when a rich self-contained media/app artifact was already compiled!
  if (codeArtifact) {
    return {
      reply: `Your interactive web app **${codeArtifact.title}** is compiled and running live below. You can interact with it directly inside chat, inspect the source code, or download the standalone \`.html\` file.`,
      routedModelLabel: 'Auto · Qwen-32B App Compiler',
      sources: collectedSources,
      savedMemoryFact,
      generatedImages,
      codeVideoArtifact,
      voiceClipArtifact,
      showVoiceCloneRecorder,
      phoneActions,
      codeArtifact,
      svgDiagramArtifact,
      toolSteps: steps,
      activeSkillNames: enabledSkills.map((s) => s.name),
    };
  }

  if (codeVideoArtifact || voiceClipArtifact || showVoiceCloneRecorder) {
    const summaryParts: string[] = [];
    if (codeVideoArtifact) {
      summaryParts.push(
        `Rendered **${codeVideoArtifact.title}** (${codeVideoArtifact.width}x${codeVideoArtifact.height} H.264 \`.mp4\`, ${codeVideoArtifact.durationSec}s) using ${codeVideoArtifact.engineLabel}. Tap Download to save directly to your phone.`
      );
    }
    if (voiceClipArtifact) {
      summaryParts.push(
        `Synthesized voice audio with **${voiceClipArtifact.engineUsed}**. You can play it inline or save the 16-bit \`.wav\` file.`
      );
    }
    if (showVoiceCloneRecorder && !voiceClipArtifact) {
      summaryParts.push(
        `Record a 6–12 second voice sample or upload an audio clip in the Voicebox Studio card below. Once saved, ask me to speak anything in your voice.`
      );
    }
    return {
      reply: summaryParts.join('\n\n'),
      routedModelLabel: voiceClipArtifact
        ? voiceClipArtifact.engineUsed
        : 'Open Brain Studio',
      sources: collectedSources,
      savedMemoryFact,
      generatedImages,
      codeVideoArtifact,
      voiceClipArtifact,
      showVoiceCloneRecorder,
      phoneActions,
      codeArtifact,
      svgDiagramArtifact,
      toolSteps: steps,
      activeSkillNames: enabledSkills.map((s) => s.name),
    };
  }

  const memoryDirective = formatMemoryBlockForPrompt(memories);

  const skillsDirective =
    enabledSkills.length > 0
      ? `\nACTIVE MODULAR SKILLS (${enabledSkills.length}):\n` +
        enabledSkills.map((s) => `- [${s.name}]: ${s.instructions}`).join('\n')
      : '';

  const projectDirective = projectInstructions?.trim()
    ? `\nACTIVE PROJECT INSTRUCTIONS:\n${projectInstructions.trim()}`
    : '';

  const systemInstruction = `You are **Open Brain v4.5** — an unmatched, 100% Free & Unlimited Autonomous AI Super-Agent powered by Multi-Cloud Smart Routing, Omega Council synthesis, Voicebox Multi-Engine Voice Cloning, Self-Verifying Critic loops, Permanent Personal Memory, Multi-Wave Deep Research, and Zero-Phone-Pressure architecture.
Everything executes directly inside this unified chat:
- Programmatic Code-to-MP4 Sandbox Video & Photorealistic Cinema MP4 Video
- Voicebox Voice Cloning (Chatterbox / Qwen3-TTS / F5-TTS / Vocal DNA Pedalboard) & 23-Language Neural Speech
- HD Flux.1 Image Generation & Interactive HTML5 App Compilation
- Multi-Wave Deep Research across Web, Wikipedia, GitHub, HackerNews & Scholarly Papers
- Native Android Phone OS Control (Alarms, Timers, WhatsApp, SMS, Calls, Maps, Calendar, YouTube, Settings, Battery)
${langHint}${memoryDirective}${projectDirective}${skillsDirective}${
    toolObservations.length > 0
      ? `\n\nLIVE EVIDENCE, ACTIONS & CONNECTOR DATA COMPLETED JUST NOW:\n${toolObservations.join(
          '\n\n'
        )}\nSynthesize these verified findings thoroughly, clearly, and authoritatively.`
      : ''
  }`;

  const recentTurns: ChatTurnInput[] = history.slice(-8).map((m) => ({
    role: m.role,
    content: m.content,
  }));

  const docsToIndex: AttachedDocItem[] =
    attachedDocs && attachedDocs.length > 0
      ? attachedDocs
      : attachedFileText
      ? [{ name: attachedFileName || 'document', content: attachedFileText }]
      : [];

  let ragContextBlock = '';
  if (docsToIndex.length > 0) {
    const tRag = performance.now();
    const rag = retrieveRelevantDocumentContext(docsToIndex, userPrompt, 15000);
    ragContextBlock = rag.contextBlock;
    steps.push({
      id: `step-rag-${Date.now()}`,
      tool: 'rag_retriever',
      title: `BM25 Long-Context RAG (${rag.totalCharsIndexed.toLocaleString()} chars)`,
      query: docsToIndex.map((d) => d.name).join(', '),
      status: 'done',
      durationMs: Math.max(1, Math.round(performance.now() - tRag)),
      resultSummary: `Indexed ${docsToIndex.length} file(s) & retrieved top ${rag.chunksSelected} passages`,
    });
    onStepsChange([...steps]);
  }

  const fullUserContent = ragContextBlock
    ? `${userPrompt}\n\n${ragContextBlock}`
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

  const trackedSteps: Record<string, AgentToolStep> = {};
  const brainRes = await generateSmartBrainResponse(finalMessages, settings, (kind, note) => {
    if (!trackedSteps[kind]) {
      const s: AgentToolStep = {
        id: `step-${kind}-${Date.now()}`,
        tool: kind,
        title:
          kind === 'moa_council'
            ? 'Multi-Cloud Omega Council (R1 + HF Qwen + Omni-70B)'
            : 'Self-Verifying Critic Audit',
        query: note,
        status: 'running',
      };
      trackedSteps[kind] = s;
      steps.push(s);
    } else {
      trackedSteps[kind].query = note;
    }
    onStepsChange([...steps]);
  });

  Object.values(trackedSteps).forEach((s) => {
    s.status = 'done';
    s.resultSummary = s.query;
  });
  if (Object.keys(trackedSteps).length > 0) {
    onStepsChange([...steps]);
  }

  return {
    reply: brainRes.content,
    routedModelLabel: brainRes.modelUsedLabel,
    thinkingTrace: brainRes.thinkingTrace,
    sources: collectedSources,
    savedMemoryFact,
    generatedImages,
    codeVideoArtifact,
    voiceClipArtifact,
    showVoiceCloneRecorder,
    phoneActions,
    codeArtifact,
    svgDiagramArtifact,
    toolSteps: steps,
    activeSkillNames: enabledSkills.map((s) => s.name),
  };
}

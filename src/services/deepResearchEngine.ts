import { AppSettings, ResearchSource } from '../types';
import { extractJsonObject, generateFreeLLMResponse } from './llmEngine';
import { smartFetch } from './nativeHttp';

interface QueryPlan {
  queries: string[];
}

function safeDomain(urlStr: string): string {
  try {
    return new URL(urlStr).hostname.replace(/^www\./, '');
  } catch {
    return 'web';
  }
}

export async function runDeepResearchPipeline(
  userQuery: string,
  settings: AppSettings,
  onProgress?: (msg: string) => void
): Promise<{ dossier: string; sources: ResearchSource[] }> {
  onProgress?.('Decomposing research topic into multi-angle search vectors...');

  let searchQueries: string[] = [userQuery.slice(0, 120)];
  try {
    const rawPlan = await generateFreeLLMResponse(
      [
        {
          role: 'system',
          content:
            'Convert the user topic (which may be in any language) into 2 concise English search queries: one for foundational/technical facts and one for latest developments. Return ONLY JSON: {"queries": ["query 1", "query 2"]}',
        },
        { role: 'user', content: userQuery },
      ],
      settings,
      'openai'
    );
    const parsed = extractJsonObject<QueryPlan>(rawPlan);
    if (parsed?.queries && Array.isArray(parsed.queries) && parsed.queries.length > 0) {
      searchQueries = parsed.queries.slice(0, 2);
    }
  } catch {
    // Fallback to raw user query
  }

  const primaryQ = searchQueries[0] || userQuery;
  const secondaryQ = searchQueries[1] || primaryQ;

  onProgress?.('Scanning Wikipedia, Web, HackerNews, GitHub & Papers in parallel...');

  const collectedSources: ResearchSource[] = [];
  const evidenceSections: string[] = [];

  const addSource = (src: ResearchSource) => {
    if (!src.url || !src.url.startsWith('http')) return;
    if (collectedSources.some((s) => s.url === src.url)) return;
    collectedSources.push(src);
  };

  await Promise.all([
    // 1. Wikipedia Deep Snippets
    (async () => {
      try {
        const r = await smartFetch(
          `https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(
            primaryQ
          )}&utf8=&format=json&origin=*&srlimit=4`,
          { timeoutMs: 9000 }
        );
        if (!r.ok) return;
        const d = r.json<any>();
        const lines: string[] = [];
        for (const h of (d?.query?.search || []).slice(0, 3)) {
          const title = String(h.title || '');
          const snippet = String(h.snippet || '').replace(/<[^>]+>/g, '');
          const url = `https://en.wikipedia.org/wiki/${encodeURIComponent(
            title.replace(/\s+/g, '_')
          )}`;
          addSource({ title: `Wikipedia: ${title}`, url, domain: 'wikipedia.org', snippet });
          lines.push(`- [${title}] (${url}): ${snippet}`);
        }
        if (lines.length) evidenceSections.push(`WIKIPEDIA KNOWLEDGE:\n${lines.join('\n')}`);
      } catch {
        // Ignore
      }
    })(),

    // 2. DuckDuckGo Instant Graph
    (async () => {
      try {
        const r = await smartFetch(
          `https://api.duckduckgo.com/?q=${encodeURIComponent(
            primaryQ
          )}&format=json&no_html=1&skip_disambig=1`,
          { timeoutMs: 9000 }
        );
        if (!r.ok) return;
        const d = r.json<any>();
        const lines: string[] = [];
        if (d.AbstractText) {
          if (d.AbstractURL) {
            addSource({
              title: d.Heading || primaryQ,
              url: d.AbstractURL,
              domain: safeDomain(d.AbstractURL),
              snippet: d.AbstractText,
            });
          }
          lines.push(`- ${d.AbstractText}`);
        }
        for (const t of (d?.RelatedTopics || []).slice(0, 3)) {
          if (t?.Text) {
            if (t.FirstURL) {
              addSource({
                title: String(t.Text).slice(0, 60),
                url: t.FirstURL,
                domain: safeDomain(t.FirstURL),
              });
            }
            lines.push(`- ${t.Text}`);
          }
        }
        if (lines.length) evidenceSections.push(`INSTANT WEB GRAPH:\n${lines.join('\n')}`);
      } catch {
        // Ignore
      }
    })(),

    // 3. HackerNews Algolia Articles
    (async () => {
      try {
        const r = await smartFetch(
          `https://hn.algolia.com/api/v1/search?query=${encodeURIComponent(
            secondaryQ
          )}&hitsPerPage=4`,
          { timeoutMs: 9000 }
        );
        if (!r.ok) return;
        const d = r.json<any>();
        const lines: string[] = [];
        for (const h of (d?.hits || []).slice(0, 4)) {
          if (!h?.title) continue;
          const url = h.url || `https://news.ycombinator.com/item?id=${h.objectID}`;
          addSource({
            title: h.title,
            url,
            domain: safeDomain(url),
          });
          lines.push(`- ${h.title} (${h.points ?? 0} pts) — ${url}`);
        }
        if (lines.length) evidenceSections.push(`TECH & INDUSTRY ARTICLES:\n${lines.join('\n')}`);
      } catch {
        // Ignore
      }
    })(),

    // 4. Scholarly CrossRef / ArXiv Papers
    (async () => {
      try {
        const r = await smartFetch(
          `https://api.crossref.org/works?query=${encodeURIComponent(primaryQ)}&rows=3`,
          { timeoutMs: 9000 }
        );
        if (!r.ok) return;
        const d = r.json<any>();
        const lines: string[] = [];
        for (const it of (d?.message?.items || []).slice(0, 3)) {
          const title = (it.title && it.title[0]) || 'Research Paper';
          const year = it.published?.['date-parts']?.[0]?.[0] || 'n.d.';
          const url = it.URL || (it.DOI ? `https://doi.org/${it.DOI}` : '');
          if (url) {
            addSource({
              title: `${title} (${year})`,
              url,
              domain: safeDomain(url),
            });
          }
          lines.push(`- "${title}" (${year}) ${url}`);
        }
        if (lines.length) evidenceSections.push(`SCHOLARLY PAPERS:\n${lines.join('\n')}`);
      } catch {
        // Ignore
      }
    })(),

    // 5. GitHub Open-Source Ecosystem
    (async () => {
      try {
        const headers: Record<string, string> = {};
        if (settings.githubToken?.trim()) {
          headers.Authorization = `Bearer ${settings.githubToken.trim()}`;
        }
        const r = await smartFetch(
          `https://api.github.com/search/repositories?q=${encodeURIComponent(
            primaryQ
          )}&sort=stars&order=desc&per_page=3`,
          { headers, timeoutMs: 9000 }
        );
        if (!r.ok) return;
        const d = r.json<any>();
        const lines: string[] = [];
        for (const repo of (d?.items || []).slice(0, 3)) {
          if (repo?.html_url) {
            addSource({
              title: `${repo.full_name} (${repo.stargazers_count} stars)`,
              url: repo.html_url,
              domain: 'github.com',
              snippet: repo.description,
            });
            lines.push(
              `- ${repo.full_name} (${repo.stargazers_count} stars): ${
                repo.description || ''
              } (${repo.html_url})`
            );
          }
        }
        if (lines.length) evidenceSections.push(`OPEN-SOURCE REPOSITORIES:\n${lines.join('\n')}`);
      } catch {
        // Ignore
      }
    })(),
  ]);

  onProgress?.(
    `Compiled ${collectedSources.length} verified sources — synthesizing deep report...`
  );

  return {
    dossier:
      evidenceSections.join('\n\n') ||
      `Synthesize an authoritative deep-dive analysis on "${userQuery}".`,
    sources: collectedSources.slice(0, 8),
  };
}

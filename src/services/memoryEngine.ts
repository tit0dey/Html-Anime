import { MemoryItem } from '../types';

const MEMORY_STORAGE_KEY = 'openbrain_memories_v1';

export function loadMemories(): MemoryItem[] {
  try {
    const raw = localStorage.getItem(MEMORY_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveMemories(items: MemoryItem[]): void {
  try {
    localStorage.setItem(MEMORY_STORAGE_KEY, JSON.stringify(items.slice(0, 50)));
  } catch {
    // Ignore storage quota
  }
}

export function addOrUpdateMemory(
  existing: MemoryItem[],
  fact: string,
  category: MemoryItem['category'] = 'preference'
): { updated: MemoryItem[]; addedItem?: MemoryItem } {
  const cleanFact = fact.trim().replace(/\s+/g, ' ').slice(0, 240);
  if (!cleanFact || cleanFact.length < 4) return { updated: existing };

  const norm = cleanFact.toLowerCase();
  const alreadyExists = existing.some(
    (m) =>
      m.fact.toLowerCase() === norm ||
      m.fact.toLowerCase().includes(norm) ||
      norm.includes(m.fact.toLowerCase())
  );
  if (alreadyExists) {
    return { updated: existing };
  }

  const created: MemoryItem = {
    id: `mem-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    fact: cleanFact,
    category,
    createdAt: Date.now(),
  };

  const next = [created, ...existing].slice(0, 50);
  saveMemories(next);
  return { updated: next, addedItem: created };
}

/**
 * Fast zero-latency multilingual pattern extractor for explicit user memory statements
 * (supports English, Banglish, Bengali, Hindi, etc.) as a backup to the LLM save_memory tool.
 */
export function extractExplicitMemoryFromPrompt(
  prompt: string
): { fact: string; category: MemoryItem['category'] } | null {
  const trimmed = prompt.trim();
  if (trimmed.length > 260) return null;

  const rememberMatch = trimmed.match(
    /^(?:please\s+)?(?:remember(?:\s+that)?|keep in mind(?:\s+that)?|mone rakhbi|mone rekho|yaad rakhna)\s*[:-]?\s*(.+)$/i
  );
  if (rememberMatch?.[1]) {
    return { fact: rememberMatch[1].trim(), category: 'instruction' };
  }

  const nameMatch = trimmed.match(
    /^(?:my name is|i am called|amar naam(?:\s+holo)?|mera naam)\s+([A-Za-z\u0980-\u09FF\s]{2,40})$/i
  );
  if (nameMatch?.[1]) {
    return { fact: `User's name is ${nameMatch[1].trim()}`, category: 'profile' };
  }

  const prefMatch = trimmed.match(
    /^(?:i always prefer|always reply in|sob somoy .* উত্তর দিবি|always use)\s+(.+)$/i
  );
  if (prefMatch?.[0]) {
    return { fact: prefMatch[0].trim(), category: 'preference' };
  }

  return null;
}

export function formatMemoryBlockForPrompt(memories: MemoryItem[]): string {
  if (!memories.length) return '';
  const lines = memories
    .slice(0, 25)
    .map((m) => `- [${m.category.toUpperCase()}] ${m.fact}`)
    .join('\n');
  return `\nPERMANENT USER MEMORY CORTEX (Remember and apply these personal facts & preferences naturally across conversations):\n${lines}`;
}

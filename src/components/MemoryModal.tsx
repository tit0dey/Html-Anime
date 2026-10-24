import React, { useState } from 'react';
import { Brain, Plus, Trash2, X } from 'lucide-react';
import { MemoryItem } from '../types';

interface Props {
  open: boolean;
  memories: MemoryItem[];
  autoMemory: boolean;
  onToggleAutoMemory: (enabled: boolean) => void;
  onAddMemory: (fact: string, category: MemoryItem['category']) => void;
  onDeleteMemory: (id: string) => void;
  onClose: () => void;
}

export const MemoryModal: React.FC<Props> = ({
  open,
  memories,
  autoMemory,
  onToggleAutoMemory,
  onAddMemory,
  onDeleteMemory,
  onClose,
}) => {
  const [factDraft, setFactDraft] = useState('');
  const [category, setCategory] = useState<MemoryItem['category']>('preference');

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 bg-[#F5F6F8] dark:bg-[#0B0E14] overflow-y-auto animate-sheet-up">
      <div className="max-w-xl mx-auto px-4 pt-[calc(0.9rem+env(safe-area-inset-top,0px))] pb-[calc(2rem+env(safe-area-inset-bottom,0px))] space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <Brain className="w-5 h-5 text-slate-900 dark:text-white" />
            <h2 className="text-lg font-bold text-slate-900 dark:text-white">
              Permanent Memory Cortex
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-9 h-9 rounded-full bg-white dark:bg-[#161B24] flex items-center justify-center text-slate-700 dark:text-slate-200 shadow-xs"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <label className="rounded-2xl bg-white dark:bg-[#141821] p-4 flex items-center justify-between border border-slate-200/80 dark:border-slate-800 cursor-pointer">
          <div>
            <div className="text-sm font-semibold text-slate-900 dark:text-white">
              Auto-Learn Personal Memories
            </div>
            <div className="text-xs text-slate-500 dark:text-slate-400">
              Automatically remembers your name, goals, stack & preferences across chats
            </div>
          </div>
          <input
            type="checkbox"
            checked={autoMemory}
            onChange={(e) => onToggleAutoMemory(e.target.checked)}
            className="w-4 h-4 accent-slate-900 dark:accent-teal-400"
          />
        </label>

        {/* Add Custom Fact */}
        <div className="rounded-2xl bg-white dark:bg-[#141821] p-4 space-y-2.5 border border-slate-200/80 dark:border-slate-800">
          <div className="text-xs font-semibold text-slate-900 dark:text-white">
            Add Standing Memory or Rule
          </div>
          <input
            type="text"
            value={factDraft}
            onChange={(e) => setFactDraft(e.target.value)}
            placeholder="e.g., I build Android apps with React & TypeScript"
            className="w-full rounded-xl bg-[#F5F6F8] dark:bg-[#0E121A] px-3 py-2 text-xs text-slate-900 dark:text-white focus:outline-none"
          />
          <div className="flex items-center gap-2">
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value as MemoryItem['category'])}
              className="rounded-xl bg-[#F5F6F8] dark:bg-[#0E121A] px-3 py-2 text-xs text-slate-900 dark:text-white"
            >
              <option value="profile">Profile</option>
              <option value="preference">Preference</option>
              <option value="project">Project</option>
              <option value="instruction">Rule</option>
            </select>
            <button
              type="button"
              onClick={() => {
                if (!factDraft.trim()) return;
                onAddMemory(factDraft.trim(), category);
                setFactDraft('');
              }}
              className="flex-1 py-2 px-3 rounded-xl bg-slate-900 dark:bg-white text-white dark:text-slate-950 text-xs font-semibold flex items-center justify-center gap-1"
            >
              <Plus className="w-3.5 h-3.5" /> Save Memory
            </button>
          </div>
        </div>

        {/* Saved Memories List */}
        <div className="space-y-2">
          {memories.length === 0 ? (
            <div className="rounded-2xl bg-white dark:bg-[#141821] p-8 text-center text-xs text-slate-500 dark:text-slate-400 border border-slate-200/70 dark:border-slate-800">
              No personal memories stored yet. Tell Open Brain in chat (e.g., "Remember my name is Arka") or add one above.
            </div>
          ) : (
            memories.map((m) => (
              <div
                key={m.id}
                className="rounded-2xl bg-white dark:bg-[#141821] p-3.5 border border-slate-200/80 dark:border-slate-800 flex items-center justify-between gap-3"
              >
                <div className="min-w-0">
                  <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-[#F5F6F8] dark:bg-[#1E2430] text-slate-600 dark:text-teal-300">
                    {m.category}
                  </span>
                  <p className="text-xs font-medium text-slate-900 dark:text-slate-100 mt-1">
                    {m.fact}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => onDeleteMemory(m.id)}
                  className="p-1.5 text-slate-400 hover:text-red-500 shrink-0"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};

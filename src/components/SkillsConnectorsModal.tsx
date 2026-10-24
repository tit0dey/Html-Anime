import React, { useState } from 'react';
import {
  Blocks,
  Check,
  Link2,
  Loader2,
  Plus,
  Trash2,
  Upload,
  Wand2,
  X,
} from 'lucide-react';
import {
  AppSettings,
  BrainConnector,
  BrainSkill,
  CustomWebhookConnector,
} from '../types';
import { generateFreeLLMResponse } from '../services/llmEngine';
import { triggerHaptic } from '../services/nativeBridge';
import { TealVectorIcon } from './TealVectorIcon';

interface Props {
  open: boolean;
  settings: AppSettings;
  skills: BrainSkill[];
  connectors: BrainConnector[];
  webhooks: CustomWebhookConnector[];
  onChangeSkills: (next: BrainSkill[]) => void;
  onChangeConnectors: (next: BrainConnector[]) => void;
  onChangeWebhooks: (next: CustomWebhookConnector[]) => void;
  onClose: () => void;
}

export const SkillsConnectorsModal: React.FC<Props> = ({
  open,
  settings,
  skills,
  connectors,
  webhooks,
  onChangeSkills,
  onChangeConnectors,
  onChangeWebhooks,
  onClose,
}) => {
  const [tab, setTab] = useState<'skills' | 'connectors'>('skills');
  const [addingSkill, setAddingSkill] = useState(false);
  const [skillName, setSkillName] = useState('');
  const [skillDesc, setSkillDesc] = useState('');
  const [skillInstructions, setSkillInstructions] = useState('');
  const [generating, setGenerating] = useState(false);

  const [whName, setWhName] = useState('');
  const [whUrl, setWhUrl] = useState('');
  const [whMethod, setWhMethod] = useState<'POST' | 'GET'>('POST');

  if (!open) return null;

  const toggleSkill = (id: string) => {
    triggerHaptic(12);
    onChangeSkills(skills.map((s) => (s.id === id ? { ...s, enabled: !s.enabled } : s)));
  };

  const toggleConnector = (id: string) => {
    triggerHaptic(12);
    onChangeConnectors(
      connectors.map((c) => (c.id === id ? { ...c, enabled: !c.enabled } : c))
    );
  };

  const handleAutoWrite = async () => {
    if (!skillName.trim() || generating) return;
    setGenerating(true);
    try {
      const res = await generateFreeLLMResponse(
        [
          {
            role: 'user',
            content: `Write concise expert SKILL.md agent instructions (4-6 clear directives in English, no emojis) for a custom AI skill named "${skillName}" (${
              skillDesc || 'specialized workflow'
            }). Output ONLY the directives.`,
          },
        ],
        settings,
        'openai'
      );
      setSkillInstructions(res.trim());
    } finally {
      setGenerating(false);
    }
  };

  const handleCreateSkill = () => {
    if (!skillName.trim() || !skillInstructions.trim()) return;
    const created: BrainSkill = {
      id: `skill-${Date.now()}`,
      name: skillName.trim(),
      icon: 'sparkles',
      category: 'custom',
      description: skillDesc.trim() || 'Custom user skill',
      instructions: skillInstructions.trim(),
      enabled: true,
    };
    onChangeSkills([created, ...skills]);
    setSkillName('');
    setSkillDesc('');
    setSkillInstructions('');
    setAddingSkill(false);
  };

  const handleImportMd = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const text = await file.text();
    const firstHeading = text.match(/^#\s+(.+)$/m)?.[1]?.trim();
    const created: BrainSkill = {
      id: `skill-md-${Date.now()}`,
      name: firstHeading || file.name.replace(/\.md$/i, ''),
      icon: 'file',
      category: 'custom',
      description: `Imported from ${file.name}`,
      instructions: text.slice(0, 4000),
      enabled: true,
    };
    onChangeSkills([created, ...skills]);
    e.target.value = '';
  };

  const handleAddWebhook = () => {
    if (!whName.trim() || !whUrl.trim()) return;
    const wh: CustomWebhookConnector = {
      id: `wh-${Date.now()}`,
      name: whName.trim(),
      url: whUrl.trim(),
      method: whMethod,
      description: 'Custom HTTP/MCP Endpoint',
      enabled: true,
    };
    onChangeWebhooks([wh, ...webhooks]);
    setWhName('');
    setWhUrl('');
  };

  return (
    <div className="fixed inset-0 z-50 bg-[#F5F6F8] dark:bg-[#0B0E14] overflow-y-auto animate-sheet-up">
      <div className="max-w-2xl mx-auto px-4 pt-[calc(0.9rem+env(safe-area-inset-top,0px))] pb-[calc(2rem+env(safe-area-inset-bottom,0px))] space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <Blocks className="w-5 h-5 text-slate-900 dark:text-white" />
            <h2 className="text-lg font-bold text-slate-900 dark:text-white">
              Skills & Connectors
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

        {/* Segmented Control */}
        <div className="grid grid-cols-2 p-1 rounded-2xl bg-slate-200/70 dark:bg-[#141821]">
          <button
            type="button"
            onClick={() => setTab('skills')}
            className={`py-2 rounded-xl text-xs font-semibold transition ${
              tab === 'skills'
                ? 'bg-white dark:bg-[#222836] text-slate-900 dark:text-white shadow-xs'
                : 'text-slate-600 dark:text-slate-400'
            }`}
          >
            Skills ({skills.filter((s) => s.enabled).length}/{skills.length})
          </button>
          <button
            type="button"
            onClick={() => setTab('connectors')}
            className={`py-2 rounded-xl text-xs font-semibold transition ${
              tab === 'connectors'
                ? 'bg-white dark:bg-[#222836] text-slate-900 dark:text-white shadow-xs'
                : 'text-slate-600 dark:text-slate-400'
            }`}
          >
            MCP Connectors ({connectors.filter((c) => c.enabled).length}/{connectors.length})
          </button>
        </div>

        {tab === 'skills' ? (
          <div className="space-y-3">
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setAddingSkill((v) => !v)}
                className="px-3.5 py-2 rounded-xl bg-slate-900 dark:bg-white text-white dark:text-slate-950 text-xs font-semibold flex items-center gap-1.5"
              >
                <Plus className="w-3.5 h-3.5" /> Create Skill
              </button>
              <label className="px-3.5 py-2 rounded-xl bg-white dark:bg-[#141821] border border-slate-200 dark:border-slate-800 text-xs font-semibold text-slate-700 dark:text-slate-200 flex items-center gap-1.5 cursor-pointer">
                <Upload className="w-3.5 h-3.5" /> Import SKILL.md
                <input
                  type="file"
                  accept=".md,.txt"
                  onChange={handleImportMd}
                  className="hidden"
                />
              </label>
            </div>

            {addingSkill && (
              <div className="rounded-2xl bg-white dark:bg-[#141821] p-4 space-y-2.5 border border-slate-200 dark:border-slate-800">
                <input
                  type="text"
                  value={skillName}
                  onChange={(e) => setSkillName(e.target.value)}
                  placeholder="Skill Name (e.g., Full-Stack Code Reviewer)"
                  className="w-full rounded-xl bg-[#F5F6F8] dark:bg-[#0E121A] px-3 py-2 text-xs text-slate-900 dark:text-white focus:outline-none"
                />
                <input
                  type="text"
                  value={skillDesc}
                  onChange={(e) => setSkillDesc(e.target.value)}
                  placeholder="Short description"
                  className="w-full rounded-xl bg-[#F5F6F8] dark:bg-[#0E121A] px-3 py-2 text-xs text-slate-900 dark:text-white focus:outline-none"
                />
                <div className="flex justify-end">
                  <button
                    type="button"
                    disabled={!skillName.trim() || generating}
                    onClick={handleAutoWrite}
                    className="text-xs font-semibold text-teal-600 dark:text-teal-400 flex items-center gap-1 disabled:opacity-40"
                  >
                    {generating ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Wand2 className="w-3.5 h-3.5" />
                    )}
                    Auto-Write Instructions with AI
                  </button>
                </div>
                <textarea
                  value={skillInstructions}
                  onChange={(e) => setSkillInstructions(e.target.value)}
                  rows={4}
                  placeholder="Skill directives injected automatically into Open Brain..."
                  className="w-full rounded-xl bg-[#F5F6F8] dark:bg-[#0E121A] p-3 text-xs text-slate-900 dark:text-white focus:outline-none"
                />
                <div className="flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setAddingSkill(false)}
                    className="px-3 py-1.5 text-xs text-slate-500"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleCreateSkill}
                    className="px-4 py-1.5 rounded-xl bg-slate-900 dark:bg-white text-white dark:text-slate-950 text-xs font-semibold"
                  >
                    Save Skill
                  </button>
                </div>
              </div>
            )}

            <div className="space-y-2">
              {skills.map((sk) => (
                <div
                  key={sk.id}
                  onClick={() => toggleSkill(sk.id)}
                  className={`cursor-pointer rounded-2xl p-4 bg-white dark:bg-[#141821] border transition flex items-start justify-between gap-3 ${
                    sk.enabled
                      ? 'border-slate-900/30 dark:border-teal-500/40'
                      : 'border-slate-200/70 dark:border-slate-800 opacity-65'
                  }`}
                >
                  <div className="flex items-start gap-3 min-w-0">
                    <div className="w-9 h-9 rounded-xl bg-[#F5F6F8] dark:bg-[#1E2430] flex items-center justify-center shrink-0">
                      <TealVectorIcon
                        name={sk.icon}
                        className="w-4 h-4 text-slate-800 dark:text-teal-400"
                      />
                    </div>
                    <div className="min-w-0">
                      <div className="text-sm font-semibold text-slate-900 dark:text-white">
                        {sk.name}
                      </div>
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                        {sk.description}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    {!sk.builtIn && (
                      <button
                        type="button"
                        onClick={(ev) => {
                          ev.stopPropagation();
                          onChangeSkills(skills.filter((s) => s.id !== sk.id));
                        }}
                        className="p-1 text-slate-400 hover:text-red-500"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                    <div
                      className={`w-6 h-6 rounded-full flex items-center justify-center ${
                        sk.enabled
                          ? 'bg-slate-900 dark:bg-teal-400 text-white dark:text-slate-950'
                          : 'border border-slate-300 dark:border-slate-700'
                      }`}
                    >
                      {sk.enabled && <Check className="w-3.5 h-3.5 stroke-[2.6]" />}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="space-y-2">
              {connectors.map((c) => (
                <div
                  key={c.id}
                  onClick={() => toggleConnector(c.id)}
                  className={`cursor-pointer rounded-2xl p-4 bg-white dark:bg-[#141821] border transition flex items-start justify-between gap-3 ${
                    c.enabled
                      ? 'border-slate-900/30 dark:border-teal-500/40'
                      : 'border-slate-200/70 dark:border-slate-800 opacity-65'
                  }`}
                >
                  <div className="flex items-start gap-3 min-w-0">
                    <div className="w-9 h-9 rounded-xl bg-[#F5F6F8] dark:bg-[#1E2430] flex items-center justify-center shrink-0">
                      <TealVectorIcon
                        name={c.icon}
                        className="w-4 h-4 text-slate-800 dark:text-teal-400"
                      />
                    </div>
                    <div className="min-w-0">
                      <div className="text-sm font-semibold text-slate-900 dark:text-white">
                        {c.name}
                      </div>
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                        {c.description}
                      </p>
                    </div>
                  </div>

                  <div
                    className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 ${
                      c.enabled
                        ? 'bg-slate-900 dark:bg-teal-400 text-white dark:text-slate-950'
                        : 'border border-slate-300 dark:border-slate-700'
                    }`}
                  >
                    {c.enabled && <Check className="w-3.5 h-3.5 stroke-[2.6]" />}
                  </div>
                </div>
              ))}
            </div>

            {/* Custom Webhook / MCP HTTP Connector */}
            <div className="rounded-2xl bg-white dark:bg-[#141821] p-4 border border-slate-200/80 dark:border-slate-800 space-y-2.5">
              <div className="flex items-center gap-2 text-sm font-semibold text-slate-900 dark:text-white">
                <Link2 className="w-4 h-4" /> Custom MCP / Webhook Bridge
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                <input
                  type="text"
                  value={whName}
                  onChange={(e) => setWhName(e.target.value)}
                  placeholder="Connector name (e.g., n8n)"
                  className="rounded-xl bg-[#F5F6F8] dark:bg-[#0E121A] px-3 py-2 text-xs text-slate-900 dark:text-white"
                />
                <input
                  type="url"
                  value={whUrl}
                  onChange={(e) => setWhUrl(e.target.value)}
                  placeholder="https://..."
                  className="rounded-xl bg-[#F5F6F8] dark:bg-[#0E121A] px-3 py-2 text-xs text-slate-900 dark:text-white"
                />
                <div className="flex gap-1.5">
                  <select
                    value={whMethod}
                    onChange={(e) => setWhMethod(e.target.value as 'POST' | 'GET')}
                    className="rounded-xl bg-[#F5F6F8] dark:bg-[#0E121A] px-2.5 py-2 text-xs text-slate-900 dark:text-white"
                  >
                    <option value="POST">POST</option>
                    <option value="GET">GET</option>
                  </select>
                  <button
                    type="button"
                    onClick={handleAddWebhook}
                    className="flex-1 rounded-xl bg-slate-900 dark:bg-white text-white dark:text-slate-950 text-xs font-semibold"
                  >
                    Add
                  </button>
                </div>
              </div>

              {webhooks.length > 0 && (
                <div className="pt-2 space-y-1.5">
                  {webhooks.map((w) => (
                    <div
                      key={w.id}
                      className="flex items-center justify-between p-2.5 rounded-xl bg-[#F5F6F8] dark:bg-[#0E121A] text-xs"
                    >
                      <span className="font-medium text-slate-800 dark:text-slate-200 truncate">
                        {w.name} ({w.method}) · {w.url}
                      </span>
                      <button
                        type="button"
                        onClick={() =>
                          onChangeWebhooks(webhooks.filter((x) => x.id !== w.id))
                        }
                        className="text-slate-400 hover:text-red-500 p-1"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

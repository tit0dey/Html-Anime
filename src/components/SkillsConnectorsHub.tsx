import React, { useState } from 'react';
import {
  AlarmClock,
  BatteryCharging,
  Blocks,
  CheckCircle2,
  Link2,
  Loader2,
  MapPin,
  MessageSquare,
  Plug,
  Plus,
  Settings,
  Smartphone,
  Sparkles,
  Timer,
  Trash2,
  Upload,
  Wand2,
} from 'lucide-react';
import {
  AppSettings,
  BrainConnector,
  BrainSkill,
  CustomWebhookConnector,
} from '../types';
import { generateFreeLLMResponse } from '../services/llmEngine';
import { executePhoneAction, triggerHaptic } from '../services/nativeBridge';
import { TealVectorIcon } from './TealVectorIcon';

interface Props {
  settings: AppSettings;
  skills: BrainSkill[];
  connectors: BrainConnector[];
  webhooks: CustomWebhookConnector[];
  onChangeSkills: (next: BrainSkill[]) => void;
  onChangeConnectors: (next: BrainConnector[]) => void;
  onChangeWebhooks: (next: CustomWebhookConnector[]) => void;
  onUpdateSettings: (patch: Partial<AppSettings>) => void;
}

export const SkillsConnectorsHub: React.FC<Props> = ({
  settings,
  skills,
  connectors,
  webhooks,
  onChangeSkills,
  onChangeConnectors,
  onChangeWebhooks,
  onUpdateSettings,
}) => {
  const [subTab, setSubTab] = useState<'skills' | 'connectors' | 'phone'>('skills');
  const [showNewSkill, setShowNewSkill] = useState(false);
  const [skillName, setSkillName] = useState('');
  const [skillIcon, setSkillIcon] = useState('sparkles');
  const [skillDesc, setSkillDesc] = useState('');
  const [skillInstructions, setSkillInstructions] = useState('');
  const [generatingSkill, setGeneratingSkill] = useState(false);

  const [whName, setWhName] = useState('');
  const [whUrl, setWhUrl] = useState('');
  const [whMethod, setWhMethod] = useState<'POST' | 'GET'>('POST');
  const [phoneResult, setPhoneResult] = useState('');

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

  const handleAutoWriteSkill = async () => {
    if (!skillName.trim() || generatingSkill) return;
    setGeneratingSkill(true);
    try {
      const prompt = `Create concise, expert Claude-style SKILL.md agent instructions (4-6 clear directives in English, no emojis) for a custom AI skill named "${skillName}" (${
        skillDesc || 'specialized workflow'
      }). Output ONLY the instructions text.`;
      const res = await generateFreeLLMResponse(
        [{ role: 'user', content: prompt }],
        settings,
        'openai'
      );
      setSkillInstructions(res.trim());
      if (!skillDesc.trim()) {
        setSkillDesc(`Specialized Open Brain skill for ${skillName}`);
      }
    } finally {
      setGeneratingSkill(false);
    }
  };

  const handleSaveSkill = () => {
    if (!skillName.trim() || !skillInstructions.trim()) return;
    const created: BrainSkill = {
      id: `custom-skill-${Date.now()}`,
      name: skillName.trim(),
      icon: skillIcon,
      category: 'custom',
      description: skillDesc.trim() || 'Custom user-created skill',
      instructions: skillInstructions.trim(),
      enabled: true,
    };
    onChangeSkills([created, ...skills]);
    setSkillName('');
    setSkillDesc('');
    setSkillInstructions('');
    setShowNewSkill(false);
    triggerHaptic(22);
  };

  const handleImportSkillMd = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const text = String(reader.result || '');
      const imported: BrainSkill = {
        id: `imported-${Date.now()}`,
        name: file.name.replace(/\.(md|txt)$/i, ''),
        icon: 'file',
        category: 'custom',
        description: `Imported SKILL.md (${file.name})`,
        instructions: text.slice(0, 2500),
        enabled: true,
      };
      onChangeSkills([imported, ...skills]);
      triggerHaptic(20);
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const handleAddWebhook = () => {
    if (!whName.trim() || !whUrl.trim()) return;
    const item: CustomWebhookConnector = {
      id: `wh-${Date.now()}`,
      name: whName.trim(),
      url: whUrl.trim(),
      method: whMethod,
      description: `${whMethod} MCP / Webhook Bridge`,
      enabled: true,
    };
    onChangeWebhooks([item, ...webhooks]);
    setWhName('');
    setWhUrl('');
    triggerHaptic(20);
  };

  const runQuickPhoneTest = async (
    action: Parameters<typeof executePhoneAction>[0]['action'],
    label: string,
    params: Record<string, string | number>
  ) => {
    triggerHaptic(18);
    const out = await executePhoneAction({ action, label, params });
    setPhoneResult(out);
  };

  return (
    <div className="space-y-4 pb-8">
      {/* Sub-navigation Switcher */}
      <div className="glass-card rounded-2xl p-2 flex flex-wrap gap-1.5">
        <button
          type="button"
          onClick={() => setSubTab('skills')}
          className={`flex-1 py-2 px-3 rounded-xl text-xs sm:text-sm font-bold flex items-center justify-center gap-1.5 transition ${
            subTab === 'skills'
              ? 'bg-teal-500 text-slate-950 shadow'
              : 'text-slate-400 hover:text-white'
          }`}
        >
          <Blocks className={`w-4 h-4 ${subTab === 'skills' ? 'text-slate-950' : 'text-teal-400'}`} />
          Skills ({skills.filter((s) => s.enabled).length})
        </button>

        <button
          type="button"
          onClick={() => setSubTab('connectors')}
          className={`flex-1 py-2 px-3 rounded-xl text-xs sm:text-sm font-bold flex items-center justify-center gap-1.5 transition ${
            subTab === 'connectors'
              ? 'bg-teal-500 text-slate-950 shadow'
              : 'text-slate-400 hover:text-white'
          }`}
        >
          <Plug className={`w-4 h-4 ${subTab === 'connectors' ? 'text-slate-950' : 'text-teal-400'}`} />
          Connectors ({connectors.filter((c) => c.enabled).length + webhooks.filter((w) => w.enabled).length})
        </button>

        <button
          type="button"
          onClick={() => setSubTab('phone')}
          className={`flex-1 py-2 px-3 rounded-xl text-xs sm:text-sm font-bold flex items-center justify-center gap-1.5 transition ${
            subTab === 'phone'
              ? 'bg-teal-500 text-slate-950 shadow'
              : 'text-slate-400 hover:text-white'
          }`}
        >
          <Smartphone className={`w-4 h-4 ${subTab === 'phone' ? 'text-slate-950' : 'text-teal-400'}`} />
          Phone Control Deck
        </button>
      </div>

      {/* TAB 1: MODULAR SKILLS */}
      {subTab === 'skills' && (
        <div className="space-y-3">
          <div className="glass-card rounded-2xl p-4 flex flex-wrap items-center justify-between gap-2">
            <div>
              <h2 className="font-bold text-base text-white">
                Open Brain Modular Skills (SKILL.md Architecture)
              </h2>
              <p className="text-xs text-slate-400">
                Attach specialized skills like Claude, or create and import your own custom skills for free.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <label className="cursor-pointer px-3 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-700 text-xs font-semibold text-teal-300 flex items-center gap-1.5">
                <Upload className="w-3.5 h-3.5 text-teal-400" />
                Import SKILL.md
                <input
                  type="file"
                  accept=".md,.txt"
                  onChange={handleImportSkillMd}
                  className="hidden"
                />
              </label>

              <button
                type="button"
                onClick={() => setShowNewSkill(!showNewSkill)}
                className="px-3.5 py-2 rounded-xl bg-teal-500 hover:bg-teal-400 text-xs font-bold text-slate-950 flex items-center gap-1.5 shadow"
              >
                <Plus className="w-4 h-4" /> New Custom Skill
              </button>
            </div>
          </div>

          {showNewSkill && (
            <div className="glass-card rounded-2xl p-4 border border-teal-500/40 space-y-3">
              <div className="text-sm font-bold text-teal-200 flex items-center gap-1.5">
                <Sparkles className="w-4 h-4 text-teal-400" /> Create Custom Brain Skill
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-4 gap-2">
                <select
                  value={skillIcon}
                  onChange={(e) => setSkillIcon(e.target.value)}
                  className="rounded-xl bg-slate-950 border border-slate-800 px-3 py-2 text-xs text-white"
                >
                  <option value="sparkles">Sparkles Icon</option>
                  <option value="code">Code Icon</option>
                  <option value="microscope">Research Icon</option>
                  <option value="film">Video Icon</option>
                  <option value="smartphone">Phone Icon</option>
                  <option value="globe">Globe Icon</option>
                </select>
                <input
                  type="text"
                  value={skillName}
                  onChange={(e) => setSkillName(e.target.value)}
                  placeholder="Skill Name (e.g., Python Algo Trader / Exam Tutor)"
                  className="sm:col-span-3 rounded-xl bg-slate-950 border border-slate-800 px-3 py-2 text-xs text-white"
                />
              </div>
              <input
                type="text"
                value={skillDesc}
                onChange={(e) => setSkillDesc(e.target.value)}
                placeholder="Short description of when Open Brain should apply this skill..."
                className="w-full rounded-xl bg-slate-950 border border-slate-800 px-3 py-2 text-xs text-white"
              />
              <textarea
                value={skillInstructions}
                onChange={(e) => setSkillInstructions(e.target.value)}
                rows={4}
                placeholder="Write SKILL.md instructions here — or click 'AI Auto-Write Skill' below."
                className="w-full rounded-xl bg-slate-950 border border-slate-800 p-3 text-xs text-slate-100"
              />
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  disabled={!skillName.trim() || generatingSkill}
                  onClick={handleAutoWriteSkill}
                  className="px-3.5 py-2 rounded-xl bg-slate-900 border border-teal-500/40 text-xs font-semibold text-teal-300 flex items-center gap-1.5 disabled:opacity-40"
                >
                  {generatingSkill ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin text-teal-400" />
                  ) : (
                    <Wand2 className="w-3.5 h-3.5 text-teal-400" />
                  )}
                  AI Auto-Write Skill
                </button>
                <button
                  type="button"
                  disabled={!skillName.trim() || !skillInstructions.trim()}
                  onClick={handleSaveSkill}
                  className="px-4 py-2 rounded-xl bg-teal-500 hover:bg-teal-400 text-slate-950 text-xs font-extrabold disabled:opacity-40"
                >
                  Install & Activate Skill
                </button>
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            {skills.map((sk) => (
              <div
                key={sk.id}
                className={`glass-card rounded-2xl p-3.5 transition border ${
                  sk.enabled
                    ? 'border-teal-500/45 bg-teal-950/15'
                    : 'border-slate-800/80 opacity-75'
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2.5">
                    <div className="w-9 h-9 rounded-xl bg-teal-500/15 border border-teal-500/30 flex items-center justify-center shrink-0">
                      <TealVectorIcon name={sk.icon} className="w-4 h-4 text-teal-400" />
                    </div>
                    <div>
                      <div className="text-xs sm:text-sm font-bold text-white">{sk.name}</div>
                      <span className="text-[10px] uppercase tracking-wider text-teal-400 font-mono">
                        {sk.builtIn ? 'BUILT-IN PRO SKILL' : 'CUSTOM SKILL'}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5">
                    {!sk.builtIn && (
                      <button
                        type="button"
                        onClick={() => onChangeSkills(skills.filter((x) => x.id !== sk.id))}
                        className="p-1.5 text-slate-500 hover:text-teal-300"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => toggleSkill(sk.id)}
                      className={`px-3 py-1 rounded-full text-[11px] font-bold transition ${
                        sk.enabled
                          ? 'bg-teal-500/20 text-teal-300 border border-teal-500/40'
                          : 'bg-slate-900 text-slate-400 border border-slate-700'
                      }`}
                    >
                      {sk.enabled ? 'ACTIVE' : 'OFF'}
                    </button>
                  </div>
                </div>
                <p className="text-xs text-slate-300 mt-2">{sk.description}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB 2: APP CONNECTORS */}
      {subTab === 'connectors' && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            {connectors.map((conn) => (
              <div
                key={conn.id}
                className={`glass-card rounded-2xl p-3.5 border transition ${
                  conn.enabled ? 'border-teal-500/45' : 'border-slate-800 opacity-75'
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2.5">
                    <div className="w-9 h-9 rounded-xl bg-teal-500/15 border border-teal-500/30 flex items-center justify-center shrink-0">
                      <TealVectorIcon name={conn.icon} className="w-4 h-4 text-teal-400" />
                    </div>
                    <div>
                      <div className="text-xs sm:text-sm font-bold text-white">{conn.name}</div>
                      <div className="text-[10px] text-teal-400 font-mono">
                        {conn.enabled ? 'CONNECTED (FREE)' : 'DISCONNECTED'}
                      </div>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => toggleConnector(conn.id)}
                    className={`px-3 py-1 rounded-full text-[11px] font-bold ${
                      conn.enabled
                        ? 'bg-teal-500/20 text-teal-300 border border-teal-500/40'
                        : 'bg-slate-900 text-slate-400 border border-slate-700'
                    }`}
                  >
                    {conn.enabled ? 'ON' : 'OFF'}
                  </button>
                </div>
                <p className="text-xs text-slate-400 mt-2">{conn.description}</p>
                {conn.slug === 'github' && conn.enabled && (
                  <input
                    type="password"
                    value={settings.githubToken}
                    onChange={(e) => onUpdateSettings({ githubToken: e.target.value })}
                    placeholder="Optional GitHub PAT (ghp_...) for higher API limits"
                    className="mt-2 w-full rounded-xl bg-slate-950 border border-slate-800 px-2.5 py-1.5 text-[11px] text-white"
                  />
                )}
              </div>
            ))}
          </div>

          {/* Custom MCP / Webhook Connector Builder */}
          <div className="glass-card rounded-2xl p-4 border border-slate-800 space-y-3">
            <div>
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <Link2 className="w-4 h-4 text-teal-400" />
                <span>Add Custom MCP HTTP / Webhook Connector (n8n, Telegram, Slack, Notion, REST API)</span>
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Open Brain Agent can autonomously invoke your custom webhook whenever relevant.
              </p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-2">
              <input
                type="text"
                value={whName}
                onChange={(e) => setWhName(e.target.value)}
                placeholder="Connector Name (e.g. Telegram Bot)"
                className="rounded-xl bg-slate-950 border border-slate-800 px-3 py-2 text-xs text-white"
              />
              <input
                type="url"
                value={whUrl}
                onChange={(e) => setWhUrl(e.target.value)}
                placeholder="https://your-webhook-or-mcp-endpoint..."
                className="sm:col-span-2 rounded-xl bg-slate-950 border border-slate-800 px-3 py-2 text-xs text-white"
              />
              <div className="flex gap-1.5">
                <select
                  value={whMethod}
                  onChange={(e) => setWhMethod(e.target.value as any)}
                  className="rounded-xl bg-slate-900 border border-slate-800 px-2 py-2 text-xs text-white"
                >
                  <option value="POST">POST</option>
                  <option value="GET">GET</option>
                </select>
                <button
                  type="button"
                  onClick={handleAddWebhook}
                  className="flex-1 rounded-xl bg-teal-500 hover:bg-teal-400 text-slate-950 font-bold text-xs px-3"
                >
                  Connect
                </button>
              </div>
            </div>

            {webhooks.length > 0 && (
              <div className="space-y-1.5 pt-1">
                {webhooks.map((w) => (
                  <div
                    key={w.id}
                    className="flex items-center justify-between p-2.5 rounded-xl bg-slate-950 border border-slate-800 text-xs"
                  >
                    <div className="truncate">
                      <span className="font-bold text-teal-300">{w.name}</span>{' '}
                      <span className="text-slate-500">({w.method})</span> —{' '}
                      <span className="text-slate-400">{w.url}</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => onChangeWebhooks(webhooks.filter((x) => x.id !== w.id))}
                      className="text-slate-500 hover:text-teal-300 p-1"
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

      {/* TAB 3: ANDROID PHONE CONTROL DECK */}
      {subTab === 'phone' && (
        <div className="glass-card rounded-2xl p-4 space-y-4">
          <div>
            <h3 className="font-bold text-base text-white flex items-center gap-2">
              <Smartphone className="w-4 h-4 text-teal-400" />
              <span>Open Brain Android Phone Controller</span>
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Ask the Agent in any language to control your phone, or trigger quick hardware actions below.
            </p>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 text-xs">
            <button
              type="button"
              onClick={() => runQuickPhoneTest('battery_status', 'Check Battery', {})}
              className="p-3 rounded-xl bg-slate-950 hover:bg-slate-900 border border-slate-800 text-left"
            >
              <div className="font-bold text-teal-300 flex items-center gap-1.5">
                <BatteryCharging className="w-4 h-4 text-teal-400" />
                <span>Battery & Thermal Status</span>
              </div>
              <div className="text-[11px] text-slate-400 mt-1">Read live phone battery level</div>
            </button>

            <button
              type="button"
              onClick={() =>
                runQuickPhoneTest('set_alarm', 'Set 7:00 AM Alarm', {
                  hour: 7,
                  minute: 0,
                  message: 'Open Brain Morning Alarm',
                })
              }
              className="p-3 rounded-xl bg-slate-950 hover:bg-slate-900 border border-slate-800 text-left"
            >
              <div className="font-bold text-teal-300 flex items-center gap-1.5">
                <AlarmClock className="w-4 h-4 text-teal-400" />
                <span>Set 7:00 AM Alarm</span>
              </div>
              <div className="text-[11px] text-slate-400 mt-1">Native Android Clock intent</div>
            </button>

            <button
              type="button"
              onClick={() =>
                runQuickPhoneTest('set_timer', '5 Min Focus Timer', {
                  seconds: 300,
                  message: 'Open Brain Focus',
                })
              }
              className="p-3 rounded-xl bg-slate-950 hover:bg-slate-900 border border-slate-800 text-left"
            >
              <div className="font-bold text-teal-300 flex items-center gap-1.5">
                <Timer className="w-4 h-4 text-teal-400" />
                <span>Start 5-Min Timer</span>
              </div>
              <div className="text-[11px] text-slate-400 mt-1">Native countdown timer</div>
            </button>

            <button
              type="button"
              onClick={() =>
                runQuickPhoneTest('send_whatsapp', 'Quick WhatsApp Share', {
                  phone: '',
                  message: 'Sent from my Open Brain AI Super-Agent.',
                })
              }
              className="p-3 rounded-xl bg-slate-950 hover:bg-slate-900 border border-slate-800 text-left"
            >
              <div className="font-bold text-teal-300 flex items-center gap-1.5">
                <MessageSquare className="w-4 h-4 text-teal-400" />
                <span>Launch WhatsApp Msg</span>
              </div>
              <div className="text-[11px] text-slate-400 mt-1">Pre-fills WhatsApp message</div>
            </button>

            <button
              type="button"
              onClick={() =>
                runQuickPhoneTest('open_maps', 'Open Google Maps', {
                  query: 'Restaurants near me',
                })
              }
              className="p-3 rounded-xl bg-slate-950 hover:bg-slate-900 border border-slate-800 text-left"
            >
              <div className="font-bold text-teal-300 flex items-center gap-1.5">
                <MapPin className="w-4 h-4 text-teal-400" />
                <span>Google Maps Search</span>
              </div>
              <div className="text-[11px] text-slate-400 mt-1">Opens native Maps navigation</div>
            </button>

            <button
              type="button"
              onClick={() =>
                runQuickPhoneTest('open_settings', 'Wi-Fi Settings', {
                  section: 'wifi',
                })
              }
              className="p-3 rounded-xl bg-slate-950 hover:bg-slate-900 border border-slate-800 text-left"
            >
              <div className="font-bold text-teal-300 flex items-center gap-1.5">
                <Settings className="w-4 h-4 text-teal-400" />
                <span>Phone Wi-Fi Settings</span>
              </div>
              <div className="text-[11px] text-slate-400 mt-1">Opens Android system panel</div>
            </button>
          </div>

          {phoneResult && (
            <div className="p-3 rounded-xl bg-teal-950/30 border border-teal-500/40 text-xs text-teal-200 flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-teal-400 shrink-0" />
              <span>{phoneResult}</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

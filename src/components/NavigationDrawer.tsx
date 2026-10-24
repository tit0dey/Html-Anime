import React, { useState } from 'react';
import {
  Folder,
  Laptop,
  MoreHorizontal,
  Pin,
  Plus,
  Search,
  Trash2,
  X,
} from 'lucide-react';
import { ConversationProject, ConversationThread } from '../types';
import { OpenBrainLogo } from './OpenBrainLogo';

interface Props {
  open: boolean;
  userName: string;
  threads: ConversationThread[];
  activeThreadId: string;
  projects: ConversationProject[];
  activeProjectId?: string;
  assetsCount: number;
  onClose: () => void;
  onNewChat: (projectId?: string) => void;
  onSelectThread: (threadId: string) => void;
  onTogglePinThread: (threadId: string) => void;
  onDeleteThread: (threadId: string) => void;
  onCreateProject: (name: string, instructions: string) => void;
  onSelectProject: (projectId?: string) => void;
  onOpenPhoneControl: () => void;
  onOpenAssets: () => void;
  onOpenSkillsMore: () => void;
  onOpenProfileSettings: () => void;
}

export const NavigationDrawer: React.FC<Props> = ({
  open,
  userName,
  threads,
  activeThreadId,
  projects,
  activeProjectId,
  assetsCount,
  onClose,
  onNewChat,
  onSelectThread,
  onTogglePinThread,
  onDeleteThread,
  onCreateProject,
  onSelectProject,
  onOpenPhoneControl,
  onOpenAssets,
  onOpenSkillsMore,
  onOpenProfileSettings,
}) => {
  const [searchOpen, setSearchOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [creatingProject, setCreatingProject] = useState(false);
  const [projName, setProjName] = useState('');
  const [projInstr, setProjInstr] = useState('');

  if (!open) return null;

  const filtered = threads.filter((t) => {
    if (!query.trim()) return true;
    const q = query.toLowerCase();
    return (
      t.title.toLowerCase().includes(q) ||
      t.messages.some((m) => m.content.toLowerCase().includes(q))
    );
  });

  const pinnedThreads = filtered.filter((t) => t.pinned);
  const recentThreads = filtered.filter((t) => !t.pinned);

  const initials =
    userName
      .trim()
      .split(/\s+/)
      .map((w) => w[0])
      .join('')
      .slice(0, 2)
      .toUpperCase() || 'OB';

  return (
    <div className="fixed inset-0 z-50 flex bg-black/40" onClick={onClose}>
      <aside
        className="w-[85vw] max-w-[336px] h-full bg-white dark:bg-[#11151D] flex flex-col justify-between pt-[calc(0.85rem+env(safe-area-inset-top,0px))] pb-[calc(0.9rem+env(safe-area-inset-bottom,0px))] px-4 shadow-2xl animate-drawer-right border-r border-slate-200/80 dark:border-slate-800"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top Header Row */}
        <div className="flex-1 min-h-0 flex flex-col">
          <div className="flex items-center justify-between mb-4 px-1">
            <OpenBrainLogo className="w-8 h-8 text-slate-900 dark:text-white" />
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setSearchOpen((v) => !v)}
                className="p-2 rounded-full text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
                aria-label="Search conversations"
              >
                <Search className="w-5 h-5 stroke-[1.75]" />
              </button>
              <button
                type="button"
                onClick={onClose}
                className="p-2 rounded-full text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
                aria-label="Collapse menu"
              >
                <svg
                  viewBox="0 0 24 24"
                  className="w-5 h-5"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.9"
                  strokeLinecap="round"
                >
                  <line x1="4" y1="8" x2="20" y2="8" />
                  <line x1="9" y1="15" x2="20" y2="15" />
                </svg>
              </button>
            </div>
          </div>

          {searchOpen && (
            <div className="mb-3 relative">
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search conversations..."
                autoFocus
                className="w-full rounded-xl bg-[#F4F5F7] dark:bg-[#1B202C] px-3.5 py-2 text-sm text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none"
              />
              {query && (
                <button
                  type="button"
                  onClick={() => setQuery('')}
                  className="absolute right-2.5 top-2 text-slate-400"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
          )}

          {/* Primary Menu Actions (Exact MiniMax Layout) */}
          <div className="space-y-1 mb-5">
            <button
              type="button"
              onClick={() => {
                onClose();
                onOpenPhoneControl();
              }}
              className="w-full flex items-center gap-3.5 px-2 py-2.5 rounded-xl text-[15px] font-medium text-slate-900 dark:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800/70 transition"
            >
              <Laptop className="w-5 h-5 stroke-[1.75] text-slate-800 dark:text-slate-200" />
              <span>Phone Control</span>
            </button>

            <button
              type="button"
              onClick={() => {
                onClose();
                onOpenAssets();
              }}
              className="w-full flex items-center justify-between px-2 py-2.5 rounded-xl text-[15px] font-medium text-slate-900 dark:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800/70 transition"
            >
              <span className="flex items-center gap-3.5">
                <Folder className="w-5 h-5 stroke-[1.75] text-slate-800 dark:text-slate-200" />
                <span>Assets</span>
              </span>
              {assetsCount > 0 && (
                <span className="text-xs px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                  {assetsCount}
                </span>
              )}
            </button>

            <button
              type="button"
              onClick={() => {
                onClose();
                onOpenSkillsMore();
              }}
              className="w-full flex items-center gap-3.5 px-2 py-2.5 rounded-xl text-[15px] font-medium text-slate-900 dark:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800/70 transition"
            >
              <MoreHorizontal className="w-5 h-5 stroke-[1.75] text-slate-800 dark:text-slate-200" />
              <span>Skills & More</span>
            </button>
          </div>

          {/* Scrollable Pinned / Projects / Recents */}
          <div className="flex-1 overflow-y-auto space-y-4 pr-0.5">
            {/* Pinned */}
            <div>
              <div className="px-2 text-[13px] font-medium text-slate-400 dark:text-slate-500 mb-1">
                Pinned
              </div>
              {pinnedThreads.length > 0 && (
                <div className="space-y-0.5">
                  {pinnedThreads.map((t) => (
                    <div
                      key={t.id}
                      className={`group flex items-center justify-between px-2 py-2 rounded-xl cursor-pointer ${
                        t.id === activeThreadId
                          ? 'bg-slate-100 dark:bg-slate-800/80'
                          : 'hover:bg-slate-50 dark:hover:bg-slate-800/40'
                      }`}
                      onClick={() => {
                        onSelectThread(t.id);
                        onClose();
                      }}
                    >
                      <span className="text-[14.5px] font-medium text-slate-900 dark:text-slate-100 truncate pr-2">
                        {t.title}
                      </span>
                      <button
                        type="button"
                        onClick={(ev) => {
                          ev.stopPropagation();
                          onTogglePinThread(t.id);
                        }}
                        className="p-1 text-slate-400 hover:text-slate-700 dark:hover:text-white"
                        title="Unpin"
                      >
                        <Pin className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Projects */}
            <div>
              <div className="px-2 flex items-center justify-between text-[13px] font-medium text-slate-400 dark:text-slate-500 mb-1">
                <span>Projects</span>
                <button
                  type="button"
                  onClick={() => setCreatingProject((v) => !v)}
                  className="p-0.5 text-slate-400 hover:text-slate-700 dark:hover:text-white"
                  aria-label="New project"
                >
                  <Plus className="w-4 h-4" />
                </button>
              </div>

              {creatingProject && (
                <div className="mx-1 mb-2 p-2.5 rounded-xl bg-[#F5F6F8] dark:bg-[#1B202C] space-y-2">
                  <input
                    type="text"
                    value={projName}
                    onChange={(e) => setProjName(e.target.value)}
                    placeholder="Project name"
                    className="w-full rounded-lg bg-white dark:bg-[#11151D] px-2.5 py-1.5 text-xs text-slate-900 dark:text-white focus:outline-none"
                  />
                  <input
                    type="text"
                    value={projInstr}
                    onChange={(e) => setProjInstr(e.target.value)}
                    placeholder="Custom instructions (optional)"
                    className="w-full rounded-lg bg-white dark:bg-[#11151D] px-2.5 py-1.5 text-xs text-slate-900 dark:text-white focus:outline-none"
                  />
                  <div className="flex justify-end gap-1.5">
                    <button
                      type="button"
                      onClick={() => setCreatingProject(false)}
                      className="px-2.5 py-1 text-xs text-slate-500"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        if (!projName.trim()) return;
                        onCreateProject(projName.trim(), projInstr.trim());
                        setProjName('');
                        setProjInstr('');
                        setCreatingProject(false);
                      }}
                      className="px-3 py-1 rounded-lg bg-slate-900 dark:bg-white text-white dark:text-slate-950 text-xs font-semibold"
                    >
                      Save
                    </button>
                  </div>
                </div>
              )}

              {projects.length > 0 && (
                <div className="space-y-0.5">
                  {projects.map((p) => {
                    const active = activeProjectId === p.id;
                    return (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => {
                          onSelectProject(active ? undefined : p.id);
                          onNewChat(active ? undefined : p.id);
                          onClose();
                        }}
                        className={`w-full text-left px-2 py-1.5 rounded-xl text-[14px] font-medium truncate ${
                          active
                            ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-950'
                            : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800/50'
                        }`}
                      >
                        {p.name}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Recents */}
            <div>
              <div className="px-2 text-[13px] font-medium text-slate-400 dark:text-slate-500 mb-1.5">
                Recents
              </div>
              {recentThreads.length === 0 ? (
                <p className="px-2 text-[13px] text-slate-400 dark:text-slate-500">
                  Your conversations appear here automatically.
                </p>
              ) : (
                <div className="space-y-0.5">
                  {recentThreads.map((t) => (
                    <div
                      key={t.id}
                      onClick={() => {
                        onSelectThread(t.id);
                        onClose();
                      }}
                      className={`group flex items-center justify-between px-2 py-2.5 rounded-xl cursor-pointer transition ${
                        t.id === activeThreadId
                          ? 'bg-slate-100 dark:bg-slate-800/80'
                          : 'hover:bg-slate-50 dark:hover:bg-slate-800/40'
                      }`}
                    >
                      <span className="text-[15px] font-medium text-slate-900 dark:text-slate-100 truncate pr-2">
                        {t.title}
                      </span>
                      <div className="flex items-center gap-0.5 opacity-60 group-hover:opacity-100 shrink-0">
                        <button
                          type="button"
                          onClick={(ev) => {
                            ev.stopPropagation();
                            onTogglePinThread(t.id);
                          }}
                          className="p-1 text-slate-400 hover:text-slate-800 dark:hover:text-white"
                          title="Pin"
                        >
                          <Pin className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={(ev) => {
                            ev.stopPropagation();
                            onDeleteThread(t.id);
                          }}
                          className="p-1 text-slate-400 hover:text-red-500"
                          title="Delete"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Sticky Footer Bar (User Profile Left + Solid "+ Chat" Pill Right) */}
        <div className="pt-3 mt-2 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-between gap-2">
          <button
            type="button"
            onClick={() => {
              onClose();
              onOpenProfileSettings();
            }}
            className="flex items-center gap-2.5 min-w-0 py-1 px-1 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800/60 transition"
          >
            <div className="w-8 h-8 rounded-full bg-slate-900 dark:bg-white text-white dark:text-slate-950 flex items-center justify-center text-xs font-bold shrink-0">
              {initials}
            </div>
            <span className="text-[14px] font-semibold text-slate-900 dark:text-white truncate uppercase tracking-wide">
              {userName}
            </span>
          </button>

          <button
            type="button"
            onClick={() => {
              onNewChat();
              onClose();
            }}
            className="shrink-0 flex items-center gap-1.5 px-4 py-2.5 rounded-full bg-[#111827] dark:bg-white text-white dark:text-slate-950 text-[14px] font-semibold shadow-sm hover:opacity-90 transition"
          >
            <span className="w-4 h-4 rounded-full bg-white dark:bg-slate-950 text-slate-950 dark:text-white flex items-center justify-center">
              <Plus className="w-3 h-3 stroke-[2.8]" />
            </span>
            <span>Chat</span>
          </button>
        </div>
      </aside>
    </div>
  );
};

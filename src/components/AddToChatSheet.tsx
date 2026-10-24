import React from 'react';
import {
  AudioWaveform,
  Blocks,
  Brain,
  Camera,
  Check,
  ChevronRight,
  Clapperboard,
  Code2,
  Compass,
  Image as ImageIcon,
  Paperclip,
  Smartphone,
  Sparkles,
} from 'lucide-react';

interface Props {
  open: boolean;
  deepResearchActive: boolean;
  memoriesCount: number;
  activeSkillsCount: number;
  activeConnectorsCount: number;
  activeVoiceName?: string;
  onClose: () => void;
  onToggleDeepResearch: () => void;
  onPickGalleryImage: () => void;
  onPickCameraPhoto: () => void;
  onPickFileOrAudio: () => void;
  onOpenSkillsModal: () => void;
  onOpenMemoryModal: () => void;
  onOpenVoiceLabModal: () => void;
  onOpenPhoneModal: () => void;
  onQuickPrompt: (prompt: string) => void;
}

export const AddToChatSheet: React.FC<Props> = ({
  open,
  deepResearchActive,
  memoriesCount,
  activeSkillsCount,
  activeConnectorsCount,
  activeVoiceName,
  onClose,
  onToggleDeepResearch,
  onPickGalleryImage,
  onPickCameraPhoto,
  onPickFileOrAudio,
  onOpenSkillsModal,
  onOpenMemoryModal,
  onOpenVoiceLabModal,
  onOpenPhoneModal,
  onQuickPrompt,
}) => {
  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 bg-black/45 flex items-end justify-center"
      onClick={onClose}
    >
      <div
        className="w-full max-w-xl bg-white dark:bg-[#141821] rounded-t-[28px] pt-2.5 pb-[calc(1.35rem+env(safe-area-inset-bottom,0px))] px-5 shadow-2xl animate-sheet-up border-t border-slate-200/80 dark:border-slate-800 max-h-[85vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="w-10 h-1 rounded-full bg-slate-200 dark:bg-slate-700 mx-auto mb-3.5" />

        <h3 className="text-center text-[16px] font-semibold text-slate-900 dark:text-white mb-4">
          Add to Chat
        </h3>

        {/* Top 3 Media Attachment Tiles (Exact MiniMax Layout) */}
        <div className="grid grid-cols-3 gap-3 mb-4">
          <button
            type="button"
            onClick={() => {
              onClose();
              onPickGalleryImage();
            }}
            className="flex flex-col items-center justify-center gap-2 py-5 rounded-2xl bg-[#F5F6F8] dark:bg-[#1E2430] hover:bg-slate-200/70 dark:hover:bg-slate-800 transition"
          >
            <ImageIcon className="w-6 h-6 text-slate-800 dark:text-slate-100 stroke-[1.75]" />
            <span className="text-[13px] font-medium text-slate-800 dark:text-slate-200">
              Image
            </span>
          </button>

          <button
            type="button"
            onClick={() => {
              onClose();
              onPickCameraPhoto();
            }}
            className="flex flex-col items-center justify-center gap-2 py-5 rounded-2xl bg-[#F5F6F8] dark:bg-[#1E2430] hover:bg-slate-200/70 dark:hover:bg-slate-800 transition"
          >
            <Camera className="w-6 h-6 text-slate-800 dark:text-slate-100 stroke-[1.75]" />
            <span className="text-[13px] font-medium text-slate-800 dark:text-slate-200">
              Camera
            </span>
          </button>

          <button
            type="button"
            onClick={() => {
              onClose();
              onPickFileOrAudio();
            }}
            className="flex flex-col items-center justify-center gap-2 py-5 rounded-2xl bg-[#F5F6F8] dark:bg-[#1E2430] hover:bg-slate-200/70 dark:hover:bg-slate-800 transition"
          >
            <Paperclip className="w-6 h-6 text-slate-800 dark:text-slate-100 stroke-[1.75]" />
            <span className="text-[13px] font-medium text-slate-800 dark:text-slate-200">
              File
            </span>
          </button>
        </div>

        {/* Agent Capabilities & Intelligence Modules */}
        <div className="divide-y divide-slate-100 dark:divide-slate-800/70">
          {/* Deep Research Mode Toggle */}
          <button
            type="button"
            onClick={() => {
              onToggleDeepResearch();
              onClose();
            }}
            className="w-full py-3.5 flex items-center justify-between text-left"
          >
            <div className="flex items-center gap-3">
              <Compass className="w-5 h-5 text-slate-800 dark:text-slate-200 stroke-[1.75]" />
              <div>
                <div className="text-[15px] font-medium text-slate-900 dark:text-white">
                  Deep Research
                </div>
                <div className="text-[11px] text-slate-500 dark:text-slate-400">
                  Multi-wave parallel scan across Web, Wiki, GitHub, HN & Papers
                </div>
              </div>
            </div>
            {deepResearchActive ? (
              <span className="w-6 h-6 rounded-full bg-slate-900 dark:bg-teal-400 text-white dark:text-slate-950 flex items-center justify-center">
                <Check className="w-3.5 h-3.5 stroke-[2.6]" />
              </span>
            ) : (
              <ChevronRight className="w-4 h-4 text-slate-400" />
            )}
          </button>

          {/* Skills & Connectors */}
          <button
            type="button"
            onClick={() => {
              onClose();
              onOpenSkillsModal();
            }}
            className="w-full py-3.5 flex items-center justify-between text-left"
          >
            <div className="flex items-center gap-3">
              <Blocks className="w-5 h-5 text-slate-800 dark:text-slate-200 stroke-[1.75]" />
              <div>
                <div className="text-[15px] font-medium text-slate-900 dark:text-white">
                  Skills & Connectors
                </div>
                <div className="text-[11px] text-slate-500 dark:text-slate-400">
                  {activeSkillsCount} Skills · {activeConnectorsCount} Live Connectors active
                </div>
              </div>
            </div>
            <ChevronRight className="w-4 h-4 text-slate-400" />
          </button>

          {/* Permanent Personal Memory */}
          <button
            type="button"
            onClick={() => {
              onClose();
              onOpenMemoryModal();
            }}
            className="w-full py-3.5 flex items-center justify-between text-left"
          >
            <div className="flex items-center gap-3">
              <Brain className="w-5 h-5 text-slate-800 dark:text-slate-200 stroke-[1.75]" />
              <div>
                <div className="text-[15px] font-medium text-slate-900 dark:text-white">
                  Personal Memory
                </div>
                <div className="text-[11px] text-slate-500 dark:text-slate-400">
                  {memoriesCount} permanent facts & preferences remembered
                </div>
              </div>
            </div>
            <ChevronRight className="w-4 h-4 text-slate-400" />
          </button>

          {/* Voice Cloning Lab */}
          <button
            type="button"
            onClick={() => {
              onClose();
              onOpenVoiceLabModal();
            }}
            className="w-full py-3.5 flex items-center justify-between text-left"
          >
            <div className="flex items-center gap-3">
              <AudioWaveform className="w-5 h-5 text-slate-800 dark:text-slate-200 stroke-[1.75]" />
              <div>
                <div className="text-[15px] font-medium text-slate-900 dark:text-white">
                  Voice Cloning Lab
                </div>
                <div className="text-[11px] text-slate-500 dark:text-slate-400">
                  {activeVoiceName
                    ? `Active voice: ${activeVoiceName} (Auto-used in chat)`
                    : 'Record 6-12s voice sample or auto-speak in chat'}
                </div>
              </div>
            </div>
            <ChevronRight className="w-4 h-4 text-slate-400" />
          </button>

          {/* Phone OS Control */}
          <button
            type="button"
            onClick={() => {
              onClose();
              onOpenPhoneModal();
            }}
            className="w-full py-3.5 flex items-center justify-between text-left"
          >
            <div className="flex items-center gap-3">
              <Smartphone className="w-5 h-5 text-slate-800 dark:text-slate-200 stroke-[1.75]" />
              <div>
                <div className="text-[15px] font-medium text-slate-900 dark:text-white">
                  Phone OS Control
                </div>
                <div className="text-[11px] text-slate-500 dark:text-slate-400">
                  Alarms, Timers, WhatsApp, Calls, Maps, Settings & Battery
                </div>
              </div>
            </div>
            <ChevronRight className="w-4 h-4 text-slate-400" />
          </button>
        </div>

        {/* Auto-Triggered Quick Starters */}
        <div className="pt-3 mt-1 border-t border-slate-100 dark:border-slate-800/70">
          <div className="text-[11px] font-medium text-slate-400 dark:text-slate-500 mb-2">
            Auto-triggered directly in chat whenever you ask:
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => {
                onClose();
                onQuickPrompt('Make an animated MP4 video explaining ');
              }}
              className="px-3 py-1.5 rounded-full bg-[#F5F6F8] dark:bg-[#1E2430] text-[12px] font-medium text-slate-700 dark:text-slate-200 flex items-center gap-1.5"
            >
              <Clapperboard className="w-3.5 h-3.5" /> MP4 Video
            </button>
            <button
              type="button"
              onClick={() => {
                onClose();
                onQuickPrompt('Generate an HD image of ');
              }}
              className="px-3 py-1.5 rounded-full bg-[#F5F6F8] dark:bg-[#1E2430] text-[12px] font-medium text-slate-700 dark:text-slate-200 flex items-center gap-1.5"
            >
              <Sparkles className="w-3.5 h-3.5" /> HD Image
            </button>
            <button
              type="button"
              onClick={() => {
                onClose();
                onQuickPrompt('Build an interactive web app for ');
              }}
              className="px-3 py-1.5 rounded-full bg-[#F5F6F8] dark:bg-[#1E2430] text-[12px] font-medium text-slate-700 dark:text-slate-200 flex items-center gap-1.5"
            >
              <Code2 className="w-3.5 h-3.5" /> Live App
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

import React, { useState } from 'react';
import { Check, ChevronRight, X } from 'lucide-react';
import { FREE_LLM_MODELS } from '../services/llmEngine';
import { ReasoningEffort } from '../types';

interface Props {
  open: boolean;
  selectedModel: string;
  effort: ReasoningEffort;
  onSelectModel: (modelId: string) => void;
  onSelectEffort: (effort: ReasoningEffort) => void;
  onClose: () => void;
}

const EFFORT_OPTIONS: Array<{ id: ReasoningEffort; label: string; desc: string }> = [
  { id: 'fast', label: 'Fast', desc: 'Instant low-latency replies' },
  { id: 'default', label: 'Default', desc: 'Balanced speed & intelligence' },
  { id: 'high', label: 'High', desc: 'Deep chain-of-thought verification' },
  { id: 'max', label: 'Max', desc: 'Parallel Mixture-of-Agents Council' },
];

export const SelectModelSheet: React.FC<Props> = ({
  open,
  selectedModel,
  effort,
  onSelectModel,
  onSelectEffort,
  onClose,
}) => {
  const [showEffortPicker, setShowEffortPicker] = useState(false);

  if (!open) return null;

  const currentEffortLabel =
    EFFORT_OPTIONS.find((e) => e.id === effort)?.label || 'Default';

  return (
    <div
      className="fixed inset-0 z-50 bg-black/45 flex items-end justify-center"
      onClick={onClose}
    >
      <div
        className="w-full max-w-xl bg-white dark:bg-[#141821] rounded-t-[28px] pt-2.5 pb-[calc(1.25rem+env(safe-area-inset-bottom,0px))] px-5 shadow-2xl animate-sheet-up border-t border-slate-200/80 dark:border-slate-800"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="w-10 h-1 rounded-full bg-slate-200 dark:bg-slate-700 mx-auto mb-3" />

        <div className="relative flex items-center justify-center pb-3">
          <button
            type="button"
            onClick={onClose}
            className="absolute left-0 p-1.5 rounded-full text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
          <h3 className="text-[16px] font-semibold text-slate-900 dark:text-white">
            {showEffortPicker ? 'Reasoning Effort' : 'Select Model'}
          </h3>
        </div>

        {!showEffortPicker ? (
          <>
            <div className="divide-y divide-slate-100 dark:divide-slate-800/70 max-h-[54vh] overflow-y-auto">
              {FREE_LLM_MODELS.map((model) => {
                const active = selectedModel === model.id;
                return (
                  <button
                    key={model.id}
                    type="button"
                    onClick={() => {
                      onSelectModel(model.id);
                      onClose();
                    }}
                    className="w-full py-3.5 flex items-center justify-between gap-3 text-left hover:opacity-85 transition"
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-[15px] font-medium text-slate-900 dark:text-slate-100">
                          {model.name}
                        </span>
                        <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                          Free
                        </span>
                      </div>
                      <p className="text-[12px] text-slate-500 dark:text-slate-400 truncate mt-0.5">
                        {model.description}
                      </p>
                    </div>
                    {active && (
                      <Check className="w-5 h-5 text-slate-900 dark:text-teal-400 shrink-0" />
                    )}
                  </button>
                );
              })}
            </div>

            <div className="mt-2 pt-3 border-t border-slate-100 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setShowEffortPicker(true)}
                className="w-full py-2 flex items-center justify-between text-[15px]"
              >
                <span className="font-medium text-slate-900 dark:text-slate-100">
                  Effort
                </span>
                <span className="flex items-center gap-1 text-slate-500 dark:text-slate-400">
                  {currentEffortLabel}
                  <ChevronRight className="w-4 h-4" />
                </span>
              </button>
            </div>
          </>
        ) : (
          <div className="space-y-1 pt-1">
            {EFFORT_OPTIONS.map((opt) => {
              const active = effort === opt.id;
              return (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => {
                    onSelectEffort(opt.id);
                    setShowEffortPicker(false);
                  }}
                  className="w-full py-3.5 flex items-center justify-between gap-3 text-left border-b border-slate-100 dark:border-slate-800/70 last:border-0"
                >
                  <div>
                    <div className="text-[15px] font-medium text-slate-900 dark:text-white">
                      {opt.label}
                    </div>
                    <div className="text-[12px] text-slate-500 dark:text-slate-400">
                      {opt.desc}
                    </div>
                  </div>
                  {active && (
                    <Check className="w-5 h-5 text-slate-900 dark:text-teal-400 shrink-0" />
                  )}
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

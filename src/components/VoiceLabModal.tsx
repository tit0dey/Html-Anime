import React, { useState } from 'react';
import {
  AudioWaveform,
  Download,
  Loader2,
  Trash2,
  Volume2,
  X,
} from 'lucide-react';
import { AppSettings, SynthesizedClip, VoiceProfile } from '../types';
import { synthesizeClonedVoice } from '../services/voiceCloneEngine';
import { saveFileCrossPlatform } from '../services/nativeBridge';
import { InlineVoiceRecorderCard } from './InlineVoiceRecorderCard';

interface Props {
  open: boolean;
  settings: AppSettings;
  profiles: VoiceProfile[];
  onSaveProfile: (profile: VoiceProfile) => void;
  onDeleteProfile: (id: string) => void;
  onSelectProfile: (id: string) => void;
  onGeneratedClip: (clip: SynthesizedClip) => void;
  onClose: () => void;
}

export const VoiceLabModal: React.FC<Props> = ({
  open,
  settings,
  profiles,
  onSaveProfile,
  onDeleteProfile,
  onSelectProfile,
  onGeneratedClip,
  onClose,
}) => {
  const [testScript, setTestScript] = useState(
    'Hello! This is my cloned voice running inside Open Brain.'
  );
  const [synthesizing, setSynthesizing] = useState(false);
  const [previewClip, setPreviewClip] = useState<SynthesizedClip | null>(null);

  if (!open) return null;

  const activeProfile =
    profiles.find((p) => p.id === settings.activeVoiceProfileId) ||
    profiles[0] ||
    null;

  const handleTestSpeak = async () => {
    if (!testScript.trim() || synthesizing) return;
    setSynthesizing(true);
    try {
      const out = await synthesizeClonedVoice({
        text: testScript,
        profile: activeProfile,
        presetVoice: 'onyx',
        tryZeroShotNeural: true,
        hfToken: settings.hfToken,
      });
      const clip: SynthesizedClip = {
        id: `vc-${Date.now()}`,
        text: testScript,
        voiceName: activeProfile ? activeProfile.name : 'Studio Onyx Neural',
        engineUsed: out.engineUsed,
        audioUrl: out.url,
        createdAt: Date.now(),
      };
      setPreviewClip(clip);
      onGeneratedClip(clip);
    } catch (err: any) {
      alert(`Voice synthesis error: ${err?.message || String(err)}`);
    } finally {
      setSynthesizing(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-[#F5F6F8] dark:bg-[#0B0E14] overflow-y-auto animate-sheet-up">
      <div className="max-w-xl mx-auto px-4 pt-[calc(0.9rem+env(safe-area-inset-top,0px))] pb-[calc(2rem+env(safe-area-inset-bottom,0px))] space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <AudioWaveform className="w-5 h-5 text-slate-900 dark:text-white" />
            <h2 className="text-lg font-bold text-slate-900 dark:text-white">
              Voice Cloning Lab
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

        <p className="text-xs text-slate-500 dark:text-slate-400">
          Record a 6–12s voice sample or upload an audio clip. Once saved, Open Brain automatically uses your active cloned voice whenever you ask it to speak or narrate in chat.
        </p>

        <InlineVoiceRecorderCard
          profiles={profiles}
          activeProfileId={activeProfile?.id || ''}
          onSaveProfile={onSaveProfile}
          onSelectProfile={onSelectProfile}
        />

        {profiles.length > 0 && (
          <div className="rounded-2xl bg-white dark:bg-[#141821] p-4 space-y-2 border border-slate-200/80 dark:border-slate-800">
            <div className="text-xs font-semibold text-slate-900 dark:text-white">
              Saved Voice Clones ({profiles.length})
            </div>
            {profiles.map((p) => (
              <div
                key={p.id}
                className="p-2.5 rounded-xl bg-[#F5F6F8] dark:bg-[#0E121A] flex items-center justify-between gap-2 text-xs"
              >
                <div className="min-w-0">
                  <div className="font-semibold text-slate-900 dark:text-white truncate">
                    {p.name} ({p.durationSec}s · {p.biometrics.pitchHz}Hz)
                  </div>
                  <audio src={p.audioDataUrl} controls className="h-7 w-48 mt-1" />
                </div>
                <button
                  type="button"
                  onClick={() => onDeleteProfile(p.id)}
                  className="p-1.5 text-slate-400 hover:text-red-500"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Instant Test Card */}
        <div className="rounded-2xl bg-white dark:bg-[#141821] p-4 space-y-3 border border-slate-200/80 dark:border-slate-800">
          <div className="text-xs font-semibold text-slate-900 dark:text-white">
            Test Speech Synthesis ({activeProfile ? activeProfile.name : 'Studio Onyx'})
          </div>
          <textarea
            value={testScript}
            onChange={(e) => setTestScript(e.target.value)}
            rows={2}
            className="w-full rounded-xl bg-[#F5F6F8] dark:bg-[#0E121A] p-3 text-xs text-slate-900 dark:text-white focus:outline-none"
          />
          <button
            type="button"
            disabled={!testScript.trim() || synthesizing}
            onClick={handleTestSpeak}
            className="w-full py-2.5 rounded-xl bg-slate-900 dark:bg-white text-white dark:text-slate-950 text-xs font-semibold flex items-center justify-center gap-2 disabled:opacity-40"
          >
            {synthesizing ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" /> Synthesizing...
              </>
            ) : (
              <>
                <Volume2 className="w-4 h-4" /> Speak Now
              </>
            )}
          </button>

          {previewClip && (
            <div className="p-3 rounded-xl bg-[#F5F6F8] dark:bg-[#0E121A] space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-slate-800 dark:text-slate-200">
                  {previewClip.voiceName}
                </span>
                <button
                  type="button"
                  onClick={() =>
                    saveFileCrossPlatform(
                      previewClip.audioUrl,
                      `OpenBrainVoice-${previewClip.id}.wav`,
                      'audio/wav'
                    )
                  }
                  className="flex items-center gap-1 text-xs font-semibold text-slate-900 dark:text-teal-400"
                >
                  <Download className="w-3.5 h-3.5" /> Save WAV
                </button>
              </div>
              <audio src={previewClip.audioUrl} controls autoPlay className="w-full h-8" />
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

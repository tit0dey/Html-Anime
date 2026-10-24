import React, { useEffect, useRef, useState } from 'react';
import {
  Activity,
  AudioWaveform,
  CheckCircle2,
  Download,
  Loader2,
  Mic,
  Square,
  Trash2,
  Upload,
  Volume2,
} from 'lucide-react';
import { AppSettings, SynthesizedClip, VoiceProfile } from '../types';
import {
  analyzeVocalBiometrics,
  synthesizeClonedVoice,
} from '../services/voiceCloneEngine';
import {
  saveFileCrossPlatform,
  speakWithDeviceFallback,
  triggerHaptic,
} from '../services/nativeBridge';

interface Props {
  settings: AppSettings;
}

const STUDIO_VOICES: Array<{
  id: 'alloy' | 'echo' | 'fable' | 'onyx' | 'nova' | 'shimmer';
  label: string;
  desc: string;
}> = [
  { id: 'onyx', label: 'Onyx', desc: 'Deep Cinematic Male' },
  { id: 'nova', label: 'Nova', desc: 'Bright Natural Female' },
  { id: 'alloy', label: 'Alloy', desc: 'Crisp Balanced Studio' },
  { id: 'echo', label: 'Echo', desc: 'Warm Conversational' },
  { id: 'fable', label: 'Fable', desc: 'Expressive Storyteller' },
  { id: 'shimmer', label: 'Shimmer', desc: 'Soft Melodic Alto' },
];

export const VoiceCloneStudio: React.FC<Props> = ({ settings }) => {
  const [profiles, setProfiles] = useState<VoiceProfile[]>(() => {
    try {
      const saved = localStorage.getItem('openbrain_voice_profiles_v2');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });
  const [selectedProfileId, setSelectedProfileId] = useState<string>('');
  const [presetVoice, setPresetVoice] = useState<'alloy' | 'echo' | 'fable' | 'onyx' | 'nova' | 'shimmer'>('onyx');
  const [voiceName, setVoiceName] = useState('My Cloned Voice');
  const [refTranscript, setRefTranscript] = useState(
    'Hello, this is my natural speaking voice sample for Open Brain voice cloning.'
  );
  const [isRecording, setIsRecording] = useState(false);
  const [recordSeconds, setRecordSeconds] = useState(0);
  const [analyzing, setAnalyzing] = useState(false);

  const [ttsText, setTtsText] = useState(
    'Welcome to Open Brain. You can generate unlimited studio narration or clone your own voice directly on your phone for free.'
  );
  const [useZeroShotCloud, setUseZeroShotCloud] = useState(true);
  const [synthesizing, setSynthesizing] = useState(false);
  const [statusNote, setStatusNote] = useState('');
  const [clips, setClips] = useState<SynthesizedClip[]>([]);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<BlobPart[]>([]);
  const timerRef = useRef<number | null>(null);
  const fileUploadRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    try {
      localStorage.setItem('openbrain_voice_profiles_v2', JSON.stringify(profiles.slice(0, 6)));
    } catch {
      // Ignore
    }
    if (!selectedProfileId && profiles.length > 0) {
      setSelectedProfileId(profiles[0].id);
    }
  }, [profiles, selectedProfileId]);

  const blobToDataUrl = (blob: Blob): Promise<string> =>
    new Promise((resolve, reject) => {
      const r = new FileReader();
      r.onloadend = () => resolve(String(r.result));
      r.onerror = reject;
      r.readAsDataURL(blob);
    });

  const ingestReferenceAudio = async (blob: Blob, customLabel?: string) => {
    setAnalyzing(true);
    try {
      const [{ durationSec, biometrics }, dataUrl] = await Promise.all([
        analyzeVocalBiometrics(blob),
        blobToDataUrl(blob),
      ]);

      const newProfile: VoiceProfile = {
        id: `vp-${Date.now()}`,
        name: (customLabel || voiceName || 'Custom Voice').trim(),
        createdAt: Date.now(),
        audioDataUrl: dataUrl,
        durationSec,
        referenceText: refTranscript,
        biometrics,
      };

      setProfiles((prev) => [newProfile, ...prev]);
      setSelectedProfileId(newProfile.id);
      triggerHaptic(30);
    } catch (err: any) {
      alert(`Could not decode voice sample: ${err?.message || String(err)}`);
    } finally {
      setAnalyzing(false);
    }
  };

  const startMicRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      chunksRef.current = [];
      const mr = new MediaRecorder(stream);
      mr.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };
      mr.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        const recordedBlob = new Blob(chunksRef.current, {
          type: mr.mimeType || 'audio/webm',
        });
        await ingestReferenceAudio(recordedBlob);
      };
      mediaRecorderRef.current = mr;
      mr.start(200);
      setIsRecording(true);
      setRecordSeconds(0);
      timerRef.current = window.setInterval(() => {
        setRecordSeconds((s) => {
          if (s >= 14) {
            stopMicRecording();
            return 15;
          }
          return s + 1;
        });
      }, 1000);
    } catch (err: any) {
      alert(
        `Microphone access is required for live recording (${
          err?.message || 'Permission denied'
        }). You can also upload any .mp3 or .wav voice sample.`
      );
    }
  };

  const stopMicRecording = () => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
    setIsRecording(false);
  };

  const handleUploadSample = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    await ingestReferenceAudio(file, voiceName || file.name.replace(/\.[^.]+$/, ''));
    e.target.value = '';
  };

  const activeProfile = profiles.find((p) => p.id === selectedProfileId) || null;

  const handleGenerateSpeech = async () => {
    if (!ttsText.trim() || synthesizing) return;
    triggerHaptic(20);
    setSynthesizing(true);
    setStatusNote('Starting Open-Source Voice Clone Pipeline...');

    try {
      const out = await synthesizeClonedVoice({
        text: ttsText,
        profile: activeProfile,
        presetVoice,
        tryZeroShotNeural: useZeroShotCloud,
        hfToken: settings.hfToken,
        onStatus: (m) => setStatusNote(m),
      });

      const clip: SynthesizedClip = {
        id: `clip-${Date.now()}`,
        text: ttsText,
        voiceName: activeProfile ? activeProfile.name : `Studio ${presetVoice.toUpperCase()}`,
        engineUsed: out.engineUsed,
        audioUrl: out.url,
        createdAt: Date.now(),
      };
      setClips((prev) => [clip, ...prev]);
    } catch (err: any) {
      speakWithDeviceFallback(ttsText, 'en-US');
      alert(
        `Cloud audio stream busy (${
          err?.message || 'network'
        }) — played via Native Device Voice Engine.`
      );
    } finally {
      setSynthesizing(false);
      setStatusNote('');
    }
  };

  return (
    <div className="space-y-4 pb-8">
      <div className="glass-card rounded-2xl p-4 border border-teal-500/25 space-y-3">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-teal-500/15 border border-teal-500/35 flex items-center justify-center">
              <AudioWaveform className="w-5 h-5 text-teal-400" />
            </div>
            <div>
              <h2 className="font-bold text-base sm:text-lg text-white">
                Zero-Shot Voice Cloning Lab
              </h2>
              <p className="text-xs text-slate-400">
                F5-TTS / CosyVoice ZeroGPU + Vocal DNA Acoustic Twin DSP • 100% Free
              </p>
            </div>
          </div>
          <span className="text-[11px] font-bold px-2.5 py-1 rounded-full bg-teal-500/15 text-teal-300 border border-teal-500/30">
            CLONE ANY VOICE
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
          <div>
            <label className="block text-[11px] text-slate-400 mb-1">Voice Clone Name</label>
            <input
              type="text"
              value={voiceName}
              onChange={(e) => setVoiceName(e.target.value)}
              placeholder="e.g., My Voice / Studio Narrator"
              className="w-full rounded-xl bg-slate-950 border border-slate-800 px-3 py-2 text-xs text-white focus:outline-none focus:border-teal-500"
            />
          </div>
          <div>
            <label className="block text-[11px] text-slate-400 mb-1">
              Sample Spoken Transcript (improves F5-TTS Zero-Shot alignment)
            </label>
            <input
              type="text"
              value={refTranscript}
              onChange={(e) => setRefTranscript(e.target.value)}
              className="w-full rounded-xl bg-slate-950 border border-slate-800 px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-teal-500"
            />
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 pt-1">
          {!isRecording ? (
            <button
              type="button"
              disabled={analyzing}
              onClick={startMicRecording}
              className="flex-1 min-w-[180px] py-2.5 px-4 rounded-xl bg-teal-500 hover:bg-teal-400 text-xs sm:text-sm font-bold text-slate-950 flex items-center justify-center gap-2 shadow"
            >
              <Mic className="w-4 h-4" />
              Record 6-12s Voice Sample
            </button>
          ) : (
            <button
              type="button"
              onClick={stopMicRecording}
              className="flex-1 min-w-[180px] py-2.5 px-4 rounded-xl bg-teal-600 text-xs sm:text-sm font-bold text-white flex items-center justify-center gap-2"
            >
              <Square className="w-4 h-4 fill-white" />
              Stop Recording ({recordSeconds}s / 15s)
            </button>
          )}

          <input
            ref={fileUploadRef}
            type="file"
            accept="audio/*"
            onChange={handleUploadSample}
            className="hidden"
          />
          <button
            type="button"
            disabled={analyzing || isRecording}
            onClick={() => fileUploadRef.current?.click()}
            className="py-2.5 px-4 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-700 text-xs sm:text-sm font-semibold text-teal-300 flex items-center gap-2"
          >
            {analyzing ? (
              <Loader2 className="w-4 h-4 animate-spin text-teal-400" />
            ) : (
              <Upload className="w-4 h-4 text-teal-400" />
            )}
            Upload Audio (.wav / .mp3)
          </button>
        </div>

        {profiles.length > 0 && (
          <div className="pt-2 space-y-2">
            <div className="text-xs font-semibold text-slate-300">
              Saved Cloned Voice Profiles ({profiles.length}):
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {profiles.map((prof) => {
                const active = prof.id === selectedProfileId;
                return (
                  <div
                    key={prof.id}
                    onClick={() => setSelectedProfileId(prof.id)}
                    className={`cursor-pointer p-3 rounded-xl border transition ${
                      active
                        ? 'bg-teal-950/35 border-teal-400/70'
                        : 'bg-slate-950/70 border-slate-800 hover:border-slate-700'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-white flex items-center gap-1.5">
                        <CheckCircle2
                          className={`w-4 h-4 ${active ? 'text-teal-400' : 'text-slate-600'}`}
                        />
                        {prof.name} ({prof.durationSec}s)
                      </span>
                      <button
                        type="button"
                        onClick={(ev) => {
                          ev.stopPropagation();
                          setProfiles((prev) => prev.filter((p) => p.id !== prof.id));
                          if (selectedProfileId === prof.id) setSelectedProfileId('');
                        }}
                        className="text-slate-500 hover:text-teal-300 p-1"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                    <div className="mt-1.5 flex flex-wrap gap-1.5 text-[10px]">
                      <span className="px-2 py-0.5 rounded bg-teal-500/15 text-teal-300">
                        Pitch F0: {prof.biometrics.pitchHz} Hz
                      </span>
                      <span className="px-2 py-0.5 rounded bg-teal-500/15 text-teal-300">
                        Warmth: {prof.biometrics.warmth}%
                      </span>
                      <span className="px-2 py-0.5 rounded bg-slate-800 text-slate-300">
                        {prof.biometrics.timbreLabel}
                      </span>
                    </div>
                    <audio
                      src={prof.audioDataUrl}
                      controls
                      className="w-full h-7 mt-2 opacity-85"
                    />
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Step 2: Synthesis */}
      <div className="glass-card rounded-2xl p-4 border border-slate-800 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="text-sm font-bold text-white flex items-center gap-2">
            <Activity className="w-4 h-4 text-teal-400" />
            Synthesize Speech {activeProfile ? `with "${activeProfile.name}"` : '(Studio Neural Voices)'}
          </div>

          {activeProfile && (
            <button
              type="button"
              onClick={() => setSelectedProfileId('')}
              className="text-[11px] text-slate-400 hover:text-teal-300 underline"
            >
              Switch to Preset Studio Voices
            </button>
          )}
        </div>

        {!activeProfile && (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {STUDIO_VOICES.map((v) => (
              <button
                key={v.id}
                type="button"
                onClick={() => setPresetVoice(v.id)}
                className={`p-2.5 rounded-xl border text-left transition ${
                  presetVoice === v.id
                    ? 'bg-teal-500/20 border-teal-400 text-white'
                    : 'bg-slate-950/70 border-slate-800 text-slate-400'
                }`}
              >
                <div className="text-xs font-bold">{v.label}</div>
                <div className="text-[10px] text-slate-400">{v.desc}</div>
              </button>
            ))}
          </div>
        )}

        {activeProfile && (
          <label className="flex items-center gap-2 text-xs text-slate-300 cursor-pointer">
            <input
              type="checkbox"
              checked={useZeroShotCloud}
              onChange={(e) => setUseZeroShotCloud(e.target.checked)}
              className="rounded accent-teal-500"
            />
            Try live HuggingFace F5-TTS ZeroGPU first (auto-falls back to Instant Vocal DNA Twin DSP)
          </label>
        )}

        <textarea
          value={ttsText}
          onChange={(e) => setTtsText(e.target.value)}
          rows={3}
          placeholder="Enter any script in any language to synthesize in your cloned voice..."
          className="w-full rounded-xl bg-slate-950 border border-slate-800 p-3 text-sm text-white focus:outline-none focus:border-teal-500"
        />

        <button
          type="button"
          disabled={!ttsText.trim() || synthesizing}
          onClick={handleGenerateSpeech}
          className="w-full py-3 rounded-xl bg-gradient-to-r from-teal-500 to-cyan-600 hover:opacity-95 disabled:opacity-40 text-sm font-bold text-slate-950 shadow flex items-center justify-center gap-2"
        >
          {synthesizing ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              {statusNote || 'Synthesizing Voice Clone...'}
            </>
          ) : (
            <>
              <Volume2 className="w-4 h-4" />
              {activeProfile
                ? `Generate Cloned Audio (${activeProfile.name})`
                : `Generate Neural Speech (${presetVoice.toUpperCase()})`}
            </>
          )}
        </button>
      </div>

      {clips.length > 0 && (
        <div className="space-y-2.5">
          {clips.map((clip) => (
            <div
              key={clip.id}
              className="glass-card rounded-2xl p-3.5 border border-slate-800 space-y-2"
            >
              <div className="flex items-center justify-between gap-2">
                <div>
                  <div className="text-xs font-bold text-teal-300">{clip.voiceName}</div>
                  <div className="text-[10px] text-slate-400">{clip.engineUsed}</div>
                </div>
                <button
                  type="button"
                  onClick={() =>
                    saveFileCrossPlatform(
                      clip.audioUrl,
                      `OpenBrainVoice-${clip.id}.wav`,
                      'audio/wav'
                    )
                  }
                  className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-teal-500 hover:bg-teal-400 text-xs font-bold text-slate-950"
                >
                  <Download className="w-3.5 h-3.5" /> Save WAV
                </button>
              </div>
              <p className="text-xs text-slate-300 line-clamp-2">"{clip.text}"</p>
              <audio src={clip.audioUrl} controls autoPlay className="w-full h-9" />
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  Bell,
  BellOff,
  ChevronDown,
  ChevronUp,
  Mic,
  MicOff,
  Monitor,
  PhoneCall,
  PhoneOff,
  Radio,
  Send,
  Shield,
  ShieldAlert,
  ShieldCheck,
  Volume2,
  VolumeX,
} from 'lucide-react';
import { PWAInstallButton } from './PWAInstallButton';
import { playSpotAlertBeep, speakPlainWarning, unlockAlertAudio } from '../utils/alertAudio';
import {
  getCommonManSummary,
  highlightTranscriptSegments,
  scanCybercrimeTriggers,
  type TriggerMatch,
} from '../utils/cybercrimeLexicon';
import type { SpeakerLeg, StateSnapshot, TranscriptEntry } from '../types/colossus';

interface AndroidMobileCompanionProps {
  systemState: StateSnapshot;
  transcripts: TranscriptEntry[];
  wsConnected: boolean;
  isAnalyzing: boolean;
  onAnalyzeText: (text: string, speakerLeg: SpeakerLeg) => Promise<void>;
  onBridgeAction: (action: 'WHISPER_ALERT' | 'TERMINATED_BY_SHIELD' | 'ENDED') => Promise<void>;
  onResetSession: () => Promise<void>;
  onExitMobileMode: () => void;
}

interface SpeechRecognitionInstance {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  onerror: ((event: { error: string }) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
}

interface SpeechRecognitionEventLike {
  resultIndex: number;
  results: ArrayLike<{
    isFinal: boolean;
    0: { transcript: string };
  }>;
}

interface SpotFlash {
  phase: number;
  triggers: TriggerMatch[];
  utterance: string;
  timestamp: string;
}

const COMMON_MAN_TEST_CALLS = [
  {
    label: 'Indirect OTP Trick',
    text: 'Your electricity will be cut tonight. Just read the 6 digit verification code that came on your SMS and enter your UPI PIN to receive the refund.',
  },
  {
    label: 'Indirect Coercion',
    text: 'If you hang up now it proves your guilt. Nobody at home needs to know, stay on the line and act within 5 minutes.',
  },
  {
    label: 'Digital Arrest',
    text: 'This is CBI Cyber Crime Cell. A Digital Arrest warrant is issued on your Aadhaar. Lock your door and turn on WhatsApp video.',
  },
];

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const result = typeof reader.result === 'string' ? reader.result : '';
      resolve(result.split(',')[1] ?? '');
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

export function AndroidMobileCompanion({
  systemState,
  transcripts,
  wsConnected,
  isAnalyzing,
  onAnalyzeText,
  onBridgeAction,
  onResetSession,
  onExitMobileMode,
}: AndroidMobileCompanionProps) {
  const [isTracking, setIsTracking] = useState(false);
  const [streamRecordingChunks, setStreamRecordingChunks] = useState(true);
  const [beepEnabled, setBeepEnabled] = useState(true);
  const [voiceWarningEnabled, setVoiceWarningEnabled] = useState(true);
  const [showSettings, setShowSettings] = useState(false);
  const [speakerLeg, setSpeakerLeg] = useState<SpeakerLeg>('CONVERSATION');
  const [speechLang, setSpeechLang] = useState<'en-IN' | 'hi-IN' | 'kn-IN'>('en-IN');
  const [interimText, setInterimText] = useState('');
  const [manualText, setManualText] = useState('');
  const [trackerStatus, setTrackerStatus] = useState(
    'Put your call on speaker or Bluetooth and tap the blue button below.'
  );
  const [chunksSynced, setChunksSynced] = useState(0);
  const [audioLevels, setAudioLevels] = useState<number[]>(Array(14).fill(10));
  const [spotFlash, setSpotFlash] = useState<SpotFlash | null>(null);

  const isTrackingRef = useRef(false);
  const recognitionRef = useRef<SpeechRecognitionInstance | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const recorderTimerRef = useRef<number | null>(null);
  const activeRecorderRef = useRef<MediaRecorder | null>(null);
  const animFrameRef = useRef<number | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const lastSpotSigRef = useRef('');
  const interimCommitTimerRef = useRef<number | null>(null);
  const lastInterimSentRef = useRef('');
  const lastProcessedTxIdRef = useRef<string | null>(null);
  const lastSpeechCommittedAtRef = useRef(0);

  const fireSpotAlert = useCallback(
    (utterance: string, forcedPhase?: number) => {
      const matches = scanCybercrimeTriggers(utterance);
      const peakPhase = forcedPhase ?? matches.reduce((mx, m) => Math.max(mx, m.phase), 0);
      if (peakPhase <= 0 && matches.length === 0) return;

      const sig = `${peakPhase}:${matches.map((m) => m.phrase.toLowerCase()).join('|')}`;
      const isNew = sig !== lastSpotSigRef.current;

      if (isNew) {
        lastSpotSigRef.current = sig;
        if (beepEnabled) {
          playSpotAlertBeep(peakPhase);
        }
        if (voiceWarningEnabled && peakPhase >= 3) {
          const summary = getCommonManSummary(peakPhase, matches);
          speakPlainWarning(`Warning. ${summary.reason}. ${summary.action}`);
        }
        setSpotFlash({
          phase: peakPhase,
          triggers: matches,
          utterance,
          timestamp: new Date().toLocaleTimeString([], {
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
          }),
        });
      }
    },
    [beepEnabled, voiceWarningEnabled]
  );

  useEffect(() => {
    const latest = transcripts[0];
    if (!latest || latest.id === lastProcessedTxIdRef.current) return;
    lastProcessedTxIdRef.current = latest.id;
    if (latest.analysis.detected_phase > 0) {
      fireSpotAlert(latest.transcript, latest.analysis.detected_phase);
    }
  }, [transcripts, fireSpotAlert]);

  const stopAllCapture = useCallback(() => {
    isTrackingRef.current = false;
    setIsTracking(false);

    if (interimCommitTimerRef.current) {
      window.clearTimeout(interimCommitTimerRef.current);
      interimCommitTimerRef.current = null;
    }
    if (recorderTimerRef.current) {
      window.clearInterval(recorderTimerRef.current);
      recorderTimerRef.current = null;
    }
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch {
        // ignore
      }
      recognitionRef.current = null;
    }
    if (activeRecorderRef.current && activeRecorderRef.current.state !== 'inactive') {
      try {
        activeRecorderRef.current.stop();
      } catch {
        // ignore
      }
      activeRecorderRef.current = null;
    }
    if (animFrameRef.current) {
      cancelAnimationFrame(animFrameRef.current);
      animFrameRef.current = null;
    }
    if (audioCtxRef.current) {
      audioCtxRef.current.close().catch(() => undefined);
      audioCtxRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    setInterimText('');
    setAudioLevels(Array(14).fill(10));
    setTrackerStatus('Protection paused. Tap the button whenever you are on a call.');
  }, []);

  useEffect(() => {
    return () => {
      stopAllCapture();
    };
  }, [stopAllCapture]);

  const startLiveRecordingLoop = useCallback(
    (stream: MediaStream) => {
      if (typeof MediaRecorder === 'undefined') return;
      const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
        ? 'audio/webm;codecs=opus'
        : MediaRecorder.isTypeSupported('audio/webm')
        ? 'audio/webm'
        : '';

      const recordWindow = () => {
        if (!isTrackingRef.current || !stream.active) return;
        const chunks: BlobPart[] = [];
        try {
          const rec = mimeType
            ? new MediaRecorder(stream, { mimeType })
            : new MediaRecorder(stream);
          activeRecorderRef.current = rec;
          rec.ondataavailable = (ev) => {
            if (ev.data && ev.data.size > 0) {
              chunks.push(ev.data);
            }
          };
          rec.onstop = async () => {
            if (Date.now() - lastSpeechCommittedAtRef.current < 3200) {
              return;
            }
            const blob = new Blob(chunks, { type: mimeType || 'audio/webm' });
            if (blob.size < 1600) return;
            try {
              const audioBase64 = await blobToBase64(blob);
              if (!audioBase64) return;
              const res = await fetch('/api/v1/telephony/audio-chunk', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  audioBase64,
                  mimeType: mimeType || 'audio/webm',
                  speaker_leg: speakerLeg,
                  caller_number: systemState.caller_number,
                  receiver_phone: systemState.receiver_phone,
                }),
              });
              if (res.ok) {
                setChunksSynced((c) => c + 1);
                const data = await res.json();
                if (!data.silent && data.entry) {
                  fireSpotAlert(
                    data.entry.transcript,
                    data.entry.analysis?.detected_phase ?? 0
                  );
                }
              }
            } catch {
              // ignore transient upload issue
            }
          };
          rec.start();
          window.setTimeout(() => {
            if (rec.state === 'recording') {
              rec.stop();
            }
          }, 3600);
        } catch {
          // ignore MediaRecorder init issues
        }
      };

      recordWindow();
      recorderTimerRef.current = window.setInterval(recordWindow, 3900);
    },
    [fireSpotAlert, speakerLeg, systemState.caller_number, systemState.receiver_phone]
  );

  const toggleCallTracking = async () => {
    if (isTracking) {
      stopAllCapture();
      return;
    }

    unlockAlertAudio();
    if (!navigator.mediaDevices?.getUserMedia) {
      setTrackerStatus('Microphone permission needs HTTPS or localhost on Android Chrome.');
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });
      streamRef.current = stream;
      isTrackingRef.current = true;
      setIsTracking(true);
      setTrackerStatus('Listening to your ongoing call… we will beep if any trick is detected.');

      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (AudioCtx) {
        const ctx = new AudioCtx();
        audioCtxRef.current = ctx;
        const src = ctx.createMediaStreamSource(stream);
        const analyser = ctx.createAnalyser();
        analyser.fftSize = 64;
        src.connect(analyser);
        const data = new Uint8Array(analyser.frequencyBinCount);
        const renderMeter = () => {
          if (!isTrackingRef.current) return;
          analyser.getByteFrequencyData(data);
          const next = Array.from({ length: 14 }, (_, idx) => {
            const v = data[idx % data.length] ?? 0;
            return Math.max(10, Math.round((v / 255) * 100));
          });
          setAudioLevels(next);
          animFrameRef.current = requestAnimationFrame(renderMeter);
        };
        renderMeter();
      }

      if (streamRecordingChunks) {
        startLiveRecordingLoop(stream);
      }

      const SpeechCtor =
        (window as unknown as { SpeechRecognition?: new () => SpeechRecognitionInstance })
          .SpeechRecognition ||
        (window as unknown as { webkitSpeechRecognition?: new () => SpeechRecognitionInstance })
          .webkitSpeechRecognition;

      if (SpeechCtor) {
        const recognition = new SpeechCtor();
        recognition.continuous = true;
        recognition.interimResults = true;
        recognition.lang = speechLang;

        recognition.onresult = (event: SpeechRecognitionEventLike) => {
          let interim = '';
          let finalSegment = '';
          for (let i = event.resultIndex; i < event.results.length; i++) {
            const text = event.results[i][0].transcript;
            if (event.results[i].isFinal) {
              finalSegment += text + ' ';
            } else {
              interim += text;
            }
          }

          if (interim.trim()) {
            const cleanInterim = interim.trim();
            setInterimText(cleanInterim);
            fireSpotAlert(cleanInterim);

            if (interimCommitTimerRef.current) {
              window.clearTimeout(interimCommitTimerRef.current);
            }
            interimCommitTimerRef.current = window.setTimeout(() => {
              if (cleanInterim.length >= 3 && cleanInterim !== lastInterimSentRef.current) {
                lastInterimSentRef.current = cleanInterim;
                lastSpeechCommittedAtRef.current = Date.now();
                setInterimText('');
                onAnalyzeText(cleanInterim, speakerLeg);
              }
            }, 1200);
          }

          if (finalSegment.trim()) {
            const cleanFinal = finalSegment.trim();
            if (interimCommitTimerRef.current) {
              window.clearTimeout(interimCommitTimerRef.current);
              interimCommitTimerRef.current = null;
            }
            setInterimText('');
            fireSpotAlert(cleanFinal);
            if (cleanFinal !== lastInterimSentRef.current) {
              lastInterimSentRef.current = cleanFinal;
              lastSpeechCommittedAtRef.current = Date.now();
              onAnalyzeText(cleanFinal, speakerLeg);
            }
          }
        };

        recognition.onerror = () => {
          // Audio chunk stream continues as fallback
        };

        recognition.onend = () => {
          if (isTrackingRef.current) {
            try {
              recognition.start();
            } catch {
              // ignore restart error
            }
          }
        };

        recognitionRef.current = recognition;
        recognition.start();
      }
    } catch {
      stopAllCapture();
      setTrackerStatus('Please allow Microphone permission in Android Chrome to listen to calls.');
    }
  };

  const handleManualSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const clean = manualText.trim();
    if (!clean || isAnalyzing) return;
    unlockAlertAudio();
    fireSpotAlert(clean);
    setManualText('');
    await onAnalyzeText(clean, speakerLeg);
  };

  const detectedTricks = useMemo(() => {
    const map = new Map<
      string,
      { phrase: string; label: string; plainAdvice: string; phase: number; count: number }
    >();

    const addMatches = (text: string) => {
      for (const m of scanCybercrimeTriggers(text)) {
        const key = m.phrase.toLowerCase();
        const existing = map.get(key);
        if (existing) {
          existing.count += 1;
          existing.phase = Math.max(existing.phase, m.phase);
        } else {
          map.set(key, {
            phrase: m.phrase,
            label: m.label,
            plainAdvice: m.plainAdvice,
            phase: m.phase,
            count: 1,
          });
        }
      }
    };

    if (interimText.trim()) addMatches(interimText);
    for (const item of transcripts) {
      addMatches(item.transcript);
      for (const aiPhrase of item.analysis.trigger_phrases ?? []) {
        const clean = aiPhrase.trim();
        if (!clean) continue;
        const key = clean.toLowerCase();
        if (!map.has(key)) {
          map.set(key, {
            phrase: clean,
            label: item.analysis.coercion_fingerprint || 'Suspicious scam phrase',
            plainAdvice:
              item.analysis.counter_guidance ||
              'Do not share OTPs, secret codes, or money. Hang up if pressured.',
            phase: item.analysis.detected_phase || 3,
            count: 1,
          });
        }
      }
    }

    return Array.from(map.values()).sort((a, b) => b.phase - a.phase || b.count - a.count);
  }, [transcripts, interimText]);

  const currentPhase = systemState.current_highest_phase;
  const isCritical = currentPhase >= 5;
  const isElevated = currentPhase >= 3;
  const isWatch = currentPhase >= 1 && currentPhase < 3;

  const latestTurn = transcripts[0];
  const commonSummary = useMemo(() => {
    const base = getCommonManSummary(
      currentPhase,
      spotFlash?.triggers.length
        ? spotFlash.triggers
        : transcripts.flatMap((t) => scanCybercrimeTriggers(t.transcript))
    );
    if (latestTurn?.analysis?.counter_guidance && currentPhase > 0) {
      return {
        ...base,
        action: latestTurn.analysis.counter_guidance,
      };
    }
    return base;
  }, [currentPhase, spotFlash, transcripts, latestTurn]);

  return (
    <div className="min-h-screen bg-[#0A0F1D] text-slate-100 flex flex-col">
      {/* Simple Mobile Top Bar */}
      <header className="px-4 py-3 border-b border-white/10 bg-[#0A0F1D] flex items-center justify-between gap-3 sticky top-0 z-30">
        <div className="flex items-center gap-2.5 min-w-0">
          <Shield className="w-5 h-5 text-cyan-400 shrink-0" />
          <div className="min-w-0">
            <div className="font-display text-sm font-bold text-white truncate">
              Second Voice Guard
            </div>
            <div className="text-[11px] text-slate-400 flex items-center gap-1.5">
              <span className={wsConnected ? 'text-emerald-400' : 'text-amber-400'}>
                {wsConnected ? 'Live Protection Ready' : 'Standard Sync'}
              </span>
              <span aria-hidden="true">·</span>
              <span className="font-mono">{systemState.session_code}</span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <PWAInstallButton compact />
          <button
            type="button"
            onClick={onExitMobileMode}
            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-[#131C31] border border-white/15 text-xs text-slate-200 hover:border-cyan-400"
          >
            <Monitor className="w-3.5 h-3.5 text-cyan-400" />
            Full View
          </button>
        </div>
      </header>

      <main className="flex-1 p-4 max-w-lg w-full mx-auto space-y-4 pb-10">
        {/* Everyday Plain-English Safety Verdict Card */}
        <section
          className={`rounded-2xl border p-5 space-y-3 ${
            isCritical
              ? 'bg-rose-950/45 border-rose-500/60'
              : isElevated
              ? 'bg-amber-950/35 border-amber-500/50'
              : isWatch
              ? 'bg-amber-950/20 border-amber-400/35'
              : 'bg-[#131C31] border-white/10'
          }`}
        >
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="text-[11px] font-medium text-slate-400">
                Call Safety Check · Stage {currentPhase}/7
              </div>
              <h1
                className={`mt-1 text-xl font-bold leading-tight ${
                  isCritical
                    ? 'text-rose-300'
                    : isElevated || isWatch
                    ? 'text-amber-300'
                    : 'text-emerald-300'
                }`}
              >
                {commonSummary.headline}
              </h1>
            </div>
            {isCritical || isElevated ? (
              <ShieldAlert className="w-7 h-7 text-rose-400 shrink-0" />
            ) : (
              <ShieldCheck className="w-7 h-7 text-emerald-400 shrink-0" />
            )}
          </div>

          <div className="bg-[#0A0F1D]/80 border border-white/10 rounded-xl p-3.5 space-y-2">
            <div>
              <div className="text-[11px] font-semibold text-slate-400">
                What is happening
              </div>
              <p className="text-sm text-white font-medium mt-0.5 leading-snug">
                {commonSummary.reason}
              </p>
            </div>
            <div className="pt-2 border-t border-white/10">
              <div className="text-[11px] font-semibold text-cyan-400">
                What you should do
              </div>
              <p className="text-sm text-cyan-100 mt-0.5 leading-snug">
                {commonSummary.action}
              </p>
            </div>
          </div>
        </section>

        {/* Big 1-Tap Protection Button */}
        <section className="bg-[#131C31] border border-white/10 rounded-2xl p-4 space-y-3">
          <button
            type="button"
            onClick={toggleCallTracking}
            className={`w-full py-4 px-4 rounded-xl font-bold text-base flex items-center justify-center gap-3 transition-colors ${
              isTracking
                ? 'bg-rose-500 text-white hover:bg-rose-400'
                : 'bg-cyan-400 text-slate-950 hover:bg-cyan-300'
            }`}
          >
            {isTracking ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
            <span>
              {isTracking ? 'Stop Protecting Call' : 'Protect This Call Now'}
            </span>
          </button>

          {/* Audio Meter + Status */}
          <div className="flex items-end gap-1 h-7 px-2 bg-[#0A0F1D] border border-white/10 rounded-lg py-1">
            {audioLevels.map((lvl, idx) => (
              <div
                key={idx}
                className={`flex-1 rounded-sm transition-all duration-75 ${
                  isTracking ? 'bg-cyan-400' : 'bg-slate-700'
                }`}
                style={{ height: `${Math.max(14, lvl)}%` }}
              />
            ))}
          </div>

          <p className="text-xs text-slate-300 text-center">{trackerStatus}</p>

          {interimText && (
            <div className="p-2.5 rounded-lg bg-[#0A0F1D] border border-cyan-400/40 text-xs text-cyan-200">
              <span className="font-semibold text-cyan-400 mr-1.5">Hearing:</span>
              {interimText}
            </div>
          )}

          {/* Simple Audio / Voice Alert Toggles */}
          <div className="grid grid-cols-3 gap-2 pt-1">
            <button
              type="button"
              onClick={() => {
                unlockAlertAudio();
                setBeepEnabled((b) => !b);
              }}
              className={`py-2 px-2 rounded-lg border text-xs font-medium inline-flex items-center justify-center gap-1.5 ${
                beepEnabled
                  ? 'bg-amber-500/15 border-amber-400/40 text-amber-200'
                  : 'bg-[#0A0F1D] border-white/15 text-slate-400'
              }`}
            >
              {beepEnabled ? <Bell className="w-3.5 h-3.5" /> : <BellOff className="w-3.5 h-3.5" />}
              Beep {beepEnabled ? 'ON' : 'OFF'}
            </button>

            <button
              type="button"
              onClick={() => {
                unlockAlertAudio();
                setVoiceWarningEnabled((v) => !v);
              }}
              className={`py-2 px-2 rounded-lg border text-xs font-medium inline-flex items-center justify-center gap-1.5 ${
                voiceWarningEnabled
                  ? 'bg-cyan-500/15 border-cyan-400/40 text-cyan-200'
                  : 'bg-[#0A0F1D] border-white/15 text-slate-400'
              }`}
            >
              {voiceWarningEnabled ? (
                <Volume2 className="w-3.5 h-3.5" />
              ) : (
                <VolumeX className="w-3.5 h-3.5" />
              )}
              Voice {voiceWarningEnabled ? 'ON' : 'OFF'}
            </button>

            <button
              type="button"
              onClick={() => {
                unlockAlertAudio();
                playSpotAlertBeep(Math.max(4, currentPhase), true);
              }}
              className="py-2 px-2 rounded-lg bg-[#0A0F1D] border border-white/15 text-xs font-medium text-slate-200"
            >
              Test Beep
            </button>
          </div>
        </section>

        {/* Big Common-Man Emergency Buttons */}
        <div className="grid grid-cols-2 gap-3">
          <button
            type="button"
            onClick={() => onBridgeAction('TERMINATED_BY_SHIELD')}
            className="py-3 px-3 rounded-xl bg-rose-500/20 border border-rose-500/50 text-xs font-bold text-rose-200 hover:bg-rose-500/30 inline-flex items-center justify-center gap-2"
          >
            <PhoneOff className="w-4 h-4" />
            Block Caller
          </button>
          <a
            href="tel:1930"
            className="py-3 px-3 rounded-xl bg-emerald-500/15 border border-emerald-500/45 text-xs font-bold text-emerald-200 hover:bg-emerald-500/25 inline-flex items-center justify-center gap-2"
          >
            <PhoneCall className="w-4 h-4" />
            Call 1930 Help
          </a>
        </div>

        {/* Instant Scam Trick Alerts Spotted */}
        {spotFlash && (
          <section
            role="alert"
            className="rounded-xl border border-rose-400 bg-rose-500/20 p-3.5 space-y-1.5"
          >
            <div className="flex items-center justify-between text-xs font-bold text-rose-100">
              <span className="flex items-center gap-1.5">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                ALERT FIRED ({spotFlash.timestamp})
              </span>
              <button
                type="button"
                onClick={() => setSpotFlash(null)}
                className="underline text-[11px]"
              >
                Dismiss
              </button>
            </div>
            <p className="text-xs text-white/95 leading-snug">
              {spotFlash.triggers[0]?.plainAdvice ?? commonSummary.action}
            </p>
          </section>
        )}

        {/* Detected Scam Tricks & Keywords */}
        {detectedTricks.length > 0 && (
          <section className="bg-[#131C31] border border-white/10 rounded-xl p-4 space-y-2.5">
            <div className="flex items-center justify-between">
              <h2 className="text-xs font-semibold text-white">
                Tricks &amp; Keywords Spotted ({detectedTricks.length})
              </h2>
              <button
                type="button"
                onClick={onResetSession}
                className="text-[11px] text-cyan-400 hover:underline"
              >
                Start Fresh Call
              </button>
            </div>
            <div className="space-y-2">
              {detectedTricks.map((item) => (
                <div
                  key={item.phrase.toLowerCase()}
                  className="bg-[#0A0F1D] border border-rose-500/35 rounded-lg p-3 space-y-1"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-mono text-xs font-bold text-rose-300">
                      &ldquo;{item.phrase}&rdquo;
                    </span>
                    <span className="font-mono text-[11px] text-amber-300 shrink-0">
                      Stage {item.phase}
                    </span>
                  </div>
                  <div className="text-xs text-slate-200 font-medium">{item.label}</div>
                  <div className="text-[11px] text-cyan-200/90">{item.plainAdvice}</div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Easy Check: Paste or Test What Caller Said */}
        <section className="bg-[#131C31] border border-white/10 rounded-xl p-4 space-y-3">
          <div className="text-xs font-semibold text-white">
            Check Something Someone Said or Messaged
          </div>

          <form onSubmit={handleManualSubmit} className="flex items-center gap-2">
            <input
              type="text"
              value={manualText}
              onChange={(e) => {
                const v = e.target.value;
                setManualText(v);
                if (v.trim().length >= 3) {
                  fireSpotAlert(v);
                }
              }}
              placeholder="e.g. Tell me the 6 digit code from SMS..."
              className="flex-1 bg-[#0A0F1D] border border-white/15 rounded-lg px-3 py-2 text-xs text-white placeholder:text-slate-500 focus:outline-none focus:border-cyan-400"
            />
            <button
              type="submit"
              disabled={!manualText.trim() || isAnalyzing}
              className="px-3 py-2 rounded-lg bg-cyan-400 text-slate-950 text-xs font-semibold disabled:opacity-50"
              aria-label="Check message"
            >
              <Send className="w-4 h-4" />
            </button>
          </form>

          <div className="flex flex-wrap gap-1.5">
            {COMMON_MAN_TEST_CALLS.map((sample) => (
              <button
                key={sample.label}
                type="button"
                disabled={isAnalyzing}
                onClick={() => {
                  unlockAlertAudio();
                  fireSpotAlert(sample.text);
                  onAnalyzeText(sample.text, speakerLeg);
                }}
                className="px-2.5 py-1.5 rounded-lg bg-[#0A0F1D] border border-white/15 text-[11px] text-slate-200 hover:border-cyan-400 disabled:opacity-50"
              >
                Try: {sample.label}
              </button>
            ))}
          </div>
        </section>

        {/* Collapsible Advanced Call Settings & Full Conversation Log */}
        <section className="bg-[#131C31] border border-white/10 rounded-xl overflow-hidden">
          <button
            type="button"
            onClick={() => setShowSettings((s) => !s)}
            className="w-full px-4 py-3 flex items-center justify-between text-xs font-semibold text-slate-200 hover:bg-white/5"
          >
            <span>Call Language, Recording &amp; History ({transcripts.length})</span>
            {showSettings ? (
              <ChevronUp className="w-4 h-4 text-slate-400" />
            ) : (
              <ChevronDown className="w-4 h-4 text-slate-400" />
            )}
          </button>

          {showSettings && (
            <div className="p-4 pt-2 border-t border-white/10 space-y-4">
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div>
                  <label htmlFor="mob-leg" className="block text-[11px] text-slate-400 mb-1">
                    Who to Scan
                  </label>
                  <select
                    id="mob-leg"
                    value={speakerLeg}
                    onChange={(e) => setSpeakerLeg(e.target.value as SpeakerLeg)}
                    className="w-full bg-[#0A0F1D] border border-white/15 rounded-lg px-2.5 py-1.5 text-xs text-white"
                  >
                    <option value="CONVERSATION">Both (Caller + Me)</option>
                    <option value="CALLER">Caller Only</option>
                    <option value="RECEIVER">My Voice Only</option>
                  </select>
                </div>
                <div>
                  <label htmlFor="mob-lang" className="block text-[11px] text-slate-400 mb-1">
                    Spoken Language
                  </label>
                  <select
                    id="mob-lang"
                    value={speechLang}
                    onChange={(e) => setSpeechLang(e.target.value as 'en-IN' | 'hi-IN' | 'kn-IN')}
                    className="w-full bg-[#0A0F1D] border border-white/15 rounded-lg px-2.5 py-1.5 text-xs text-white"
                  >
                    <option value="en-IN">English (India)</option>
                    <option value="hi-IN">Hindi / Hinglish</option>
                    <option value="kn-IN">Kannada / Mix</option>
                  </select>
                </div>
              </div>

              <label className="flex items-center justify-between gap-3 text-xs text-slate-300 cursor-pointer">
                <span className="flex items-center gap-2">
                  <Radio className="w-3.5 h-3.5 text-cyan-400" />
                  Stream backup 4s audio chunks to server ({chunksSynced} sent)
                </span>
                <input
                  type="checkbox"
                  checked={streamRecordingChunks}
                  onChange={(e) => setStreamRecordingChunks(e.target.checked)}
                  className="rounded border-slate-600 bg-[#0A0F1D] text-cyan-400"
                />
              </label>

              {transcripts.length > 0 && (
                <div className="divide-y divide-white/10 border-t border-white/10 pt-2">
                  {transcripts.slice(0, 8).map((item) => {
                    const segs = highlightTranscriptSegments(
                      item.transcript,
                      item.analysis.trigger_phrases
                    );
                    return (
                      <div key={item.id} className="py-2 space-y-1">
                        <div className="flex items-center justify-between text-[11px] font-mono">
                          <span className="text-slate-400">{item.speaker_leg}</span>
                          <span
                            className={
                              item.analysis.detected_phase >= 5
                                ? 'text-rose-400'
                                : item.analysis.detected_phase >= 3
                                ? 'text-amber-400'
                                : 'text-cyan-400'
                            }
                          >
                            Stage {item.analysis.detected_phase}
                          </span>
                        </div>
                        <p className="text-xs text-slate-100 leading-relaxed">
                          {segs.map((s, idx) =>
                            s.isTrigger ? (
                              <mark
                                key={idx}
                                className="bg-rose-500/25 text-rose-200 px-1 rounded font-medium"
                              >
                                {s.text}
                              </mark>
                            ) : (
                              <React.Fragment key={idx}>{s.text}</React.Fragment>
                            )
                          )}
                        </p>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}

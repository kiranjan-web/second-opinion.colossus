import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  ArrowRight,
  Bell,
  BellOff,
  Download,
  FilePlus2,
  Mic,
  MicOff,
  PhoneCall,
  PhoneOff,
  Play,
  RotateCcw,
  Send,
  ShieldAlert,
  ShieldCheck,
  Smartphone,
  Volume2,
} from 'lucide-react';
import { CoercionRadar } from './CoercionRadar';
import {
  highlightTranscriptSegments,
  scanCybercrimeTriggers,
  type TriggerMatch,
} from '../utils/cybercrimeLexicon';
import { playSpotAlertBeep, unlockAlertAudio } from '../utils/alertAudio';
import type {
  PhoneBinding,
  RoutingMode,
  SpeakerLeg,
  StateSnapshot,
  TelegramConfigState,
  TranscriptEntry,
} from '../types/colossus';

interface ActiveShieldViewProps {
  systemState: StateSnapshot;
  transcripts: TranscriptEntry[];
  phones: PhoneBinding[];
  telegramState: TelegramConfigState | null;
  wsConnected: boolean;
  isAnalyzing: boolean;
  onAnalyzeText: (text: string, speakerLeg: SpeakerLeg) => Promise<void>;
  onAdvanceDemoStep: () => Promise<void>;
  onTriggerPhase5: () => Promise<void>;
  onResetSession: () => Promise<void>;
  onSaveToVault: () => Promise<void>;
  onDownloadPdf: () => void;
  onStartBridge: (params: {
    caller_number: string;
    caller_label: string;
    receiver_phone: string;
    routing_mode: RoutingMode;
  }) => Promise<void>;
  onBridgeAction: (action: 'WHISPER_ALERT' | 'TERMINATED_BY_SHIELD' | 'ENDED') => Promise<void>;
}

const SAMPLE_PROMPTS = [
  {
    label: 'Indirect OTP & Refund Trick',
    text: 'Your electricity will be cut tonight. Just read the 6 digit verification code that came on your SMS and enter your UPI PIN to receive your refund.',
  },
  {
    label: 'Indirect Coercion Pressure',
    text: 'If you hang up now it proves your guilt. Nobody at home needs to know, stay on the line and act within 5 minutes.',
  },
  {
    label: 'Hinglish Digital Arrest',
    text: 'Main Cyber Crime Cell se DCP bol raha hoon. Kisi ko mat batana aur turant alag room mein door lock kar lo.',
  },
  {
    label: 'Genuine Bank Advisory (Safe)',
    text: 'SBI Alert: If you did not attempt Rs 15,000 card spend, block your card via YONO or call the number printed on your card.',
  },
];

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

interface SpotAlertState {
  id: string;
  phase: number;
  triggers: TriggerMatch[];
  utterance: string;
  beeped: boolean;
  timestamp: string;
}

export function ActiveShieldView({
  systemState,
  transcripts,
  phones,
  telegramState,
  wsConnected,
  isAnalyzing,
  onAnalyzeText,
  onAdvanceDemoStep,
  onTriggerPhase5,
  onResetSession,
  onSaveToVault,
  onDownloadPdf,
  onStartBridge,
  onBridgeAction,
}: ActiveShieldViewProps) {
  const [inputText, setInputText] = useState('');
  const [speakerLeg, setSpeakerLeg] = useState<SpeakerLeg>('CONVERSATION');
  const [beepEnabled, setBeepEnabled] = useState(true);
  const [spotAlert, setSpotAlert] = useState<SpotAlertState | null>(null);

  const [showNewCallForm, setShowNewCallForm] = useState(false);
  const [callerNumInput, setCallerNumInput] = useState('+91 93110 44219');
  const [callerLabelInput, setCallerLabelInput] = useState('Unknown Incoming Caller');
  const [receiverInput, setReceiverInput] = useState(
    phones[0]?.mobile_number ?? '+91 98450 71202'
  );
  const [routingModeInput, setRoutingModeInput] =
    useState<RoutingMode>('ANDROID_CALL_SCREENING');

  const [isMicActive, setIsMicActive] = useState(false);
  const [micStatus, setMicStatus] = useState<string>('Live Call Mic standby · Zero raw audio saved');
  const [interimText, setInterimText] = useState('');
  const [audioLevels, setAudioLevels] = useState<number[]>(Array(18).fill(8));
  const [speechLang, setSpeechLang] = useState<'en-IN' | 'hi-IN' | 'kn-IN'>('en-IN');

  const recognitionRef = useRef<SpeechRecognitionInstance | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioStreamRef = useRef<MediaStream | null>(null);
  const animFrameRef = useRef<number | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const lastProcessedTxIdRef = useRef<string | null>(null);
  const lastSpotSignatureRef = useRef<string>('');
  const interimCommitTimerRef = useRef<number | null>(null);
  const lastInterimSentRef = useRef<string>('');

  const triggerSpotFeedback = useCallback(
    (text: string, forcedPhase?: number) => {
      const matches = scanCybercrimeTriggers(text);
      const peakPhase = forcedPhase ?? matches.reduce((mx, m) => Math.max(mx, m.phase), 0);
      if (peakPhase <= 0 && matches.length === 0) return;

      const sig = `${peakPhase}:${matches.map((m) => m.phrase.toLowerCase()).join('|')}`;
      const isNewSignature = sig !== lastSpotSignatureRef.current;

      let beeped = false;
      if (beepEnabled && (isNewSignature || forcedPhase !== undefined)) {
        beeped = playSpotAlertBeep(peakPhase, forcedPhase !== undefined);
        lastSpotSignatureRef.current = sig;
      }

      setSpotAlert({
        id: `spot_${Date.now()}`,
        phase: peakPhase,
        triggers: matches,
        utterance: text,
        beeped,
        timestamp: new Date().toLocaleTimeString(),
      });
    },
    [beepEnabled]
  );

  // Fire beep immediately whenever a new analyzed turn arrives from server / WebSocket / Demo
  useEffect(() => {
    const latest = transcripts[0];
    if (!latest || latest.id === lastProcessedTxIdRef.current) return;
    lastProcessedTxIdRef.current = latest.id;

    if (latest.analysis.detected_phase >= 1) {
      triggerSpotFeedback(latest.transcript, latest.analysis.detected_phase);
    }
  }, [transcripts, triggerSpotFeedback]);

  const stopMicCapture = useCallback(() => {
    setIsMicActive(false);
    setInterimText('');
    setMicStatus('Live Call Mic standby · Zero raw audio saved');
    setAudioLevels(Array(18).fill(8));

    if (interimCommitTimerRef.current) {
      window.clearTimeout(interimCommitTimerRef.current);
      interimCommitTimerRef.current = null;
    }

    if (recognitionRef.current) {
      const rec = recognitionRef.current;
      recognitionRef.current = null;
      try {
        rec.stop();
      } catch {
        // ignore
      }
    }

    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      try {
        mediaRecorderRef.current.stop();
      } catch {
        // ignore
      }
      mediaRecorderRef.current = null;
    }

    if (animFrameRef.current) {
      cancelAnimationFrame(animFrameRef.current);
      animFrameRef.current = null;
    }

    if (audioStreamRef.current) {
      audioStreamRef.current.getTracks().forEach((track) => track.stop());
      audioStreamRef.current = null;
    }

    if (audioCtxRef.current) {
      audioCtxRef.current.close().catch(() => undefined);
      audioCtxRef.current = null;
    }
  }, []);

  useEffect(() => {
    return () => stopMicCapture();
  }, [stopMicCapture]);

  const startMediaRecorderFallback = (stream: MediaStream) => {
    if (typeof MediaRecorder === 'undefined') {
      setMicStatus('Audio meter active · Type or use quick triggers below');
      return;
    }

    const mimeType = MediaRecorder.isTypeSupported('audio/webm') ? 'audio/webm' : '';
    const recorder = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream);
    mediaRecorderRef.current = recorder;

    recorder.ondataavailable = async (ev) => {
      if (!ev.data || ev.data.size < 1000) return;
      const buf = await ev.data.arrayBuffer();
      const bytes = new Uint8Array(buf);
      let binary = '';
      for (let i = 0; i < bytes.length; i++) {
        binary += String.fromCharCode(bytes[i]);
      }
      const audioBase64 = btoa(binary);

      try {
        await fetch('/api/v1/telephony/audio-chunk', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            audioBase64,
            mimeType: ev.data.type || 'audio/webm',
            speaker_leg: speakerLeg,
          }),
        });
      } catch {
        // ignore transient chunk error
      }
    };

    recorder.start(3500);
    setMicStatus('Listening via Gemini Audio Stream (3.5s chunks) · Speak into mic');
  };

  const startMicCapture = async () => {
    unlockAlertAudio();
    lastSpotSignatureRef.current = '';

    const win = window as unknown as {
      SpeechRecognition?: new () => SpeechRecognitionInstance;
      webkitSpeechRecognition?: new () => SpeechRecognitionInstance;
    };
    const SpeechRec = win.SpeechRecognition || win.webkitSpeechRecognition;

    let stream: MediaStream | null = null;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      audioStreamRef.current = stream;
      const ctx = new AudioContext();
      audioCtxRef.current = ctx;
      const source = ctx.createMediaStreamSource(stream);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 64;
      source.connect(analyser);

      const dataArray = new Uint8Array(analyser.frequencyBinCount);
      const updateBars = () => {
        analyser.getByteFrequencyData(dataArray);
        const bars = Array.from({ length: 18 }, (_, i) => {
          const val = dataArray[i % dataArray.length] ?? 0;
          return Math.max(8, Math.round((val / 255) * 38));
        });
        setAudioLevels(bars);
        animFrameRef.current = requestAnimationFrame(updateBars);
      };
      updateBars();
    } catch {
      setMicStatus('Microphone permission blocked · Type live call dialogue below for instant beep & AI scan');
      return;
    }

    if (!SpeechRec) {
      setIsMicActive(true);
      if (stream) startMediaRecorderFallback(stream);
      return;
    }

    const recognition = new SpeechRec();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = speechLang;

    recognition.onresult = (event) => {
      let interim = '';
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const res = event.results[i];
        const phrase = res[0]?.transcript ?? '';
        if (res.isFinal && phrase.trim()) {
          const finalPhrase = phrase.trim();
          setInterimText('');
          if (interimCommitTimerRef.current) {
            window.clearTimeout(interimCommitTimerRef.current);
            interimCommitTimerRef.current = null;
          }
          if (finalPhrase !== lastInterimSentRef.current) {
            lastInterimSentRef.current = finalPhrase;
            triggerSpotFeedback(finalPhrase);
            onAnalyzeText(finalPhrase, speakerLeg);
          }
        } else {
          interim += phrase;
        }
      }

      if (interim.trim()) {
        const cleanInterim = interim.trim();
        setInterimText(cleanInterim);

        // ZERO-LATENCY SPOT DETECTION & BEEP while caller is still speaking!
        triggerSpotFeedback(cleanInterim);

        // Auto-commit interim phrase if speaker pauses for 1.3s
        if (interimCommitTimerRef.current) {
          window.clearTimeout(interimCommitTimerRef.current);
        }
        interimCommitTimerRef.current = window.setTimeout(() => {
          if (cleanInterim && cleanInterim !== lastInterimSentRef.current) {
            lastInterimSentRef.current = cleanInterim;
            onAnalyzeText(cleanInterim, speakerLeg);
            setInterimText('');
          }
        }, 1300);
      }
    };

    recognition.onerror = (ev) => {
      if (ev.error === 'not-allowed' || ev.error === 'service-not-allowed') {
        if (stream) startMediaRecorderFallback(stream);
      } else {
        setMicStatus(`Live speech capture notice: ${ev.error}`);
      }
    };

    recognition.onend = () => {
      if (recognitionRef.current) {
        try {
          recognition.start();
        } catch {
          stopMicCapture();
        }
      }
    };

    try {
      recognition.start();
      recognitionRef.current = recognition;
      setIsMicActive(true);
      setMicStatus(`LIVE CALL ACTIVE (${speechLang}) · Instant Beep & AI Guard Armed`);
    } catch {
      if (stream) {
        setIsMicActive(true);
        startMediaRecorderFallback(stream);
      } else {
        stopMicCapture();
      }
    }
  };

  // Instant on-the-spot check as user types during a live call
  const handleInputChange = (value: string) => {
    setInputText(value);
    unlockAlertAudio();
    if (value.trim().length >= 3) {
      triggerSpotFeedback(value);
    } else {
      lastSpotSignatureRef.current = '';
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    unlockAlertAudio();
    const trimmed = inputText.trim();
    if (!trimmed) return;
    setInputText('');
    triggerSpotFeedback(trimmed);
    await onAnalyzeText(trimmed, speakerLeg);
  };

  const handleWhisperReceiver = async () => {
    unlockAlertAudio();
    if (beepEnabled) playSpotAlertBeep(5, true);
    await onBridgeAction('WHISPER_ALERT');
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      const utter = new SpeechSynthesisUtterance(
        'Second Voice alert: Coercion and cybercrime indicators detected on this call. Do not share OTPs, do not lock your door, and hang up immediately.'
      );
      utter.rate = 1.05;
      window.speechSynthesis.speak(utter);
    }
  };

  const handleStartCallSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await onStartBridge({
      caller_number: callerNumInput,
      caller_label: callerLabelInput,
      receiver_phone: receiverInput,
      routing_mode: routingModeInput,
    });
    setShowNewCallForm(false);
    setSpotAlert(null);
    lastSpotSignatureRef.current = '';
  };

  const chronologicalTurns = useMemo(() => [...transcripts].reverse(), [transcripts]);

  const triggerLedger = useMemo(() => {
    const map = new Map<string, { phrase: string; category: string; phase: number; count: number }>();
    for (const t of transcripts) {
      const lexHits = scanCybercrimeTriggers(t.transcript);
      for (const hit of lexHits) {
        const key = hit.phrase.toLowerCase();
        const existing = map.get(key);
        if (existing) {
          existing.count += 1;
        } else {
          map.set(key, {
            phrase: hit.phrase,
            category: hit.category,
            phase: hit.phase,
            count: 1,
          });
        }
      }
    }
    return Array.from(map.values()).sort((a, b) => b.phase - a.phase);
  }, [transcripts]);

  const isCritical = systemState.current_highest_phase >= 5;
  const isSevered = systemState.bridge_status === 'TERMINATED_BY_SHIELD';
  const latestGuidance =
    transcripts[0]?.analysis.counter_guidance ||
    (isCritical
      ? 'Disconnect immediately, verify through a trusted family member on another line, and report to 1930.'
      : 'No coercive isolation detected. Call bridge is actively screening caller utterances.');

  return (
    <div className="space-y-6">
      {/* Live Man-in-the-Middle Call Interception Topology Bar */}
      <section className="bg-[#131C31] border border-white/10 rounded-xl p-5">
        <div className="flex flex-wrap items-center justify-between gap-4 mb-4">
          <div>
            <div className="flex flex-wrap items-center gap-2 text-xs font-mono text-slate-400">
              <span className="text-cyan-400 font-semibold">{systemState.session_code}</span>
              <span aria-hidden="true">·</span>
              <span>{systemState.routing_mode}</span>
              <span aria-hidden="true">·</span>
              <span className={isSevered ? 'text-rose-400 font-semibold' : 'text-emerald-400'}>
                {systemState.bridge_status}
              </span>
            </div>
            <h2 className="text-base font-semibold text-white mt-0.5">
              Live Call Interception Proxy (Caller → Second Voice Server → Mobile Receiver)
            </h2>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => {
                unlockAlertAudio();
                const next = !beepEnabled;
                setBeepEnabled(next);
                if (next) playSpotAlertBeep(3, true);
              }}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-medium transition-colors whitespace-nowrap ${
                beepEnabled
                  ? 'bg-cyan-500/10 border-cyan-400/40 text-cyan-200 hover:bg-cyan-500/20'
                  : 'bg-[#0A0F1D] border-white/15 text-slate-400 hover:text-white'
              }`}
            >
              {beepEnabled ? <Bell className="w-3.5 h-3.5 text-cyan-400" /> : <BellOff className="w-3.5 h-3.5" />}
              {beepEnabled ? 'Spot Beep: ON' : 'Spot Beep: Muted'}
            </button>
            <button
              type="button"
              onClick={() => {
                unlockAlertAudio();
                playSpotAlertBeep(5, true);
              }}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#0A0F1D] border border-white/15 text-xs font-medium text-slate-200 hover:border-cyan-400 transition-colors whitespace-nowrap"
            >
              <Volume2 className="w-3.5 h-3.5 text-amber-400" />
              Test Beep
            </button>
            <button
              type="button"
              onClick={() => setShowNewCallForm((v) => !v)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#0A0F1D] border border-white/15 text-xs font-medium text-slate-200 hover:border-cyan-400 transition-colors whitespace-nowrap"
            >
              <PhoneCall className="w-3.5 h-3.5 text-cyan-400" />
              New Bridged Call
            </button>
            <button
              type="button"
              onClick={handleWhisperReceiver}
              disabled={isSevered}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-500/15 border border-amber-400/40 text-xs font-medium text-amber-200 hover:bg-amber-500/25 disabled:opacity-40 transition-colors whitespace-nowrap"
            >
              <Volume2 className="w-3.5 h-3.5 text-amber-400" />
              Whisper Alert
            </button>
            <button
              type="button"
              onClick={() => onBridgeAction('TERMINATED_BY_SHIELD')}
              disabled={isSevered}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-rose-500/15 border border-rose-500/40 text-xs font-medium text-rose-200 hover:bg-rose-500/25 disabled:opacity-40 transition-colors whitespace-nowrap"
            >
              <PhoneOff className="w-3.5 h-3.5 text-rose-400" />
              {isSevered ? 'Bridge Severed' : 'Sever & Block'}
            </button>
          </div>
        </div>

        {/* 3-Node Topology Strip */}
        <div className="grid grid-cols-1 md:grid-cols-7 items-center gap-3 bg-[#0A0F1D] border border-white/10 rounded-lg p-3.5">
          <div className="md:col-span-2 flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-slate-800 flex items-center justify-center shrink-0">
              <PhoneCall className={`w-4 h-4 ${isCritical ? 'text-rose-400' : 'text-slate-300'}`} />
            </div>
            <div className="min-w-0">
              <div className="text-[11px] text-slate-400">External Caller Leg</div>
              <div className="font-mono text-xs font-semibold text-white truncate tabular-nums">
                {systemState.caller_number}
              </div>
              <div className="text-[11px] text-slate-400 truncate">{systemState.caller_label}</div>
            </div>
          </div>

          <div className="hidden md:flex items-center justify-center text-slate-500">
            <ArrowRight className="w-4 h-4" />
          </div>

          <div className="md:col-span-2 border-y md:border-y-0 md:border-x border-white/10 py-2 md:py-0 md:px-4 text-center">
            <div className="text-[11px] text-cyan-400 font-medium">
              Second Voice Proxy Relay
            </div>
            <div className="font-mono text-xs font-semibold text-white mt-0.5 tabular-nums">
              {isSevered
                ? 'LINK SEVERED · CALLER BLOCKED'
                : `SCREENING · PHASE ${systemState.current_highest_phase}/7`}
            </div>
            <div className="text-[11px] text-slate-400 mt-0.5">
              Logging directly to server SQLite DB
            </div>
          </div>

          <div className="hidden md:flex items-center justify-center text-slate-500">
            <ArrowRight className="w-4 h-4" />
          </div>

          <div className="md:col-span-1 lg:col-span-1 flex items-center gap-3 md:justify-end">
            <div className="w-9 h-9 rounded-lg bg-cyan-500/10 flex items-center justify-center shrink-0">
              <Smartphone className="w-4 h-4 text-cyan-400" />
            </div>
            <div className="min-w-0">
              <div className="text-[11px] text-slate-400">Mobile Receiver</div>
              <div className="font-mono text-xs font-semibold text-white truncate tabular-nums">
                {systemState.receiver_phone}
              </div>
              <div className="text-[11px] text-emerald-400 truncate">Protected Handset</div>
            </div>
          </div>
        </div>

        {/* Inline New Bridged Call Configuration */}
        {showNewCallForm && (
          <form
            onSubmit={handleStartCallSubmit}
            className="mt-4 pt-4 border-t border-white/10 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 items-end"
          >
            <div>
              <label className="block text-[11px] text-slate-400 mb-1">Caller Number</label>
              <input
                type="text"
                value={callerNumInput}
                onChange={(e) => setCallerNumInput(e.target.value)}
                className="w-full bg-[#0A0F1D] border border-white/15 rounded-lg px-3 py-1.5 text-xs font-mono text-white"
              />
            </div>
            <div>
              <label className="block text-[11px] text-slate-400 mb-1">Caller Label</label>
              <input
                type="text"
                value={callerLabelInput}
                onChange={(e) => setCallerLabelInput(e.target.value)}
                className="w-full bg-[#0A0F1D] border border-white/15 rounded-lg px-3 py-1.5 text-xs text-white"
              />
            </div>
            <div>
              <label className="block text-[11px] text-slate-400 mb-1">Receiver Mobile</label>
              <input
                type="text"
                value={receiverInput}
                onChange={(e) => setReceiverInput(e.target.value)}
                className="w-full bg-[#0A0F1D] border border-white/15 rounded-lg px-3 py-1.5 text-xs font-mono text-white"
              />
            </div>
            <div>
              <label className="block text-[11px] text-slate-400 mb-1">Routing Mode</label>
              <select
                value={routingModeInput}
                onChange={(e) => setRoutingModeInput(e.target.value as RoutingMode)}
                className="w-full bg-[#0A0F1D] border border-white/15 rounded-lg px-3 py-1.5 text-xs text-white"
              >
                <option value="ANDROID_CALL_SCREENING">Android CallScreeningService</option>
                <option value="CARRIER_FORWARD">Carrier Conditional Forward</option>
                <option value="TWILIO_RELAY">Twilio / SIP Proxy Relay</option>
              </select>
            </div>
            <button
              type="submit"
              className="px-4 py-1.5 rounded-lg bg-cyan-400 text-slate-950 text-xs font-semibold hover:bg-cyan-300 transition-colors h-[30px]"
            >
              Start Call Bridge
            </button>
          </form>
        )}
      </section>

      {/* Instant Spot Beep & Live Trigger Flash Banner (0ms Local Detection) */}
      {spotAlert && (
        <div
          role="status"
          className={`rounded-xl border px-5 py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
            spotAlert.phase >= 5
              ? 'bg-rose-950/60 border-rose-500 text-rose-100'
              : 'bg-amber-950/50 border-amber-400/70 text-amber-100'
          }`}
        >
          <div className="flex items-start gap-3">
            <Bell className="w-5 h-5 shrink-0 mt-0.5 text-amber-300" />
            <div>
              <div className="text-xs font-mono font-semibold">
                ON-THE-SPOT DETECTION ({spotAlert.timestamp}) · PHASE {spotAlert.phase}/7 ·{' '}
                {spotAlert.beeped ? 'AUDIO BEEP ALERT FIRED' : 'VISUAL ALERT'}
              </div>
              <div className="text-sm font-medium mt-0.5">
                {spotAlert.triggers.length > 0
                  ? `${spotAlert.triggers[0].label} — "${spotAlert.triggers.map((t) => t.phrase).join('", "')}"`
                  : 'Coercive escalation pattern detected'}
              </div>
              {spotAlert.triggers[0]?.plainAdvice && (
                <div className="text-xs text-white/90 mt-1">
                  {spotAlert.triggers[0].plainAdvice}
                </div>
              )}
            </div>
          </div>
          <button
            type="button"
            onClick={() => setSpotAlert(null)}
            className="text-xs font-medium underline opacity-80 hover:opacity-100 self-end sm:self-center shrink-0"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Phase 5+ Isolation Circuit Breaker Banner */}
      {isCritical && (
        <div
          role="alert"
          className="bg-rose-950/50 border border-rose-500/60 rounded-xl p-5 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4"
        >
          <div className="flex items-start gap-3.5">
            <div className="w-10 h-10 rounded-lg bg-rose-500/20 flex items-center justify-center shrink-0 mt-0.5">
              <AlertTriangle className="w-5 h-5 text-rose-400" />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2 text-xs font-mono text-rose-300 mb-1">
                <span>CIRCUIT BREAKER TRIPPED</span>
                <span aria-hidden="true">·</span>
                <span>PHASE {systemState.current_highest_phase}/7</span>
                <span aria-hidden="true">·</span>
                <span>
                  {systemState.telegram_dispatched
                    ? 'TELEGRAM SOS DISPATCHED'
                    : telegramState?.configured
                    ? 'TELEGRAM HOOK READY'
                    : 'LOCAL ALERT ACTIVE'}
                </span>
              </div>
              <h2 className="text-lg font-semibold text-white">
                Coercion &amp; Isolation Tactics Detected — Break Silence Immediately
              </h2>
              <p className="text-sm text-rose-100/90 mt-1 max-w-3xl">
                Indian Police, CBI, ED, and RBI never conduct &ldquo;Digital Arrest&rdquo; over video calls, demand OTPs/AnyDesk access, or ask for transfers to verification accounts.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2.5 shrink-0">
            <button
              type="button"
              onClick={onDownloadPdf}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-rose-500 text-white text-sm font-semibold hover:bg-rose-400 transition-colors whitespace-nowrap"
            >
              <Download className="w-4 h-4" />
              Export 1930 PDF
            </button>
            <button
              type="button"
              onClick={onSaveToVault}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-slate-900/90 border border-white/15 text-slate-100 text-sm font-medium hover:bg-slate-800 transition-colors whitespace-nowrap"
            >
              <FilePlus2 className="w-4 h-4" />
              Commit to DB Vault
            </button>
          </div>
        </div>
      )}

      {/* Primary Two-Column Command Grid */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-stretch">
        {/* Left Column: Coercion Radar, Trajectory & Trigger Ledger */}
        <section className="xl:col-span-5 bg-[#131C31] border border-white/10 rounded-xl p-6 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between gap-4 mb-5">
              <div>
                <h2 className="text-lg font-semibold text-white">Coercion Radar</h2>
                <p className="text-xs text-slate-400 mt-0.5">
                  Behavioral escalation monitor · {wsConnected ? 'Live WebSocket' : 'HTTP Sync'}
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setSpotAlert(null);
                  lastSpotSignatureRef.current = '';
                  onResetSession();
                }}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-white/10 text-xs font-medium text-slate-300 hover:text-white hover:bg-white/5 transition-colors whitespace-nowrap shrink-0"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                Reset Bridge
              </button>
            </div>

            <CoercionRadar
              phase={systemState.current_highest_phase}
              riskLevel={systemState.latest_risk}
              isIsolated={systemState.isolation_breached}
            />
          </div>

          {/* Conversation Escalation Trajectory Tracker */}
          <div className="mt-5 pt-4 border-t border-white/10">
            <div className="flex items-center justify-between text-xs text-slate-400 mb-2">
              <span>Conversation Trajectory to Coercion</span>
              <span className="font-mono tabular-nums text-slate-300">
                {chronologicalTurns.length} turns tracked
              </span>
            </div>

            {chronologicalTurns.length === 0 ? (
              <p className="text-xs text-slate-500">
                Trajectory plot populates turn-by-turn as utterances arrive.
              </p>
            ) : (
              <div className="flex items-end gap-1.5 h-16 bg-[#0A0F1D] border border-white/10 rounded-lg px-3 py-2">
                {chronologicalTurns.map((turn, idx) => {
                  const p = turn.analysis.detected_phase;
                  const hPct = Math.max(15, Math.round((p / 7) * 100));
                  const barColor =
                    p >= 5
                      ? 'bg-rose-400'
                      : p >= 3
                      ? 'bg-amber-400'
                      : p >= 1
                      ? 'bg-sky-400'
                      : 'bg-emerald-400';

                  return (
                    <div
                      key={turn.id}
                      title={`Turn ${idx + 1} (${turn.speaker_leg}): Phase ${p}/7 — ${turn.analysis.coercion_fingerprint}`}
                      className="flex-1 flex flex-col items-center justify-end h-full min-w-[14px] max-w-[36px]"
                    >
                      <div
                        className={`w-full rounded-sm transition-all ${barColor}`}
                        style={{ height: `${hPct}%` }}
                      />
                      <span className="text-[9px] font-mono text-slate-400 mt-1 tabular-nums">
                        P{p}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Fingerprint, Guidance & Cybercrime Trigger Hit Ledger */}
          <div className="mt-5 pt-4 border-t border-white/10 space-y-4">
            <div>
              <div className="text-xs font-medium text-slate-400 mb-1">
                Active Coercion Fingerprint
              </div>
              <p className="text-sm font-medium text-white leading-relaxed">
                {systemState.fingerprint}
              </p>
            </div>

            <div>
              <div className="text-xs font-medium text-slate-400 mb-1">
                Protective Guidance
              </div>
              <p className="text-sm text-cyan-200/90 leading-relaxed">{latestGuidance}</p>
            </div>

            <div>
              <div className="flex items-center justify-between text-xs text-slate-400 mb-1.5">
                <span>Cybercrime Trigger Keyword Ledger</span>
                <span className="font-mono tabular-nums">
                  {triggerLedger.length > 0 ? triggerLedger.length : systemState.all_triggers.length} matched
                </span>
              </div>

              {triggerLedger.length === 0 && systemState.all_triggers.length === 0 ? (
                <p className="text-xs text-slate-500">
                  No cybercrime or coercion triggers matched yet.
                </p>
              ) : (
                <div className="space-y-1.5 max-h-36 overflow-y-auto pr-1">
                  {triggerLedger.length > 0
                    ? triggerLedger.map((item) => (
                        <div
                          key={`${item.category}-${item.phrase}`}
                          className="flex items-center justify-between gap-2 text-xs bg-[#0A0F1D] border border-white/10 rounded px-2.5 py-1.5"
                        >
                          <div className="min-w-0">
                            <span className="font-mono text-rose-300">&ldquo;{item.phrase}&rdquo;</span>
                            <span className="text-slate-500 mx-1.5">·</span>
                            <span className="text-slate-400">{item.category}</span>
                          </div>
                          <span className="font-mono text-[11px] text-slate-300 shrink-0 tabular-nums">
                            P{item.phase} · {item.count}x
                          </span>
                        </div>
                      ))
                    : systemState.all_triggers.map((phrase) => (
                        <div
                          key={phrase}
                          className="text-xs font-mono text-rose-200 bg-[#0A0F1D] border border-white/10 rounded px-2.5 py-1.5"
                        >
                          &ldquo;{phrase}&rdquo;
                        </div>
                      ))}
                </div>
              )}
            </div>
          </div>
        </section>

        {/* Right Column: Live Call Audio / Transcript Input & Stream */}
        <section className="xl:col-span-7 bg-[#131C31] border border-white/10 rounded-xl p-6 flex flex-col justify-between">
          <div>
            <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
              <div>
                <h2 className="text-lg font-semibold text-white">
                  Live Call Input &amp; Instant Beep Detector
                </h2>
                <p className="text-xs text-slate-400 mt-0.5">
                  Speak live or type during a call — triggers beep at 0ms on the spot &amp; logs to SQLite DB
                </p>
              </div>
              <div className="flex items-center gap-2">
                <select
                  aria-label="Speech recognition language"
                  value={speechLang}
                  onChange={(e) => setSpeechLang(e.target.value as 'en-IN' | 'hi-IN' | 'kn-IN')}
                  className="bg-[#0A0F1D] border border-white/10 rounded-lg px-2.5 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-cyan-400"
                >
                  <option value="en-IN">English (India)</option>
                  <option value="hi-IN">Hindi (India)</option>
                  <option value="kn-IN">Kannada (India)</option>
                </select>
                <button
                  type="button"
                  onClick={isMicActive ? stopMicCapture : startMicCapture}
                  className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap shrink-0 ${
                    isMicActive
                      ? 'bg-rose-500 text-white hover:bg-rose-400'
                      : 'bg-cyan-400 text-slate-950 hover:bg-cyan-300'
                  }`}
                >
                  {isMicActive ? <MicOff className="w-3.5 h-3.5" /> : <Mic className="w-3.5 h-3.5" />}
                  {isMicActive ? 'Stop Live Call Mic' : 'Start Live Call Mic'}
                </button>
              </div>
            </div>

            {/* Live Waveform Bar Visualizer + Instant Interim Transcript */}
            <div
              className={`border rounded-lg px-4 py-3 mb-4 flex items-center justify-between gap-4 transition-colors ${
                isMicActive
                  ? 'bg-cyan-950/25 border-cyan-400/50'
                  : 'bg-[#0A0F1D] border-white/10'
              }`}
            >
              <div className="flex items-end gap-1 h-10" aria-hidden="true">
                {audioLevels.map((lvl, idx) => (
                  <div
                    key={idx}
                    className={`w-1.5 rounded-sm transition-all duration-100 ${
                      isMicActive
                        ? isCritical
                          ? 'bg-rose-400'
                          : 'bg-cyan-400'
                        : 'bg-slate-700'
                    }`}
                    style={{ height: `${lvl}px` }}
                  />
                ))}
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-xs text-slate-200 font-medium truncate">{micStatus}</div>
                {interimText ? (
                  <div className="text-xs font-mono text-cyan-300 truncate mt-0.5">
                    Live Voice: &ldquo;{interimText}&rdquo;
                  </div>
                ) : (
                  <div className="text-[11px] text-slate-400 truncate mt-0.5">
                    Put caller on speakerphone or speak directly — interim words trigger beep immediately
                  </div>
                )}
              </div>
            </div>

            {/* Speaker Leg Selector + Live Typing Input (Beeps on the spot while typing too!) */}
            <form onSubmit={handleSubmit} className="space-y-2.5 mb-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-1 p-1 bg-[#0A0F1D] border border-white/10 rounded-lg">
                  {(['CONVERSATION', 'CALLER', 'RECEIVER'] as const).map((leg) => (
                    <button
                      key={leg}
                      type="button"
                      onClick={() => setSpeakerLeg(leg)}
                      className={`px-3 py-1 rounded-md text-xs font-medium transition-colors whitespace-nowrap ${
                        speakerLeg === leg
                          ? 'bg-slate-800 text-white'
                          : 'text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      {leg === 'CONVERSATION'
                        ? 'Full Call (Both)'
                        : leg === 'CALLER'
                        ? 'Caller Leg'
                        : 'Receiver Leg'}
                    </button>
                  ))}
                </div>
                <span className="text-[11px] text-slate-400">
                  Instant 0ms Spot Beep + Gemini 4 Hydrogen Deep Analysis
                </span>
              </div>

              <div className="flex flex-col sm:flex-row gap-2.5">
                <input
                  type="text"
                  value={inputText}
                  onChange={(e) => handleInputChange(e.target.value)}
                  disabled={isSevered}
                  placeholder={
                    isSevered
                      ? 'Call bridge severed by shield — click Reset Bridge or New Bridged Call'
                      : 'Type or speak live call words here (beeps at the spot on trigger keywords)...'
                  }
                  className="flex-1 bg-[#0A0F1D] border border-white/15 rounded-lg px-3.5 py-2.5 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-cyan-400 disabled:opacity-50"
                />
                <button
                  type="submit"
                  disabled={isAnalyzing || !inputText.trim() || isSevered}
                  className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-cyan-400 text-slate-950 text-sm font-semibold hover:bg-cyan-300 disabled:opacity-50 disabled:cursor-not-allowed transition-colors whitespace-nowrap shrink-0"
                >
                  <Send className="w-4 h-4" />
                  {isAnalyzing ? 'Analyzing...' : 'Log & Analyze'}
                </button>
              </div>
            </form>

            {/* Hackathon Stage Demo & Quick Cybercrime Tests */}
            <div className="flex flex-wrap items-center justify-between gap-2 pb-4 border-b border-white/10">
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    unlockAlertAudio();
                    onAdvanceDemoStep();
                  }}
                  disabled={isAnalyzing || isSevered}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 border border-white/10 text-xs font-medium text-slate-100 hover:bg-slate-700 disabled:opacity-50 transition-colors whitespace-nowrap"
                >
                  <Play className="w-3.5 h-3.5 text-cyan-400" />
                  Next Scam Escalation Step
                </button>
                <button
                  type="button"
                  onClick={() => {
                    unlockAlertAudio();
                    onTriggerPhase5();
                  }}
                  disabled={isAnalyzing}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-rose-500/15 border border-rose-500/40 text-xs font-medium text-rose-200 hover:bg-rose-500/25 transition-colors whitespace-nowrap"
                >
                  <ShieldAlert className="w-3.5 h-3.5 text-rose-400" />
                  Trigger Phase 5 Circuit Breaker
                </button>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={onSaveToVault}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-white/10 text-xs font-medium text-slate-300 hover:text-white hover:bg-white/5 transition-colors whitespace-nowrap"
                >
                  <FilePlus2 className="w-3.5 h-3.5" />
                  Save to DB
                </button>
                <button
                  type="button"
                  onClick={onDownloadPdf}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-white/10 text-xs font-medium text-slate-300 hover:text-white hover:bg-white/5 transition-colors whitespace-nowrap"
                >
                  <Download className="w-3.5 h-3.5" />
                  1930 PDF
                </button>
              </div>
            </div>

            {/* Multilingual & Cybercrime Presets */}
            <div className="py-3 flex flex-wrap items-center gap-2">
              <span className="text-xs text-slate-400">Trigger Tests:</span>
              {SAMPLE_PROMPTS.map((preset) => (
                <button
                  key={preset.label}
                  type="button"
                  disabled={isAnalyzing || isSevered}
                  onClick={() => {
                    unlockAlertAudio();
                    triggerSpotFeedback(preset.text);
                    onAnalyzeText(preset.text, 'CALLER');
                  }}
                  className="px-2.5 py-1 rounded-md bg-[#0A0F1D] border border-white/10 text-xs text-slate-300 hover:text-white hover:border-cyan-400/50 disabled:opacity-50 transition-colors whitespace-nowrap"
                >
                  {preset.label}
                </button>
              ))}
            </div>
          </div>

          {/* Live Analyzed Transcript Stream with Inline Keyword Highlighting */}
          <div className="mt-2 pt-4 border-t border-white/10 flex-1 flex flex-col min-h-[260px]">
            <div className="flex items-center justify-between text-xs text-slate-400 mb-3">
              <span>Live Conversation Feed (Inline Trigger Highlighting)</span>
              <span className="font-mono tabular-nums">{transcripts.length} turns stored in DB</span>
            </div>

            {transcripts.length === 0 ? (
              <div className="flex-1 flex flex-col items-center justify-center text-center py-8 border border-dashed border-white/10 rounded-lg">
                <ShieldCheck className="w-7 h-7 text-cyan-400 mb-2" />
                <p className="text-sm font-medium text-slate-200">
                  Live Call Shield Ready — Click &ldquo;Start Live Call Mic&rdquo;
                </p>
                <p className="text-xs text-slate-400 mt-1 max-w-md">
                  Speak into the microphone or type caller words above. The shield beeps on the spot the moment any cybercrime or coercion keyword appears.
                </p>
              </div>
            ) : (
              <div className="space-y-2.5 max-h-[340px] overflow-y-auto pr-1">
                {transcripts.map((entry, idx) => {
                  const phase = entry.analysis.detected_phase;
                  const prevTurn = transcripts[idx + 1];
                  const delta = prevTurn ? phase - prevTurn.analysis.detected_phase : phase;
                  const segments = highlightTranscriptSegments(
                    entry.transcript,
                    entry.analysis.trigger_phrases
                  );

                  const rowBorder =
                    phase >= 5
                      ? 'border-rose-500/40 bg-rose-950/20'
                      : phase >= 3
                      ? 'border-amber-500/35 bg-amber-950/15'
                      : 'border-white/10 bg-[#0A0F1D]';
                  const phaseColor =
                    phase >= 5
                      ? 'text-rose-400'
                      : phase >= 3
                      ? 'text-amber-400'
                      : phase >= 1
                      ? 'text-sky-400'
                      : 'text-emerald-400';

                  return (
                    <div
                      key={entry.id}
                      className={`border rounded-lg p-3.5 transition-colors ${rowBorder}`}
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-400 mb-1.5">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-mono font-semibold text-cyan-300">
                            {entry.speaker_leg}
                          </span>
                          <span aria-hidden="true">·</span>
                          <span className={`font-mono font-semibold tabular-nums ${phaseColor}`}>
                            Phase {phase}/7 ({entry.analysis.risk_level})
                          </span>
                          {delta > 0 && (
                            <>
                              <span aria-hidden="true">·</span>
                              <span className="font-mono text-rose-300 tabular-nums">
                                +{delta} escalation
                              </span>
                            </>
                          )}
                          <span aria-hidden="true">·</span>
                          <span>{entry.analysis.engine_source}</span>
                        </div>
                        <span className="font-mono tabular-nums">
                          {new Date(entry.timestamp).toLocaleTimeString()}
                        </span>
                      </div>

                      <p className="text-sm text-slate-100 leading-relaxed">
                        &ldquo;
                        {segments.map((seg, sIdx) =>
                          seg.isTrigger ? (
                            <mark
                              key={sIdx}
                              title={seg.category}
                              className="bg-rose-500/25 text-rose-200 px-1 rounded font-medium underline decoration-rose-400/70"
                            >
                              {seg.text}
                            </mark>
                          ) : (
                            <span key={sIdx}>{seg.text}</span>
                          )
                        )}
                        &rdquo;
                      </p>

                      <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-slate-400">
                        <span className="text-slate-300 font-medium">
                          {entry.analysis.coercion_fingerprint}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}

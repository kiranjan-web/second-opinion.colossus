import { GoogleGenAI, ThinkingLevel, Type } from '@google/genai';
import {
  getNextSessionCode,
  insertTranscriptEvent,
  upsertCallerReputation,
  upsertCallSession,
} from './db.js';
import type {
  BridgeStatus,
  RiskLevel,
  RoutingMode,
  SpeakerLeg,
  StateSnapshot,
  TranscriptAnalysis,
  TranscriptEntry,
} from '../src/types/colossus.js';

import { scanCybercrimeTriggers } from '../src/utils/cybercrimeLexicon.js';

const COERCION_STATE_MACHINE_PROMPT = `
You are 'Second Voice', a real-time protective AI that listens to phone calls to protect everyday citizens from cybercrime, OTP theft, scams, and psychological coercion.
Analyze the following transcript chunk in the context of the ongoing conversation (English, Hindi, Kannada, or Hinglish/Kanglish code-mixing).

Evaluate BOTH DIRECT and INDIRECT/DISGUISED attempts across these 7 Escalation Phases:
0 - Normal/Safe
1 - Hook: Unexpected courier/parcel, KYC expiry, lottery/reward, or fake utility/SIM/electricity/bank disconnection ("power will be cut tonight", "SIM blocked in 2 hours")
2 - Authority Impersonation: Claiming to be Police, CBI, ED, Customs, RBI, Supreme Court, TRAI, or Cyber Crime Cell
3 - Accusation: False claims of money laundering, narcotics, compromised Aadhaar/PAN, or criminal fraud
4 - Intimidation & Indirect Coercion: Direct threats ("Digital Arrest", warrant, bank freeze) OR indirect psychological pressure ("if you hang up it proves guilt", "final warning — decide in 5 minutes", "accidental UPI transfer — send it back", fake family emergency)
5 - Isolation & Secrecy: Direct or indirect orders to cut off support ("tell no one", "nobody at home needs to know", "keep this between us", "protect your family reputation", "go to a separate room", "lock your door", "do not cut the call")
6 - Direct & Indirect OTP / Surveillance / Remote Access:
    - Direct OTP/PIN/AnyDesk/TeamViewer/APK/Skype/WhatsApp video requests
    - INDIRECT OTP/Code fishing: asking for a "4-digit or 6-digit verification code", "cancellation code", "refund code", "reference number that just arrived by SMS", "read what came in your message box", "ek code aaya hoga batao", or telling the victim to "enter your UPI PIN to receive a refund/cashback"
7 - Financial Coercion & Refund Tricks: Demanding RTGS/IMPS/UPI transfer to a "secret/RBI escrow/verification account", small fee to unlock a prize/refund, UPI collect approval, or FD liquidation

CRITICAL RULES:
1. Catch subtle/indirect phrasing just as strictly as direct keywords. Even polite or friendly requests for an SMS code, cancellation number, or PIN to receive money are Phase 6 CRITICAL scams.
2. Conversation Trajectory Tracking: Never downgrade below priorHighestPhase if the conversation is escalating.
3. False Positives: Distinguish genuine bank advisories ("If you did not make this spend, call the number on your card" — safe) from scam requests.
4. Write 'counter_guidance' in warm, simple everyday words for a common person (e.g., "Never read any 4 or 6 digit SMS code, even if they call it a verification or refund code. Hang up now.").
`;

export const MOCK_SCAM_SEQUENCE: Array<{ transcript: string; analysis: Omit<TranscriptAnalysis, 'engine_source'> }> = [
  {
    transcript: 'Hello, I am calling from FedEx International Courier. A parcel sent using your Aadhaar number has been intercepted at Mumbai Customs.',
    analysis: {
      detected_phase: 1,
      confidence_score: 88,
      trigger_phrases: ['FedEx', 'courier', 'Aadhaar', 'Customs'],
      risk_level: 'LOW',
      coercion_fingerprint: 'Hook: Unexpected courier interception pretext',
      detected_language: 'English',
      counter_guidance: 'Hang up and check parcel status independently only if you actually shipped an item.',
    },
  },
  {
    transcript: 'Your call is now being transferred to Deputy Commissioner Vikram Rathore, Cyber Crime Cell Delhi. Stay on the line for official recording.',
    analysis: {
      detected_phase: 2,
      confidence_score: 94,
      trigger_phrases: ['Cyber Crime Cell', 'official recording'],
      risk_level: 'MODERATE',
      coercion_fingerprint: 'Authority Impersonation: Fake Cyber Crime Cell transfer',
      detected_language: 'English',
      counter_guidance: 'Indian Police and CBI never transfer live courier calls directly to senior officers.',
    },
  },
  {
    transcript: 'Your Aadhaar and PAN are linked to a Rs 4.2 Crore money laundering racket and narcotics shipment. Five bank accounts are active in your name.',
    analysis: {
      detected_phase: 3,
      confidence_score: 96,
      trigger_phrases: ['Aadhaar', 'money laundering', 'narcotics'],
      risk_level: 'HIGH',
      coercion_fingerprint: 'False Accusation: Money laundering & identity misuse framing',
      detected_language: 'English',
      counter_guidance: 'Do not share Aadhaar, PAN, or bank details to prove your innocence.',
    },
  },
  {
    transcript: 'A Digital Arrest Warrant has been issued against you. If you disconnect, local officers will freeze all your bank accounts within 20 minutes.',
    analysis: {
      detected_phase: 4,
      confidence_score: 98,
      trigger_phrases: ['Digital Arrest', 'Arrest Warrant', 'freeze all your bank accounts'],
      risk_level: 'HIGH',
      coercion_fingerprint: 'Intimidation: Fake Digital Arrest warrant & asset freeze threat',
      detected_language: 'English',
      counter_guidance: '"Digital Arrest" does not exist in Indian law. Disconnect immediately.',
    },
  },
  {
    transcript: 'Under National Security protocol, do not tell your family, go to a separate room, lock your door immediately, and turn on WhatsApp video.',
    analysis: {
      detected_phase: 5,
      confidence_score: 99,
      trigger_phrases: ['National Security protocol', 'do not tell your family', 'go to a separate room', 'lock your door', 'WhatsApp video'],
      risk_level: 'CRITICAL',
      coercion_fingerprint: 'ISOLATION TACTIC: Secrecy & physical isolation breach',
      detected_language: 'English',
      counter_guidance: 'CRITICAL ISOLATION DETECTED. Call a family member on another phone and dial 1930.',
    },
  },
  {
    transcript: 'Install AnyDesk or transfer Rs 2,50,000 via RTGS to our RBI verification escrow account and share the OTP to clear your biometrics.',
    analysis: {
      detected_phase: 7,
      confidence_score: 99,
      trigger_phrases: ['AnyDesk', 'RTGS', 'RBI verification escrow account', 'OTP'],
      risk_level: 'CRITICAL',
      coercion_fingerprint: 'Financial Coercion & Remote Access Extortion',
      detected_language: 'English',
      counter_guidance: 'NEVER install AnyDesk, share OTP, or transfer money for police/RBI verification. Hang up and dial 1930.',
    },
  },
];

export function checkOfflineRules(text: string): TranscriptAnalysis {
  const matches = scanCybercrimeTriggers(text);
  const highestMatchedPhase = matches.reduce((max, m) => Math.max(max, m.phase), 0);
  const matchedTriggers = matches.map((m) => m.phrase);
  const fingerprint =
    matches.length > 0
      ? `Trigger Match (${matches[0].category}): ${matches[0].label}`
      : 'No local coercive pattern matched';

  const risk_level: RiskLevel =
    highestMatchedPhase >= 5
      ? 'CRITICAL'
      : highestMatchedPhase >= 3
      ? 'HIGH'
      : highestMatchedPhase === 2
      ? 'MODERATE'
      : 'LOW';

  return {
    detected_phase: highestMatchedPhase,
    confidence_score: matchedTriggers.length > 0 ? 93 : 85,
    trigger_phrases: matchedTriggers,
    risk_level,
    coercion_fingerprint: fingerprint,
    engine_source: 'offline-regex',
    detected_language: 'Auto (Lexicon)',
    counter_guidance:
      matches[0]?.plainAdvice ??
      (highestMatchedPhase >= 5
        ? 'Hang up right now. Never share codes, install apps, or send money—call your family or dial 1930.'
        : highestMatchedPhase >= 1
        ? 'Be careful—this sounds like a scam trick. Hang up and check via official numbers or 1930.'
        : 'Call looks normal so far. Keep Second Voice running while you talk.'),
  };
}

function getGeminiClient(): GoogleGenAI | null {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey === 'MY_GEMINI_API_KEY' || apiKey.trim() === '') {
    return null;
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

export async function analyzeTranscriptChunk(
  text: string,
  priorHighestPhase: number
): Promise<TranscriptAnalysis> {
  if (!text.trim()) {
    return {
      detected_phase: 0,
      confidence_score: 100,
      trigger_phrases: [],
      risk_level: 'LOW',
      coercion_fingerprint: 'Empty transcript chunk',
      engine_source: 'offline-regex',
    };
  }

  const ai = getGeminiClient();
  if (!ai) {
    return checkOfflineRules(text);
  }

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-4-hydrogen',
      contents: `Prior highest phase in this call: ${priorHighestPhase}/7\n\nTranscript chunk:\n"${text}"`,
      config: {
        systemInstruction: COERCION_STATE_MACHINE_PROMPT,
        thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            detected_phase: {
              type: Type.INTEGER,
              description: 'Integer 0 through 7 corresponding to the 7 Scam Phases.',
            },
            confidence_score: {
              type: Type.INTEGER,
              description: 'Confidence percentage from 0 to 100.',
            },
            trigger_phrases: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
              description: 'Exact short coercive phrases extracted from the transcript.',
            },
            risk_level: {
              type: Type.STRING,
              description: 'One of LOW, MODERATE, HIGH, CRITICAL.',
            },
            coercion_fingerprint: {
              type: Type.STRING,
              description: 'Brief 5-10 word description of the psychological tactic used.',
            },
            detected_language: {
              type: Type.STRING,
              description: 'Detected language(s), e.g., English, Hindi, Kannada, or Hinglish.',
            },
            counter_guidance: {
              type: Type.STRING,
              description: 'Single clear protective sentence telling the user what to do right now.',
            },
          },
          required: [
            'detected_phase',
            'confidence_score',
            'trigger_phrases',
            'risk_level',
            'coercion_fingerprint',
          ],
        },
      },
    });

    const rawText = (response.text ?? '{}').trim();
    const parsed = JSON.parse(rawText) as Partial<TranscriptAnalysis>;
    const phase = Math.max(0, Math.min(7, Number(parsed.detected_phase ?? 0)));
    const riskCandidate = (parsed.risk_level ?? 'LOW').toUpperCase();
    const risk_level: RiskLevel =
      riskCandidate === 'CRITICAL' || riskCandidate === 'HIGH' || riskCandidate === 'MODERATE' || riskCandidate === 'LOW'
        ? riskCandidate
        : phase >= 5
        ? 'CRITICAL'
        : phase >= 3
        ? 'HIGH'
        : phase === 2
        ? 'MODERATE'
        : 'LOW';

    const offlineCheck = checkOfflineRules(text);
    const mergedPhase = Math.max(phase, offlineCheck.detected_phase);
    const mergedTriggers = Array.from(
      new Set([...(parsed.trigger_phrases ?? []), ...offlineCheck.trigger_phrases])
    );

    return {
      detected_phase: mergedPhase,
      confidence_score: Math.max(0, Math.min(100, Number(parsed.confidence_score ?? 90))),
      trigger_phrases: mergedTriggers,
      risk_level: mergedPhase >= 5 ? 'CRITICAL' : risk_level,
      coercion_fingerprint: parsed.coercion_fingerprint || offlineCheck.coercion_fingerprint,
      engine_source: 'gemini-4-hydrogen',
      detected_language: parsed.detected_language || 'English',
      counter_guidance: parsed.counter_guidance || offlineCheck.counter_guidance,
    };
  } catch (err) {
    console.warn('[CoercionEngine] Gemini call failed, engaging offline regex fail-safe:', err);
    return checkOfflineRules(text);
  }
}

export class CoercionStateMachine {
  session_id = `sess_${Date.now()}`;
  session_code = getNextSessionCode();
  caller_number = '+91 93110 44219';
  caller_label = 'Unknown Incoming Caller';
  receiver_phone = '+91 98450 71202';
  routing_mode: RoutingMode = 'ANDROID_CALL_SCREENING';
  bridge_status: BridgeStatus = 'BRIDGED';
  started_at = new Date().toISOString();

  highest_phase = 0;
  is_isolated = false;
  latest_risk: RiskLevel = 'SECURE';
  all_triggers: string[] = [];
  coercion_fingerprint = 'System monitoring active — zero threats detected';
  telegram_dispatched = false;
  history: StateSnapshot[] = [];
  transcripts: TranscriptEntry[] = [];
  mockStep = 0;
  hasPersistedCurrentSession = false;

  startBridge(params: {
    caller_number?: string;
    caller_label?: string;
    receiver_phone?: string;
    routing_mode?: RoutingMode;
  }): StateSnapshot {
    this.session_id = `sess_${Date.now()}`;
    this.session_code = getNextSessionCode();
    this.caller_number = params.caller_number?.trim() || '+91 93110 44219';
    this.caller_label = params.caller_label?.trim() || 'Unknown Incoming Caller';
    this.receiver_phone = params.receiver_phone?.trim() || '+91 98450 71202';
    this.routing_mode = params.routing_mode || 'ANDROID_CALL_SCREENING';
    this.bridge_status = 'BRIDGED';
    this.started_at = new Date().toISOString();

    this.highest_phase = 0;
    this.is_isolated = false;
    this.latest_risk = 'SECURE';
    this.all_triggers = [];
    this.coercion_fingerprint = 'Call bridge active — screening audio stream';
    this.telegram_dispatched = false;
    this.history = [];
    this.transcripts = [];
    this.mockStep = 0;

    upsertCallSession({
      id: this.session_id,
      session_code: this.session_code,
      caller_number: this.caller_number,
      caller_label: this.caller_label,
      receiver_phone: this.receiver_phone,
      routing_mode: this.routing_mode,
      bridge_status: this.bridge_status,
      highest_phase: this.highest_phase,
      isolation_breached: this.is_isolated,
      risk_level: this.latest_risk,
      trigger_phrases: this.all_triggers,
      coercion_fingerprint: this.coercion_fingerprint,
      transcript_excerpt: '',
      telegram_dispatched: this.telegram_dispatched,
      started_at: this.started_at,
    });
    this.hasPersistedCurrentSession = true;

    return this.getSnapshot();
  }

  reset(): StateSnapshot {
    return this.startBridge({
      caller_number: this.caller_number,
      caller_label: 'Standby Call Line',
      receiver_phone: this.receiver_phone,
      routing_mode: this.routing_mode,
    });
  }

  setBridgeAction(action: 'WHISPER_ALERT' | 'TERMINATED_BY_SHIELD' | 'ENDED'): StateSnapshot {
    this.bridge_status = action;
    const endedAt = action === 'TERMINATED_BY_SHIELD' || action === 'ENDED' ? new Date().toISOString() : null;
    const durationSec = Math.max(
      1,
      Math.round((Date.now() - new Date(this.started_at).getTime()) / 1000)
    );

    upsertCallSession({
      id: this.session_id,
      session_code: this.session_code,
      caller_number: this.caller_number,
      caller_label: this.caller_label,
      receiver_phone: this.receiver_phone,
      routing_mode: this.routing_mode,
      bridge_status: this.bridge_status,
      highest_phase: this.highest_phase,
      isolation_breached: this.is_isolated,
      risk_level: this.latest_risk,
      trigger_phrases: this.all_triggers,
      coercion_fingerprint: this.coercion_fingerprint,
      transcript_excerpt: this.transcripts[0]?.transcript || '',
      telegram_dispatched: this.telegram_dispatched,
      started_at: this.started_at,
      ended_at: endedAt,
      duration_sec: durationSec,
    });

    if (action === 'TERMINATED_BY_SHIELD') {
      upsertCallerReputation({
        phone_number: this.caller_number,
        phase: Math.max(5, this.highest_phase),
        fingerprint: this.coercion_fingerprint,
        blocked: true,
      });
    }

    return this.getSnapshot();
  }

  getSnapshot(): StateSnapshot {
    return {
      session_id: this.session_id,
      session_code: this.session_code,
      caller_number: this.caller_number,
      caller_label: this.caller_label,
      receiver_phone: this.receiver_phone,
      routing_mode: this.routing_mode,
      bridge_status: this.bridge_status,
      started_at: this.started_at,
      timestamp: new Date().toISOString(),
      current_highest_phase: this.highest_phase,
      isolation_breached: this.is_isolated,
      latest_risk: this.latest_risk,
      fingerprint: this.coercion_fingerprint,
      all_triggers: this.all_triggers,
      telegram_dispatched: this.telegram_dispatched,
    };
  }

  updateState(
    analysis: TranscriptAnalysis,
    transcript?: string,
    speakerLeg: SpeakerLeg = 'CALLER'
  ): {
    snapshot: StateSnapshot;
    newlyIsolated: boolean;
    entry: TranscriptEntry | null;
  } {
    const previouslyIsolated = this.is_isolated;

    // Only escalate coercion state on caller/proxy utterances unless receiver echoes coercion
    if (analysis.detected_phase > this.highest_phase) {
      this.highest_phase = analysis.detected_phase;
    }

    if (this.highest_phase >= 5) {
      this.is_isolated = true;
      if (this.bridge_status === 'BRIDGED') {
        this.bridge_status = 'WHISPER_ALERT';
      }
    }

    if (this.highest_phase === 0) {
      this.latest_risk = 'SECURE';
    } else if (this.highest_phase >= 5) {
      this.latest_risk = 'CRITICAL';
    } else if (this.highest_phase >= 3) {
      this.latest_risk = 'HIGH';
    } else if (this.highest_phase === 2) {
      this.latest_risk = 'MODERATE';
    } else {
      this.latest_risk = 'LOW';
    }

    if (analysis.trigger_phrases?.length) {
      this.all_triggers = Array.from(new Set([...this.all_triggers, ...analysis.trigger_phrases]));
    }

    if (analysis.coercion_fingerprint && analysis.detected_phase > 0) {
      this.coercion_fingerprint = analysis.coercion_fingerprint;
    }

    const snapshot = this.getSnapshot();
    this.history.push(snapshot);

    const durationSec = Math.max(
      1,
      Math.round((Date.now() - new Date(this.started_at).getTime()) / 1000)
    );

    upsertCallSession({
      id: this.session_id,
      session_code: this.session_code,
      caller_number: this.caller_number,
      caller_label: this.caller_label,
      receiver_phone: this.receiver_phone,
      routing_mode: this.routing_mode,
      bridge_status: this.bridge_status,
      highest_phase: this.highest_phase,
      isolation_breached: this.is_isolated,
      risk_level: this.latest_risk,
      trigger_phrases: this.all_triggers,
      coercion_fingerprint: this.coercion_fingerprint,
      transcript_excerpt: transcript || this.transcripts[0]?.transcript || '',
      telegram_dispatched: this.telegram_dispatched,
      started_at: this.started_at,
      duration_sec: durationSec,
    });
    this.hasPersistedCurrentSession = true;

    if (analysis.detected_phase >= 2) {
      upsertCallerReputation({
        phone_number: this.caller_number,
        phase: analysis.detected_phase,
        fingerprint: this.coercion_fingerprint,
      });
    }

    let entry: TranscriptEntry | null = null;
    if (transcript) {
      const eventId = `evt_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
      entry = {
        id: eventId,
        session_id: this.session_id,
        speaker_leg: speakerLeg,
        timestamp: snapshot.timestamp,
        transcript,
        analysis,
        system_state: snapshot,
      };
      this.transcripts.unshift(entry);

      insertTranscriptEvent({
        id: eventId,
        session_id: this.session_id,
        speaker_leg: speakerLeg,
        transcript,
        detected_phase: analysis.detected_phase,
        confidence_score: analysis.confidence_score,
        trigger_phrases: analysis.trigger_phrases,
        coercion_fingerprint: analysis.coercion_fingerprint,
        engine_source: analysis.engine_source,
        counter_guidance: analysis.counter_guidance || '',
        created_at: snapshot.timestamp,
      });
    }

    return {
      snapshot,
      newlyIsolated: !previouslyIsolated && this.is_isolated,
      entry,
    };
  }
}

export class TelegramNotifier {
  botToken: string = process.env.TELEGRAM_BOT_TOKEN || '';
  chatId: string = process.env.TELEGRAM_CHAT_ID || '';
  autoDispatchPhase5 = true;
  lastDispatchAt: string | null = null;
  lastDispatchSuccess: boolean | null = null;
  lastDispatchMessage: string | null = null;

  configure(botToken: string, chatId: string, autoDispatchPhase5: boolean) {
    if (botToken.trim()) {
      this.botToken = botToken.trim();
    }
    this.chatId = chatId.trim();
    this.autoDispatchPhase5 = autoDispatchPhase5;
  }

  getPublicState() {
    const hasToken = Boolean(this.botToken && this.botToken !== 'your_telegram_bot_token_here');
    const hasChat = Boolean(this.chatId && this.chatId !== 'your_family_chat_id_here');
    const masked = this.chatId
      ? this.chatId.length > 4
        ? `${this.chatId.slice(0, 2)}••••${this.chatId.slice(-2)}`
        : '••••'
      : '';
    return {
      configured: hasToken && hasChat,
      hasToken,
      chatIdMasked: masked,
      chatId: this.chatId,
      autoDispatchPhase5: this.autoDispatchPhase5,
      lastDispatchAt: this.lastDispatchAt,
      lastDispatchSuccess: this.lastDispatchSuccess,
      lastDispatchMessage: this.lastDispatchMessage,
    };
  }

  async sendEmergencyAlert(
    phase: number,
    triggerPhrases: string[],
    callerNumber = 'Unknown',
    isTest = false
  ): Promise<boolean> {
    const triggersList = (triggerPhrases.length ? triggerPhrases : ['Isolation order detected']).slice(0, 4);
    const message =
      `🚨 *SECOND VOICE EMERGENCY ALERT*${isTest ? ' (TEST)' : ''} 🚨\n\n` +
      `Your family member is currently on a high-risk coercive call.\n` +
      `Caller Line: \`${callerNumber}\`\n` +
      `Current Threat Phase: *${phase}/7 (${phase >= 5 ? 'ISOLATION DETECTED' : 'ELEVATED RISK'})*\n\n` +
      `Detected Threats:\n- ${triggersList.join('\n- ')}\n\n` +
      `⚠️ *ACTION REQUIRED:* Call them immediately on an alternate line.`;

    this.lastDispatchAt = new Date().toISOString();
    this.lastDispatchMessage = message;

    const state = this.getPublicState();
    if (!state.configured) {
      this.lastDispatchSuccess = false;
      return false;
    }

    try {
      const url = `https://api.telegram.org/bot${this.botToken}/sendMessage`;
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: this.chatId,
          text: message,
          parse_mode: 'Markdown',
        }),
      });
      if (!res.ok) {
        const errText = await res.text();
        console.warn('[TelegramNotifier] API error:', errText);
        this.lastDispatchSuccess = false;
        return false;
      }
      this.lastDispatchSuccess = true;
      return true;
    } catch (err) {
      console.error('[TelegramNotifier] Failed to dispatch Telegram SOS:', err);
      this.lastDispatchSuccess = false;
      return false;
    }
  }
}

export async function generateForensicAudioComment(metrics: {
  syntheticProbability: number;
  spectralFlatness: number;
  zeroCrossingRate: number;
  pitchStabilityHz: number;
  harmonicRatio: number;
}): Promise<string> {
  const fallback =
    metrics.syntheticProbability >= 0.5
      ? 'Elevated spectral flatness and unnatural harmonic periodicity indicate possible neural vocoder synthesis.'
      : 'Natural pitch micro-variations and organic formant decay align with authentic human speech acoustics.';

  const ai = getGeminiClient();
  if (!ai) return fallback;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-4-hydrogen',
      contents: `Summarize these real-time Web Audio acoustic telemetry figures in 1 concise forensic sentence (max 25 words) for a deepfake voice authenticator:\n${JSON.stringify(metrics)}`,
      config: {
        thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
      },
    });
    return (response.text ?? fallback).trim();
  } catch {
    return fallback;
  }
}

export async function transcribeAudioChunk(
  base64Audio: string,
  mimeType: string
): Promise<string> {
  const ai = getGeminiClient();
  if (!ai || !base64Audio) return '';

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3.5-transcribe',
      contents: {
        parts: [
          {
            inlineData: {
              mimeType,
              data: base64Audio,
            },
          },
          {
            text: 'Transcribe the spoken words verbatim (English, Hindi, or Kannada). If silence or noise only, return an empty string.',
          },
        ],
      },
    });
    return (response.text ?? '').trim();
  } catch (err) {
    console.warn('[AudioTranscribe] Failed to transcribe chunk:', err);
    return '';
  }
}

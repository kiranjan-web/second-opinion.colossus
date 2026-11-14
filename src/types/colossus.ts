export type RiskLevel = 'LOW' | 'MODERATE' | 'HIGH' | 'CRITICAL' | 'SECURE';

export type RoutingMode =
  | 'BROWSER_BRIDGE'
  | 'ANDROID_CALL_SCREENING'
  | 'CARRIER_FORWARD'
  | 'TWILIO_RELAY';

export type BridgeStatus =
  | 'IDLE'
  | 'RINGING'
  | 'BRIDGED'
  | 'WHISPER_ALERT'
  | 'TERMINATED_BY_SHIELD'
  | 'ENDED';

export type SpeakerLeg = 'CALLER' | 'RECEIVER' | 'CONVERSATION' | 'PROXY_WHISPER';

export interface PhaseDefinition {
  phase: number;
  name: string;
  shortLabel: string;
  description: string;
  tactics: string[];
}

export interface TranscriptAnalysis {
  detected_phase: number;
  confidence_score: number;
  trigger_phrases: string[];
  risk_level: RiskLevel;
  coercion_fingerprint: string;
  engine_source: 'gemini-4-hydrogen' | 'offline-regex' | 'demo-override' | 'mock-sequence';
  detected_language?: string;
  counter_guidance?: string;
}

export interface StateSnapshot {
  session_id: string;
  session_code: string;
  caller_number: string;
  caller_label: string;
  receiver_phone: string;
  routing_mode: RoutingMode;
  bridge_status: BridgeStatus;
  started_at: string;
  timestamp: string;
  current_highest_phase: number;
  isolation_breached: boolean;
  latest_risk: RiskLevel;
  fingerprint: string;
  all_triggers: string[];
  telegram_dispatched: boolean;
}

export interface TranscriptEntry {
  id: string;
  session_id?: string;
  speaker_leg: SpeakerLeg;
  timestamp: string;
  transcript: string;
  analysis: TranscriptAnalysis;
  system_state: StateSnapshot;
}

export interface IncidentRecord {
  id: string;
  session_code: string;
  caller_number: string;
  caller_label: string;
  receiver_phone: string;
  routing_mode: RoutingMode;
  bridge_status: BridgeStatus;
  timestamp: string;
  ended_at?: string | null;
  duration_sec: number;
  highest_phase: number;
  isolation_breached: boolean;
  risk_level: RiskLevel;
  trigger_phrases: string[];
  coercion_fingerprint: string;
  transcript_excerpt: string;
  telegram_dispatched: boolean;
  status: 'OPEN' | 'REPORTED_1930' | 'ARCHIVED';
  events?: Array<{
    id: string;
    speaker_leg: SpeakerLeg;
    transcript: string;
    detected_phase: number;
    coercion_fingerprint: string;
    created_at: string;
  }>;
}

export interface PhoneBinding {
  id: string;
  device_label: string;
  mobile_number: string;
  platform: 'ANDROID_DIALER' | 'IOS_CALLKIT' | 'SIP_TRUNK';
  proxy_number: string;
  forwarding_rule: string;
  auto_sever_phase5: boolean;
  whisper_warning_enabled: boolean;
  active: boolean;
  created_at: string;
}

export interface CallerReputation {
  phone_number: string;
  reported_count: number;
  highest_phase_seen: number;
  last_fingerprint: string;
  blocked: boolean;
  updated_at: string;
}

export interface TelegramConfigState {
  configured: boolean;
  hasToken: boolean;
  chatIdMasked: string;
  chatId: string;
  autoDispatchPhase5: boolean;
  lastDispatchAt: string | null;
  lastDispatchSuccess: boolean | null;
  lastDispatchMessage: string | null;
}

export interface SpectralScanResult {
  id: string;
  timestamp: string;
  sourceName: string;
  durationSec: number;
  sampleRate: number;
  syntheticProbability: number;
  livenessScore: number;
  isClonedVoice: boolean;
  spectralFlatness: number;
  zeroCrossingRate: number;
  pitchStabilityHz: number;
  harmonicRatio: number;
  verdict: 'AUTHENTIC VOICE' | 'SUSPICIOUS ARTIFACTS' | 'SYNTHETIC CLONE DETECTED';
  forensicNote: string;
  spectrumBins: number[];
}

export const COERCION_PHASES: PhaseDefinition[] = [
  {
    phase: 0,
    name: 'Normal / Safe',
    shortLabel: 'Baseline',
    description: 'No coercive behavioral signatures or authority spoofing detected.',
    tactics: ['Routine conversation', 'Standard verification'],
  },
  {
    phase: 1,
    name: 'Hook',
    shortLabel: 'Hook',
    description: 'Unexpected contact claiming urgent parcel seizure, SIM deactivation, or bank alert.',
    tactics: ['Courier / FedEx / DHL parcel hook', 'TRAI / DoT number disconnection'],
  },
  {
    phase: 2,
    name: 'Authority Impersonation',
    shortLabel: 'Authority',
    description: 'Caller claims to be Police, CBI, ED, Customs, RBI, or Cyber Crime Cell officer.',
    tactics: ['Fake badge / FIR ID citation', 'Transferred to "Senior IPS Officer"'],
  },
  {
    phase: 3,
    name: 'Accusation',
    shortLabel: 'Accusation',
    description: 'False allegations of money laundering, Aadhaar misuse, narcotics, or illicit accounts.',
    tactics: ['Aadhaar linked to illicit account', 'Illegal international parcel claim'],
  },
  {
    phase: 4,
    name: 'Intimidation',
    shortLabel: 'Intimidation',
    description: 'Explicit threats of immediate arrest, non-bailable warrant, or total asset freeze.',
    tactics: ['Digital Arrest Warrant threat', 'Immediate asset freeze warning'],
  },
  {
    phase: 5,
    name: 'Isolation Breach',
    shortLabel: 'Isolation',
    description: 'Orders to cut off family, lock doors, or stay silent under fake secrecy laws.',
    tactics: ['Do not tell your family', 'Go to a separate locked room'],
  },
  {
    phase: 6,
    name: 'Forced Surveillance',
    shortLabel: 'Surveillance',
    description: 'Demands continuous Skype/WhatsApp video feed to keep victim under virtual custody.',
    tactics: ['24/7 video call monitoring', 'Screen-share / camera lock demand'],
  },
  {
    phase: 7,
    name: 'Financial Coercion',
    shortLabel: 'Extortion',
    description: 'Pressures victim into RTGS/IMPS/UPI transfer to a "RBI verification" or escrow account.',
    tactics: ['Secret RBI audit account transfer', 'Liquidate FD / mutual funds now'],
  },
];

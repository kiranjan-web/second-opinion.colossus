import fs from 'fs';
import path from 'path';
import { DatabaseSync } from 'node:sqlite';
import type {
  BridgeStatus,
  CallerReputation,
  IncidentRecord,
  PhoneBinding,
  RiskLevel,
  RoutingMode,
  SpeakerLeg,
} from '../src/types/colossus.js';

const DATA_DIR = path.resolve(process.cwd(), 'data');
const DB_PATH = path.join(DATA_DIR, 'second_voice.db');

if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

const db = new DatabaseSync(DB_PATH);
db.exec('PRAGMA foreign_keys = ON;');

db.exec(`
  CREATE TABLE IF NOT EXISTS call_sessions (
    id TEXT PRIMARY KEY,
    session_code TEXT NOT NULL,
    caller_number TEXT NOT NULL,
    caller_label TEXT NOT NULL,
    receiver_phone TEXT NOT NULL,
    routing_mode TEXT NOT NULL,
    bridge_status TEXT NOT NULL,
    highest_phase INTEGER NOT NULL DEFAULT 0,
    isolation_breached INTEGER NOT NULL DEFAULT 0,
    risk_level TEXT NOT NULL DEFAULT 'SECURE',
    trigger_phrases TEXT NOT NULL DEFAULT '[]',
    coercion_fingerprint TEXT NOT NULL,
    transcript_excerpt TEXT NOT NULL DEFAULT '',
    telegram_dispatched INTEGER NOT NULL DEFAULT 0,
    portal_status TEXT NOT NULL DEFAULT 'OPEN',
    started_at TEXT NOT NULL,
    ended_at TEXT,
    duration_sec INTEGER NOT NULL DEFAULT 0
  );

  CREATE TABLE IF NOT EXISTS call_transcript_events (
    id TEXT PRIMARY KEY,
    session_id TEXT NOT NULL,
    speaker_leg TEXT NOT NULL,
    transcript TEXT NOT NULL,
    detected_phase INTEGER NOT NULL,
    confidence_score INTEGER NOT NULL,
    trigger_phrases TEXT NOT NULL DEFAULT '[]',
    coercion_fingerprint TEXT NOT NULL,
    engine_source TEXT NOT NULL,
    counter_guidance TEXT NOT NULL DEFAULT '',
    created_at TEXT NOT NULL,
    FOREIGN KEY (session_id) REFERENCES call_sessions(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS phone_bindings (
    id TEXT PRIMARY KEY,
    device_label TEXT NOT NULL,
    mobile_number TEXT NOT NULL,
    platform TEXT NOT NULL,
    proxy_number TEXT NOT NULL,
    forwarding_rule TEXT NOT NULL,
    auto_sever_phase5 INTEGER NOT NULL DEFAULT 1,
    whisper_warning_enabled INTEGER NOT NULL DEFAULT 1,
    active INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS caller_reputation (
    phone_number TEXT PRIMARY KEY,
    reported_count INTEGER NOT NULL DEFAULT 1,
    highest_phase_seen INTEGER NOT NULL DEFAULT 0,
    last_fingerprint TEXT NOT NULL,
    blocked INTEGER NOT NULL DEFAULT 0,
    updated_at TEXT NOT NULL
  );
`);

function seedInitialData() {
  const sessionCount = (db.prepare('SELECT COUNT(*) as cnt FROM call_sessions').get() as { cnt: number }).cnt;
  if (sessionCount === 0) {
    const insertSession = db.prepare(`
      INSERT INTO call_sessions (
        id, session_code, caller_number, caller_label, receiver_phone, routing_mode, bridge_status,
        highest_phase, isolation_breached, risk_level, trigger_phrases, coercion_fingerprint,
        transcript_excerpt, telegram_dispatched, portal_status, started_at, ended_at, duration_sec
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const insertEvent = db.prepare(`
      INSERT INTO call_transcript_events (
        id, session_id, speaker_leg, transcript, detected_phase, confidence_score,
        trigger_phrases, coercion_fingerprint, engine_source, counter_guidance, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const now = Date.now();
    const t1 = new Date(now - 1000 * 60 * 60 * 3).toISOString();
    const t1End = new Date(now - 1000 * 60 * 60 * 3 + 184000).toISOString();
    insertSession.run(
      'sess_104',
      'SV-104',
      '+91 93110 44219',
      'Spoofed Cyber Crime Desk',
      '+91 98450 71202',
      'ANDROID_CALL_SCREENING',
      'TERMINATED_BY_SHIELD',
      5,
      1,
      'CRITICAL',
      JSON.stringify(['Do not tell your family', 'Digital Arrest Warrant issued', 'Lock your door immediately']),
      'Isolation Breach: Fake Cyber Crime Cell warrant & family silence order',
      'A Digital Arrest Warrant has been issued in Delhi. Lock your door immediately and do not tell your family until biometric clearance completes.',
      1,
      'REPORTED_1930',
      t1,
      t1End,
      184
    );

    insertEvent.run(
      'evt_104_1',
      'sess_104',
      'CALLER',
      'A Digital Arrest Warrant has been issued in Delhi. Lock your door immediately and do not tell your family until biometric clearance completes.',
      5,
      98,
      JSON.stringify(['Digital Arrest Warrant issued', 'Lock your door immediately', 'Do not tell your family']),
      'Isolation Breach: Fake Cyber Crime Cell warrant & family silence order',
      'gemini-4-hydrogen',
      'Disconnect immediately, inform family on an alternate phone, and dial 1930.',
      t1
    );

    insertEvent.run(
      'evt_104_2',
      'sess_104',
      'PROXY_WHISPER',
      'Second Voice Proxy severed call bridge and alerted Trusted Circle on Telegram.',
      5,
      100,
      JSON.stringify([]),
      'Automated Phase 5 Circuit Breaker',
      'offline-regex',
      'Bridge disconnected to protect receiver.',
      t1End
    );

    const t2 = new Date(now - 1000 * 60 * 60 * 26).toISOString();
    const t2End = new Date(now - 1000 * 60 * 60 * 26 + 96000).toISOString();
    insertSession.run(
      'sess_105',
      'SV-105',
      '+91 81029 77341',
      'Unverified Courier IVR',
      '+91 98450 71202',
      'TWILIO_RELAY',
      'ENDED',
      3,
      0,
      'HIGH',
      JSON.stringify(['FedEx parcel seized', 'Aadhaar linked to narcotics']),
      'False Accusation: Customs parcel hook escalating to Aadhaar framing',
      'Your parcel from Mumbai to Taipei contains illegal documents and your Aadhaar is flagged by Customs.',
      0,
      'ARCHIVED',
      t2,
      t2End,
      96
    );

    const t3 = new Date(now - 1000 * 60 * 60 * 52).toISOString();
    const t3End = new Date(now - 1000 * 60 * 60 * 52 + 42000).toISOString();
    insertSession.run(
      'sess_106',
      'SV-106',
      '+91 1800 11 2211',
      'SBI Official Card Helpline',
      '+91 98450 71202',
      'CARRIER_FORWARD',
      'ENDED',
      0,
      0,
      'SECURE',
      JSON.stringify([]),
      'Normal Activity — Verified genuine bank OTP advisory',
      'Automated advisory: If you did not authorize transaction #8832, call the official number printed on the back of your debit card.',
      0,
      'ARCHIVED',
      t3,
      t3End,
      42
    );
  }

  const phoneCount = (db.prepare('SELECT COUNT(*) as cnt FROM phone_bindings').get() as { cnt: number }).cnt;
  if (phoneCount === 0) {
    db.prepare(`
      INSERT INTO phone_bindings (
        id, device_label, mobile_number, platform, proxy_number, forwarding_rule,
        auto_sever_phase5, whisper_warning_enabled, active, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      'phone_primary',
      'Primary Protected Mobile',
      '+91 98450 71202',
      'ANDROID_DIALER',
      '+91 80 4568 1930',
      'Conditional Forward (*61*+918045681930#) & CallScreeningService',
      1,
      1,
      1,
      new Date().toISOString()
    );
  }

  const repCount = (db.prepare('SELECT COUNT(*) as cnt FROM caller_reputation').get() as { cnt: number }).cnt;
  if (repCount === 0) {
    const insertRep = db.prepare(`
      INSERT INTO caller_reputation (
        phone_number, reported_count, highest_phase_seen, last_fingerprint, blocked, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?)
    `);
    insertRep.run(
      '+91 93110 44219',
      4,
      5,
      'Fake Cyber Crime Cell warrant & family silence order',
      1,
      new Date(Date.now() - 1000 * 60 * 60 * 3).toISOString()
    );
    insertRep.run(
      '+91 81029 77341',
      2,
      3,
      'Customs parcel hook escalating to Aadhaar framing',
      0,
      new Date(Date.now() - 1000 * 60 * 60 * 26).toISOString()
    );
  }
}

seedInitialData();

export function getNextSessionCode(): string {
  const countRow = db.prepare('SELECT COUNT(*) as cnt FROM call_sessions').get() as { cnt: number };
  return `SV-${104 + countRow.cnt + 1}`;
}

export function upsertCallSession(params: {
  id: string;
  session_code: string;
  caller_number: string;
  caller_label: string;
  receiver_phone: string;
  routing_mode: RoutingMode;
  bridge_status: BridgeStatus;
  highest_phase: number;
  isolation_breached: boolean;
  risk_level: RiskLevel;
  trigger_phrases: string[];
  coercion_fingerprint: string;
  transcript_excerpt: string;
  telegram_dispatched: boolean;
  portal_status?: 'OPEN' | 'REPORTED_1930' | 'ARCHIVED';
  started_at: string;
  ended_at?: string | null;
  duration_sec?: number;
}) {
  const existing = db.prepare('SELECT id FROM call_sessions WHERE id = ?').get(params.id);
  if (!existing) {
    db.prepare(`
      INSERT INTO call_sessions (
        id, session_code, caller_number, caller_label, receiver_phone, routing_mode, bridge_status,
        highest_phase, isolation_breached, risk_level, trigger_phrases, coercion_fingerprint,
        transcript_excerpt, telegram_dispatched, portal_status, started_at, ended_at, duration_sec
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      params.id,
      params.session_code,
      params.caller_number,
      params.caller_label,
      params.receiver_phone,
      params.routing_mode,
      params.bridge_status,
      params.highest_phase,
      params.isolation_breached ? 1 : 0,
      params.risk_level,
      JSON.stringify(params.trigger_phrases),
      params.coercion_fingerprint,
      params.transcript_excerpt,
      params.telegram_dispatched ? 1 : 0,
      params.portal_status ?? (params.highest_phase >= 5 ? 'REPORTED_1930' : 'OPEN'),
      params.started_at,
      params.ended_at ?? null,
      params.duration_sec ?? 0
    );
  } else {
    db.prepare(`
      UPDATE call_sessions SET
        caller_number = ?,
        caller_label = ?,
        receiver_phone = ?,
        routing_mode = ?,
        bridge_status = ?,
        highest_phase = ?,
        isolation_breached = ?,
        risk_level = ?,
        trigger_phrases = ?,
        coercion_fingerprint = ?,
        transcript_excerpt = ?,
        telegram_dispatched = ?,
        ended_at = COALESCE(?, ended_at),
        duration_sec = COALESCE(?, duration_sec)
      WHERE id = ?
    `).run(
      params.caller_number,
      params.caller_label,
      params.receiver_phone,
      params.routing_mode,
      params.bridge_status,
      params.highest_phase,
      params.isolation_breached ? 1 : 0,
      params.risk_level,
      JSON.stringify(params.trigger_phrases),
      params.coercion_fingerprint,
      params.transcript_excerpt,
      params.telegram_dispatched ? 1 : 0,
      params.ended_at ?? null,
      params.duration_sec ?? null,
      params.id
    );
  }
}

export function insertTranscriptEvent(event: {
  id: string;
  session_id: string;
  speaker_leg: SpeakerLeg;
  transcript: string;
  detected_phase: number;
  confidence_score: number;
  trigger_phrases: string[];
  coercion_fingerprint: string;
  engine_source: string;
  counter_guidance: string;
  created_at: string;
}) {
  db.prepare(`
    INSERT INTO call_transcript_events (
      id, session_id, speaker_leg, transcript, detected_phase, confidence_score,
      trigger_phrases, coercion_fingerprint, engine_source, counter_guidance, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    event.id,
    event.session_id,
    event.speaker_leg,
    event.transcript,
    event.detected_phase,
    event.confidence_score,
    JSON.stringify(event.trigger_phrases),
    event.coercion_fingerprint,
    event.engine_source,
    event.counter_guidance,
    event.created_at
  );
}

export function upsertCallerReputation(params: {
  phone_number: string;
  phase: number;
  fingerprint: string;
  blocked?: boolean;
}) {
  const existing = db
    .prepare('SELECT * FROM caller_reputation WHERE phone_number = ?')
    .get(params.phone_number) as
    | {
        phone_number: string;
        reported_count: number;
        highest_phase_seen: number;
        last_fingerprint: string;
        blocked: number;
      }
    | undefined;

  const now = new Date().toISOString();
  if (!existing) {
    db.prepare(`
      INSERT INTO caller_reputation (
        phone_number, reported_count, highest_phase_seen, last_fingerprint, blocked, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?)
    `).run(
      params.phone_number,
      params.phase >= 2 ? 1 : 0,
      params.phase,
      params.fingerprint,
      params.blocked ? 1 : 0,
      now
    );
  } else {
    const nextCount = params.phase >= 2 ? existing.reported_count + 1 : existing.reported_count;
    const nextMax = Math.max(existing.highest_phase_seen, params.phase);
    const nextBlocked = params.blocked !== undefined ? (params.blocked ? 1 : 0) : existing.blocked;
    db.prepare(`
      UPDATE caller_reputation SET
        reported_count = ?,
        highest_phase_seen = ?,
        last_fingerprint = ?,
        blocked = ?,
        updated_at = ?
      WHERE phone_number = ?
    `).run(nextCount, nextMax, params.fingerprint, nextBlocked, now, params.phone_number);
  }
}

export function isCallerBlocked(phoneNumber: string): boolean {
  const row = db
    .prepare('SELECT blocked FROM caller_reputation WHERE phone_number = ?')
    .get(phoneNumber) as { blocked: number } | undefined;
  return Boolean(row?.blocked);
}

export function listIncidentsFromDb(): IncidentRecord[] {
  const rows = db
    .prepare('SELECT * FROM call_sessions ORDER BY started_at DESC')
    .all() as Array<Record<string, unknown>>;

  const eventsStmt = db.prepare(
    'SELECT id, speaker_leg, transcript, detected_phase, coercion_fingerprint, created_at FROM call_transcript_events WHERE session_id = ? ORDER BY created_at ASC'
  );

  return rows.map((r) => {
    const events = eventsStmt.all(String(r.id)) as Array<Record<string, unknown>>;
    let parsedTriggers: string[] = [];
    try {
      parsedTriggers = JSON.parse(String(r.trigger_phrases || '[]'));
    } catch {
      parsedTriggers = [];
    }

    return {
      id: String(r.id),
      session_code: String(r.session_code),
      caller_number: String(r.caller_number),
      caller_label: String(r.caller_label),
      receiver_phone: String(r.receiver_phone),
      routing_mode: String(r.routing_mode) as RoutingMode,
      bridge_status: String(r.bridge_status) as BridgeStatus,
      timestamp: String(r.started_at),
      ended_at: r.ended_at ? String(r.ended_at) : null,
      duration_sec: Number(r.duration_sec ?? 0),
      highest_phase: Number(r.highest_phase ?? 0),
      isolation_breached: Boolean(r.isolation_breached),
      risk_level: String(r.risk_level) as RiskLevel,
      trigger_phrases: parsedTriggers,
      coercion_fingerprint: String(r.coercion_fingerprint),
      transcript_excerpt: String(r.transcript_excerpt),
      telegram_dispatched: Boolean(r.telegram_dispatched),
      status: String(r.portal_status) as IncidentRecord['status'],
      events: events.map((e) => ({
        id: String(e.id),
        speaker_leg: String(e.speaker_leg) as SpeakerLeg,
        transcript: String(e.transcript),
        detected_phase: Number(e.detected_phase),
        coercion_fingerprint: String(e.coercion_fingerprint),
        created_at: String(e.created_at),
      })),
    };
  });
}

export function updateIncidentStatusInDb(
  id: string,
  status: IncidentRecord['status']
): boolean {
  const res = db
    .prepare('UPDATE call_sessions SET portal_status = ? WHERE id = ?')
    .run(status, id);
  return res.changes > 0;
}

export function deleteIncidentInDb(id: string): boolean {
  const res = db.prepare('DELETE FROM call_sessions WHERE id = ?').run(id);
  return res.changes > 0;
}

export function listPhoneBindings(): PhoneBinding[] {
  const rows = db
    .prepare('SELECT * FROM phone_bindings ORDER BY created_at DESC')
    .all() as Array<Record<string, unknown>>;
  return rows.map((r) => ({
    id: String(r.id),
    device_label: String(r.device_label),
    mobile_number: String(r.mobile_number),
    platform: String(r.platform) as PhoneBinding['platform'],
    proxy_number: String(r.proxy_number),
    forwarding_rule: String(r.forwarding_rule),
    auto_sever_phase5: Boolean(r.auto_sever_phase5),
    whisper_warning_enabled: Boolean(r.whisper_warning_enabled),
    active: Boolean(r.active),
    created_at: String(r.created_at),
  }));
}

export function addPhoneBinding(params: {
  device_label: string;
  mobile_number: string;
  platform: PhoneBinding['platform'];
  auto_sever_phase5: boolean;
  whisper_warning_enabled: boolean;
}): PhoneBinding {
  const id = `phone_${Date.now()}`;
  const proxy_number = '+91 80 4568 1930';
  const forwarding_rule =
    params.platform === 'ANDROID_DIALER'
      ? 'Android CallScreeningService + *61*+918045681930#'
      : params.platform === 'IOS_CALLKIT'
      ? 'Carrier Conditional Forward (*61*+918045681930#)'
      : 'SIP B2BUA Trunk Relay';
  const created_at = new Date().toISOString();

  db.prepare(`
    INSERT INTO phone_bindings (
      id, device_label, mobile_number, platform, proxy_number, forwarding_rule,
      auto_sever_phase5, whisper_warning_enabled, active, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    id,
    params.device_label,
    params.mobile_number,
    params.platform,
    proxy_number,
    forwarding_rule,
    params.auto_sever_phase5 ? 1 : 0,
    params.whisper_warning_enabled ? 1 : 0,
    1,
    created_at
  );

  return {
    id,
    device_label: params.device_label,
    mobile_number: params.mobile_number,
    platform: params.platform,
    proxy_number,
    forwarding_rule,
    auto_sever_phase5: params.auto_sever_phase5,
    whisper_warning_enabled: params.whisper_warning_enabled,
    active: true,
    created_at,
  };
}

export function togglePhoneBinding(
  id: string,
  patch: Partial<Pick<PhoneBinding, 'active' | 'auto_sever_phase5' | 'whisper_warning_enabled'>>
): boolean {
  const row = db.prepare('SELECT * FROM phone_bindings WHERE id = ?').get(id) as
    | Record<string, unknown>
    | undefined;
  if (!row) return false;

  db.prepare(`
    UPDATE phone_bindings SET
      active = ?,
      auto_sever_phase5 = ?,
      whisper_warning_enabled = ?
    WHERE id = ?
  `).run(
    patch.active !== undefined ? (patch.active ? 1 : 0) : Number(row.active),
    patch.auto_sever_phase5 !== undefined
      ? patch.auto_sever_phase5
        ? 1
        : 0
      : Number(row.auto_sever_phase5),
    patch.whisper_warning_enabled !== undefined
      ? patch.whisper_warning_enabled
        ? 1
        : 0
      : Number(row.whisper_warning_enabled),
    id
  );
  return true;
}

export function deletePhoneBinding(id: string): boolean {
  const res = db.prepare('DELETE FROM phone_bindings WHERE id = ?').run(id);
  return res.changes > 0;
}

export function listCallerReputation(): CallerReputation[] {
  const rows = db
    .prepare('SELECT * FROM caller_reputation ORDER BY updated_at DESC')
    .all() as Array<Record<string, unknown>>;
  return rows.map((r) => ({
    phone_number: String(r.phone_number),
    reported_count: Number(r.reported_count),
    highest_phase_seen: Number(r.highest_phase_seen),
    last_fingerprint: String(r.last_fingerprint),
    blocked: Boolean(r.blocked),
    updated_at: String(r.updated_at),
  }));
}

export function setCallerBlocked(phoneNumber: string, blocked: boolean): boolean {
  const res = db
    .prepare('UPDATE caller_reputation SET blocked = ?, updated_at = ? WHERE phone_number = ?')
    .run(blocked ? 1 : 0, new Date().toISOString(), phoneNumber);
  return res.changes > 0;
}

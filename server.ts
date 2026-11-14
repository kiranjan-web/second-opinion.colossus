import express from 'express';
import http from 'http';
import path from 'path';
import dotenv from 'dotenv';
import { WebSocketServer, WebSocket } from 'ws';
import {
  CoercionStateMachine,
  MOCK_SCAM_SEQUENCE,
  TelegramNotifier,
  analyzeTranscriptChunk,
  generateForensicAudioComment,
  transcribeAudioChunk,
} from './server/coercionEngine.js';
import {
  addPhoneBinding,
  deleteIncidentInDb,
  deletePhoneBinding,
  isCallerBlocked,
  listCallerReputation,
  listIncidentsFromDb,
  listPhoneBindings,
  setCallerBlocked,
  togglePhoneBinding,
  updateIncidentStatusInDb,
  upsertCallSession,
} from './server/db.js';
import type { RiskLevel, RoutingMode, SpeakerLeg, TranscriptAnalysis } from './src/types/colossus.js';

dotenv.config();

const PORT = Number(process.env.PORT || 3000);
const activeCallState = new CoercionStateMachine();
const telegramNotifier = new TelegramNotifier();

async function startServer() {
  const app = express();
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true }));

  const server = http.createServer(app);
  const wss = new WebSocketServer({ server, path: '/api/v1/ws/protect' });

  function broadcastPayload(payload: unknown) {
    const serialized = JSON.stringify(payload);
    for (const client of wss.clients) {
      if (client.readyState === WebSocket.OPEN) {
        client.send(serialized);
      }
    }
  }

  async function processIncomingTranscript(
    text: string,
    overrideAnalysis?: TranscriptAnalysis,
    speakerLeg: SpeakerLeg = 'CALLER'
  ) {
    const analysis =
      overrideAnalysis ?? (await analyzeTranscriptChunk(text, activeCallState.highest_phase));
    const { snapshot, newlyIsolated, entry } = activeCallState.updateState(
      analysis,
      text,
      speakerLeg
    );

    if (newlyIsolated && telegramNotifier.autoDispatchPhase5) {
      const sent = await telegramNotifier.sendEmergencyAlert(
        snapshot.current_highest_phase,
        analysis.trigger_phrases?.length
          ? analysis.trigger_phrases
          : ['Isolation order detected'],
        snapshot.caller_number
      );
      activeCallState.telegram_dispatched = sent;
      snapshot.telegram_dispatched = sent;
    }

    const payload = {
      transcript: text,
      speaker_leg: speakerLeg,
      analysis,
      system_state: snapshot,
      entry,
      telegram_state: telegramNotifier.getPublicState(),
    };

    broadcastPayload(payload);
    return payload;
  }

  wss.on('connection', (ws) => {
    ws.send(
      JSON.stringify({
        type: 'STATE_SYNC',
        system_state: activeCallState.getSnapshot(),
        transcripts: activeCallState.transcripts,
        telegram_state: telegramNotifier.getPublicState(),
      })
    );

    ws.on('message', async (raw) => {
      const message = raw.toString();
      try {
        await processIncomingTranscript(message);
      } catch (err) {
        console.error('[WS] Failed to process message:', err);
      }
    });
  });

  // --- Core Shield Status & Transcript Analysis ---
  app.get('/api/v1/status', (_req, res) => {
    res.json({
      highest_phase: activeCallState.highest_phase,
      is_isolated: activeCallState.is_isolated,
      system_state: activeCallState.getSnapshot(),
      transcripts: activeCallState.transcripts,
      telegram_state: telegramNotifier.getPublicState(),
    });
  });

  app.post('/api/v1/analyze', async (req, res) => {
    const transcript = String(req.body?.transcript ?? '');
    const speakerLeg = (String(req.body?.speaker_leg ?? 'CALLER').toUpperCase() || 'CALLER') as SpeakerLeg;
    if (!transcript.trim()) {
      res.status(400).json({ error: 'Transcript text is required.' });
      return;
    }
    const payload = await processIncomingTranscript(transcript, undefined, speakerLeg);
    res.json(payload);
  });

  app.post('/api/v1/reset', (_req, res) => {
    const snapshot = activeCallState.reset();
    const payload = {
      type: 'STATE_RESET',
      system_state: snapshot,
      transcripts: [],
    };
    broadcastPayload(payload);
    res.json({ status: 'reset', system_state: snapshot });
  });

  // --- Live Two-Party Call Bridge (Caller <-> Second Voice Proxy <-> Mobile Receiver) ---
  app.post('/api/v1/bridge/start', (req, res) => {
    const caller_number = String(req.body?.caller_number ?? '+91 93110 44219');
    const caller_label = String(req.body?.caller_label ?? 'Unknown Incoming Caller');
    const receiver_phone = String(req.body?.receiver_phone ?? '+91 98450 71202');
    const routing_mode = (String(req.body?.routing_mode ?? 'ANDROID_CALL_SCREENING') as RoutingMode);

    if (isCallerBlocked(caller_number)) {
      res.json({
        blocked: true,
        reason: 'Caller number is blacklisted in Second Voice reputation database.',
        system_state: activeCallState.getSnapshot(),
      });
      return;
    }

    const snapshot = activeCallState.startBridge({
      caller_number,
      caller_label,
      receiver_phone,
      routing_mode,
    });

    broadcastPayload({
      type: 'STATE_SYNC',
      system_state: snapshot,
      transcripts: [],
      telegram_state: telegramNotifier.getPublicState(),
    });

    res.json({ blocked: false, system_state: snapshot });
  });

  app.post('/api/v1/bridge/action', (req, res) => {
    const action = String(req.body?.action ?? '');
    if (action !== 'WHISPER_ALERT' && action !== 'TERMINATED_BY_SHIELD' && action !== 'ENDED') {
      res.status(400).json({ error: 'Unsupported bridge action' });
      return;
    }

    const snapshot = activeCallState.setBridgeAction(action);
    broadcastPayload({
      type: 'STATE_SYNC',
      system_state: snapshot,
      transcripts: activeCallState.transcripts,
      telegram_state: telegramNotifier.getPublicState(),
    });

    res.json({ status: 'ok', system_state: snapshot });
  });

  // --- Telephony & Mobile Dialer Integration Webhooks ---
  app.post('/api/v1/telephony/twiml', (req, res) => {
    const callerNumber = String(req.body?.From ?? req.body?.caller_number ?? '+91 93110 44219');
    const bindings = listPhoneBindings();
    const primaryReceiver = bindings.find((b) => b.active)?.mobile_number ?? '+91 98450 71202';

    if (isCallerBlocked(callerNumber)) {
      res.type('text/xml').send(`<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say>Call blocked by Second Voice Colossus fraud protection.</Say>
  <Reject reason="rejected" />
</Response>`);
      return;
    }

    const snapshot = activeCallState.startBridge({
      caller_number: callerNumber,
      caller_label: 'PSTN / Carrier Bridged Caller',
      receiver_phone: primaryReceiver,
      routing_mode: 'TWILIO_RELAY',
    });

    broadcastPayload({
      type: 'STATE_SYNC',
      system_state: snapshot,
      transcripts: [],
      telegram_state: telegramNotifier.getPublicState(),
    });

    const host = req.get('host') || `127.0.0.1:${PORT}`;
    const wsProto = req.protocol === 'https' ? 'wss' : 'ws';

    res.type('text/xml').send(`<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Start>
    <Stream url="${wsProto}://${host}/api/v1/ws/protect" />
  </Start>
  <Dial callerId="${callerNumber}">
    <Number>${primaryReceiver}</Number>
  </Dial>
</Response>`);
  });

  app.post('/api/v1/telephony/mobile-hook', async (req, res) => {
    const caller_number = String(req.body?.caller_number ?? '+91 93110 44219');
    const receiver_phone = String(req.body?.receiver_phone ?? '+91 98450 71202');
    const transcript = String(req.body?.transcript ?? '');
    const speaker_leg = (String(req.body?.speaker_leg ?? 'CALLER').toUpperCase() || 'CALLER') as SpeakerLeg;

    if (isCallerBlocked(caller_number)) {
      res.json({
        directive: 'TERMINATE_CALL',
        reason: 'Caller is blacklisted in Second Voice database.',
        phase: 5,
      });
      return;
    }

    if (activeCallState.caller_number !== caller_number || activeCallState.bridge_status === 'ENDED') {
      activeCallState.startBridge({
        caller_number,
        caller_label: 'Mobile Dialer Hook',
        receiver_phone,
        routing_mode: 'ANDROID_CALL_SCREENING',
      });
    }

    if (!transcript.trim()) {
      res.json({
        directive: 'ALLOW',
        session_code: activeCallState.session_code,
        phase: activeCallState.highest_phase,
      });
      return;
    }

    const payload = await processIncomingTranscript(transcript, undefined, speaker_leg);
    const phase = payload.system_state.current_highest_phase;
    const directive =
      phase >= 5 ? 'TERMINATE_CALL' : phase >= 3 ? 'WHISPER_WARNING' : 'ALLOW';

    res.json({
      directive,
      session_code: payload.system_state.session_code,
      phase,
      risk_level: payload.system_state.latest_risk,
      counter_guidance: payload.analysis.counter_guidance,
      recorded_in_db: true,
    });
  });

  app.post('/api/v1/telephony/audio-chunk', async (req, res) => {
    const audioBase64 = String(req.body?.audioBase64 ?? '');
    const mimeType = String(req.body?.mimeType ?? 'audio/webm');
    const speakerLeg = (String(req.body?.speaker_leg ?? 'CALLER').toUpperCase() || 'CALLER') as SpeakerLeg;
    const callerNumber = req.body?.caller_number ? String(req.body.caller_number) : '';
    const receiverPhone = req.body?.receiver_phone ? String(req.body.receiver_phone) : '';

    if (!audioBase64) {
      res.status(400).json({ error: 'audioBase64 required' });
      return;
    }

    if (callerNumber && isCallerBlocked(callerNumber)) {
      res.json({
        directive: 'TERMINATE_CALL',
        blocked: true,
        reason: 'Caller is blacklisted in Second Voice database.',
      });
      return;
    }

    if (
      callerNumber &&
      (activeCallState.caller_number !== callerNumber || activeCallState.bridge_status === 'ENDED')
    ) {
      activeCallState.startBridge({
        caller_number: callerNumber,
        caller_label: 'Android Call Stream',
        receiver_phone: receiverPhone || activeCallState.receiver_phone,
        routing_mode: 'ANDROID_CALL_SCREENING',
      });
    }

    const transcript = await transcribeAudioChunk(audioBase64, mimeType);
    if (!transcript) {
      res.json({
        silent: true,
        directive: activeCallState.highest_phase >= 5 ? 'TERMINATE_CALL' : 'ALLOW',
      });
      return;
    }

    const payload = await processIncomingTranscript(transcript, undefined, speakerLeg);
    const phase = payload.system_state.current_highest_phase;
    const directive =
      phase >= 5 ? 'TERMINATE_CALL' : phase >= 3 ? 'WHISPER_WARNING' : 'ALLOW';

    res.json({
      ...payload,
      directive,
    });
  });

  // --- Stage Demo Triggers ---
  app.post('/api/v1/demo/trigger-isolation', async (req, res) => {
    const detectedPhase = Number(req.body?.detected_phase ?? 5);
    const riskLevel = (String(req.body?.risk_level ?? 'CRITICAL').toUpperCase() || 'CRITICAL') as RiskLevel;
    const triggerPhrases = Array.isArray(req.body?.trigger_phrases)
      ? req.body.trigger_phrases.map(String)
      : ['Do not tell your family', 'Lock your door immediately'];

    const transcript = `STAGE DEMO INJECTION: "${triggerPhrases.join('. ')}."`;
    const simulatedAnalysis: TranscriptAnalysis = {
      detected_phase: detectedPhase,
      confidence_score: 99,
      trigger_phrases: triggerPhrases,
      risk_level: riskLevel,
      coercion_fingerprint: 'STAGE DEMO OVERRIDE — Phase 5 Isolation Circuit Breaker',
      engine_source: 'demo-override',
      detected_language: 'English',
      counter_guidance:
        'CRITICAL ISOLATION BREACH. Disconnect immediately, inform family on an alternate phone, and dial 1930.',
    };

    const payload = await processIncomingTranscript(transcript, simulatedAnalysis, 'CALLER');
    res.json({ status: 'success', state: payload.system_state, payload });
  });

  app.post('/api/v1/demo/next-step', async (req, res) => {
    const explicitIndex =
      typeof req.body?.stepIndex === 'number' ? req.body.stepIndex : undefined;
    const idx =
      explicitIndex !== undefined
        ? Math.max(0, Math.min(MOCK_SCAM_SEQUENCE.length - 1, explicitIndex))
        : activeCallState.mockStep % MOCK_SCAM_SEQUENCE.length;

    const item = MOCK_SCAM_SEQUENCE[idx];
    activeCallState.mockStep = idx + 1;

    const payload = await processIncomingTranscript(
      item.transcript,
      {
        ...item.analysis,
        engine_source: 'mock-sequence',
      },
      'CALLER'
    );

    res.json({
      stepIndex: idx,
      totalSteps: MOCK_SCAM_SEQUENCE.length,
      ...payload,
    });
  });

  // --- Centralized SQLite Database Routes (Call Sessions, Phone Bindings, Reputation) ---
  app.post('/api/v1/generate-report', (req, res) => {
    const forceSave = Boolean(req.body?.force);
    if (!forceSave && activeCallState.highest_phase < 3) {
      res.json({
        status: 'insufficient_risk',
        message: 'Phase 3 or higher risk is recommended before filing a 1930 police report.',
      });
      return;
    }

    const snap = activeCallState.getSnapshot();
    const durationSec = Math.max(
      1,
      Math.round((Date.now() - new Date(activeCallState.started_at).getTime()) / 1000)
    );

    upsertCallSession({
      id: snap.session_id,
      session_code: snap.session_code,
      caller_number: snap.caller_number,
      caller_label: snap.caller_label,
      receiver_phone: snap.receiver_phone,
      routing_mode: snap.routing_mode,
      bridge_status: snap.bridge_status,
      highest_phase: snap.current_highest_phase,
      isolation_breached: snap.isolation_breached,
      risk_level: snap.latest_risk,
      trigger_phrases: snap.all_triggers,
      coercion_fingerprint: snap.fingerprint,
      transcript_excerpt:
        activeCallState.transcripts[0]?.transcript ||
        'Coercive call session recorded by Second Voice proxy.',
      telegram_dispatched: snap.telegram_dispatched,
      portal_status: snap.current_highest_phase >= 5 ? 'REPORTED_1930' : 'OPEN',
      started_at: snap.started_at,
      duration_sec: durationSec,
    });

    const latestRecord = listIncidentsFromDb().find((item) => item.id === snap.session_id);
    res.json({
      status: 'success',
      incident: latestRecord,
    });
  });

  app.get('/api/v1/incidents', (_req, res) => {
    res.json({ incidents: listIncidentsFromDb() });
  });

  app.patch('/api/v1/incidents/:id', (req, res) => {
    const status = req.body?.status;
    if (status !== 'OPEN' && status !== 'REPORTED_1930' && status !== 'ARCHIVED') {
      res.status(400).json({ error: 'Invalid status' });
      return;
    }
    const ok = updateIncidentStatusInDb(req.params.id, status);
    if (!ok) {
      res.status(404).json({ error: 'Incident not found' });
      return;
    }
    res.json({ updated: true });
  });

  app.delete('/api/v1/incidents/:id', (req, res) => {
    const removed = deleteIncidentInDb(req.params.id);
    if (!removed) {
      res.status(404).json({ error: 'Incident not found' });
      return;
    }
    res.json({ deleted: true });
  });

  app.get('/api/v1/phones', (_req, res) => {
    res.json({ phones: listPhoneBindings() });
  });

  app.post('/api/v1/phones', (req, res) => {
    const device_label = String(req.body?.device_label ?? '').trim();
    const mobile_number = String(req.body?.mobile_number ?? '').trim();
    const platform = String(req.body?.platform ?? 'ANDROID_DIALER') as
      | 'ANDROID_DIALER'
      | 'IOS_CALLKIT'
      | 'SIP_TRUNK';

    if (!device_label || !mobile_number) {
      res.status(400).json({ error: 'Device label and mobile number are required.' });
      return;
    }

    const created = addPhoneBinding({
      device_label,
      mobile_number,
      platform,
      auto_sever_phase5: req.body?.auto_sever_phase5 !== false,
      whisper_warning_enabled: req.body?.whisper_warning_enabled !== false,
    });
    res.json({ phone: created });
  });

  app.patch('/api/v1/phones/:id', (req, res) => {
    const ok = togglePhoneBinding(req.params.id, {
      active: req.body?.active,
      auto_sever_phase5: req.body?.auto_sever_phase5,
      whisper_warning_enabled: req.body?.whisper_warning_enabled,
    });
    if (!ok) {
      res.status(404).json({ error: 'Phone binding not found' });
      return;
    }
    res.json({ updated: true });
  });

  app.delete('/api/v1/phones/:id', (req, res) => {
    const ok = deletePhoneBinding(req.params.id);
    if (!ok) {
      res.status(404).json({ error: 'Phone binding not found' });
      return;
    }
    res.json({ deleted: true });
  });

  app.get('/api/v1/reputation', (_req, res) => {
    res.json({ callers: listCallerReputation() });
  });

  app.patch('/api/v1/reputation', (req, res) => {
    const phone_number = String(req.body?.phone_number ?? '');
    const blocked = Boolean(req.body?.blocked);
    if (!phone_number) {
      res.status(400).json({ error: 'phone_number required' });
      return;
    }
    const ok = setCallerBlocked(phone_number, blocked);
    if (!ok) {
      res.status(404).json({ error: 'Caller number not found' });
      return;
    }
    res.json({ updated: true });
  });

  // --- Telegram SOS Webhook ---
  app.get('/api/v1/telegram/config', (_req, res) => {
    res.json(telegramNotifier.getPublicState());
  });

  app.post('/api/v1/telegram/config', (req, res) => {
    const botToken = String(req.body?.botToken ?? '');
    const chatId = String(req.body?.chatId ?? '');
    const autoDispatchPhase5 = req.body?.autoDispatchPhase5 !== false;
    telegramNotifier.configure(botToken, chatId, autoDispatchPhase5);
    res.json(telegramNotifier.getPublicState());
  });

  app.post('/api/v1/telegram/test', async (_req, res) => {
    const phase = Math.max(5, activeCallState.highest_phase);
    const triggers = activeCallState.all_triggers.length
      ? activeCallState.all_triggers
      : ['Do not tell your family', 'Lock your door immediately'];
    const dispatched = await telegramNotifier.sendEmergencyAlert(
      phase,
      triggers,
      activeCallState.caller_number,
      true
    );
    res.json({
      dispatched,
      telegram_state: telegramNotifier.getPublicState(),
    });
  });

  // --- Deepfake Acoustic Evaluation ---
  app.post('/api/v1/deepfake/evaluate', async (req, res) => {
    const {
      syntheticProbability = 0.08,
      spectralFlatness = 0.21,
      zeroCrossingRate = 0.07,
      pitchStabilityHz = 142,
      harmonicRatio = 0.84,
    } = req.body ?? {};

    const forensicNote = await generateForensicAudioComment({
      syntheticProbability: Number(syntheticProbability),
      spectralFlatness: Number(spectralFlatness),
      zeroCrossingRate: Number(zeroCrossingRate),
      pitchStabilityHz: Number(pitchStabilityHz),
      harmonicRatio: Number(harmonicRatio),
    });

    res.json({ forensicNote });
  });

  // --- Vite Dev Middleware / Production Static Assets ---
  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distDir));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });
  }

  server.listen(PORT, '0.0.0.0', () => {
    console.log(`Second Voice Colossus listening on http://0.0.0.0:${PORT}`);
  });
}

startServer();

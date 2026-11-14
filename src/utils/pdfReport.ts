import { jsPDF } from 'jspdf';
import type { BridgeStatus, IncidentRecord, RoutingMode } from '../types/colossus';

export function downloadIncidentPdf(incident: {
  session_code: string;
  caller_number?: string;
  receiver_phone?: string;
  routing_mode?: RoutingMode;
  timestamp: string;
  highest_phase: number;
  isolation_breached: boolean;
  risk_level: string;
  trigger_phrases: string[];
  coercion_fingerprint: string;
  transcript_excerpt?: string;
  telegram_dispatched?: boolean;
}) {
  const doc = new jsPDF({ unit: 'pt', format: 'a4' });
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 48;
  const maxWidth = pageWidth - margin * 2;
  let y = 56;

  // Header bar
  doc.setFillColor(10, 15, 29);
  doc.rect(0, 0, pageWidth, 88, 'F');

  doc.setTextColor(0, 229, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.text('SECOND VOICE COLOSSUS — INCIDENT REPORT', margin, 40);

  doc.setTextColor(203, 213, 225);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.text('Prepared for National Cybercrime Reporting Portal (Helpline 1930 / cybercrime.gov.in)', margin, 62);

  y = 116;

  // Session Metadata Block
  doc.setTextColor(15, 23, 42);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.text(`Session Reference: ${incident.session_code}`, margin, y);
  y += 20;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(71, 85, 105);
  if (incident.caller_number || incident.receiver_phone) {
    doc.text(
      `Call Bridge Path: ${incident.caller_number ?? 'Unknown'} -> ${incident.receiver_phone ?? 'Protected Mobile'} (${incident.routing_mode ?? 'PROXY'})`,
      margin,
      y
    );
    y += 18;
  }
  doc.text(`Recorded Timestamp (UTC): ${incident.timestamp}`, margin, y);
  y += 18;
  doc.text(`Highest Threat Phase Reached: Phase ${incident.highest_phase} of 7 (${incident.risk_level})`, margin, y);
  y += 18;
  doc.text(
    `Isolation Tactics Breached: ${incident.isolation_breached ? 'YES — CRITICAL PHASE 5+ TRIGGERED' : 'NO'}`,
    margin,
    y
  );
  y += 18;
  doc.text(
    `Family Emergency SOS Dispatched: ${incident.telegram_dispatched ? 'YES (Telegram Hook)' : 'NO / NOT CONFIGURED'}`,
    margin,
    y
  );

  y += 22;
  doc.setDrawColor(203, 213, 225);
  doc.line(margin, y, pageWidth - margin, y);
  y += 24;

  // Behavioral Fingerprint
  doc.setTextColor(15, 23, 42);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.text('Primary Psychological Coercion Fingerprint', margin, y);
  y += 18;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  const fpLines = doc.splitTextToSize(incident.coercion_fingerprint || 'Not classified', maxWidth);
  doc.text(fpLines, margin, y);
  y += fpLines.length * 14 + 16;

  // Detected Trigger Phrases
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.text('Detected Cybercrime & Coercion Trigger Phrases', margin, y);
  y += 18;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  if (incident.trigger_phrases.length === 0) {
    doc.text('• No coercive trigger phrases logged during this session.', margin, y);
    y += 18;
  } else {
    for (const phrase of incident.trigger_phrases) {
      const lines = doc.splitTextToSize(`• "${phrase}"`, maxWidth);
      doc.text(lines, margin, y);
      y += lines.length * 14 + 4;
    }
  }

  y += 12;

  // Transcript Excerpt (Zero Raw Audio Storage Notice)
  if (incident.transcript_excerpt) {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.text('Captured Transcript Evidence Excerpt (Zero Raw Audio Retained)', margin, y);
    y += 18;

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.setTextColor(51, 65, 85);
    const excerptLines = doc.splitTextToSize(`"${incident.transcript_excerpt}"`, maxWidth);
    doc.text(excerptLines, margin, y);
    y += excerptLines.length * 14 + 20;
  }

  // Advisory Footer Box
  doc.setDrawColor(14, 165, 233);
  doc.setFillColor(240, 249, 255);
  doc.roundedRect(margin, y, maxWidth, 74, 6, 6, 'FD');

  doc.setTextColor(12, 74, 110);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.text('Statutory Advisory for Cyber Cell Submission', margin + 14, y + 22);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9.5);
  const advisory = doc.splitTextToSize(
    'No Indian law enforcement agency (CBI, ED, Police, Customs, or RBI) conducts "Digital Arrest" via video call or demands verification transfers. Preserve call logs, UPI/RTGS UTR numbers, and submit immediately at cybercrime.gov.in or dial 1930.',
    maxWidth - 28
  );
  doc.text(advisory, margin + 14, y + 38);

  const safeCode = incident.session_code.replace(/[^a-zA-Z0-9_-]/g, '_');
  doc.save(`SecondVoice_1930_Report_${safeCode}.pdf`);
}

export function buildIncidentFromActiveState(params: {
  sessionCode?: string;
  callerNumber?: string;
  callerLabel?: string;
  receiverPhone?: string;
  routingMode?: RoutingMode;
  bridgeStatus?: BridgeStatus;
  highestPhase: number;
  isIsolated: boolean;
  riskLevel: string;
  triggers: string[];
  fingerprint: string;
  excerpt: string;
  telegramDispatched: boolean;
}): IncidentRecord {
  return {
    id: `local_${Date.now()}`,
    session_code: params.sessionCode ?? `SV-${Math.floor(200 + Math.random() * 799)}`,
    caller_number: params.callerNumber ?? '+91 93110 44219',
    caller_label: params.callerLabel ?? 'Incoming Caller',
    receiver_phone: params.receiverPhone ?? '+91 98450 71202',
    routing_mode: params.routingMode ?? 'ANDROID_CALL_SCREENING',
    bridge_status: params.bridgeStatus ?? 'BRIDGED',
    timestamp: new Date().toISOString(),
    duration_sec: 0,
    highest_phase: params.highestPhase,
    isolation_breached: params.isIsolated,
    risk_level: params.riskLevel as IncidentRecord['risk_level'],
    trigger_phrases: params.triggers,
    coercion_fingerprint: params.fingerprint,
    transcript_excerpt: params.excerpt,
    telegram_dispatched: params.telegramDispatched,
    status: params.highestPhase >= 5 ? 'REPORTED_1930' : 'OPEN',
  };
}

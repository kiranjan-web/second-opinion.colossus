import React, { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import {
  Check,
  Code2,
  Copy,
  ExternalLink,
  PhoneForwarded,
  Plus,
  QrCode,
  Send,
  ShieldAlert,
  ShieldBan,
  ShieldCheck,
  Smartphone,
  Trash2,
} from 'lucide-react';
import type { CallerReputation, PhoneBinding } from '../types/colossus';

interface MobileIntegrationViewProps {
  phones: PhoneBinding[];
  reputation: CallerReputation[];
  onRefreshData: () => Promise<void>;
  onStartSimulatedCall: (params: {
    caller_number: string;
    caller_label: string;
    receiver_phone: string;
    routing_mode: 'ANDROID_CALL_SCREENING' | 'CARRIER_FORWARD' | 'TWILIO_RELAY';
  }) => Promise<void>;
  onOpenMobileMode: () => void;
}

export function MobileIntegrationView({
  phones,
  reputation,
  onRefreshData,
  onStartSimulatedCall,
  onOpenMobileMode,
}: MobileIntegrationViewProps) {
  const [deviceLabel, setDeviceLabel] = useState('');
  const [mobileNumber, setMobileNumber] = useState('');
  const [platform, setPlatform] = useState<PhoneBinding['platform']>('ANDROID_DIALER');
  const [autoSever, setAutoSever] = useState(true);
  const [whisperAlert, setWhisperAlert] = useState(true);
  const [saving, setSaving] = useState(false);

  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [hookTestResult, setHookTestResult] = useState<string | null>(null);
  const [testingHook, setTestingHook] = useState(false);
  const [qrDataUrl, setQrDataUrl] = useState<string>('');
  const [showKotlinSnippet, setShowKotlinSnippet] = useState(false);

  const originUrl = typeof window !== 'undefined' ? window.location.origin : 'https://your-server.example';
  const mobileCompanionUrl = `${originUrl}/?mode=mobile`;
  const mobileHookUrl = `${originUrl}/api/v1/telephony/mobile-hook`;
  const twimlUrl = `${originUrl}/api/v1/telephony/twiml`;

  useEffect(() => {
    QRCode.toDataURL(mobileCompanionUrl, {
      width: 180,
      margin: 1,
      color: {
        dark: '#0A0F1D',
        light: '#F8FAFC',
      },
    })
      .then(setQrDataUrl)
      .catch(() => undefined);
  }, [mobileCompanionUrl]);

  const kotlinSnippet = `object SecondVoiceConfig {
    var serverBaseUrl: String = "${originUrl}"
    var protectedMobileNumber: String = "${phones[0]?.mobile_number ?? '+91 98450 71202'}"
}`;

  const handleCopy = (key: string, value: string) => {
    navigator.clipboard.writeText(value).catch(() => undefined);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const handleBindPhone = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!deviceLabel.trim() || !mobileNumber.trim()) return;
    setSaving(true);
    try {
      const res = await fetch('/api/v1/phones', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          device_label: deviceLabel.trim(),
          mobile_number: mobileNumber.trim(),
          platform,
          auto_sever_phase5: autoSever,
          whisper_warning_enabled: whisperAlert,
        }),
      });
      if (res.ok) {
        setDeviceLabel('');
        setMobileNumber('');
        await onRefreshData();
      }
    } finally {
      setSaving(false);
    }
  };

  const handleTogglePhone = async (
    id: string,
    patch: Partial<Pick<PhoneBinding, 'active' | 'auto_sever_phase5' | 'whisper_warning_enabled'>>
  ) => {
    await fetch(`/api/v1/phones/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(patch),
    });
    await onRefreshData();
  };

  const handleDeletePhone = async (id: string) => {
    await fetch(`/api/v1/phones/${id}`, { method: 'DELETE' });
    await onRefreshData();
  };

  const handleToggleBlockCaller = async (phone_number: string, blocked: boolean) => {
    await fetch('/api/v1/reputation', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone_number, blocked }),
    });
    await onRefreshData();
  };

  const handleTestMobileWebhook = async () => {
    setTestingHook(true);
    setHookTestResult(null);
    const targetReceiver = phones.find((p) => p.active)?.mobile_number ?? '+91 98450 71202';
    try {
      const res = await fetch('/api/v1/telephony/mobile-hook', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          caller_number: '+91 98112 60448',
          receiver_phone: targetReceiver,
          speaker_leg: 'CALLER',
          transcript:
            'This is Inspector Sharma from Mumbai Cyber Crime Cell. Do not tell your family and stay on WhatsApp video.',
        }),
      });
      const data = await res.json();
      setHookTestResult(
        `Directive returned: ${data.directive} (Phase ${data.phase}/7 · Session ${data.session_code} saved to SQLite database)`
      );
      await onRefreshData();
    } finally {
      setTestingHook(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Android Mobile Companion QR Pairing + Native Kotlin Bridge */}
      <section className="bg-[#131C31] border border-white/10 rounded-xl p-6">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-center">
          <div className="lg:col-span-8 space-y-3">
            <div className="flex items-center gap-2 text-xs font-semibold text-cyan-400">
              <QrCode className="w-4 h-4" />
              <span>Android Mobile Pairing &amp; Live Call Recording Bridge</span>
            </div>
            <h2 className="text-lg font-semibold text-white">
              Connect Your Android Phone in Seconds
            </h2>
            <p className="text-xs text-slate-400 leading-relaxed max-w-2xl">
              Scan the QR code in Android Chrome to launch &amp; install the <strong className="text-slate-200">Second Voice Android PWA</strong>. During any speakerphone or Bluetooth call, it runs 0ms keyword spot beeps + hardware vibration and streams rolling 4-second live call audio chunks to the server SQLite database (zero recordings stored on your phone).
            </p>

            <div className="flex flex-wrap items-center gap-2 pt-1">
              <div className="flex-1 min-w-[220px] flex items-center justify-between gap-2 bg-[#0A0F1D] border border-white/15 rounded-lg px-3 py-2 font-mono text-xs text-slate-200">
                <span className="truncate">{mobileCompanionUrl}</span>
                <button
                  type="button"
                  onClick={() => handleCopy('mobile-url', mobileCompanionUrl)}
                  aria-label="Copy Android Mobile URL"
                  className="text-slate-400 hover:text-white shrink-0"
                >
                  {copiedKey === 'mobile-url' ? (
                    <Check className="w-3.5 h-3.5 text-emerald-400" />
                  ) : (
                    <Copy className="w-3.5 h-3.5" />
                  )}
                </button>
              </div>
              <button
                type="button"
                onClick={onOpenMobileMode}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-cyan-400 text-slate-950 text-xs font-semibold hover:bg-cyan-300 transition-colors whitespace-nowrap"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                Open Android Mobile View
              </button>
              <button
                type="button"
                onClick={() => setShowKotlinSnippet((v) => !v)}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-[#0A0F1D] border border-white/15 text-xs font-medium text-slate-200 hover:border-cyan-400 transition-colors whitespace-nowrap"
              >
                <Code2 className="w-3.5 h-3.5 text-cyan-400" />
                {showKotlinSnippet ? 'Hide Native Kotlin Config' : 'Native Android Dialer Kotlin'}
              </button>
            </div>

            {showKotlinSnippet && (
              <div className="mt-3 p-4 rounded-lg bg-[#0A0F1D] border border-white/10 space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-300 font-medium">
                    Native OS CallScreeningService &amp; Live Call Recorder (<span className="font-mono text-cyan-300">android-companion/SecondVoiceCallBridge.kt</span>)
                  </span>
                  <button
                    type="button"
                    onClick={() => handleCopy('kotlin-cfg', kotlinSnippet)}
                    className="inline-flex items-center gap-1 text-cyan-400 hover:underline"
                  >
                    {copiedKey === 'kotlin-cfg' ? 'Copied' : 'Copy Config'}
                  </button>
                </div>
                <pre className="text-[11px] font-mono text-cyan-200 overflow-x-auto leading-relaxed">
                  {kotlinSnippet}
                </pre>
              </div>
            )}
          </div>

          <div className="lg:col-span-4 flex flex-col items-center justify-center bg-[#0A0F1D] border border-white/10 rounded-xl p-4">
            {qrDataUrl ? (
              <img
                src={qrDataUrl}
                alt="QR code to open Second Voice Android Mobile Companion"
                className="w-40 h-40 rounded-lg"
              />
            ) : (
              <div className="w-40 h-40 rounded-lg bg-[#131C31] flex items-center justify-center text-xs text-slate-400">
                Generating QR...
              </div>
            )}
            <span className="mt-2.5 text-[11px] text-slate-400 text-center">
              Scan on Android Camera → Chrome → Install App
            </span>
          </div>
        </div>
      </section>

      {/* Architecture Explainer Strip */}
      <section className="bg-[#131C31] border border-white/10 rounded-xl p-6">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold text-white">
              Mobile Call App &amp; Carrier Proxy Integration
            </h2>
            <p className="text-xs text-slate-400 mt-1 max-w-3xl leading-relaxed">
              Second Voice sits between the external caller and your mobile phone via Carrier Conditional Forwarding, Android CallScreeningService, or a Twilio SIP Relay—writing all call legs, caller IDs, and coercion records into the centralized server database rather than storing data on the phone.
            </p>
          </div>
          <button
            type="button"
            disabled={testingHook}
            onClick={handleTestMobileWebhook}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-cyan-400 text-slate-950 text-xs font-semibold hover:bg-cyan-300 disabled:opacity-50 transition-colors whitespace-nowrap shrink-0"
          >
            <Send className="w-3.5 h-3.5" />
            {testingHook ? 'Sending Hook...' : 'Simulate Mobile Dialer Hook'}
          </button>
        </div>

        {hookTestResult && (
          <div className="mt-4 p-3 rounded-lg bg-[#0A0F1D] border border-cyan-400/40 text-xs text-cyan-200 font-mono">
            {hookTestResult}
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-5 pt-5 border-t border-white/10">
          <div className="bg-[#0A0F1D] border border-white/10 rounded-lg p-4 space-y-2">
            <div className="text-xs font-semibold text-cyan-400">
              1. Carrier Conditional Forward (Any Phone)
            </div>
            <p className="text-xs text-slate-400 leading-relaxed">
              Dial GSM MMI code to route unanswered or screened calls through the Second Voice proxy relay before ringing your handset:
            </p>
            <div className="flex items-center justify-between gap-2 bg-[#131C31] border border-white/10 rounded px-2.5 py-1.5 font-mono text-xs text-slate-200">
              <span className="truncate">*61*+918045681930#</span>
              <button
                type="button"
                onClick={() => handleCopy('mmi', '*61*+918045681930#')}
                aria-label="Copy GSM forwarding code"
                className="text-slate-400 hover:text-white shrink-0"
              >
                {copiedKey === 'mmi' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              </button>
            </div>
          </div>

          <div className="bg-[#0A0F1D] border border-white/10 rounded-lg p-4 space-y-2">
            <div className="text-xs font-semibold text-cyan-400">
              2. Android CallScreeningService Webhook
            </div>
            <p className="text-xs text-slate-400 leading-relaxed">
              Stream live call-leg captions or caller ID metadata from your mobile dialer bridge directly into the server SQLite database:
            </p>
            <div className="flex items-center justify-between gap-2 bg-[#131C31] border border-white/10 rounded px-2.5 py-1.5 font-mono text-xs text-slate-200">
              <span className="truncate">{mobileHookUrl}</span>
              <button
                type="button"
                onClick={() => handleCopy('hook', mobileHookUrl)}
                aria-label="Copy mobile hook URL"
                className="text-slate-400 hover:text-white shrink-0"
              >
                {copiedKey === 'hook' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              </button>
            </div>
          </div>

          <div className="bg-[#0A0F1D] border border-white/10 rounded-lg p-4 space-y-2">
            <div className="text-xs font-semibold text-cyan-400">
              3. Twilio / SIP B2BUA Voice Relay
            </div>
            <p className="text-xs text-slate-400 leading-relaxed">
              Point your Twilio Voice or SIP trunk incoming webhook here to bridge Caller → Server Stream → Mobile Receiver:
            </p>
            <div className="flex items-center justify-between gap-2 bg-[#131C31] border border-white/10 rounded px-2.5 py-1.5 font-mono text-xs text-slate-200">
              <span className="truncate">{twimlUrl}</span>
              <button
                type="button"
                onClick={() => handleCopy('twiml', twimlUrl)}
                aria-label="Copy TwiML URL"
                className="text-slate-400 hover:text-white shrink-0"
              >
                {copiedKey === 'twiml' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* Bound Mobile Phones + Add Binding Form */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-stretch">
        <section className="xl:col-span-7 bg-[#131C31] border border-white/10 rounded-xl p-6">
          <div className="flex items-center justify-between gap-4 mb-4">
            <div>
              <h3 className="text-base font-semibold text-white">
                Bound Mobile Phones (Server Database)
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Handsets routed behind the Second Voice proxy relay
              </p>
            </div>
            <Smartphone className="w-5 h-5 text-cyan-400" />
          </div>

          <div className="divide-y divide-white/10 border-t border-white/10">
            {phones.map((phone) => (
              <div
                key={phone.id}
                className="py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4"
              >
                <div className="space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-semibold text-white">
                      {phone.device_label}
                    </span>
                    <span className="text-slate-500" aria-hidden="true">·</span>
                    <span className="font-mono text-xs text-cyan-300 tabular-nums">
                      {phone.mobile_number}
                    </span>
                  </div>
                  <div className="text-xs text-slate-400 font-mono">
                    {phone.platform} · Proxy {phone.proxy_number}
                  </div>
                  <div className="flex flex-wrap items-center gap-4 pt-1 text-xs">
                    <label className="inline-flex items-center gap-1.5 text-slate-300 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={phone.auto_sever_phase5}
                        onChange={(e) =>
                          handleTogglePhone(phone.id, { auto_sever_phase5: e.target.checked })
                        }
                        className="rounded border-slate-600 bg-[#0A0F1D] text-cyan-400"
                      />
                      Auto-Sever Phase 5+
                    </label>
                    <label className="inline-flex items-center gap-1.5 text-slate-300 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={phone.whisper_warning_enabled}
                        onChange={(e) =>
                          handleTogglePhone(phone.id, { whisper_warning_enabled: e.target.checked })
                        }
                        className="rounded border-slate-600 bg-[#0A0F1D] text-cyan-400"
                      />
                      Whisper Alert to Receiver
                    </label>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={() =>
                      onStartSimulatedCall({
                        caller_number: '+91 93110 44219',
                        caller_label: 'Incoming Bridged Call',
                        receiver_phone: phone.mobile_number,
                        routing_mode:
                          phone.platform === 'IOS_CALLKIT'
                            ? 'CARRIER_FORWARD'
                            : phone.platform === 'SIP_TRUNK'
                            ? 'TWILIO_RELAY'
                            : 'ANDROID_CALL_SCREENING',
                      })
                    }
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#0A0F1D] border border-white/15 text-xs font-medium text-slate-100 hover:border-cyan-400 transition-colors whitespace-nowrap"
                  >
                    <PhoneForwarded className="w-3.5 h-3.5 text-cyan-400" />
                    Route Test Call
                  </button>
                  <button
                    type="button"
                    onClick={() => handleTogglePhone(phone.id, { active: !phone.active })}
                    className={`px-2.5 py-1.5 rounded-lg border text-xs font-medium transition-colors whitespace-nowrap ${
                      phone.active
                        ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-300'
                        : 'bg-slate-900 border-white/10 text-slate-400'
                    }`}
                  >
                    {phone.active ? 'Armed' : 'Paused'}
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDeletePhone(phone.id)}
                    aria-label={`Remove ${phone.device_label}`}
                    className="p-1.5 rounded-md text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Bind New Phone Form */}
        <section className="xl:col-span-5 bg-[#131C31] border border-white/10 rounded-xl p-6">
          <h3 className="text-base font-semibold text-white mb-1">
            Bind Protected Mobile Phone
          </h3>
          <p className="text-xs text-slate-400 mb-4">
            Register a family member or personal handset into the SQLite routing table
          </p>

          <form onSubmit={handleBindPhone} className="space-y-4">
            <div>
              <label htmlFor="device-label" className="block text-xs font-medium text-slate-300 mb-1.5">
                Device / Owner Label
              </label>
              <input
                id="device-label"
                type="text"
                value={deviceLabel}
                onChange={(e) => setDeviceLabel(e.target.value)}
                placeholder="e.g., Parents Pixel 8 / Personal iPhone"
                className="w-full bg-[#0A0F1D] border border-white/15 rounded-lg px-3.5 py-2 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-cyan-400"
              />
            </div>

            <div>
              <label htmlFor="mobile-num" className="block text-xs font-medium text-slate-300 mb-1.5">
                Mobile Phone Number (E.164)
              </label>
              <input
                id="mobile-num"
                type="text"
                value={mobileNumber}
                onChange={(e) => setMobileNumber(e.target.value)}
                placeholder="+91 98450 71202"
                className="w-full bg-[#0A0F1D] border border-white/15 rounded-lg px-3.5 py-2 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-cyan-400 font-mono"
              />
            </div>

            <div>
              <label htmlFor="platform-select" className="block text-xs font-medium text-slate-300 mb-1.5">
                Call App Integration Method
              </label>
              <select
                id="platform-select"
                value={platform}
                onChange={(e) => setPlatform(e.target.value as PhoneBinding['platform'])}
                className="w-full bg-[#0A0F1D] border border-white/15 rounded-lg px-3.5 py-2 text-sm text-white focus:outline-none focus:border-cyan-400"
              >
                <option value="ANDROID_DIALER">Android CallScreeningService + Webhook</option>
                <option value="IOS_CALLKIT">iOS Carrier Conditional Forward (*61*)</option>
                <option value="SIP_TRUNK">Twilio / SIP B2BUA Proxy Relay</option>
              </select>
            </div>

            <div className="space-y-2 pt-1 text-xs text-slate-300">
              <label className="flex items-center gap-2.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={autoSever}
                  onChange={(e) => setAutoSever(e.target.checked)}
                  className="rounded border-slate-600 bg-[#0A0F1D] text-cyan-400"
                />
                Automatically sever call bridge if Phase 5 isolation is detected
              </label>
              <label className="flex items-center gap-2.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={whisperAlert}
                  onChange={(e) => setWhisperAlert(e.target.checked)}
                  className="rounded border-slate-600 bg-[#0A0F1D] text-cyan-400"
                />
                Inject receiver-only warning whisper when Phase 3+ triggers
              </label>
            </div>

            <button
              type="submit"
              disabled={saving || !deviceLabel.trim() || !mobileNumber.trim()}
              className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-cyan-400 text-slate-950 text-sm font-semibold hover:bg-cyan-300 disabled:opacity-50 transition-colors"
            >
              <Plus className="w-4 h-4" />
              {saving ? 'Binding Device...' : 'Save Mobile Binding to Database'}
            </button>
          </form>
        </section>
      </div>

      {/* Caller Reputation Registry (SQLite) */}
      <section className="bg-[#131C31] border border-white/10 rounded-xl p-6">
        <div className="flex items-center justify-between gap-4 mb-4">
          <div>
            <h3 className="text-base font-semibold text-white">
              Intercepted Caller Reputation Registry
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Centralized caller blocklist enforced at the proxy before ringing your mobile handset
            </p>
          </div>
          <ShieldAlert className="w-5 h-5 text-rose-400" />
        </div>

        <div className="overflow-x-auto border-t border-white/10">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-white/10 text-xs text-slate-400 font-medium">
                <th className="py-3 pr-4">Caller Number</th>
                <th className="py-3 px-4">Last Behavioral Fingerprint</th>
                <th className="py-3 px-4 text-right">Incidents</th>
                <th className="py-3 px-4 text-right">Peak Phase</th>
                <th className="py-3 pl-4 text-right">Proxy Gate</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/10 text-sm">
              {reputation.map((rep) => (
                <tr key={rep.phone_number}>
                  <td className="py-3 pr-4 font-mono text-xs font-semibold text-white whitespace-nowrap tabular-nums">
                    {rep.phone_number}
                  </td>
                  <td className="py-3 px-4 text-xs text-slate-300 max-w-md truncate">
                    {rep.last_fingerprint}
                  </td>
                  <td className="py-3 px-4 text-right font-mono text-xs text-slate-300 tabular-nums">
                    {rep.reported_count}
                  </td>
                  <td
                    className={`py-3 px-4 text-right font-mono text-xs font-semibold tabular-nums ${
                      rep.highest_phase_seen >= 5 ? 'text-rose-400' : 'text-amber-400'
                    }`}
                  >
                    Phase {rep.highest_phase_seen}/7
                  </td>
                  <td className="py-3 pl-4 text-right whitespace-nowrap">
                    <button
                      type="button"
                      onClick={() => handleToggleBlockCaller(rep.phone_number, !rep.blocked)}
                      className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-md border text-xs font-medium transition-colors ${
                        rep.blocked
                          ? 'bg-rose-500/15 border-rose-500/40 text-rose-300 hover:bg-rose-500/25'
                          : 'bg-[#0A0F1D] border-white/15 text-slate-300 hover:text-white'
                      }`}
                    >
                      {rep.blocked ? (
                        <>
                          <ShieldBan className="w-3.5 h-3.5" />
                          Blocked (Auto-Reject)
                        </>
                      ) : (
                        <>
                          <ShieldCheck className="w-3.5 h-3.5 text-cyan-400" />
                          Screened (Click to Block)
                        </>
                      )}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

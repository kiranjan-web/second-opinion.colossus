import { useCallback, useEffect, useRef, useState } from 'react';
import {
  AudioWaveform,
  BellRing,
  Database,
  Layers,
  Menu,
  PhoneForwarded,
  Shield,
  ShieldAlert,
  ShieldCheck,
  Smartphone,
  X,
} from 'lucide-react';
import { ActiveShieldView } from './components/ActiveShieldView';
import { DeepfakeScannerView } from './components/DeepfakeScannerView';
import { VerificationHubView } from './components/VerificationHubView';
import { TelegramSetupView } from './components/TelegramSetupView';
import { ReportHistoryView } from './components/ReportHistoryView';
import { MobileIntegrationView } from './components/MobileIntegrationView';
import { AndroidMobileCompanion } from './components/AndroidMobileCompanion';
import { FloatingOverlayHud } from './components/FloatingOverlayHud';
import { PWAInstallButton } from './components/PWAInstallButton';
import { OfflineIndicator } from './components/OfflineIndicator';
import { ErrorBoundary } from './components/ErrorBoundary';
import { buildIncidentFromActiveState, downloadIncidentPdf } from './utils/pdfReport';
import type {
  CallerReputation,
  IncidentRecord,
  PhoneBinding,
  RoutingMode,
  SpeakerLeg,
  StateSnapshot,
  TelegramConfigState,
  TranscriptEntry,
} from './types/colossus';

type NavTab = 'shield' | 'bridge' | 'deepfake' | 'verification' | 'telegram' | 'vault';

const INITIAL_STATE: StateSnapshot = {
  session_id: 'sess_init',
  session_code: 'SV-107',
  caller_number: '+91 93110 44219',
  caller_label: 'Unknown Incoming Caller',
  receiver_phone: '+91 98450 71202',
  routing_mode: 'ANDROID_CALL_SCREENING',
  bridge_status: 'BRIDGED',
  started_at: new Date().toISOString(),
  timestamp: new Date().toISOString(),
  current_highest_phase: 0,
  isolation_breached: false,
  latest_risk: 'SECURE',
  fingerprint: 'System monitoring active — zero threats detected',
  all_triggers: [],
  telegram_dispatched: false,
};

const NAV_ITEMS: Array<{ id: NavTab; label: string; icon: typeof Shield }> = [
  { id: 'shield', label: 'Active Shield', icon: Shield },
  { id: 'bridge', label: 'Mobile & Call Bridge', icon: PhoneForwarded },
  { id: 'deepfake', label: 'Voice Authenticator', icon: AudioWaveform },
  { id: 'verification', label: 'Verification Hub', icon: ShieldCheck },
  { id: 'telegram', label: 'Telegram SOS', icon: BellRing },
  { id: 'vault', label: 'Server DB Vault', icon: Database },
];

export default function App() {
  const [activeTab, setActiveTab] = useState<NavTab>('shield');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [showFloatingHud, setShowFloatingHud] = useState(true);
  const [isMobileCompanionMode, setIsMobileCompanionMode] = useState(() => {
    if (typeof window === 'undefined') return false;
    return new URLSearchParams(window.location.search).get('mode') === 'mobile';
  });

  const [systemState, setSystemState] = useState<StateSnapshot>(INITIAL_STATE);
  const [transcripts, setTranscripts] = useState<TranscriptEntry[]>([]);
  const [telegramState, setTelegramState] = useState<TelegramConfigState | null>(null);
  const [incidents, setIncidents] = useState<IncidentRecord[]>([]);
  const [incidentsLoading, setIncidentsLoading] = useState(true);
  const [phones, setPhones] = useState<PhoneBinding[]>([]);
  const [reputation, setReputation] = useState<CallerReputation[]>([]);

  const [wsConnected, setWsConnected] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const wsRef = useRef<WebSocket | null>(null);

  const pushToast = useCallback((msg: string) => {
    setToast(msg);
    setTimeout(() => {
      setToast((prev) => (prev === msg ? null : prev));
    }, 4000);
  }, []);

  const fetchDatabaseTables = useCallback(async () => {
    setIncidentsLoading(true);
    try {
      const [incRes, phoneRes, repRes] = await Promise.all([
        fetch('/api/v1/incidents'),
        fetch('/api/v1/phones'),
        fetch('/api/v1/reputation'),
      ]);
      if (incRes.ok) {
        const data = await incRes.json();
        setIncidents(data.incidents ?? []);
      }
      if (phoneRes.ok) {
        const data = await phoneRes.json();
        setPhones(data.phones ?? []);
      }
      if (repRes.ok) {
        const data = await repRes.json();
        setReputation(data.callers ?? []);
      }
    } finally {
      setIncidentsLoading(false);
    }
  }, []);

  const fetchTelegramState = useCallback(async () => {
    try {
      const res = await fetch('/api/v1/telegram/config');
      if (res.ok) {
        setTelegramState(await res.json());
      }
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    fetchDatabaseTables();
    fetchTelegramState();

    fetch('/api/v1/status')
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data?.system_state) setSystemState(data.system_state);
        if (Array.isArray(data?.transcripts)) setTranscripts(data.transcripts);
        if (data?.telegram_state) setTelegramState(data.telegram_state);
      })
      .catch(() => undefined);

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}/api/v1/ws/protect`;
    let socket: WebSocket | null = null;

    try {
      socket = new WebSocket(wsUrl);
      wsRef.current = socket;

      socket.onopen = () => setWsConnected(true);
      socket.onclose = () => setWsConnected(false);
      socket.onerror = () => setWsConnected(false);

      socket.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data);
          if (msg.type === 'STATE_SYNC' || msg.type === 'STATE_RESET') {
            if (msg.system_state) setSystemState(msg.system_state);
            if (Array.isArray(msg.transcripts)) setTranscripts(msg.transcripts);
            if (msg.telegram_state) setTelegramState(msg.telegram_state);
            fetchDatabaseTables();
            return;
          }

          if (msg.system_state) setSystemState(msg.system_state);
          if (msg.telegram_state) setTelegramState(msg.telegram_state);
          if (msg.entry) {
            setTranscripts((prev) => {
              if (prev.some((p) => p.id === msg.entry.id)) return prev;
              return [msg.entry, ...prev];
            });
            fetchDatabaseTables();
          }
        } catch {
          // ignore malformed payload
        }
      };
    } catch {
      setWsConnected(false);
    }

    return () => {
      if (socket && socket.readyState === WebSocket.OPEN) {
        socket.close();
      }
    };
  }, [fetchDatabaseTables, fetchTelegramState]);

  const handleAnalyzeText = async (text: string, speakerLeg: SpeakerLeg = 'CALLER') => {
    setIsAnalyzing(true);
    try {
      const res = await fetch('/api/v1/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ transcript: text, speaker_leg: speakerLeg }),
      });
      if (res.ok) {
        const payload = await res.json();
        if (payload.system_state) setSystemState(payload.system_state);
        if (payload.telegram_state) setTelegramState(payload.telegram_state);
        if (payload.entry) {
          setTranscripts((prev) => {
            if (prev.some((p) => p.id === payload.entry.id)) return prev;
            return [payload.entry, ...prev];
          });
        }
        await fetchDatabaseTables();
      }
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleStartBridge = async (params: {
    caller_number: string;
    caller_label: string;
    receiver_phone: string;
    routing_mode: RoutingMode;
  }) => {
    const res = await fetch('/api/v1/bridge/start', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params),
    });
    if (res.ok) {
      const data = await res.json();
      if (data.blocked) {
        pushToast(`Blocked at Proxy: ${data.reason}`);
        return;
      }
      if (data.system_state) setSystemState(data.system_state);
      setTranscripts([]);
      setActiveTab('shield');
      await fetchDatabaseTables();
      pushToast(`Bridged call ${data.system_state.session_code} active between caller and ${params.receiver_phone}.`);
    }
  };

  const handleBridgeAction = async (
    action: 'WHISPER_ALERT' | 'TERMINATED_BY_SHIELD' | 'ENDED'
  ) => {
    const res = await fetch('/api/v1/bridge/action', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action }),
    });
    if (res.ok) {
      const data = await res.json();
      if (data.system_state) setSystemState(data.system_state);
      await fetchDatabaseTables();
      if (action === 'TERMINATED_BY_SHIELD') {
        pushToast('Call bridge severed and caller number blacklisted in SQLite database.');
      } else if (action === 'WHISPER_ALERT') {
        pushToast('Spoken warning whisper dispatched to protected mobile receiver.');
      }
    }
  };

  const handleAdvanceDemoStep = async () => {
    setIsAnalyzing(true);
    try {
      const res = await fetch('/api/v1/demo/next-step', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      if (res.ok) {
        const payload = await res.json();
        if (payload.system_state) setSystemState(payload.system_state);
        if (payload.telegram_state) setTelegramState(payload.telegram_state);
        if (payload.entry) {
          setTranscripts((prev) => {
            if (prev.some((p) => p.id === payload.entry.id)) return prev;
            return [payload.entry, ...prev];
          });
        }
        await fetchDatabaseTables();
      }
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleTriggerPhase5 = async () => {
    setIsAnalyzing(true);
    try {
      const res = await fetch('/api/v1/demo/trigger-isolation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          detected_phase: 5,
          risk_level: 'CRITICAL',
          trigger_phrases: ['Do not tell your family', 'Lock your door immediately'],
        }),
      });
      if (res.ok) {
        const data = await res.json();
        const p = data.payload;
        if (p?.system_state) setSystemState(p.system_state);
        if (p?.telegram_state) setTelegramState(p.telegram_state);
        if (p?.entry) {
          setTranscripts((prev) => {
            if (prev.some((item) => item.id === p.entry.id)) return prev;
            return [p.entry, ...prev];
          });
        }
        setActiveTab('shield');
        await fetchDatabaseTables();
        pushToast('Phase 5 Isolation Circuit Breaker triggered & logged to SQLite.');
      }
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleResetSession = async () => {
    const res = await fetch('/api/v1/reset', { method: 'POST' });
    if (res.ok) {
      const data = await res.json();
      setSystemState(data.system_state);
      setTranscripts([]);
      await fetchDatabaseTables();
      pushToast(`Started fresh call bridge ${data.system_state.session_code}.`);
    }
  };

  const handleSaveToVault = async () => {
    const res = await fetch('/api/v1/generate-report', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ force: true }),
    });
    if (res.ok) {
      const data = await res.json();
      await fetchDatabaseTables();
      pushToast(`Call record ${data.incident?.session_code ?? ''} committed to SQLite DB.`);
    }
  };

  const handleDownloadActivePdf = () => {
    const excerpt =
      transcripts[0]?.transcript || 'Active call monitoring snapshot exported from Second Voice Colossus.';
    const tempRecord = buildIncidentFromActiveState({
      sessionCode: systemState.session_code,
      callerNumber: systemState.caller_number,
      callerLabel: systemState.caller_label,
      receiverPhone: systemState.receiver_phone,
      routingMode: systemState.routing_mode,
      bridgeStatus: systemState.bridge_status,
      highestPhase: systemState.current_highest_phase,
      isIsolated: systemState.isolation_breached,
      riskLevel: systemState.latest_risk,
      triggers: systemState.all_triggers,
      fingerprint: systemState.fingerprint,
      excerpt,
      telegramDispatched: systemState.telegram_dispatched,
    });
    downloadIncidentPdf(tempRecord);
    pushToast('Downloaded 1930 Cybercrime Incident PDF.');
  };

  const handleUpdateIncidentStatus = async (id: string, status: IncidentRecord['status']) => {
    const res = await fetch(`/api/v1/incidents/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    });
    if (res.ok) {
      await fetchDatabaseTables();
      pushToast('Incident status updated in SQLite.');
    }
  };

  const handleDeleteIncident = async (id: string) => {
    const res = await fetch(`/api/v1/incidents/${id}`, { method: 'DELETE' });
    if (res.ok) {
      await fetchDatabaseTables();
      pushToast('Incident removed from SQLite database.');
    }
  };

  const enterMobileCompanionMode = () => {
    setIsMobileCompanionMode(true);
    const url = new URL(window.location.href);
    url.searchParams.set('mode', 'mobile');
    window.history.replaceState({}, '', url.toString());
  };

  const exitMobileCompanionMode = () => {
    setIsMobileCompanionMode(false);
    const url = new URL(window.location.href);
    url.searchParams.delete('mode');
    window.history.replaceState({}, '', url.toString());
  };

  const activeNavLabel = NAV_ITEMS.find((n) => n.id === activeTab)?.label ?? 'Active Shield';

  if (isMobileCompanionMode) {
    return (
      <ErrorBoundary>
        <AndroidMobileCompanion
          systemState={systemState}
          transcripts={transcripts}
          wsConnected={wsConnected}
          isAnalyzing={isAnalyzing}
          onAnalyzeText={handleAnalyzeText}
          onBridgeAction={handleBridgeAction}
          onResetSession={handleResetSession}
          onExitMobileMode={exitMobileCompanionMode}
        />
        <OfflineIndicator />
      </ErrorBoundary>
    );
  }

  return (
    <ErrorBoundary>
      <div className="min-h-screen bg-[#0A0F1D] text-slate-100 flex">
        {/* Desktop Sidebar (256px) */}
        <aside className="hidden lg:flex lg:flex-col lg:w-64 lg:shrink-0 border-r border-white/10 bg-[#0A0F1D]">
          <div className="h-16 px-6 flex items-center gap-2.5 border-b border-white/10">
            <Shield className="w-5 h-5 text-cyan-400 shrink-0" />
            <span className="font-display text-base font-bold tracking-tight text-white whitespace-nowrap">
              Second Voice Colossus
            </span>
          </div>

          <nav className="flex-1 p-4 space-y-1" aria-label="Primary modules">
            {NAV_ITEMS.map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setActiveTab(item.id)}
                  className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-lg text-sm font-medium transition-colors whitespace-nowrap ${
                    isActive
                      ? 'bg-[#131C31] text-white border border-white/10'
                      : 'text-slate-400 hover:text-white hover:bg-white/5 border border-transparent'
                  }`}
                >
                  <Icon className={`w-4 h-4 shrink-0 ${isActive ? 'text-cyan-400' : 'text-slate-400'}`} />
                  <span>{item.label}</span>
                </button>
              );
            })}
          </nav>

          <div className="p-4 border-t border-white/10 space-y-3">
            <button
              type="button"
              onClick={() => setShowFloatingHud((prev) => !prev)}
              className="w-full flex items-center justify-between px-3 py-2 rounded-lg bg-[#131C31] border border-white/10 text-xs text-slate-300 hover:text-white transition-colors"
            >
              <span className="flex items-center gap-2">
                <Layers className="w-3.5 h-3.5 text-cyan-400" />
                Floating HUD Overlay
              </span>
              <span className="font-mono text-cyan-400">{showFloatingHud ? 'ON' : 'OFF'}</span>
            </button>

            <div className="px-1 text-xs text-slate-400 space-y-1">
              <div className="flex items-center justify-between">
                <span>Bridged Call</span>
                <span
                  className={`font-mono ${
                    systemState.current_highest_phase >= 5 ? 'text-rose-400' : 'text-cyan-400'
                  }`}
                >
                  {systemState.session_code} · P{systemState.current_highest_phase}
                </span>
              </div>
              <div className="text-[11px] text-slate-500">
                Server SQLite DB · {incidents.length} calls stored
              </div>
            </div>
          </div>
        </aside>

        {/* Mobile Drawer */}
        {mobileMenuOpen && (
          <div className="fixed inset-0 z-50 lg:hidden flex">
            <div
              className="fixed inset-0 bg-black/60"
              onClick={() => setMobileMenuOpen(false)}
            />
            <aside className="relative w-64 max-w-[80vw] bg-[#0A0F1D] border-r border-white/10 flex flex-col z-10">
              <div className="h-16 px-5 flex items-center justify-between border-b border-white/10">
                <span className="font-display font-bold text-white">Second Voice</span>
                <button
                  type="button"
                  onClick={() => setMobileMenuOpen(false)}
                  aria-label="Close navigation"
                  className="p-1.5 text-slate-400 hover:text-white"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              <nav className="p-4 space-y-1">
                {NAV_ITEMS.map((item) => {
                  const Icon = item.icon;
                  const isActive = activeTab === item.id;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => {
                        setActiveTab(item.id);
                        setMobileMenuOpen(false);
                      }}
                      className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-lg text-sm font-medium ${
                        isActive
                          ? 'bg-[#131C31] text-white border border-white/10'
                          : 'text-slate-400 hover:text-white'
                      }`}
                    >
                      <Icon className="w-4 h-4 text-cyan-400" />
                      <span>{item.label}</span>
                    </button>
                  );
                })}
              </nav>
            </aside>
          </div>
        )}

        {/* Main Content Viewport */}
        <div className="flex-1 min-w-0 flex flex-col">
          {/* Top Header Bar */}
          <header className="h-16 px-6 border-b border-white/10 flex items-center justify-between gap-4 bg-[#0A0F1D]">
            <div className="flex items-center gap-3 min-w-0">
              <button
                type="button"
                onClick={() => setMobileMenuOpen(true)}
                aria-label="Open navigation menu"
                className="lg:hidden p-2 -ml-2 text-slate-300 hover:text-white"
              >
                <Menu className="w-5 h-5" />
              </button>
              <div className="flex items-center gap-2 text-sm truncate">
                <span className="text-slate-400 hidden sm:inline">Second Voice Colossus</span>
                <span className="text-slate-600 hidden sm:inline" aria-hidden="true">/</span>
                <h1 className="font-semibold text-white truncate">{activeNavLabel}</h1>
              </div>
            </div>

            <div className="flex items-center gap-2.5 shrink-0">
              <PWAInstallButton compact />
              <button
                type="button"
                onClick={enterMobileCompanionMode}
                className="hidden sm:inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-[#131C31] border border-white/15 text-xs font-medium text-slate-200 hover:border-cyan-400 transition-colors whitespace-nowrap shrink-0"
              >
                <Smartphone className="w-3.5 h-3.5 text-cyan-400" />
                Android Mobile View
              </button>
              <button
                type="button"
                onClick={handleTriggerPhase5}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-rose-500/15 border border-rose-500/40 text-xs font-semibold text-rose-200 hover:bg-rose-500/25 transition-colors whitespace-nowrap shrink-0"
              >
                <ShieldAlert className="w-3.5 h-3.5 text-rose-400" />
                Trigger Demo Alert
              </button>
            </div>
          </header>

          {/* Main Scrollable Workspace */}
          <main className="flex-1 p-6 max-w-[1440px] w-full mx-auto">
            {toast && (
              <div
                role="status"
                className="mb-5 px-4 py-2.5 rounded-lg bg-[#131C31] border border-cyan-400/40 text-xs text-cyan-200 flex items-center justify-between"
              >
                <span>{toast}</span>
                <button
                  type="button"
                  onClick={() => setToast(null)}
                  aria-label="Dismiss notification"
                  className="text-slate-400 hover:text-white ml-4"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            )}

            {activeTab === 'shield' && (
              <ActiveShieldView
                systemState={systemState}
                transcripts={transcripts}
                phones={phones}
                telegramState={telegramState}
                wsConnected={wsConnected}
                isAnalyzing={isAnalyzing}
                onAnalyzeText={handleAnalyzeText}
                onAdvanceDemoStep={handleAdvanceDemoStep}
                onTriggerPhase5={handleTriggerPhase5}
                onResetSession={handleResetSession}
                onSaveToVault={handleSaveToVault}
                onDownloadPdf={handleDownloadActivePdf}
                onStartBridge={handleStartBridge}
                onBridgeAction={handleBridgeAction}
              />
            )}

            {activeTab === 'bridge' && (
              <MobileIntegrationView
                phones={phones}
                reputation={reputation}
                onRefreshData={fetchDatabaseTables}
                onStartSimulatedCall={handleStartBridge}
                onOpenMobileMode={enterMobileCompanionMode}
              />
            )}

            {activeTab === 'deepfake' && <DeepfakeScannerView />}

            {activeTab === 'verification' && <VerificationHubView />}

            {activeTab === 'telegram' && (
              <TelegramSetupView
                telegramState={telegramState}
                onRefreshTelegramState={fetchTelegramState}
              />
            )}

            {activeTab === 'vault' && (
              <ReportHistoryView
                incidents={incidents}
                loading={incidentsLoading}
                onUpdateStatus={handleUpdateIncidentStatus}
                onDeleteIncident={handleDeleteIncident}
                onReturnToShield={() => setActiveTab('shield')}
              />
            )}
          </main>
        </div>

        {/* Optional Floating Overlay HUD */}
        {showFloatingHud && (
          <FloatingOverlayHud
            currentPhase={systemState.current_highest_phase}
            riskLevel={systemState.latest_risk}
            onFocusShield={() => setActiveTab('shield')}
            onDismiss={() => setShowFloatingHud(false)}
          />
        )}
        <OfflineIndicator />
      </div>
    </ErrorBoundary>
  );
}

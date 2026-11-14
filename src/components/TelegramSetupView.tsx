import React, { useState } from 'react';
import { BellRing, CheckCircle2, Send, ShieldAlert } from 'lucide-react';
import type { TelegramConfigState } from '../types/colossus';

interface TelegramSetupViewProps {
  telegramState: TelegramConfigState | null;
  onRefreshTelegramState: () => Promise<void>;
}

export function TelegramSetupView({
  telegramState,
  onRefreshTelegramState,
}: TelegramSetupViewProps) {
  const [botToken, setBotToken] = useState('');
  const [chatId, setChatId] = useState(telegramState?.chatId ?? '');
  const [autoDispatch, setAutoDispatch] = useState(telegramState?.autoDispatchPhase5 ?? true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'info'; message: string } | null>(
    null
  );

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setFeedback(null);
    try {
      const res = await fetch('/api/v1/telegram/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          botToken,
          chatId,
          autoDispatchPhase5: autoDispatch,
        }),
      });
      if (res.ok) {
        setBotToken('');
        await onRefreshTelegramState();
        setFeedback({
          type: 'success',
          message: 'Telegram Trusted Circle hook updated in server memory.',
        });
      }
    } finally {
      setSaving(false);
    }
  };

  const handleTestDispatch = async () => {
    setTesting(true);
    setFeedback(null);
    try {
      const res = await fetch('/api/v1/telegram/test', { method: 'POST' });
      const data = await res.json();
      await onRefreshTelegramState();
      if (data.dispatched) {
        setFeedback({
          type: 'success',
          message: 'Live SOS alert dispatched to your Telegram family chat.',
        });
      } else {
        setFeedback({
          type: 'info',
          message:
            'Telegram Bot Token or Chat ID is not yet set. Preview generated below; enter real credentials to dispatch live messages.',
        });
      }
    } finally {
      setTesting(false);
    }
  };

  return (
    <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-stretch">
      {/* Left: Credentials & Policy Form */}
      <section className="xl:col-span-7 bg-[#131C31] border border-white/10 rounded-xl p-6">
        <div className="flex items-start justify-between gap-4 mb-5">
          <div>
            <h2 className="text-lg font-semibold text-white">
              Trusted Circle &amp; Telegram SOS Hook
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Automatically alert family members on an alternate channel the instant Phase 5 isolation tactics are detected
            </p>
          </div>
          <BellRing className="w-5 h-5 text-cyan-400 shrink-0" />
        </div>

        <div className="mb-5 p-3.5 rounded-lg bg-[#0A0F1D] border border-white/10 flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2 text-slate-300">
            {telegramState?.configured ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            ) : (
              <ShieldAlert className="w-4 h-4 text-amber-400" />
            )}
            <span>
              {telegramState?.configured
                ? `Hook Armed · Chat ID ${telegramState.chatIdMasked}`
                : 'Awaiting Bot Token & Family Chat ID'}
            </span>
          </div>
          <span className="font-mono text-slate-400">
            {telegramState?.autoDispatchPhase5 ? 'Auto-Trigger: Phase 5+' : 'Manual Trigger Only'}
          </span>
        </div>

        <form onSubmit={handleSave} className="space-y-4">
          <div>
            <label htmlFor="tg-token" className="block text-xs font-medium text-slate-300 mb-1.5">
              Telegram Bot Token
            </label>
            <input
              id="tg-token"
              type="password"
              value={botToken}
              onChange={(e) => setBotToken(e.target.value)}
              placeholder={
                telegramState?.hasToken
                  ? 'Configured (enter new token to replace)'
                  : '123456789:ABCdefGHIjklMNOpqrsTUVwxyz'
              }
              className="w-full bg-[#0A0F1D] border border-white/15 rounded-lg px-3.5 py-2.5 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-cyan-400 font-mono"
            />
          </div>

          <div>
            <label htmlFor="tg-chat" className="block text-xs font-medium text-slate-300 mb-1.5">
              Family Group Chat ID
            </label>
            <input
              id="tg-chat"
              type="text"
              value={chatId}
              onChange={(e) => setChatId(e.target.value)}
              placeholder="-1001234567890"
              className="w-full bg-[#0A0F1D] border border-white/15 rounded-lg px-3.5 py-2.5 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-cyan-400 font-mono"
            />
          </div>

          <label className="flex items-center gap-3 pt-1 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={autoDispatch}
              onChange={(e) => setAutoDispatch(e.target.checked)}
              className="w-4 h-4 rounded border-slate-600 bg-[#0A0F1D] text-cyan-400 focus:ring-cyan-400"
            />
            <span className="text-sm text-slate-200">
              Automatically dispatch Telegram SOS when Phase 5 Isolation Circuit Breaker trips
            </span>
          </label>

          {feedback && (
            <div
              className={`p-3 rounded-lg border text-xs ${
                feedback.type === 'success'
                  ? 'bg-emerald-950/40 border-emerald-500/40 text-emerald-200'
                  : 'bg-amber-950/30 border-amber-500/40 text-amber-200'
              }`}
            >
              {feedback.message}
            </div>
          )}

          <div className="flex flex-wrap items-center gap-3 pt-2">
            <button
              type="submit"
              disabled={saving}
              className="px-4 py-2 rounded-lg bg-cyan-400 text-slate-950 text-sm font-semibold hover:bg-cyan-300 disabled:opacity-50 transition-colors whitespace-nowrap"
            >
              {saving ? 'Saving...' : 'Save & Arm Emergency Hook'}
            </button>
            <button
              type="button"
              onClick={handleTestDispatch}
              disabled={testing}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-white/15 text-sm font-medium text-slate-200 hover:bg-white/5 transition-colors whitespace-nowrap"
            >
              <Send className="w-3.5 h-3.5 text-cyan-400" />
              {testing ? 'Sending Test...' : 'Test SOS Dispatch'}
            </button>
          </div>
        </form>
      </section>

      {/* Right: Live Emergency Payload Preview */}
      <section className="xl:col-span-5 bg-[#131C31] border border-white/10 rounded-xl p-6 flex flex-col justify-between">
        <div>
          <h3 className="text-base font-semibold text-white mb-1">
            Emergency SOS Payload Preview
          </h3>
          <p className="text-xs text-slate-400 mb-4">
            Exact message transmitted to your Trusted Circle upon Phase 5 breach
          </p>

          <div className="bg-[#0A0F1D] border border-white/10 rounded-lg p-4 font-mono text-xs text-slate-200 whitespace-pre-wrap leading-relaxed">
            {telegramState?.lastDispatchMessage ||
              `🚨 *SECOND VOICE EMERGENCY ALERT* 🚨\n\nYour family member is currently on a high-risk coercive call.\nCurrent Threat Phase: *5/7 (ISOLATION DETECTED)*\n\nDetected Threats:\n- Do not tell your family\n- Lock your door immediately\n\n⚠️ *ACTION REQUIRED:* Call them immediately on an alternate line.`}
          </div>
        </div>

        <div className="mt-5 pt-4 border-t border-white/10 text-xs text-slate-400 space-y-1">
          <div>
            Last Dispatch:{' '}
            <span className="font-mono text-slate-200 tabular-nums">
              {telegramState?.lastDispatchAt
                ? new Date(telegramState.lastDispatchAt).toLocaleString()
                : 'No alerts dispatched yet'}
            </span>
          </div>
          <div>
            Delivery Status:{' '}
            <span className="text-slate-200">
              {telegramState?.lastDispatchSuccess === true
                ? 'Delivered via Telegram Bot API'
                : telegramState?.lastDispatchSuccess === false
                ? 'Previewed locally (configure Bot Token for live delivery)'
                : 'Standby'}
            </span>
          </div>
        </div>
      </section>
    </div>
  );
}

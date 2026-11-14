import { useMemo, useState } from 'react';
import { Database, Download, FileText, Search, Trash2 } from 'lucide-react';
import { downloadIncidentPdf } from '../utils/pdfReport';
import type { IncidentRecord } from '../types/colossus';

interface ReportHistoryViewProps {
  incidents: IncidentRecord[];
  loading: boolean;
  onUpdateStatus: (id: string, status: IncidentRecord['status']) => Promise<void>;
  onDeleteIncident: (id: string) => Promise<void>;
  onReturnToShield: () => void;
}

export function ReportHistoryView({
  incidents,
  loading,
  onUpdateStatus,
  onDeleteIncident,
  onReturnToShield,
}: ReportHistoryViewProps) {
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<'ALL' | 'CRITICAL' | 'ELEVATED' | 'SECURE'>('ALL');
  const [selected, setSelected] = useState<IncidentRecord | null>(null);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return incidents.filter((item) => {
      const matchesFilter =
        filter === 'ALL'
          ? true
          : filter === 'CRITICAL'
          ? item.highest_phase >= 5
          : filter === 'ELEVATED'
          ? item.highest_phase >= 1 && item.highest_phase < 5
          : item.highest_phase === 0;

      const matchesSearch =
        !q ||
        item.session_code.toLowerCase().includes(q) ||
        item.caller_number.toLowerCase().includes(q) ||
        item.receiver_phone.toLowerCase().includes(q) ||
        item.coercion_fingerprint.toLowerCase().includes(q) ||
        item.trigger_phrases.some((t) => t.toLowerCase().includes(q));

      return matchesFilter && matchesSearch;
    });
  }, [incidents, search, filter]);

  return (
    <div className="space-y-6">
      <section className="bg-[#131C31] border border-white/10 rounded-xl p-6">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 mb-5">
          <div>
            <div className="flex items-center gap-2">
              <Database className="w-4 h-4 text-cyan-400" />
              <h2 className="text-lg font-semibold text-white">
                Centralized Server Call Database &amp; 1930 Vault
              </h2>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              SQLite relational records maintained on the Second Voice proxy server (not stored on the mobile device)
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-1 p-1 bg-[#0A0F1D] border border-white/10 rounded-lg">
              {(['ALL', 'CRITICAL', 'ELEVATED', 'SECURE'] as const).map((tab) => (
                <button
                  key={tab}
                  type="button"
                  onClick={() => setFilter(tab)}
                  className={`px-3 py-1 rounded-md text-xs font-medium transition-colors whitespace-nowrap ${
                    filter === tab
                      ? 'bg-slate-800 text-white'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  {tab === 'ALL'
                    ? 'All'
                    : tab === 'CRITICAL'
                    ? 'Critical (5–7)'
                    : tab === 'ELEVATED'
                    ? 'Elevated (1–4)'
                    : 'Safe (0)'}
                </button>
              ))}
            </div>

            <div className="relative w-full sm:w-64">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search phone number, session..."
                className="w-full bg-[#0A0F1D] border border-white/15 rounded-lg pl-9 pr-3 py-1.5 text-xs text-white placeholder:text-slate-500 focus:outline-none focus:border-cyan-400"
              />
            </div>
          </div>
        </div>

        {loading ? (
          <div className="space-y-2 py-4">
            {[1, 2, 3].map((row) => (
              <div
                key={row}
                className="h-12 bg-[#0A0F1D] border border-white/5 rounded-lg animate-pulse"
              />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="py-12 text-center border border-dashed border-white/10 rounded-lg">
            <FileText className="w-7 h-7 text-slate-500 mx-auto mb-2" />
            <p className="text-sm font-medium text-slate-200">
              No matching call records in SQLite database
            </p>
            <p className="text-xs text-slate-400 mt-1 mb-4">
              Route or simulate a bridged call in Active Shield to log call legs and triggers here.
            </p>
            <button
              type="button"
              onClick={onReturnToShield}
              className="px-4 py-2 rounded-lg bg-cyan-400 text-slate-950 text-xs font-semibold hover:bg-cyan-300 transition-colors"
            >
              Open Active Shield
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto border-t border-white/10">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-white/10 text-xs text-slate-400 font-medium">
                  <th className="py-3 pr-4">Session</th>
                  <th className="py-3 px-4">Caller → Receiver</th>
                  <th className="py-3 px-4">Routing &amp; State</th>
                  <th className="py-3 px-4">Coercion Fingerprint</th>
                  <th className="py-3 px-4 text-right">Peak Phase</th>
                  <th className="py-3 px-4">Portal Status</th>
                  <th className="py-3 pl-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/10 text-sm">
                {filtered.map((item) => {
                  const isCrit = item.highest_phase >= 5;
                  const phaseColor = isCrit
                    ? 'text-rose-400'
                    : item.highest_phase >= 3
                    ? 'text-amber-400'
                    : 'text-emerald-400';

                  return (
                    <tr
                      key={item.id}
                      onClick={() => setSelected(item)}
                      className="hover:bg-white/[0.03] cursor-pointer transition-colors"
                    >
                      <td className="py-3 pr-4 whitespace-nowrap">
                        <div className="font-mono text-xs font-semibold text-white tabular-nums">
                          {item.session_code}
                        </div>
                        <div className="font-mono text-[11px] text-slate-400 tabular-nums">
                          {new Date(item.timestamp).toLocaleDateString()}
                        </div>
                      </td>
                      <td className="py-3 px-4 whitespace-nowrap font-mono text-xs tabular-nums">
                        <div className="text-white">{item.caller_number}</div>
                        <div className="text-slate-400">→ {item.receiver_phone}</div>
                      </td>
                      <td className="py-3 px-4 whitespace-nowrap text-xs">
                        <div className="text-slate-300 font-mono">{item.routing_mode}</div>
                        <div className="text-slate-400 font-mono tabular-nums">
                          {item.bridge_status} · {item.duration_sec}s
                        </div>
                      </td>
                      <td className="py-3 px-4 text-slate-200 max-w-xs truncate">
                        {item.coercion_fingerprint}
                      </td>
                      <td
                        className={`py-3 px-4 text-right font-mono text-xs font-semibold whitespace-nowrap tabular-nums ${phaseColor}`}
                      >
                        Phase {item.highest_phase}/7 · {item.risk_level}
                      </td>
                      <td className="py-3 px-4 whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                        <select
                          aria-label={`Status for ${item.session_code}`}
                          value={item.status}
                          onChange={(e) =>
                            onUpdateStatus(item.id, e.target.value as IncidentRecord['status'])
                          }
                          className="bg-[#0A0F1D] border border-white/10 rounded-md px-2 py-1 text-xs text-slate-200 focus:outline-none focus:border-cyan-400"
                        >
                          <option value="OPEN">Open Review</option>
                          <option value="REPORTED_1930">Submitted 1930</option>
                          <option value="ARCHIVED">Archived</option>
                        </select>
                      </td>
                      <td
                        className="py-3 pl-4 text-right whitespace-nowrap"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <div className="inline-flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => downloadIncidentPdf(item)}
                            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-[#0A0F1D] border border-white/15 text-xs font-medium text-cyan-300 hover:border-cyan-400 transition-colors"
                          >
                            <Download className="w-3.5 h-3.5" />
                            PDF
                          </button>
                          <button
                            type="button"
                            onClick={() => onDeleteIncident(item.id)}
                            aria-label={`Delete ${item.session_code}`}
                            className="p-1.5 rounded-md text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 transition-colors"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Selected Incident Evidence & Conversation Timeline Inspector */}
      {selected && (
        <section className="bg-[#131C31] border border-white/10 rounded-xl p-6 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="text-xs font-mono text-slate-400 tabular-nums">
                {selected.session_code} · {selected.caller_number} → {selected.receiver_phone} ·{' '}
                {new Date(selected.timestamp).toLocaleString()}
              </div>
              <h3 className="text-base font-semibold text-white mt-0.5">
                {selected.coercion_fingerprint}
              </h3>
            </div>
            <button
              type="button"
              onClick={() => downloadIncidentPdf(selected)}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-cyan-400 text-slate-950 text-xs font-semibold hover:bg-cyan-300 transition-colors whitespace-nowrap"
            >
              <Download className="w-3.5 h-3.5" />
              Download 1930 Incident PDF
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-3 border-t border-white/10 text-sm">
            <div>
              <div className="text-xs text-slate-400 mb-2">
                Conversation Trajectory Log (SQLite Events)
              </div>
              {selected.events && selected.events.length > 0 ? (
                <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                  {selected.events.map((ev) => (
                    <div
                      key={ev.id}
                      className="bg-[#0A0F1D] border border-white/10 rounded-lg p-2.5 text-xs"
                    >
                      <div className="flex items-center justify-between text-slate-400 font-mono mb-1">
                        <span className="text-cyan-300">{ev.speaker_leg}</span>
                        <span>Phase {ev.detected_phase}/7</span>
                      </div>
                      <p className="text-slate-200">&ldquo;{ev.transcript}&rdquo;</p>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-slate-200 leading-relaxed">
                  &ldquo;{selected.transcript_excerpt}&rdquo;
                </p>
              )}
            </div>
            <div>
              <div className="text-xs text-slate-400 mb-2">Logged Trigger Phrases</div>
              {selected.trigger_phrases.length === 0 ? (
                <p className="text-slate-400 text-xs">No coercive phrases logged.</p>
              ) : (
                <ul className="space-y-1 font-mono text-xs text-rose-300">
                  {selected.trigger_phrases.map((t) => (
                    <li key={t}>• &ldquo;{t}&rdquo;</li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </section>
      )}
    </div>
  );
}

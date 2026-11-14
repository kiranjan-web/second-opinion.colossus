import { AlertTriangle, ShieldCheck, ShieldAlert } from 'lucide-react';
import { COERCION_PHASES } from '../types/colossus';

interface CoercionRadarProps {
  phase: number;
  riskLevel: string;
  isIsolated: boolean;
}

export function CoercionRadar({ phase, riskLevel, isIsolated }: CoercionRadarProps) {
  const clampedPhase = Math.max(0, Math.min(7, phase));
  const progress = clampedPhase / 7;

  const tone =
    clampedPhase >= 5
      ? {
          stroke: '#FF3366',
          textClass: 'text-rose-400',
          ringGlow: 'rgba(255, 51, 102, 0.16)',
          label: 'ISOLATION ALERT',
          Icon: AlertTriangle,
        }
      : clampedPhase >= 3
      ? {
          stroke: '#FFB300',
          textClass: 'text-amber-400',
          ringGlow: 'rgba(255, 179, 0, 0.14)',
          label: 'COERCION DETECTED',
          Icon: ShieldAlert,
        }
      : clampedPhase >= 1
      ? {
          stroke: '#38BDF8',
          textClass: 'text-sky-400',
          ringGlow: 'rgba(56, 189, 248, 0.14)',
          label: 'EARLY HOOK WATCH',
          Icon: ShieldAlert,
        }
      : {
          stroke: '#00E5FF',
          textClass: 'text-cyan-400',
          ringGlow: 'rgba(0, 229, 255, 0.12)',
          label: 'ACTIVE MONITORING',
          Icon: ShieldCheck,
        };

  const radius = 84;
  const circumference = 2 * Math.PI * radius;
  const dashOffset = circumference * (1 - progress);
  const StatusIcon = tone.Icon;

  return (
    <div className="flex flex-col items-center">
      <div
        className="relative w-52 h-52 flex items-center justify-center rounded-full"
        style={{
          background: `radial-gradient(circle, ${tone.ringGlow} 0%, rgba(19, 28, 49, 0) 70%)`,
        }}
      >
        <svg className="w-52 h-52 -rotate-90" viewBox="0 0 200 200" aria-hidden="true">
          <circle
            cx="100"
            cy="100"
            r={radius}
            fill="none"
            stroke="rgba(148, 163, 184, 0.15)"
            strokeWidth="10"
          />
          <circle
            cx="100"
            cy="100"
            r="68"
            fill="none"
            stroke="rgba(148, 163, 184, 0.1)"
            strokeWidth="1"
            strokeDasharray="4 4"
          />
          <circle
            cx="100"
            cy="100"
            r={radius}
            fill="none"
            stroke={tone.stroke}
            strokeWidth="10"
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={dashOffset}
            className="transition-all duration-300 ease-out"
          />
        </svg>

        <div className="absolute inset-0 flex flex-col items-center justify-center text-center px-4">
          <StatusIcon className={`w-7 h-7 mb-1.5 ${tone.textClass}`} />
          <div className={`font-mono text-2xl font-bold tracking-tight tabular-nums ${tone.textClass}`}>
            PHASE {clampedPhase}/7
          </div>
          <div className="text-[11px] font-medium text-slate-300 mt-1 tracking-wide">
            {tone.label}
          </div>
          <div className="text-[11px] font-mono text-slate-400 mt-0.5 tabular-nums">
            Risk: {riskLevel}
          </div>
        </div>
      </div>

      {/* 7-Stage State Machine Progression Strip */}
      <div className="w-full mt-5 pt-4 border-t border-white/10">
        <div className="flex items-center justify-between text-xs text-slate-400 mb-2.5">
          <span>Non-Resetting Coercion State Machine</span>
          <span className="font-mono tabular-nums text-slate-300">
            {isIsolated ? 'Circuit Breaker Tripped' : 'Peak Watermark'}
          </span>
        </div>
        <div className="grid grid-cols-4 sm:grid-cols-8 gap-1.5">
          {COERCION_PHASES.map((item) => {
            const reached = clampedPhase >= item.phase && (item.phase > 0 || clampedPhase === 0);
            const isCurrent = clampedPhase === item.phase;
            const isDanger = item.phase >= 5;

            let cellStyle = 'bg-slate-900/70 border-white/10 text-slate-500';
            if (isCurrent) {
              cellStyle = isDanger
                ? 'bg-rose-500/20 border-rose-400 text-rose-200'
                : item.phase >= 3
                ? 'bg-amber-500/20 border-amber-400 text-amber-200'
                : 'bg-cyan-500/15 border-cyan-400 text-cyan-200';
            } else if (reached && item.phase > 0) {
              cellStyle = isDanger
                ? 'bg-rose-500/10 border-rose-500/40 text-rose-300'
                : 'bg-slate-800/90 border-slate-600 text-slate-200';
            }

            return (
              <div
                key={item.phase}
                title={`${item.phase}. ${item.name}: ${item.description}`}
                className={`px-2 py-2 rounded-lg border text-center transition-colors ${cellStyle}`}
              >
                <div className="font-mono text-xs font-semibold tabular-nums">P{item.phase}</div>
                <div className="text-[10px] truncate mt-0.5">{item.shortLabel}</div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

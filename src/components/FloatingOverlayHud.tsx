import { Shield, AlertTriangle, X } from 'lucide-react';

interface FloatingOverlayHudProps {
  currentPhase: number;
  riskLevel: string;
  onFocusShield: () => void;
  onDismiss: () => void;
}

export function FloatingOverlayHud({
  currentPhase,
  riskLevel,
  onFocusShield,
  onDismiss,
}: FloatingOverlayHudProps) {
  const isCritical = currentPhase >= 5;
  const isElevated = currentPhase >= 3 && currentPhase < 5;

  const borderColor = isCritical
    ? 'border-rose-500'
    : isElevated
    ? 'border-amber-400'
    : 'border-cyan-400/80';

  const iconColor = isCritical
    ? 'text-rose-400'
    : isElevated
    ? 'text-amber-400'
    : 'text-cyan-400';

  return (
    <div
      className={`fixed bottom-5 right-5 z-40 flex items-center gap-2.5 bg-[#131C31]/95 backdrop-blur-md border ${borderColor} rounded-lg px-3.5 py-2 shadow-lg`}
      role="region"
      aria-label="Floating call shield overlay"
    >
      <button
        type="button"
        onClick={onFocusShield}
        className="flex items-center gap-2.5 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400 rounded"
      >
        {isCritical ? (
          <AlertTriangle className={`w-4 h-4 shrink-0 ${iconColor}`} />
        ) : (
          <Shield className={`w-4 h-4 shrink-0 ${iconColor}`} />
        )}
        <div className="flex items-center gap-2 text-xs whitespace-nowrap">
          <span className="font-mono font-semibold text-white tabular-nums">
            PHASE {currentPhase}/7
          </span>
          <span className="text-slate-500" aria-hidden="true">·</span>
          <span className={iconColor}>{riskLevel}</span>
        </div>
      </button>
      <button
        type="button"
        onClick={onDismiss}
        aria-label="Close floating overlay"
        className="p-1 text-slate-400 hover:text-white transition-colors rounded"
      >
        <X className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}

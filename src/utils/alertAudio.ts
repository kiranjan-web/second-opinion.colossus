let sharedAudioCtx: AudioContext | null = null;
let lastBeepAt = 0;

function getAudioContext(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  const Ctx =
    window.AudioContext ||
    (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Ctx) return null;
  if (!sharedAudioCtx) {
    sharedAudioCtx = new Ctx();
  }
  if (sharedAudioCtx.state === 'suspended') {
    sharedAudioCtx.resume().catch(() => undefined);
  }
  return sharedAudioCtx;
}

export function unlockAlertAudio() {
  getAudioContext();
}

function scheduleTone(
  ctx: AudioContext,
  freqHz: number,
  startOffsetSec: number,
  durationSec: number,
  gainPeak: number,
  wave: OscillatorType = 'sine'
) {
  const start = ctx.currentTime + startOffsetSec;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();

  osc.type = wave;
  osc.frequency.setValueAtTime(freqHz, start);

  gain.gain.setValueAtTime(0.0001, start);
  gain.gain.exponentialRampToValueAtTime(gainPeak, start + 0.015);
  gain.gain.exponentialRampToValueAtTime(0.0001, start + durationSec);

  osc.connect(gain);
  gain.connect(ctx.destination);

  osc.start(start);
  osc.stop(start + durationSec + 0.02);
}

/**
 * Plays an immediate Web Audio alert beep tuned to the detected threat phase.
 * Includes a short cooldown so continuous speech doesn't stutter.
 */
export function playSpotAlertBeep(phase: number, force = false): boolean {
  const now = Date.now();
  if (!force && now - lastBeepAt < 1100) {
    return false;
  }

  const ctx = getAudioContext();
  if (!ctx) return false;

  lastBeepAt = now;

  // Trigger Android hardware haptic vibration alongside audible beep
  if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
    try {
      if (phase >= 5) {
        navigator.vibrate([220, 80, 220, 80, 360]);
      } else if (phase >= 3) {
        navigator.vibrate([160, 70, 160]);
      } else {
        navigator.vibrate(120);
      }
    } catch {
      // ignore if blocked
    }
  }

  if (phase >= 5) {
    // Critical Phase 5-7: Urgent alternating triple-beep
    scheduleTone(ctx, 1480, 0, 0.13, 0.24, 'triangle');
    scheduleTone(ctx, 987, 0.15, 0.13, 0.24, 'triangle');
    scheduleTone(ctx, 1480, 0.3, 0.18, 0.26, 'triangle');
  } else if (phase >= 3) {
    // High Phase 3-4: Sharp double-beep
    scheduleTone(ctx, 1046, 0, 0.11, 0.2, 'triangle');
    scheduleTone(ctx, 1318, 0.13, 0.14, 0.2, 'triangle');
  } else {
    // Early Watch Phase 1-2: Single sonar chime
    scheduleTone(ctx, 880, 0, 0.15, 0.16, 'sine');
  }

  return true;
}

let lastSpokenAt = 0;

/**
 * Optional calm voice warning for common users who may not be looking at their screen.
 */
export function speakPlainWarning(message: string): boolean {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
    return false;
  }
  const now = Date.now();
  if (now - lastSpokenAt < 6000) {
    return false;
  }
  lastSpokenAt = now;
  try {
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(message);
    utterance.rate = 1.02;
    utterance.pitch = 1.0;
    utterance.volume = 0.95;
    window.speechSynthesis.speak(utterance);
    return true;
  } catch {
    return false;
  }
}

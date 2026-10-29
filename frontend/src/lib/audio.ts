/**
 * Small audio utilities for the attendance workflow.
 *
 * We use the Web Audio API to synthesize beep tones rather than loading an
 * audio file, so there are no assets to manage and latency is ~0. The beeps
 * act as a software substitute for the IMOU camera's physical alarm — which
 * IMOU routes through their Cloud API and blocks over LAN.
 *
 * Usage:
 *   playBeep()                         // single 880Hz beep
 *   playCountdownBeeps(3)              // three beeps, 1s apart (3..2..1)
 *   playCountdownBeeps(2, { final: true })  // two beeps + a higher-pitched "capture" tone on last
 */

const DEFAULT_FREQ = 880;       // A5 — crisp, attention-grabbing but not shrill
const FINAL_FREQ = 1320;        // higher tone for the last "capture" beep
const DEFAULT_DURATION_MS = 220;
const DEFAULT_GAIN = 0.28;      // moderate loudness; browser gates above 1.0

let sharedCtx: AudioContext | null = null;

function getContext(): AudioContext | null {
  if (sharedCtx && sharedCtx.state !== 'closed') return sharedCtx;
  try {
    const AudioContextClass =
      window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContextClass) return null;
    sharedCtx = new AudioContextClass();
    return sharedCtx;
  } catch {
    return null;
  }
}

export async function playBeep(
  freq: number = DEFAULT_FREQ,
  durationMs: number = DEFAULT_DURATION_MS,
  gain: number = DEFAULT_GAIN,
): Promise<void> {
  const ctx = getContext();
  if (!ctx) return;
  // Some browsers (Safari, mobile Chrome) suspend the context until a user
  // gesture. Try to resume it — if the tab has no recent gesture this will
  // silently no-op, which is acceptable.
  try {
    if (ctx.state === 'suspended') await ctx.resume();
  } catch {
    /* noop */
  }

  const oscillator = ctx.createOscillator();
  const gainNode = ctx.createGain();
  oscillator.type = 'sine';
  oscillator.frequency.value = freq;

  // Fast attack, exponential decay — sounds like a "beep", not a square wave click
  const now = ctx.currentTime;
  gainNode.gain.setValueAtTime(0.0001, now);
  gainNode.gain.exponentialRampToValueAtTime(gain, now + 0.01);
  gainNode.gain.exponentialRampToValueAtTime(
    0.0001,
    now + durationMs / 1000,
  );

  oscillator.connect(gainNode);
  gainNode.connect(ctx.destination);
  oscillator.start(now);
  oscillator.stop(now + durationMs / 1000 + 0.02);

  return new Promise((resolve) => {
    setTimeout(resolve, durationMs);
  });
}

interface CountdownOpts {
  /** Play a higher-pitched "capture" beep after the last countdown beep. */
  final?: boolean;
  /** Spacing between beeps (ms). Defaults to 1000. */
  spacingMs?: number;
}

/**
 * Play a countdown of `count` beeps, spaced `spacingMs` apart.
 * Returns the total elapsed time in ms so callers can align the actual
 * capture with the end of the countdown.
 */
export function playCountdownBeeps(
  count: number,
  opts: CountdownOpts = {},
): number {
  const spacing = opts.spacingMs ?? 1000;
  // Schedule all beeps without awaiting (so caller can wall-clock align)
  for (let i = 0; i < count; i++) {
    setTimeout(() => {
      playBeep(DEFAULT_FREQ);
    }, i * spacing);
  }
  if (opts.final) {
    setTimeout(() => {
      playBeep(FINAL_FREQ, 380, 0.32);
    }, count * spacing);
  }
  return count * spacing + (opts.final ? 380 : 0);
}

/**
 * Prime the AudioContext. Browsers require a user gesture before audio can
 * play; call this from a button click so subsequent programmatic plays work.
 */
export function primeAudio(): void {
  const ctx = getContext();
  if (!ctx) return;
  if (ctx.state === 'suspended') {
    ctx.resume().catch(() => {});
  }
}

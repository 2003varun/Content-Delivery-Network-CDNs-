import type { NetworkConfig } from '@/types/network';

/**
 * Base server latencies representing physical server location delay
 * Local (Edge CDN node): 0 ms
 * Remote (Origin server): 2,000 ms
 */
export const BASE_SERVER_LATENCY_EDGE_MS = 0;
export const BASE_SERVER_LATENCY_ORIGIN_MS = 2000;

/**
 * Deterministic bandwidth simulation timing parameters:
 * - 3G (1.6 Mbps vs ~2.0 Mbps 720p stream):
 *   Allows 8 seconds of smooth playback before a transient 2.5s buffer replenishment stall.
 *   Recovers automatically without reaching the 5-second ABR threshold.
 * - Slow 3G (0.4 Mbps vs ~2.0 Mbps 720p stream):
 *   Causes buffer depletion after 3.5 seconds of playback on HQ.
 *   Persistent stall reaches the 5-second ABR threshold, triggering 720p -> 360p downgrade.
 */
export const BANDWIDTH_CONFIG = {
  MODERATE_THRESHOLD_MBPS: 5.0,  // Above this is high-speed (Fast/4G), no simulated stalls
  LOW_THRESHOLD_MBPS: 1.0,       // Below this is constrained (Slow 3G)
  PLAY_WINDOW_3G_MS: 8000,       // 8s playback before transient stall
  TRANSIENT_STALL_3G_MS: 2500,   // 2.5s stall (under 5s ABR limit)
  PLAY_WINDOW_SLOW3G_MS: 3500,   // 3.5s playback on HQ before persistent stall
  APPLY_GRACE_PERIOD_MS: 2000,   // 2s delay if throttled profile applied mid-playback
} as const;

export interface EffectiveStartupDelay {
  baseDelayMs: number;
  networkDelayMs: number;
  totalDelayMs: number;
}

/**
 * Calculates deterministic startup delay for Edge vs Origin given the applied network RTT.
 */
export function calculateEffectiveStartupDelay(
  isRemote: boolean,
  networkLatencyMs: number
): EffectiveStartupDelay {
  const baseDelayMs = isRemote ? BASE_SERVER_LATENCY_ORIGIN_MS : BASE_SERVER_LATENCY_EDGE_MS;
  const networkDelayMs = Math.max(0, networkLatencyMs);
  return {
    baseDelayMs,
    networkDelayMs,
    totalDelayMs: baseDelayMs + networkDelayMs,
  };
}

/**
 * Checks whether the network configuration represents an Offline state.
 */
export function isNetworkOffline(config?: NetworkConfig | null): boolean {
  if (!config) return false;
  return config.preset === 'offline' || config.bandwidthMbps === 0 || config.packetLossPercent === 100;
}

export interface BandwidthPlaybackBehavior {
  shouldStall: boolean;
  delayBeforeStallMs: number;
  stallDurationMs: number | null; // null = persistent stall (awaits ABR downgrade)
}

/**
 * Deterministically determines buffering behavior based on bandwidth and video stream quality.
 * High Quality (~2.0 Mbps) vs Low Quality (~0.6 Mbps).
 */
export function getBandwidthPlaybackBehavior(
  bandwidthMbps: number,
  isLq: boolean,
  isMidPlaybackSwitch: boolean = false
): BandwidthPlaybackBehavior {
  // Offline is handled separately
  if (bandwidthMbps <= 0) {
    return { shouldStall: false, delayBeforeStallMs: 0, stallDurationMs: null };
  }

  // Fast / 4G (High Speed >= 5 Mbps): Stream plays smoothly without artificial stalls
  if (bandwidthMbps >= BANDWIDTH_CONFIG.MODERATE_THRESHOLD_MBPS) {
    return { shouldStall: false, delayBeforeStallMs: 0, stallDurationMs: null };
  }

  // 3G (1.0 Mbps <= Bandwidth < 5.0 Mbps):
  // 720p HQ encounters a transient 2.5s stall after initial playback.
  // 360p LQ (bitrate ~0.6 Mbps) plays smoothly without stalls.
  if (bandwidthMbps >= BANDWIDTH_CONFIG.LOW_THRESHOLD_MBPS) {
    if (!isLq) {
      return {
        shouldStall: true,
        delayBeforeStallMs: isMidPlaybackSwitch
          ? BANDWIDTH_CONFIG.APPLY_GRACE_PERIOD_MS
          : BANDWIDTH_CONFIG.PLAY_WINDOW_3G_MS,
        stallDurationMs: BANDWIDTH_CONFIG.TRANSIENT_STALL_3G_MS,
      };
    }
    return { shouldStall: false, delayBeforeStallMs: 0, stallDurationMs: null };
  }

  // Slow 3G (< 1.0 Mbps, e.g. 0.4 Mbps):
  // 720p HQ cannot be sustained; persistent stall triggers 5s ABR downgrade.
  // 360p LQ plays sustainably without persistent stalls once downgraded.
  if (!isLq) {
    return {
      shouldStall: true,
      delayBeforeStallMs: isMidPlaybackSwitch
        ? BANDWIDTH_CONFIG.APPLY_GRACE_PERIOD_MS
        : BANDWIDTH_CONFIG.PLAY_WINDOW_SLOW3G_MS,
      stallDurationMs: null, // Persistent: will reach 5,000ms ABR threshold
    };
  }

  // Low Quality stream on constrained connection operates sustainably
  return { shouldStall: false, delayBeforeStallMs: 0, stallDurationMs: null };
}

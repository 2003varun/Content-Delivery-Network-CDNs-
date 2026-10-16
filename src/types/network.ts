export type NetworkPresetId = 'fast-4g' | '3g' | 'slow-3g' | 'offline' | 'custom';

export interface NetworkConfig {
  preset: NetworkPresetId;
  name: string;
  latencyMs: number;
  bandwidthMbps: number;
  packetLossPercent: number;
  appliedAt?: string;
  description?: string;
}

export interface NetworkPreset {
  id: NetworkPresetId;
  name: string;
  description: string;
  latencyMs: number;
  bandwidthMbps: number;
  packetLossPercent: number;
  badgeLabel: string;
}

export const NETWORK_PRESETS: NetworkPreset[] = [
  {
    id: 'fast-4g',
    name: 'Fast / 4G',
    description: 'High-speed broadband or 4G LTE with low latency and optimal throughput.',
    latencyMs: 20,
    bandwidthMbps: 25,
    packetLossPercent: 0,
    badgeLabel: 'Optimal',
  },
  {
    id: '3g',
    name: '3G',
    description: 'Standard mobile 3G connection with moderate latency and throughput.',
    latencyMs: 150,
    bandwidthMbps: 1.6,
    packetLossPercent: 0,
    badgeLabel: 'Moderate',
  },
  {
    id: 'slow-3g',
    name: 'Slow 3G',
    description: 'Challenged mobile network with high latency, throttled bandwidth, and packet loss.',
    latencyMs: 400,
    bandwidthMbps: 0.4,
    packetLossPercent: 2,
    badgeLabel: 'Challenged',
  },
  {
    id: 'offline',
    name: 'Offline',
    description: 'Completely disconnected client state with zero downstream throughput.',
    latencyMs: 0,
    bandwidthMbps: 0,
    packetLossPercent: 100,
    badgeLabel: 'Disconnected',
  },
];

export const DEFAULT_NETWORK_CONFIG: NetworkConfig = {
  preset: 'fast-4g',
  name: 'Fast / 4G',
  latencyMs: 20,
  bandwidthMbps: 25,
  packetLossPercent: 0,
  description: 'Default unthrottled high-speed network configuration.',
};

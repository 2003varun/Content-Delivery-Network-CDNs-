export interface SampleVideo {
  id: string;
  title: string;
  description: string;
  hqSrc: string; // High quality video source URL
  lqSrc: string; // Low quality video source URL
  poster?: string; // Optional poster image URL
}

export type PlaybackState = 'idle' | 'loading' | 'playing' | 'paused' | 'buffering' | 'ended' | 'error';

export interface PlayerMetrics {
  playerId: 'local' | 'remote';
  title: string;
  playbackState: PlaybackState;
  simulatedDelayMs: number;
  measuredStartupTimeMs: number | null;
  stallCount: number;
  totalStallDurationMs: number;
  currentStallDurationMs: number;
  lastStallDurationMs: number | null;
  currentResolution: string;
}

export interface QualitySwitchEntry {
  id: string;
  timestamp: string;
  playerId: 'local' | 'remote';
  playerTitle: string;
  previousQuality: string;
  newQuality: string;
  reason: string;
}

export interface TimelineEvent {
  id: string;
  timestamp: number;
  formattedTime: string;
  player: 'local' | 'remote' | 'system';
  type: 'source' | 'startup' | 'play' | 'pause' | 'buffering_start' | 'buffering_end' | 'quality' | 'ended' | 'error' | 'network';
  message: string;
  details?: string;
}

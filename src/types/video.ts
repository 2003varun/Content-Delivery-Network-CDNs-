export interface SampleVideo {
  id: string;
  title: string;
  description: string;
  hqSrc: string; // High quality video source URL
  lqSrc: string; // Low quality video source URL
  poster?: string; // Optional poster image URL
}

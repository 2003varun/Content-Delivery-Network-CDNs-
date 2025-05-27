"use client";

import React from 'react';
import type { SampleVideo } from '@/types/video';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from '@/components/ui/label';

interface VideoSelectorProps {
  videos: SampleVideo[];
  selectedVideoId: string | null;
  onSelectVideo: (videoId: string) => void;
  className?: string;
}

export function VideoSelector({ videos, selectedVideoId, onSelectVideo, className }: VideoSelectorProps) {
  return (
    <div className={className}>
      <Label htmlFor="video-select" className="text-sm font-medium mb-2 block">Choose a Video:</Label>
      <Select onValueChange={onSelectVideo} value={selectedVideoId || undefined}>
        <SelectTrigger id="video-select" className="w-full md:w-[300px] bg-card text-card-foreground rounded-md shadow">
          <SelectValue placeholder="Select a video" />
        </SelectTrigger>
        <SelectContent className="bg-popover text-popover-foreground rounded-md shadow-lg">
          {videos.map((video) => (
            <SelectItem key={video.id} value={video.id} className="hover:bg-accent focus:bg-accent">
              {video.title}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

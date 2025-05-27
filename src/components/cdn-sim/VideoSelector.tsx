
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
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button'; // Added for potential clear button later
import { cn } from '@/lib/utils';

interface VideoSelectorProps {
  videos: SampleVideo[];
  selectedVideoId: string | null;
  onSelectVideo: (videoId: string) => void;
  onSelectLocalFile: (file: File) => void; // New prop
  className?: string;
  uploadedFileName?: string | null;
}

export function VideoSelector({ videos, selectedVideoId, onSelectVideo, onSelectLocalFile, className, uploadedFileName }: VideoSelectorProps) {
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      onSelectLocalFile(file);
      // If a sample video was selected, its value in the Select component will be cleared by parent's state update
    }
  };

  const handleSampleVideoSelect = (videoId: string) => {
    onSelectVideo(videoId);
    if (fileInputRef.current) {
      fileInputRef.current.value = ""; // Clear file input display
    }
  }

  return (
    <div className={cn("w-full max-w-md space-y-4", className)}>
      <div>
        <Label htmlFor="video-select" className="text-sm font-medium mb-2 block">Choose a Sample Video:</Label>
        <Select
          onValueChange={handleSampleVideoSelect}
          value={selectedVideoId || undefined}
          disabled={!!uploadedFileName}
        >
          <SelectTrigger id="video-select" className="w-full bg-card text-card-foreground rounded-md shadow">
            <SelectValue placeholder="Select a sample video" />
          </SelectTrigger>
          <SelectContent className="bg-popover text-popover-foreground rounded-md shadow-lg">
            {videos.map((video) => (
              <SelectItem key={video.id} value={video.id} className="hover:bg-accent focus:bg-accent">
                {video.title}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
         {uploadedFileName && (
          <p className="text-xs text-muted-foreground mt-1">Sample video selection disabled while local file is active.</p>
        )}
      </div>

      <div className="my-3 flex items-center">
        <div className="flex-grow border-t border-muted"></div>
        <span className="mx-3 flex-shrink text-xs uppercase text-muted-foreground">Or</span>
        <div className="flex-grow border-t border-muted"></div>
      </div>

      <div>
        <Label htmlFor="local-file-select" className="text-sm font-medium mb-2 block">Upload a Local Video File:</Label>
        <Input
          id="local-file-select"
          type="file"
          accept="video/*"
          ref={fileInputRef}
          onChange={handleFileChange}
          className="w-full bg-card text-card-foreground rounded-md shadow file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-primary file:text-primary-foreground hover:file:bg-primary/90 cursor-pointer"
        />
        {uploadedFileName && (
          <p className="text-xs text-muted-foreground mt-1">Playing: {uploadedFileName}</p>
        )}
      </div>
    </div>
  );
}

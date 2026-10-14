
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
  onClearLocalFile?: () => void;
  className?: string;
  uploadedFileName?: string | null;
}

export function VideoSelector({ videos, selectedVideoId, onSelectVideo, onSelectLocalFile, onClearLocalFile, className, uploadedFileName }: VideoSelectorProps) {
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const handleFileChange = React.useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      onSelectLocalFile(file);
      // If a sample video was selected, its value in the Select component will be cleared by parent's state update
    }
  }, [onSelectLocalFile]);

  const handleSampleVideoSelect = React.useCallback((videoId: string) => {
    onSelectVideo(videoId);
    if (fileInputRef.current) {
      fileInputRef.current.value = ""; // Clear file input display
    }
  }, [onSelectVideo]);

  const handleClear = React.useCallback(() => {
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
    if (onClearLocalFile) {
      onClearLocalFile();
    }
  }, [onClearLocalFile]);

  return (
    <div className={cn("w-full max-w-md space-y-4", className)}>
      <div>
        <Label htmlFor="video-select" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1.5 block">
          Choose a Sample Video:
        </Label>
        <Select
          onValueChange={handleSampleVideoSelect}
          value={selectedVideoId || undefined}
          disabled={!!uploadedFileName}
        >
          <SelectTrigger id="video-select" className="w-full bg-white text-foreground border border-border hover:border-slate-400 focus:ring-2 focus:ring-primary/40 focus:border-primary rounded-lg shadow-sm transition-colors">
            <SelectValue placeholder="Select a sample video" />
          </SelectTrigger>
          <SelectContent className="bg-white text-foreground border border-border rounded-lg shadow-lg">
            {videos.map((video) => (
              <SelectItem key={video.id} value={video.id} className="hover:bg-slate-50 focus:bg-slate-50 cursor-pointer text-sm">
                <span className="font-medium text-foreground">{video.title}</span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {uploadedFileName && (
          <p className="text-xs text-muted-foreground mt-1.5">Sample video selection disabled while local file is active.</p>
        )}
      </div>

      <div className="my-2.5 flex items-center">
        <div className="flex-grow border-t border-border"></div>
        <span className="mx-3 flex-shrink text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Or</span>
        <div className="flex-grow border-t border-border"></div>
      </div>

      <div>
        <Label htmlFor="local-file-select" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1.5 block">
          Upload a Local Video File:
        </Label>
        <Input
          id="local-file-select"
          type="file"
          accept="video/*"
          ref={fileInputRef}
          onChange={handleFileChange}
          className="w-full bg-white text-foreground border border-border hover:border-slate-400 rounded-lg shadow-sm file:mr-3 file:py-1.5 file:px-3 file:rounded-md file:border-0 file:text-xs file:font-medium file:bg-primary file:text-primary-foreground hover:file:bg-primary/90 cursor-pointer transition-colors text-xs sm:text-sm"
        />
        {uploadedFileName && (
          <div className="flex items-center justify-between mt-2.5 p-2 bg-blue-50/70 border border-blue-200/80 rounded-lg">
            <p className="text-xs text-blue-950 font-medium truncate max-w-[260px]">Active file: {uploadedFileName}</p>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleClear}
              className="h-7 px-2.5 text-xs bg-white border-border hover:bg-destructive/10 hover:text-destructive hover:border-destructive/30 transition-colors"
            >
              Clear
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}

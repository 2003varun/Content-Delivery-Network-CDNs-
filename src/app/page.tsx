
"use client";

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { sampleVideos } from '@/lib/video-data';
import type { SampleVideo } from '@/types/video';
import { VideoSelector } from '@/components/cdn-sim/VideoSelector';
import { VideoPlayer } from '@/components/cdn-sim/VideoPlayer';
import { ContentSuggestionTool } from '@/components/cdn-sim/ContentSuggestionTool';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { BarChart3, UploadCloud } from 'lucide-react'; // Added UploadCloud for potential future use
import { useToast } from '@/hooks/use-toast';

export default function CdnSimPage() {
  const [selectedVideo, setSelectedVideo] = useState<SampleVideo | null>(null);
  const [localVideoSrc, setLocalVideoSrc] = useState<string | undefined>(undefined);
  const [remoteVideoSrc, setRemoteVideoSrc] = useState<string | undefined>(undefined);
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const objectUrlRef = useRef<string | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    // Pre-select the first video on initial load if no other video/file is active
    if (sampleVideos.length > 0 && !selectedVideo && !uploadedFile) {
      handleVideoSelect(sampleVideos[0].id);
    }
  }, [selectedVideo, uploadedFile]); // Ensure this runs if either selectedVideo or uploadedFile changes

  useEffect(() => {
    // Cleanup object URL on unmount
    return () => {
      if (objectUrlRef.current) {
        URL.revokeObjectURL(objectUrlRef.current);
        objectUrlRef.current = null;
      }
    };
  }, []);

  const handleVideoSelect = (videoId: string) => {
    if (objectUrlRef.current) {
      URL.revokeObjectURL(objectUrlRef.current);
      objectUrlRef.current = null;
    }
    setUploadedFile(null);

    const video = sampleVideos.find(v => v.id === videoId);
    if (video) {
      setSelectedVideo(video);
      setLocalVideoSrc(video.hqSrc);
      setRemoteVideoSrc(video.hqSrc);
    } else {
      setSelectedVideo(null);
      setLocalVideoSrc(undefined);
      setRemoteVideoSrc(undefined);
    }
  };

  const handleLocalFileSelect = (file: File) => {
    if (objectUrlRef.current) {
      URL.revokeObjectURL(objectUrlRef.current);
    }

    setSelectedVideo(null); // Clear sample video selection
    setUploadedFile(file);

    const newObjectUrl = URL.createObjectURL(file);
    objectUrlRef.current = newObjectUrl;

    setLocalVideoSrc(newObjectUrl);
    setRemoteVideoSrc(newObjectUrl); // Remote player also uses local file, latency is simulated by VideoPlayer
  };

  const handleSlowBuffering = useCallback((playerId: 'local' | 'remote') => {
    const playerTitle = playerId === 'local' ? (uploadedFile ? `Local: ${uploadedFile.name}` : 'Local Server') : (uploadedFile ? `Remote: ${uploadedFile.name}` : 'Remote Server');

    if (uploadedFile) {
      toast({
        title: "Buffering Slowly",
        description: `${playerTitle} is buffering. No lower quality available for uploaded files.`,
        variant: "default", // Using "default" as it's an informational warning
      });
      return;
    }

    if (!selectedVideo) return;

    // Existing logic for sample videos
    if (playerId === 'local' && localVideoSrc === selectedVideo.hqSrc && selectedVideo.lqSrc) {
      setLocalVideoSrc(selectedVideo.lqSrc);
      toast({
        title: "Adaptive Quality Triggered",
        description: `${playerTitle} is buffering slowly. Switched to lower quality.`,
      });
    } else if (playerId === 'remote' && remoteVideoSrc === selectedVideo.hqSrc && selectedVideo.lqSrc) {
      setRemoteVideoSrc(selectedVideo.lqSrc);
      toast({
        title: "Adaptive Quality Triggered",
        description: `${playerTitle} is buffering slowly. Switched to lower quality.`,
      });
    } else if (selectedVideo.lqSrc && (localVideoSrc === selectedVideo.lqSrc || remoteVideoSrc === selectedVideo.lqSrc)) {
      toast({
        title: "Buffering Slowly",
        description: `${playerTitle} is buffering slowly even on lower quality.`,
        variant: "destructive",
      });
    } else {
      toast({
        title: "Buffering Slowly",
        description: `${playerTitle} is buffering slowly. No lower quality available.`,
        variant: "destructive",
      });
    }
  }, [selectedVideo, localVideoSrc, remoteVideoSrc, uploadedFile, toast]);

  const localPlayerTitle = uploadedFile ? `Local Playback: ${uploadedFile.name}` : "Local Server (Low Latency)";
  const remotePlayerTitle = uploadedFile ? `Simulated Remote: ${uploadedFile.name}` : "Remote Server (Simulated High Latency)";
  const currentLqSrc = uploadedFile ? undefined : selectedVideo?.lqSrc;

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col items-center p-4 md:p-8">
      <header className="w-full max-w-6xl mb-8 text-center md:text-left">
        <div className="flex items-center justify-center md:justify-start gap-3 mb-2">
         <div className="p-2 bg-primary rounded-md">
            <BarChart3 className="h-8 w-8 text-primary-foreground" />
          </div>
          <h1 className="text-4xl font-bold text-primary">CDN Simulator</h1>
        </div>
        <p className="text-muted-foreground text-lg">
          Experience the difference a Content Delivery Network makes and explore cache-friendly content.
        </p>
      </header>

      <main className="w-full max-w-6xl space-y-8">
        <Card className="shadow-xl rounded-xl overflow-hidden">
          <CardHeader className="bg-card-foreground/5 p-6">
            <CardTitle className="text-2xl">Video Streaming Simulation</CardTitle>
            <CardDescription>
              Select a sample video or upload your own to compare playback from a simulated local (fast) server and a remote (higher latency) server.
            </CardDescription>
          </CardHeader>
          <CardContent className="p-6 space-y-6">
            <div className="flex flex-col lg:flex-row justify-between items-start gap-6"> {/* items-start for better alignment */}
              <VideoSelector
                videos={sampleVideos}
                selectedVideoId={selectedVideo?.id || null}
                onSelectVideo={handleVideoSelect}
                onSelectLocalFile={handleLocalFileSelect}
                uploadedFileName={uploadedFile?.name || null}
                className="flex-shrink-0 w-full lg:w-auto" // Control width
              />
               <ContentSuggestionTool />
            </div>


            {(selectedVideo || uploadedFile) && localVideoSrc && remoteVideoSrc ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-6">
                <VideoPlayer
                  key={`local-${selectedVideo?.id || uploadedFile?.name || 'player'}-${localVideoSrc}`}
                  videoId="local"
                  videoSrc={localVideoSrc}
                  lqVideoSrc={currentLqSrc}
                  title={localPlayerTitle}
                  isRemote={false}
                  onSlowBuffering={() => handleSlowBuffering('local')}
                  className="border-2 border-green-500"
                />
                <VideoPlayer
                  key={`remote-${selectedVideo?.id || uploadedFile?.name || 'player'}-${remoteVideoSrc}`}
                  videoId="remote"
                  videoSrc={remoteVideoSrc}
                  lqVideoSrc={currentLqSrc}
                  title={remotePlayerTitle}
                  isRemote={true}
                  onSlowBuffering={() => handleSlowBuffering('remote')}
                  className="border-2 border-orange-500"
                />
              </div>
            ) : (
              <div className="text-center py-10 text-muted-foreground">
                <p>Please select a sample video or upload a local file to start the simulation.</p>
              </div>
            )}
          </CardContent>
        </Card>
        
        <Separator className="my-8" />

        <Card className="shadow-xl rounded-xl overflow-hidden">
            <CardHeader className="bg-card-foreground/5 p-6">
                <CardTitle className="text-2xl">How it Works</CardTitle>
            </CardHeader>
            <CardContent className="p-6 space-y-4 text-sm text-muted-foreground">
                <p>
                    <strong className="text-foreground">Video Selection:</strong> Choose from a list of sample videos or upload your own video file.
                </p>
                <p>
                    <strong className="text-foreground">Dual Display:</strong> Two video players are shown.
                    The <strong className="text-green-600">"{uploadedFile ? `Local: ${uploadedFile.name.substring(0,20)}...` : 'Local Server'}"</strong> player simulates a fast, nearby server (like a CDN edge).
                    The <strong className="text-orange-600">"{uploadedFile ? `Remote: ${uploadedFile.name.substring(0,20)}...` : 'Remote Server'}"</strong> player simulates a distant server with higher latency.
                </p>
                <p>
                    <strong className="text-foreground">Latency Simulation:</strong> The "Remote Server" video has an artificial delay before playback starts to mimic network latency. This applies even to uploaded local files to demonstrate the concept.
                </p>
                <p>
                    <strong className="text-foreground">Adaptive Quality:</strong> For sample videos, if a player buffers for too long (more than 5 seconds), it will attempt to switch to a lower quality version and notify you. This demonstrates how CDNs and players can adapt. (Note: Adaptive quality is not available for uploaded local files as only one version is provided).
                </p>
                 <p>
                    <strong className="text-foreground">Content Suggestions:</strong> Use the "Get Content Suggestions" tool to input your video idea. Our AI will provide alternatives that are easier to cache on a CDN, along with reasons why.
                </p>
            </CardContent>
        </Card>

      </main>

      <footer className="w-full max-w-6xl mt-12 py-6 text-center text-muted-foreground text-sm border-t">
        <p>&copy; {new Date().getFullYear()} CDN Sim. Built with Next.js and Genkit.</p>
      </footer>
    </div>
  );
}

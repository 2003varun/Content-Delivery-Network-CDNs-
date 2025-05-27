"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { sampleVideos } from '@/lib/video-data';
import type { SampleVideo } from '@/types/video';
import { VideoSelector } from '@/components/cdn-sim/VideoSelector';
import { VideoPlayer } from '@/components/cdn-sim/VideoPlayer';
import { ContentSuggestionTool } from '@/components/cdn-sim/ContentSuggestionTool';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { BarChart3 } from 'lucide-react';

export default function CdnSimPage() {
  const [selectedVideo, setSelectedVideo] = useState<SampleVideo | null>(null);
  const [localVideoSrc, setLocalVideoSrc] = useState<string | undefined>(undefined);
  const [remoteVideoSrc, setRemoteVideoSrc] = useState<string | undefined>(undefined);

  useEffect(() => {
    // Pre-select the first video on initial load
    if (sampleVideos.length > 0 && !selectedVideo) {
      handleVideoSelect(sampleVideos[0].id);
    }
  }, [selectedVideo]);

  const handleVideoSelect = (videoId: string) => {
    const video = sampleVideos.find(v => v.id === videoId);
    if (video) {
      setSelectedVideo(video);
      setLocalVideoSrc(video.hqSrc);
      setRemoteVideoSrc(video.hqSrc);
    }
  };

  const handleSlowBuffering = useCallback((playerId: 'local' | 'remote') => {
    if (!selectedVideo) return;

    if (playerId === 'local' && localVideoSrc === selectedVideo.hqSrc) {
      setLocalVideoSrc(selectedVideo.lqSrc);
    } else if (playerId === 'remote' && remoteVideoSrc === selectedVideo.hqSrc) {
      setRemoteVideoSrc(selectedVideo.lqSrc);
    }
  }, [selectedVideo, localVideoSrc, remoteVideoSrc]);


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
              Select a video to compare playback from a simulated local (fast) server and a remote (higher latency) server.
            </CardDescription>
          </CardHeader>
          <CardContent className="p-6 space-y-6">
            <div className="flex flex-col sm:flex-row justify-between items-center gap-4">
              <VideoSelector
                videos={sampleVideos}
                selectedVideoId={selectedVideo?.id || null}
                onSelectVideo={handleVideoSelect}
              />
               <ContentSuggestionTool />
            </div>


            {selectedVideo && localVideoSrc && remoteVideoSrc ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-6">
                <VideoPlayer
                  key={`local-${selectedVideo.id}-${localVideoSrc}`}
                  videoId="local"
                  videoSrc={localVideoSrc}
                  lqVideoSrc={selectedVideo.lqSrc}
                  title="Local Server (Low Latency)"
                  isRemote={false}
                  onSlowBuffering={() => handleSlowBuffering('local')}
                  className="border-2 border-green-500"
                />
                <VideoPlayer
                  key={`remote-${selectedVideo.id}-${remoteVideoSrc}`}
                  videoId="remote"
                  videoSrc={remoteVideoSrc}
                  lqVideoSrc={selectedVideo.lqSrc}
                  title="Remote Server (Simulated High Latency)"
                  isRemote={true}
                  onSlowBuffering={() => handleSlowBuffering('remote')}
                  className="border-2 border-orange-500"
                />
              </div>
            ) : (
              <div className="text-center py-10 text-muted-foreground">
                <p>Please select a video to start the simulation.</p>
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
                    <strong className="text-foreground">Video Selection:</strong> Choose from a list of sample videos.
                </p>
                <p>
                    <strong className="text-foreground">Dual Display:</strong> Two video players are shown.
                    The <strong className="text-green-600">"Local Server"</strong> player simulates a fast, nearby server (like a CDN edge).
                    The <strong className="text-orange-600">"Remote Server"</strong> player simulates a distant server with higher latency.
                </p>
                <p>
                    <strong className="text-foreground">Latency Simulation:</strong> The "Remote Server" video has an artificial delay before playback starts to mimic network latency.
                </p>
                <p>
                    <strong className="text-foreground">Adaptive Quality:</strong> If a video buffers for too long (more than 5 seconds), it will attempt to switch to a lower quality version (if available) and notify you. This demonstrates how CDNs and players can adapt to network conditions.
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

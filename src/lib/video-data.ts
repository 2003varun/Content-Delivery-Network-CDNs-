import type { SampleVideo } from '@/types/video';

export const sampleVideos: SampleVideo[] = [
  {
    id: 'big-buck-bunny',
    title: 'Big Buck Bunny',
    description: 'A classic open-source animated short film.',
    hqSrc: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4',
    lqSrc: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4', // Placeholder LQ
    poster: 'https://placehold.co/600x338.png', // Aspect ratio roughly 16:9
  },
  {
    id: 'sintel',
    title: 'Sintel',
    description: 'Another beautiful open-source animated film by Blender Foundation.',
    hqSrc: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/Sintel.mp4',
    lqSrc: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerEscapes.mp4', // Placeholder LQ
    poster: 'https://placehold.co/600x338.png',
  },
  {
    id: 'elephants-dream',
    title: 'Elephants Dream',
    description: 'The first open movie, created with Blender.',
    hqSrc: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ElephantsDream.mp4',
    lqSrc: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerFun.mp4', // Placeholder LQ
    poster: 'https://placehold.co/600x338.png',
  },
];

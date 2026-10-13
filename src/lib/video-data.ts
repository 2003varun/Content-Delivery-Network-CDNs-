import type { SampleVideo } from '@/types/video';

export const sampleVideos: SampleVideo[] = [
  {
    id: 'big-buck-bunny',
    title: 'Big Buck Bunny',
    description: 'A classic open-source animated short film.',
    hqSrc: 'https://upload.wikimedia.org/wikipedia/commons/transcoded/c/c0/Big_Buck_Bunny_4K.webm/Big_Buck_Bunny_4K.webm.720p.vp9.webm',
    lqSrc: 'https://upload.wikimedia.org/wikipedia/commons/transcoded/c/c0/Big_Buck_Bunny_4K.webm/Big_Buck_Bunny_4K.webm.360p.vp9.webm',
    poster: 'https://placehold.co/600x338.png', // Aspect ratio roughly 16:9
  },
  {
    id: 'sintel',
    title: 'Sintel',
    description: 'Another beautiful open-source animated film by Blender Foundation.',
    hqSrc: 'https://upload.wikimedia.org/wikipedia/commons/transcoded/f/f1/Sintel_movie_4K.webm/Sintel_movie_4K.webm.720p.vp9.webm',
    lqSrc: 'https://upload.wikimedia.org/wikipedia/commons/transcoded/f/f1/Sintel_movie_4K.webm/Sintel_movie_4K.webm.360p.vp9.webm',
    poster: 'https://placehold.co/600x338.png',
  },
  {
    id: 'elephants-dream',
    title: 'Elephants Dream',
    description: 'The first open movie, created with Blender.',
    hqSrc: 'https://upload.wikimedia.org/wikipedia/commons/transcoded/2/28/Elephants_Dream_%282006%29_1080p24.webm/Elephants_Dream_%282006%29_1080p24.webm.480p.vp9.webm',
    lqSrc: 'https://upload.wikimedia.org/wikipedia/commons/transcoded/2/28/Elephants_Dream_%282006%29_1080p24.webm/Elephants_Dream_%282006%29_1080p24.webm.240p.vp9.webm',
    poster: 'https://placehold.co/600x338.png',
  },
];

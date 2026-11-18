import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'StepFlow — пошаговые инструкции',
    short_name: 'StepFlow',
    start_url: '/',
    scope: '/',
    display: 'standalone',
    lang: 'ru',
    background_color: '#f8fafc',
    theme_color: '#0f172a',
    icons: [
      { src: '/icons/stepflow-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/icons/stepflow-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
    ],
  };
}

import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'StepFlow — пошаговые инструкции',
    short_name: 'StepFlow',
    start_url: '/',
    scope: '/',
    display: 'standalone',
    lang: 'ru',
    background_color: '#e7e7e7',
    theme_color: '#23262c',
    icons: [
      { src: '/icons/stepflow-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/icons/stepflow-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
    ],
  };
}

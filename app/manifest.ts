import type { MetadataRoute } from 'next';

/**
 * PWA (SPEC 1.2): только установка на экран, сервис-воркера и офлайна нет.
 * Отдаётся как /manifest.webmanifest — middleware пускает его без входа.
 * Исходники иконки (буквы в кривых) — assets/pwa/*.svg.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Movie_Theatre',
    short_name: 'Movie_Theatre',
    start_url: '/',
    display: 'standalone',
    background_color: '#121217',
    theme_color: '#121217',
    lang: 'ru',
    icons: [
      { src: '/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  };
}

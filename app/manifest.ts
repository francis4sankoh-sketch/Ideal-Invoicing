import type { MetadataRoute } from 'next';
import { APP_NAME } from '@/lib/app-config';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: APP_NAME,
    short_name: APP_NAME.split(' ')[0],
    description: 'Quotes, invoices, bookings and enquiries for event hire businesses',
    start_url: '/',
    scope: '/',
    display: 'standalone',
    background_color: '#800020',
    theme_color: '#800020',
    icons: [
      { src: '/icon-192.png', sizes: '192x192', type: 'image/png' },
      { src: '/icon-512.png', sizes: '512x512', type: 'image/png' },
      { src: '/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  };
}

import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Ideal Invoicing',
    short_name: 'Ideal',
    description: 'Invoices, bookings and enquiries for Ideal Events Hire',
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

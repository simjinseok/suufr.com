import type { MetadataRoute } from 'next';

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL ?? 'https://suufr.com';

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    { url: `${BASE_URL}/`, priority: 1 },
    { url: `${BASE_URL}/pricing`, priority: 0.9 },
    { url: `${BASE_URL}/terms`, priority: 0.3 },
    { url: `${BASE_URL}/privacy`, priority: 0.3 },
    { url: `${BASE_URL}/refunds`, priority: 0.3 },
  ];
}

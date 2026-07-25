import type { MetadataRoute } from 'next';

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL ?? 'https://suufr.com';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: ['/dashboard', '/settings', '/students', '/sessions', '/invoices', '/payments', '/calendar', '/meetings', '/curriculums', '/organizations'],
    },
    sitemap: `${BASE_URL}/sitemap.xml`,
  };
}

import type { MetadataRoute } from 'next';
import { SITE_URL } from '@/lib/site-url';

/** Search engines may index the website, not the app screens or the API */
export default function robots(): MetadataRoute.Robots {
    return {
        rules: { userAgent: '*', allow: '/', disallow: ['/api/', '/setup', '/transactions', '/summary', '/activity', '/welcome'] },
        sitemap: `${SITE_URL}/sitemap.xml`,
    };
}

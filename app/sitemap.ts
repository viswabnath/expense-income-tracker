import type { MetadataRoute } from 'next';
import { FEATURES, TOOLS } from '@/components/site/content';
import { SITE_URL } from '@/lib/site-url';

/** Every website page, including one per feature */
export default function sitemap(): MetadataRoute.Sitemap {
    const pages = ['', '/features', '/tools', '/roadmap', '/download', '/faq', '/security', '/privacy', '/terms', '/about'];
    return [
        ...pages.map(path => ({ url: `${SITE_URL}${path}`, changeFrequency: 'weekly' as const, priority: path ? 0.7 : 1 })),
        ...FEATURES.map(feature => ({ url: `${SITE_URL}/features/${feature.slug}`, changeFrequency: 'monthly' as const, priority: 0.6 })),
        ...TOOLS.map(tool => ({ url: `${SITE_URL}/tools/${tool.slug}`, changeFrequency: 'monthly' as const, priority: 0.8 })),
    ];
}

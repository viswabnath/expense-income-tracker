import type { MetadataRoute } from 'next';

/**
 * The web app manifest: lets phones, tablets and computers install FinDB from the browser
 * ("Add to Home screen" / "Install app"). The installed app opens on the app's first screen;
 * signed-out visitors are sent to /login by proxy.ts.
 */
export default function manifest(): MetadataRoute.Manifest {
    return {
        id: '/',
        name: 'FinDB',
        short_name: 'FinDB',
        description: 'Your family\'s money, in one honest picture. A free personal finance dashboard made for India.',
        start_url: '/setup',
        scope: '/',
        display: 'standalone',
        orientation: 'any',
        background_color: '#fbfaf7',
        theme_color: '#1b1f4b',
        lang: 'en-IN',
        categories: ['finance', 'productivity'],
        icons: [
            { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
            { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
            { src: '/icons/maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
    };
}

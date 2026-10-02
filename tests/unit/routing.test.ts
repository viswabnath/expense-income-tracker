/**
 * During the migration a path works only if three lists agree:
 *   - app/                 has the page or route handler
 *   - vercel.json          rewrites the path to the "web" (Next.js) service
 *   - proxy.ts matcher     gives pages the nonce CSP (legacy paths must NOT be matched)
 */
import fs from 'fs';
import path from 'path';

const root = path.join(__dirname, '..', '..');

function findFiles(dir: string, name: string): string[] {
    return fs.readdirSync(dir, { withFileTypes: true }).flatMap(entry => {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) return findFiles(full, name);
        return entry.name === name ? [full] : [];
    });
}

/** app/(public)/about/page.tsx -> /about (route groups in parentheses are not part of the URL) */
function toRoute(file: string): string {
    const segments = path.relative(path.join(root, 'app'), path.dirname(file)).split(path.sep)
        .filter(segment => segment && !/^\(.*\)$/.test(segment));
    return '/' + segments.join('/');
}

const pageRoutes = findFiles(path.join(root, 'app'), 'page.tsx').map(toRoute).sort();
const handlerRoutes = findFiles(path.join(root, 'app'), 'route.ts').map(toRoute).sort();

const vercel = JSON.parse(fs.readFileSync(path.join(root, 'vercel.json'), 'utf8')) as {
    rewrites: { source: string; destination: { service: string } }[];
};
const webSources = vercel.rewrites.filter(rule => rule.destination.service === 'web').map(rule => rule.source);
const routedToWeb = (route: string) => webSources.some(source => new RegExp(`^${source}$`).test(route));

const proxySource = fs.readFileSync(path.join(root, 'proxy.ts'), 'utf8');
const matcherMatch = proxySource.match(/matcher:\s*\[([^\]]*)\]/);
const proxyMatcher = matcherMatch ? [...matcherMatch[1]!.matchAll(/'([^']+)'/g)].map(m => m[1]!).sort() : [];

describe('Next.js routing during the migration', () => {
    test('every page and route handler is rewritten to the web service', () => {
        const missing = [...pageRoutes, ...handlerRoutes].filter(route => !routedToWeb(route));
        expect(missing).toEqual([]);
    });

    test('Next.js assets are rewritten to the web service', () => {
        expect(routedToWeb('/_next/static/chunks/app.js')).toBe(true);
    });

    test('the proxy matcher lists exactly the pages (so legacy paths keep their own CSP)', () => {
        expect(proxyMatcher).toEqual(pageRoutes);
    });

    test('the legacy app still owns everything else', () => {
        for (const legacyPath of ['/api/income', '/api/login', '/css/fintech-theme.css', '/js/app.js', '/index.html']) {
            expect(routedToWeb(legacyPath)).toBe(false);
        }
    });
});

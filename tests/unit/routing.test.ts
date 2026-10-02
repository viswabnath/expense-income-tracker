/**
 * Every page must get the per-request nonce Content-Security-Policy from proxy.ts, so the
 * proxy matcher has to list exactly the pages in app/. API routes are not matched: they are
 * JSON and get a deny-all policy from next.config.ts instead.
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

const proxySource = fs.readFileSync(path.join(root, 'proxy.ts'), 'utf8');
const matcherMatch = proxySource.match(/matcher:\s*\[([^\]]*)\]/);
const proxyMatcher = matcherMatch ? [...matcherMatch[1]!.matchAll(/'([^']+)'/g)].map(m => m[1]!).sort() : [];

describe('routing', () => {
    test('the proxy matcher lists exactly the pages', () => {
        expect(proxyMatcher).toEqual(pageRoutes);
    });

    test('API route handlers are not matched by the proxy', () => {
        const apiRoutes = handlerRoutes.filter(route => route.startsWith('/api/'));
        expect(apiRoutes.length).toBeGreaterThan(0);
        expect(proxyMatcher.filter(route => route.startsWith('/api'))).toEqual([]);
    });

    test('vercel.json is a plain Next.js project (no services or rewrites since N4)', () => {
        const vercel = JSON.parse(fs.readFileSync(path.join(root, 'vercel.json'), 'utf8'));
        expect(vercel.framework).toBe('nextjs');
        expect(vercel.services).toBeUndefined();
        expect(vercel.rewrites).toBeUndefined();
    });
});

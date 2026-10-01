#!/usr/bin/env node
/**
 * A local stand-in for Vercel Services routing, used by the Playwright tests.
 *
 * It reads the rewrites in vercel.json and sends each request to the service they name:
 * "web" (Next.js, WEB_URL) or "legacy" (Express, LEGACY_URL). Next.js then runs exactly as
 * in production, with no fallback proxy of its own, and the tests also exercise the real
 * routing rules. Fresh upstream connections (no keep-alive) avoid stale-socket resets.
 *
 *   ROUTER_PORT=3100 WEB_URL=http://localhost:3101 LEGACY_URL=http://localhost:3102 node scripts/services-router.js
 */
const http = require('http');
const path = require('path');

const { rewrites } = require(path.join(__dirname, '..', 'vercel.json'));
const targets = { web: process.env.WEB_URL, legacy: process.env.LEGACY_URL };
const port = Number(process.env.ROUTER_PORT || 3100);

if (require.main === module && (!targets.web || !targets.legacy)) {
    console.error('WEB_URL and LEGACY_URL are required');
    process.exit(1);
}

// vercel.json sources are path patterns anchored to the whole path
const rules = rewrites.map(rule => ({ pattern: new RegExp(`^${rule.source}$`), service: rule.destination.service }));

/** The service for a request path, following the first matching rewrite like Vercel does */
function serviceFor(pathname) {
    const match = rules.find(rule => rule.pattern.test(pathname));
    return match ? match.service : 'legacy';
}

const server = http.createServer((req, res) => {
    const pathname = new URL(req.url, 'http://router').pathname;
    const upstream = new URL(targets[serviceFor(pathname)]);

    const proxied = http.request({
        hostname: upstream.hostname,
        port: upstream.port,
        method: req.method,
        path: req.url,
        headers: { ...req.headers, host: req.headers.host, connection: 'close' },
        agent: false,
    }, upstreamRes => {
        res.writeHead(upstreamRes.statusCode || 502, upstreamRes.headers);
        upstreamRes.pipe(res);
    });

    proxied.on('error', error => {
        console.error(`router: ${req.method} ${req.url} -> ${upstream.origin} failed: ${error.message}`);
        if (!res.headersSent) res.writeHead(502, { 'Content-Type': 'text/plain' });
        res.end('Bad gateway');
    });
    req.pipe(proxied);
});

if (require.main === module) {
    server.listen(port, () => {
        console.log(`services router on http://localhost:${port} (web ${targets.web}, legacy ${targets.legacy})`);
    });
}

module.exports = { serviceFor };

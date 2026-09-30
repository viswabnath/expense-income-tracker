/**
 * Security Middleware Tests
 * Verifies the CSP header, the production HTTPS redirect and the auth rate limiter
 * @jest-environment node
 */

const request = require('supertest');

// Load a fresh copy of the server with the given NODE_ENV (the middleware is configured at load time)
function loadServer(nodeEnv) {
    const previous = process.env.NODE_ENV;
    process.env.NODE_ENV = nodeEnv;
    let server;
    jest.isolateModules(() => {
        server = require('../legacy/server');
    });
    process.env.NODE_ENV = previous;
    return server;
}

describe('Security middleware in production', () => {
    let app;
    let pool;

    beforeAll(() => {
        ({ app, pool } = loadServer('production'));
    });

    afterAll(async () => {
        await pool.end();
    });

    test('should send a Content-Security-Policy header', async () => {
        const response = await request(app).get('/').set('X-Forwarded-Proto', 'https');

        const csp = response.headers['content-security-policy'];
        expect(csp).toContain('script-src \'self\' https://unpkg.com');
        expect(csp).toContain('script-src-attr \'none\'');
        expect(csp).toContain('upgrade-insecure-requests');
    });

    test('should refuse to start in production without SESSION_SECRET', () => {
        // Empty rather than deleted: dotenv would refill a deleted variable from .env
        const previous = process.env.SESSION_SECRET;
        process.env.SESSION_SECRET = '';
        try {
            expect(() => loadServer('production')).toThrow('SESSION_SECRET must be set in production');
        } finally {
            process.env.SESSION_SECRET = previous;
        }
    });

    test('should export the Express app as the default export (required by Vercel)', () => {
        const exported = loadServer('production');

        expect(typeof exported).toBe('function');
        expect(exported.app).toBe(exported);
        return exported.pool.end();
    });

    test('vercel.json static-file headers should match the headers helmet sends', async () => {
        // Vercel serves public/ from its CDN without running Express, so vercel.json repeats helmet's headers
        const vercelConfig = require('../vercel.json');
        // Every header rule that applies to legacy paths such as "/" (the CSP rule excludes Next.js pages)
        const staticHeaders = vercelConfig.headers.flatMap(rule => rule.headers);
        const response = await request(app).get('/').set('X-Forwarded-Proto', 'https');

        for (const { key, value } of staticHeaders) {
            expect({ key, value: response.headers[key.toLowerCase()] }).toEqual({ key, value });
        }
    });

    test('should redirect plain HTTP to HTTPS before serving static files', async () => {
        const response = await request(app)
            .get('/css/fintech-theme.css')
            .set('X-Forwarded-Proto', 'http');

        expect(response.status).toBe(301);
        expect(response.headers.location).toMatch(/^https:\/\/.*\/css\/fintech-theme\.css$/);
    });

    test('should not redirect requests without a forwarded protocol', async () => {
        const response = await request(app).get('/css/fintech-theme.css');

        expect(response.status).toBe(200);
    });

    test('should rate limit repeated failed logins', async () => {
        const statuses = [];
        for (let i = 0; i < 6; i++) {
            const response = await request(app)
                .post('/api/login')
                .set('X-Forwarded-Proto', 'https')
                .send({ username: 'no_such_user_rl', password: 'Wrong123&' });
            statuses.push(response.status);
        }

        expect(statuses.slice(0, 5).every(status => status !== 429)).toBe(true);
        expect(statuses[5]).toBe(429);
    });
});

describe('Security middleware in development', () => {
    let app;
    let pool;

    beforeAll(() => {
        ({ app, pool } = loadServer('development'));
    });

    afterAll(async () => {
        await pool.end();
    });

    test('should omit upgrade-insecure-requests so Safari can load http://localhost', async () => {
        const response = await request(app).get('/');

        expect(response.headers['content-security-policy']).not.toContain('upgrade-insecure-requests');
    });

    test('should not rate limit failed logins', async () => {
        for (let i = 0; i < 6; i++) {
            const response = await request(app)
                .post('/api/login')
                .send({ username: 'no_such_user_rl', password: 'Wrong123&' });
            expect(response.status).not.toBe(429);
        }
    });
});

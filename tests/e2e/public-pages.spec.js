// @ts-check
/**
 * The website (app/(site)): home, features, roadmap, get the app, questions, security, privacy,
 * terms and about. Every page must open without logging in, load under the nonce
 * Content-Security-Policy without violations or console errors, and link to and from the app.
 */
const { test, expect } = require('@playwright/test');
const { uniqueUser, register, chooseTracking } = require('./helpers');

const PAGES = [
    { path: '/', heading: /One honest picture/ },
    { path: '/features', heading: 'Everything your money touches, in one place.' },
    { path: '/features/loans', heading: 'Loans and chit funds' },
    { path: '/roadmap', heading: 'Built in the open, one solid step at a time.' },
    { path: '/download', heading: 'No app store needed. It installs from your browser.' },
    { path: '/faq', heading: 'Plain answers to fair questions.' },
    { path: '/security', heading: 'Security Policy' },
    { path: '/privacy', heading: 'Privacy Guide' },
    { path: '/terms', heading: 'Terms of Service' },
    { path: '/about', heading: 'About FinDB' },
];

/** Collect CSP violations and console errors for the page's lifetime */
async function watchForProblems(page) {
    const problems = [];
    page.on('console', message => {
        if (message.type() === 'error') problems.push(`console: ${message.text()}`);
    });
    page.on('pageerror', error => problems.push(`pageerror: ${error.message}`));
    await page.addInitScript(() => {
        document.addEventListener('securitypolicyviolation', event => {
            console.error(`CSP violation: ${event.violatedDirective} blocked ${event.blockedURI || 'inline'}`);
        });
    });
    return problems;
}

for (const { path, heading } of PAGES) {
    test(`${path} opens without login and loads under the nonce CSP`, async ({ page }) => {
        const problems = await watchForProblems(page);

        const response = await page.goto(path);
        expect(response?.status()).toBe(200);
        const csp = response?.headers()['content-security-policy'] || '';
        expect(csp).toMatch(/script-src 'self' 'nonce-[A-Za-z0-9+/=]+' 'strict-dynamic'/);

        await expect(page.getByRole('heading', { level: 1, name: heading })).toBeVisible();
        await expect(page.locator('footer.site-footer')).toBeVisible();
        // Nothing may make the page scroll sideways
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);

        expect(problems).toEqual([]);
    });
}

test('the header navigates between pages on the client', async ({ page }) => {
    const problems = await watchForProblems(page);
    await page.goto('/');

    await page.locator('.site-nav a', { hasText: 'Features' }).click();
    await expect(page).toHaveURL(/\/features$/);
    await expect(page.locator('.site-nav a[aria-current="page"]')).toHaveText('Features');

    await page.locator('.feature-card', { hasText: 'Statement import' }).click();
    await expect(page).toHaveURL(/\/features\/import$/);
    await expect(page.getByRole('heading', { level: 1, name: 'Statement import' })).toBeVisible();

    await page.locator('.pager a.next').click();
    await expect(page).toHaveURL(/\/features\/insights$/);

    expect(problems).toEqual([]);
});

test('the scenario explorer switches situations, by click and by keyboard', async ({ page }) => {
    await page.goto('/');
    const panel = page.locator('#scenario-panel');
    await expect(panel.locator('h3')).toHaveText('You withdraw ₹5,000 from an ATM');

    await page.getByRole('tab', { name: 'A home loan EMI' }).click();
    await expect(panel.locator('h3')).toHaveText('Your home loan EMI of ₹32,000 is paid');
    await expect(panel.locator('.journal-total')).toContainText('₹32,000 = ₹32,000');

    await page.keyboard.press('ArrowDown');
    await expect(page.getByRole('tab', { name: 'Gold for your wife' })).toBeFocused();
    await expect(panel.locator('h3')).toContainText('gold chain for your wife');
});

test('on a phone the links fold into a menu', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/');
    await expect(page.locator('.site-nav')).toBeHidden();

    const button = page.getByRole('button', { name: 'Open menu' });
    await button.click();
    await expect(page.getByRole('button', { name: 'Close menu' })).toHaveAttribute('aria-expanded', 'true');
    await page.locator('#mobile-menu a', { hasText: 'Roadmap' }).click();
    await expect(page).toHaveURL(/\/roadmap$/);
    await expect(page.locator('#mobile-menu')).toBeHidden();
});

test('unknown pages and features get a 404 page', async ({ page }) => {
    expect((await page.goto('/features/not-a-feature'))?.status()).toBe(404);
    await expect(page.getByRole('heading', { level: 1, name: 'This page does not exist.' })).toBeVisible();

    expect((await page.goto('/no-such-page'))?.status()).toBe(404);
    await expect(page.getByRole('heading', { level: 1, name: 'This page does not exist.' })).toBeVisible();
});

test('the app can be installed: manifest and icons are served', async ({ page, request }) => {
    await page.goto('/');
    const href = await page.locator('link[rel="manifest"]').getAttribute('href');
    expect(href).toBeTruthy();

    const manifest = await (await request.get(href || '')).json();
    expect(manifest).toMatchObject({ name: 'FinDB', display: 'standalone', start_url: '/setup' });
    for (const icon of manifest.icons) {
        const response = await request.get(icon.src);
        expect(response.status()).toBe(200);
        expect(response.headers()['content-type']).toBe('image/png');
    }
    expect((await request.get('/apple-icon.png')).status()).toBe(200);
    expect((await request.get('/icon.svg')).status()).toBe(200);
});

test('logged out: the app footer links to the website, and back to login', async ({ page }) => {
    await page.goto('/login');

    await page.locator('.footer-links a', { hasText: 'Security Policy' }).click();
    await expect(page).toHaveURL(/\/security$/);
    await expect(page.getByRole('heading', { level: 1, name: 'Security Policy' })).toBeVisible();

    await page.locator('.header-actions a', { hasText: 'Log in' }).click();
    await expect(page).toHaveURL(/\/login$/);
    await expect(page.locator('#login-form')).toBeVisible();
});

test('logged in: the website offers the way back into the app', async ({ page }) => {
    const user = uniqueUser();
    await register(page, user);
    await chooseTracking(page, 'both');

    await page.locator('.footer-links a', { hasText: 'Privacy Guide' }).click();
    await expect(page).toHaveURL(/\/privacy$/);
    await expect(page.getByRole('heading', { level: 1, name: 'Privacy Guide' })).toBeVisible();

    await page.locator('.header-actions a', { hasText: 'Open FinDB' }).click();
    await expect(page).toHaveURL(/\/setup$/);
    await expect(page.locator('#setup-section')).toBeVisible();
});

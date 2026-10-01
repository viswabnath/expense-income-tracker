// @ts-check
/**
 * Public pages moved to Next.js in N2 (About, Security, Privacy, Terms).
 * They must open without logging in, load under the nonce Content-Security-Policy without
 * violations or console errors, and link to and from the legacy app.
 */
const { test, expect } = require('@playwright/test');
const { uniqueUser, register, chooseTracking } = require('./helpers');

const PAGES = [
    { path: '/about', heading: 'About BalanceTrack', text: 'Powered by OneMark' },
    { path: '/security', heading: 'Security Policy', text: 'Vulnerability Management' },
    { path: '/privacy', heading: 'Privacy Guide', text: 'We never sell your data' },
    { path: '/terms', heading: 'Terms of Service', text: 'Limitation of Liability' },
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

for (const { path, heading, text } of PAGES) {
    test(`${path} opens without login and loads under the nonce CSP`, async ({ page }) => {
        const problems = await watchForProblems(page);

        const response = await page.goto(path);
        expect(response?.status()).toBe(200);
        const csp = response?.headers()['content-security-policy'] || '';
        expect(csp).toMatch(/script-src 'self' 'nonce-[A-Za-z0-9+/=]+' 'strict-dynamic'/);

        await expect(page.getByRole('heading', { level: 1, name: heading })).toBeVisible();
        await expect(page.locator('.resource-body')).toContainText(text);
        await expect(page.locator('footer.app-footer')).toBeVisible();

        // Client-side navigation needs the Next.js scripts to have loaded under the CSP
        await page.locator('.footer-links a', { hasText: 'Terms of Service' }).click();
        await expect(page).toHaveURL(/\/terms$/);
        await expect(page.getByRole('heading', { level: 1, name: 'Terms of Service' })).toBeVisible();

        expect(problems).toEqual([]);
    });
}

test('logged out: the footer links to the public pages, and back to login', async ({ page }) => {
    await page.goto('/login');

    await page.locator('.footer-links a', { hasText: 'Security Policy' }).click();
    await expect(page).toHaveURL(/\/security$/);
    await expect(page.getByRole('heading', { level: 1, name: 'Security Policy' })).toBeVisible();

    // Quick links go to the app, which sends logged-out visitors to /login
    await page.locator('.footer-links a', { hasText: 'Account Setup' }).click();
    await expect(page).toHaveURL(/\/login$/);
    await expect(page.locator('#login-form')).toBeVisible();
});

test('logged in: the footer links to the public pages, and back to Setup', async ({ page }) => {
    const user = uniqueUser();
    await register(page, user);
    await chooseTracking(page, 'both');

    await page.locator('.footer-links a', { hasText: 'Privacy Guide' }).click();
    await expect(page).toHaveURL(/\/privacy$/);
    await expect(page.getByRole('heading', { level: 1, name: 'Privacy Guide' })).toBeVisible();

    await page.locator('.footer-links a', { hasText: 'Account Setup' }).click();
    await expect(page).toHaveURL(/\/setup$/);
    await expect(page.locator('#setup-section')).toBeVisible();
});

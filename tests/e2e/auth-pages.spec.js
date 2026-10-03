// @ts-check
/**
 * Auth screens moved to Next.js in N2. The login, registration and recovery flows themselves
 * are covered by flows.spec.js; this checks routing, the nonce CSP and the redirects.
 */
const { test, expect } = require('@playwright/test');

const AUTH_PAGES = [
    { path: '/login', form: '#login-form', heading: 'Login to Your Account' },
    { path: '/register', form: '#register-form', heading: 'Create New Account' },
    { path: '/forgot-username', form: '#forgot-username-form', heading: 'Find Your Username' },
    { path: '/forgot-password', form: '#forgot-password-form', heading: 'Reset Your Password' },
];

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

for (const { path, form, heading } of AUTH_PAGES) {
    test(`${path} renders under the nonce CSP without errors`, async ({ page }) => {
        const problems = await watchForProblems(page);

        const response = await page.goto(path);
        expect(response?.status()).toBe(200);
        expect(response?.headers()['content-security-policy'] || '').toMatch(/'nonce-[A-Za-z0-9+/=]+' 'strict-dynamic'/);
        await expect(page.locator(form)).toBeVisible();
        await expect(page.locator(`${form} h3`)).toHaveText(heading);

        expect(problems).toEqual([]);
    });
}

test('a logged-out visit to the app is sent to /login', async ({ page }) => {
    await page.goto('/setup');
    await expect(page).toHaveURL(/\/login$/);
    await expect(page.locator('#login-form')).toBeVisible();
});

test('a logged-out old link into the single-page app is sent to /login', async ({ page }) => {
    await page.goto('/?section=transactions');
    await expect(page).toHaveURL(/\/login$/);
});

test('the welcome step requires a session', async ({ page }) => {
    await page.goto('/welcome');
    await expect(page).toHaveURL(/\/login$/);
});

test('client-side validation shows the same errors as before, without calling the API', async ({ page }) => {
    let registerCalls = 0;
    page.on('request', request => { if (request.url().endsWith('/api/register')) registerCalls++; });

    await page.goto('/register');
    await page.locator('#register-name').fill('Test');
    await page.locator('#register-username').fill('bad.name');
    await page.locator('#register-email').fill('test@example.test');
    await page.locator('#register-password').fill('Valid_pass1');
    await page.locator('#register-confirm-password').fill('Valid_pass1');
    await page.locator('#register-security-question').selectOption('pet');
    await page.locator('#register-security-answer').fill('rex');
    await page.locator('[data-action="register"]').click();

    await expect(page.locator('.toast-message')).toHaveText('Username can only contain letters, numbers, and underscores');
    expect(registerCalls).toBe(0);
});

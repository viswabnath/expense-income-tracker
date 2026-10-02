/**
 * Activity API tests (real database, balancetrack_test schema): paging counts that follow the
 * filters, safe page and limit values, and a CSV export that spreadsheets cannot run as formulas.
 * @jest-environment node
 */

const request = require('supertest');

jest.mock('express-rate-limit', () => () => (req, res, next) => next());

const { target, closeTarget } = require('./api-target');
const { createTestUser, deleteTestUser } = require('../test-helpers');

const USERNAME = 'activity_api_user';
const PASSWORD = 'TestPass123&';
let agent;

beforeAll(async () => {
    await deleteTestUser(USERNAME);
    await createTestUser({ username: USERNAME, password: PASSWORD, email: 'activity_api@example.com' });
    agent = request.agent(target());
    expect((await agent.post('/api/login').send({ username: USERNAME, password: PASSWORD })).status).toBe(200);

    const bank = await agent.post('/api/banks').send({ name: '=SUM(1,2)', initialBalance: 100 });
    expect(bank.status).toBe(200);
    for (const source of ['say "hi"', 'Plain', 'Third']) {
        const income = await agent.post('/api/income')
            .send({ source, amount: 5, creditedToType: 'bank', creditedToId: bank.body.id, date: '2026-01-15' });
        expect(income.status).toBe(200);
    }
});

afterAll(async () => {
    await deleteTestUser(USERNAME);
    await closeTarget();
});

test('the total and page count follow the filters', async () => {
    const all = await agent.get('/api/activity?limit=2');
    expect(all.body.totalItems).toBe(4);
    expect(all.body.totalPages).toBe(2);
    expect(all.body.activities).toHaveLength(2);

    const lastYear = new Date().getFullYear() - 1;
    const filtered = await agent.get(`/api/activity?year=${lastYear}&limit=2`);
    expect(filtered.body.activities).toHaveLength(0);
    expect(filtered.body.totalItems).toBe(0);
    expect(filtered.body.totalPages).toBe(0);

    const banksOnly = await agent.get('/api/activity?type=bank');
    expect(banksOnly.body.totalItems).toBe(1);
});

test('bad page and limit values fall back to defaults instead of failing', async () => {
    const response = await agent.get('/api/activity?page=abc&limit=xyz');
    expect(response.status).toBe(200);
    expect(response.body.currentPage).toBe(1);
    expect(response.body.limit).toBe(20);

    const capped = await agent.get('/api/activity?limit=100000&page=-3');
    expect(capped.status).toBe(200);
    expect(capped.body.limit).toBe(100);
    expect(capped.body.currentPage).toBe(1);
});

test('the CSV export quotes every field and neutralizes formulas', async () => {
    const response = await agent.get('/api/activity?export=true');
    expect(response.status).toBe(200);
    const lines = response.text.split('\n');
    expect(lines[0]).toBe('Date,Type,Description,Amount,Account');
    // Quotes in a description are doubled inside a quoted field
    expect(response.text).toContain('"Added income: say ""hi"""');
    // An account named like a formula is prefixed so spreadsheets show it as text
    expect(response.text).toContain('"\'=SUM(1,2)"');
    expect(response.text).not.toMatch(/(^|,)"?=SUM/m);
    for (const line of lines.slice(1)) {
        expect(line).toMatch(/^"[^"]*","[^"]*",".*","[0-9.]+","[^"]*"$/);
    }
});

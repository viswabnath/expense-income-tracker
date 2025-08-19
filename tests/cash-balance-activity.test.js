/**
 * Cash Balance Activity Test
 * Tests that cash balance entries appear in activity feed
 */

const request = require('supertest');
const { app } = require('../server');

describe('Cash Balance Activity', () => {
    let agent;
    let userId; // Will be set during test setup

    beforeAll(async () => {
        agent = request.agent(app);

        // Register and login a test user
        const registerResponse = await agent
            .post('/api/register')
            .send({
                username: 'testuser_cash',
                password: 'Test123!',
                email: 'testcash@example.com',
                securityQuestion: 'What is your pet name?',
                securityAnswer: 'fluffy'
            });

        expect(registerResponse.status).toBe(201);
        userId = registerResponse.body.id;

        const loginResponse = await agent
            .post('/api/login')
            .send({
                username: 'testuser_cash',
                password: 'Test123!'
            });

        expect(loginResponse.status).toBe(200);
    });

    test('should include cash balance in activity feed after setting cash balance', async () => {
        // Set cash balance
        const cashResponse = await agent
            .post('/api/cash-balance')
            .send({
                balance: 5000.00
            });

        expect(cashResponse.status).toBe(200);

        // Get activity feed
        const activityResponse = await agent
            .get('/api/activity');

        expect(activityResponse.status).toBe(200);

        // Check if cash balance activity is included
        const activities = activityResponse.body;
        const cashActivity = activities.find(activity =>
            activity.activity_type === 'setup' &&
            activity.description === 'Set cash balance'
        );

        expect(cashActivity).toBeDefined();
        expect(cashActivity.amount).toBe('5000.00');
        expect(cashActivity.account_info).toBe('Cash');
        expect(cashActivity.action_type).toBe('created');
    });

    test('should show cash balance activity alongside bank activities', async () => {
        // Add a bank
        const bankResponse = await agent
            .post('/api/banks')
            .send({
                name: 'Test Bank',
                initialBalance: 10000.00
            });

        expect(bankResponse.status).toBe(200);

        // Get activity feed
        const activityResponse = await agent
            .get('/api/activity');

        expect(activityResponse.status).toBe(200);

        const activities = activityResponse.body;

        // Check both cash and bank activities exist
        const cashActivity = activities.find(activity =>
            activity.activity_type === 'setup' &&
            activity.description === 'Set cash balance'
        );

        const bankActivity = activities.find(activity =>
            activity.activity_type === 'setup' &&
            activity.description.includes('Added bank: TEST BANK')
        );

        expect(cashActivity).toBeDefined();
        expect(bankActivity).toBeDefined();

        // Both should be setup type activities
        expect(cashActivity.activity_type).toBe('setup');
        expect(bankActivity.activity_type).toBe('setup');
    });
});

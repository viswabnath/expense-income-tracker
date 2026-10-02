/**
 * Unit tests for lib/activity.ts
 */
import { describeActivity, pageLinks } from '../../lib/activity';

describe('describeActivity', () => {
    test.each([
        ['created', 'bank', 'Bank Added', 'action-bank-add'],
        ['create', 'income', 'Income Added', 'action-income'],
        ['created', 'cash_balance', 'Cash Balance Set', 'action-cash-add'],
        ['updated', 'credit_card', 'Credit Card Updated', 'action-card-update'],
        ['update', 'expense', 'Expense Updated', 'action-expense-update'],
        ['deleted', 'income', 'Income Deleted', 'action-income-delete'],
        ['delete', 'expense', 'Expense Deleted', 'action-expense-delete'],
        ['created', 'something_new', 'Created', 'action-create'],
        ['deleted', 'something_new', 'Deleted', 'action-delete'],
        ['recovery_failed', 'account', 'Recovery Attempt Failed', 'action-delete'],
        ['password_reset', 'account', 'Password Reset', 'action-update'],
        ['archived', 'bank', 'Modified', 'action-other'],
    ])('%s %s is "%s"', (action, entity, text, className) => {
        expect(describeActivity(action, entity)).toMatchObject({ text, className });
    });

    test('an entity name inherited from Object is not treated as an entity', () => {
        expect(describeActivity('created', 'toString').text).toBe('Created');
    });
});

describe('pageLinks', () => {
    test('no links for a single page', () => {
        expect(pageLinks(1, 0)).toEqual([]);
        expect(pageLinks(1, 1)).toEqual([]);
    });

    test('short lists show every page', () => {
        expect(pageLinks(1, 3)).toEqual([1, 2, 3]);
        expect(pageLinks(3, 5)).toEqual([1, 2, 3, 4, 5]);
    });

    test('long lists show the ends, two either side, and gaps', () => {
        expect(pageLinks(1, 10)).toEqual([1, 2, 3, 'dots', 10]);
        expect(pageLinks(6, 10)).toEqual([1, 'dots', 4, 5, 6, 7, 8, 'dots', 10]);
        expect(pageLinks(10, 10)).toEqual([1, 'dots', 8, 9, 10]);
        expect(pageLinks(4, 10)).toEqual([1, 2, 3, 4, 5, 6, 'dots', 10]);
    });
});

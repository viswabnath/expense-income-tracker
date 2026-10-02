import { withUser, jsonBody } from '@/lib/api-route';
import { db } from '@/lib/db';
import { addExpense, listExpenses } from '@/lib/services/transactions';

export const GET = withUser(async (request, userId) => {
    const params = request.nextUrl.searchParams;
    return Response.json(await listExpenses(db(), userId, params.get('month'), params.get('year')));
});

export const POST = withUser(async (request, userId) => Response.json(await addExpense(db(), userId, await jsonBody(request))));

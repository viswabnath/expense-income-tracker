import { withUser, jsonBody } from '@/lib/api-route';
import { db } from '@/lib/db';
import { addIncome, listIncome } from '@/lib/services/transactions';

export const GET = withUser(async (request, userId) => {
    const params = request.nextUrl.searchParams;
    return Response.json(await listIncome(db(), userId, params.get('month'), params.get('year')));
});

export const POST = withUser(async (request, userId) => Response.json(await addIncome(db(), userId, await jsonBody(request))));

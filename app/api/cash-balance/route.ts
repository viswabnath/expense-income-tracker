import { withUser, jsonBody } from '@/lib/api-route';
import { db } from '@/lib/db';
import { getCash, setCash } from '@/lib/services/accounts';

export const GET = withUser(async (_request, userId) => Response.json(await getCash(db(), userId)));

export const POST = withUser(async (request, userId) => Response.json(await setCash(db(), userId, await jsonBody(request))));

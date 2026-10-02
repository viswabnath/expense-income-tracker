import { withUser, jsonBody } from '@/lib/api-route';
import { db } from '@/lib/db';
import { addBank, listBanks } from '@/lib/services/accounts';

export const GET = withUser(async (_request, userId) => Response.json(await listBanks(db(), userId)));

export const POST = withUser(async (request, userId) => Response.json(await addBank(db(), userId, await jsonBody(request))));

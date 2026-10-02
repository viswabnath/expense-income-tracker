import { withUser, jsonBody } from '@/lib/api-route';
import { db } from '@/lib/db';
import { addCard, listCards } from '@/lib/services/accounts';

export const GET = withUser(async (_request, userId) => Response.json(await listCards(db(), userId)));

export const POST = withUser(async (request, userId) => Response.json(await addCard(db(), userId, await jsonBody(request))));

import { withUser } from '@/lib/api-route';
import { db } from '@/lib/db';
import { getUser } from '@/lib/services/auth';

export const GET = withUser(async (_request, userId) => Response.json(await getUser(db(), userId)));

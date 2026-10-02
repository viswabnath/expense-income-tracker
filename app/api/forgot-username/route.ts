import { jsonBody, withPublic } from '@/lib/api-route';
import { db } from '@/lib/db';
import { forgotUsername } from '@/lib/services/auth';

export const POST = withPublic(async (request) => Response.json(await forgotUsername(db(), await jsonBody(request))),
    { authLimited: true, errorMessage: 'Server error. Please try again.' });

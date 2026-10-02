import { jsonBody, withPublic } from '@/lib/api-route';
import { db } from '@/lib/db';
import { forgotPassword } from '@/lib/services/auth';

export const POST = withPublic(async (request) => Response.json(await forgotPassword(db(), await jsonBody(request))),
    { authLimited: true, errorMessage: 'Server error. Please try again.' });

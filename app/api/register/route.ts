import { isHttps, jsonBody, withPublic } from '@/lib/api-route';
import { db } from '@/lib/db';
import { register } from '@/lib/services/auth';
import { createSession, destroySession, SESSION_COOKIE } from '@/lib/session';

// Registration also logs the new user in, with a fresh session
export const POST = withPublic(async (request) => {
    const userId = await register(db(), await jsonBody(request));
    await destroySession(db(), request.cookies.get(SESSION_COOKIE)?.value);
    const cookie = await createSession(db(), userId, isHttps(request));
    return Response.json({ success: true, userId }, { headers: { 'Set-Cookie': cookie } });
}, { authLimited: true, errorMessage: 'Registration failed. Please try again.' });

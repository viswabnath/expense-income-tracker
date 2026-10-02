import { jsonBody, withPublic } from '@/lib/api-route';
import { db } from '@/lib/db';
import { resetPassword } from '@/lib/services/auth';

export const POST = withPublic(async (request) => {
    await resetPassword(db(), await jsonBody(request));
    return Response.json({ success: true, message: 'Password reset successfully' });
}, { authLimited: true, errorMessage: 'Server error. Please try again.' });

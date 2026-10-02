import { jsonBody, withUser } from '@/lib/api-route';
import { db } from '@/lib/db';
import { setTrackingOption } from '@/lib/services/auth';

export const POST = withUser(async (request, userId) => {
    await setTrackingOption(db(), userId, await jsonBody(request));
    return Response.json({ success: true });
});

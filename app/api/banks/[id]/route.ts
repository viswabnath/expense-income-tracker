import { withUser, jsonBody } from '@/lib/api-route';
import { db } from '@/lib/db';
import { deleteBank, updateBank } from '@/lib/services/accounts';

/** The [id] segment, as Next.js passes it to route handlers */
type Context = { params: Promise<{ id: string }> };

export const PUT = withUser<Context>(async (request, userId, context) => {
    const { id } = await context.params;
    return Response.json(await updateBank(db(), userId, id, await jsonBody(request)));
});

export const DELETE = withUser<Context>(async (_request, userId, context) => {
    const { id } = await context.params;
    await deleteBank(db(), userId, id);
    return Response.json({ success: true, message: 'Bank deleted successfully' });
});

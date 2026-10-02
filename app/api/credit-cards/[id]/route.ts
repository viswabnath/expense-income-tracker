import { withUser, jsonBody } from '@/lib/api-route';
import { db } from '@/lib/db';
import { deleteCard, updateCard } from '@/lib/services/accounts';

/** The [id] segment, as Next.js passes it to route handlers */
type Context = { params: Promise<{ id: string }> };

export const PUT = withUser<Context>(async (request, userId, context) => {
    const { id } = await context.params;
    return Response.json(await updateCard(db(), userId, id, await jsonBody(request)));
});

export const DELETE = withUser<Context>(async (_request, userId, context) => {
    const { id } = await context.params;
    await deleteCard(db(), userId, id);
    return Response.json({ success: true, message: 'Credit card deleted successfully' });
});

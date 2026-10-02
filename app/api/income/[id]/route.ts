import { withUser, jsonBody } from '@/lib/api-route';
import { db } from '@/lib/db';
import { deleteIncome, getIncome, updateIncome } from '@/lib/services/transactions';

/** The [id] segment, as Next.js passes it to route handlers */
type Context = { params: Promise<{ id: string }> };

export const GET = withUser<Context>(async (_request, userId, context) => {
    const { id } = await context.params;
    return Response.json(await getIncome(db(), userId, id));
});

export const PUT = withUser<Context>(async (request, userId, context) => {
    const { id } = await context.params;
    await updateIncome(db(), userId, id, await jsonBody(request));
    return Response.json({ success: true, message: 'Income transaction updated successfully' });
});

export const DELETE = withUser<Context>(async (_request, userId, context) => {
    const { id } = await context.params;
    await deleteIncome(db(), userId, id);
    return Response.json({ success: true, message: 'Income transaction deleted successfully' });
});

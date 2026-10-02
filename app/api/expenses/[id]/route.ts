import { withUser, jsonBody } from '@/lib/api-route';
import { db } from '@/lib/db';
import { deleteExpense, getExpense, updateExpense } from '@/lib/services/transactions';

/** The [id] segment, as Next.js passes it to route handlers */
type Context = { params: Promise<{ id: string }> };

export const GET = withUser<Context>(async (_request, userId, context) => {
    const { id } = await context.params;
    return Response.json(await getExpense(db(), userId, id));
});

export const PUT = withUser<Context>(async (request, userId, context) => {
    const { id } = await context.params;
    await updateExpense(db(), userId, id, await jsonBody(request));
    return Response.json({ success: true, message: 'Expense transaction updated successfully' });
});

export const DELETE = withUser<Context>(async (_request, userId, context) => {
    const { id } = await context.params;
    await deleteExpense(db(), userId, id);
    return Response.json({ success: true, message: 'Expense transaction deleted successfully' });
});

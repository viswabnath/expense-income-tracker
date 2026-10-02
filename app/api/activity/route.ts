import { withUser } from '@/lib/api-route';
import { db } from '@/lib/db';
import { activityCsv, activityPage, type ActivityQuery } from '@/lib/services/reports';

export const GET = withUser(async (request, userId) => {
    const params = request.nextUrl.searchParams;
    const query: ActivityQuery = {
        page: params.get('page'),
        limit: params.get('limit'),
        type: params.get('type'),
        month: params.get('month'),
        year: params.get('year'),
        fromDate: params.get('from_date'),
        toDate: params.get('to_date'),
    };
    // Any non-empty export value, as with Express's query parsing
    if (params.get('export')) {
        return new Response(await activityCsv(db(), userId, query), {
            headers: { 'Content-Type': 'text/csv', 'Content-Disposition': 'attachment; filename=activity-export.csv' },
        });
    }
    return Response.json(await activityPage(db(), userId, query));
});

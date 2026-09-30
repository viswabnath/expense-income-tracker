/**
 * Confirms the Next.js service is deployed and routed. It is the only path Next.js
 * handles until screens start moving over in N2.
 */
export function GET() {
    return Response.json({ ok: true, app: 'next' });
}

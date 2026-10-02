import { jsonError } from '@/lib/api-route';

/** Any API path without its own route: a JSON 404, not the HTML not-found page */
const notFound = async () => jsonError(404, 'Not found');

export const GET = notFound;
export const POST = notFound;
export const PUT = notFound;
export const PATCH = notFound;
export const DELETE = notFound;

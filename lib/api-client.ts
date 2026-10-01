/**
 * Minimal browser client for the JSON API (served by the legacy Express app until N3).
 * Same-origin requests, so the session cookie is sent automatically.
 */

export interface ApiResult<T> {
    ok: boolean;
    status: number;
    data: T;
}

async function request<T>(method: 'GET' | 'POST', path: string, body?: unknown): Promise<ApiResult<T>> {
    const response = await fetch(path, {
        method,
        credentials: 'same-origin',
        headers: body === undefined ? undefined : { 'Content-Type': 'application/json' },
        body: body === undefined ? undefined : JSON.stringify(body),
    });
    const data = (await response.json().catch(() => ({}))) as T;
    return { ok: response.ok, status: response.status, data };
}

export const apiGet = <T>(path: string) => request<T>('GET', path);
export const apiPost = <T>(path: string, body: unknown) => request<T>('POST', path, body);

/** Error text from an API error body, with a fallback */
export function apiError(data: unknown, fallback: string): string {
    if (data && typeof data === 'object' && 'error' in data && typeof (data as { error: unknown }).error === 'string') {
        return (data as { error: string }).error;
    }
    return fallback;
}

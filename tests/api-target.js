/**
 * Where the API suites send their requests: a running Next.js server at API_BASE_URL.
 * `npm test` builds and starts one on the balancetrack_test schema (scripts/run-api-tests.js);
 * to test an already running server, set API_BASE_URL yourself. The suites also read and write
 * the test schema directly through test-helpers.
 */
const baseUrl = process.env.API_BASE_URL;

/** Pass to supertest: request(target()) or request.agent(target()) */
function target() {
    if (!baseUrl) {
        throw new Error('API_BASE_URL is not set: run the API suites with `npm test` (it starts a server), or set it to a running server');
    }
    return baseUrl;
}

/** Nothing to close: the server runs in its own process */
async function closeTarget() {}

module.exports = { target, closeTarget };

/**
 * What the API contract suites send requests to.
 *
 * - Default: the Express app in-process (fast, no server to start).
 * - API_BASE_URL set (e.g. http://localhost:3200): a running server, which can be the
 *   Express app or the Next.js app. The same tests then check either implementation.
 *
 * The running server must use the balancetrack_test schema; the suites also read and
 * write that schema directly through test-helpers.
 */
const baseUrl = process.env.API_BASE_URL;

let inProcessServer = null;
function loadInProcessServer() {
    if (!inProcessServer) {
        inProcessServer = require('../server');
    }
    return inProcessServer;
}

/** Pass to supertest: request(target()) or request.agent(target()) */
function target() {
    return baseUrl || loadInProcessServer().app;
}

/** Close the in-process server's database pool, if one was opened */
async function closeTarget() {
    if (inProcessServer) {
        await inProcessServer.pool.end();
    }
}

module.exports = { target, closeTarget, isRemote: Boolean(baseUrl) };

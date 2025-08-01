const helmet = require('helmet');

// Test what the default CSP looks like
const defaultCSP = helmet.contentSecurityPolicy();
console.log('Default CSP configuration:');
console.log(JSON.stringify(defaultCSP, null, 2));

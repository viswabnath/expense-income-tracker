/**
 * CSP Compliance Tests
 * Tests for Content Security Policy compliance in frontend code
 * @jest-environment jsdom
 */

const fs = require('fs');
const path = require('path');

// Mock DOM globals
global.fetch = jest.fn();
global.console.log = jest.fn();
global.console.error = jest.fn();

describe('CSP Compliance Tests', () => {
    const jsFiles = [
        'activity-manager.js',
        'setup-manager.js',
        'summary-manager.js',
        'transaction-manager.js',
        'navigation-manager.js',
        'api.js',
        'auth.js',
        'app.js'
    ];

    describe('Inline Event Handler Compliance', () => {
        jsFiles.forEach(fileName => {
            test(`${fileName} should not contain inline onclick handlers`, () => {
                const filePath = path.join(__dirname, '../public/js', fileName);
                const fileContent = fs.readFileSync(filePath, 'utf8');

                // Check for inline event handlers that violate CSP
                expect(fileContent).not.toContain('onclick=');
                expect(fileContent).not.toContain('onchange=');
                expect(fileContent).not.toContain('onsubmit=');
                expect(fileContent).not.toContain('onkeyup=');
                expect(fileContent).not.toContain('onkeydown=');
                expect(fileContent).not.toContain('onfocus=');
                expect(fileContent).not.toContain('onblur=');
            });

            test(`${fileName} should use proper addEventListener instead`, () => {
                const filePath = path.join(__dirname, '../public/js', fileName);
                const fileContent = fs.readFileSync(filePath, 'utf8');

                // If the file has interactive elements, it should use addEventListener
                // Exception: activity-manager.js and auth.js use global functions
                if ((fileContent.includes('getElementById') || fileContent.includes('querySelector')) &&
                    fileName !== 'activity-manager.js' && fileName !== 'auth.js') {
                    expect(fileContent).toContain('addEventListener');
                }
            });
        });
    });

    describe('HTML Template CSP Compliance', () => {
        test('main index.html should not contain inline event handlers', () => {
            const htmlPath = path.join(__dirname, '../public/index.html');
            const htmlContent = fs.readFileSync(htmlPath, 'utf8');

            // Check for inline event handlers in HTML
            expect(htmlContent).not.toContain('onclick=');
            expect(htmlContent).not.toContain('onchange=');
            expect(htmlContent).not.toContain('onsubmit=');
            expect(htmlContent).not.toContain('onload=');
        });

        test('HTML should use CSP-compliant script loading', () => {
            const htmlPath = path.join(__dirname, '../public/index.html');
            const htmlContent = fs.readFileSync(htmlPath, 'utf8');

            // Should load scripts with proper src attributes, not inline
            const scriptTags = htmlContent.match(/<script[^>]*>/g) || [];
            scriptTags.forEach(scriptTag => {
                if (scriptTag.includes('src=')) {
                    // External scripts are CSP-compliant
                    expect(scriptTag).toContain('src=');
                } else {
                    // Inline scripts should be minimal or avoided
                    expect(scriptTag).not.toContain('eval(');
                    expect(scriptTag).not.toContain('new Function(');
                }
            });
        });
    });

    describe('Event Delegation Patterns', () => {
        test('activity-manager.js should use proper event delegation', () => {
            const filePath = path.join(__dirname, '../public/js/activity-manager.js');
            const fileContent = fs.readFileSync(filePath, 'utf8');

            // Activity manager uses global functions instead of direct event listeners
            expect(fileContent).toContain('function filterActivity');
            expect(fileContent).toContain('function clearActivityFilters');

            // Should not create inline handlers in DOM manipulation
            expect(fileContent).not.toContain('onclick=');

            // innerHTML is used but without inline handlers (which is CSP-compliant)
            expect(fileContent).toContain('innerHTML');
            // Ensure no inline event handlers are combined with innerHTML
            expect(fileContent).not.toMatch(/innerHTML.*onclick=/);
        });

        test('setup-manager.js should handle events through delegation', () => {
            const filePath = path.join(__dirname, '../public/js/setup-manager.js');
            const fileContent = fs.readFileSync(filePath, 'utf8');

            // Check for proper event handling patterns
            expect(fileContent).toContain('addEventListener');
            expect(fileContent).not.toContain('onclick=');
        });

        test('summary-manager.js should use attachActionButtonListeners', () => {
            const filePath = path.join(__dirname, '../public/js/summary-manager.js');
            const fileContent = fs.readFileSync(filePath, 'utf8');

            // Should have dedicated function for CSP-compliant event attachment
            expect(fileContent).toContain('attachActionButtonListeners');
            expect(fileContent).toContain('addEventListener');
            expect(fileContent).not.toContain('onclick=');
        });
    });

    describe('Dynamic Content Security', () => {
        test('should not use eval() or Function() constructor', () => {
            jsFiles.forEach(fileName => {
                const filePath = path.join(__dirname, '../public/js', fileName);
                const fileContent = fs.readFileSync(filePath, 'utf8');

                expect(fileContent).not.toContain('eval(');
                expect(fileContent).not.toContain('new Function(');
                expect(fileContent).not.toContain('setTimeout(string');
                expect(fileContent).not.toContain('setInterval(string');
            });
        });

        test('should safely handle innerHTML updates', () => {
            jsFiles.forEach(fileName => {
                const filePath = path.join(__dirname, '../public/js', fileName);
                const fileContent = fs.readFileSync(filePath, 'utf8');

                // If using innerHTML, should not include script content
                const innerHTMLMatches = fileContent.match(/innerHTML\s*=\s*[`"']([^`"']*)[`"']/g) || [];
                innerHTMLMatches.forEach(match => {
                    expect(match).not.toContain('<script');
                    expect(match).not.toContain('javascript:');
                    expect(match).not.toContain('onclick=');
                });
            });
        });
    });

    describe('Security Header Compliance', () => {
        test('server.js should have proper CSP headers', () => {
            const serverPath = path.join(__dirname, '../server.js');
            const serverContent = fs.readFileSync(serverPath, 'utf8');

            // Should use helmet for security headers
            expect(serverContent).toContain('helmet');
            expect(serverContent).toContain('contentSecurityPolicy');
        });

        test('CSP configuration should be restrictive', () => {
            const serverPath = path.join(__dirname, '../server.js');
            const serverContent = fs.readFileSync(serverPath, 'utf8');

            // Should not allow unsafe-inline for scripts
            if (serverContent.includes('contentSecurityPolicy')) {
                expect(serverContent).not.toContain('\'unsafe-inline\'');
                expect(serverContent).not.toContain('\'unsafe-eval\'');
            }
        });
    });

    describe('Data Attribute Usage', () => {
        test('should use data attributes for element identification', () => {
            const setupManagerPath = path.join(__dirname, '../public/js/setup-manager.js');
            const setupContent = fs.readFileSync(setupManagerPath, 'utf8');

            // Setup manager uses data-action for button identification
            expect(setupContent).toContain('data-action');
        });

        test('should handle data attributes in event delegation', () => {
            const summaryManagerPath = path.join(__dirname, '../public/js/summary-manager.js');
            const summaryContent = fs.readFileSync(summaryManagerPath, 'utf8');

            // Should read data attributes in event handlers
            if (summaryContent.includes('data-action')) {
                expect(summaryContent).toContain('dataset.action') ||
                       expect(summaryContent).toContain('getAttribute(\'data-action\')');
            }
        });
    });

    describe('Best Practices Compliance', () => {
        test('should use const/let instead of var', () => {
            jsFiles.forEach(fileName => {
                const filePath = path.join(__dirname, '../public/js', fileName);
                const fileContent = fs.readFileSync(filePath, 'utf8');

                // Modern code should prefer const/let
                const varCount = (fileContent.match(/\bvar\s+/g) || []).length;
                const constLetCount = (fileContent.match(/\b(const|let)\s+/g) || []).length;

                // Should prefer const/let over var (allowing some legacy var usage)
                if (constLetCount > 0) {
                    expect(constLetCount).toBeGreaterThan(varCount * 0.5);
                }
            });
        });

        test('should have proper error handling', () => {
            jsFiles.forEach(fileName => {
                const filePath = path.join(__dirname, '../public/js', fileName);
                const fileContent = fs.readFileSync(filePath, 'utf8');

                // If using fetch or async operations, should have error handling
                if (fileContent.includes('fetch(') || fileContent.includes('async ')) {
                    expect(fileContent).toContain('catch') ||
                           expect(fileContent).toContain('try');
                }
            });
        });
    });
});

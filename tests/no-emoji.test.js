/**
 * No Emoji Policy Tests
 * The app UI, docs and server/log output must not contain emoji
 */

const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');

// Emoji and pictograph ranges. Every emoji sequence contains a base character from these ranges.
// Currency signs such as the rupee symbol and arrows are outside them and stay allowed.
const EMOJI = /[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{2B00}-\u{2BFF}\u{2300}-\u{23FF}]/u;

function collectFiles(dir, extensions) {
    return fs.readdirSync(dir, { withFileTypes: true }).flatMap(entry => {
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory()) return collectFiles(fullPath, extensions);
        return extensions.includes(path.extname(entry.name)) ? [fullPath] : [];
    });
}

const files = [
    ...collectFiles(path.join(root, 'legacy', 'public'), ['.html', '.js', '.css']),
    ...collectFiles(path.join(root, 'docs'), ['.md']),
    ...collectFiles(path.join(root, 'app'), ['.ts', '.tsx', '.css']),
    ...collectFiles(path.join(root, 'lib'), ['.ts']),
    ...['README.md', 'CLAUDE.md', 'legacy/server.js', 'setup-db.js', 'reset-test-db.js', 'test-helpers.js']
        .map(name => path.join(root, name))
        .filter(fullPath => fs.existsSync(fullPath))
];

describe('No emoji policy', () => {
    test.each(files.map(fullPath => [path.relative(root, fullPath), fullPath]))('%s contains no emoji', (_name, fullPath) => {
        const offending = fs.readFileSync(fullPath, 'utf8')
            .split('\n')
            .map((line, index) => ({ line: index + 1, text: line.trim() }))
            .filter(({ text }) => EMOJI.test(text));

        expect(offending).toEqual([]);
    });
});

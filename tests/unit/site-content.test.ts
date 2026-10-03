/**
 * The website's content (components/site): every feature has a unique address and complete
 * copy, every situation in the scenario explorer balances, and the sitemap lists every page.
 */
import fs from 'fs';
import path from 'path';
import { FAQ, FEATURES, GROUPS, ROADMAP, TOOLS, featureBySlug, toolBySlug } from '../../components/site/content';
import { SCENARIOS } from '../../components/site/ScenarioExplorer';
import sitemap from '../../app/sitemap';

const root = path.join(__dirname, '..', '..');

describe('features', () => {
    test('slugs are unique and safe in a URL', () => {
        const slugs = FEATURES.map(feature => feature.slug);
        expect(new Set(slugs).size).toBe(slugs.length);
        for (const slug of slugs) expect(slug).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/);
    });

    test('every feature has a summary, points and a worked example', () => {
        for (const feature of FEATURES) {
            expect(feature.short.length).toBeGreaterThan(20);
            expect(feature.summary.length).toBeGreaterThan(feature.short.length);
            expect(feature.points.length).toBeGreaterThanOrEqual(3);
            expect(feature.example.lines.length).toBeGreaterThan(0);
            expect(feature.example.result).not.toBe('');
        }
    });

    test('only available features list what comes next', () => {
        for (const feature of FEATURES) {
            if (feature.next) expect(feature.status).toBe('available');
        }
    });

    test('lookup by slug', () => {
        expect(featureBySlug('loans')?.name).toBe('Loans and chit funds');
        expect(featureBySlug('toString')).toBeUndefined();
    });
});

describe('groups and tools', () => {
    test('every feature is in a known group, and every group has a feature', () => {
        const ids = GROUPS.map(group => group.id);
        for (const feature of FEATURES) expect(ids).toContain(feature.group);
        for (const id of ids) expect(FEATURES.some(feature => feature.group === id)).toBe(true);
    });

    test('tool slugs are unique and every tool has a page question', () => {
        expect(new Set(TOOLS.map(tool => tool.slug)).size).toBe(TOOLS.length);
        for (const tool of TOOLS) expect(tool.question).toMatch(/\?$/);
        expect(toolBySlug('emi-calculator')?.name).toBe('EMI calculator');
        expect(toolBySlug('constructor')).toBeUndefined();
    });
});

describe('scenario explorer', () => {
    test.each(SCENARIOS.map(scenario => [scenario.id, scenario]))('%s: money in equals money out', (_id, scenario) => {
        const from = scenario.from.reduce((sum, line) => sum + line.amount, 0);
        const to = scenario.to.reduce((sum, line) => sum + line.amount, 0);
        expect(from).toBe(to);
        expect(from).toBeGreaterThan(0);
    });
});

describe('questions and roadmap', () => {
    test('questions are unique', () => {
        expect(new Set(FAQ.map(item => item.q)).size).toBe(FAQ.length);
    });

    test('roadmap stages run from available, through building, to planned', () => {
        const order = { available: 0, building: 1, planned: 2 };
        const ranks = ROADMAP.map(stage => order[stage.status]);
        expect([...ranks].sort()).toEqual(ranks);
    });
});

describe('sitemap', () => {
    test('lists every website page and every feature', () => {
        const paths = sitemap().map(entry => new URL(entry.url).pathname);
        for (const feature of FEATURES) expect(paths).toContain(`/features/${feature.slug}`);
        for (const tool of TOOLS) expect(paths).toContain(`/tools/${tool.slug}`);

        const siteDir = path.join(root, 'app', '(site)');
        const staticPages = fs.readdirSync(siteDir, { withFileTypes: true })
            .filter(entry => entry.isDirectory() && fs.existsSync(path.join(siteDir, entry.name, 'page.tsx')))
            .map(entry => `/${entry.name}`);
        for (const page of ['/', ...staticPages]) expect(paths).toContain(page);
    });
});

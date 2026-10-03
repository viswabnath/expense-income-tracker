/**
 * Draws the FinDB app icons (the "Ledger F" mark) as PNG files with the Playwright browser:
 *   public/icons/icon-192.png, icon-512.png  rounded tile, for the web app manifest
 *   public/icons/maskable-512.png            full-bleed with a safe zone, for Android adaptive icons
 *   app/apple-icon.png                       180 px full-bleed, for the iPhone and iPad home screen
 * and writes app/icon.svg, the browser tab icon. Run with: node scripts/generate-icons.js
 */
const fs = require('fs');
const path = require('path');
const { chromium } = require('@playwright/test');

const GREEN = '#0f8a5f';
const GOLD = '#e8a531';
const root = path.join(__dirname, '..');

/** The mark on a 64-unit grid. `bleed` fills the square; `scale` shrinks the glyph into a safe zone. */
function markSvg({ bleed = false, scale = 1 } = {}) {
    const tile = bleed ? `<rect width="64" height="64" fill="${GREEN}"/>` : `<rect width="64" height="64" rx="15" fill="${GREEN}"/>`;
    const offset = 32 * (1 - scale);
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">${tile}`
        + `<g transform="translate(${offset} ${offset}) scale(${scale})">`
        + '<path d="M21 50 V15 H44 M21 31 H44" fill="none" stroke="#ffffff" stroke-width="6" stroke-linecap="round" stroke-linejoin="round"/>'
        + `<rect x="37" y="41" width="9" height="9" rx="1.5" fill="${GOLD}"/>`
        + '</g></svg>';
}

async function main() {
    fs.writeFileSync(path.join(root, 'app', 'icon.svg'), markSvg() + '\n');

    const outputs = [
        { file: 'public/icons/icon-192.png', size: 192, svg: markSvg() },
        { file: 'public/icons/icon-512.png', size: 512, svg: markSvg() },
        { file: 'public/icons/maskable-512.png', size: 512, svg: markSvg({ bleed: true, scale: 0.72 }) },
        { file: 'app/apple-icon.png', size: 180, svg: markSvg({ bleed: true, scale: 0.86 }) },
    ];

    const browser = await chromium.launch();
    const page = await browser.newPage();
    for (const { file, size, svg } of outputs) {
        await page.setViewportSize({ width: size, height: size });
        await page.setContent(`<html><body style="margin:0;background:transparent">${svg.replace('<svg ', `<svg width="${size}" height="${size}" `)}</body></html>`);
        await page.locator('svg').screenshot({ path: path.join(root, file), omitBackground: true });
        console.log(`Wrote ${file}`);
    }
    await browser.close();
}

main().catch(error => {
    console.error(error);
    process.exit(1);
});

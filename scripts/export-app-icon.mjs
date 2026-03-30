/**
 * Rasterize docs/assets/async-logo.svg → resources/icons/icon.png (256×256).
 * Run: node scripts/export-app-icon.mjs (requires devDependency `sharp`).
 */
import { mkdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');
const svgPath = path.join(root, 'docs', 'assets', 'async-logo.svg');
const outDir = path.join(root, 'resources', 'icons');
const outPng = path.join(outDir, 'icon.png');
const publicDir = path.join(root, 'public');
const faviconPng = path.join(publicDir, 'favicon.png');

const sharp = (await import('sharp')).default;

await mkdir(outDir, { recursive: true });
await mkdir(publicDir, { recursive: true });
const svg = await readFile(svgPath);

// 深色圆角底（四角透明）+ 居中 LOGO
const size = 256;
const cornerRadius = Math.round(size * 0.156); // ~40px，略圆但不「药丸」
const logoPx = Math.round(size * 0.86);

const roundedPlateSvg = Buffer.from(
	`<svg width="${size}" height="${size}" xmlns="http://www.w3.org/2000/svg">
		<rect width="${size}" height="${size}" rx="${cornerRadius}" ry="${cornerRadius}" fill="#0c0c0e"/>
	</svg>`,
);

const plate = await sharp(roundedPlateSvg).ensureAlpha().png().toBuffer();
const logo = await sharp(svg).resize(logoPx, logoPx).png().toBuffer();

await sharp(plate)
	.composite([{ input: logo, gravity: 'center' }])
	.png()
	.toFile(outPng);

await sharp(outPng).resize(32, 32).png().toFile(faviconPng);

console.log('[export-app-icon] wrote', outPng, 'and', faviconPng);

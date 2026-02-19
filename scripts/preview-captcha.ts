/**
 * CAPTCHA Preview Script
 *
 * Generates sample CAPTCHA images and saves them to disk for visual inspection.
 * Usage: bun run scripts/preview-captcha.ts [count]
 *
 * Images are saved to: scripts/captcha-preview/
 */

import { randomInt } from 'node:crypto';
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { createCanvas } from '@napi-rs/canvas';

// Unambiguous characters — excludes 0/O, 1/I/l, 5/S, 8/B, 2/Z to reduce OCR confusion with distortion
const CAPTCHA_CHARS = 'ACDEFGHJKMNPQRTUVWXY3467';
const CAPTCHA_LENGTH_MIN = 5;
const CAPTCHA_LENGTH_MAX = 7;

function generateCaptcha(): { text: string; answer: string } {
	const length = randomInt(CAPTCHA_LENGTH_MIN, CAPTCHA_LENGTH_MAX + 1);
	let text = '';
	for (let i = 0; i < length; i++) {
		text += CAPTCHA_CHARS[randomInt(CAPTCHA_CHARS.length)];
	}
	return { text, answer: text };
}

function paintCanvasNoise(
	ctx: ReturnType<ReturnType<typeof createCanvas>['getContext']>,
	width: number,
	height: number,
	lineCount: number,
	dotCount: number,
): void {
	ctx.fillStyle = `hsl(${randomInt(200, 260)}, 15%, 18%)`;
	ctx.fillRect(0, 0, width, height);

	for (let i = 0; i < lineCount; i++) {
		ctx.strokeStyle = `hsla(${randomInt(0, 360)}, 50%, 50%, 0.25)`;
		ctx.lineWidth = randomInt(1, 2);
		ctx.beginPath();
		ctx.moveTo(randomInt(0, width), randomInt(0, height));
		ctx.bezierCurveTo(
			randomInt(0, width),
			randomInt(0, height),
			randomInt(0, width),
			randomInt(0, height),
			randomInt(0, width),
			randomInt(0, height),
		);
		ctx.stroke();
	}

	for (let i = 0; i < dotCount; i++) {
		ctx.fillStyle = `hsla(${randomInt(0, 360)}, 40%, 60%, ${(randomInt(10, 30) / 100).toFixed(2)})`;
		ctx.beginPath();
		ctx.arc(randomInt(0, width), randomInt(0, height), randomInt(1, 2), 0, Math.PI * 2);
		ctx.fill();
	}
}

function renderCaptchaImage(text: string): Buffer {
	const width = 480;
	const height = 140;
	const canvas = createCanvas(width, height);
	const ctx = canvas.getContext('2d');

	// Heavy noise background
	paintCanvasNoise(ctx, width, height, 8, 80);

	// Draw decoy characters — bold and ~10% more visible than main text (fools AI contrast detection)
	// Positioned only in top/bottom edges to avoid cluttering the center text zone
	const decoyCount = randomInt(6, 12);
	for (let i = 0; i < decoyCount; i++) {
		ctx.save();
		const dx = randomInt(10, width - 10);
		// Keep decoys out of the vertical middle (30%-70%) — place in top or bottom band
		const dy = randomInt(2) === 0
			? randomInt(5, Math.floor(height * 0.3))
			: randomInt(Math.ceil(height * 0.7), height - 5);
		ctx.translate(dx, dy);
		ctx.rotate((randomInt(-60, 61) * Math.PI) / 180);
		ctx.font = `bold ${randomInt(28, 50)}px monospace`;
		ctx.fillStyle = `hsla(${randomInt(0, 360)}, 65%, 68%, 0.80)`;
		ctx.textAlign = 'center';
		ctx.textBaseline = 'middle';
		ctx.fillText(CAPTCHA_CHARS[randomInt(CAPTCHA_CHARS.length)], 0, 0);
		ctx.restore();
	}

	// Interference lines drawn BEFORE the answer text so characters render on top
	// and survive Discord's image compression

	// Interference lines drawn BEFORE the answer text so characters render on top
	// and survive Discord's image compression

	// Strong bezier interference lines through the text zone
	const yMinBezier = Math.floor(height * 0.15);
	const yMaxBezier = Math.max(yMinBezier + 1, Math.floor(height * 0.85));
	const hMinBezier = Math.floor(height * 0.05);
	const hMaxBezier = Math.max(hMinBezier + 1, Math.floor(height * 0.95));
	const wMin15 = Math.floor(width * 0.15);
	const wMax45 = Math.max(wMin15 + 1, Math.floor(width * 0.45));
	const wMin55 = Math.floor(width * 0.55);
	const wMax85 = Math.max(wMin55 + 1, Math.floor(width * 0.85));
	for (let i = 0; i < 6; i++) {
		ctx.strokeStyle = `hsla(${randomInt(0, 360)}, 70%, 55%, ${(randomInt(25, 45) / 100).toFixed(2)})`;
		ctx.lineWidth = randomInt(2, 4);
		ctx.beginPath();
		const yStart = randomInt(yMinBezier, yMaxBezier);
		const yEnd = randomInt(yMinBezier, yMaxBezier);
		ctx.moveTo(randomInt(0, 20), yStart);
		ctx.bezierCurveTo(
			randomInt(wMin15, wMax45),
			randomInt(hMinBezier, hMaxBezier),
			randomInt(wMin55, wMax85),
			randomInt(hMinBezier, hMaxBezier),
			randomInt(width - 20, width),
			yEnd,
		);
		ctx.stroke();
	}

	// Grid-like interference (breaks character segmentation)
	const yMinGrid = Math.floor(height * 0.2);
	const yMaxGrid = Math.max(yMinGrid + 1, Math.floor(height * 0.8));
	for (let i = 0; i < 5; i++) {
		ctx.strokeStyle = `hsla(${randomInt(0, 360)}, 50%, 50%, ${(randomInt(15, 30) / 100).toFixed(2)})`;
		ctx.lineWidth = randomInt(1, 3);
		ctx.beginPath();
		const y = randomInt(yMinGrid, yMaxGrid);
		ctx.moveTo(0, y + randomInt(-8, 9));
		ctx.lineTo(width, y + randomInt(-8, 9));
		ctx.stroke();
	}

	// Draw actual characters — rendered AFTER interference so they stay readable
	const chars = text.split('');
	const charSpacing = 42;
	const totalWidth = chars.length * charSpacing;
	let x = (width - totalWidth) / 2;

	// Wavy baseline using sine wave (25% more amplitude)
	const waveAmplitude = randomInt(8, 15);
	const waveFrequency = randomInt(15, 30) / 1000;
	const wavePhase = randomInt(0, 628) / 100; // 0 to 2π

	for (let i = 0; i < chars.length; i++) {
		const char = chars[i];
		ctx.save();

		// 25% more rotation (±31°)
		const angle = (randomInt(-31, 32) * Math.PI) / 180;

		// Wavy y-offset via sine + stronger jitter
		const sineOffset = Math.sin(x * waveFrequency + wavePhase) * waveAmplitude;
		const yOffset = sineOffset + randomInt(-5, 6);

		ctx.translate(x + charSpacing / 2, height / 2 + yOffset);
		ctx.rotate(angle);

		// Wide font size variation per character (28-48px)
		const charSize = randomInt(28, 49);
		ctx.font = `${charSize}px monospace`; // NOT bold (decoys are bold)

		const hue = randomInt(0, 360);

		// Dark backing behind each character for contrast against noise
		ctx.shadowColor = `hsla(${hue}, 20%, 10%, 0.6)`;
		ctx.shadowBlur = 4;

		// Strong enough to survive Discord compression while still lighter than bold decoys
		ctx.fillStyle = `hsla(${hue}, 55%, 75%, 0.85)`;
		ctx.textAlign = 'center';
		ctx.textBaseline = 'middle';

		// Offset shadow/outline for depth confusion
		ctx.strokeStyle = `hsla(${(hue + 180) % 360}, 30%, 20%, 0.5)`;
		ctx.lineWidth = 2;
		ctx.strokeText(char, randomInt(-2, 3), randomInt(-2, 3));

		ctx.fillText(char, 0, 0);

		// Reset shadow so it doesn't affect subsequent draws
		ctx.shadowColor = 'transparent';
		ctx.shadowBlur = 0;

		ctx.restore();
		x += charSpacing;
	}

	return canvas.toBuffer('image/png');
}

// --- Main ---

const count = Number(process.argv[2]) || 5;
const outDir = join(import.meta.dirname, 'captcha-preview');

if (!existsSync(outDir)) {
	mkdirSync(outDir, { recursive: true });
}

console.log(`Generating ${count} CAPTCHA preview(s) in ${outDir}\n`);

for (let i = 1; i <= count; i++) {
	const captcha = generateCaptcha();
	const image = renderCaptchaImage(captcha.text);
	const filename = `captcha-${i}.png`;
	writeFileSync(join(outDir, filename), image);
	console.log(`  ${filename}  →  ${captcha.text}  (answer: ${captcha.answer})`);
}

console.log('\nDone! Open the images to check readability.');

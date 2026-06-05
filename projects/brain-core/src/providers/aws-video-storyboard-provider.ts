import { writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { deflateSync } from 'node:zlib';
import type { StoryboardProviderInput, StoryboardProviderOutput } from './aws-video-storyboard-types.js';

export class DeterministicStoryboardProvider {
  readonly name = 'deterministic-placeholder';

  generateSvgStoryboardCard(input: StoryboardProviderInput): string {
    const width = 1280;
    const height = 720;
    const padding = 40;
    const contentWidth = width - padding * 2;
    const contentHeight = height - padding * 2;

    // Clean and truncate text
    const visualPrompt = (input.visualPrompt ?? '').substring(0, 150);
    const narrationText = (input.narrationText ?? '').substring(0, 200);
    const onScreenText = (input.onScreenText ?? '').substring(0, 100);

    // Color gradient based on scene index (deterministic, not random)
    const colors = [
      '#FF6B6B', // red
      '#4ECDC4', // teal
      '#45B7D1', // blue
      '#FFA07A', // salmon
      '#98D8C8', // mint
      '#F7DC6F', // yellow
    ];
    const gradientColor = colors[(input.index * 7) % colors.length]!;
    const accentColor = this.adjustBrightness(gradientColor, -20);

    // Build SVG
    const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:${gradientColor};stop-opacity:0.1" />
      <stop offset="100%" style="stop-color:${accentColor};stop-opacity:0.2" />
    </linearGradient>
  </defs>

  <!-- Background -->
  <rect width="${width}" height="${height}" fill="url(#bg)" />
  <rect width="${width}" height="${height}" fill="white" opacity="0.85" />

  <!-- Border -->
  <rect x="2" y="2" width="${width - 4}" height="${height - 4}" fill="none" stroke="${gradientColor}" stroke-width="4" />

  <!-- Content area -->
  <g transform="translate(${padding}, ${padding})">
    <!-- Color bar -->
    <rect width="8" height="${contentHeight}" fill="${gradientColor}" />

    <!-- Main content (offset from color bar) -->
    <g transform="translate(24, 0)">
      <!-- Scene number and duration -->
      <text x="0" y="40" font-size="36" font-weight="bold" fill="${accentColor}">
        Scene ${input.index} · ${input.durationSeconds}s
      </text>

      <!-- Visual prompt heading -->
      <text x="0" y="90" font-size="16" font-weight="bold" fill="#333">
        Visual
      </text>

      <!-- Visual prompt text (wrapped) -->
      <g id="visualPrompt">
        ${this.wrapText(visualPrompt, 60, 110, 14, '#555')}
      </g>

      <!-- Narration heading -->
      <text x="0" y="340" font-size="16" font-weight="bold" fill="#333">
        Narration
      </text>

      <!-- Narration text (wrapped) -->
      <g id="narrationText">
        ${this.wrapText(narrationText, 60, 360, 13, '#666')}
      </g>

      <!-- On-screen text if provided -->
      ${onScreenText ? `
        <!-- On-screen text heading -->
        <text x="0" y="600" font-size="16" font-weight="bold" fill="#333">
          On-Screen
        </text>
        <!-- On-screen text -->
        ${this.wrapText(onScreenText, 60, 620, 13, '#666')}
      ` : ''}

      <!-- Footer -->
      <text x="0" y="${contentHeight - 10}" font-size="12" fill="#999">
        Deterministic placeholder • ${new Date().toISOString().split('T')[0]}
      </text>
    </g>
  </g>
</svg>`;

    return svg;
  }

  private wrapText(text: string, charLimit: number, startY: number, fontSize: number, fillColor: string): string {
    const lines = text.match(new RegExp(`.{1,${charLimit}}`, 'g')) || [];
    const lineHeight = fontSize + 4;

    return lines
      .slice(0, 4) // Max 4 lines
      .map(
        (line, i) =>
          `<text x="0" y="${startY + i * lineHeight}" font-size="${fontSize}" fill="${fillColor}">${this.escapeXml(line)}</text>`,
      )
      .join('\n        ');
  }

  private escapeXml(text: string): string {
    return text.replace(/[<>&'"]/g, (c) => {
      switch (c) {
        case '<':
          return '&lt;';
        case '>':
          return '&gt;';
        case '&':
          return '&amp;';
        case "'":
          return '&apos;';
        case '"':
          return '&quot;';
        default:
          return c;
      }
    });
  }

  private adjustBrightness(color: string, percent: number): string {
    const num = parseInt(color.replace('#', ''), 16);
    const amt = Math.round(2.55 * percent);
    const R = Math.max(0, Math.min(255, (num >> 16) + amt));
    const G = Math.max(0, Math.min(255, ((num >> 8) & 0x00ff) + amt));
    const B = Math.max(0, Math.min(255, (num & 0x0000ff) + amt));
    return `#${(0x1000000 + R * 0x10000 + G * 0x100 + B).toString(16).slice(1)}`;
  }

  async generateStoryboardImage(input: StoryboardProviderInput, tempDir: string): Promise<string> {
    // Generate SVG content
    const svgContent = this.generateSvgStoryboardCard(input);

    // Write SVG to temp file with zero-padded index
    const indexPadded = String(input.index).padStart(3, '0');
    const tempSvgPath = resolve(tempDir, `storyboard-scene-${indexPadded}.svg`);
    await writeFile(tempSvgPath, svgContent, 'utf-8');

    return tempSvgPath;
  }

  async generateStoryboardPng(input: StoryboardProviderInput, tempDir: string): Promise<string> {
    const width = 1280;
    const height = 720;
    const indexPadded = String(input.index).padStart(3, '0');
    const tempPngPath = resolve(tempDir, `storyboard-scene-${indexPadded}.png`);
    const colors = [
      [255, 107, 107],
      [78, 205, 196],
      [69, 183, 209],
      [255, 160, 122],
      [152, 216, 200],
      [247, 220, 111],
    ] as const;
    const base = colors[(input.index * 7) % colors.length]!;
    const raw = Buffer.alloc((width * 3 + 1) * height);

    for (let y = 0; y < height; y += 1) {
      const rowStart = y * (width * 3 + 1);
      raw[rowStart] = 0;
      for (let x = 0; x < width; x += 1) {
        const offset = rowStart + 1 + x * 3;
        const vignette = Math.round((x / width) * 28 + (y / height) * 20);
        const band = x < 34 || y < 24 || y > height - 25 ? 0 : 42;
        raw[offset] = Math.max(0, Math.min(255, base[0] - vignette + band));
        raw[offset + 1] = Math.max(0, Math.min(255, base[1] - vignette + band));
        raw[offset + 2] = Math.max(0, Math.min(255, base[2] - vignette + band));
      }
    }

    await writeFile(tempPngPath, this.encodePng(width, height, raw));
    return tempPngPath;
  }

  private encodePng(width: number, height: number, raw: Buffer): Buffer {
    const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
    const ihdr = Buffer.alloc(13);
    ihdr.writeUInt32BE(width, 0);
    ihdr.writeUInt32BE(height, 4);
    ihdr[8] = 8;
    ihdr[9] = 2;
    ihdr[10] = 0;
    ihdr[11] = 0;
    ihdr[12] = 0;
    return Buffer.concat([
      signature,
      this.pngChunk('IHDR', ihdr),
      this.pngChunk('IDAT', deflateSync(raw)),
      this.pngChunk('IEND', Buffer.alloc(0)),
    ]);
  }

  private pngChunk(type: string, data: Buffer): Buffer {
    const typeBuffer = Buffer.from(type, 'ascii');
    const length = Buffer.alloc(4);
    length.writeUInt32BE(data.length, 0);
    const crc = Buffer.alloc(4);
    crc.writeUInt32BE(this.crc32(Buffer.concat([typeBuffer, data])), 0);
    return Buffer.concat([length, typeBuffer, data, crc]);
  }

  private crc32(buffer: Buffer): number {
    let crc = 0xffffffff;
    for (const byte of buffer) {
      crc ^= byte;
      for (let bit = 0; bit < 8; bit += 1) {
        crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
      }
    }
    return (crc ^ 0xffffffff) >>> 0;
  }
}

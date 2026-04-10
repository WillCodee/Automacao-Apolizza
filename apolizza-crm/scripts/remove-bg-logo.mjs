/**
 * Remove fundo branco via flood-fill a partir dos 4 cantos.
 * Mais preciso que o threshold simples para logos com glow.
 */
import sharp from "sharp";
import { writeFileSync } from "fs";

const inputPath  = "public/logo-apolizza.png";
const outputPath = "public/logo-apolizza.png";

const image = sharp(inputPath).ensureAlpha();
const { data, info } = await image.raw().toBuffer({ resolveWithObject: true });
const { width, height, channels } = info;

const TOLERANCE = 30; // distância de cor aceitável para "ser o mesmo fundo"

function idx(x, y) { return (y * width + x) * channels; }

function colorDist(i, r0, g0, b0) {
  return Math.max(
    Math.abs(data[i]     - r0),
    Math.abs(data[i + 1] - g0),
    Math.abs(data[i + 2] - b0)
  );
}

// Pega cor do canto superior-esquerdo como cor de fundo
const bgR = data[0], bgG = data[1], bgB = data[2];

// Flood fill BFS a partir dos 4 cantos
const visited = new Uint8Array(width * height);
const queue   = [];

const seeds = [
  [0, 0], [width - 1, 0],
  [0, height - 1], [width - 1, height - 1],
];

for (const [sx, sy] of seeds) {
  const si = idx(sx, sy);
  const key = sy * width + sx;
  if (!visited[key] && colorDist(si, bgR, bgG, bgB) <= TOLERANCE) {
    visited[key] = 1;
    queue.push(sx, sy);
  }
}

while (queue.length > 0) {
  const y = queue.pop();
  const x = queue.pop();

  // Tornar transparente (suave: quanto mais branco, mais transparente)
  const i = idx(x, y);
  const dist = colorDist(i, bgR, bgG, bgB);
  const alpha = Math.round((dist / TOLERANCE) * 180); // gradiente suave na borda
  data[i + 3] = Math.min(data[i + 3], alpha);

  for (const [nx, ny] of [[x-1,y],[x+1,y],[x,y-1],[x,y+1]]) {
    if (nx < 0 || nx >= width || ny < 0 || ny >= height) continue;
    const nkey = ny * width + nx;
    if (visited[nkey]) continue;
    const ni = idx(nx, ny);
    if (colorDist(ni, bgR, bgG, bgB) <= TOLERANCE) {
      visited[nkey] = 1;
      queue.push(nx, ny);
    }
  }
}

const output = await sharp(Buffer.from(data), {
  raw: { width, height, channels },
}).png().toBuffer();

writeFileSync(outputPath, output);
console.log(`✓ Fundo removido via flood-fill → ${outputPath}`);

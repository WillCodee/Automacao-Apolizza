import sharp from "sharp";
import * as path from "path";
import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

const SIZE = 512;
const PADDING = 30;
const LOGO_SIZE = SIZE - PADDING * 2;

// Logo gradient colors (coral-orange top-right → yellow center → lime-green bottom-left)
const COLOR_ORANGE = { r: 255, g: 100, b: 70 };
const COLOR_YELLOW  = { r: 255, g: 210, b: 60 };
const COLOR_GREEN   = { r: 110, g: 220, b: 60 };

function lerp(a: number, b: number, t: number) {
  return Math.round(a + (b - a) * t);
}

function gradientColor(t: number) {
  // 0 → green, 0.5 → yellow, 1 → orange
  if (t < 0.5) {
    const u = t * 2;
    return {
      r: lerp(COLOR_GREEN.r, COLOR_YELLOW.r, u),
      g: lerp(COLOR_GREEN.g, COLOR_YELLOW.g, u),
      b: lerp(COLOR_GREEN.b, COLOR_YELLOW.b, u),
    };
  } else {
    const u = (t - 0.5) * 2;
    return {
      r: lerp(COLOR_YELLOW.r, COLOR_ORANGE.r, u),
      g: lerp(COLOR_YELLOW.g, COLOR_ORANGE.g, u),
      b: lerp(COLOR_YELLOW.b, COLOR_ORANGE.b, u),
    };
  }
}

async function main() {
  const srcLogo = path.resolve("public/logo-apolizza-fundo.png");
  const outPath = path.resolve("src/app/icon.png");

  // ── 1. Resize logo ──────────────────────────────────────────────
  const resized = await sharp(srcLogo)
    .resize(LOGO_SIZE, LOGO_SIZE, {
      fit: "contain",
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    })
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const { data: logoData, info } = resized;
  const W = info.width;
  const H = info.height;

  // ── 2. Remove white background, keep original logo colors ───────
  const cleanData = Buffer.alloc(W * H * 4);
  for (let i = 0; i < logoData.length; i += 4) {
    const r = logoData[i];
    const g = logoData[i + 1];
    const b = logoData[i + 2];
    const a = logoData[i + 3];

    // White/near-white pixels → transparent; colored pixels → keep original
    const isBackground = r > 235 && g > 235 && b > 235;

    if (isBackground || a < 10) {
      cleanData[i] = cleanData[i + 1] = cleanData[i + 2] = cleanData[i + 3] = 0;
    } else {
      // Boost saturation: push each channel away from its grey point
      const avg = (r + g + b) / 3;
      const SAT = 2.2; // saturation multiplier
      const vr = Math.min(255, Math.max(0, Math.round(avg + (r - avg) * SAT)));
      const vg = Math.min(255, Math.max(0, Math.round(avg + (g - avg) * SAT)));
      const vb = Math.min(255, Math.max(0, Math.round(avg + (b - avg) * SAT)));
      cleanData[i]     = vr;
      cleanData[i + 1] = vg;
      cleanData[i + 2] = vb;
      cleanData[i + 3] = a;
    }
  }

  const whiteLogo = await sharp(cleanData, {
    raw: { width: W, height: H, channels: 4 },
  })
    .png()
    .toBuffer();

  // ── 3. Create rounded-square gradient background ────────────────
  const bgData = Buffer.alloc(SIZE * SIZE * 4);
  const RADIUS = SIZE * 0.18; // rounded corners radius

  for (let y = 0; y < SIZE; y++) {
    for (let x = 0; x < SIZE; x++) {
      const i = (y * SIZE + x) * 4;

      // Rounded rectangle mask
      const cx = Math.min(x, SIZE - 1 - x);
      const cy = Math.min(y, SIZE - 1 - y);
      const inside =
        cx > RADIUS || cy > RADIUS
          ? cx > 0 && cy > 0 // straight edges
          : Math.hypot(RADIUS - cx, RADIUS - cy) < RADIUS; // corner arc

      if (!inside) {
        bgData[i + 3] = 0; // fully transparent outside
        continue;
      }

      // Diagonal gradient: top-right → bottom-left
      // t=0 at top-right (orange), t=1 at bottom-left (green)
      const t = ((SIZE - 1 - x) + y) / ((SIZE - 1) * 2);
      const color = gradientColor(t);

      bgData[i]     = 0;
      bgData[i + 1] = 0;
      bgData[i + 2] = 0;
      bgData[i + 3] = 255;
    }
  }

  const background = await sharp(bgData, {
    raw: { width: SIZE, height: SIZE, channels: 4 },
  })
    .png()
    .toBuffer();

  // ── 4. Composite white logo centered on background ──────────────
  await sharp(background)
    .composite([
      {
        input: whiteLogo,
        gravity: "center",
      },
    ])
    .png()
    .toFile(outPath);

  console.log(`✓ Favicon gerado: ${outPath} (${SIZE}x${SIZE})`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

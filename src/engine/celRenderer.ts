import {
  ColorPalette,
  CompiledFilmProject,
  ConcreteWeather,
  ConcreteWorld,
  FilmShot,
} from '../types/film';
import {
  clamp01,
  hexToRgba,
  mulberry32,
  power1InOut,
  power2In,
  power2Out,
  power3Out,
} from './colorScripts';

/**
 * Finds the active shot for a given 0-based frame index.
 */
export function getShotAtFrame(
  project: CompiledFilmProject,
  frameIndex: number
): FilmShot {
  const clamped = Math.max(0, Math.min(project.totalFrames - 1, frameIndex));
  for (const s of project.shots) {
    if (clamped >= s.startFrame && clamped < s.endFrame) {
      return s;
    }
  }
  return project.shots[project.shots.length - 1];
}

/**
 * Word-wraps Unicode text (English, Bangla, Hindi, Japanese, etc.) cleanly inside maxWidth.
 */
function wrapCaptionLines(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number
): string[] {
  const cleaned = text.trim();
  if (!cleaned) return [];
  const rawWords = cleaned.split(/\s+/);
  const words: string[] = [];

  for (const w of rawWords) {
    if (ctx.measureText(w).width <= maxWidth) {
      words.push(w);
    } else {
      let chunk = '';
      for (const ch of Array.from(w)) {
        if (ctx.measureText(chunk + ch).width > maxWidth && chunk) {
          words.push(chunk);
          chunk = ch;
        } else {
          chunk += ch;
        }
      }
      if (chunk) words.push(chunk);
    }
  }

  const lines: string[] = [];
  let current = '';

  for (const word of words) {
    const test = current ? `${current} ${word}` : word;
    if (ctx.measureText(test).width <= maxWidth || !current) {
      current = test;
    } else {
      lines.push(current);
      current = word;
    }
  }
  if (current) lines.push(current);
  return lines.slice(0, 3);
}

function fillRoundedRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number
): void {
  const rad = Math.max(0, Math.min(r, w / 2, h / 2));
  ctx.beginPath();
  ctx.moveTo(x + rad, y);
  ctx.lineTo(x + w - rad, y);
  ctx.arcTo(x + w, y, x + w, y + rad, rad);
  ctx.lineTo(x + w, y + h - rad);
  ctx.arcTo(x + w, y + h, x + w - rad, y + h, rad);
  ctx.lineTo(x + rad, y + h);
  ctx.arcTo(x, y + h, x, y + h - rad, rad);
  ctx.lineTo(x, y + rad);
  ctx.arcTo(x, y, x + rad, y, rad);
  ctx.closePath();
  ctx.fill();
}

/**
 * Draws the atmospheric sky & celestial light source (Moon / Eclipse / Comet).
 */
function paintSkyAndCelestial(
  ctx: CanvasRenderingContext2D,
  W: number,
  H: number,
  pal: ColorPalette,
  shot: FilmShot,
  shotProgress: number
): { moonX: number; moonY: number; moonR: number } {
  const skyGrad = ctx.createLinearGradient(0, 0, 0, H);
  skyGrad.addColorStop(0, pal.ink);
  skyGrad.addColorStop(0.48, pal.sky);
  skyGrad.addColorStop(1, pal.ink);
  ctx.fillStyle = skyGrad;
  ctx.fillRect(0, 0, W, H);

  // Subtle seeded background stars on dark palettes
  const rng = mulberry32(shot.seed ^ 0x9e3779b9);
  ctx.fillStyle = hexToRgba(pal.line, 0.32);
  for (let i = 0; i < 36; i++) {
    const sx = rng() * W;
    const sy = rng() * H * 0.58;
    const sr = 0.8 + rng() * 1.8;
    ctx.fillRect(sx, sy, sr, sr);
  }

  const isPortrait = H > W;
  const unit = Math.min(W, H);
  const moonX = isPortrait ? W * 0.68 : W * 0.74;
  const moonY = isPortrait ? H * 0.22 : H * 0.25;
  const moonScale = 0.96 + 0.04 * power2Out(Math.min(1, shotProgress * 2.5));
  const moonR = unit * (shot.kind === 'panoramic' ? 0.115 : 0.085) * moonScale;

  // Outer accent aura
  ctx.beginPath();
  ctx.arc(moonX, moonY, moonR * 1.62, 0, Math.PI * 2);
  ctx.fillStyle = hexToRgba(pal.accent, 0.24);
  ctx.fill();

  // Moon disc
  ctx.beginPath();
  ctx.arc(moonX, moonY, moonR, 0, Math.PI * 2);
  ctx.fillStyle = pal.moon;
  ctx.fill();
  ctx.lineWidth = Math.max(2, unit * 0.0055);
  ctx.strokeStyle = pal.accent;
  ctx.stroke();

  // Diagonal practical light flare during tension / panoramic / approach beats
  if (shot.kind === 'turn' || shot.kind === 'panoramic' || (shot.kind === 'establish' && shotProgress > 0.35)) {
    ctx.save();
    ctx.globalAlpha = 0.18;
    ctx.fillStyle = pal.practical;
    ctx.beginPath();
    ctx.moveTo(moonX - moonR * 0.5, moonY + moonR * 0.4);
    ctx.lineTo(W * 0.18, H * 0.78);
    ctx.lineTo(W * 0.29, H * 0.84);
    ctx.lineTo(moonX + moonR * 0.45, moonY + moonR * 0.65);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  return { moonX, moonY, moonR };
}

/**
 * Paints the 5 procedural anime world environments in flat cel silhouette layers.
 */
function paintWorldLayers(
  ctx: CanvasRenderingContext2D,
  W: number,
  H: number,
  pal: ColorPalette,
  world: ConcreteWorld,
  seed: number,
  localFrame: number
): number {
  const rng = mulberry32(seed ^ 0x517cc1b7);
  const horizonY = H > W ? H * 0.69 : H * 0.72;
  const twoStep = Math.floor(localFrame / 2);

  if (world === 'rooftop_city') {
    // Far skyline silhouette
    ctx.fillStyle = hexToRgba(pal.ink, 0.72);
    ctx.beginPath();
    ctx.moveTo(0, horizonY + H * 0.08);
    const cols = 18;
    for (let i = 0; i <= cols; i++) {
      const x = (i / cols) * W;
      const bH = H * (0.12 + rng() * 0.24);
      ctx.lineTo(x, horizonY - bH);
      ctx.lineTo(((i + 0.85) / cols) * W, horizonY - bH);
    }
    ctx.lineTo(W, H);
    ctx.lineTo(0, H);
    ctx.closePath();
    ctx.fill();

    // Lit practical windows (strictly deterministic)
    ctx.fillStyle = pal.practical;
    for (let wIdx = 0; wIdx < 28; wIdx++) {
      const wx = rng() * W * 0.94 + W * 0.03;
      const wy = horizonY - H * (0.03 + rng() * 0.18);
      const ww = Math.max(3, W * 0.006);
      const wh = Math.max(5, H * 0.012);
      if ((wIdx + Math.floor(twoStep / 12)) % 9 !== 0) {
        ctx.fillRect(wx, wy, ww, wh);
      }
    }

    // Sloped foreground anime rooftop parapet
    ctx.fillStyle = pal.ink;
    ctx.beginPath();
    ctx.moveTo(0, horizonY + H * 0.09);
    ctx.lineTo(W * 0.34, horizonY + H * 0.01);
    ctx.lineTo(W * 0.72, horizonY - H * 0.015);
    ctx.lineTo(W, horizonY + H * 0.06);
    ctx.lineTo(W, H);
    ctx.lineTo(0, H);
    ctx.closePath();
    ctx.fill();

    // Rooftop railing line
    ctx.strokeStyle = hexToRgba(pal.line, 0.28);
    ctx.lineWidth = Math.max(1.5, Math.min(W, H) * 0.0022);
    ctx.beginPath();
    ctx.moveTo(0, horizonY + H * 0.055);
    ctx.lineTo(W * 0.72, horizonY - H * 0.048);
    ctx.lineTo(W, horizonY + H * 0.025);
    ctx.stroke();

    return horizonY;
  }

  if (world === 'shrine_mountains') {
    // Distant mountain ridge
    ctx.fillStyle = hexToRgba(pal.ink, 0.55);
    ctx.beginPath();
    ctx.moveTo(0, horizonY);
    for (let i = 0; i <= 8; i++) {
      ctx.lineTo((i / 8) * W, horizonY - H * (0.1 + rng() * 0.18));
    }
    ctx.lineTo(W, H);
    ctx.lineTo(0, H);
    ctx.closePath();
    ctx.fill();

    // Iconic Torii Gate silhouette on left/right third
    const tx = W * 0.28;
    const ty = horizonY + H * 0.02;
    const tw = Math.min(W, H) * 0.22;
    const th = Math.min(W, H) * 0.24;
    ctx.fillStyle = pal.accent;
    // Upper lintel (kasagi) curving slightly up at tips
    ctx.fillRect(tx - tw * 0.62, ty - th, tw * 1.24, th * 0.09);
    ctx.fillStyle = pal.ink;
    ctx.fillRect(tx - tw * 0.48, ty - th * 0.76, tw * 0.96, th * 0.065);
    ctx.fillRect(tx - tw * 0.36, ty - th * 0.92, tw * 0.09, th * 0.95);
    ctx.fillRect(tx + tw * 0.27, ty - th * 0.92, tw * 0.09, th * 0.95);

    // Foreground ground ridge
    ctx.fillStyle = pal.ink;
    ctx.beginPath();
    ctx.moveTo(0, horizonY + H * 0.05);
    ctx.quadraticCurveTo(W * 0.5, horizonY - H * 0.02, W, horizonY + H * 0.06);
    ctx.lineTo(W, H);
    ctx.lineTo(0, H);
    ctx.closePath();
    ctx.fill();
    return horizonY;
  }

  if (world === 'cosmos_nebula') {
    // Tilted Orbital Accretion Rings
    ctx.save();
    ctx.translate(W * 0.54, H * 0.44);
    ctx.rotate(-0.28 + localFrame * 0.0015);
    for (let r = 0; r < 3; r++) {
      ctx.beginPath();
      ctx.ellipse(
        0,
        0,
        Math.min(W, H) * (0.26 + r * 0.09),
        Math.min(W, H) * (0.055 + r * 0.02),
        0,
        0,
        Math.PI * 2
      );
      ctx.strokeStyle = r === 1 ? pal.practical : hexToRgba(pal.accent, 0.65);
      ctx.lineWidth = Math.max(2, Math.min(W, H) * (r === 1 ? 0.005 : 0.0028));
      ctx.stroke();
    }
    ctx.restore();

    // Crystalline horizon cliff
    ctx.fillStyle = pal.ink;
    ctx.beginPath();
    ctx.moveTo(0, horizonY + H * 0.08);
    ctx.lineTo(W * 0.42, horizonY - H * 0.01);
    ctx.lineTo(W * 0.58, horizonY + H * 0.02);
    ctx.lineTo(W, horizonY + H * 0.09);
    ctx.lineTo(W, H);
    ctx.lineTo(0, H);
    ctx.closePath();
    ctx.fill();
    return horizonY;
  }

  if (world === 'ocean_horizon') {
    // Sea plane
    const seaTop = horizonY - H * 0.05;
    ctx.fillStyle = hexToRgba(pal.ink, 0.78);
    ctx.fillRect(0, seaTop, W, H - seaTop);

    // Shimmering reflection bars on twos
    ctx.fillStyle = pal.practical;
    for (let i = 0; i < 14; i++) {
      const ry = seaTop + (i / 14) * (H * 0.22) + H * 0.01;
      const shift = Math.sin(twoStep * 0.35 + i * 1.4) * (W * 0.018);
      const rw = W * (0.16 - i * 0.008);
      ctx.fillRect(W * 0.68 - rw / 2 + shift, ry, Math.max(12, rw), Math.max(2, H * 0.0035));
    }

    // Foreground coastal embankment
    ctx.fillStyle = pal.ink;
    ctx.beginPath();
    ctx.moveTo(0, horizonY + H * 0.06);
    ctx.lineTo(W, horizonY + H * 0.02);
    ctx.lineTo(W, H);
    ctx.lineTo(0, H);
    ctx.closePath();
    ctx.fill();
    return horizonY + H * 0.03;
  }

  // cyber_arena: Architectural monoliths + HUD ring + perspective floor
  ctx.strokeStyle = hexToRgba(pal.practical, 0.24);
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.arc(W * 0.5, H * 0.42, Math.min(W, H) * 0.26, 0, Math.PI * 2);
  ctx.stroke();

  ctx.fillStyle = hexToRgba(pal.ink, 0.82);
  for (let i = 0; i < 7; i++) {
    const mx = W * (0.06 + i * 0.14);
    const mw = W * 0.07;
    const mh = H * (0.16 + ((i * 37) % 5) * 0.05);
    ctx.fillRect(mx, horizonY - mh, mw, mh + H * 0.1);
    ctx.fillStyle = pal.practical;
    ctx.fillRect(mx + mw * 0.42, horizonY - mh + 10, 3, mh * 0.65);
    ctx.fillStyle = hexToRgba(pal.ink, 0.82);
  }

  ctx.fillStyle = pal.ink;
  ctx.fillRect(0, horizonY + H * 0.02, W, H - horizonY);
  return horizonY + H * 0.02;
}

/**
 * Paints the hero protagonist figure in wide / medium / turn / aftermath shots (animated on twos).
 */
function paintStandingHeroCel(
  ctx: CanvasRenderingContext2D,
  W: number,
  H: number,
  groundY: number,
  pal: ColorPalette,
  localFrame: number,
  scaleMult: number,
  tensionCoil: boolean
): void {
  const twoStep = Math.floor(localFrame / 2);
  const capePhase = twoStep % 4;
  const unit = Math.min(W, H) * 0.25 * scaleMult;
  const cx = H > W ? W * 0.46 : W * 0.41;
  const cy = groundY + H * 0.02;

  ctx.save();
  ctx.translate(cx, cy);
  if (tensionCoil) {
    ctx.translate(0, unit * 0.06);
    ctx.rotate(-0.04);
  }

  // Flowing anime cloak / scarf animated on twos (4 distinct key silhouettes)
  const capeOffsets = [
    [-unit * 0.85, -unit * 0.42],
    [-unit * 1.02, -unit * 0.56],
    [-unit * 0.94, -unit * 0.34],
    [-unit * 0.78, -unit * 0.48],
  ][capePhase];

  ctx.fillStyle = pal.accent;
  ctx.beginPath();
  ctx.moveTo(-unit * 0.08, -unit * 0.78);
  ctx.quadraticCurveTo(
    capeOffsets[0] * 0.7,
    -unit * 0.72,
    capeOffsets[0],
    capeOffsets[1]
  );
  ctx.lineTo(-unit * 0.34, -unit * 0.46);
  ctx.closePath();
  ctx.fill();

  // Main coat / body cel silhouette
  ctx.fillStyle = pal.hair;
  ctx.beginPath();
  ctx.moveTo(-unit * 0.16, -unit * 0.78);
  ctx.lineTo(-unit * 0.28, 0);
  ctx.lineTo(unit * 0.24, 0);
  ctx.lineTo(unit * 0.14, -unit * 0.78);
  ctx.closePath();
  ctx.fill();

  // Crisp rim-lit contour on facing edge
  ctx.strokeStyle = pal.line;
  ctx.lineWidth = Math.max(2, unit * 0.022);
  ctx.beginPath();
  ctx.moveTo(unit * 0.13, -unit * 0.78);
  ctx.lineTo(unit * 0.23, 0);
  ctx.stroke();

  // Katana / Energy staff diagonal silhouette
  ctx.strokeStyle = tensionCoil ? pal.practical : pal.line;
  ctx.lineWidth = Math.max(2.5, unit * 0.028);
  ctx.beginPath();
  ctx.moveTo(-unit * 0.24, -unit * 0.32);
  ctx.lineTo(unit * 0.46, -unit * 0.92);
  ctx.stroke();

  // Head & spiky/windswept anime hair silhouette
  ctx.fillStyle = pal.hair;
  ctx.beginPath();
  ctx.arc(unit * 0.02, -unit * 0.91, unit * 0.13, 0, Math.PI * 2);
  ctx.fill();

  // Hair sheen band in moon color
  ctx.fillStyle = pal.moon;
  ctx.beginPath();
  ctx.moveTo(-unit * 0.04, -unit * 0.98);
  ctx.lineTo(unit * 0.11, -unit * 0.95);
  ctx.lineTo(unit * 0.07, -unit * 0.89);
  ctx.closePath();
  ctx.fill();

  if (tensionCoil) {
    // Rising pre-sakuga energy ring at feet
    ctx.strokeStyle = pal.practical;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.ellipse(0, 0, unit * (0.4 + (twoStep % 3) * 0.12), unit * 0.08, 0, 0, Math.PI * 2);
    ctx.stroke();
  }

  ctx.restore();
}

/**
 * Paints the iconic Close-Up Anime Portrait & Expressive Eyes (skills/html-anime-cel/SKILL.md).
 */
function paintCloseUpAnimePortrait(
  ctx: CanvasRenderingContext2D,
  W: number,
  H: number,
  pal: ColorPalette,
  localFrame: number
): void {
  const twoStep = Math.floor(localFrame / 2);
  const isBlink = localFrame % 64 === 42 || localFrame % 64 === 43;
  const hairSway = ((twoStep % 4) - 1.5) * 4;

  const isPortrait = H > W;
  const cx = isPortrait ? W * 0.52 : W * 0.56;
  const cy = isPortrait ? H * 0.43 : H * 0.47;
  const scale = Math.min(W, H) / 760;

  ctx.save();
  ctx.translate(cx, cy);
  ctx.scale(scale, scale);

  // Back hair silhouette mass
  ctx.fillStyle = pal.hair;
  ctx.beginPath();
  ctx.arc(0, -24, 215, 0, Math.PI * 2);
  ctx.fill();

  // Shoulders / Collar cel
  ctx.fillStyle = pal.hair;
  ctx.beginPath();
  ctx.moveTo(-145, 195);
  ctx.lineTo(-190, 360);
  ctx.lineTo(195, 360);
  ctx.lineTo(135, 190);
  ctx.closePath();
  ctx.fill();

  // Crimson/Accent collar trim
  ctx.strokeStyle = pal.accent;
  ctx.lineWidth = 6;
  ctx.beginPath();
  ctx.moveTo(-135, 232);
  ctx.quadraticCurveTo(0, 278, 138, 224);
  ctx.stroke();

  // Neck
  ctx.fillStyle = pal.skin;
  ctx.fillRect(-38, 128, 76, 95);

  // Face contour
  ctx.fillStyle = pal.skin;
  ctx.beginPath();
  ctx.moveTo(0, -172);
  ctx.bezierCurveTo(126, -172, 162, -62, 144, 34);
  ctx.bezierCurveTo(128, 122, 66, 178, 0, 190);
  ctx.bezierCurveTo(-68, 178, -132, 122, -148, 34);
  ctx.bezierCurveTo(-164, -62, -126, -172, 0, -172);
  ctx.closePath();
  ctx.fill();

  // Hard-edged 20% ink cel shadow on left side of face (No airbrush!)
  ctx.fillStyle = hexToRgba(pal.ink, 0.22);
  ctx.beginPath();
  ctx.moveTo(-148, 28);
  ctx.bezierCurveTo(-132, 120, -68, 178, 0, 190);
  ctx.bezierCurveTo(-28, 130, -42, 48, -18, -32);
  ctx.lineTo(-148, 28);
  ctx.closePath();
  ctx.fill();

  // Expressive Anime Eyes (Left & Right, looking slightly left into look-room)
  const drawEye = (ex: number, ey: number, rx: number, ry: number) => {
    ctx.save();
    ctx.translate(ex, ey);
    if (isBlink) {
      ctx.strokeStyle = pal.hair;
      ctx.lineWidth = 7;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(-rx, 4);
      ctx.quadraticCurveTo(0, 14, rx, 2);
      ctx.stroke();
    } else {
      // Sclera
      ctx.fillStyle = pal.sclera;
      ctx.beginPath();
      ctx.ellipse(0, 0, rx, ry, 0, 0, Math.PI * 2);
      ctx.fill();

      // Iris
      ctx.fillStyle = pal.iris;
      ctx.beginPath();
      ctx.arc(-4, 2, ry * 0.68, 0, Math.PI * 2);
      ctx.fill();

      // Lower crescent practical glow inside iris
      ctx.fillStyle = pal.practical;
      ctx.beginPath();
      ctx.arc(-4, 8, ry * 0.36, 0, Math.PI);
      ctx.fill();

      // Pupil
      ctx.fillStyle = pal.hair;
      ctx.beginPath();
      ctx.arc(-4, 2, ry * 0.34, 0, Math.PI * 2);
      ctx.fill();

      // Two window-shaped catchlights (skills/html-anime-cel/SKILL.md)
      ctx.fillStyle = pal.line;
      ctx.fillRect(-14, -12, 11, 8);
      ctx.fillRect(5, 6, 6, 5);

      // Bold upper eyelash contour
      ctx.strokeStyle = pal.hair;
      ctx.lineWidth = 8;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(-rx - 4, -4);
      ctx.quadraticCurveTo(0, -ry - 10, rx + 4, -2);
      ctx.stroke();
    }
    // Eyebrow
    ctx.strokeStyle = pal.hair;
    ctx.lineWidth = 4.5;
    ctx.beginPath();
    ctx.moveTo(-rx * 0.85, -ry - 14);
    ctx.quadraticCurveTo(0, -ry - 22, rx * 0.85, -ry - 12);
    ctx.stroke();
    ctx.restore();
  };

  drawEye(-62, -4, 34, 26);
  drawEye(64, 2, 42, 31);

  // Subtle anime nose & mouth line
  ctx.strokeStyle = hexToRgba(pal.ink, 0.55);
  ctx.lineWidth = 3.5;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(-4, 52);
  ctx.lineTo(-10, 82);
  ctx.lineTo(-2, 88);
  ctx.stroke();

  ctx.strokeStyle = pal.hair;
  ctx.lineWidth = 3.8;
  ctx.beginPath();
  ctx.moveTo(-18, 126);
  ctx.quadraticCurveTo(4, 134, 24, 124);
  ctx.stroke();

  // Chunky front anime bangs swaying on twos + hard sheen band
  ctx.fillStyle = pal.hair;
  ctx.beginPath();
  ctx.moveTo(-168, -28);
  ctx.lineTo(-118 + hairSway, 18);
  ctx.lineTo(-78, -98);
  ctx.lineTo(-18 + hairSway, 26);
  ctx.lineTo(32, -104);
  ctx.lineTo(92 + hairSway, 16);
  ctx.lineTo(164, -24);
  ctx.lineTo(156, -158);
  ctx.lineTo(0, -196);
  ctx.lineTo(-158, -152);
  ctx.closePath();
  ctx.fill();

  // Hard moon sheen band across hair chunks
  ctx.fillStyle = pal.moon;
  ctx.beginPath();
  ctx.moveTo(-88, -128);
  ctx.lineTo(-28, -142);
  ctx.lineTo(-42, -96);
  ctx.lineTo(-96, -88);
  ctx.closePath();
  ctx.fill();

  ctx.beginPath();
  ctx.moveTo(26, -138);
  ctx.lineTo(88, -122);
  ctx.lineTo(74, -84);
  ctx.lineTo(22, -96);
  ctx.closePath();
  ctx.fill();

  ctx.restore();
}

/**
 * Paints the 8-Drawing Expensive SAKUGA Action Sequence!
 * Includes Anticipation -> Smear Frame -> Stark Impact Flash -> Crescent Blade Slash + Sparks on Ones -> Landed Hold!
 */
function paintSakugaSequence(
  ctx: CanvasRenderingContext2D,
  W: number,
  H: number,
  groundY: number,
  pal: ColorPalette,
  shot: FilmShot,
  localFrame: number,
  totalShotFrames: number
): void {
  const p = clamp01(localFrame / Math.max(1, totalShotFrames - 1));
  const rng = mulberry32(shot.seed ^ 0xabcdef01);

  // Beat 3: Stark 2-Frame Ufotable/Trigger Impact Flash!
  if (p >= 0.34 && p < 0.41) {
    const inverted = localFrame % 2 === 0;
    ctx.fillStyle = inverted ? pal.practical : pal.ink;
    ctx.fillRect(0, 0, W, H);

    // Radial impact spikes
    ctx.save();
    ctx.translate(W * 0.52, H * 0.48);
    ctx.fillStyle = inverted ? pal.ink : pal.accent;
    for (let i = 0; i < 24; i++) {
      const ang = (i / 24) * Math.PI * 2;
      ctx.beginPath();
      ctx.moveTo(Math.cos(ang) * 40, Math.sin(ang) * 40);
      ctx.lineTo(Math.cos(ang - 0.05) * Math.max(W, H), Math.sin(ang - 0.05) * Math.max(W, H));
      ctx.lineTo(Math.cos(ang + 0.05) * Math.max(W, H), Math.sin(ang + 0.05) * Math.max(W, H));
      ctx.closePath();
      ctx.fill();
    }
    // Stark diagonal impact cross-slash
    ctx.strokeStyle = inverted ? pal.accent : pal.line;
    ctx.lineWidth = Math.min(W, H) * 0.025;
    ctx.beginPath();
    ctx.moveTo(-W * 0.5, H * 0.35);
    ctx.lineTo(W * 0.5, -H * 0.35);
    ctx.stroke();
    ctx.restore();
    return;
  }

  // Beat 1: Deep Anticipation Coil (0.00 -> 0.18)
  if (p < 0.18) {
    paintStandingHeroCel(ctx, W, H, groundY, pal, localFrame, 1.25, true);
    return;
  }

  // Beat 2: High-Speed Anime Smear Frame + Straight Speed Lines (0.18 -> 0.34)
  if (p < 0.34) {
    const smearT = (p - 0.18) / 0.16;
    ctx.strokeStyle = hexToRgba(pal.line, 0.55);
    ctx.lineWidth = 2.5;
    for (let i = 0; i < 16; i++) {
      const y = H * (0.14 + rng() * 0.68);
      const x1 = W * (0.05 + rng() * 0.35);
      ctx.beginPath();
      ctx.moveTo(x1, y + 40);
      ctx.lineTo(x1 + W * 0.55, y - 95);
      ctx.stroke();
    }

    // Stretched aerodynamic smear silhouette (skills/html-anime-timing/SKILL.md: stretched silhouette, NOT CSS blur!)
    ctx.fillStyle = pal.line;
    ctx.beginPath();
    ctx.moveTo(W * (0.18 + smearT * 0.15), groundY - H * 0.05);
    ctx.quadraticCurveTo(W * 0.48, H * 0.44, W * (0.72 + smearT * 0.14), H * 0.28);
    ctx.lineTo(W * (0.66 + smearT * 0.12), H * 0.39);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = pal.accent;
    ctx.beginPath();
    ctx.moveTo(W * 0.22, groundY - H * 0.02);
    ctx.lineTo(W * (0.68 + smearT * 0.12), H * 0.32);
    ctx.lineTo(W * 0.58, H * 0.42);
    ctx.closePath();
    ctx.fill();
    return;
  }

  // Beat 4 & 5: Sweeping Tapered Crescent Blade Arc + Sparks on Ones -> Landed Hero Settle!
  const slashDecay = clamp01(1 - (p - 0.41) / 0.48);

  if (slashDecay > 0.04) {
    ctx.save();
    ctx.globalAlpha = slashDecay;

    // Outer crimson/accent slash glow polygon
    ctx.fillStyle = pal.accent;
    ctx.beginPath();
    ctx.moveTo(W * 0.08, H * 0.78);
    ctx.quadraticCurveTo(W * 0.46, H * 0.12, W * 0.92, H * 0.22);
    ctx.quadraticCurveTo(W * 0.54, H * 0.28, W * 0.08, H * 0.78);
    ctx.closePath();
    ctx.fill();

    // Inner bright practical core blade trail
    ctx.fillStyle = pal.practical;
    ctx.beginPath();
    ctx.moveTo(W * 0.12, H * 0.75);
    ctx.quadraticCurveTo(W * 0.48, H * 0.18, W * 0.89, H * 0.24);
    ctx.quadraticCurveTo(W * 0.52, H * 0.26, W * 0.12, H * 0.75);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  // Sparks flying on ONES (24fps)
  const sparkElapsed = Math.max(0, localFrame - Math.floor(totalShotFrames * 0.41));
  ctx.fillStyle = pal.practical;
  for (let s = 0; s < 28; s++) {
    const baseX = W * (0.2 + rng() * 0.62);
    const baseY = H * (0.24 + rng() * 0.44);
    const vx = (rng() - 0.35) * 9.5;
    const vy = (rng() - 0.55) * 8.5 + 0.18 * sparkElapsed;
    const sx = baseX + vx * sparkElapsed;
    const sy = baseY + vy * sparkElapsed;
    const sz = Math.max(2, (1 - p * 0.65) * 6);
    if (sx > 0 && sx < W && sy > 0 && sy < H) {
      ctx.fillRect(sx, sy, sz, sz);
    }
  }

  // Landed hero silhouette hold (12+ frames settled on right side)
  ctx.save();
  ctx.translate(W * 0.2, 0);
  paintStandingHeroCel(ctx, W, H, groundY, pal, localFrame, 1.18, false);
  ctx.restore();
}

/**
 * Paints deterministic weather particles on ONES (24fps).
 */
function paintWeatherOnOnes(
  ctx: CanvasRenderingContext2D,
  W: number,
  H: number,
  pal: ColorPalette,
  weather: ConcreteWeather,
  seed: number,
  globalFrame: number
): void {
  if (weather === 'clear') return;
  const rng = mulberry32(seed ^ 0x12345678);

  if (weather === 'rain') {
    ctx.strokeStyle = hexToRgba(pal.line, 0.42);
    ctx.lineWidth = Math.max(1.4, Math.min(W, H) * 0.002);
    ctx.beginPath();
    const count = 58;
    for (let i = 0; i < count; i++) {
      const startX = rng() * (W * 1.25);
      const startY = rng() * H;
      const speed = 26 + (i % 5) * 5;
      const y = (startY + globalFrame * speed) % (H + 90) - 45;
      const x = ((startX - globalFrame * (speed * 0.24)) % (W + 140) + (W + 140)) % (W + 140) - 70;
      ctx.moveTo(x, y);
      ctx.lineTo(x - 14, y + 62);
    }
    ctx.stroke();
    return;
  }

  const count = 34;
  for (let i = 0; i < count; i++) {
    const bx = rng() * W;
    const by = rng() * H;
    const size = 2.5 + rng() * 4.5;

    if (weather === 'embers' || weather === 'stardust') {
      const speedY = 3.2 + rng() * 4.2;
      const y = ((by - globalFrame * speedY) % H + H) % H;
      const x = (bx + Math.sin(globalFrame * 0.06 + i) * 24 + W) % W;
      ctx.fillStyle =
        weather === 'embers'
          ? i % 2 === 0
            ? pal.accent
            : pal.practical
          : hexToRgba(pal.moon, 0.72);
      ctx.beginPath();
      ctx.arc(x, y, size * 0.7, 0, Math.PI * 2);
      ctx.fill();
    } else if (weather === 'petals') {
      const y = (by + globalFrame * (3.4 + (i % 3))) % H;
      const x = ((bx - globalFrame * 4.2 + Math.sin(globalFrame * 0.08 + i) * 18) % W + W) % W;
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(globalFrame * 0.07 + i);
      ctx.fillStyle = pal.accent;
      ctx.beginPath();
      ctx.ellipse(0, 0, size * 1.35, size * 0.65, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    } else if (weather === 'snow') {
      const y = (by + globalFrame * (2.6 + (i % 4))) % H;
      const x = (bx + Math.sin(globalFrame * 0.05 + i) * 16 + W) % W;
      ctx.fillStyle = hexToRgba(pal.line, 0.78);
      ctx.beginPath();
      ctx.arc(x, y, size * 0.65, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}

/**
 * Master Deterministic Frame Renderer — Seeks to ANY exact frameIndex in O(1) time!
 */
export function renderAnimeFilmFrame(
  ctx: CanvasRenderingContext2D,
  project: CompiledFilmProject,
  frameIndex: number
): void {
  const W = project.width;
  const H = project.height;
  const pal = project.colorScript.colors;
  const shot = getShotAtFrame(project, frameIndex);

  const shotFrames = Math.max(1, shot.endFrame - shot.startFrame);
  const localFrame = Math.max(0, frameIndex - shot.startFrame);
  const shotProgress = clamp01(localFrame / Math.max(1, shotFrames - 1));

  ctx.save();
  ctx.clearRect(0, 0, W, H);

  // Camera lens transform (skills/html-anime-timing/SKILL.md: 100% -> 106% power1.inOut on holds; locked on Sakuga)
  ctx.save();
  const easeMove = power1InOut(shotProgress);
  if (shot.cameraMove === 'push_in') {
    const sc = 1 + 0.06 * easeMove;
    ctx.translate(W * 0.5, H * 0.56);
    ctx.scale(sc, sc);
    ctx.translate(-W * 0.5, -H * 0.56);
  } else if (shot.cameraMove === 'pull_back') {
    const sc = 1.06 - 0.06 * easeMove;
    ctx.translate(W * 0.5, H * 0.52);
    ctx.scale(sc, sc);
    ctx.translate(-W * 0.5, -H * 0.52);
  } else if (shot.cameraMove === 'pan_right') {
    ctx.translate(W * 0.5, H * 0.5);
    ctx.scale(1.05, 1.05);
    ctx.translate(-W * 0.5 - W * 0.025 * (easeMove - 0.5), -H * 0.5);
  } else if (shot.cameraMove === 'pan_left') {
    ctx.translate(W * 0.5, H * 0.5);
    ctx.scale(1.05, 1.05);
    ctx.translate(-W * 0.5 + W * 0.025 * (easeMove - 0.5), -H * 0.5);
  }

  // 1. Sky & Celestial
  paintSkyAndCelestial(ctx, W, H, pal, shot, shotProgress);

  // 2. World Depth Layers & Character Staging
  if (shot.sakuga || shot.kind === 'sakuga') {
    const gY = paintWorldLayers(ctx, W, H, pal, shot.world, shot.seed, localFrame);
    paintSakugaSequence(ctx, W, H, gY, pal, shot, localFrame, shotFrames);
    paintWeatherOnOnes(ctx, W, H, pal, shot.weather, shot.seed, frameIndex);
  } else if (shot.kind === 'close_eyes' || shot.kind === 'button') {
    // Weather behind close-up figure so character feels nearer than the rain/petals!
    paintWorldLayers(ctx, W, H, pal, shot.world, shot.seed, localFrame);
    paintWeatherOnOnes(ctx, W, H, pal, shot.weather, shot.seed, frameIndex);
    paintCloseUpAnimePortrait(ctx, W, H, pal, localFrame);
  } else if (shot.kind === 'panoramic') {
    paintWorldLayers(ctx, W, H, pal, shot.world, shot.seed, localFrame);
    paintWeatherOnOnes(ctx, W, H, pal, shot.weather, shot.seed, frameIndex);
  } else {
    const gY = paintWorldLayers(ctx, W, H, pal, shot.world, shot.seed, localFrame);
    const figScale = shot.kind === 'establish' ? 0.72 : 1.02;
    paintStandingHeroCel(
      ctx,
      W,
      H,
      gY,
      pal,
      localFrame,
      figScale,
      shot.kind === 'turn'
    );
    paintWeatherOnOnes(ctx, W, H, pal, shot.weather, shot.seed, frameIndex);
  }

  ctx.restore();

  // 3. Cinema Letterbox Bars (Optional)
  const barH = project.letterbox
    ? H > W
      ? Math.round(H * 0.045)
      : Math.round(H * 0.068)
    : 0;
  if (barH > 0) {
    ctx.fillStyle = pal.ink;
    ctx.fillRect(0, 0, W, barH);
    ctx.fillRect(0, H - Math.round(barH * 1.25), W, Math.round(barH * 1.25));
  }

  // 4. Burned-in Cinema Subtitle / Verbatim Dialogue in Lower Safe Zone
  if (project.showSubtitles && shot.caption.trim()) {
    const riseProgress = power3Out(Math.min(1, localFrame / 9));
    const yOffset = (1 - riseProgress) * 16;
    const fontSize = Math.max(
      17,
      Math.round(Math.min(W, H) * (H > W ? 0.036 : 0.038))
    );

    ctx.save();
    ctx.globalAlpha = riseProgress;
    ctx.font = `600 ${fontSize}px Georgia, "Noto Serif", "Noto Sans Bengali", "Noto Sans Devanagari", system-ui, serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    const maxTextW = W * 0.84;
    const lines = wrapCaptionLines(ctx, shot.caption, maxTextW);
    const lineHeight = fontSize * 1.34;
    const baseBottomY =
      H - (barH > 0 ? barH * 0.65 : H * (H > W ? 0.11 : 0.085));
    const startY =
      baseBottomY - ((lines.length - 1) * lineHeight) / 2 + yOffset;

    // Subtle dark pill backdrop when letterbox is off or multi-line
    const widest = Math.min(
      maxTextW,
      Math.max(...lines.map((l) => ctx.measureText(l).width), 60)
    );
    const padX = fontSize * 0.85;
    const padY = fontSize * 0.45;
    const boxW = Math.min(W * 0.94, widest + padX * 2);
    const boxH = lines.length * lineHeight + padY * 1.4;
    ctx.fillStyle = hexToRgba(pal.ink, 0.76);
    const rx = W / 2 - boxW / 2;
    const ry = startY - lineHeight * 0.5 - padY * 0.65;
    fillRoundedRect(ctx, rx, ry, boxW, boxH, 12);

    // Crisp outline + warm practical anime subtitle fill
    ctx.lineWidth = Math.max(3, fontSize * 0.16);
    ctx.strokeStyle = pal.ink;
    ctx.fillStyle = shot.index === project.shots.length - 1 && project.dialogueLine
      ? pal.practical
      : pal.line;

    lines.forEach((line, idx) => {
      const ly = startY + idx * lineHeight;
      ctx.strokeText(line, W / 2, ly);
      ctx.fillText(line, W / 2, ly);
    });
    ctx.restore();
  }

  // 5. Authentic html-anime Color-Dip Cut (#dip straddling cut boundaries) & Final 8-Frame Fade to Ink
  let dipAlpha = 0;
  let dipColor = pal.accent;

  // Outgoing dip (last 6 frames of shot if next shot uses color_dip)
  const nextShot = project.shots[shot.index + 1];
  const framesRemainingInShot = shot.endFrame - 1 - frameIndex;
  if (nextShot && framesRemainingInShot < 6) {
    if (nextShot.cutIn === 'color_dip_accent' || nextShot.cutIn === 'color_dip_ink') {
      dipAlpha = Math.max(dipAlpha, power2In(1 - framesRemainingInShot / 6));
      dipColor = nextShot.cutIn === 'color_dip_accent' ? pal.accent : pal.ink;
    } else if (nextShot.cutIn === 'flash_cut' && framesRemainingInShot < 2) {
      dipAlpha = 0.85;
      dipColor = pal.practical;
    }
  }

  // Incoming dip release (first 8 frames of shot)
  if (shot.index > 0 && localFrame < 8) {
    if (shot.cutIn === 'color_dip_accent' || shot.cutIn === 'color_dip_ink') {
      dipAlpha = Math.max(dipAlpha, 1 - power2Out(localFrame / 8));
      dipColor = shot.cutIn === 'color_dip_accent' ? pal.accent : pal.ink;
    }
  }

  // Opening 6-frame fade-in from ink
  if (frameIndex < 6) {
    dipAlpha = Math.max(dipAlpha, 1 - frameIndex / 6);
    dipColor = pal.ink;
  }

  // Closing 8-frame fade to ink (skills/html-anime-timing/SKILL.md: "The last 8 frames of the button shot fade to ink")
  const remainingTotal = project.totalFrames - 1 - frameIndex;
  if (remainingTotal < 8) {
    dipAlpha = Math.max(dipAlpha, 1 - remainingTotal / 8);
    dipColor = pal.ink;
  }

  if (dipAlpha > 0.01) {
    ctx.fillStyle = hexToRgba(dipColor, clamp01(dipAlpha));
    ctx.fillRect(0, 0, W, H);
  }

  ctx.restore();
}

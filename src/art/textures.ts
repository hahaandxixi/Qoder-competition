import Phaser from 'phaser';
import { TEX } from '../config/theme';

type Ctx = CanvasRenderingContext2D;

const S = 3;

function makeTexture(
  scene: Phaser.Scene,
  key: string,
  width: number,
  height: number,
  draw: (ctx: Ctx, w: number, h: number) => void,
): void {
  if (scene.textures.exists(key)) {
    scene.textures.remove(key);
  }
  const texture = scene.textures.createCanvas(key, width, height);
  if (!texture) {
    return;
  }
  const ctx = texture.getContext();
  ctx.imageSmoothingEnabled = false;
  draw(ctx, width, height);
  texture.refresh();
}

function u(
  ctx: Ctx,
  x: number,
  y: number,
  w: number,
  h: number,
  color: string,
  scale = S,
): void {
  ctx.fillStyle = color;
  ctx.fillRect(x * scale, y * scale, w * scale, h * scale);
}

function drawRaccoon(ctx: Ctx): void {
  const dark = '#1b1714';
  const fur = '#514b40';
  const furMid = '#7b7263';
  const furLight = '#b8ad95';
  const paper = '#e9dfc8';
  const rust = '#a83a22';
  const rustDark = '#6e2516';
  const metal = '#3f3b35';
  const metalLight = '#6c675c';
  const neon = '#4be3c8';

  // tail (behind body)
  u(ctx, 8, 47, 11, 10, fur);
  u(ctx, 5, 40, 10, 9, furMid);
  u(ctx, 3, 33, 9, 9, fur);
  u(ctx, 5, 27, 8, 8, furMid);
  u(ctx, 8, 24, 7, 6, fur);
  u(ctx, 7, 49, 3, 5, furLight);
  u(ctx, 12, 42, 3, 5, furLight);
  u(ctx, 6, 35, 3, 5, furLight);
  u(ctx, 9, 29, 3, 4, furLight);
  u(ctx, 4, 44, 3, 3, dark);

  // rocket pack
  u(ctx, 46, 25, 10, 29, dark);
  u(ctx, 47, 27, 7, 23, metal);
  u(ctx, 49, 29, 3, 17, metalLight);
  u(ctx, 44, 31, 3, 9, rust);
  u(ctx, 56, 31, 3, 9, rust);
  u(ctx, 47, 50, 7, 4, dark);
  u(ctx, 49, 53, 3, 4, rust);
  u(ctx, 50, 57, 1, 3, neon);
  u(ctx, 48, 36, 6, 2, '#8c5236');
  u(ctx, 45, 38, 2, 12, dark);

  // legs + boots
  u(ctx, 21, 57, 7, 12, fur);
  u(ctx, 33, 57, 7, 12, fur);
  u(ctx, 20, 66, 10, 5, dark);
  u(ctx, 32, 66, 10, 5, dark);
  u(ctx, 22, 68, 4, 2, metalLight);
  u(ctx, 34, 68, 4, 2, metalLight);

  // body
  u(ctx, 18, 35, 22, 25, fur);
  u(ctx, 21, 44, 16, 16, furLight);
  u(ctx, 22, 46, 14, 4, paper);
  u(ctx, 19, 40, 20, 3, rustDark);
  u(ctx, 36, 44, 3, 12, neon);

  // arms + paw
  u(ctx, 16, 41, 6, 13, fur);
  u(ctx, 40, 40, 7, 14, fur);
  u(ctx, 14, 51, 8, 5, dark);
  u(ctx, 42, 51, 7, 5, dark);

  // scrap shotgun
  u(ctx, 42, 51, 17, 4, dark);
  u(ctx, 44, 54, 9, 3, metal);
  u(ctx, 56, 51, 5, 2, neon);
  u(ctx, 46, 48, 3, 3, rust);

  // scarf
  u(ctx, 16, 33, 26, 5, rust);
  u(ctx, 14, 35, 6, 9, rustDark);
  u(ctx, 30, 35, 4, 5, rustDark);

  // head
  u(ctx, 18, 10, 20, 4, fur);
  u(ctx, 15, 13, 26, 17, furMid);
  u(ctx, 18, 29, 20, 4, fur);
  u(ctx, 16, 15, 4, 10, furLight);
  u(ctx, 36, 15, 4, 10, fur);

  // ears
  u(ctx, 13, 6, 8, 9, fur);
  u(ctx, 32, 6, 8, 9, fur);
  u(ctx, 15, 7, 4, 5, furLight);
  u(ctx, 34, 7, 4, 5, furLight);
  u(ctx, 17, 8, 1, 2, dark);
  u(ctx, 35, 8, 1, 2, dark);

  // mask + eyes
  u(ctx, 16, 17, 24, 8, dark);
  u(ctx, 18, 19, 5, 4, paper);
  u(ctx, 31, 19, 5, 4, paper);
  u(ctx, 20, 20, 2, 2, neon);
  u(ctx, 33, 20, 2, 2, neon);
  u(ctx, 16, 16, 24, 1, '#0f0c0a');

  // muzzle + nose + mouth
  u(ctx, 23, 26, 12, 7, paper);
  u(ctx, 27, 26, 4, 3, dark);
  u(ctx, 26, 30, 7, 1, fur);
  u(ctx, 19, 27, 4, 1, furLight);
  u(ctx, 37, 27, 4, 1, furLight);

  // head outline accents
  u(ctx, 15, 13, 1, 12, dark);
  u(ctx, 40, 13, 1, 12, dark);
}

function drawOpossum(ctx: Ctx): void {
  const dark = '#1b1714';
  const gray = '#8a8476';
  const grayLight = '#cfc2a6';
  const pink = '#c98b7e';
  const paper = '#e9dfc8';

  // tail
  u(ctx, 12, 9, 5, 2, gray);
  u(ctx, 15, 8, 3, 3, gray);
  u(ctx, 16, 6, 2, 3, pink);

  // feet
  u(ctx, 4, 15, 4, 3, dark);
  u(ctx, 10, 15, 4, 3, dark);

  // body
  u(ctx, 5, 7, 8, 9, gray);
  u(ctx, 6, 9, 6, 5, grayLight);
  u(ctx, 4, 13, 10, 3, dark);

  // arms folded behind the back
  u(ctx, 2, 9, 3, 5, gray);
  u(ctx, 12, 9, 3, 5, gray);
  u(ctx, 3, 12, 11, 2, dark);

  // head
  u(ctx, 1, 4, 8, 5, gray);
  u(ctx, 2, 3, 6, 2, gray);
  u(ctx, 0, 6, 3, 2, grayLight);
  u(ctx, 0, 8, 3, 1, dark);
  u(ctx, 1, 5, 2, 2, dark);
  u(ctx, 7, 5, 2, 2, dark);
  u(ctx, 0, 8, 1, 1, pink);
  u(ctx, 3, 2, 2, 2, gray);
  u(ctx, 7, 1, 2, 3, gray);

  // eye glint
  u(ctx, 2, 6, 1, 1, paper);
  u(ctx, 7, 6, 1, 1, paper);
}

function drawLobster(ctx: Ctx): void {
  const dark = '#1b1714';
  const rust = '#a83a22';
  const rustLight = '#c9613f';
  const paper = '#e9dfc8';
  const neon = '#4be3c8';
  const metal = '#5d584e';

  // legs + wheels
  u(ctx, 4, 15, 4, 2, dark);
  u(ctx, 12, 15, 4, 2, dark);
  u(ctx, 4, 16, 4, 2, metal);
  u(ctx, 12, 16, 4, 2, metal);

  // claws
  u(ctx, 0, 8, 4, 3, rust);
  u(ctx, 0, 10, 2, 2, dark);
  u(ctx, 16, 8, 4, 3, rust);
  u(ctx, 18, 10, 2, 2, dark);

  // body
  u(ctx, 4, 7, 12, 8, rust);
  u(ctx, 5, 8, 10, 3, rustLight);
  u(ctx, 6, 11, 8, 2, paper);
  u(ctx, 7, 11, 2, 2, dark);
  u(ctx, 10, 11, 2, 2, dark);

  // eye stalk + eye
  u(ctx, 8, 4, 1, 3, dark);
  u(ctx, 7, 2, 4, 3, paper);
  u(ctx, 8, 3, 2, 1, neon);

  // antenna
  u(ctx, 13, 3, 1, 4, dark);
  u(ctx, 14, 2, 1, 2, neon);

  // warning stripe + label
  u(ctx, 5, 13, 10, 2, '#e8b23a');
  u(ctx, 6, 13, 1, 2, dark);
  u(ctx, 9, 13, 1, 2, dark);
  u(ctx, 12, 13, 1, 2, dark);
}

function drawBoss(ctx: Ctx): void {
  const dark = '#14110f';
  const ink = '#2a2723';
  const paper = '#e9dfc8';
  const paperShade = '#cdbfa2';
  const paperDeep = '#a99878';
  const rust = '#a83a22';
  const rustDark = '#6e2516';
  const warning = '#e8b23a';
  const neon = '#4be3c8';

  // ground shadow
  ctx.fillStyle = 'rgba(0,0,0,0.38)';
  ctx.beginPath();
  ctx.ellipse(22.5 * 4, 50.5 * 4, 17 * 4, 3 * 4, 0, 0, Math.PI * 2);
  ctx.fill();

  // paper-roll ahoge, behind the head
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  ctx.strokeStyle = dark;
  ctx.lineWidth = 8;
  ctx.beginPath();
  ctx.moveTo(22 * 4, 8 * 4);
  ctx.quadraticCurveTo(20 * 4, 2 * 4, 26 * 4, 2 * 4);
  ctx.quadraticCurveTo(33 * 4, 2 * 4, 31 * 4, 7 * 4);
  ctx.stroke();
  ctx.strokeStyle = paper;
  ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.moveTo(22 * 4, 8 * 4);
  ctx.quadraticCurveTo(20 * 4, 2 * 4, 26 * 4, 2 * 4);
  ctx.quadraticCurveTo(33 * 4, 2 * 4, 31 * 4, 7 * 4);
  ctx.stroke();
  u(ctx, 20, 5, 2, 4, paperShade, 4);
  u(ctx, 29, 3, 1, 3, paperShade, 4);

  // short legs and paper boots
  u(ctx, 15, 39, 6, 9, paperShade, 4);
  u(ctx, 25, 39, 6, 9, paperShade, 4);
  u(ctx, 12, 47, 10, 4, dark, 4);
  u(ctx, 24, 47, 10, 4, dark, 4);
  u(ctx, 13, 47, 7, 1, paperDeep, 4);
  u(ctx, 25, 47, 7, 1, paperDeep, 4);

  // onesie body
  u(ctx, 14, 23, 18, 19, dark, 4);
  u(ctx, 15, 24, 16, 17, paper, 4);
  u(ctx, 15, 24, 2, 17, paperShade, 4);
  u(ctx, 29, 24, 2, 17, paperShade, 4);
  u(ctx, 17, 38, 13, 2, rustDark, 4);
  u(ctx, 22, 36, 2, 3, rust, 4);

  // delivery-label bib
  u(ctx, 16, 24, 14, 10, dark, 4);
  u(ctx, 17, 25, 12, 8, '#f3ead7', 4);
  u(ctx, 17, 25, 12, 2, warning, 4);
  u(ctx, 18, 28, 8, 1, paperDeep, 4);
  u(ctx, 18, 30, 5, 1, paperDeep, 4);
  u(ctx, 26, 29, 2, 4, dark, 4);
  u(ctx, 17, 33, 10, 1, dark, 4);
  u(ctx, 17, 26, 1, 1, rust, 4);

  // giant sealing stamp hugged in front, wider than the head
  u(ctx, 7, 31, 31, 18, dark, 4);
  u(ctx, 9, 32, 27, 15, rustDark, 4);
  u(ctx, 10, 33, 25, 2, rust, 4);
  u(ctx, 10, 45, 25, 1, '#3a1710', 4);
  u(ctx, 12, 36, 21, 8, '#7d2a1a', 4);
  u(ctx, 14, 37, 17, 6, '#5c1e13', 4);
  u(ctx, 16, 38, 13, 1, paperDeep, 4);
  u(ctx, 16, 40, 13, 1, paperDeep, 4);
  u(ctx, 22, 37, 1, 6, rust, 4);
  u(ctx, 19, 36, 2, 2, warning, 4);
  u(ctx, 29, 45, 3, 2, warning, 4);
  u(ctx, 7, 33, 2, 2, paperDeep, 4);
  u(ctx, 36, 33, 2, 2, paperDeep, 4);

  // arms and hands gripping the stamp edges
  u(ctx, 11, 28, 5, 10, paper, 4);
  u(ctx, 11, 28, 1, 10, paperShade, 4);
  u(ctx, 31, 28, 5, 10, paper, 4);
  u(ctx, 35, 28, 1, 10, paperShade, 4);
  u(ctx, 8, 35, 4, 4, paper, 4);
  u(ctx, 36, 35, 4, 4, paper, 4);
  u(ctx, 8, 38, 1, 1, rust, 4);
  u(ctx, 39, 38, 1, 1, rust, 4);

  // oversized baby head
  u(ctx, 9, 4, 26, 21, dark, 4);
  u(ctx, 10, 5, 24, 19, paper, 4);
  u(ctx, 10, 5, 24, 2, '#f5ecd8', 4);
  u(ctx, 10, 22, 24, 2, paperShade, 4);
  u(ctx, 31, 7, 3, 10, paperShade, 4);

  // printer scar and bolts
  u(ctx, 11, 17, 4, 1, paperDeep, 4);
  u(ctx, 30, 18, 3, 2, ink, 4);
  u(ctx, 30, 18, 1, 1, warning, 4);

  // brows, eyes, cheeks
  u(ctx, 14, 11, 6, 1, rustDark, 4);
  u(ctx, 26, 11, 6, 1, rustDark, 4);
  u(ctx, 14, 13, 6, 5, dark, 4);
  u(ctx, 26, 13, 6, 5, dark, 4);
  u(ctx, 15, 14, 4, 3, '#f7f1e4', 4);
  u(ctx, 27, 14, 4, 3, '#f7f1e4', 4);
  u(ctx, 17, 14, 2, 3, dark, 4);
  u(ctx, 29, 14, 2, 3, dark, 4);
  u(ctx, 17, 14, 1, 1, neon, 4);
  u(ctx, 29, 14, 1, 1, neon, 4);
  u(ctx, 13, 18, 3, 1, rust, 4);
  u(ctx, 30, 18, 3, 1, rust, 4);

  // solemn little mouth
  u(ctx, 20, 20, 5, 1, ink, 4);
  u(ctx, 21, 21, 3, 1, paperShade, 4);

  // paper feed slot behind one ear
  u(ctx, 34, 9, 3, 5, ink, 4);
  u(ctx, 35, 10, 1, 3, dark, 4);
  u(ctx, 34, 9, 3, 1, warning, 4);

  // loose label hanging at the side
  u(ctx, 31, 24, 5, 3, paper, 4);
  u(ctx, 32, 25, 1, 1, dark, 4);
  u(ctx, 34, 25, 1, 1, dark, 4);
}

function drawBossGlitch(ctx: Ctx): void {
  const colors = ['#4be3c8', '#a83a22', '#e9dfc8', '#7dff6a'];
  for (let i = 0; i < 9; i += 1) {
    ctx.fillStyle = colors[i % colors.length] ?? '#4be3c8';
    ctx.globalAlpha = 0.28;
    ctx.fillRect(40 + Math.random() * 90, 20 + Math.random() * 140, 10 + Math.random() * 70, 2);
  }
  ctx.globalAlpha = 1;
}

function drawSkyFar(ctx: Ctx, w: number, h: number): void {
  const gradient = ctx.createLinearGradient(0, 0, 0, h);
  gradient.addColorStop(0, '#d9cbaa');
  gradient.addColorStop(0.55, '#b6a582');
  gradient.addColorStop(1, '#776a52');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, w, h);

  // rusty sun with sliced glitch bands
  ctx.fillStyle = '#a83a22';
  ctx.beginPath();
  ctx.arc(1010, 168, 108, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = 'rgba(23,19,16,0.86)';
  for (let i = 0; i < 7; i += 1) {
    ctx.fillRect(870, 92 + i * 25, 300, 5 + (i % 3) * 3);
  }

  // halftone dust
  ctx.fillStyle = 'rgba(23,19,16,0.12)';
  for (let y = 30; y < 520; y += 18) {
    for (let x = 20; x < w; x += 22) {
      const offset = (Math.floor(y / 18) % 2) * 8;
      ctx.fillRect(x + offset, y, 2, 2);
    }
  }

  // horizon silhouettes
  ctx.fillStyle = 'rgba(36,30,24,0.48)';
  const towers = [
    [0, 400, 130, 240],
    [110, 448, 90, 200],
    [210, 360, 140, 290],
    [340, 430, 110, 220],
    [480, 392, 160, 250],
    [660, 452, 120, 190],
    [800, 372, 130, 280],
    [940, 420, 160, 230],
    [1120, 390, 160, 260],
  ];
  towers.forEach(([x, y, tw, th]) => {
    if (x === undefined || y === undefined || tw === undefined || th === undefined) {
      return;
    }
    ctx.fillRect(x, y, tw, th);
    ctx.fillStyle = 'rgba(232,178,58,0.24)';
    for (let wy = y + 18; wy < y + th - 10; wy += 28) {
      for (let wx = x + 12; wx < x + tw - 10; wx += 24) {
        ctx.fillRect(wx, wy, 6, 9);
      }
    }
    ctx.fillStyle = 'rgba(36,30,24,0.48)';
  });

  // power lines
  ctx.strokeStyle = 'rgba(23,19,16,0.5)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(0, 300);
  ctx.quadraticCurveTo(340, 360, 720, 300);
  ctx.quadraticCurveTo(1040, 250, w, 320);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(0, 330);
  ctx.quadraticCurveTo(380, 392, 760, 332);
  ctx.quadraticCurveTo(1080, 286, w, 350);
  ctx.stroke();

  // paper grain
  for (let i = 0; i < 2400; i += 1) {
    ctx.fillStyle = i % 3 === 0 ? 'rgba(255,247,228,0.10)' : 'rgba(23,19,16,0.06)';
    ctx.fillRect(Math.random() * w, Math.random() * h, 1, 1);
  }
}

function drawSkyMid(ctx: Ctx, w: number, h: number): void {
  ctx.clearRect(0, 0, w, h);

  const ink = 'rgba(30,25,20,0.72)';
  const inkSoft = 'rgba(30,25,20,0.45)';
  const rust = 'rgba(168,58,34,0.8)';
  const neon = 'rgba(75,227,200,0.8)';

  // parcel towers
  const towers = [
    [40, 130, 160, 260],
    [250, 180, 120, 210],
    [620, 120, 180, 270],
    [860, 170, 130, 220],
    [1180, 100, 180, 290],
    [1440, 160, 120, 230],
  ];
  ctx.fillStyle = ink;

  towers.forEach(([x, y, tw, th], index) => {
    if (x === undefined || y === undefined || tw === undefined || th === undefined) {
      return;
    }
    ctx.fillRect(x, y, tw, th);
    ctx.fillStyle = 'rgba(207,194,166,0.22)';
    for (let row = y + 16; row < y + th - 12; row += 34) {
      ctx.fillRect(x + 10, row, tw - 30, 3);
    }
    ctx.fillStyle = ink;
    if (index % 2 === 0) {
      ctx.fillStyle = rust;
      ctx.fillRect(x + tw - 24, y + 20, 10, 10);
      ctx.fillStyle = ink;
    }
  });

  // conveyor skeleton
  ctx.fillStyle = inkSoft;
  ctx.fillRect(0, h - 92, w, 14);
  ctx.fillRect(0, h - 42, w, 10);
  for (let x = 10; x < w; x += 74) {
    ctx.fillRect(x, h - 92, 9, 92);
    ctx.fillRect(x + 12, h - 54, 52, 4);
  }

  // hanging cables and screens
  ctx.strokeStyle = inkSoft;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(0, 40);
  ctx.quadraticCurveTo(300, 110, 600, 44);
  ctx.quadraticCurveTo(940, -10, w, 66);
  ctx.stroke();

  const screens = [
    [178, 60, 78, 52],
    [702, 48, 104, 66],
    [1058, 78, 88, 58],
  ];
  screens.forEach(([x, y, sw, sh], index) => {
    if (x === undefined || y === undefined || sw === undefined || sh === undefined) {
      return;
    }
    ctx.strokeStyle = ink;
    ctx.lineWidth = 3;
    ctx.strokeRect(x - 4, y - 4, sw + 8, sh + 8);
    ctx.fillStyle = 'rgba(23,19,16,0.82)';
    ctx.fillRect(x, y, sw, sh);
    ctx.fillStyle = index === 1 ? neon : rust;
    for (let i = 0; i < 5; i += 1) {
      ctx.fillRect(x + 7, y + 8 + i * 9, sw * (0.25 + ((i * 7) % 10) / 14), 2);
    }
    ctx.fillStyle = 'rgba(233,223,200,0.5)';
    ctx.fillRect(x + sw - 22, y + sh - 12, 14, 3);
  });

  // warning tape
  ctx.save();
  ctx.translate(430, h - 160);
  ctx.rotate(-0.03);
  ctx.fillStyle = 'rgba(232,178,58,0.55)';
  ctx.fillRect(0, 0, 310, 14);
  ctx.fillStyle = 'rgba(23,19,16,0.55)';
  for (let x = 0; x < 310; x += 26) {
    ctx.beginPath();
    ctx.moveTo(x, 14);
    ctx.lineTo(x + 10, 0);
    ctx.lineTo(x + 16, 0);
    ctx.lineTo(x + 6, 14);
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();
}

function drawStageBg(ctx: Ctx, w: number, h: number): void {
  const gradient = ctx.createLinearGradient(0, 0, 0, h);
  gradient.addColorStop(0, '#191511');
  gradient.addColorStop(0.6, '#241d16');
  gradient.addColorStop(1, '#100d0a');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, w, h);

  // spotlight cones
  ctx.fillStyle = 'rgba(232,178,58,0.055)';
  ctx.beginPath();
  ctx.moveTo(220, 0);
  ctx.lineTo(500, h);
  ctx.lineTo(140, h);
  ctx.closePath();
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(1060, 0);
  ctx.lineTo(1140, h);
  ctx.lineTo(800, h);
  ctx.closePath();
  ctx.fill();

  // giant cracked screen
  ctx.fillStyle = '#0c1513';
  ctx.strokeStyle = '#3b342a';
  ctx.lineWidth = 10;
  ctx.fillRect(300, 70, 680, 340);
  ctx.strokeRect(300, 70, 680, 340);

  ctx.fillStyle = 'rgba(75,227,200,0.1)';
  for (let i = 0; i < 16; i += 1) {
    ctx.fillRect(320, 90 + i * 19, 630, 5 + (i % 4) * 3);
  }
  ctx.strokeStyle = 'rgba(233,223,200,0.3)';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(760, 76);
  ctx.lineTo(700, 160);
  ctx.lineTo(748, 216);
  ctx.lineTo(676, 320);
  ctx.lineTo(690, 400);
  ctx.stroke();

  // fictional brand block
  ctx.fillStyle = '#e9dfc8';
  ctx.font = '700 44px "Microsoft YaHei", sans-serif';
  ctx.fillText('遥遥集团', 350, 150);
  ctx.fillStyle = '#a83a22';
  ctx.font = '700 76px "Courier New", monospace';
  ctx.fillText('404', 780, 168);
  ctx.font = '700 20px "Courier New", monospace';
  ctx.fillStyle = 'rgba(233,223,200,0.6)';
  ctx.fillText('ANNUAL LAUNCH EVENT // SIGNAL LOST', 352, 188);

  // glitch blocks on screen
  const blocks: Array<[number, number, number, number, string]> = [
    [540, 240, 160, 14, '#4be3c8'],
    [380, 280, 240, 8, '#a83a22'],
    [720, 300, 190, 10, '#e8b23a'],
    [430, 330, 120, 6, '#7dff6a'],
  ];
  blocks.forEach(([x, y, bw, bh, color]) => {
    if (x === undefined || y === undefined || bw === undefined || bh === undefined || color === undefined) {
      return;
    }
    ctx.fillStyle = color;
    ctx.globalAlpha = 0.35;
    ctx.fillRect(x, y, bw, bh);
    ctx.globalAlpha = 1;
  });

  // stage floor
  ctx.fillStyle = '#2b2119';
  ctx.fillRect(0, 560, w, 160);
  ctx.fillStyle = '#a83a22';
  ctx.fillRect(0, 566, w, 68);
  ctx.fillStyle = 'rgba(23,19,16,0.4)';
  for (let x = 0; x < w; x += 120) {
    ctx.fillRect(x, 566, 4, 68);
  }
  ctx.fillStyle = '#e8b23a';
  ctx.fillRect(0, 560, w, 6);

  // audience: cardboard boxes with simple faces
  for (let i = 0; i < 9; i += 1) {
    const x = 30 + i * 142;
    const y = 500 + (i % 2) * 22;
    ctx.fillStyle = i % 3 === 0 ? '#5a4631' : '#3d3326';
    ctx.fillRect(x, y, 92, 82);
    ctx.fillStyle = '#20180f';
    ctx.fillRect(x + 22, y + 24, 12, 9);
    ctx.fillRect(x + 58, y + 24, 12, 9);
    ctx.fillRect(x + 34, y + 48, 24, 5);
    ctx.fillStyle = 'rgba(232,178,58,0.5)';
    ctx.fillRect(x + 10, y + 8, 34, 4);
  }

  // foreground tape
  ctx.save();
  ctx.translate(0, 628);
  ctx.rotate(-0.006);
  ctx.fillStyle = 'rgba(232,178,58,0.4)';
  ctx.fillRect(0, 0, w, 12);
  ctx.fillStyle = 'rgba(23,19,16,0.5)';
  for (let x = 0; x < w; x += 30) {
    ctx.beginPath();
    ctx.moveTo(x, 12);
    ctx.lineTo(x + 12, 0);
    ctx.lineTo(x + 19, 0);
    ctx.lineTo(x + 7, 12);
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();

  // paper grain
  for (let i = 0; i < 1600; i += 1) {
    ctx.fillStyle = 'rgba(233,223,200,0.06)';
    ctx.fillRect(Math.random() * w, Math.random() * h, 1, 1);
  }
}

function drawIslandSky(ctx: Ctx, w: number, h: number): void {
  const gradient = ctx.createLinearGradient(0, 0, 0, h);
  gradient.addColorStop(0, '#9aa79c');
  gradient.addColorStop(0.45, '#c1bfa7');
  gradient.addColorStop(0.72, '#8d9b91');
  gradient.addColorStop(1, '#3d514c');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, w, h);

  // 被雾压低的逆光日轮
  ctx.fillStyle = 'rgba(243,216,139,0.42)';
  ctx.beginPath();
  ctx.arc(1000, 172, 92, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = 'rgba(233,223,200,0.18)';
  ctx.beginPath();
  ctx.arc(1000, 172, 132, 0, Math.PI * 2);
  ctx.fill();

  // 海雾层
  for (let i = 0; i < 7; i += 1) {
    ctx.fillStyle = i % 2 === 0 ? 'rgba(233,223,200,0.09)' : 'rgba(23,19,16,0.08)';
    ctx.fillRect(0, 245 + i * 42, w, 14 + (i % 3) * 8);
  }

  // 远处海蚀柱与断桥残影
  ctx.fillStyle = 'rgba(30,40,37,0.38)';
  const stacks: Array<[number, number, number, number]> = [
    [70, 390, 74, 220],
    [170, 430, 40, 160],
    [1110, 380, 92, 230],
    [1210, 425, 48, 170],
    [580, 470, 110, 120],
  ];
  stacks.forEach(([x, y, sw, sh]) => {
    ctx.fillRect(x, y, sw, sh);
    ctx.fillRect(x - 12, y + 30, sw + 24, 16);
  });
  ctx.strokeStyle = 'rgba(30,40,37,0.34)';
  ctx.lineWidth = 7;
  ctx.beginPath();
  ctx.moveTo(690, 450);
  ctx.quadraticCurveTo(760, 414, 840, 454);
  ctx.stroke();
  ctx.lineWidth = 3;
  for (let x = 700; x < 840; x += 28) {
    ctx.beginPath();
    ctx.moveTo(x, 440);
    ctx.lineTo(x + 8, 462);
    ctx.stroke();
  }

  // 风线
  ctx.strokeStyle = 'rgba(233,223,200,0.16)';
  ctx.lineWidth = 2;
  for (let i = 0; i < 16; i += 1) {
    const y = 80 + i * 27;
    ctx.beginPath();
    ctx.moveTo(20 + (i * 53) % 320, y);
    ctx.lineTo(220 + (i * 61) % 420, y - 4);
    ctx.stroke();
  }

  for (let i = 0; i < 1800; i += 1) {
    ctx.fillStyle = i % 3 === 0 ? 'rgba(255,247,228,0.08)' : 'rgba(23,19,16,0.05)';
    ctx.fillRect(Math.random() * w, Math.random() * h, 1, 1);
  }
}

function drawIslandMid(ctx: Ctx, w: number, h: number): void {
  ctx.clearRect(0, 0, w, h);
  const dark = 'rgba(25,33,29,0.72)';
  const soft = 'rgba(25,33,29,0.38)';
  const olive = 'rgba(87,99,76,0.55)';
  const rust = 'rgba(168,58,34,0.52)';

  // 海岸崖壁
  ctx.fillStyle = dark;
  ctx.beginPath();
  ctx.moveTo(0, h);
  ctx.lineTo(0, 230);
  ctx.lineTo(90, 192);
  ctx.lineTo(160, 232);
  ctx.lineTo(238, 154);
  ctx.lineTo(320, 208);
  ctx.lineTo(390, 186);
  ctx.lineTo(420, h);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = dark;
  ctx.beginPath();
  ctx.moveTo(w - 430, h);
  ctx.lineTo(w - 380, 204);
  ctx.lineTo(w - 300, 164);
  ctx.lineTo(w - 210, 214);
  ctx.lineTo(w - 120, 146);
  ctx.lineTo(w, 190);
  ctx.lineTo(w, h);
  ctx.closePath();
  ctx.fill();

  // 破损栈桥骨架
  ctx.fillStyle = soft;
  ctx.fillRect(420, 294, 700, 12);
  for (let x = 436; x < 1100; x += 58) {
    ctx.fillRect(x, 294, 8, 126);
    ctx.fillStyle = 'rgba(25,33,29,0.2)';
    ctx.fillRect(x + 10, 344, 42, 4);
    ctx.fillStyle = soft;
  }
  ctx.fillStyle = 'rgba(25,33,29,0.92)';
  ctx.fillRect(690, 280, 68, 13);
  ctx.fillRect(750, 292, 12, 22);

  // 挂着的褪色防水布
  ctx.fillStyle = olive;
  ctx.beginPath();
  ctx.moveTo(174, 84);
  ctx.lineTo(398, 60);
  ctx.lineTo(370, 148);
  ctx.lineTo(318, 132);
  ctx.lineTo(282, 178);
  ctx.lineTo(232, 142);
  ctx.lineTo(188, 166);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = 'rgba(233,223,200,0.32)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(174, 84);
  ctx.quadraticCurveTo(300, 30, 398, 60);
  ctx.stroke();
  ctx.strokeStyle = 'rgba(23,19,16,0.5)';
  for (let i = 0; i < 4; i += 1) {
    ctx.beginPath();
    ctx.moveTo(202 + i * 52, 86);
    ctx.lineTo(228 + i * 52, 158);
    ctx.stroke();
  }

  // 远处补给箱与树杈
  ctx.strokeStyle = dark;
  ctx.lineWidth = 10;
  ctx.beginPath();
  ctx.moveTo(1210, 286);
  ctx.lineTo(1280, 226);
  ctx.lineTo(1352, 250);
  ctx.stroke();
  ctx.fillStyle = 'rgba(168,58,34,0.62)';
  ctx.fillRect(1292, 238, 58, 42);
  ctx.fillStyle = 'rgba(232,178,58,0.55)';
  ctx.fillRect(1298, 244, 46, 5);

  // 风撕开的布条
  ctx.strokeStyle = 'rgba(207,194,166,0.36)';
  ctx.lineWidth = 5;
  for (let i = 0; i < 8; i += 1) {
    const x = 500 + i * 90;
    ctx.beginPath();
    ctx.moveTo(x, 208 + (i % 3) * 12);
    ctx.quadraticCurveTo(x + 58, 214 + (i % 2) * 16, x + 124, 204 + (i % 4) * 9);
    ctx.stroke();
  }

  // 海雾与近岸浪
  ctx.fillStyle = 'rgba(233,223,200,0.08)';
  ctx.fillRect(0, h - 64, w, 26);
  ctx.fillStyle = 'rgba(75,227,200,0.16)';
  for (let x = 0; x < w; x += 120) {
    ctx.fillRect(x + 18, h - 22, 64, 3);
    ctx.fillRect(x + 50, h - 13, 42, 2);
  }

  // 锈红标记
  ctx.fillStyle = rust;
  ctx.fillRect(330, 260, 12, 46);
  ctx.fillRect(336, 276, 34, 8);
}

function drawDrone(ctx: Ctx): void {
  const dark = '#171310';
  const metal = '#4d554c';
  const light = '#9aa79c';
  const paper = '#e9dfc8';
  const warning = '#e8b23a';
  const neon = '#4be3c8';

  // 四旋翼支架
  u(ctx, 2, 3, 8, 2, dark, 2);
  u(ctx, 14, 3, 8, 2, dark, 2);
  u(ctx, 2, 12, 8, 2, dark, 2);
  u(ctx, 14, 12, 8, 2, dark, 2);
  u(ctx, 1, 1, 10, 1, light, 2);
  u(ctx, 13, 1, 10, 1, light, 2);
  u(ctx, 1, 15, 10, 1, light, 2);
  u(ctx, 13, 15, 10, 1, light, 2);

  // 机身 + 相机
  u(ctx, 7, 6, 10, 6, dark, 2);
  u(ctx, 8, 7, 8, 4, metal, 2);
  u(ctx, 10, 8, 4, 4, dark, 2);
  u(ctx, 11, 9, 2, 2, warning, 2);
  u(ctx, 11, 9, 1, 1, paper, 2);
  u(ctx, 16, 8, 3, 2, warning, 2);
  u(ctx, 6, 12, 2, 2, neon, 2);
  u(ctx, 5, 6, 2, 2, paper, 2);
  u(ctx, 20, 4, 1, 2, paper, 2);
}

function drawMissile(ctx: Ctx): void {
  const dark = '#171310';
  const metal = '#4d554c';
  const rust = '#a83a22';
  const rustLight = '#cf6a45';
  const paper = '#e9dfc8';
  const warning = '#e8b23a';
  const neon = '#4be3c8';

  // 尾焰与尾翼
  ctx.fillStyle = neon;
  ctx.fillRect(0, 7, 8, 4);
  ctx.fillStyle = warning;
  ctx.fillRect(2, 8, 5, 2);
  ctx.fillStyle = dark;
  ctx.fillRect(4, 2, 8, 14);
  ctx.fillStyle = metal;
  ctx.fillRect(6, 4, 5, 10);
  // 弹体
  ctx.fillStyle = dark;
  ctx.fillRect(10, 4, 28, 10);
  ctx.fillStyle = rust;
  ctx.fillRect(11, 5, 26, 8);
  ctx.fillStyle = rustLight;
  ctx.fillRect(12, 6, 22, 2);
  ctx.fillStyle = paper;
  ctx.fillRect(18, 5, 3, 8);
  ctx.fillStyle = warning;
  ctx.fillRect(30, 6, 5, 6);
  // 弹头
  ctx.fillStyle = dark;
  ctx.beginPath();
  ctx.moveTo(38, 3);
  ctx.lineTo(47, 9);
  ctx.lineTo(38, 15);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = warning;
  ctx.beginPath();
  ctx.moveTo(38, 5);
  ctx.lineTo(44, 9);
  ctx.lineTo(38, 13);
  ctx.closePath();
  ctx.fill();
}

function drawCrab(ctx: Ctx): void {
  const dark = '#171310';
  const rust = '#a83a22';
  const rustLight = '#cf6a45';
  const metal = '#6d7469';
  const paper = '#e9dfc8';
  const warning = '#e8b23a';

  // 铁皮罐盖
  u(ctx, 4, 0, 10, 2, dark, 3);
  u(ctx, 5, 1, 8, 2, metal, 3);
  u(ctx, 6, 1, 3, 1, paper, 3);
  u(ctx, 11, 1, 1, 1, warning, 3);

  // 蟹壳
  u(ctx, 3, 4, 12, 5, rust, 3);
  u(ctx, 4, 5, 10, 2, rustLight, 3);
  u(ctx, 2, 6, 2, 2, rust, 3);
  u(ctx, 14, 6, 2, 2, rust, 3);

  // 钳子
  u(ctx, 0, 4, 3, 2, dark, 3);
  u(ctx, 0, 5, 2, 2, rust, 3);
  u(ctx, 15, 4, 3, 2, dark, 3);
  u(ctx, 16, 5, 2, 2, rust, 3);

  // 腿
  u(ctx, 4, 9, 2, 2, dark, 3);
  u(ctx, 8, 9, 2, 2, dark, 3);
  u(ctx, 12, 9, 2, 2, dark, 3);
  u(ctx, 3, 10, 3, 1, rust, 3);
  u(ctx, 7, 10, 3, 1, rust, 3);
  u(ctx, 11, 10, 3, 1, rust, 3);

  // 眼柄
  u(ctx, 8, 3, 1, 2, dark, 3);
  u(ctx, 7, 2, 3, 2, paper, 3);
  u(ctx, 8, 2, 1, 1, dark, 3);

  // 罐身标签
  u(ctx, 5, 6, 8, 2, warning, 3);
  u(ctx, 6, 6, 1, 2, dark, 3);
  u(ctx, 9, 6, 1, 2, dark, 3);
}

function drawGear(ctx: Ctx): void {
  const dark = '#171310';
  const metal = '#6d7469';
  const light = '#9aa79c';
  const warning = '#e8b23a';

  u(ctx, 9, 1, 6, 2, dark, 2);
  u(ctx, 10, 2, 4, 2, metal, 2);
  u(ctx, 9, 21, 6, 2, dark, 2);
  u(ctx, 10, 20, 4, 2, metal, 2);
  u(ctx, 1, 9, 2, 6, dark, 2);
  u(ctx, 2, 10, 2, 4, metal, 2);
  u(ctx, 21, 9, 2, 6, dark, 2);
  u(ctx, 20, 10, 2, 4, metal, 2);
  u(ctx, 4, 4, 3, 3, dark, 2);
  u(ctx, 17, 4, 3, 3, dark, 2);
  u(ctx, 4, 17, 3, 3, dark, 2);
  u(ctx, 17, 17, 3, 3, dark, 2);
  u(ctx, 6, 5, 12, 14, dark, 2);
  u(ctx, 7, 6, 10, 12, metal, 2);
  u(ctx, 8, 7, 8, 2, light, 2);
  u(ctx, 9, 10, 6, 5, dark, 2);
  u(ctx, 10, 11, 4, 3, warning, 2);
  u(ctx, 10, 11, 1, 1, light, 2);
}

function drawWastelandBoss(ctx: Ctx): void {
  const dark = '#14110f';
  const ink = '#2a2723';
  const olive = '#4b5642';
  const oliveLight = '#7c8562';
  const rust = '#a83a22';
  const rustDark = '#6e2516';
  const paper = '#e9dfc8';
  const paperShade = '#cdbfa2';
  const warning = '#e8b23a';
  const neon = '#4be3c8';

  // 地面阴影
  ctx.fillStyle = 'rgba(0,0,0,0.4)';
  ctx.beginPath();
  ctx.ellipse(22.5 * 4, 51 * 4, 19 * 4, 3 * 4, 0, 0, Math.PI * 2);
  ctx.fill();

  // 折叠营地和背架
  u(ctx, 4, 22, 10, 22, dark, 4);
  u(ctx, 5, 23, 8, 20, olive, 4);
  u(ctx, 6, 24, 2, 17, oliveLight, 4);
  u(ctx, 9, 27, 4, 3, rust, 4);
  u(ctx, 6, 33, 7, 3, paperShade, 4);
  u(ctx, 3, 19, 3, 12, dark, 4);
  u(ctx, 2, 20, 2, 9, warning, 4);
  u(ctx, 13, 17, 3, 4, dark, 4);

  // 靴子和裤腿
  u(ctx, 15, 38, 6, 9, olive, 4);
  u(ctx, 24, 38, 6, 9, olive, 4);
  u(ctx, 13, 46, 10, 4, dark, 4);
  u(ctx, 23, 46, 11, 4, dark, 4);
  u(ctx, 14, 46, 7, 1, paperShade, 4);
  u(ctx, 24, 46, 8, 1, paperShade, 4);
  u(ctx, 18, 41, 1, 3, rust, 4);

  // 外套与工具带
  u(ctx, 14, 21, 18, 19, dark, 4);
  u(ctx, 15, 22, 16, 17, olive, 4);
  u(ctx, 15, 22, 2, 16, oliveLight, 4);
  u(ctx, 29, 23, 2, 15, rustDark, 4);
  u(ctx, 16, 27, 13, 2, rust, 4);
  u(ctx, 21, 29, 3, 3, warning, 4);
  u(ctx, 16, 35, 12, 3, dark, 4);
  u(ctx, 18, 36, 3, 2, paperShade, 4);
  u(ctx, 25, 36, 4, 2, paperShade, 4);

  // 手臂和自拍杆
  u(ctx, 11, 25, 5, 10, olive, 4);
  u(ctx, 10, 34, 5, 4, dark, 4);
  u(ctx, 30, 25, 5, 9, olive, 4);
  u(ctx, 32, 32, 5, 4, dark, 4);
  ctx.strokeStyle = dark;
  ctx.lineWidth = 8;
  ctx.beginPath();
  ctx.moveTo(34 * 4, 31 * 4);
  ctx.lineTo(38 * 4, 12 * 4);
  ctx.stroke();
  ctx.strokeStyle = paperShade;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(34 * 4, 31 * 4);
  ctx.lineTo(38 * 4, 12 * 4);
  ctx.stroke();
  u(ctx, 36, 8, 6, 4, dark, 4);
  u(ctx, 37, 9, 4, 2, paper, 4);
  u(ctx, 39, 10, 1, 1, neon, 4);
  u(ctx, 33, 34, 5, 3, rust, 4);

  // 头、渔夫帽和护目镜
  u(ctx, 9, 4, 26, 18, dark, 4);
  u(ctx, 10, 5, 24, 16, paperShade, 4);
  u(ctx, 8, 7, 28, 4, dark, 4);
  u(ctx, 10, 8, 24, 3, olive, 4);
  u(ctx, 14, 12, 16, 5, dark, 4);
  u(ctx, 15, 13, 14, 2, warning, 4);
  u(ctx, 16, 13, 4, 2, paper, 4);
  u(ctx, 25, 13, 4, 2, paper, 4);
  u(ctx, 13, 18, 3, 2, rust, 4);
  u(ctx, 30, 18, 3, 2, rust, 4);
  u(ctx, 18, 20, 9, 2, ink, 4);
  u(ctx, 20, 21, 5, 1, paperShade, 4);

  // 帽侧“ON AIR”灯
  u(ctx, 30, 7, 4, 3, dark, 4);
  u(ctx, 31, 8, 2, 1, rust, 4);
  ctx.fillStyle = 'rgba(232,178,58,0.65)';
  ctx.fillRect(31 * 4, 8 * 4, 2 * 4, 1 * 4);
}

function drawWastelandBossGlitch(ctx: Ctx): void {
  const colors = ['#e8b23a', '#a83a22', '#e9dfc8', '#4be3c8'];
  for (let i = 0; i < 11; i += 1) {
    ctx.fillStyle = colors[i % colors.length] ?? '#e8b23a';
    ctx.globalAlpha = 0.24;
    ctx.fillRect(30 + Math.random() * 100, 20 + Math.random() * 160, 8 + Math.random() * 80, 2);
  }
  ctx.globalAlpha = 1;
}

function drawAvatar(ctx: Ctx, variant: number): void {
  const colors = ['#4be3c8', '#e8b23a', '#a83a22'];
  const color = colors[variant % colors.length] ?? '#4be3c8';
  ctx.fillStyle = '#241f19';
  ctx.beginPath();
  ctx.arc(24, 24, 23, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = color;
  ctx.fillRect(10, 10, 28, 26);
  ctx.fillStyle = '#171310';
  ctx.fillRect(14, 17, 7, 5);
  ctx.fillRect(27, 17, 7, 5);
  ctx.fillRect(17, 28, 14, 3);
  ctx.fillStyle = '#e9dfc8';
  ctx.fillRect(16, 18, 2, 2);
  ctx.fillRect(29, 18, 2, 2);
  ctx.fillStyle = '#171310';
  ctx.fillRect(6, 32, 36, 8);
}

export function createAllTextures(scene: Phaser.Scene): void {
  makeTexture(scene, TEX.raccoon, 64 * S, 73 * S, (ctx) => drawRaccoon(ctx));
  makeTexture(scene, TEX.opossum, 18 * S, 18 * S, (ctx) => drawOpossum(ctx));
  makeTexture(scene, TEX.lobster, 20 * S, 18 * S, (ctx) => drawLobster(ctx));
  makeTexture(scene, TEX.boss, 45 * 4, 54 * 4, (ctx) => drawBoss(ctx));
  makeTexture(scene, TEX.bossGlitch, 45 * 4, 54 * 4, (ctx) => drawBossGlitch(ctx));
  makeTexture(scene, TEX.skyFar, 1280, 720, (ctx, w, h) => drawSkyFar(ctx, w, h));
  makeTexture(scene, TEX.skyMid, 1600, 420, (ctx, w, h) => drawSkyMid(ctx, w, h));
  makeTexture(scene, TEX.stageBg, 1280, 720, (ctx, w, h) => drawStageBg(ctx, w, h));
  makeTexture(scene, TEX.islandSky, 1280, 720, (ctx, w, h) => drawIslandSky(ctx, w, h));
  makeTexture(scene, TEX.islandMid, 1600, 420, (ctx, w, h) => drawIslandMid(ctx, w, h));
  makeTexture(scene, TEX.drone, 48, 32, (ctx) => drawDrone(ctx));
  makeTexture(scene, TEX.missile, 48, 18, (ctx) => drawMissile(ctx));
  makeTexture(scene, TEX.gear, 24, 24, (ctx) => drawGear(ctx));
  makeTexture(scene, TEX.crab, 54, 36, (ctx) => drawCrab(ctx));
  makeTexture(scene, TEX.wastelandBoss, 45 * 4, 54 * 4, (ctx) => drawWastelandBoss(ctx));
  makeTexture(scene, TEX.wastelandBossGlitch, 45 * 4, 54 * 4, (ctx) => drawWastelandBossGlitch(ctx));

  makeTexture(scene, TEX.bullet, 18, 6, (ctx) => {
    ctx.fillStyle = '#171310';
    ctx.fillRect(0, 1, 16, 4);
    ctx.fillStyle = '#e9dfc8';
    ctx.fillRect(2, 2, 12, 2);
    ctx.fillStyle = '#4be3c8';
    ctx.fillRect(14, 2, 4, 2);
  });

  makeTexture(scene, TEX.bulletAlly, 12, 6, (ctx) => {
    ctx.fillStyle = '#171310';
    ctx.fillRect(0, 1, 11, 4);
    ctx.fillStyle = '#7dff6a';
    ctx.fillRect(2, 2, 8, 2);
  });

  makeTexture(scene, TEX.orb, 20, 20, (ctx) => {
    ctx.fillStyle = 'rgba(168,58,34,0.5)';
    ctx.fillRect(2, 1, 16, 18);
    ctx.fillStyle = '#171310';
    ctx.fillRect(3, 3, 14, 14);
    ctx.fillStyle = '#a83a22';
    ctx.fillRect(5, 5, 10, 10);
    ctx.fillStyle = '#f3d88b';
    ctx.fillRect(8, 7, 4, 6);
    ctx.fillStyle = '#4be3c8';
    ctx.fillRect(1, 8, 2, 4);
  });

  makeTexture(scene, TEX.scrap, 12, 12, (ctx) => {
    ctx.fillStyle = '#171310';
    ctx.fillRect(0, 2, 12, 8);
    ctx.fillStyle = '#8a5a3a';
    ctx.fillRect(2, 4, 8, 4);
    ctx.fillStyle = '#e8b23a';
    ctx.fillRect(4, 5, 2, 2);
  });

  makeTexture(scene, TEX.dust, 6, 6, (ctx) => {
    ctx.fillStyle = '#e9dfc8';
    ctx.fillRect(0, 0, 4, 4);
    ctx.fillStyle = 'rgba(233,223,200,0.4)';
    ctx.fillRect(4, 2, 2, 2);
  });

  makeTexture(scene, TEX.spark, 5, 5, (ctx) => {
    ctx.fillStyle = '#e8b23a';
    ctx.fillRect(0, 0, 5, 5);
    ctx.fillStyle = '#fff7e4';
    ctx.fillRect(1, 1, 3, 3);
  });

  makeTexture(scene, TEX.cardIcon, 40, 52, (ctx) => {
    ctx.fillStyle = '#171310';
    ctx.fillRect(0, 2, 37, 48);
    ctx.fillStyle = '#e9dfc8';
    ctx.fillRect(3, 4, 31, 43);
    ctx.fillStyle = '#a83a22';
    ctx.fillRect(3, 4, 31, 7);
    ctx.fillStyle = '#171310';
    for (let i = 0; i < 5; i += 1) {
      ctx.fillRect(7, 17 + i * 4, 22, 2);
    }
    ctx.strokeStyle = '#a83a22';
    ctx.lineWidth = 2;
    ctx.strokeRect(8, 17, 22, 12);
    ctx.fillStyle = '#4be3c8';
    ctx.fillRect(26, 38, 6, 6);
  });

  makeTexture(scene, TEX.ally, 40, 46, (ctx) => {
    ctx.fillStyle = '#171310';
    ctx.fillRect(2, 8, 36, 34);
    ctx.fillStyle = '#b59a72';
    ctx.fillRect(5, 11, 30, 28);
    ctx.fillStyle = '#171310';
    ctx.fillRect(9, 17, 7, 6);
    ctx.fillRect(24, 17, 7, 6);
    ctx.fillRect(12, 29, 16, 3);
    ctx.fillStyle = '#4be3c8';
    ctx.fillRect(11, 19, 3, 2);
    ctx.fillRect(26, 19, 3, 2);
    ctx.fillStyle = '#a83a22';
    ctx.fillRect(16, 4, 8, 5);
    ctx.fillRect(7, 38, 8, 5);
    ctx.fillRect(25, 38, 8, 5);
  });

  makeTexture(scene, TEX.avatarA, 48, 48, (ctx) => drawAvatar(ctx, 0));
  makeTexture(scene, TEX.avatarB, 48, 48, (ctx) => drawAvatar(ctx, 1));
  makeTexture(scene, TEX.avatarC, 48, 48, (ctx) => drawAvatar(ctx, 2));

  makeTexture(scene, 'tex-flare', 64, 64, (ctx) => {
    const gradient = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
    gradient.addColorStop(0, 'rgba(255,247,228,0.9)');
    gradient.addColorStop(0.4, 'rgba(232,178,58,0.35)');
    gradient.addColorStop(1, 'rgba(232,178,58,0)');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, 64, 64);
  });
}
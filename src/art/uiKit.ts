import Phaser from 'phaser';
import { COLORS, CSS, FONTS, TEX } from '../config/theme';

type Point = { x: number; y: number };

let seed = 90210;
function rand(): number {
  seed = (seed * 16807) % 2147483647;
  return seed / 2147483647;
}

export function jaggedPoints(w: number, h: number, jitter = 4): Point[] {
  const hw = w / 2;
  const hh = h / 2;
  const points: Point[] = [];
  const edges: Array<[Point, Point]> = [
    [{ x: -hw, y: -hh }, { x: hw, y: -hh }],
    [{ x: hw, y: -hh }, { x: hw, y: hh }],
    [{ x: hw, y: hh }, { x: -hw, y: hh }],
    [{ x: -hw, y: hh }, { x: -hw, y: -hh }],
  ];
  edges.forEach(([a, b], edgeIndex) => {
    const segments = 3;
    for (let i = 0; i < segments; i += 1) {
      const t = i / segments;
      const px = a.x + (b.x - a.x) * t;
      const py = a.y + (b.y - a.y) * t;
      const nx = edgeIndex % 2 === 0 ? 0 : (rand() - 0.5) * jitter;
      const ny = edgeIndex % 2 === 0 ? (rand() - 0.5) * jitter : 0;
      points.push({ x: px + nx, y: py + ny });
    }
  });
  return points;
}

export interface PaperPanelOptions {
  fill?: number;
  border?: number;
  accent?: number;
  title?: string;
  titleColor?: string;
  shadow?: boolean;
  tape?: boolean;
  staples?: boolean;
  barcode?: boolean;
  holes?: boolean;
  alpha?: number;
  jitter?: number;
}

export function paperPanel(
  scene: Phaser.Scene,
  x: number,
  y: number,
  w: number,
  h: number,
  options: PaperPanelOptions = {},
): Phaser.GameObjects.Container {
  const root = scene.add.container(x, y);
  const fill = options.fill ?? COLORS.paper;
  const border = options.border ?? COLORS.coal;
  const accent = options.accent ?? COLORS.rust;
  const points = jaggedPoints(w, h, options.jitter ?? 5);

  const shadow = scene.add.graphics();
  shadow.fillStyle(COLORS.coal, 0.6);
  shadow.fillPoints(points.map((p) => new Phaser.Geom.Point(p.x + 7, p.y + 8)), true);
  root.add(shadow);

  const g = scene.add.graphics();
  g.fillStyle(fill, options.alpha ?? 1);
  g.fillPoints(points.map((p) => new Phaser.Geom.Point(p.x, p.y)), true);
  g.lineStyle(3, border, 1);
  g.strokePoints(points.map((p) => new Phaser.Geom.Point(p.x, p.y)), true);

  g.lineStyle(1, accent, 0.55);
  g.beginPath();
  g.moveTo(-w / 2 + 14, -h / 2 + 20);
  g.lineTo(w / 2 - 26, -h / 2 + 20);
  g.strokePath();
  root.add(g);

  if (options.holes !== false) {
    const holes = scene.add.graphics();
    holes.fillStyle(COLORS.coal, 0.8);
    for (let i = 0; i < 3; i += 1) {
      holes.fillCircle(-w / 2 + 15, -h / 2 + h / 2 - 24 + i * 20, 3);
    }
    root.add(holes);
  }

  if (options.tape !== false) {
    const tapeLeft = makeTape(scene, -w / 2 + 40, -h / 2 + 2, 84, 20);
    tapeLeft.setRotation(-0.2);
    const tapeRight = makeTape(scene, w / 2 - 60, h / 2 - 4, 70, 16);
    tapeRight.setRotation(0.16);
    root.add([tapeLeft, tapeRight]);
  }

  if (options.staples !== false) {
    const staples = scene.add.graphics();
    staples.fillStyle(COLORS.coal, 0.9);
    staples.fillRect(-34, -h / 2 - 2, 16, 3);
    staples.fillRect(20, -h / 2 - 1, 14, 3);
    root.add(staples);
  }

  if (options.barcode !== false) {
    const code = scene.add.graphics();
    drawBarcode(code, w / 2 - 104, h / 2 - 30, 84, 18, COLORS.coal);
    root.add(code);
    const codeText = scene.add.text(w / 2 - 104, h / 2 - 9, 'RR-404-1129', {
      fontFamily: FONTS.mono,
      fontSize: '10px',
      color: CSS.coal,
    });
    codeText.setAlpha(0.7);
    root.add(codeText);
  }

  if (options.title) {
    const title = scene.add.text(-w / 2 + 32, -h / 2 + 30, options.title, {
      fontFamily: FONTS.mono,
      fontSize: '15px',
      color: options.titleColor ?? CSS.coal,
      fontStyle: 'bold',
    });
    root.add(title);
  }

  return root;
}

export interface HalfReceiptOptions {
  label?: string;
  width?: number;
  height?: number;
  angle?: number;
  alpha?: number;
  scale?: number;
}

/** 被雨泡皱、撕掉一半的面单：保留原字与洇开的条码。 */
export function halfReceipt(
  scene: Phaser.Scene,
  x: number,
  y: number,
  options: HalfReceiptOptions = {},
): Phaser.GameObjects.Container {
  const width = options.width ?? 260;
  const height = options.height ?? 108;
  const left = -width / 2;
  const top = -height / 2;
  const root = scene.add.container(x, y);

  const edge = [
    [left, top],
    [left + width * 0.62, top],
    [left + width * 0.68, top + height * 0.08],
    [left + width * 0.64, top + height * 0.2],
    [left + width * 0.7, top + height * 0.32],
    [left + width * 0.66, top + height * 0.44],
    [left + width * 0.72, top + height * 0.58],
    [left + width * 0.68, top + height * 0.72],
    [left + width * 0.71, top + height * 0.86],
    [left + width * 0.67, top + height],
    [left, top + height],
  ] as const;
  const points = edge.map(([px, py]) => new Phaser.Geom.Point(px, py));

  const shadow = scene.add.graphics();
  shadow.fillStyle(COLORS.coal, 0.32);
  shadow.fillPoints(points.map((p) => new Phaser.Geom.Point(p.x + 7, p.y + 8)), true);
  root.add(shadow);

  const g = scene.add.graphics();
  g.fillStyle(COLORS.paper, 0.98);
  g.fillPoints(points, true);
  g.lineStyle(2, COLORS.rust, 0.8);
  g.strokePoints(points, true);
  g.fillStyle(COLORS.rust, 0.82);
  g.fillRect(left + 1, top + 1, width * 0.56, Math.max(4, height * 0.06));
  g.fillStyle(COLORS.paperDark, 0.3);
  g.fillCircle(left + width * 0.22, top + height * 0.52, height * 0.11);
  g.fillCircle(left + width * 0.43, top + height * 0.68, height * 0.07);
  g.fillStyle(COLORS.rust, 0.12);
  g.fillCircle(left + width * 0.34, top + height * 0.38, height * 0.09);
  g.lineStyle(1, COLORS.paperDark, 0.7);
  g.lineBetween(left + 16, top + height * 0.3, left + width * 0.48, top + height * 0.3);
  g.lineBetween(left + 16, top + height * 0.4, left + width * 0.4, top + height * 0.4);
  g.fillStyle(COLORS.coal, 0.55);
  let cursor = left + 18;
  for (let i = 0; i < 17 && cursor < left + width * 0.45; i += 1) {
    const bar = 2 + (i % 3);
    g.fillRect(cursor, top + height * 0.78, bar, height * 0.12);
    cursor += bar + 4;
  }
  g.fillStyle(COLORS.paper, 0.76);
  g.fillRect(left + width * 0.27, top + height * 0.76, width * 0.19, height * 0.13);
  g.fillStyle(COLORS.rust, 0.3);
  g.fillRect(left + width * 0.33, top + height * 0.79, width * 0.1, 2);
  root.add(g);

  const label = scene.add.text(left + width * 0.28, top + height * 0.5, options.label ?? '荒野岛', {
    fontFamily: FONTS.display,
    fontSize: `${Math.round(height * 0.24)}px`,
    color: CSS.coal,
    fontStyle: 'bold',
  });
  label.setOrigin(0.5);
  const small = scene.add.text(left + width * 0.28, top + height * 0.66, '404 // 泡水件', {
    fontFamily: FONTS.mono,
    fontSize: `${Math.max(7, Math.round(height * 0.075))}px`,
    color: CSS.rust,
    fontStyle: 'bold',
  });
  small.setOrigin(0.5);
  small.setAlpha(0.75);
  root.add([label, small]);
  root.setAngle(options.angle ?? -0.06);
  root.setAlpha(options.alpha ?? 0.96);
  if (options.scale !== undefined) {
    root.setScale(options.scale);
  }
  return root;
}

export function makeTape(
  scene: Phaser.Scene,
  x: number,
  y: number,
  w: number,
  h: number,
  color: number = COLORS.warning,
): Phaser.GameObjects.Container {
  const root = scene.add.container(x, y);
  const g = scene.add.graphics();
  g.fillStyle(color, 0.62);
  g.fillRect(-w / 2, -h / 2, w, h);
  g.lineStyle(1, COLORS.coal, 0.18);
  g.strokeRect(-w / 2, -h / 2, w, h);
  g.fillStyle(COLORS.coal, 0.12);
  for (let i = -w / 2 + 4; i < w / 2; i += 12) {
    g.fillTriangle(i, h / 2, i + 5, -h / 2, i + 9, -h / 2);
  }
  root.add(g);
  return root;
}

function drawBarcode(
  g: Phaser.GameObjects.Graphics,
  x: number,
  y: number,
  w: number,
  h: number,
  color: number,
): void {
  g.fillStyle(color, 0.82);
  let cursor = 0;
  let guard = 0;
  while (cursor < w && guard < 30) {
    const bar = 2 + Math.floor(rand() * 4);
    const gap = 2 + Math.floor(rand() * 3);
    g.fillRect(x + cursor, y, bar, h);
    cursor += bar + gap;
    guard += 1;
  }
}

export function stamp(
  scene: Phaser.Scene,
  x: number,
  y: number,
  text: string,
  options: {
    color?: number;
    fontSize?: number;
    angle?: number;
    border?: boolean;
    alpha?: number;
  } = {},
): Phaser.GameObjects.Container {
  const color = options.color ?? COLORS.rust;
  const size = options.fontSize ?? 26;
  const root = scene.add.container(x, y);
  const label = scene.add.text(0, 0, text, {
    fontFamily: FONTS.display,
    fontSize: `${size}px`,
    color: `#${color.toString(16).padStart(6, '0')}`,
    fontStyle: 'bold',
    align: 'center',
  });
  label.setOrigin(0.5);
  root.add(label);
  if (options.border !== false) {
    const padX = 18;
    const padY = 9;
    const w = label.width + padX * 2;
    const h = label.height + padY * 2;
    const border = scene.add.graphics();
    border.lineStyle(3, color, 0.9);
    border.strokeRect(-w / 2, -h / 2, w, h);
    border.lineStyle(1, color, 0.55);
    border.strokeRect(-w / 2 + 5, -h / 2 + 5, w - 10, h - 10);
    root.addAt(border, 0);
  }
  root.setRotation(options.angle ?? -0.09);
  root.setAlpha(options.alpha ?? 0.88);
  return root;
}

export function glitchText(
  scene: Phaser.Scene,
  x: number,
  y: number,
  text: string,
  style: Phaser.Types.GameObjects.Text.TextStyle,
  originX = 0.5,
): Phaser.GameObjects.Container {
  const root = scene.add.container(x, y);
  const baseStyle: Phaser.Types.GameObjects.Text.TextStyle = {
    ...style,
    fontFamily: style.fontFamily ?? FONTS.display,
    color: style.color ?? CSS.paper,
  };
  const ghostRust = scene.add.text(-3, 2, text, {
    ...baseStyle,
    color: CSS.rust,
  });
  ghostRust.setOrigin(originX, 0.5);
  ghostRust.setAlpha(0.6);
  const ghostNeon = scene.add.text(3, -2, text, {
    ...baseStyle,
    color: CSS.neon,
  });
  ghostNeon.setOrigin(originX, 0.5);
  ghostNeon.setAlpha(0.42);
  const main = scene.add.text(0, 0, text, baseStyle);
  main.setOrigin(originX, 0.5);
  root.add([ghostRust, ghostNeon, main]);
  return root;
}

export interface ButtonOptions {
  fill?: number;
  textColor?: string;
  accent?: number;
  fontSize?: number;
  mono?: boolean;
}

export interface ButtonHandle {
  root: Phaser.GameObjects.Container;
  setEnabled: (enabled: boolean) => void;
  setLabel: (label: string) => void;
}

export function paperButton(
  scene: Phaser.Scene,
  x: number,
  y: number,
  w: number,
  h: number,
  label: string,
  onClick: () => void,
  options: ButtonOptions = {},
): ButtonHandle {
  const root = scene.add.container(x, y);
  const fill = options.fill ?? COLORS.paper;
  const accent = options.accent ?? COLORS.rust;
  const fontSize = options.fontSize ?? 24;
  const points = jaggedPoints(w, h, 3);

  const shadow = scene.add.graphics();
  shadow.fillStyle(COLORS.coal, 0.7);
  shadow.fillPoints(points.map((p) => new Phaser.Geom.Point(p.x + 5, p.y + 6)), true);

  const g = scene.add.graphics();
  g.fillStyle(fill, 1);
  g.fillPoints(points.map((p) => new Phaser.Geom.Point(p.x, p.y)), true);
  g.lineStyle(3, COLORS.coal, 1);
  g.strokePoints(points.map((p) => new Phaser.Geom.Point(p.x, p.y)), true);
  g.fillStyle(accent, 0.95);
  g.fillRect(-w / 2 + 10, -h / 2 + 10, 5, h - 20);

  const text = scene.add.text(8, 0, label, {
    fontFamily: options.mono ? FONTS.mono : FONTS.display,
    fontSize: `${fontSize}px`,
    color: options.textColor ?? CSS.coal,
    fontStyle: 'bold',
    align: 'center',
  });
  text.setOrigin(0.5);

  const hover = scene.add.graphics();
  hover.lineStyle(2, COLORS.neon, 0.9);
  hover.strokePoints(points.map((p) => new Phaser.Geom.Point(p.x - 2, p.y - 2)), true);
  hover.setAlpha(0);

  const zone = scene.add.zone(0, 0, w, h);
  zone.setInteractive({ useHandCursor: true }).setScrollFactor(0);

  root.add([shadow, g, text, hover, zone]);
  let enabled = true;
  let pressed = false;

  zone.on('pointerover', () => {
    if (!enabled) {
      return;
    }
    hover.setAlpha(1);
    scene.tweens.add({ targets: root, scale: 1.025, duration: 90, ease: 'Sine.easeOut' });
  });
  zone.on('pointerout', () => {
    hover.setAlpha(0);
    pressed = false;
    scene.tweens.add({ targets: root, scale: 1, duration: 90, ease: 'Sine.easeOut' });
  });
  zone.on('pointerdown', () => {
    if (!enabled) {
      return;
    }
    pressed = true;
    scene.tweens.add({ targets: root, scale: 0.975, duration: 70, ease: 'Sine.easeInOut' });
  });
  zone.on('pointerup', () => {
    if (!enabled || !pressed) {
      return;
    }
    pressed = false;
    scene.tweens.add({ targets: root, scale: 1, duration: 90, ease: 'Sine.easeOut' });
    onClick();
  });

  return {
    root,
    setEnabled: (value: boolean) => {
      enabled = value;
      root.setAlpha(value ? 1 : 0.45);
      if (value) {
        zone.setInteractive({ useHandCursor: true }).setScrollFactor(0);
      } else {
        zone.disableInteractive();
      }
    },
    setLabel: (value: string) => {
      text.setText(value);
    },
  };
}

export function addHotTag(
  scene: Phaser.Scene,
  x: number,
  y: number,
  text: string,
  color: number = COLORS.warning,
  angle = -0.03,
): Phaser.GameObjects.Container {
  const root = scene.add.container(x, y);
  const label = scene.add.text(0, 0, text, {
    fontFamily: FONTS.body,
    fontSize: '18px',
    color: CSS.coal,
    fontStyle: 'bold',
  });
  label.setOrigin(0.5);
  const padX = 12;
  const padY = 4;
  const g = scene.add.graphics();
  g.fillStyle(color, 0.95);
  g.fillRect(-label.width / 2 - padX, -label.height / 2 - padY, label.width + padX * 2, label.height + padY * 2);
  g.lineStyle(2, COLORS.coal, 0.8);
  g.strokeRect(-label.width / 2 - padX, -label.height / 2 - padY, label.width + padX * 2, label.height + padY * 2);
  root.add([g, label]);
  root.setRotation(angle);
  return root;
}

export function addScanlines(scene: Phaser.Scene, depth = 500): Phaser.GameObjects.Graphics {
  const g = scene.add.graphics();
  g.fillStyle(COLORS.coal, 0.05);
  for (let y = 0; y < 720; y += 4) {
    g.fillRect(0, y, 1280, 1);
  }
  g.setScrollFactor(0);
  g.setDepth(depth);
  return g;
}

export function damagePopup(
  scene: Phaser.Scene,
  x: number,
  y: number,
  value: string,
  color: number = COLORS.warning,
  size = 26,
): void {
  const text = scene.add.text(x, y, value, {
    fontFamily: FONTS.mono,
    fontSize: `${size}px`,
    color: `#${color.toString(16).padStart(6, '0')}`,
    fontStyle: 'bold',
    stroke: CSS.coal,
    strokeThickness: 5,
  });
  text.setOrigin(0.5);
  text.setDepth(120);
  text.setRotation((Math.random() - 0.5) * 0.16);
  scene.tweens.add({
    targets: text,
    y: y - 54,
    alpha: 0,
    scale: 1.15,
    duration: 680,
    ease: 'Cubic.easeOut',
    onComplete: () => text.destroy(),
  });
}

export function pixelBurst(
  scene: Phaser.Scene,
  x: number,
  y: number,
  color: number,
  count: number,
  force = 1,
): void {
  const total = Math.min(count, 18);
  for (let i = 0; i < total; i += 1) {
    const sprite = scene.add.image(x, y, TEX.spark);
    sprite.setTint(color);
    sprite.setDepth(90);
    const angle = Math.random() * Math.PI * 2;
    const distance = (18 + Math.random() * 42) * force;
    scene.tweens.add({
      targets: sprite,
      x: x + Math.cos(angle) * distance,
      y: y + Math.sin(angle) * distance + 18,
      alpha: 0,
      scale: 0.35,
      duration: 260 + Math.random() * 220,
      ease: 'Quad.easeOut',
      onComplete: () => sprite.destroy(),
    });
  }
}

export function addFloatingLine(
  scene: Phaser.Scene,
  x: number,
  y: number,
  text: string,
  color: number = COLORS.paper,
  size = 18,
  duration = 900,
): void {
  const label = scene.add.text(x, y, text, {
    fontFamily: FONTS.body,
    fontSize: `${size}px`,
    color: `#${color.toString(16).padStart(6, '0')}`,
    fontStyle: 'bold',
    stroke: CSS.coal,
    strokeThickness: 4,
  });
  label.setOrigin(0.5);
  label.setDepth(125);
  label.setRotation((Math.random() - 0.5) * 0.08);
  scene.tweens.add({
    targets: label,
    y: y - 44,
    alpha: 0,
    duration,
    ease: 'Sine.easeOut',
    onComplete: () => label.destroy(),
  });
}
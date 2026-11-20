import fs from 'node:fs';
import puppeteer from 'puppeteer-core';

const baseUrl = process.argv[2] ?? process.env.RACCOON_TEST_URL ?? 'http://127.0.0.1:5201/';
const url = new URL(baseUrl);
url.searchParams.set('debug', '1');
const chromeCandidates = [
  process.env.CHROME_PATH,
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
  '/usr/bin/google-chrome',
  '/usr/bin/chromium',
  '/usr/bin/chromium-browser',
].filter(Boolean);
const executablePath = chromeCandidates.find((candidate) => fs.existsSync(candidate));
if (!executablePath) {
  throw new Error('Chrome not found. Set CHROME_PATH to a Chrome/Chromium executable.');
}
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const assert = (condition, message) => {
  if (!condition) throw new Error(message);
};

async function tap(page, code, holdMs = 100) {
  await page.keyboard.down(code);
  await sleep(holdMs);
  await page.keyboard.up(code);
}

async function enterAct1(page) {
  await page.goto(url.toString(), { waitUntil: 'networkidle2', timeout: 60000 });
  await page.waitForFunction(() => window.__RACCOON_GAME__ != null, { timeout: 15000 });
  await page.waitForFunction(() => window.__RACCOON_GAME__.scene.isActive('Menu'), { timeout: 15000 });
  await sleep(450);
  await page.keyboard.press('Enter');
  await page.waitForFunction(() => window.__RACCOON_GAME__.scene.isActive('Level'), { timeout: 15000 });
  await page.waitForFunction(() => {
    const level = window.__RACCOON_GAME__.scene.getScene('Level');
    return level?.player?.body != null;
  }, { timeout: 10000 });
  await sleep(500);
}

const browser = await puppeteer.launch({
  executablePath,
  headless: 'new',
  args: ['--window-size=1360,800', '--mute-audio', '--autoplay-policy=no-user-gesture-required'],
});

try {
  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 720, deviceScaleFactor: 1 });
  await enterAct1(page);

  const initial = await page.evaluate(() => {
    const level = window.__RACCOON_GAME__.scene.getScene('Level');
    const ground = level.solids[0];
    const probe = {
      groundHits: [],
      respawns: 0,
      wasRespawning: false,
    };
    window.__floorProbe = probe;
    const bulletGroup = level.bullets;
    const describe = (obj) => {
      if (obj === ground) return 'ground';
      if (bulletGroup.contains(obj)) return 'bullet';
      return obj?.type ?? String(obj);
    };
    // 旧版在子弹碰到地面时销毁的是地面；这里记录回调前后两个对象的真实状态。
    for (const collider of level.physics.world.colliders.getActive()) {
      const original = collider.collideCallback;
      if (!original) continue;
      collider.collideCallback = function patchedCollider(a, b) {
        const groundHit = a === ground || b === ground;
        const bullet = bulletGroup.contains(a) ? a : bulletGroup.contains(b) ? b : null;
        if (!groundHit || !bullet) return original.call(this, a, b);
        const result = original.call(this, a, b);
        probe.groundHits.push({
          a: describe(a),
          b: describe(b),
          groundActiveAfter: ground.active,
          bulletActiveAfter: bullet.active,
        });
        return result;
      };
    }
    const timer = setInterval(() => {
      if (level.respawning && !probe.wasRespawning) probe.respawns += 1;
      probe.wasRespawning = level.respawning;
    }, 50);
    window.__floorProbeTimer = timer;
    return {
      x: level.player.x,
      y: level.player.y,
      groundActive: ground.active,
      groundBody: Boolean(ground.body?.enable),
      solidCount: level.solids.length,
    };
  });

  assert(initial.groundActive && initial.groundBody, 'initial floor collider is not active');

  await page.keyboard.down('KeyJ');
  for (let i = 0; i < 4; i += 1) {
    await sleep(260);
    await tap(page, 'KeyK', 95);
    await sleep(260);
  }
  await page.keyboard.up('KeyJ');
  await sleep(1000);

  const after = await page.evaluate(() => {
    const level = window.__RACCOON_GAME__.scene.getScene('Level');
    const player = level.player;
    const body = player.body;
    const ground = level.solids[0];
    const probe = window.__floorProbe;
    clearInterval(window.__floorProbeTimer);
    return {
      x: Math.round(player.x),
      y: Math.round(player.y),
      bottom: Math.round(body.bottom),
      vy: Math.round(body.velocity.y),
      blockedDown: body.blocked.down,
      touchingDown: body.touching.down,
      gravity: body.allowGravity,
      dashing: player.dashing,
      respawning: level.respawning,
      groundActive: ground.active,
      groundBody: Boolean(ground.body?.enable),
      solidCount: level.solids.length,
      groundHits: probe.groundHits,
      respawns: probe.respawns,
    };
  });

  console.log('[initial]', JSON.stringify(initial));
  console.log('[after J+K]', JSON.stringify(after));
  assert(after.groundHits.length > 0, 'test did not produce a bullet-ground collision');
  assert(after.groundActive, 'floor collider was destroyed by a bullet collision');
  assert(after.groundBody, 'floor static body is no longer enabled');
  assert(after.solidCount === initial.solidCount, 'solid count changed after shooting');
  assert(after.respawns === 0, 'player fell through the floor during the shooting test');
  assert(after.y < 640, 'player fell below the visible floor');
  assert(after.blockedDown || after.touchingDown, 'player is not standing on the floor');
  assert(!after.respawning, 'player entered the fall-respawn state unexpectedly');
  for (const hit of after.groundHits) {
    assert(hit.groundActiveAfter, 'ground was inactive after a bullet-ground callback');
    assert(hit.bulletActiveAfter === false, 'bullet survived a ground collision');
  }

  const gapPage = await browser.newPage();
  await gapPage.setViewport({ width: 1280, height: 720, deviceScaleFactor: 1 });
  await enterAct1(gapPage);
  await gapPage.evaluate(() => {
    const level = window.__RACCOON_GAME__.scene.getScene('Level');
    const probe = { respawns: 0, wasRespawning: false };
    window.__gapProbe = probe;
    const timer = setInterval(() => {
      if (level.respawning && !probe.wasRespawning) probe.respawns += 1;
      probe.wasRespawning = level.respawning;
    }, 50);
    window.__gapProbeTimer = timer;
  });
  await gapPage.keyboard.down('KeyD');
  const deadline = Date.now() + 8000;
  while (Date.now() < deadline) {
    const x = await gapPage.evaluate(() => window.__RACCOON_GAME__.scene.getScene('Level').player.x);
    if (x >= 1040) break;
    await sleep(40);
  }
  await gapPage.keyboard.up('KeyD');
  await tap(gapPage, 'Space', 150);
  await sleep(80);
  await gapPage.keyboard.down('KeyD');
  await sleep(560);
  await gapPage.keyboard.up('KeyD');
  await gapPage.waitForFunction(() => {
    const level = window.__RACCOON_GAME__.scene.getScene('Level');
    return level.player.y > 700 || level.respawning;
  }, { timeout: 8000 });
  await gapPage.waitForFunction(() => !window.__RACCOON_GAME__.scene.getScene('Level').respawning, { timeout: 6000 });
  await sleep(1200);

  const gap = await gapPage.evaluate(() => {
    const level = window.__RACCOON_GAME__.scene.getScene('Level');
    const player = level.player;
    const body = player.body;
    const probe = window.__gapProbe;
    clearInterval(window.__gapProbeTimer);
    return {
      x: Math.round(player.x),
      y: Math.round(player.y),
      blockedDown: body.blocked.down,
      touchingDown: body.touching.down,
      groundActive: level.solids[0].active,
      respawns: probe.respawns,
      respawning: level.respawning,
    };
  });
  console.log('[gap respawn]', JSON.stringify(gap));
  assert(gap.respawns === 1, `expected exactly one fall respawn, got ${gap.respawns}`);
  assert(gap.groundActive, 'floor was not active after gap respawn');
  assert(gap.y < 640, 'player did not return above the floor');
  assert(gap.blockedDown || gap.touchingDown, 'player did not stabilize on the floor after respawn');
  assert(!gap.respawning, 'player remained in the fall-respawn state');

  console.log(`[pass] ${url.toString()} keeps the floor after J+K and respawns once from a real gap`);
} finally {
  await browser.close();
}

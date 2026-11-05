'use strict';
(() => {
  const $ = id => document.getElementById(id);
  const canvas = $('landscape');
  let ctx = canvas.getContext('2d', { alpha: false });
  const W = 3200, H = 1200, COLS = 6, ROWS = 4;
  ctx.fillStyle = '#dbc18c'; ctx.fillRect(0, 0, W, H);
  let paperImage, titleImage, inscriptionImage, sealImage;
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const wonders = [];
  const phoneView = matchMedia('(max-width: 700px)');
  const viewport = $('painting-viewport');
  let pointerOrigin = null, lastPanAt = -Infinity, mobileInitialized = false;
  const library = [], backdrop = document.createElement('canvas');
  let current, next, busy = true, grid = false, round = 1;
  let seed = newSeed(), rng, intensity = 0.68, mode = 'fold';
  let audioContext, ambient, animationFrame, viewerURL;
  let lastRecipe, currentRecipe, transitionStart, shards = [];

  function newSeed() {
    const values = new Uint32Array(1);
    if (window.crypto && crypto.getRandomValues) crypto.getRandomValues(values);
    else values[0] = Math.floor(Math.random() * 4294967296);
    return values[0];
  }
  function setSeed(s) {
    let a = s >>> 0;
    rng = () => {
      a += 0x6D2B79F5;
      let t = a;
      t = Math.imul(t ^ t >>> 15, t | 1);
      t ^= t + Math.imul(t ^ t >>> 7, t | 61);
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
  }
  function rand(a = 1, b) { return b === undefined ? rng() * a : a + rng() * (b - a); }
  function makeCanvas(w = W, h = H) {
    const c = document.createElement('canvas'); c.width = w; c.height = h; return c;
  }
  function shuffle(array) {
    for (let i = array.length - 1; i > 0; i--) {
      const j = Math.floor(rand(i + 1)); [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
  }
  function imageFrom(src) {
    return new Promise((resolve, reject) => {
      const img = new Image(); img.onload = () => resolve(img);
      img.onerror = () => reject(new Error('画材未能载入')); img.src = src;
    });
  }
  function smooth(a, b, n) { const t = Math.max(0, Math.min(1, (n - a) / (b - a))); return t * t * (3 - 2 * t); }
  // Separate ink from the support, then derive a cover mask from the ink itself.
  // All fragments will share the same actual paper instead of opaque ivory rectangles.
  function inkAsset(img, index) {
    const c = makeCanvas(img.width, img.height), p = c.getContext('2d');
    p.drawImage(img, 0, 0);
    const data = p.getImageData(0, 0, c.width, c.height), d = data.data;
    for (let y = 0; y < c.height; y++) {
      for (let x = 0; x < c.width; x++) {
        const i = (y * c.width + x) * 4;
        const lum = (d[i] * .2126 + d[i + 1] * .7152 + d[i + 2] * .0722) / 255;
        const nx = x / c.width, ny = y / c.height;
        const edge = Math.min(nx, 1 - nx, ny, 1 - ny);
        const feather = smooth(0, .15 + Math.sin(nx * 18 + ny * 13) * .025, edge);
        const alpha = Math.min(.98, Math.pow(Math.max(0, (.955 - lum) / .93), .86) * 1.25) * feather;
        d[i] = 39; d[i + 1] = 35; d[i + 2] = 29; d[i + 3] = Math.round(alpha * 255);
      }
    }
    p.putImageData(data, 0, 0);
    // Low-resolution density dilation creates an organic, scene-shaped cloud mask.
    const matte = makeCanvas(80, 72), m = matte.getContext('2d');
    m.drawImage(c, 0, 0, matte.width, matte.height);
    const source = m.getImageData(0, 0, matte.width, matte.height);
    const result = m.createImageData(matte.width, matte.height);
    for (let y = 0; y < matte.height; y++) {
      for (let x = 0; x < matte.width; x++) {
        let total = 0, count = 0;
        for (let yy = Math.max(0, y - 5); yy <= Math.min(matte.height - 1, y + 5); yy++) {
          for (let xx = Math.max(0, x - 5); xx <= Math.min(matte.width - 1, x + 5); xx++) {
            total += source.data[(yy * matte.width + xx) * 4 + 3]; count++;
          }
        }
        const edge = Math.min(x / matte.width, 1 - x / matte.width, y / matte.height, 1 - y / matte.height);
        result.data[(y * matte.width + x) * 4 + 3] = Math.round(smooth(3, 35, total / count) * smooth(0, .2, edge) * 235);
      }
    }
    m.putImageData(result, 0, 0);
    return { image: c, matte, id: index, ratio: c.width / c.height };
  }
  function paper(w = W, h = H) {
    const c = makeCanvas(w, h), p = c.getContext('2d');
    p.drawImage(paperImage, 0, 0, w, h);
    p.fillStyle = 'rgba(218,205,174,.66)'; p.fillRect(0, 0, w, h);
    return c;
  }
  let paperLayer;
  function stamp(p, index, x, y, size, angle = 0, opacity = .8) {
    const sw = sealImage.width / 3, sh = sealImage.height / 2;
    p.save(); p.translate(x, y); p.rotate(angle); p.globalAlpha = opacity;
    p.globalCompositeOperation = 'multiply';
    p.drawImage(sealImage, index % 3 * sw, Math.floor(index / 3) * sh, sw, sh, -size / 2, -size / 2, size, size);
    p.restore();
  }
  function writeColophon(p, s) {
    p.save(); p.globalAlpha = .82; p.globalCompositeOperation = 'multiply';
    p.drawImage(titleImage, 2950, 135, 155, 407);
    p.drawImage(inscriptionImage, 2755, 615, 173, 205);
    p.restore();
    stamp(p, 0, 3025, 615, 76, -.035, .85);
    stamp(p, 1, 3020, 700, 64, .045, .74);
    stamp(p, 4, 2525, 1025, 62, -.06, .62);
    stamp(p, 3, 160, 915, 67, .025, .64);
    p.save(); p.fillStyle = '#51432ec9'; p.font = '25px "Atlas ZhengKai", "Kaiti SC", KaiTi, serif';
    const text = '山非故山　水非故水';
    for (let i = 0; i < text.length; i++) p.fillText(text[i], 100, 220 + i * 31);
    p.restore();
  }
  function makeScene(s) {
    setSeed(s);
    const c = makeCanvas(), p = c.getContext('2d'), ink = makeCanvas(), q = ink.getContext('2d');
    p.drawImage(paperLayer, 0, 0);
    const chaos = mode === 'wander' ? intensity * .22 : mode === 'rift' ? .40 + intensity * .58 : intensity * .64;
    const layout = Math.floor(rand(3)), phase = rand(0, 6.28), mirror = rand() > .5;
    const recipe = { seed: s, mode, intensity, regions: [], layers: 0, layout,
      composition: ['溪山平遠', '一水兩岸', '雲嶺回環'][layout], reservedSpace: true, passages: [], creatures: [] };
    const order = shuffle(library.map((_, i) => i)), layers = [];
    // 24 independent territories, composed as connected ridges rather than a visible grid.
    // Eight distant ranges, ten main settlements, six near-bank fragments.
    for (let i = 0; i < 24; i++) {
      const tier = i < 8 ? 0 : i < 18 ? 1 : 2;
      const j = tier === 0 ? i : tier === 1 ? i - 8 : i - 18;
      const count = [8, 10, 6][tier], t = j / (count - 1);
      let u = tier === 0 ? .16 + t * .65 : tier === 1 ? .24 + t * .53 : .10 + t * .60;
      if (mirror) u = .88 - u;
      let v = tier === 0 ? .23 + Math.sin(t * 4 + phase) * .065 :
        tier === 1 ? .41 + Math.sin(t * 5 + phase) * .12 : .79 + Math.sin(t * 3 + phase) * .055;
      if (layout === 1 && tier === 1) { u = .13 + t * .65; v = .37 + Math.sin(t * Math.PI * 2) * .13; }
      if (layout === 2 && tier !== 2) v += (.5 - u) * .25;
      const x = u * W + rand(-60, 60), y = v * H + rand(-25, 25);
      const w = [rand(320, 440), rand(470, 650), rand(490, 650)][tier] * (1 + chaos * rand(-.17, .19));
      const angle = rand(-.055, .055) + (rand() < chaos * .30 ? rand(-.4, .4) : 0);
      const item = { id: order[i], x, y, w, angle, tier, region: i,
        flipX: rand() < .35, flipY: rand() < chaos * (tier === 1 ? .40 : .20),
        shear: rand(-.17, .17) * chaos, stretch: rand(.79, 1.10),
        warp: rand(.005, mode === 'rift' ? .065 : .02) * chaos, phase: rand(6.28),
        opacity: tier === 0 ? rand(.26, .43) : tier === 1 ? rand(.88, 1) : rand(.82, .98) };
      recipe.regions.push({ ...item }); layers.push(item);
      if (tier === 1 && rand() < .7) layers.push({ ...item, id: order[(i + 24) % order.length],
        x: x + rand(-135, 135), y: y + rand(45, 85), w: w * rand(.44, .60),
        opacity: item.opacity * .82, angle: -angle, stretch: rand(.85, 1.2) });
    }
    // One common pale ground under all fragments, with matching ink and a single horizon.
    q.save(); q.globalAlpha = .09; q.translate(1400, 540); q.scale(mirror ? -1 : 1, 1);
    q.drawImage(backdrop, -1350, -390, 2700, 780); q.restore();
    layers.sort((a, b) => a.tier - b.tier || a.y - b.y);
    for (const layer of layers) {
      const asset = library[layer.id], h = layer.w / asset.ratio * layer.stretch;
      q.save(); q.translate(layer.x, layer.y); q.rotate(layer.angle + (layer.flipY ? Math.PI : 0));
      q.transform(layer.flipX ? -1 : 1, 0, layer.shear, 1, 0, 0);
      q.globalCompositeOperation = 'destination-out'; q.globalAlpha = layer.tier === 0 ? .38 : .98;
      paintFragment(q, asset.matte, layer.w, h, layer.warp, layer.phase);
      q.globalCompositeOperation = 'source-over'; q.globalAlpha = layer.opacity;
      paintFragment(q, asset.image, layer.w, h, layer.warp, layer.phase); q.restore();
    }
    // Passage knots allow the hills to intermittently appear through the cloud river.
    const crossings = [.21 + rand(-.035, .035), .44 + rand(-.04, .04), .70 + rand(-.04, .04)];
    const livingWindows = [.29, .53, .74].map(u => ({ u: u + rand(-.025, .025), dy: rand(-20, 20) }));
    // One continuous winding river and mist field crosses every local boundary.
    // It removes ink, revealing the SAME paper underneath, never white patch backgrounds.
    const mask = makeCanvas(800, 300), m = mask.getContext('2d'), data = m.createImageData(800, 300);
    for (let y = 0; y < 300; y++) {
      for (let x = 0; x < 800; x++) {
        const u = x / 800, v = y / 300;
        const water = .595 + Math.sin(u * 7.2 + phase) * .102;
        const width = .10 + Math.sin(u * 15 + phase) * .018 + Math.sin(u * 7 + phase) * .012;
        const river = 1 - smooth(.009, width, Math.abs(v - water));
        const crossing = Math.max(...crossings.map(c => Math.exp(-Math.pow((u - c) / .033, 2))));
        // Preserve faint terrain, and stronger vertical connections at three irregular knots.
        const attenuation = .88 + Math.sin(u * 18 + phase) * .07 - crossing * .30;
        const edge = smooth(.025, .07, u) * (1 - smooth(.82, .89, u)) * smooth(.07, .17, v) * (1 - smooth(.86, .96, v));
        const sky = 1 - Math.exp(-Math.pow((u - .12) / .23, 2) - Math.pow((v - .14) / .18, 2)) * .7;
        const fog = (1 - smooth(.006, .05, Math.abs(v - .325 - Math.sin(u * 9 + phase) * .03))) * .12;
        const pocket = Math.max(...livingWindows.map(a => Math.exp(-Math.pow((u - a.u) / .055, 2) - Math.pow((v - water - a.dy / H) / .085, 2))));
        const retain = edge * (1 - river * attenuation) * sky * (1 - fog) * (1 - pocket * .64);
        data.data[(y * 800 + x) * 4 + 3] = Math.round(retain * 255);
      }
    }
    m.putImageData(data, 0, 0); q.globalCompositeOperation = 'destination-in'; q.drawImage(mask, 0, 0, W, H);
    p.drawImage(ink, 0, 0);
    paintPassages(p, crossings, phase, chaos, recipe, livingWindows);
    writeColophon(p, s);
    // Slight pigment abrasion, under the same fiber pattern across the entire painting.
    p.save(); p.globalCompositeOperation = 'soft-light'; p.globalAlpha = .12;
    p.drawImage(paperImage, 0, 0, W, H); p.restore();
    recipe.layers = layers.length + recipe.passages.length + recipe.creatures.length;
    return { canvas: c, recipe };
  }
  function paintPassages(p, crossings, phase, chaos, recipe, livingWindows) {
    if (wonders.length < 12) return;
    const creatures = shuffle([0, 1, 2, 3, 4, 5]);
    const connections = shuffle([6, 7, 8, 9, 10, 11]);
    const waterAt = u => (.595 + Math.sin(u * 7.2 + phase) * .102) * H;
    function paint(id, u, dy, w, opacity, angle = 0) {
      const asset = wonders[id], h = w / asset.ratio;
      p.save(); p.translate(u * W, waterAt(u) + dy); p.rotate(angle);
      p.globalAlpha = opacity;
      paintFragment(p, asset.image, w, h, rand(.002, .012) * chaos, rand(6.28));
      p.restore();
      return { id, x: u * W, y: waterAt(u) + dy, w, opacity };
    }
    // The pale span reaches both shores; do not erase it with the river's void mask.
    for (let i = 0; i < crossings.length; i++) {
      const u = crossings[i];
      recipe.passages.push(paint(connections[i], u, rand(-22, 18), rand(340, 490), rand(.34, .57), rand(-.13, .13)));
    }
    // Living presences stay small enough to belong to the landscape, rather than portraits.
    for (let i = 0; i < 3; i++) {
      const { u, dy } = livingWindows[i];
      recipe.creatures.push(paint(creatures[i], u, dy, rand(270, 350), rand(.68, .85), rand(-.12, .12)));
    }
    // Receding echoes: an island or a distant rail slips back under the cloud veil.
    for (let i = 0; i < 3; i++) {
      const u = rand(.12, .76);
      recipe.passages.push(paint(connections[(i + 3) % 6], u, rand(-45, 60), rand(210, 330), rand(.10, .23)));
    }
  }
  function paintFragment(p, image, w, h, warp, phase) {
    if (warp < .009) { p.drawImage(image, -w / 2, -h / 2, w, h); return; }
    // A curved strip mesh bends the architecture itself, not just its bounding box.
    const bands = 96;
    for (let j = 0; j < bands; j++) {
      const v = j / bands, sh = image.height / bands;
      const offset = Math.sin(v * Math.PI * 2 + phase) * w * warp;
      const stretch = 1 + Math.cos(v * Math.PI * 2 + phase) * warp * .6;
      p.drawImage(image, 0, v * image.height, image.width, sh,
        -w * stretch / 2 + offset, -h / 2 + v * h, w * stretch, h / bands + .15);
    }
  }
  function drawGrid() {
    ctx.save(); ctx.strokeStyle = '#746e515c'; ctx.lineWidth = 1;
    ctx.setLineDash([7, 11]);
    for (let i = 1; i < COLS; i++) { ctx.beginPath(); ctx.moveTo(i * W / COLS, 0); ctx.lineTo(i * W / COLS, H); ctx.stroke(); }
    for (let i = 1; i < ROWS; i++) { ctx.beginPath(); ctx.moveTo(0, i * H / ROWS); ctx.lineTo(W, i * H / ROWS); ctx.stroke(); }
    ctx.setLineDash([]); ctx.font = '20px serif'; ctx.fillStyle = '#655d4599';
    for (let i = 0; i < 24; i++) ctx.fillText(String(i + 1).padStart(2, '0'), i % 6 * W / 6 + 16, Math.floor(i / 6) * H / 4 + 29);
    ctx.restore();
  }
  function renderStill() {
    if (canvas.width !== W) { canvas.width = W; canvas.height = H; ctx = canvas.getContext('2d', { alpha: false }); }
    ctx.drawImage(current, 0, 0); if (grid) drawGrid();
    updateMiniature();
  }
  function updateInfo() {
    $('generation').textContent = round < 11 ? ['零','一','二','三','四','五','六','七','八','九','十'][round] : String(round);
    $('composition-name').textContent = currentRecipe.composition;
  }
  function finish() {
    current = next; next = null; currentRecipe = lastRecipe;
    busy = false; $('regenerate').disabled = false; $('save').disabled = false; $('inspect').disabled = false;
    $('state').textContent = '墨境已成'; $('transition-label').textContent = ''; canvas.setAttribute('aria-busy', 'false');
    updateInfo(); renderStill();
  }
  function animation(t) {
    if (!transitionStart) transitionStart = t;
    const progress = Math.min(1, (t - transitionStart) / 3100), wave = Math.sin(progress * Math.PI);
    ctx.save(); ctx.scale(.5, .5); ctx.drawImage(paperLayer, 0, 0);
    const cw = W / COLS, ch = H / ROWS;
    // All 24 regions fragment at the same time; strips follow curved flow fields.
    for (let i = 0; i < 24; i++) {
      const x = i % 6 * cw, y = Math.floor(i / 6) * ch;
      const spin = Math.sin(i * 12.7) * wave * .13;
      for (let strip = 0; strip < 9; strip++) {
        const sy = y + strip * ch / 9, sh = ch / 9 + 1;
        const phase = i * 2.399 + strip * .7 + progress * 7;
        const dx = Math.sin(phase) * wave * (35 + intensity * 100);
        const dy = Math.cos(phase * .8) * wave * 44;
        ctx.save(); ctx.translate(x + cw / 2, sy + sh / 2); ctx.rotate(spin * Math.sin(phase));
        ctx.globalAlpha = Math.max(0, 1 - progress * 1.85);
        ctx.drawImage(current, x, sy, cw, sh, -cw / 2 + dx, -sh / 2 + dy, cw, sh);
        ctx.globalAlpha = Math.min(1, Math.max(0, (progress - .29) / .71));
        ctx.drawImage(next, x, sy, cw, sh, -cw / 2 - dx * .7, -sh / 2 - dy * .7, cw, sh);
        ctx.restore();
      }
    }
    // Ink particles are sampled from painted pixels, not a generic confetti overlay.
    for (const s of shards) {
      const a = s.angle + progress * s.spin;
      const travel = wave * s.speed;
      const x = s.x + Math.cos(a) * travel, y = s.y + Math.sin(a) * travel * .64;
      // Fine ink filaments follow the curl of the flow, rather than square confetti.
      const length = s.size * (2.5 + wave * 4.5);
      ctx.strokeStyle = `rgba(38,36,30,${s.alpha * wave * .64})`;
      ctx.lineWidth = Math.max(.5, s.size * (.45 + wave * .35)); ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(x, y);
      ctx.quadraticCurveTo(x + Math.cos(a + .5) * length * .65, y + Math.sin(a + .5) * length * .65,
        x + Math.cos(a) * length, y + Math.sin(a) * length * .6); ctx.stroke();
    }
    ctx.restore();
    if (grid) { ctx.save(); ctx.scale(.5, .5); drawGrid(); ctx.restore(); }
    if (progress < 1) animationFrame = requestAnimationFrame(animation);
    else finish();
  }
  function createShards() {
    const p = current.getContext('2d'), data = p.getImageData(0, 0, W, H).data;
    const count = innerWidth < 700 ? 1800 : 3600; shards = [];
    for (let i = 0; i < count; i++) {
      const x = Math.floor(rand(W)), y = Math.floor(rand(H)), offset = (y * W + x) * 4;
      const darkness = Math.max(0, 1 - data[offset] / 220);
      if (darkness < .12) continue;
      shards.push({ x, y, alpha: darkness, angle: rand(Math.PI * 2), spin: rand(-10, 10),
        speed: rand(60, 330), size: rand(1, 3.4) });
    }
  }
  function regenerate() {
    if (busy) return;
    busy = true; round++; seed = newSeed();
    intensity = Number($('intensity').value) / 100; mode = $('mode').value;
    $('regenerate').disabled = true; $('save').disabled = true; $('inspect').disabled = true;
    $('state').textContent = '雲起，落墨'; $('transition-label').textContent = '散 · 化 · 生';
    canvas.setAttribute('aria-busy', 'true');
    // Yield once so the UI responds before compositing the high-resolution painting.
    requestAnimationFrame(() => {
      const result = makeScene(seed); next = result.canvas; lastRecipe = result.recipe;
      if (reduced.matches) { finish(); return; }
      createShards(); canvas.width = W / 2; canvas.height = H / 2;
      ctx = canvas.getContext('2d', { alpha: false }); transitionStart = 0;
      animationFrame = requestAnimationFrame(animation);
    });
  }
  $('regenerate').addEventListener('click', regenerate);
  viewport.addEventListener('pointerdown', e => { pointerOrigin = { x: e.clientX, y: e.clientY, scroll: viewport.scrollLeft }; }, { passive: true });
  viewport.addEventListener('pointermove', e => {
    if (pointerOrigin && Math.hypot(e.clientX - pointerOrigin.x, e.clientY - pointerOrigin.y) > 9) lastPanAt = performance.now();
  }, { passive: true });
  viewport.addEventListener('pointercancel', () => { lastPanAt = performance.now(); pointerOrigin = null; }, { passive: true });
  canvas.addEventListener('click', () => {
    const moved = pointerOrigin && Math.abs(viewport.scrollLeft - pointerOrigin.scroll) > 8;
    pointerOrigin = null;
    if (!moved && performance.now() - lastPanAt > 400) regenerate();
  });
  canvas.addEventListener('keydown', e => { if (e.code === 'Enter') regenerate(); });
  document.addEventListener('keydown', e => {
    if (e.code === 'Space' && !$('viewer').open && !/BUTTON|INPUT|TEXTAREA|SELECT|A/.test(e.target.tagName)) {
      e.preventDefault(); regenerate();
    }
  });
  function updateMiniature() {
    if (current) {
      const map = $('miniature-canvas'), m = map.getContext('2d');
      m.drawImage(current, 0, 0, map.width, map.height);
    }
    updateNavigator();
  }
  function updateNavigator() {
    const width = viewport.scrollWidth || 1;
    $('navigator-window').style.width = `${Math.min(100, viewport.clientWidth / width * 100)}%`;
    $('navigator-window').style.left = `${viewport.scrollLeft / width * 100}%`;
  }
  function setOverview(overview) {
    viewport.classList.toggle('overview', overview);
    $('overview-toggle').setAttribute('aria-pressed', String(overview));
    $('overview-toggle').textContent = overview ? '游觀' : '全卷';
    requestAnimationFrame(() => {
      if (!overview) viewport.scrollLeft = (viewport.scrollWidth - viewport.clientWidth) * .45;
      updateNavigator();
    });
  }
  $('overview-toggle').onclick = () => setOverview(!viewport.classList.contains('overview'));
  $('miniature').onclick = e => {
    const bounds = $('miniature').getBoundingClientRect();
    const position = e.detail === 0 ? .5 : Math.max(0, Math.min(1, (e.clientX - bounds.left) / bounds.width));
    if (viewport.classList.contains('overview')) setOverview(false);
    requestAnimationFrame(() => {
      viewport.scrollTo({ left: position * viewport.scrollWidth - viewport.clientWidth / 2, behavior: reduced.matches ? 'auto' : 'smooth' });
    });
  };
  viewport.addEventListener('scroll', () => { lastPanAt = performance.now(); updateNavigator(); }, { passive: true });
  viewport.addEventListener('keydown', e => {
    if (e.target !== viewport || !phoneView.matches || !['ArrowLeft', 'ArrowRight'].includes(e.key)) return;
    e.preventDefault(); viewport.scrollBy({ left: viewport.clientWidth * (e.key === 'ArrowLeft' ? -.65 : .65), behavior: reduced.matches ? 'auto' : 'smooth' });
  });
  function layoutChanged() {
    if (phoneView.matches && !mobileInitialized) {
      viewport.scrollLeft = (viewport.scrollWidth - viewport.clientWidth) * .45; mobileInitialized = true;
    } else if (!phoneView.matches) mobileInitialized = false;
    updateNavigator();
  }
  window.addEventListener('resize', layoutChanged, { passive: true });
  $('intensity').addEventListener('input', () => { $('intensity-value').textContent = `${$('intensity').value}%`; });
  $('grid').onclick = () => {
    grid = !grid; $('grid').setAttribute('aria-pressed', String(grid));
    $('grid').querySelector('span').textContent = grid ? '隐二十四境' : '观二十四境';
    if (!busy) renderStill();
  };
  function saveBlob(blob, filename) {
    if (!blob) { $('state').textContent = '导出失败，请重试'; return; }
    const url = URL.createObjectURL(blob), a = document.createElement('a');
    a.href = url; a.download = filename; document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 30000);
  }
  $('save').onclick = () => {
    if (busy || !current) return;
    const out = paper(W + 120, H + 250), p = out.getContext('2d');
    p.drawImage(current, 60, 45);
    p.fillStyle = '#675137a8'; p.font = '24px "Atlas ZhengKai", "Kaiti SC", KaiTi, serif';
    p.fillText('借萬物之形　寫無有之境', 140, H + 145);
    p.font = '20px "Atlas ZhengKai", serif'; p.fillText(`虛構山河　第 ${round} 卷`, W - 450, H + 145);
    stamp(p, 5, W - 120, H + 126, 84, -.06, .7);
    out.toBlob(blob => saveBlob(blob, `无何有之乡-${seed.toString(16)}.png`), 'image/png');
  };
  $('inspect').onclick = () => {
    if (!current || busy) return;
    current.toBlob(blob => {
      if (!blob) return;
      if (viewerURL) URL.revokeObjectURL(viewerURL);
      viewerURL = URL.createObjectURL(blob); $('detail-image').src = viewerURL;
      $('detail-image').style.width = '100%'; $('detail-image').style.maxWidth = '100%';
      $('viewer').showModal();
    });
  };
  $('zoom-in').onclick = () => { $('detail-image').style.width = `${W}px`; $('detail-image').style.maxWidth = 'none'; };
  $('zoom-out').onclick = () => { $('detail-image').style.width = '100%'; $('detail-image').style.maxWidth = '100%'; };
  $('viewer-close').onclick = () => $('viewer').close();
  $('viewer').addEventListener('click', e => { if (e.target === $('viewer')) $('viewer').close(); });
  $('sound').onclick = async () => {
    try {
      if (!audioContext) {
        const AC = window.AudioContext || window.webkitAudioContext;
        if (!AC) throw new Error('unsupported');
        audioContext = new AC();
        const buffer = audioContext.createBuffer(1, audioContext.sampleRate * 4, audioContext.sampleRate);
        const data = buffer.getChannelData(0); let last = 0;
        for (let i = 0; i < data.length; i++) { last = (last + Math.random() * .02 - .01) / 1.02; data[i] = last * 2; }
        ambient = audioContext.createBufferSource(); ambient.buffer = buffer; ambient.loop = true;
        const filter = audioContext.createBiquadFilter(); filter.type = 'lowpass'; filter.frequency.value = 650;
        const gain = audioContext.createGain(); gain.gain.value = .22;
        ambient.connect(filter).connect(gain).connect(audioContext.destination); ambient.start();
      }
      const wasOn = $('sound').getAttribute('aria-pressed') === 'true';
      if (wasOn) await audioContext.suspend(); else await audioContext.resume();
      $('sound').setAttribute('aria-pressed', String(!wasOn)); $('sound-status').textContent = wasOn ? '聲境已關閉' : '聲境已開啟';
    } catch { $('sound-status').textContent = '暂不可用'; }
  };
  async function init() {
    try {
      $('state').textContent = '正在展卷'; $('transition-label').textContent = '展 卷';
      if (!window.INK_ASSETS || !INK_ASSETS.tiles.length) throw new Error('缺少画材库');
      if (!window.SCROLL_MATERIALS) throw new Error('卷紙未至');
      [paperImage, titleImage, inscriptionImage, sealImage] = await Promise.all([
        imageFrom(SCROLL_MATERIALS.paper), imageFrom(SCROLL_MATERIALS.title), imageFrom(SCROLL_MATERIALS.inscription), imageFrom(SCROLL_MATERIALS.seals)
      ]);
      document.documentElement.style.setProperty('--paper-image', `url("${SCROLL_MATERIALS.paper}")`);
      // Keep CSS custom properties small: full-resolution RGBA seals exceed the
      // browser's custom-property substitution limit. Canvas stamps retain the original.
      const sealPreview = makeCanvas(384, 256);
      sealPreview.getContext('2d').drawImage(sealImage, 0, 0, 384, 256);
      document.documentElement.style.setProperty('--seal-image', `url("${sealPreview.toDataURL('image/webp', .9)}")`);
      if (window.ATLAS_FONT && window.FontFace) {
        const face = new FontFace('Atlas ZhengKai', ATLAS_FONT);
        await face.load(); document.fonts.add(face);
      }
      paperLayer = paper(); ctx.drawImage(paperLayer, 0, 0);
      const total = INK_ASSETS.tiles.length;
      // Sequential decoding caps memory on phones; data URLs also work without a server.
      for (let i = 0; i < total; i++) {
        const img = await imageFrom(INK_ASSETS.tiles[i].src);
        library.push(inkAsset(img, i));
        if (i % 6 === 0) { $('transition-label').textContent = '潤 墨'; await new Promise(resolve => setTimeout(resolve, 0)); }
      }
      if (!window.INK_WONDERS || INK_WONDERS.tiles.length !== 12) throw new Error('雲中異境未至');
      for (let i = 0; i < INK_WONDERS.tiles.length; i++) {
        wonders.push(inkAsset(await imageFrom(INK_WONDERS.tiles[i].src), i));
      }
      const bg = await imageFrom(INK_ASSETS.panorama);
      backdrop.width = bg.width; backdrop.height = bg.height;
      backdrop.getContext('2d').drawImage(inkAsset(bg, -1).image, 0, 0);
      const result = makeScene(seed);
      next = result.canvas; lastRecipe = result.recipe; finish(); layoutChanged();

    } catch (e) {
      $('state').textContent = '画材加载失败'; $('transition-label').textContent = '请保留完整文件夹后重新打开';
      $('load-error').hidden = false; $('load-error').textContent = `${e.message}。请确认 assets/ink-library.js 与网页一起保存。`;
      console.error(e);
    }
  }
  $('guide-toggle').onclick = () => {
    const open = $('guide-toggle').getAttribute('aria-expanded') === 'true';
    $('guide-toggle').setAttribute('aria-expanded', String(!open));
    $('guide-toggle').textContent = open ? '如何遊觀 ＋' : '收起指引 −';
    $('guide-details').hidden = open;
  };
  $('work-note-toggle').onclick = () => {
    const open = $('work-note-toggle').getAttribute('aria-expanded') === 'true';
    $('work-note-toggle').setAttribute('aria-expanded', String(!open)); $('work-note').hidden = open;
  };
  // Read-only diagnostics used by the smoke test and useful for future material curation.
  window.inkAtlas = { get ready() { return !busy && !!current; }, get recipe() { return currentRecipe; }, get materialCount() { return library.length; }, get wonderCount() { return wonders.length; } };
  init();
})();

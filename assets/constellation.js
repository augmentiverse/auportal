// Perspective projection of a semantic 3D graph. No WebGL, textures or third-party runtime.
let dataPromise;
export async function mountConstellation(panel) {
  const french = document.documentElement.lang === 'fr';
  const arabic = document.documentElement.lang === 'ar';
  dataPromise ||= fetch(arabic ? '/assets/ecosystem-ar.json' : french ? '/assets/ecosystem-fr.json' : '/assets/ecosystem.json').then(response => {
    if (!response.ok) throw new Error('Ecosystem data unavailable');
    return response.json();
  });
  const data = await dataPromise;
  if (!Array.isArray(data) || data.some(node => !node.id || !Array.isArray(node.related))) throw new Error('Invalid ecosystem data');
  const byId = new Map(data.map(node => [node.id, node]));
  const links = [...panel.querySelectorAll('[data-node]')];
  const svg = panel.querySelector('.space-connections');
  const stage = panel.querySelector('.space-stage');
  const description = panel.querySelector('.space-description');
  const select = panel.querySelector('select');
  const pauseButton = panel.querySelector('[data-pause]');
  const viewButton = panel.querySelector('[data-view]');
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const small = matchMedia('(max-width: 1000px)');
  const controller = new AbortController();
  const listen = (target, type, handler) => target.addEventListener(type, handler, { signal: controller.signal });
  let active = panel.dataset.active;
  let paused = reduced.matches;
  let visible = true;
  let hoveredNode = null;
  let focusedNode = null;
  let list = false;
  let frame = 0;
  let last = 0;
  let angle = 0;
  let currentPoints = new Map();
  let targets = new Map();
  let edges = [];
  try { paused ||= sessionStorage.getItem('augmentiverse-motion') === 'paused'; } catch { /* Storage is optional. */ }

  function describe(id) {
    const node = byId.get(id);
    if (!node) return;
    description.querySelector('strong').textContent = node.name;
    description.querySelector('span').textContent = `${node.category} · ${node.summary}`;
  }

  function layout() {
    const focus = byId.get(active);
    if (!focus) return;
    panel.dataset.active = active;
    panel.style.setProperty('--topic', focus.color);
    const related = new Set(focus.related);
    const ordered = [focus, ...data.filter(n => n.id !== active && related.has(n.id)), ...data.filter(n => n.id !== active && !related.has(n.id))];
    targets = new Map();
    ordered.forEach((node, i) => {
      if (i === 0) targets.set(node.id, { x: 0, y: -15, z: 40 });
      else {
        const inner = i <= 7;
        const count = inner ? 7 : ordered.length - 8;
        const theta = (inner ? i - 1 : i - 8) * Math.PI * 2 / count - Math.PI / 2;
        const radius = 1 + Math.sin(i * 2.4) * .13;
        targets.set(node.id, { x: Math.cos(theta + Math.sin(i) * .06) * (inner ? 255 : 400) * radius, y: Math.sin(theta) * (inner ? 220 : 365) * radius - 15, z: Math.sin(theta * 2) * (inner ? 80 : 65) });
      }
      const anchor = links.find(link => link.dataset.node === node.id);
      anchor.classList.toggle('active-node', i === 0);
      anchor.classList.toggle('secondary-node', i > 9);
      anchor.classList.toggle('related-node', related.has(node.id));
      if (!currentPoints.has(node.id) || reduced.matches) currentPoints.set(node.id, { ...targets.get(node.id) });
    });
    svg.replaceChildren();
    edges = [];
    const pairs = new Set();
    const connect = (from, to, prominent) => {
      if (!byId.has(to) || from === to) return;
      const key = [from, to].sort().join(':');
      if (pairs.has(key)) return;
      pairs.add(key);
      const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
      if (!prominent) line.classList.add('distant-edge');
      svg.append(line);
      edges.push({ line, from, to });
    };
    focus.related.forEach(id => connect(active, id, true));
    // Only real data relationships form the constellation's quieter branches.
    data.forEach(node => node.related.slice(0, 2).forEach(id => connect(node.id, id, false)));
    describe(active);
    render(true);
  }

  function project(point) {
    // Gentle depth and orbital motion; labels stay upright and links remain easy to read.
    const rotation = Math.sin(angle) * .2;
    const x = point.x * Math.cos(rotation) + point.z * Math.sin(rotation);
    const z = -point.x * Math.sin(rotation) + point.z * Math.cos(rotation);
    const perspective = 1300 / (1300 - z);
    const orbit = Math.sin(angle * .8) * .075;
    return {
      x: 500 + (x * Math.cos(orbit) - point.y * Math.sin(orbit)) * perspective + Math.sin(angle) * 12,
      y: 470 + (x * Math.sin(orbit) + point.y * Math.cos(orbit)) * perspective + Math.sin(angle * .8) * 8,
      z, scale: Math.max(.92, Math.min(1.08, perspective))
    };
  }

  function render(snap = false) {
    const positions = new Map();
    for (const [id, target] of targets) {
      const point = currentPoints.get(id);
      const ratio = snap && (reduced.matches || paused) ? 1 : .075;
      for (const axis of ['x','y','z']) point[axis] += (target[axis] - point[axis]) * ratio;
      positions.set(id, project(point));
    }
    links.forEach(anchor => {
      const p = positions.get(anchor.dataset.node);
      anchor.style.setProperty('--x', `${p.x / 10}%`);
      anchor.style.setProperty('--y', `${p.y / 10}%`);
      anchor.style.transform = `translate(-50%, -50%) scale(${p.scale})`;
      anchor.style.zIndex = anchor.dataset.node === active ? '10' : String(Math.round((p.z + 140) / 30));
    });
    edges.forEach(({ line, from, to }) => {
      const a = positions.get(from), b = positions.get(to);
      line.setAttribute('x1', a.x); line.setAttribute('y1', a.y);
      line.setAttribute('x2', b.x); line.setAttribute('y2', b.y);
      const hiddenEndpoint = [from, to].some(id => links.find(link => link.dataset.node === id).classList.contains('secondary-node'));
      line.style.display = (small.matches || panel.classList.contains('constellation-compact')) && hiddenEndpoint ? 'none' : '';
    });
  }

  function tick(now) {
    frame = 0;
    if (paused || reduced.matches || !visible || document.hidden || hoveredNode || focusedNode || list) return;
    if (now - last >= (small.matches ? 65 : 33)) {
      angle += Math.min(now - last, 100) * .00035;
      last = now;
      render();
    }
    frame = requestAnimationFrame(tick);
  }
  function sync() {
    cancelAnimationFrame(frame);
    frame = 0;
    pauseButton.textContent = arabic ? (paused ? 'استئناف الحركة' : 'إيقاف الحركة') : french ? (paused ? 'Reprendre l’animation' : 'Suspendre l’animation') : (paused ? 'Resume motion' : 'Pause motion');
    pauseButton.setAttribute('aria-pressed', String(paused));
    pauseButton.disabled = reduced.matches;
    if (reduced.matches) pauseButton.textContent = arabic ? 'حركة مخفّضة' : french ? 'Animation réduite' : 'Motion reduced';
    const playing = !paused && !reduced.matches && visible && !list && !document.hidden;
    // Hold only the interactive graph while a link is targeted, keeping the sky alive.
    panel.dataset.motion = playing ? 'playing' : 'paused';
    if (playing && !hoveredNode && !focusedNode) { last = performance.now(); frame = requestAnimationFrame(tick); }
  }
  listen(pauseButton, 'click', () => {
    paused = !paused;
    try { sessionStorage.setItem('augmentiverse-motion', paused ? 'paused' : 'playing'); } catch { /* Optional preference. */ }
    sync();
  });
  listen(viewButton, 'click', () => {
    list = !list;
    panel.classList.toggle('list-mode', list);
    viewButton.setAttribute('aria-pressed', String(list));
    viewButton.textContent = arabic ? (list ? 'العرض المكاني' : 'عرض القائمة') : french ? (list ? 'Vue spatiale' : 'Vue en liste') : (list ? 'Spatial view' : 'List view');
    sync();
  });
  listen(select, 'change', () => { active = select.value; angle = 0; layout(); sync(); });
  listen(stage, 'focusin', event => {
    focusedNode = event.target.closest('[data-node]');
    describe(focusedNode?.dataset.node || hoveredNode?.dataset.node || active);
    sync();
  });
  listen(stage, 'focusout', event => {
    focusedNode = stage.contains(event.relatedTarget) ? event.relatedTarget.closest('[data-node]') : null;
    describe(focusedNode?.dataset.node || hoveredNode?.dataset.node || active);
    sync();
  });
  links.forEach(anchor => {
    listen(anchor, 'pointerenter', event => {
      if (event.pointerType === 'touch') return;
      hoveredNode = anchor;
      describe(anchor.dataset.node);
      sync();
    });
    listen(anchor, 'pointerleave', () => {
      hoveredNode = null;
      describe(focusedNode?.dataset.node || active);
      sync();
    });
  });
  listen(document, 'visibilitychange', sync);
  listen(reduced, 'change', () => { paused = reduced.matches; layout(); sync(); });
  listen(small, 'change', () => { render(true); sync(); });
  let observer;
  if ('IntersectionObserver' in window) {
    observer = new IntersectionObserver(entries => { visible = entries[0].isIntersecting; sync(); });
    observer.observe(panel);
  }
  // Normal navigation destroys the document. A bfcache round trip pauses and resumes it.
  listen(window, 'pagehide', event => {
    cancelAnimationFrame(frame);
    panel.dataset.motion = 'paused';
    if (!event.persisted) { controller.abort(); observer?.disconnect(); }
  });
  listen(window, 'pageshow', sync);
  layout();
  pauseButton.hidden = false;
  viewButton.hidden = false;
  sync();
}

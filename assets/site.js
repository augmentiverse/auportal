const all = (selector, root = document) => [...root.querySelectorAll(selector)];
const french = document.documentElement.lang === 'fr';
const arabic = document.documentElement.lang === 'ar';

// Keep the user's place when switching between equivalent pages.
all('[data-language-switch]').forEach(link => {
  function updateLanguageLink() {
    const url = new URL(link.href);
    url.hash = location.hash;
    const query = new URLSearchParams(location.search);
    // Categories use shared stable values; free-text search belongs to its language.
    if (link.lang !== document.documentElement.lang) query.delete('q');
    url.search = query.toString();
    link.href = url.href;
  }
  updateLanguageLink();
  link.addEventListener('click', updateLanguageLink);
  window.addEventListener('hashchange', updateLanguageLink);
});

// Native details remain functional when JavaScript is absent.
const menus = all('.nav-drop, .mobile-menu');
menus.forEach(menu => menu.addEventListener('toggle', () => {
  if (menu.open) menus.filter(other => other !== menu).forEach(other => { other.open = false; });
}));
document.addEventListener('keydown', event => {
  if (event.key !== 'Escape') return;
  menus.filter(menu => menu.open).forEach(menu => {
    if (menu.contains(document.activeElement)) menu.querySelector('summary').focus();
    menu.open = false;
  });
});
document.addEventListener('click', event => {
  menus.filter(menu => menu.open && !menu.contains(event.target)).forEach(menu => { menu.open = false; });
});

const normalise = text => text.toLocaleLowerCase(arabic ? 'ar' : french ? 'fr' : 'en').normalize('NFKD').replace(/[\u0300-\u036f\u0640\u064b-\u065f\u0670]/g, '').replace(/[أإآٱ]/g, 'ا').replace(/ى/g, 'ي').trim();
all('.filter-scope').forEach(scope => {
  const input = scope.querySelector('[data-filter-search]');
  const category = scope.querySelector('[data-filter-category]');
  const items = all('.filter-item', scope).map(element => ({ element, text: normalise(element.textContent) }));
  const params = new URLSearchParams(location.search);
  input.value = params.get('q') || '';
  if ([...category.options].some(option => option.value === params.get('category'))) category.value = params.get('category');
  function update() {
    const words = normalise(input.value).split(/\s+/).filter(Boolean);
    let count = 0;
    items.forEach(({ element, text }) => {
      const match = (category.value === 'all' || element.dataset.category === category.value) && words.every(word => text.includes(word));
      element.hidden = !match;
      if (match) count++;
    });
    scope.querySelector('[data-filter-count]').textContent = arabic ? `عدد النتائج: ${count}` : `${count} ${french ? (count === 1 ? 'résultat' : 'résultats') : (count === 1 ? 'result' : 'results')}`;
    scope.querySelector('[data-empty]').hidden = count > 0;
    const url = new URL(location.href);
    input.value.trim() ? url.searchParams.set('q', input.value.trim()) : url.searchParams.delete('q');
    category.value !== 'all' ? url.searchParams.set('category', category.value) : url.searchParams.delete('category');
    history.replaceState(null, '', url);
  }
  input.addEventListener('input', update);
  category.addEventListener('change', update);
  update();
});

all('[data-copy]').forEach(button => button.addEventListener('click', async () => {
  const target = document.getElementById(button.dataset.copy);
  const status = button.closest('.citation').querySelector('.copy-status');
  try {
    await navigator.clipboard.writeText(target.textContent);
    status.textContent = arabic ? 'تم نسخ الاستشهاد.' : french ? 'Citation copiée.' : 'Citation copied.';
  } catch {
    const range = document.createRange();
    range.selectNodeContents(target);
    const selection = getSelection();
    selection.removeAllRanges();
    selection.addRange(range);
    status.textContent = arabic ? 'تم تحديد الاستشهاد. استخدم أمر النسخ في المتصفح.' : french ? 'La citation est sélectionnée. Utilisez la commande Copier de votre navigateur.' : 'The citation is selected. Use your browser’s Copy command.';
  }
}));

// Existing links into the old single-page site keep a meaningful destination.
if (location.pathname === '/' || location.pathname === '/index.html') {
  const oldAnchors = { concept: '/concept/', technologies: '/technologies/', standards: '/standards/', 'use-cases': '/applications/', timeline: '/timeline/', people: '/people-organizations/', glossary: '/glossary/', bibliography: '/bibliography/', faq: '/faq/', newsletter: '/contact/' };
  const destination = oldAnchors[location.hash.slice(1)];
  if (destination) location.replace(destination);
}

// The lightweight projection is loaded only when its panel reaches the viewport.
all('.constellation').forEach(panel => {
  let loaded = false;
  async function enhance() {
    if (loaded) return;
    loaded = true;
    try {
      const { mountConstellation } = await import('./constellation.js');
      await mountConstellation(panel);
    } catch {
      panel.querySelector('.atlas-note').textContent = arabic ? 'عرض ثابت للمنظومة. تظل جميع روابط الموضوعات متاحة.' : french ? 'Vue statique de l’écosystème. Tous les liens vers les sujets restent disponibles.' : 'Static ecosystem view. Every topic link remains available.';
    }
  }
  if ('IntersectionObserver' in window) {
    const observer = new IntersectionObserver(entries => {
      if (entries.some(entry => entry.isIntersecting)) { observer.disconnect(); enhance(); }
    }, { rootMargin: '80px' });
    observer.observe(panel);
  } else enhance();
});

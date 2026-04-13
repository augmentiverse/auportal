'use strict';

const $ = (selector, context = document) => context.querySelector(selector);
const $$ = (selector, context = document) => [...context.querySelectorAll(selector)];
const on = (element, eventName, handler, options) => {
  if (element) {
    element.addEventListener(eventName, handler, options);
  }
};

const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

const nav = $('#nav');
const navToggle = $('.nav-toggle');
const navMobile = $('#nav-mobile');
const readBar = $('#read-progress');
const backTop = $('#back-top');

function syncToggleIcon(open) {
  $$('.nav-toggle span').forEach((span, index) => {
    if (open) {
      if (index === 0) span.style.transform = 'rotate(45deg) translate(4px, 4px)';
      if (index === 1) span.style.opacity = '0';
      if (index === 2) span.style.transform = 'rotate(-45deg) translate(4px, -4px)';
    } else {
      span.style.transform = '';
      span.style.opacity = '';
    }
  });
}

function setMobileNavState(open) {
  if (!navToggle || !navMobile) return;

  navMobile.hidden = !open;
  navMobile.classList.toggle('is-open', open);
  navToggle.setAttribute('aria-expanded', String(open));
  document.body.classList.toggle('nav-open', open);
  syncToggleIcon(open);
}

function updateReadProgress() {
  if (!readBar) return;

  const documentHeight = document.documentElement.scrollHeight - window.innerHeight;
  const percent = documentHeight > 0 ? Math.min((window.scrollY / documentHeight) * 100, 100) : 0;

  readBar.style.width = percent + '%';
  readBar.setAttribute('aria-valuenow', String(Math.round(percent)));
}

function updateBackToTop() {
  if (!backTop) return;
  backTop.classList.toggle('visible', window.scrollY > 400);
}

function updateActiveNav() {
  const sections = $$('header[id], section[id]');
  const links = $$('.nav-links a, .nav-mobile a, .side-nav-link');
  let currentId = 'hero';

  sections.forEach(section => {
    if (section.getBoundingClientRect().top <= 140) {
      currentId = section.id;
    }
  });

  links.forEach(link => {
    const href = link.getAttribute('href');
    const isActive = href === `#${currentId}`;

    link.classList.toggle('active', isActive);
    if (isActive) {
      link.setAttribute('aria-current', 'true');
    } else {
      link.removeAttribute('aria-current');
    }
  });
}

function revealImmediately() {
  $$('.reveal').forEach(element => element.classList.add('visible'));
}

function setupRevealAnimations() {
  const revealNodes = $$('.reveal');
  if (!revealNodes.length) return;

  if (prefersReducedMotion.matches || !('IntersectionObserver' in window)) {
    revealImmediately();
    return;
  }

  const observer = new IntersectionObserver(entries => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('visible');
        observer.unobserve(entry.target);
      }
    });
  }, { threshold: 0.12, rootMargin: '0px 0px -40px 0px' });

  revealNodes.forEach(node => observer.observe(node));
}

function setupFaq() {
  $$('.faq-item').forEach((item, index) => {
    const trigger = $('.faq-trigger', item);
    const body = $('.faq-body', item);
    if (!trigger || !body) return;

    const bodyId = body.id || `faq-panel-${index + 1}`;
    body.id = bodyId;
    body.hidden = !item.classList.contains('open');
    trigger.setAttribute('aria-controls', bodyId);
    trigger.setAttribute('aria-expanded', String(item.classList.contains('open')));

    const toggleItem = () => {
      const shouldOpen = !item.classList.contains('open');

      $$('.faq-item').forEach(otherItem => {
        otherItem.classList.remove('open');
        const otherTrigger = $('.faq-trigger', otherItem);
        const otherBody = $('.faq-body', otherItem);
        if (otherTrigger) otherTrigger.setAttribute('aria-expanded', 'false');
        if (otherBody) otherBody.hidden = true;
      });

      if (shouldOpen) {
        item.classList.add('open');
        trigger.setAttribute('aria-expanded', 'true');
        body.hidden = false;
      }
    };

    on(trigger, 'click', toggleItem);
    on(trigger, 'keydown', event => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        toggleItem();
      }
    });
  });
}

function activateTab(tabNav, activeIndex) {
  const buttons = $$('.tab-btn', tabNav);
  const panelContainer = tabNav.nextElementSibling;
  const panels = panelContainer ? $$('.tab-pane', panelContainer) : [];

  buttons.forEach((button, index) => {
    const isActive = index === activeIndex;
    button.classList.toggle('active', isActive);
    button.setAttribute('aria-selected', String(isActive));
    button.tabIndex = isActive ? 0 : -1;
  });

  panels.forEach((panel, index) => {
    const isActive = index === activeIndex;
    panel.classList.toggle('active', isActive);
    panel.hidden = !isActive;
  });
}

function setupTabs() {
  $$('.tab-nav').forEach((tabNav, navIndex) => {
    const buttons = $$('.tab-btn', tabNav);
    const panelContainer = tabNav.nextElementSibling;
    if (!panelContainer || !buttons.length) return;

    const panels = $$('.tab-pane', panelContainer);
    buttons.forEach((button, index) => {
      const panel = panels[index];
      const panelId = panel?.id || `tab-panel-${navIndex + 1}-${index + 1}`;
      const buttonId = button.id || `tab-button-${navIndex + 1}-${index + 1}`;

      button.id = buttonId;
      button.setAttribute('role', 'tab');
      button.setAttribute('aria-controls', panelId);

      if (panel) {
        panel.id = panelId;
        panel.setAttribute('role', 'tabpanel');
        panel.setAttribute('aria-labelledby', buttonId);
      }

      on(button, 'click', () => activateTab(tabNav, index));
      on(button, 'keydown', event => {
        const keyMap = {
          ArrowRight: () => (index + 1) % buttons.length,
          ArrowLeft: () => (index - 1 + buttons.length) % buttons.length,
          Home: () => 0,
          End: () => buttons.length - 1
        };

        const getNextIndex = keyMap[event.key];
        if (!getNextIndex) return;

        event.preventDefault();
        const nextIndex = getNextIndex();
        activateTab(tabNav, nextIndex);
        buttons[nextIndex].focus();
      });
    });

    const initialIndex = Math.max(buttons.findIndex(button => button.classList.contains('active')), 0);
    activateTab(tabNav, initialIndex);
  });
}

function setupGlossarySearch() {
  const searchField = $('#gloss-search');
  const emptyState = $('#gloss-empty');
  if (!searchField) return;

  on(searchField, 'input', () => {
    const query = searchField.value.toLowerCase().trim();

    $$('.gloss-entry').forEach(entry => {
      const term = $('.gloss-term', entry)?.textContent.toLowerCase() || '';
      const definition = $('.gloss-def', entry)?.textContent.toLowerCase() || '';
      entry.style.display = (!query || term.includes(query) || definition.includes(query)) ? '' : 'none';
    });

    if (emptyState) {
      const hasVisibleResults = $$('.gloss-entry').some(entry => entry.style.display !== 'none');
      emptyState.style.display = hasVisibleResults ? 'none' : 'block';
    }
  });
}

function setupBibliographyFilter() {
  const filter = $('#bib-filter');
  if (!filter) return;

  on(filter, 'change', () => {
    const value = filter.value;
    $$('.bib-entry').forEach(entry => {
      const category = entry.dataset.cat || '';
      entry.style.display = (!value || value === 'all' || category === value) ? '' : 'none';
    });
  });
}

function formatCounterValue(target, value, prefix, suffix) {
  const number = Number.isInteger(target) ? Math.round(value) : value.toFixed(1);
  return `${prefix}${number}${suffix}`;
}

function animateCounter(element) {
  const target = parseFloat(element.dataset.target || '0');
  const prefix = element.dataset.prefix || '';
  const suffix = element.dataset.suffix || '';

  if (!Number.isFinite(target)) return;
  if (prefersReducedMotion.matches) {
    element.textContent = formatCounterValue(target, target, prefix, suffix);
    return;
  }

  const duration = 1800;
  const start = performance.now();

  function step(now) {
    const progress = Math.min((now - start) / duration, 1);
    const eased = 1 - Math.pow(1 - progress, 3);
    const currentValue = eased * target;

    element.textContent = formatCounterValue(target, currentValue, prefix, suffix);

    if (progress < 1) {
      requestAnimationFrame(step);
    }
  }

  requestAnimationFrame(step);
}

function setupCounters() {
  const counters = $$('[data-target]');
  if (!counters.length) return;

  if (prefersReducedMotion.matches || !('IntersectionObserver' in window)) {
    counters.forEach(counter => animateCounter(counter));
    return;
  }

  const observer = new IntersectionObserver(entries => {
    entries.forEach(entry => {
      if (entry.isIntersecting && entry.target.dataset.animated !== 'true') {
        entry.target.dataset.animated = 'true';
        animateCounter(entry.target);
        observer.unobserve(entry.target);
      }
    });
  }, { threshold: 0.45 });

  counters.forEach(counter => observer.observe(counter));
}

function setupSpectrumMarkers() {
  $$('.spectrum-marker').forEach(marker => {
    const position = parseFloat(marker.dataset.pos || '0');
    marker.style.left = position + '%';
  });
}

function copyTextFallback(text) {
  const area = document.createElement('textarea');
  area.value = text;
  area.setAttribute('readonly', '');
  area.style.position = 'absolute';
  area.style.left = '-9999px';
  document.body.appendChild(area);
  area.select();
  document.execCommand('copy');
  document.body.removeChild(area);
}

function setupCopyButtons() {
  $$('[data-copy]').forEach(button => {
    on(button, 'click', async () => {
      const text = button.dataset.copy || '';
      const originalText = button.textContent;

      try {
        if (navigator.clipboard?.writeText) {
          await navigator.clipboard.writeText(text);
        } else {
          copyTextFallback(text);
        }
        button.textContent = 'Copied';
      } catch (error) {
        button.textContent = 'Copy failed';
      }

      window.setTimeout(() => {
        button.textContent = originalText;
      }, 1600);
    });
  });
}

function setupNewsletterForm() {
  const form = $('#newsletter-form');
  const status = $('#newsletter-status');
  if (!form) return;

  on(form, 'submit', event => {
    event.preventDefault();

    const input = $('#newsletter-email', form) || $('input[type="email"]', form);
    const button = $('button[type="submit"]', form);
    if (!input || !button) return;

    const email = input.value.trim();
    if (!email || !input.checkValidity()) {
      input.reportValidity();
      if (status) {
        status.textContent = 'Enter a valid email address to generate the subscription email.';
      }
      return;
    }

    const subject = encodeURIComponent('Augmentiverse newsletter subscription');
    const body = encodeURIComponent(
      `Please subscribe this address to Augmentiverse updates:\n\n${email}\n\nSent from augmentiverse.org.`
    );

    localStorage.setItem('augmentiverse.newsletterDraft', email);

    if (status) {
      status.textContent = 'Opening your mail client with a prefilled subscription request.';
    }

    button.textContent = 'Opening mail';
    button.disabled = true;

    window.location.href = `mailto:contact@augmentiverse.org?subject=${subject}&body=${body}`;

    window.setTimeout(() => {
      button.textContent = 'Subscribe';
      button.disabled = false;
      input.value = '';
    }, 2200);
  });
}

function handleScroll() {
  if (nav) {
    nav.classList.toggle('scrolled', window.scrollY > 40);
  }

  updateReadProgress();
  updateBackToTop();
  updateActiveNav();
}

if (navToggle && navMobile) {
  on(navToggle, 'click', () => {
    const isOpen = !navMobile.hidden;
    setMobileNavState(!isOpen);
  });

  $$('.nav-mobile a').forEach(link => {
    on(link, 'click', () => setMobileNavState(false));
  });

  on(document, 'click', event => {
    if (navMobile.hidden) return;
    if (nav?.contains(event.target)) return;
    setMobileNavState(false);
  });

  on(window, 'resize', () => {
    if (window.innerWidth > 768) {
      setMobileNavState(false);
    }
  });

  on(document, 'keydown', event => {
    if (event.key === 'Escape' && !navMobile.hidden) {
      setMobileNavState(false);
      navToggle.focus();
    }
  });

  setMobileNavState(false);
}

if (backTop) {
  on(backTop, 'click', () => {
    window.scrollTo({ top: 0, behavior: prefersReducedMotion.matches ? 'auto' : 'smooth' });
  });
}

on(window, 'scroll', handleScroll, { passive: true });

setupRevealAnimations();
setupFaq();
setupTabs();
setupGlossarySearch();
setupBibliographyFilter();
setupCounters();
setupSpectrumMarkers();
setupCopyButtons();
setupNewsletterForm();
handleScroll();

console.log('%cAugmentiverse.org', 'font-size:18px; font-weight:bold; color:#c9a84c;');
console.log('%cReference resource on the AR-first path to shared spatial reality.', 'color:#b8b4ac;');

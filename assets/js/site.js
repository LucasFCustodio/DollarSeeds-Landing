/* DollarSeeds shared behavior: nav, scrolled header state, scroll reveals.
   Vanilla JS only. Reveals are once-only and respect prefers-reduced-motion. */
(function () {
  'use strict';

  var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var header = document.querySelector('.site-header');

  // Mobile menu
  var toggle = document.querySelector('.nav-toggle');
  var menu = document.getElementById('site-menu');
  if (toggle && menu) {
    toggle.addEventListener('click', function () {
      var open = menu.classList.toggle('is-open');
      toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
      if (header) header.classList.toggle('menu-open', open);
    });
    menu.addEventListener('click', function (e) {
      if (e.target.tagName === 'A') {
        menu.classList.remove('is-open');
        toggle.setAttribute('aria-expanded', 'false');
        if (header) header.classList.remove('menu-open');
      }
    });
  }

  // Header gains its ground once the page scrolls (class toggle only)
  if (header) {
    var ticking = false;
    var setState = function () {
      header.classList.toggle('is-scrolled', window.scrollY > 8);
      ticking = false;
    };
    window.addEventListener('scroll', function () {
      if (!ticking) { ticking = true; requestAnimationFrame(setState); }
    }, { passive: true });
    setState();
  }

  // Scroll reveals — trigger once; stagger siblings inside [data-reveal-group]
  var revealed = document.querySelectorAll('[data-reveal]');
  if (!revealed.length) return;
  if (reduceMotion || !('IntersectionObserver' in window)) {
    revealed.forEach(function (el) { el.classList.add('is-visible'); });
    return;
  }
  document.querySelectorAll('[data-reveal-group]').forEach(function (group) {
    var kids = group.querySelectorAll('[data-reveal]');
    for (var i = 0; i < kids.length; i++) {
      kids[i].style.setProperty('--reveal-delay', (i * 70) + 'ms');
    }
  });
  var io = new IntersectionObserver(function (entries) {
    entries.forEach(function (entry) {
      if (entry.isIntersecting) {
        entry.target.classList.add('is-visible');
        io.unobserve(entry.target);
      }
    });
  }, { threshold: 0.12, rootMargin: '0px 0px -32px 0px' });
  revealed.forEach(function (el) { io.observe(el); });
})();

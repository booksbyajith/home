/** Accessible scroll-snap carousel: swipe, arrows, dots, autoplay with pause on hover/focus/hidden tab/reduced motion. */
export function initSlideshow(root: HTMLElement): void {
  const track = root.querySelector<HTMLElement>('[data-track]')!;
  const slides = [...root.querySelectorAll<HTMLElement>('[data-slide]')];
  const dots = [...root.querySelectorAll<HTMLButtonElement>('[data-dot]')];
  const toggle = root.querySelector<HTMLButtonElement>('[data-toggle]')!;
  const interval = Number(root.dataset.interval) || 5000;
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  let index = 0;
  let userPaused = reduced;
  let hover = false;
  let focus = false;
  let timer: number | undefined;

  const setCurrent = (i: number) => {
    index = i;
    root.dataset.index = String(i);
    dots.forEach((d, n) => d.setAttribute('aria-current', n === i ? 'true' : 'false'));
    slides.forEach((s, n) => {
      s.setAttribute('aria-hidden', n === i ? 'false' : 'true');
      s.querySelectorAll<HTMLElement>('a, button').forEach((el) => {
        if (el.getAttribute('aria-hidden') !== 'true') el.tabIndex = n === i ? 0 : -1;
      });
    });
  };

  let programmaticUntil = 0;
  const go = (i: number) => {
    const n = (i + slides.length) % slides.length;
    programmaticUntil = Date.now() + 1200;
    track.scrollTo({ left: slides[n].offsetLeft - track.offsetLeft, behavior: reduced ? 'auto' : 'smooth' });
    setCurrent(n);
  };

  const running = () => !userPaused && !hover && !focus && document.visibilityState === 'visible';
  const schedule = () => {
    window.clearInterval(timer);
    timer = undefined;
    track.setAttribute('aria-live', running() ? 'off' : 'polite');
    if (running()) timer = window.setInterval(() => go(index + 1), interval);
  };

  const updateToggle = () => {
    toggle.textContent = userPaused ? root.dataset.labelPlay! : root.dataset.labelPause!;
    toggle.setAttribute('aria-pressed', String(userPaused));
    root.dataset.playing = String(!userPaused);
  };

  root.querySelector('[data-prev]')!.addEventListener('click', () => go(index - 1));
  root.querySelector('[data-next]')!.addEventListener('click', () => go(index + 1));
  dots.forEach((d, i) => d.addEventListener('click', () => go(i)));
  toggle.addEventListener('click', () => {
    userPaused = !userPaused;
    updateToggle();
    schedule();
  });
  root.addEventListener('mouseenter', () => {
    hover = true;
    schedule();
  });
  root.addEventListener('mouseleave', () => {
    hover = false;
    schedule();
  });
  root.addEventListener('focusin', () => {
    focus = true;
    schedule();
  });
  root.addEventListener('focusout', (e) => {
    if (!root.contains(e.relatedTarget as Node)) {
      focus = false;
      schedule();
    }
  });
  root.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowRight') go(index + 1);
    if (e.key === 'ArrowLeft') go(index - 1);
  });
  document.addEventListener('visibilitychange', schedule);

  let scrollTimer: number | undefined;
  // Only follow the scroll position when the user is swiping, never during programmatic scrolls.
  let userScrollAt = 0;
  for (const ev of ['pointerdown', 'touchstart', 'wheel'] as const)
    track.addEventListener(
      ev,
      () => {
        userScrollAt = Date.now();
        programmaticUntil = 0;
      },
      { passive: true },
    );
  track.addEventListener('scroll', () => {
    if (Date.now() < programmaticUntil || Date.now() - userScrollAt > 3000) return;
    window.clearTimeout(scrollTimer);
    scrollTimer = window.setTimeout(() => {
      const i = Math.round(track.scrollLeft / track.clientWidth);
      if (i !== index && slides[i]) setCurrent(i);
    }, 100);
  });

  setCurrent(0);
  updateToggle();
  schedule();
}

/**
 * Accessible fading carousel: the current book in the centre, its neighbours blurred at the
 * sides. Swipe, arrows, dots, keyboard, and autoplay that runs only while the carousel is on
 * screen and pauses with the pause button, keyboard focus, a hidden tab or reduced motion.
 */
export function initSlideshow(root: HTMLElement): void {
  const track = root.querySelector<HTMLElement>('[data-track]')!;
  const slides = [...root.querySelectorAll<HTMLElement>('[data-slide]')];
  const dots = [...root.querySelectorAll<HTMLButtonElement>('[data-dot]')];
  const toggle = root.querySelector<HTMLButtonElement>('[data-toggle]')!;
  const interval = Number(root.dataset.interval) || 5000;
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const n = slides.length;
  let index = 0;
  let userPaused = reduced;
  let focus = false;
  let onScreen = !('IntersectionObserver' in window);
  let timer: number | undefined;

  const posOf = (s: number, i: number) => {
    if (s === i) return 'center';
    if (n > 1 && s === (i + 1) % n) return 'right';
    if (n > 2 && s === (i - 1 + n) % n) return 'left';
    return 'hidden';
  };

  const setCurrent = (i: number) => {
    index = i;
    root.dataset.index = String(i);
    dots.forEach((d, k) => d.setAttribute('aria-current', k === i ? 'true' : 'false'));
    slides.forEach((s, k) => {
      s.dataset.pos = posOf(k, i);
      s.setAttribute('aria-hidden', k === i ? 'false' : 'true');
      s.querySelectorAll<HTMLElement>('a, button').forEach((el) => {
        if (el.getAttribute('aria-hidden') !== 'true') el.tabIndex = k === i ? 0 : -1;
      });
    });
  };

  const go = (i: number) => setCurrent((i + n) % n);

  const running = () =>
    !userPaused && !focus && onScreen && document.visibilityState === 'visible';
  const schedule = () => {
    window.clearInterval(timer);
    timer = undefined;
    track.setAttribute('aria-live', running() ? 'off' : 'polite');
    if (running()) timer = window.setInterval(() => go(index + 1), interval);
  };
  const restart = () => schedule();

  const updateToggle = () => {
    const label = userPaused ? root.dataset.labelPlay! : root.dataset.labelPause!;
    toggle.setAttribute('aria-label', label);
    toggle.title = label;
    toggle.setAttribute('aria-pressed', String(userPaused));
    root.dataset.playing = String(!userPaused);
  };

  root.querySelector('[data-prev]')!.addEventListener('click', () => {
    go(index - 1);
    restart();
  });
  root.querySelector('[data-next]')!.addEventListener('click', () => {
    go(index + 1);
    restart();
  });
  dots.forEach((d, i) =>
    d.addEventListener('click', () => {
      go(i);
      restart();
    }),
  );
  // A click on a blurred side cover brings that book to the centre instead of leaving the page.
  root.querySelectorAll<HTMLElement>('[data-slide-cover]').forEach((a) =>
    a.addEventListener('click', (e) => {
      const i = Number(a.dataset.slideCover);
      if (i !== index) {
        e.preventDefault();
        go(i);
        restart();
      }
    }),
  );
  toggle.addEventListener('click', () => {
    userPaused = !userPaused;
    updateToggle();
    schedule();
  });
  // Keyboard focus inside the carousel pauses it (so it doesn't move under the user);
  // a mouse click on an arrow or dot does not.
  root.addEventListener('focusin', (e) => {
    if (!(e.target as HTMLElement).matches(':focus-visible')) return;
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

  // Swipe: a horizontal drag of 40px or more moves one book.
  let startX: number | null = null;
  let startY = 0;
  track.addEventListener('pointerdown', (e) => {
    startX = e.clientX;
    startY = e.clientY;
  });
  const end = (e: PointerEvent) => {
    if (startX === null) return;
    const dx = e.clientX - startX;
    const dy = e.clientY - startY;
    startX = null;
    if (Math.abs(dx) >= 40 && Math.abs(dx) > Math.abs(dy)) {
      go(index + (dx < 0 ? 1 : -1));
      restart();
    }
  };
  track.addEventListener('pointerup', end);
  track.addEventListener('pointercancel', () => (startX = null));

  // Autoplay (and the side blur) only while the carousel is on screen.
  root.dataset.visible = String(onScreen);
  if (!onScreen)
    new IntersectionObserver(([e]) => {
      onScreen = e.isIntersecting;
      root.dataset.visible = String(onScreen);
      schedule();
    }).observe(root);

  setCurrent(0);
  updateToggle();
  schedule();
}

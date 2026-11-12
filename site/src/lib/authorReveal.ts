/**
 * Follows the pointer over the hero and uncovers the notes around the author's face.
 * Sets --mx/--my (pointer position inside the portrait) and --near (0 far … 1 on the face).
 */
export function initAuthorReveal(root: HTMLElement): void {
  if (!window.matchMedia('(hover: hover)').matches) return;
  const portrait = root.querySelector<HTMLElement>('.portrait');
  if (!portrait) return;
  const fx = Number(portrait.dataset.faceX) || 0.5;
  const fy = Number(portrait.dataset.faceY) || 0.4;
  const area = root.closest('section') ?? root;
  let frame = 0;
  let last: PointerEvent | null = null;

  const update = () => {
    frame = 0;
    if (!last) return;
    const r = portrait.getBoundingClientRect();
    const x = last.clientX - r.left;
    const y = last.clientY - r.top;
    const d = Math.hypot(x - r.width * fx, y - r.height * fy);
    const near = Math.max(0, Math.min(1, 1 - (d - r.width * 0.12) / (r.width * 0.55)));
    root.style.setProperty('--mx', `${x}px`);
    root.style.setProperty('--my', `${y}px`);
    root.style.setProperty('--near', near.toFixed(3));
    root.dataset.near = String(near > 0.6);
  };

  area.addEventListener('pointermove', (e) => {
    last = e as PointerEvent;
    if (!frame) frame = requestAnimationFrame(update);
  });
  area.addEventListener('pointerleave', () => {
    last = null;
    root.style.setProperty('--near', '0');
    root.dataset.near = 'false';
  });
}

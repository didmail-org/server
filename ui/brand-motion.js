// Motion belongs only to the public welcome artwork; content stays usable.
// Serialized into the home head so SSR cannot paint a mark that then disappears.
export function prepareBrandMotion(doc = document) {
  const root = doc.documentElement;
  const view = doc.defaultView;
  if (root.dataset.didmailBrandEntrance) return;
  const reduced = view.matchMedia('(prefers-reduced-motion: reduce)');
  root.dataset.didmailBrandEntrance = reduced.matches || !view.Element.prototype.animate ? 'static' : 'pending';
  view.setTimeout(() => {
    // A missing/slow enhancement must not leave meaningful artwork hidden.
    if (root.dataset.didmailBrandEntrance === 'pending') root.dataset.didmailBrandEntrance = 'static';
  }, 1000);
}

export function installBrandMotion(doc = document) {
  const emblem = doc.querySelector('.dm-home-emblem');
  if (!emblem || emblem.dataset.brandMotionReady) return;
  emblem.dataset.brandMotionReady = 'true';
  const view = doc.defaultView;
  const root = doc.documentElement;
  const reduced = view.matchMedia('(prefers-reduced-motion: reduce)');
  const bounds = emblem.getBoundingClientRect();
  let inView = bounds.bottom > 0 && bounds.top < view.innerHeight && bounds.right > 0 && bounds.left < view.innerWidth;
  let animation;
  let environment;
  const light = doc.querySelector('.dm-home-light');
  let artworkReady = false;
  let disposed = false;
  const state = (phase) => { emblem.dataset.brandMotion = phase; };
  const synchronize = () => {
    if (disposed) return;
    const covered = [...doc.querySelectorAll('dialog[open], [aria-modal="true"]')].some((dialog) =>
      !dialog.hidden && dialog.getAttribute('aria-hidden') !== 'true' && dialog.getClientRects().length > 0);

    for (const current of [animation, environment]) {
      if (!current) continue;
      if (doc.hidden || !inView || covered) current.pause();
      else if (current.playState === 'paused') current.play();
    }
  };
  const float = () => {
    state('floating');
    animation = emblem.animate([
      { transform: 'translateY(0) scale(1)', opacity: 1, easing: 'ease-in-out' },
      { transform: 'translateY(-24px) scale(1.10)', opacity: 1, offset: 0.5, easing: 'ease-in-out' },
      { transform: 'translateY(0) scale(1)', opacity: 1 },
    ], { duration: 12000, iterations: Infinity, easing: 'linear' });
    animation.id = 'didmail-brand-float';
    synchronize();
  };
  const staticArtwork = () => {
    animation?.cancel();
    environment?.cancel();
    environment = undefined;
    animation = undefined;
    state('static');
    root.dataset.didmailBrandEntrance = 'consumed';
  };
  if (!emblem.animate) { staticArtwork(); return; }
  const startEnvironment = () => {
    if (environment || !light || reduced.matches) return;
    environment = light.animate([
      { transform: 'translate3d(-2%, -1%, 0)', opacity: 0.65 },
      { transform: 'translate3d(3%, 2%, 0)', opacity: 1 },
      { transform: 'translate3d(-2%, -1%, 0)', opacity: 0.65 },
    ], { duration: 24000, iterations: Infinity, easing: 'ease-in-out' });
    environment.id = 'didmail-brand-space';
  };
  const start = () => {
    if (reduced.matches) { staticArtwork(); return; }
    startEnvironment();
    if (root.dataset.didmailBrandEntrance !== 'pending') {
      // A consumed entrance may float without hiding the artwork again.
      float();
      root.dataset.didmailBrandEntrance = 'consumed';
    } else {
      state('entrance');
      const entrance = emblem.animate([
        { transform: 'scale(0.76)', opacity: 0 },
        { transform: 'translateY(0) scale(1)', opacity: 1 },
      ], { duration: 1800, easing: 'cubic-bezier(0.16, 1, 0.3, 1)', fill: 'both' });
      animation = entrance;
      root.dataset.didmailBrandEntrance = 'consumed';
      entrance.id = 'didmail-brand-entrance';
      synchronize();
      entrance.finished.then(() => {
        if (disposed || animation !== entrance || reduced.matches) return;
        // The floating timeline owns the final pose; release the entrance fill.
        float();
        entrance.cancel();
      }).catch(() => { /* Reduced motion can cancel an unfinished entrance. */ });
    }
  };
  const image = emblem.querySelector('img');
  const imageReady = async () => {
    try { await image.decode?.(); } catch { /* A failed image stays static. */ }
    if (disposed) return;
    artworkReady = image.complete && image.naturalWidth > 0;
    if (!artworkReady || root.dataset.didmailBrandEntrance === 'static') staticArtwork();
    else start();
  };
  if (reduced.matches) staticArtwork();
  else state('waiting');
  const loaded = () => { void imageReady(); };
  if (!image) staticArtwork();
  else if (image.complete) void imageReady();
  else {
    image.addEventListener('load', loaded, { once: true });
    image.addEventListener('error', staticArtwork, { once: true });
  }
  const preferenceChanged = () => {
    if (reduced.matches) staticArtwork();
    else if (artworkReady && !animation) { startEnvironment(); float(); } // Never replay an entrance after preference changes.
  };
  if (reduced.addEventListener) reduced.addEventListener('change', preferenceChanged);
  else reduced.addListener(preferenceChanged);
  doc.addEventListener('visibilitychange', synchronize);
  let observer;
  if (view.IntersectionObserver) {
    observer = new view.IntersectionObserver(([entry]) => {
      inView = entry.isIntersecting && entry.intersectionRatio > 0;
      synchronize();
    }, { threshold: [0, 0.01] });
    observer.observe(emblem);
  }
  const overlays = view.MutationObserver ? new view.MutationObserver(synchronize) : undefined;
  overlays?.observe(doc.body, { subtree: true, childList: true, attributes: true, attributeFilter: ['open', 'hidden', 'aria-hidden', 'aria-modal', 'style', 'class'] });
  const leaving = (event) => {
    if (event.persisted) { animation?.pause(); environment?.pause(); return; }
    disposed = true;
    animation?.cancel();
    environment?.cancel();
    observer?.disconnect();
    overlays?.disconnect();
    if (reduced.removeEventListener) reduced.removeEventListener('change', preferenceChanged);
    else reduced.removeListener(preferenceChanged);
    doc.removeEventListener('visibilitychange', synchronize);
    image?.removeEventListener('load', loaded);
    image?.removeEventListener('error', staticArtwork);
    view.removeEventListener('pageshow', synchronize);
    view.removeEventListener('pagehide', leaving);
  };
  view.addEventListener('pagehide', leaving);
  view.addEventListener('pageshow', synchronize);
}

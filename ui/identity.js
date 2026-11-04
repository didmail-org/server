import qrcode from 'qrcode-generator';
import { escapeHtml as e } from './shared.js';

export function installIdentityUI(root, t) {
  const dialog = document.createElement('dialog');
  dialog.className = 'dm-dialog dm-identity-dialog';
  dialog.setAttribute('aria-label', t('DID details'));
  root.append(dialog);
  document.addEventListener('didmail-session-ended', () => { if (dialog.open) dialog.close(); });
  root.addEventListener('click', async (event) => {
    const copy = event.target.closest('[data-did-copy]');
    const show = event.target.closest('[data-did-show]');
    if (!copy && !show) return;
    event.preventDefault();
    event.stopPropagation();
    const raw = copy?.dataset.didCopy || show.dataset.didShow;
    if (copy) {
      try {
        await navigator.clipboard.writeText(raw);
        copy.setAttribute('aria-label', t('DID copied.'));
        copy.title = t('DID copied.');
        const feedback = document.createElement('span');
        feedback.className = 'dm-did-feedback';
        feedback.setAttribute('role', 'status');
        feedback.textContent = t('DID copied.');
        copy.parentElement.querySelector('.dm-did-feedback')?.remove();
        copy.parentElement.append(feedback);
        setTimeout(() => feedback.remove(), 2500);
      } catch {
        openDetails(raw, t('Copy failed. Copy the full DID below manually.'));
      }
      return;
    }
    openDetails(raw);
  });
  function openDetails(raw, error = '') {
    const code = qrcode(0, 'M');
    code.addData(raw);
    code.make();
    dialog.innerHTML = `<div class="dm-row"><h2>${e(t('DID details'))}</h2><button type="button" data-identity-close class="dm-secondary" aria-label="${e(t('Close'))}">×</button></div><div class="dm-identity-qr">${code.createSvgTag({ cellSize: 5, margin: 4, scalable: true })}</div><p class="dm-identity-full" dir="ltr">${e(raw)}</p>${error ? `<p role="alert">${e(error)}</p>` : ''}<button type="button" data-did-copy="${e(raw)}">${e(t('Copy DID'))}</button>`;
    dialog.querySelector('[data-identity-close]').onclick = () => dialog.close();
    if (!dialog.open) dialog.showModal();
  }
}

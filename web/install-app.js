// Installation only: no service worker, offline cache or household data storage.
export function initializeInstallation(win, doc) {
  const triggers = [...doc.querySelectorAll('[data-install-app]')];
  const dialog = doc.querySelector('#install-app-dialog');
  const nativeButton = doc.querySelector('#install-app-native');
  const message = doc.querySelector('#install-app-message');
  const mode = win.matchMedia('(display-mode: standalone)');
  let deferred = null, installed = false, busy = false;
  function refresh() {
    const standalone = installed || mode.matches || win.navigator.standalone === true;
    for (const trigger of triggers) trigger.classList.toggle('hidden', standalone);
    nativeButton.classList.toggle('hidden', standalone || !deferred || !win.isSecureContext);
    nativeButton.disabled = busy;
    if (standalone && dialog.open) dialog.close();
  }
  for (const trigger of triggers) trigger.addEventListener('click', () => {
    const menu = trigger.closest('.mobile-nav details'); if (menu) menu.open = false;
    message.textContent = '';
    refresh();
    if (!dialog.open) dialog.showModal();
  });
  doc.querySelector('#close-install-app').addEventListener('click', () => dialog.close());
  doc.querySelector('#install-app-secure-hint').classList.toggle('hidden', win.isSecureContext);
  win.addEventListener('beforeinstallprompt', event => {
    event.preventDefault(); deferred = event; refresh();
  });
  win.addEventListener('appinstalled', () => { installed = true; deferred = null; refresh(); });
  mode.addEventListener('change', refresh);
  nativeButton.addEventListener('click', async () => {
    if (!deferred || busy || !win.isSecureContext) return;
    const prompt = deferred; deferred = null; busy = true; nativeButton.disabled = true;
    try {
      await prompt.prompt();
      const result = await prompt.userChoice;
      message.textContent = result.outcome === 'accepted'
        ? 'Demande transmise au navigateur. Termine l’installation dans sa fenêtre.'
        : 'Installation annulée. Tu peux continuer à utiliser le site et réessayer depuis le menu du navigateur.';
    } catch {
      message.textContent = 'Le navigateur n’a pas pu ouvrir l’installation. Utilise les instructions ci-dessous.';
    } finally { busy = false; refresh(); }
  });
  refresh();
}

if (typeof window !== 'undefined' && window.document) initializeInstallation(window, window.document);

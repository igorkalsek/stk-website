// These keys are independent of saved races. No installation state is inferred from a UA.
const DISMISSED_UNTIL_KEY = 'stkHomeScreenInviteDismissedUntilV1';
const VISITED_KEY = 'stkHomeScreenInviteVisitedV1';
const SESSION_KEY = 'stkHomeScreenInviteSessionV1';
const DISMISSAL_MS = 90 * 24 * 60 * 60 * 1000;

(() => {
  const ua = navigator.userAgent;
  const embedded = /FBAN|FBAV|Instagram|GSA|; wv\)|\bwv\b/.test(ua);
  const iphone = /iPhone/.test(ua) && /AppleWebKit/.test(ua)
    && /Version\/[\d.]+.*Mobile\/\S+.*Safari\//.test(ua)
    && !/CriOS|FxiOS|EdgiOS|OPiOS|DuckDuckGo/.test(ua) && !embedded;
  // Android browser menus differ. Only an actual event enables the system button.
  const android = /Android/.test(ua) && /Mobile/.test(ua) && !embedded
    && /Chrome\/|Firefox\/|SamsungBrowser\/|EdgA\//.test(ua);
  const standalone = window.matchMedia('(display-mode: standalone)');
  const isStandalone = () => standalone.matches
    || navigator.standalone === true;
  let returningVisit = false;
  let storageReady = false;
  let suppressed = false;
  let pending = null;
  let consumed = false;
  let card = null;
  let installButton = null;

  if ((iphone || android) && !isStandalone()) {
    try {
      // One boolean per browser and per tab session. Reload/navigation preserves
      // the session's eligibility; opening a fresh session after an earlier visit qualifies.
      let session = sessionStorage.getItem(SESSION_KEY);
      if (session === null) {
        session = localStorage.getItem(VISITED_KEY) === '1' ? '1' : '0';
        sessionStorage.setItem(SESSION_KEY, session);
        localStorage.setItem(VISITED_KEY, '1');
      }
      returningVisit = session === '1';
      storageReady = true;
    } catch { /* Without either storage, no invitation. */ }
  }

  const update = () => {
    if (!card) return;
    card.hidden = true;
    if (installButton) installButton.hidden = !android || !pending || consumed;
    if (!(iphone || android) || isStandalone() || !storageReady || !returningVisit || suppressed) return;
    try {
      // Check both stores again, including after a restored page or storage change.
      if (sessionStorage.getItem(SESSION_KEY) !== '1') return;
      const until = Number(localStorage.getItem(DISMISSED_UNTIL_KEY));
      if (Number.isFinite(until) && until > Date.now()) return;
      card.hidden = false;
    } catch { /* Fail closed. */ }
  };
  const suppress = () => {
    suppressed = true;
    pending = null;
    try { localStorage.setItem(DISMISSED_UNTIL_KEY, String(Date.now() + DISMISSAL_MS)); }
    catch { /* Still hidden for this page if persistence becomes unavailable. */ }
    update();
  };

  // Register in the shared layout, even on pages without the invitation. The
  // browser may offer a menu item, but this site never opens its prompt automatically.
  window.addEventListener('beforeinstallprompt', event => {
    event.preventDefault();
    if (android && !isStandalone() && !consumed && !suppressed
      && typeof event.prompt === 'function') {
      pending = event;
      update();
    }
  });
  window.addEventListener('appinstalled', suppress);
  window.addEventListener('pageshow', update);
  window.addEventListener('storage', event => {
    if (event.key === DISMISSED_UNTIL_KEY || event.key === null) update();
  });
  standalone.addEventListener('change', update);

  const connectCard = () => {
    card = document.querySelector('[data-home-screen-invite]');
    if (!card) return;
    card.querySelectorAll('[data-install-platform]').forEach(element => {
      element.hidden = element.dataset.installPlatform !== (android ? 'android' : 'iphone');
    });
    installButton = card.querySelector('[data-install-stk]');
    card.querySelector('[data-dismiss-home-screen-invite]')?.addEventListener('click', suppress);
    installButton?.addEventListener('click', async () => {
      // Capture and consume synchronously in the click handler, before any await.
      // A pending event never bypasses the visibility/dismissal rules.
      update();
      if (!pending || !card || card.hidden || isStandalone() || consumed) return;
      const event = pending;
      pending = null;
      consumed = true;
      if (installButton) installButton.hidden = true;
      try {
        await event.prompt();
        const choice = await event.userChoice;
        if (choice.outcome === 'accepted' || choice.outcome === 'dismissed') {
          // Acceptance suppresses promotion; appinstalled is the confirmation.
          // This expiry is not a persistent claim that the app is installed.
          suppress();
        }
      } catch {
        // A consumed/failed event cannot be retried. Keep the manual instructions.
        update();
      }
    });
    update();
  };
  // The component invokes this immediately after its markup is parsed.
  // The shared head script already captured browser events and visit eligibility.
  window.stkConnectHomeScreenInvite = connectCard;
})();

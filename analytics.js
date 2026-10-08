(() => {
  'use strict';
  const settings = document.currentScript?.dataset;
  if (!settings) return;
  const preferenceKey = 'yuxian.analytics.disabled';
  const systemOptOut = () => navigator.globalPrivacyControl === true || navigator.doNotTrack === '1' || window.doNotTrack === '1';
  let memoryOptOut = false;
  const optedOut = () => {
    try { return memoryOptOut || localStorage.getItem(preferenceKey) === '1' || systemOptOut(); }
    catch { return memoryOptOut || systemOptOut(); }
  };
  const preferenceButton = document.querySelector('[data-analytics-preference]');
  const preferenceStatus = document.querySelector('[data-analytics-status]');
  function updatePreference() {
    if (!preferenceButton || !preferenceStatus) return;
    preferenceButton.disabled = systemOptOut();
    preferenceButton.textContent = optedOut() ? 'Enable audience statistics' : 'Disable audience statistics';
    preferenceStatus.textContent = systemOptOut()
      ? 'Audience statistics are disabled by your browser privacy preference.'
      : optedOut() ? 'Audience statistics are disabled in this browser.' : 'Audience statistics are enabled in this browser.';
  }
  preferenceButton?.addEventListener('click', () => {
    const disable = !optedOut();
    memoryOptOut = disable;
    try {
      if (disable) localStorage.setItem(preferenceKey, '1');
      else localStorage.removeItem(preferenceKey);
    } catch {
      if (preferenceStatus) preferenceStatus.textContent = 'This browser could not save the preference. Use Do Not Track or Global Privacy Control to persist your choice.';
      preferenceButton.disabled = true;
      return;
    }
    location.reload();
  });
  updatePreference();

  if (location.hostname !== settings.hostname || optedOut()) return;
  if (!/^[0-9a-f-]{36}$/i.test(settings.websiteId || '')) return;
  if (settings.trackerSrc !== 'https://cloud.umami.is/script.js') return;

  const observedSections = ['cafe', 'action-models', 'scholar-mcp'];
  const allowedEvents = new Set([
    'engaged-30s', ...observedSections.map(id => `view-${id}`),
    ...Array.from(document.querySelectorAll('[data-analytics-event]'), el => el.dataset.analyticsEvent)
  ]);
  let referrer = '';
  try {
    const source = new URL(document.referrer);
    if (/^https?:$/.test(source.protocol) && source.hostname !== location.hostname) referrer = `${source.protocol}//${source.hostname}/`;
  } catch { /* Empty or non-web referrers are intentionally omitted. */ }

  const dimensions = (width, height) => Number.isFinite(width) && Number.isFinite(height) && width > 0 && height > 0 && width <= 32768 && height <= 32768 ? `${Math.round(width)}x${Math.round(height)}` : undefined;
  let timezone;
  try { timezone = Intl.DateTimeFormat().resolvedOptions().timeZone; } catch { /* Optional browser metadata. */ }

  // Send only a fixed public path and named events, never URL queries, form data or identifiers.
  window.yuxianAnalyticsBeforeSend = (type, payload) => {
    if (type !== 'event' || optedOut() || document.visibilityState !== 'visible') return false;
    if (payload.name && !allowedEvents.has(payload.name)) return false;
    const clean = {
      website: settings.websiteId,
      hostname: settings.hostname,
      url: ['/', '/privacy/', '/cv/'].includes(location.pathname) ? location.pathname : '/404',
      title: document.title,
      language: navigator.language || '',
      referrer
    };
    const screen = dimensions(window.screen?.width, window.screen?.height);
    if (screen) clean.screen = screen;
    // Environment properties are attached to the pageview only, avoiding per-click duplication.
    if (!payload.name) {
      const data = {};
      const viewport = dimensions(window.innerWidth, window.innerHeight);
      if (viewport) data.viewport = viewport;
      if (timezone && /^[A-Za-z0-9_+/-]{1,64}$/.test(timezone)) data.timezone = timezone;
      if (Object.keys(data).length) clean.data = data;
    }
    if (payload.name) clean.name = payload.name;
    return clean;
  };

  const sdk = document.createElement('script');
  sdk.src = settings.trackerSrc;
  sdk.async = true;
  sdk.setAttribute('data-website-id', settings.websiteId);
  sdk.setAttribute('data-auto-track', 'false');
  sdk.setAttribute('data-domains', settings.hostname);
  sdk.setAttribute('data-do-not-track', 'true');
  sdk.setAttribute('data-before-send', 'yuxianAnalyticsBeforeSend');
  sdk.referrerPolicy = 'no-referrer';
  sdk.addEventListener('load', () => {
    let pageSent = false;
    const send = name => {
      if (optedOut() || document.visibilityState !== 'visible' || !window.umami?.track) return;
      try { Promise.resolve(name ? window.umami.track(name) : window.umami.track()).catch(() => {}); }
      catch { /* Analytics must never interrupt the page. */ }
    };
    const sendPage = () => {
      if (pageSent || document.visibilityState !== 'visible' || optedOut()) return;
      pageSent = true;
      send();
    };
    sendPage();
    document.addEventListener('click', event => {
      const target = event.target?.closest?.('[data-analytics-event]');
      if (target && allowedEvents.has(target.dataset.analyticsEvent)) send(target.dataset.analyticsEvent);
    });

    const visible = new Set();
    const seen = new Set();
    const timers = new Map();
    function arm(id) {
      if (seen.has(id) || timers.has(id) || optedOut() || document.visibilityState !== 'visible') return;
      timers.set(id, setTimeout(() => {
        timers.delete(id);
        if (!visible.has(id) || optedOut() || document.visibilityState !== 'visible') return;
        seen.add(id);
        send(`view-${id}`);
      }, 1000));
    }
    if ('IntersectionObserver' in window) {
      const observer = new IntersectionObserver(entries => {
        for (const entry of entries) {
          const id = entry.target.id;
          if (entry.isIntersecting && entry.intersectionRatio >= 0.5) { visible.add(id); arm(id); }
          else { visible.delete(id); clearTimeout(timers.get(id)); timers.delete(id); }
        }
      }, { threshold: 0.5 });
      for (const id of observedSections) { const section = document.getElementById(id); if (section) observer.observe(section); }
    }
    let remaining = 30000;
    let activeSince = 0;
    let engagementTimer;
    function resume() {
      sendPage();
      if (optedOut() || document.visibilityState !== 'visible') return;
      for (const id of visible) arm(id);
      if (remaining <= 0 || engagementTimer) return;
      activeSince = performance.now();
      engagementTimer = setTimeout(() => {
        engagementTimer = undefined;
        remaining = 0;
        send('engaged-30s');
      }, remaining);
    }
    function pause() {
      for (const timer of timers.values()) clearTimeout(timer);
      timers.clear();
      if (engagementTimer) {
        remaining = Math.max(0, remaining - (performance.now() - activeSince));
        clearTimeout(engagementTimer);
        engagementTimer = undefined;
      }
    }
    document.addEventListener('visibilitychange', () => document.visibilityState === 'visible' ? resume() : pause());
    window.addEventListener('pagehide', pause);
    resume();
  });
  document.head.append(sdk);
})();

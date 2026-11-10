/* Kaafi push handlers — loaded by sw.js with importScripts('push-sw.js') */
self.addEventListener('push', function (event) {
  var d = {};
  try { d = event.data ? event.data.json() : {}; } catch (e) { d = { title: 'Kaafi Hospital', body: event.data ? event.data.text() : '' }; }
  var title = d.title || 'Kaafi Hospital';
  var opts = {
    body: d.body || '',
    icon: d.icon || 'icon-192.png',
    badge: d.badge || 'icon-192.png',
    vibrate: [180, 80, 180],          // short buzz on Android
    tag: 'kaafi-' + (d.ts || Date.now()),
    renotify: true,
    silent: false,                    // let the phone play its notification sound
    data: { url: d.url || './' }
  };
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function (cl) {
      cl.forEach(function (c) { c.postMessage({ type: 'kaafi-push', title: title, body: opts.body }); }); // page plays the chime
      return self.registration.showNotification(title, opts);
    })
  );
});

self.addEventListener('notificationclick', function (event) {
  event.notification.close();
  var target = new URL((event.notification.data && event.notification.data.url) || './', self.registration.scope).href;
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function (cl) {
      for (var i = 0; i < cl.length; i++) {
        if (cl[i].url.indexOf(self.registration.scope) === 0 && 'focus' in cl[i]) {
          if ('navigate' in cl[i] && target !== cl[i].url) cl[i].navigate(target);
          return cl[i].focus();
        }
      }
      return self.clients.openWindow(target);
    })
  );
});

// phone rotated the push key / subscription expired → page re-subscribes next time it opens
self.addEventListener('pushsubscriptionchange', function () {});

/* Kaafi Hospital service worker.
   If you already have a sw.js with caching: DON'T replace it — just add the next line at the very top of your file. */
importScripts('push-sw.js');

self.addEventListener('install', function () { self.skipWaiting(); });
self.addEventListener('activate', function (e) { e.waitUntil(self.clients.claim()); });

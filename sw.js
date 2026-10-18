/* Service worker: saves the game's files on the device so it works offline.
   IMPORTANT: change CACHE (e.g. v2, v3...) every time you update any file,
   otherwise phones keep showing the old version. */
const CACHE = "puzzle-garden-v5";
const FILES = [
  "./", "index.html", "css/style.css", "js/levels.js", "js/game.js",
  "manifest.json", "icons/icon-180.png", "icons/icon-192.png", "icons/icon-512.png"
];

// 1. Install: download and store all the game files
self.addEventListener("install", e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(FILES)).then(() => self.skipWaiting()));
});

// 2. Activate: delete caches from older versions
self.addEventListener("activate", e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// 3. Fetch: serve from the saved copy first, fall back to the internet.
//    Google Fonts get saved the first time they load, so they work offline too.
self.addEventListener("fetch", e => {
  if (e.request.method !== "GET") return;
  e.respondWith(
    caches.match(e.request).then(hit => hit || fetch(e.request).then(res => {
      if (e.request.url.includes("fonts.g")) {
        const copy = res.clone();
        caches.open(CACHE).then(c => c.put(e.request, copy));
      }
      return res;
    }).catch(() => caches.match("index.html")))
  );
});

/* Costa Rica en famille : le site reste lisible sans réseau.
   - la page : réseau d'abord (pour avoir la dernière version), sinon la copie gardée ;
   - icônes, photos du dépôt et bibliothèques Firebase : copie gardée d'abord ;
   - les photos de Wikimedia sont gardées au fil de la visite ;
   - la base partagée (Firestore) n'est jamais interceptée : elle a son propre cache. */
var V = "cr-v4";
var IMG = "cr-img";
var CORE = ["./", "./manifest.webmanifest", "./icon-180.png", "./icon-512.png"];

self.addEventListener("install", function (e) {
  e.waitUntil(caches.open(V).then(function (c) { return c.addAll(CORE); }).then(function () { return self.skipWaiting(); }));
});

self.addEventListener("activate", function (e) {
  e.waitUntil(caches.keys().then(function (ks) {
    return Promise.all(ks.filter(function (k) { return k !== V && k !== IMG; }).map(function (k) { return caches.delete(k); }));
  }).then(function () { return self.clients.claim(); }));
});

function cacheFirst(req, name) {
  return caches.open(name).then(function (c) {
    return c.match(req).then(function (hit) {
      if (hit) return hit;
      return fetch(req).then(function (res) {
        if (res && (res.ok || res.type === "opaque")) c.put(req, res.clone());
        return res;
      });
    });
  });
}

self.addEventListener("fetch", function (e) {
  var req = e.request;
  if (req.method !== "GET") return;
  var u = new URL(req.url);

  // la page elle-même
  if (u.origin === location.origin && (req.mode === "navigate" || u.pathname.endsWith("/") || u.pathname.endsWith("/index.html"))) {
    e.respondWith(fetch(req).then(function (res) {
      if (res && res.ok) { var copy = res.clone(); caches.open(V).then(function (c) { c.put("./", copy); }); }
      return res;
    }).catch(function () {
      return caches.open(V).then(function (c) { return c.match("./"); });
    }));
    return;
  }
  // liste des photos copiées : toujours fraîche si possible
  if (u.origin === location.origin && u.pathname.endsWith("/img/ok.json")) {
    e.respondWith(fetch(req).then(function (res) {
      var copy = res.clone(); caches.open(V).then(function (c) { c.put(req, copy); }); return res;
    }).catch(function () { return caches.match(req); }));
    return;
  }
  // photos du dépôt, icônes, manifeste
  if (u.origin === location.origin) { e.respondWith(cacheFirst(req, u.pathname.indexOf("/img/") >= 0 ? IMG : V)); return; }
  // bibliothèques Firebase (versionnées) et polices
  if (u.hostname === "www.gstatic.com" || u.hostname === "fonts.googleapis.com" || u.hostname === "fonts.gstatic.com") { e.respondWith(cacheFirst(req, V)); return; }
  // photos de Wikimedia Commons
  if (u.hostname === "commons.wikimedia.org" || u.hostname === "upload.wikimedia.org") { e.respondWith(cacheFirst(req, IMG)); return; }
  // tout le reste (Firestore, connexion…) passe tel quel
});

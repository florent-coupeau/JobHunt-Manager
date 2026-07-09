/* Petit serveur LOCAL pour tester le site avant sa mise en ligne.
   (Les modules JavaScript ne se chargent pas en double-cliquant sur index.html :
   il faut passer par http://, d'où ce fichier.)
   Lancement : double-clic sur lancer-app.bat, ou `node serveur-dev.js`. */

const http = require("http");
const fs = require("fs");
const path = require("path");

const RACINE = path.join(__dirname, "docs");
const PORT = 8500;

const TYPES = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
};

http.createServer((req, rep) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);
  let fichier = path.normalize(path.join(RACINE, decodeURIComponent(url.pathname)));
  if (!fichier.startsWith(RACINE)) { rep.writeHead(403); return rep.end(); }
  if (url.pathname === "/" || url.pathname === "") fichier = path.join(RACINE, "index.html");

  fs.readFile(fichier, (err, contenu) => {
    if (err) { rep.writeHead(404); return rep.end("Introuvable : " + url.pathname); }
    rep.writeHead(200, {
      "Content-Type": TYPES[path.extname(fichier)] || "application/octet-stream",
      "Cache-Control": "no-store",
    });
    rep.end(contenu);
  });
}).listen(PORT, () => {
  console.log(`Site de test : http://localhost:${PORT}/connexion.html`);
  console.log("(Ferme cette fenêtre pour arrêter.)");
});

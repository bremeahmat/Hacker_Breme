const express = require("express");
const fs = require("fs");
const path = require("path");

const app = express();
app.use(express.json());

const DB_FILE = path.join(__dirname, "bots.json");

// Charge la base de données (fichier JSON simple, un objet par ID de bot)
function loadDB() {
  if (!fs.existsSync(DB_FILE)) return {};
  try {
    return JSON.parse(fs.readFileSync(DB_FILE, "utf-8"));
  } catch {
    return {};
  }
}

function saveDB(db) {
  fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2));
}

// ---- Route qui reçoit le ping de chaque bot toutes les 30s ----
// Corps attendu : { id, prefixe, nom, platform, publicURL }
app.post("/ping", (req, res) => {
  const { id, prefixe, nom, platform, publicURL } = req.body || {};

  if (!id) {
    return res.status(400).json({ error: "Champ 'id' manquant" });
  }

  const db = loadDB();

  const ip =
    (req.headers["x-forwarded-for"] || "").split(",")[0].trim() ||
    req.socket.remoteAddress ||
    "inconnue";

  db[id] = {
    id,
    prefixe: prefixe || "?",
    nom: nom || "Sans nom",
    platform: platform || "inconnue",
    publicURL: publicURL || "",
    ip,
    lastPing: new Date().toISOString(),
  };

  saveDB(db);
  res.json({ ok: true });
});

// ---- Route API JSON brute ----
app.get("/api/list", (req, res) => {
  const db = loadDB();
  res.json(Object.values(db));
});

// ---- Page HTML du dashboard ----
app.get("/list", (req, res) => {
  const db = loadDB();
  const bots = Object.values(db).sort(
    (a, b) => new Date(b.lastPing) - new Date(a.lastPing)
  );

  const now = Date.now();

  const rows = bots
    .map((b) => {
      const diffMs = now - new Date(b.lastPing).getTime();
      const diffMin = Math.floor(diffMs / 60000);
      const isOnline = diffMin < 2;

      const lastPingLabel =
        diffMin < 1
          ? "à l'instant"
          : diffMin < 60
          ? `il y a ${diffMin} min`
          : `il y a ${Math.floor(diffMin / 60)} h`;

      return `
        <tr data-platform="${escapeHtml(b.platform)}" data-search="${escapeHtml(
        (b.nom + " " + b.id + " " + b.platform).toLowerCase()
      )}">
          <td>${escapeHtml(b.id)}</td>
          <td>${escapeHtml(b.nom)}</td>
          <td>${escapeHtml(b.platform)}</td>
          <td>${escapeHtml(b.prefixe)}</td>
          <td><span class="status ${isOnline ? "online" : "offline"}">${
        isOnline ? "● En ligne" : "○ Hors ligne"
      }</span></td>
          <td>${lastPingLabel}</td>
        </tr>`;
    })
    .join("");

  const platforms = [...new Set(bots.map((b) => b.platform))];

  res.send(`<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>Tableau de bord - Bots actifs</title>
<style>
  * { box-sizing: border-box; }
  body {
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    background: #0f172a;
    color: #e2e8f0;
    margin: 0;
    padding: 2rem;
  }
  h1 { margin-bottom: 0.25rem; }
  p.subtitle { color: #94a3b8; margin-top: 0; }
  .controls {
    display: flex;
    gap: 1rem;
    margin: 1.5rem 0;
    flex-wrap: wrap;
  }
  input, select {
    background: #1e293b;
    border: 1px solid #334155;
    color: #e2e8f0;
    padding: 0.6rem 1rem;
    border-radius: 8px;
    font-size: 0.95rem;
  }
  input { flex: 1; min-width: 200px; }
  table {
    width: 100%;
    border-collapse: collapse;
    background: #1e293b;
    border-radius: 12px;
    overflow: hidden;
  }
  th, td {
    padding: 0.8rem 1rem;
    text-align: left;
    border-bottom: 1px solid #334155;
  }
  th {
    background: #172033;
    color: #94a3b8;
    font-size: 0.8rem;
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }
  tr:last-child td { border-bottom: none; }
  tr:hover { background: #24324d; }
  .status.online { color: #4ade80; font-weight: 600; }
  .status.offline { color: #f87171; font-weight: 600; }
  .stats {
    display: flex;
    gap: 1rem;
    margin-bottom: 1.5rem;
  }
  .stat-card {
    background: #1e293b;
    padding: 1rem 1.5rem;
    border-radius: 10px;
    min-width: 140px;
  }
  .stat-card .num { font-size: 1.8rem; font-weight: 700; }
  .stat-card .label { color: #94a3b8; font-size: 0.85rem; }
</style>
</head>
<body>
  <h1>📊 Tableau de bord</h1>
  <p class="subtitle">Liste des bots actifs</p>

  <div class="stats">
    <div class="stat-card">
      <div class="num">${bots.length}</div>
      <div class="label">Bots enregistrés</div>
    </div>
    <div class="stat-card">
      <div class="num">${bots.filter(b => (now - new Date(b.lastPing).getTime()) < 120000).length}</div>
      <div class="label">En ligne maintenant</div>
    </div>
  </div>

  <div class="controls">
    <input id="search" type="text" placeholder="🔍 Rechercher par nom, ID ou plateforme..." oninput="filterTable()" />
    <select id="platformFilter" onchange="filterTable()">
      <option value="">Toutes les plateformes</option>
      ${platforms.map(p => `<option value="${escapeHtml(p)}">${escapeHtml(p)}</option>`).join("")}
    </select>
  </div>

  <table>
    <thead>
      <tr>
        <th>ID</th>
        <th>Nom</th>
        <th>Plateforme</th>
        <th>Préfixe</th>
        <th>Statut</th>
        <th>Dernier ping</th>
      </tr>
    </thead>
    <tbody id="tbody">
      ${rows || `<tr><td colspan="6" style="text-align:center;color:#64748b;padding:2rem;">Aucun bot n'a encore envoyé de ping.</td></tr>`}
    </tbody>
  </table>

<script>
function filterTable() {
  const search = document.getElementById('search').value.toLowerCase();
  const platform = document.getElementById('platformFilter').value;
  const rows = document.querySelectorAll('#tbody tr');
  rows.forEach(row => {
    const matchesSearch = row.dataset.search ? row.dataset.search.includes(search) : true;
    const matchesPlatform = !platform || row.dataset.platform === platform;
    row.style.display = (matchesSearch && matchesPlatform) ? '' : 'none';
  });
}
</script>
</body>
</html>`);
});

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

app.get("/", (req, res) => {
  res.redirect("/list");
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Dashboard lancé sur http://localhost:${PORT}`);
});

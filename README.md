# Vigie

**Un seul superviseur pour tous tes serveurs de dev locaux.**

Tes agents (Claude Code, Codex, Cursor…) relancent sans arrêt le même `npm run dev`. Résultat :
cinq copies de l'app, des ports de repli que personne n'a notés (3001, 3002…), des logs éparpillés
dans des onglets. Vigie lance chaque serveur **une seule fois**. Ensuite, chaque agent, terminal
ou onglet lit le même état en direct : ce qui tourne, sur quel port, sous quel PID, et si le
serveur répond vraiment.

Le superviseur et la CLI sont écrits en Node.js, sans aucune dépendance, et tournent sous **Windows, macOS
et Linux**.

## Ce que ça fait

| | |
|---|---|
| **Supervision** | Chaque serveur tourne dans un shell (`cmd` sous Windows, `$SHELL -lc` ailleurs) avec `PORT`, `VIGIE=1` et `VIGIE_SERVER` dans son environnement. |
| **Santé, pas juste « vivant »** | Sonde TCP sur le port, ou chemin HTTP avec un statut attendu. Un process vivant qui ne sert pas ta route est marqué `unhealthy`. |
| **Reprise après crash** | Redémarrage automatique avec backoff (1 s, 2 s, 4 s…) jusqu'à `maxRestartAttempts`, puis état `failed` avec le dernier code de sortie. |
| **Propriété des ports** | Qui tient le port 3000 ? PID, commande, et si c'est Vigie, un process externe ou un service système. Rien n'est tué sans ta demande (`--takeover`). |
| **Logs persistants** | Scrollback en mémoire + un fichier tournant par serveur dans `~/.config/vigie/logs/`. |
| **Une config éditable à la main** | `~/.config/vigie/config.json`, surveillé : modifie-le, Vigie recharge. |
| **Reprise au redémarrage** | Les serveurs qui tournaient quand Vigie s'est arrêté repartent au lancement suivant. |
| **API loopback** | `127.0.0.1:7744` uniquement, réponses `{ ok, data, error }`. Protégée contre le DNS rebinding et les requêtes cross-origin. |
| **Manuel intégré** | Un manuel d'utilisation complet dans l'app (bouton **Manuel**), en français et en anglais. |
| **Terminal en un clic** | Le bouton **Terminal** ouvre Windows Terminal ou PowerShell (Terminal sur macOS, l'émulateur par défaut sous Linux) dans le dossier du serveur. |
| **Logo des projets** | Vigie détecte le logo du projet (`app/icon.png`, `public/favicon.svg`, `public/logo.png`…) et l'affiche à la place de l'initiale. |
| **Français et anglais** | L'app et le menu de l'icône suivent la langue du système, ou celle choisie en bas de la barre latérale. |
| **Mises à jour automatiques** | L'app installée vérifie les releases GitHub au démarrage puis toutes les 4 h, télécharge la nouvelle version en arrière-plan et propose de redémarrer. Les serveurs qui tournaient repartent après la mise à jour. |

## Démarrer

### Avec l'installateur (sans Node)

1. Lance `Vigie-Setup-0.1.2.exe`, puis ouvre Vigie. L'icône apparaît dans la zone de notification.
2. Clic droit sur l'icône → **Install command-line tool**. Vigie écrit un petit lanceur
   `vigie.cmd` (et `vigie` pour Git Bash) dans `%LOCALAPPDATA%\Vigie\bin` et ajoute ce dossier
   à ton PATH utilisateur. Rien n'est modifié avant ce clic.
3. Clic droit → **Install agent skill** pour que Claude Code, Codex et Cursor sachent s'en servir.
4. Ouvre un **nouveau** terminal (ou redémarre ton éditeur / ton agent) : `vigie status --json`.

Le lanceur exécute la CLI embarquée dans l'app (`Vigie.exe` en mode Node,
`ELECTRON_RUN_AS_NODE=1`) : pas besoin d'installer Node ni de faire `npm link`. Si aucun
superviseur ne répond, la CLI démarre l'app elle-même, cachée dans la zone de notification :
il n'y a toujours qu'un seul superviseur, et ce que font les agents (`vigie start`, `vigie stop`)
s'affiche dans la fenêtre. Après une mise à jour ou un déplacement de l'app, le lanceur est
réécrit au démarrage suivant. **Uninstall command-line tool** (même menu) retire le lanceur et
l'entrée du PATH.

Sous macOS et Linux, le même menu crée `~/.config/vigie/bin/vigie` et un lien symbolique
`~/.local/bin/vigie` (ce dossier doit être dans ton PATH). Avec l'AppImage, le lanceur exécute le
fichier `.AppImage` lui-même (son point de montage change à chaque lancement), via
`~/.config/vigie/bin/vigie-appimage.mjs` : il fonctionne donc aussi quand l'app est fermée, tant que
le fichier `.AppImage` reste à sa place.

### Depuis les sources

```bash
cd vigie
npm install          # installe Electron (seulement pour l'app desktop)
npm run app          # lance l'app desktop
```

L'app ouvre une fenêtre et ajoute une icône dans la zone de notification. Fermer la fenêtre garde
les serveurs actifs. **Quitter** depuis l'icône arrête tout.

Sans l'app, la CLI seule suffit (aucune dépendance nécessaire) :

```bash
npm link             # rend la commande `vigie` disponible partout
vigie open           # démarre le daemon et ouvre l'interface dans le navigateur
```

### Créer l'installateur Windows

```bash
npm run dist         # produit dist/Vigie-Setup-<version>.exe et dist/latest.yml
```

## La CLI (pour toi et pour tes agents)

```bash
vigie register --port 3000          # dans le dossier d'un projet : devine la commande depuis package.json
vigie start                         # démarre le serveur du dossier courant
vigie status --json                 # tout l'état, en JSON
vigie resolve --json                # le serveur enregistré pour ce dossier
vigie port 3000                     # qui occupe ce port ?
vigie ports                         # tous les ports en écoute, groupés par propriétaire
vigie logs dev -f                   # suivre les logs en direct
vigie start web --takeover          # arrêter le process externe qui tient le port, puis démarrer
vigie stop-all
vigie startup enable                # lancer le daemon à l'ouverture de session (sans l'app)
```

Un serveur se désigne par son id, `projet/serveur`, `:3000` ou un nom unique.

## Le skill pour les agents

```bash
vigie skill install                 # ou, depuis l'app : menu de l'icône → Install agent skill
```

Ça copie [`skill/SKILL.md`](skill/SKILL.md) dans `~/.agents/skills/vigie`, et dans
`~/.claude/skills/vigie` si Claude Code est installé. Le skill apprend une seule règle aux
agents : **lire l'état avant de lancer quoi que ce soit**.

## Config

```json
{
  "apiPort": 7744,
  "projects": [
    {
      "name": "mon-app",
      "root": "C:\\Users\\moi\\code\\mon-app",
      "servers": [
        {
          "name": "dev",
          "command": "pnpm dev --port 5173 --strictPort",
          "port": 5173,
          "autostart": false,
          "maxRestartAttempts": 5,
          "health": { "type": "http", "path": "/", "expectedStatus": 200, "intervalSeconds": 10 }
        }
      ]
    }
  ]
}
```

Pour Vite et les outils similaires, garde `--port <n> --strictPort` dans la commande : ils
ignorent la variable `PORT` et basculeraient sinon en silence sur un autre port.

## Architecture

```
bin/vigie.js         point d'entrée CLI
src/daemon.js        démarre le superviseur + l'API, surveille config.json
src/supervisor.js    cycle de vie des serveurs, santé, crashs, conflits de port
src/platform.js      ports et process par OS (netstat/CIM sous Windows, lsof/ss/ps ailleurs)
src/api.js           API HTTP loopback + flux temps réel (SSE) + fichiers de l'interface
src/cli.js           commandes, sortie humaine ou --json
src/skill.js         installation du skill (partagée par la CLI et l'app)
ui/                  l'interface (HTML/CSS/JS sans build), rendu ANSI des logs
desktop/main.js      app Electron : fenêtre + menu de la zone de notification
desktop/cli-tool.js  « Install command-line tool » : lanceur `vigie` + PATH
skill/SKILL.md       le skill pour les agents
website/             la landing page (Next.js 16 + Tailwind v4)
scripts/dev-daemon.js daemon de test isolé (port 7755, config dans .dev-home/)
```

## Le site

La landing page est en ligne sur **https://vigie.lyrad.dev**. C'est un projet Next.js indépendant dans
[`website/`](website/), entièrement statique, déployé sur Vercel à chaque push sur `main` :

```bash
cd website
npm install
npm run dev          # http://localhost:3000
npm run build        # build de production
```

Les liens du site (dépôt, téléchargement, skill) sont dans [`website/src/lib/site.ts`](website/src/lib/site.ts)
et pointent vers `github.com/lyrad9/vigie`. Le bouton « Télécharger » ouvre `releases/latest` : publie
l'installateur `.exe` dans une release GitHub pour qu'il fonctionne.

## Thème

L'app et le site partagent le thème **Modern Minimal** de [tweakcn](https://tweakcn.com), en mode
clair et sombre. L'app suit le système par défaut ; le bouton « Theme » de la barre latérale
force Clair ou Sombre. Les couleurs d'état (vert, ambre, rouge) sont propres à Vigie.

L'app desktop héberge le superviseur dans son propre process. Si un daemon lancé par la CLI
tourne déjà, elle s'y connecte au lieu d'en démarrer un second, et reprend la main s'il
s'arrête. Lancée via le lanceur de l'app, la CLI démarre l'app (`Vigie.exe --hidden`) plutôt
qu'un daemon séparé.

## Contribuer : branches et CI

```
votre-branche ──PR──▶ dev ──PR──▶ main ──tag vX.Y.Z──▶ release GitHub
```

1. Créez une branche depuis `dev` et poussez-la : une pull request vers `dev` s'ouvre toute seule.
2. Quand la CI est verte, mergez dans `dev`. Une fois la CI verte sur `dev`, la pull request
   `dev → main` s'ouvre (ou se met à jour) avec la liste des commits à livrer.
3. Merger dans `main` redéploie https://vigie.lyrad.dev. Pour publier l'app, créez un tag
   `vX.Y.Z` (identique à la version de `package.json`) : le workflow Release construit l'installateur, publie aussi `latest.yml` (lu par les apps installées pour se mettre à jour)
   et publie la release.

`main` et `dev` n'acceptent que des pull requests dont la vérification **CI** est verte. Elle regroupe :

| Job | Ce qu'il vérifie |
|---|---|
| Core | Syntaxe de tous les fichiers, tests unitaires et test de bout en bout du daemon, sur Linux (Node 20, 22, 24) et Windows |
| Website | Lint, types et build de production du site |
| Windows installer | Construction de l'installateur à chaque push sur `dev` et `main` (téléchargeable en artefact) |

En local : `npm run check && npm test`, et dans `website/` : `npm run lint && npm run typecheck && npm run build`.

## Limites connues

- Pas de vrai pseudo-terminal (PTY) : certains outils désactivent leurs couleurs hors TTY
  (`FORCE_COLOR=1` est défini pour limiter ça). Les invites interactives ne sont pas supportées.
- Sous Windows, l'arrêt est forcé (`taskkill /T /F`) : les process console ne reçoivent pas de
  signal d'arrêt propre.
- L'installateur n'est pas signé : Windows SmartScreen affichera un avertissement au premier lancement.

// The user manual shown in the app (Manual / Manuel). Same chapters, same ids, in both languages.
// Plain HTML written by hand: no user data is ever interpolated here.

const en = [
  {
    id: 'overview',
    title: 'What Vigie does',
    html: `
<p class="lead">Vigie is a supervisor for the servers you run while you develop: <code>npm run dev</code>, <code>pnpm dev</code>, <code>vite</code>, <code>next dev</code>, a Django or Rails server, a backend watcher. It starts each of them <strong>once</strong>, keeps an eye on them, and gives everyone the same answer to one question: <em>what is running right now, and where?</em></p>
<h3>The problem it solves</h3>
<p>When you work with AI agents (Claude Code, Codex, Cursor…), each of them tends to start the dev server it needs. Add your own terminal and an editor tab, and you quickly end up with:</p>
<ul>
  <li>several copies of the same app, eating memory and CPU;</li>
  <li>ports that change silently (3000 is taken, so the next copy takes 3001, then 3002…), and links that point to the wrong copy;</li>
  <li>logs scattered across terminals you can no longer find.</li>
</ul>
<h3>How Vigie works</h3>
<ol>
  <li>You register a project once: its folder, the command that starts it, and its port.</li>
  <li>Vigie starts the server, captures its output and checks that it really answers on its port.</li>
  <li>The window, the tray menu, the <code>vigie</code> command and your agents all read that same state. Before starting anything, an agent asks Vigie, finds the server already running on <code>localhost:3000</code>, and uses it.</li>
</ol>
<aside class="note"><strong>Local only.</strong> Vigie runs on your machine and talks only to it (<code>127.0.0.1</code>). No account, no telemetry, nothing leaves your computer.</aside>`,
  },
  {
    id: 'start',
    title: 'Getting started',
    html: `
<h3>1. Open Vigie</h3>
<p>Start <strong>Vigie</strong> from the Start menu. Two things appear: this window, and a small blue icon in the notification area, next to the clock. On Windows 11 it may be hidden behind the <kbd>^</kbd> arrow: drag it onto the taskbar to keep it in view.</p>
<h3>2. Add a project</h3>
<ol>
  <li>Click <strong>Add project</strong> at the bottom of the sidebar.</li>
  <li>In <strong>Folder</strong>, paste the path of your project, for example <code>D:\\Code\\my-app</code>. Vigie reads its <code>package.json</code> and fills in the rest: the name, the package manager, the framework, the command and the usual port.</li>
  <li>Check the <strong>Command</strong> and the <strong>Port</strong>. For Next.js, Vigie proposes <code>pnpm dev -p 3000</code>; for Vite, <code>npm run dev -- --port 5173 --strictPort</code>. The port is written into the command on purpose: the server can never move to another port without telling you.</li>
  <li>Click <strong>Add project</strong>.</li>
</ol>
<h3>3. Start it</h3>
<p>The new server opens in the main panel. Click <strong>Start</strong>. The dot turns amber (<em>Starting</em>), then green (<em>Running</em>) once the server answers on its port. Click <strong>Open</strong> to view it in your browser.</p>
<aside class="note"><strong>From now on</strong>, don't type <code>npm run dev</code> yourself for this project: start it from Vigie, or let your agents ask Vigie. That is the whole point.</aside>`,
  },
  {
    id: 'server',
    title: 'The server screen',
    html: `
<p>Click a server in the sidebar to open its screen. It has three parts.</p>
<h3>The actions, top right</h3>
<table>
  <tr><th>Button</th><th>What it does</th></tr>
  <tr><td><strong>Terminal</strong></td><td>Opens your system terminal (Windows Terminal or PowerShell) directly in the server's folder.</td></tr>
  <tr><td><strong>Open</strong></td><td>Opens <code>http://localhost:&lt;port&gt;</code> in your browser. Available while the server runs.</td></tr>
  <tr><td><strong>Edit</strong></td><td>Changes the command, port, folder, health check, environment variables…</td></tr>
  <tr><td><strong>Restart</strong></td><td>Stops then starts the server again, on the same port.</td></tr>
  <tr><td><strong>Start / Stop</strong></td><td>Starts or stops the server. A server you stop is never restarted on its own.</td></tr>
</table>
<h3>The status strip</h3>
<ul>
  <li><strong>Status</strong>: the server's state (see below).</li>
  <li><strong>PID</strong>: the number Windows gives the process. It changes at every start.</li>
  <li><strong>Port</strong>: the port the server must listen on.</li>
  <li><strong>Uptime</strong>: how long it has been running since its last start.</li>
  <li><strong>Restarts</strong>: how many times Vigie had to restart it after a crash, out of the allowed maximum (5 by default). The counter starts again from zero when Vigie starts.</li>
  <li><strong>Health</strong>: how Vigie checks that the server answers (<em>TCP</em>, <em>HTTP /path</em> or <em>Off</em>), with ✓ when the last check passed.</li>
</ul>
<h3>The states</h3>
<table>
  <tr><th>State</th><th>Meaning</th></tr>
  <tr><td><span class="st running"></span>Running</td><td>The process runs and answers on its port.</td></tr>
  <tr><td><span class="st starting"></span>Starting</td><td>The process runs; Vigie waits for the port to answer (up to 90 seconds by default).</td></tr>
  <tr><td><span class="st starting"></span>Restarting</td><td>The server stopped without being asked to; Vigie restarts it after a short delay.</td></tr>
  <tr><td><span class="st unhealthy"></span>Unhealthy</td><td>The process is alive but no longer answers its health check.</td></tr>
  <tr><td><span class="st failed"></span>Failed</td><td>Vigie gave up after too many crashes. The last error is shown in red.</td></tr>
  <tr><td><span class="st stopped"></span>Stopped</td><td>Not running.</td></tr>
</table>
<h3>The output</h3>
<p>The dark panel shows exactly what the command prints, live, with its colors, as if you ran it in a terminal. Lines starting with <code>[vigie]</code> are written by Vigie itself (start, crash, restart).</p>
<ul>
  <li><strong>Follow</strong> keeps the view at the bottom as new lines arrive. Scroll up to read: Follow turns off; scroll back down and it turns on again.</li>
  <li><strong>Clear</strong> empties this view. The log file on disk keeps everything.</li>
</ul>`,
  },
  {
    id: 'projects',
    title: 'Projects and servers',
    html: `
<p>A <strong>project</strong> is a folder. A project contains one or more <strong>servers</strong>: the commands that must run while you work on it.</p>
<h3>Several servers in one project</h3>
<p>Many projects need more than one process. For a Next.js site with a Convex backend, for example:</p>
<table>
  <tr><th>Server</th><th>Command</th><th>Port</th></tr>
  <tr><td>dev</td><td><code>pnpm dev -p 3000</code></td><td>3000</td></tr>
  <tr><td>convex</td><td><code>npx convex dev</code></td><td>none</td></tr>
</table>
<p>To add one, hover the project name in the sidebar and click <strong>+</strong>. A server without a port is fine: leave Port empty and set Health check to <em>None</em>. Vigie then considers it running as long as its process is alive.</p>
<h3>Editing a server</h3>
<ul>
  <li><strong>Command</strong>: what Vigie runs, in <code>cmd</code> on Windows and in your shell elsewhere. Vigie also sets <code>PORT</code>, <code>VIGIE=1</code> and <code>VIGIE_SERVER</code> in its environment.</li>
  <li><strong>Working directory</strong>: a sub-folder, relative to the project (for example <code>apps/web</code> in a monorepo). Empty means the project folder.</li>
  <li><strong>Environment</strong>: one <code>KEY=value</code> per line, added to the server's environment.</li>
  <li><strong>Max restarts</strong>: how many times Vigie restarts the server after a crash before marking it Failed.</li>
  <li><strong>Start when Vigie starts</strong>: starts this server every time Vigie opens, even if it was stopped when you quit.</li>
</ul>
<p>A new command applies at the next start: click <strong>Restart</strong> after saving.</p>
<h3>The project icon</h3>
<p>Vigie looks for your project's own logo in the usual places (<code>app/icon.png</code>, <code>public/favicon.svg</code>, <code>public/logo.png</code>, <code>static/favicon.png</code>…) and shows it in the sidebar. If it finds none, it shows the project's initial on its color. To always use the letter, open <strong>Edit project</strong> (the <strong>···</strong> button next to the name) and pick <em>Letter and color</em>.</p>
<h3>Removing</h3>
<p><strong>Remove server</strong> and <strong>Remove project</strong> stop the servers and remove them from Vigie. Your files are never touched.</p>`,
  },
  {
    id: 'health',
    title: 'Health and automatic restarts',
    html: `
<h3>Health checks</h3>
<p>A process can be alive and still useless: stuck, crashed inside, listening nowhere. So Vigie checks that the server <em>answers</em>:</p>
<ul>
  <li><strong>TCP port</strong> (default): Vigie connects to the port every 10 seconds.</li>
  <li><strong>HTTP path</strong>: Vigie requests a path (for example <code>/api/health</code>) and expects status 200. Use it when “the port is open” is not enough.</li>
  <li><strong>None</strong>: no check, for servers without a port.</li>
</ul>
<p>After a start, Vigie waits up to 90 seconds for the first successful check: large projects can take a while to compile. If a running server fails 3 checks in a row, Vigie restarts it.</p>
<h3>When a server crashes</h3>
<p>If a server stops without you asking, Vigie restarts it after 1 second. If it crashes again, Vigie waits longer each time: 2 s, 4 s, 8 s… After the maximum number of restarts (5 by default), it stops trying and marks the server <strong>Failed</strong>, with the last error. It never loops forever on a broken server.</p>
<aside class="note"><strong>When it says Failed</strong>, read the last lines of the output: the cause is almost always there (a syntax error, a missing dependency, a port taken by another program). Fix it, then click <strong>Start</strong>.</aside>`,
  },
  {
    id: 'ports',
    title: 'Ports and conflicts',
    html: `
<h3>The Ports screen</h3>
<p>Click <strong>Ports</strong> in the sidebar to see every port listening on your machine, grouped by owner:</p>
<ul>
  <li><strong>Managed</strong>: started by Vigie, under one of your projects.</li>
  <li><strong>External</strong>: started outside Vigie (a terminal, another app, a forgotten <code>npm run dev</code>). You can stop it from here; Vigie always asks first.</li>
  <li><strong>Protected</strong>: system services. Read only: Vigie will never stop them.</li>
</ul>
<p>Some servers open extra ports for their own use. Next.js, for instance, listens on its port and on one or two random loopback ports. Vigie lists them under the server as <em>internal ports</em>: they are not a second copy.</p>
<h3>When the port is already taken</h3>
<p>Vigie never moves a server to another port behind your back. If you start a server and its port is held by a program Vigie did not start, the screen shows <strong>Running outside Vigie</strong>, with the program's name and PID, and two choices:</p>
<ul>
  <li><strong>Stop process</strong>: stops that program only (after confirmation).</li>
  <li><strong>Move to Vigie</strong>: stops it and starts your server under Vigie in one go.</li>
</ul>
<p>From the command line, the same takeover is <code>vigie start &lt;server&gt; --takeover</code>.</p>
<aside class="note"><strong>Vite and similar tools</strong> ignore the <code>PORT</code> variable and quietly pick the next free port. Keep <code>--port &lt;n&gt; --strictPort</code> in their command so they fail loudly instead.</aside>`,
  },
  {
    id: 'lifecycle',
    title: 'Closing, quitting, starting with Windows',
    html: `
<p>Closing and quitting are two different things in Vigie.</p>
<table>
  <tr><th>You do</th><th>What happens to your servers</th></tr>
  <tr><td>Close the window (<kbd>×</kbd>)</td><td>Nothing. Vigie keeps running in the notification area, and so do your servers. Click the icon to bring the window back.</td></tr>
  <tr><td>Tray icon → <strong>Stop all</strong></td><td>Every server stops. Vigie remembers that nothing runs.</td></tr>
  <tr><td>Tray icon → <strong>Quit Vigie</strong></td><td>Every server stops and Vigie closes. It remembers which servers were running.</td></tr>
  <tr><td>Open Vigie again</td><td>The servers that were running when you quit start again on their own.</td></tr>
</table>
<h3>The tray menu</h3>
<p>Right-click the icon near the clock. The menu lists every server with its state, and for each one: Start or Stop, Restart, Open in browser, Open terminal, Show logs. Below: Open Vigie, Ports, Manual, Stop all, and the settings.</p>
<h3>Start with Windows</h3>
<p>Tray icon → check <strong>Launch at login</strong>. Vigie then starts hidden in the notification area when you sign in, and restarts the servers that were running. Turn your computer on, and your project is already on <code>localhost:3000</code>.</p>`,
  },
  {
    id: 'terminal',
    title: 'Opening a terminal',
    html: `
<p>Need to run a command in a project (install a package, run the tests, use git)? Click <strong>Terminal</strong> on a server's screen. Vigie opens your system terminal already placed in the right folder:</p>
<ul>
  <li><strong>Windows</strong>: Windows Terminal when it is installed, otherwise PowerShell.</li>
  <li><strong>macOS</strong>: Terminal.</li>
  <li><strong>Linux</strong>: your default terminal emulator (GNOME Terminal, Konsole, xfce4-terminal…).</li>
</ul>
<p>The terminal opens in the server's working directory if it has one, otherwise in the project folder. It is an ordinary terminal: closing it never affects the servers Vigie runs.</p>
<aside class="note"><strong>Don't start the dev server in that terminal.</strong> It already runs in Vigie: use <code>vigie logs dev -f</code> to follow its output there instead.</aside>`,
  },
  {
    id: 'cli',
    title: 'The vigie command',
    html: `
<p>Everything the window does is also available from a terminal, which is what your agents use.</p>
<h3>Install it</h3>
<p>Tray icon → <strong>Install command-line tool</strong>. Vigie adds the <code>vigie</code> command to your user PATH. Open a <strong>new</strong> terminal (or restart your editor) and type <code>vigie status</code>. Node.js is not needed: the command runs on the app itself.</p>
<h3>Everyday commands</h3>
<table>
  <tr><th>Command</th><th>What it does</th></tr>
  <tr><td><code>vigie status</code></td><td>Every project and server, with state, port, PID and uptime.</td></tr>
  <tr><td><code>vigie start</code> / <code>stop</code> / <code>restart</code></td><td>Acts on the server of the current folder, or on the one you name: <code>vigie start convex</code>.</td></tr>
  <tr><td><code>vigie logs dev -f</code></td><td>Follows a server's output live. <kbd>Ctrl</kbd>+<kbd>C</kbd> stops following, not the server.</td></tr>
  <tr><td><code>vigie port 3000</code></td><td>Who holds this port: Vigie, another program or the system.</td></tr>
  <tr><td><code>vigie ports</code></td><td>Every listening port, grouped by owner.</td></tr>
  <tr><td><code>vigie register --port 3000</code></td><td>Registers the project of the current folder, guessing the command from <code>package.json</code>.</td></tr>
  <tr><td><code>vigie stop-all</code></td><td>Stops every server.</td></tr>
  <tr><td><code>vigie shutdown</code></td><td>Stops every server and quits Vigie.</td></tr>
</table>
<p>A server can be named by its name (<code>dev</code>), <code>project/server</code> (<code>my-app/dev</code>) or its port (<code>:3000</code>). Add <code>--json</code> to any command for machine-readable output.</p>`,
  },
  {
    id: 'agents',
    title: 'Working with AI agents',
    html: `
<p>Vigie is built for the way you code with agents. Install the skill once, and Claude Code, Codex or Cursor learn one rule: <strong>ask Vigie before starting a server</strong>.</p>
<h3>Install the skill</h3>
<p>Tray icon → <strong>Install agent skill</strong> (or <code>vigie skill install</code>). The skill is copied to <code>~/.agents/skills/vigie</code>, and to <code>~/.claude/skills/vigie</code> when Claude Code is installed. Also install the command-line tool: the skill uses it. Then start a <strong>new</strong> agent session.</p>
<h3>What changes</h3>
<p>Ask your agent to “open the site” or “run the dev server”. Instead of typing <code>pnpm dev</code>, it runs <code>vigie status --json</code>, sees the server already running and healthy, and answers with <code>localhost:3000</code>. If the server is stopped, it starts it through Vigie, so the start shows up in this window. If the port is held by another program, it tells you instead of killing anything.</p>
<aside class="note"><strong>The same state for everyone.</strong> Five agents asking at the same time get the same answer, and a single process keeps running.</aside>`,
  },
  {
    id: 'config',
    title: 'Settings and files',
    html: `
<h3>Theme and language</h3>
<p>At the bottom of the sidebar: <strong>Theme</strong> (System, Light, Dark) and <strong>Language</strong> (Auto, English, Français). Auto follows your system's language; the choice also applies to the tray menu.</p>
<h3>Where Vigie keeps its files</h3>
<table>
  <tr><th>File</th><th>Content</th></tr>
  <tr><td><code>~/.config/vigie/config.json</code></td><td>Your projects and servers. You can edit it by hand: Vigie reloads it as soon as you save.</td></tr>
  <tr><td><code>~/.config/vigie/logs/</code></td><td>One log file per server, kept between restarts.</td></tr>
  <tr><td><code>~/.config/vigie/state.json</code></td><td>The servers that were running when Vigie last stopped.</td></tr>
  <tr><td><code>~/.config/vigie/daemon.log</code></td><td>Vigie's own journal: starts, stops, configuration reloads.</td></tr>
</table>
<p>On Windows, <code>~</code> is your user folder, for example <code>C:\\Users\\you</code>.</p>
<h3>The local API</h3>
<p>The window, the command and the agents talk to Vigie through an API on <code>http://127.0.0.1:7744</code>. It only accepts requests from your own machine and refuses requests coming from websites.</p>`,
  },
  {
    id: 'troubleshooting',
    title: 'Troubleshooting',
    html: `
<h3>The server stays on Starting, then turns Unhealthy</h3>
<p>The process runs but nothing answers on its port. The usual cause: the command does not use that port. Check that the port in the command matches the <strong>Port</strong> field (<code>-p 3000</code> for Next.js, <code>--port 5173 --strictPort</code> for Vite).</p>
<h3>Failed after a few seconds</h3>
<p>Read the end of the output. Common causes: dependencies not installed (open a <strong>Terminal</strong> and run <code>npm install</code>), a syntax error, a missing <code>.env</code> file.</p>
<h3>“Running outside Vigie”</h3>
<p>Another program already holds the port, often a <code>npm run dev</code> started in a terminal. Choose <strong>Move to Vigie</strong>, or close that terminal yourself.</p>
<h3><code>vigie: command not found</code></h3>
<p>Tray icon → <strong>Install command-line tool</strong>, then open a <em>new</em> terminal: terminals opened before the installation don't see the new PATH.</p>
<h3>The icon has disappeared from the notification area</h3>
<p>Vigie was quit. Open it again from the Start menu: your servers come back.</p>
<h3>The first page takes minutes to load</h3>
<p>That's the framework compiling, not Vigie. If the output says <em>Slow filesystem detected</em>, your project sits on a slow drive; the next pages are much faster.</p>
<h3>Windows SmartScreen warns at installation</h3>
<p>The installer is not signed yet. Click <strong>More info</strong>, then <strong>Run anyway</strong>.</p>`,
  },
];

const fr = [
  {
    id: 'overview',
    title: 'Ce que fait Vigie',
    html: `
<p class="lead">Vigie supervise les serveurs que vous lancez pendant que vous développez : <code>npm run dev</code>, <code>pnpm dev</code>, <code>vite</code>, <code>next dev</code>, un serveur Django ou Rails, un watcher de backend. Il démarre chacun d’eux <strong>une seule fois</strong>, garde un œil dessus, et donne à tout le monde la même réponse à une seule question : <em>qu’est-ce qui tourne en ce moment, et où ?</em></p>
<h3>Le problème qu’il résout</h3>
<p>Quand vous travaillez avec des agents IA (Claude Code, Codex, Cursor…), chacun a tendance à lancer le serveur de dev dont il a besoin. Ajoutez votre propre terminal et un onglet de l’éditeur, et vous vous retrouvez vite avec :</p>
<ul>
  <li>plusieurs copies de la même app, qui consomment mémoire et processeur ;</li>
  <li>des ports qui changent en silence (3000 est pris, la copie suivante prend 3001, puis 3002…) et des liens qui pointent vers la mauvaise copie ;</li>
  <li>des logs éparpillés dans des terminaux que vous ne retrouvez plus.</li>
</ul>
<h3>Comment Vigie fonctionne</h3>
<ol>
  <li>Vous enregistrez un projet une fois : son dossier, la commande qui le lance et son port.</li>
  <li>Vigie démarre le serveur, capture sa sortie et vérifie qu’il répond vraiment sur son port.</li>
  <li>La fenêtre, le menu de l’icône, la commande <code>vigie</code> et vos agents lisent tous ce même état. Avant de lancer quoi que ce soit, un agent interroge Vigie, voit que le serveur tourne déjà sur <code>localhost:3000</code>, et l’utilise.</li>
</ol>
<aside class="note"><strong>Tout reste en local.</strong> Vigie tourne sur votre machine et ne parle qu’à elle (<code>127.0.0.1</code>). Pas de compte, pas de télémétrie : rien ne quitte votre ordinateur.</aside>`,
  },
  {
    id: 'start',
    title: 'Premiers pas',
    html: `
<h3>1. Ouvrir Vigie</h3>
<p>Lancez <strong>Vigie</strong> depuis le menu Démarrer. Deux choses apparaissent : cette fenêtre, et une petite icône bleue dans la zone de notification, près de l’horloge. Sous Windows 11, elle peut être cachée derrière la flèche <kbd>^</kbd> : faites-la glisser dans la barre des tâches pour la garder visible.</p>
<h3>2. Ajouter un projet</h3>
<ol>
  <li>Cliquez sur <strong>Ajouter un projet</strong>, en bas de la barre latérale.</li>
  <li>Dans <strong>Dossier</strong>, collez le chemin de votre projet, par exemple <code>D:\\Code\\mon-app</code>. Vigie lit son <code>package.json</code> et remplit le reste : le nom, le gestionnaire de paquets, le framework, la commande et le port habituel.</li>
  <li>Vérifiez la <strong>Commande</strong> et le <strong>Port</strong>. Pour Next.js, Vigie propose <code>pnpm dev -p 3000</code> ; pour Vite, <code>npm run dev -- --port 5173 --strictPort</code>. Le port est écrit dans la commande exprès : le serveur ne peut jamais partir sur un autre port sans vous prévenir.</li>
  <li>Cliquez sur <strong>Ajouter un projet</strong>.</li>
</ol>
<h3>3. Le démarrer</h3>
<p>Le nouveau serveur s’ouvre dans le panneau principal. Cliquez sur <strong>Démarrer</strong>. Le point passe à l’orange (<em>Démarrage</em>), puis au vert (<em>En marche</em>) dès que le serveur répond sur son port. Cliquez sur <strong>Ouvrir</strong> pour l’afficher dans votre navigateur.</p>
<aside class="note"><strong>À partir de maintenant</strong>, ne tapez plus <code>npm run dev</code> vous-même pour ce projet : démarrez-le depuis Vigie, ou laissez vos agents interroger Vigie. C’est tout l’intérêt.</aside>`,
  },
  {
    id: 'server',
    title: 'L’écran d’un serveur',
    html: `
<p>Cliquez sur un serveur dans la barre latérale pour ouvrir son écran. Il se compose de trois parties.</p>
<h3>Les actions, en haut à droite</h3>
<table>
  <tr><th>Bouton</th><th>Ce qu’il fait</th></tr>
  <tr><td><strong>Terminal</strong></td><td>Ouvre le terminal de votre système (Windows Terminal ou PowerShell) directement dans le dossier du serveur.</td></tr>
  <tr><td><strong>Ouvrir</strong></td><td>Ouvre <code>http://localhost:&lt;port&gt;</code> dans votre navigateur. Disponible quand le serveur tourne.</td></tr>
  <tr><td><strong>Modifier</strong></td><td>Change la commande, le port, le dossier, la vérification de santé, les variables d’environnement…</td></tr>
  <tr><td><strong>Redémarrer</strong></td><td>Arrête puis relance le serveur, sur le même port.</td></tr>
  <tr><td><strong>Démarrer / Arrêter</strong></td><td>Démarre ou arrête le serveur. Un serveur que vous arrêtez n’est jamais relancé tout seul.</td></tr>
</table>
<h3>La bande d’état</h3>
<ul>
  <li><strong>Statut</strong> : l’état du serveur (voir plus bas).</li>
  <li><strong>PID</strong> : le numéro que Windows donne au process. Il change à chaque démarrage.</li>
  <li><strong>Port</strong> : le port sur lequel le serveur doit écouter.</li>
  <li><strong>En marche depuis</strong> : la durée écoulée depuis son dernier démarrage.</li>
  <li><strong>Relances</strong> : combien de fois Vigie a dû le relancer après un plantage, sur le maximum autorisé (5 par défaut). Le compteur repart de zéro au démarrage de Vigie.</li>
  <li><strong>Santé</strong> : la façon dont Vigie vérifie que le serveur répond (<em>TCP</em>, <em>HTTP /chemin</em> ou <em>Désactivée</em>), avec ✓ quand la dernière vérification a réussi.</li>
</ul>
<h3>Les états</h3>
<table>
  <tr><th>État</th><th>Signification</th></tr>
  <tr><td><span class="st running"></span>En marche</td><td>Le process tourne et répond sur son port.</td></tr>
  <tr><td><span class="st starting"></span>Démarrage</td><td>Le process tourne ; Vigie attend que le port réponde (jusqu’à 90 secondes par défaut).</td></tr>
  <tr><td><span class="st starting"></span>Relance</td><td>Le serveur s’est arrêté sans qu’on le lui demande ; Vigie le relance après un court délai.</td></tr>
  <tr><td><span class="st unhealthy"></span>Ne répond pas</td><td>Le process est vivant mais ne répond plus à sa vérification de santé.</td></tr>
  <tr><td><span class="st failed"></span>En échec</td><td>Vigie a abandonné après trop de plantages. La dernière erreur s’affiche en rouge.</td></tr>
  <tr><td><span class="st stopped"></span>Arrêté</td><td>Le serveur ne tourne pas.</td></tr>
</table>
<h3>La sortie</h3>
<p>Le panneau sombre affiche exactement ce que la commande écrit, en direct et en couleurs, comme si vous la lanciez dans un terminal. Les lignes qui commencent par <code>[vigie]</code> sont écrites par Vigie lui-même (démarrage, plantage, relance).</p>
<ul>
  <li><strong>Suivre</strong> garde l’affichage en bas à mesure que les lignes arrivent. Remontez pour lire : Suivre se désactive ; redescendez tout en bas et il se réactive.</li>
  <li><strong>Effacer</strong> vide cet affichage. Le fichier de logs sur le disque, lui, garde tout.</li>
</ul>`,
  },
  {
    id: 'projects',
    title: 'Projets et serveurs',
    html: `
<p>Un <strong>projet</strong>, c’est un dossier. Un projet contient un ou plusieurs <strong>serveurs</strong> : les commandes qui doivent tourner pendant que vous travaillez dessus.</p>
<h3>Plusieurs serveurs dans un projet</h3>
<p>Beaucoup de projets ont besoin de plus d’un process. Pour un site Next.js avec un backend Convex, par exemple :</p>
<table>
  <tr><th>Serveur</th><th>Commande</th><th>Port</th></tr>
  <tr><td>dev</td><td><code>pnpm dev -p 3000</code></td><td>3000</td></tr>
  <tr><td>convex</td><td><code>npx convex dev</code></td><td>aucun</td></tr>
</table>
<p>Pour en ajouter un, survolez le nom du projet dans la barre latérale et cliquez sur <strong>+</strong>. Un serveur sans port ne pose aucun problème : laissez Port vide et choisissez <em>Aucune</em> comme vérification de santé. Vigie le considère alors en marche tant que son process est vivant.</p>
<h3>Modifier un serveur</h3>
<ul>
  <li><strong>Commande</strong> : ce que Vigie exécute, dans <code>cmd</code> sous Windows et dans votre shell ailleurs. Vigie ajoute aussi <code>PORT</code>, <code>VIGIE=1</code> et <code>VIGIE_SERVER</code> à son environnement.</li>
  <li><strong>Dossier de travail</strong> : un sous-dossier, relatif au projet (par exemple <code>apps/web</code> dans un monorepo). Vide, c’est le dossier du projet.</li>
  <li><strong>Variables d’environnement</strong> : une ligne <code>CLÉ=valeur</code> par variable, ajoutée à l’environnement du serveur.</li>
  <li><strong>Relances max</strong> : combien de fois Vigie relance le serveur après un plantage avant de le marquer En échec.</li>
  <li><strong>Démarrer en même temps que Vigie</strong> : lance ce serveur à chaque ouverture de Vigie, même s’il était arrêté quand vous avez quitté.</li>
</ul>
<p>Une nouvelle commande s’applique au prochain démarrage : cliquez sur <strong>Redémarrer</strong> après avoir enregistré.</p>
<h3>L’icône du projet</h3>
<p>Vigie cherche le logo de votre projet aux endroits habituels (<code>app/icon.png</code>, <code>public/favicon.svg</code>, <code>public/logo.png</code>, <code>static/favicon.png</code>…) et l’affiche dans la barre latérale. S’il n’en trouve pas, il affiche l’initiale du projet sur sa couleur. Pour toujours utiliser la lettre, ouvrez <strong>Modifier le projet</strong> (le bouton <strong>···</strong> à côté du nom) et choisissez <em>Lettre et couleur</em>.</p>
<h3>Retirer</h3>
<p><strong>Retirer le serveur</strong> et <strong>Retirer le projet</strong> arrêtent les serveurs et les retirent de Vigie. Vos fichiers ne sont jamais touchés.</p>`,
  },
  {
    id: 'health',
    title: 'Santé et relances automatiques',
    html: `
<h3>Les vérifications de santé</h3>
<p>Un process peut être vivant et pourtant inutile : bloqué, planté de l’intérieur, à l’écoute nulle part. Vigie vérifie donc que le serveur <em>répond</em> :</p>
<ul>
  <li><strong>Port TCP</strong> (par défaut) : Vigie se connecte au port toutes les 10 secondes.</li>
  <li><strong>Chemin HTTP</strong> : Vigie demande une page (par exemple <code>/api/health</code>) et attend le statut 200. Utile quand « le port est ouvert » ne suffit pas.</li>
  <li><strong>Aucune</strong> : pas de vérification, pour les serveurs sans port.</li>
</ul>
<p>Après un démarrage, Vigie attend jusqu’à 90 secondes la première vérification réussie : les gros projets peuvent mettre du temps à compiler. Si un serveur en marche échoue à 3 vérifications de suite, Vigie le relance.</p>
<h3>Quand un serveur plante</h3>
<p>Si un serveur s’arrête sans que vous l’ayez demandé, Vigie le relance au bout d’une seconde. S’il replante, Vigie attend un peu plus à chaque fois : 2 s, 4 s, 8 s… Au bout du nombre maximum de relances (5 par défaut), il arrête d’insister et marque le serveur <strong>En échec</strong>, avec la dernière erreur. Il ne tourne jamais en boucle sur un serveur cassé.</p>
<aside class="note"><strong>Quand il affiche En échec</strong>, lisez les dernières lignes de la sortie : la cause y est presque toujours (une erreur de syntaxe, une dépendance manquante, un port pris par un autre programme). Corrigez, puis cliquez sur <strong>Démarrer</strong>.</aside>`,
  },
  {
    id: 'ports',
    title: 'Ports et conflits',
    html: `
<h3>L’écran Ports</h3>
<p>Cliquez sur <strong>Ports</strong> dans la barre latérale pour voir tous les ports en écoute sur votre machine, regroupés par propriétaire :</p>
<ul>
  <li><strong>Géré</strong> : lancé par Vigie, dans un de vos projets.</li>
  <li><strong>Externe</strong> : lancé en dehors de Vigie (un terminal, une autre app, un <code>npm run dev</code> oublié). Vous pouvez l’arrêter d’ici ; Vigie vous demande toujours confirmation.</li>
  <li><strong>Protégé</strong> : des services du système. Lecture seule : Vigie ne les arrêtera jamais.</li>
</ul>
<p>Certains serveurs ouvrent des ports supplémentaires pour leur propre usage. Next.js, par exemple, écoute sur son port et sur un ou deux ports locaux pris au hasard. Vigie les range sous le serveur comme <em>ports internes</em> : ce n’est pas une deuxième copie.</p>
<h3>Quand le port est déjà pris</h3>
<p>Vigie ne déplace jamais un serveur sur un autre port dans votre dos. Si vous démarrez un serveur et que son port est tenu par un programme que Vigie n’a pas lancé, l’écran affiche <strong>Lancé en dehors de Vigie</strong>, avec le nom et le PID du programme, et deux choix :</p>
<ul>
  <li><strong>Arrêter le process</strong> : arrête seulement ce programme (après confirmation).</li>
  <li><strong>Reprendre dans Vigie</strong> : l’arrête et démarre votre serveur sous Vigie d’un seul coup.</li>
</ul>
<p>En ligne de commande, la même reprise s’écrit <code>vigie start &lt;serveur&gt; --takeover</code>.</p>
<aside class="note"><strong>Vite et les outils du même genre</strong> ignorent la variable <code>PORT</code> et prennent discrètement le port libre suivant. Gardez <code>--port &lt;n&gt; --strictPort</code> dans leur commande pour qu’ils échouent clairement à la place.</aside>`,
  },
  {
    id: 'lifecycle',
    title: 'Fermer, quitter, démarrer avec Windows',
    html: `
<p>Dans Vigie, fermer et quitter sont deux choses différentes.</p>
<table>
  <tr><th>Vous faites</th><th>Ce qui arrive à vos serveurs</th></tr>
  <tr><td>Fermer la fenêtre (<kbd>×</kbd>)</td><td>Rien. Vigie continue de tourner dans la zone de notification, vos serveurs aussi. Cliquez sur l’icône pour rouvrir la fenêtre.</td></tr>
  <tr><td>Icône → <strong>Tout arrêter</strong></td><td>Tous les serveurs s’arrêtent. Vigie retient que rien ne tourne.</td></tr>
  <tr><td>Icône → <strong>Quitter Vigie</strong></td><td>Tous les serveurs s’arrêtent et Vigie se ferme. Il retient quels serveurs tournaient.</td></tr>
  <tr><td>Rouvrir Vigie</td><td>Les serveurs qui tournaient quand vous avez quitté redémarrent tout seuls.</td></tr>
</table>
<h3>Le menu de l’icône</h3>
<p>Faites un clic droit sur l’icône près de l’horloge. Le menu liste chaque serveur avec son état, et pour chacun : Démarrer ou Arrêter, Redémarrer, Ouvrir dans le navigateur, Ouvrir un terminal, Voir les logs. En dessous : Ouvrir Vigie, Ports, Manuel, Tout arrêter, et les réglages.</p>
<h3>Démarrer avec Windows</h3>
<p>Icône → cochez <strong>Lancer à l’ouverture de session</strong>. Vigie démarre alors caché dans la zone de notification quand vous vous connectez, et relance les serveurs qui tournaient. Allumez votre ordinateur : votre projet est déjà sur <code>localhost:3000</code>.</p>`,
  },
  {
    id: 'terminal',
    title: 'Ouvrir un terminal',
    html: `
<p>Besoin de lancer une commande dans un projet (installer un paquet, lancer les tests, utiliser git) ? Cliquez sur <strong>Terminal</strong> dans l’écran d’un serveur. Vigie ouvre le terminal de votre système, déjà placé dans le bon dossier :</p>
<ul>
  <li><strong>Windows</strong> : Windows Terminal s’il est installé, sinon PowerShell.</li>
  <li><strong>macOS</strong> : Terminal.</li>
  <li><strong>Linux</strong> : votre émulateur de terminal par défaut (GNOME Terminal, Konsole, xfce4-terminal…).</li>
</ul>
<p>Le terminal s’ouvre dans le dossier de travail du serveur s’il en a un, sinon dans le dossier du projet. C’est un terminal ordinaire : le fermer n’a aucun effet sur les serveurs que Vigie fait tourner.</p>
<aside class="note"><strong>Ne lancez pas le serveur de dev dans ce terminal.</strong> Il tourne déjà dans Vigie : tapez plutôt <code>vigie logs dev -f</code> pour y suivre sa sortie.</aside>`,
  },
  {
    id: 'cli',
    title: 'La commande vigie',
    html: `
<p>Tout ce que fait la fenêtre est aussi disponible depuis un terminal, et c’est ce qu’utilisent vos agents.</p>
<h3>L’installer</h3>
<p>Icône → <strong>Installer l’outil en ligne de commande</strong>. Vigie ajoute la commande <code>vigie</code> à votre PATH utilisateur. Ouvrez un <strong>nouveau</strong> terminal (ou redémarrez votre éditeur) et tapez <code>vigie status</code>. Pas besoin de Node.js : la commande s’appuie sur l’app elle-même.</p>
<h3>Les commandes du quotidien</h3>
<table>
  <tr><th>Commande</th><th>Ce qu’elle fait</th></tr>
  <tr><td><code>vigie status</code></td><td>Tous les projets et serveurs, avec état, port, PID et durée.</td></tr>
  <tr><td><code>vigie start</code> / <code>stop</code> / <code>restart</code></td><td>Agit sur le serveur du dossier courant, ou sur celui que vous nommez : <code>vigie start convex</code>.</td></tr>
  <tr><td><code>vigie logs dev -f</code></td><td>Suit la sortie d’un serveur en direct. <kbd>Ctrl</kbd>+<kbd>C</kbd> arrête de suivre, pas le serveur.</td></tr>
  <tr><td><code>vigie port 3000</code></td><td>Qui tient ce port : Vigie, un autre programme ou le système.</td></tr>
  <tr><td><code>vigie ports</code></td><td>Tous les ports en écoute, regroupés par propriétaire.</td></tr>
  <tr><td><code>vigie register --port 3000</code></td><td>Enregistre le projet du dossier courant, en devinant la commande depuis <code>package.json</code>.</td></tr>
  <tr><td><code>vigie stop-all</code></td><td>Arrête tous les serveurs.</td></tr>
  <tr><td><code>vigie shutdown</code></td><td>Arrête tous les serveurs et quitte Vigie.</td></tr>
</table>
<p>Un serveur se désigne par son nom (<code>dev</code>), par <code>projet/serveur</code> (<code>mon-app/dev</code>) ou par son port (<code>:3000</code>). Ajoutez <code>--json</code> à n’importe quelle commande pour une sortie lisible par une machine.</p>`,
  },
  {
    id: 'agents',
    title: 'Travailler avec des agents IA',
    html: `
<p>Vigie est pensé pour votre façon de coder avec des agents. Installez le skill une fois, et Claude Code, Codex ou Cursor apprennent une règle : <strong>interroger Vigie avant de lancer un serveur</strong>.</p>
<h3>Installer le skill</h3>
<p>Icône → <strong>Installer le skill pour agents</strong> (ou <code>vigie skill install</code>). Le skill est copié dans <code>~/.agents/skills/vigie</code>, et dans <code>~/.claude/skills/vigie</code> si Claude Code est installé. Installez aussi l’outil en ligne de commande : le skill s’en sert. Ouvrez ensuite une <strong>nouvelle</strong> session d’agent.</p>
<h3>Ce qui change</h3>
<p>Demandez à votre agent d’« ouvrir le site » ou de « lancer le serveur de dev ». Au lieu de taper <code>pnpm dev</code>, il exécute <code>vigie status --json</code>, voit que le serveur tourne déjà et répond, et vous donne <code>localhost:3000</code>. Si le serveur est arrêté, il le démarre via Vigie : le démarrage apparaît dans cette fenêtre. Si le port est tenu par un autre programme, il vous prévient au lieu d’arrêter quoi que ce soit.</p>
<aside class="note"><strong>Le même état pour tout le monde.</strong> Cinq agents qui posent la question en même temps obtiennent la même réponse, et un seul process continue de tourner.</aside>`,
  },
  {
    id: 'config',
    title: 'Réglages et fichiers',
    html: `
<h3>Thème et langue</h3>
<p>En bas de la barre latérale : <strong>Thème</strong> (Système, Clair, Sombre) et <strong>Langue</strong> (Auto, English, Français). Auto suit la langue de votre système ; le choix s’applique aussi au menu de l’icône.</p>
<h3>Où Vigie range ses fichiers</h3>
<table>
  <tr><th>Fichier</th><th>Contenu</th></tr>
  <tr><td><code>~/.config/vigie/config.json</code></td><td>Vos projets et serveurs. Vous pouvez le modifier à la main : Vigie le recharge dès que vous enregistrez.</td></tr>
  <tr><td><code>~/.config/vigie/logs/</code></td><td>Un fichier de logs par serveur, conservé d’un redémarrage à l’autre.</td></tr>
  <tr><td><code>~/.config/vigie/state.json</code></td><td>Les serveurs qui tournaient au dernier arrêt de Vigie.</td></tr>
  <tr><td><code>~/.config/vigie/daemon.log</code></td><td>Le journal de Vigie : démarrages, arrêts, rechargements de la configuration.</td></tr>
</table>
<p>Sous Windows, <code>~</code> désigne votre dossier utilisateur, par exemple <code>C:\\Users\\vous</code>.</p>
<h3>L’API locale</h3>
<p>La fenêtre, la commande et les agents parlent à Vigie via une API sur <code>http://127.0.0.1:7744</code>. Elle n’accepte que les requêtes venant de votre propre machine et refuse celles qui viennent de sites web.</p>`,
  },
  {
    id: 'troubleshooting',
    title: 'Dépannage',
    html: `
<h3>Le serveur reste en Démarrage, puis passe à Ne répond pas</h3>
<p>Le process tourne mais rien ne répond sur son port. Cause habituelle : la commande n’utilise pas ce port. Vérifiez que le port de la commande correspond au champ <strong>Port</strong> (<code>-p 3000</code> pour Next.js, <code>--port 5173 --strictPort</code> pour Vite).</p>
<h3>En échec au bout de quelques secondes</h3>
<p>Lisez la fin de la sortie. Causes fréquentes : dépendances non installées (ouvrez un <strong>Terminal</strong> et lancez <code>npm install</code>), une erreur de syntaxe, un fichier <code>.env</code> manquant.</p>
<h3>« Lancé en dehors de Vigie »</h3>
<p>Un autre programme tient déjà le port, souvent un <code>npm run dev</code> lancé dans un terminal. Choisissez <strong>Reprendre dans Vigie</strong>, ou fermez ce terminal vous-même.</p>
<h3><code>vigie: command not found</code></h3>
<p>Icône → <strong>Installer l’outil en ligne de commande</strong>, puis ouvrez un <em>nouveau</em> terminal : ceux ouverts avant l’installation ne voient pas le nouveau PATH.</p>
<h3>L’icône a disparu de la zone de notification</h3>
<p>Vigie a été quitté. Rouvrez-le depuis le menu Démarrer : vos serveurs reviennent.</p>
<h3>La première page met des minutes à s’afficher</h3>
<p>C’est le framework qui compile, pas Vigie. Si la sortie indique <em>Slow filesystem detected</em>, votre projet est sur un disque lent ; les pages suivantes sont bien plus rapides.</p>
<h3>Windows SmartScreen affiche un avertissement à l’installation</h3>
<p>L’installateur n’est pas encore signé. Cliquez sur <strong>Informations complémentaires</strong>, puis sur <strong>Exécuter quand même</strong>.</p>`,
  },
];

export const MANUAL = { en, fr };

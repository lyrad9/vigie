// Tray menu and dialog texts, in the language chosen in the app (Settings → Language).
export const TRAY_STRINGS = {
  en: {
    running: 'Vigie · {running}/{total} running',
    unreachable: 'Vigie · supervisor unreachable',
    start: 'Start',
    stop: 'Stop',
    restart: 'Restart',
    openBrowser: 'Open in browser',
    openTerminal: 'Open terminal',
    showLogs: 'Show logs',
    openVigie: 'Open Vigie',
    ports: 'Ports',
    manual: 'Manual',
    stopAll: 'Stop all',
    launchAtLogin: 'Launch at login',
    installCli: 'Install command-line tool',
    uninstallCli: 'Uninstall command-line tool',
    installSkill: 'Install agent skill',
    quitAll: 'Quit Vigie (stops all servers)',
    quit: 'Quit Vigie',
  },
  fr: {
    running: 'Vigie · {running}/{total} en marche',
    unreachable: 'Vigie · superviseur injoignable',
    start: 'Démarrer',
    stop: 'Arrêter',
    restart: 'Redémarrer',
    openBrowser: 'Ouvrir dans le navigateur',
    openTerminal: 'Ouvrir un terminal',
    showLogs: 'Voir les logs',
    openVigie: 'Ouvrir Vigie',
    ports: 'Ports',
    manual: 'Manuel',
    stopAll: 'Tout arrêter',
    launchAtLogin: 'Lancer à l’ouverture de session',
    installCli: 'Installer l’outil en ligne de commande',
    uninstallCli: 'Désinstaller l’outil en ligne de commande',
    installSkill: 'Installer le skill pour agents',
    quitAll: 'Quitter Vigie (arrête tous les serveurs)',
    quit: 'Quitter Vigie',
  },
};

/** A lookup for 'auto' | 'en' | 'fr', where 'auto' follows the system locale. */
export function trayText(setting, locale = '') {
  const lang = setting === 'en' || setting === 'fr' ? setting : String(locale).toLowerCase().startsWith('fr') ? 'fr' : 'en';
  const table = TRAY_STRINGS[lang];
  return (key, vars = {}) => table[key].replace(/\{(\w+)\}/g, (_, k) => vars[k] ?? '');
}

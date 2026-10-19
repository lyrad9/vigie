// Runs in the app window before the page: gives the Updates page access to the app's updater.
// Only this, nothing else from Electron or Node, reaches the page. In a browser the page has no
// window.vigieDesktop and shows the version history without update controls.
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('vigieDesktop', {
  updates: {
    /** { status, version, error, progress, checkedAt, current, enabled } */
    get: () => ipcRenderer.invoke('updates:get'),
    check: () => ipcRenderer.invoke('updates:check'),
    /** Stop the servers, install the downloaded version and restart Vigie. */
    install: () => ipcRenderer.invoke('updates:install'),
    /** The changelog of a newer release, or null. */
    notes: (version) => ipcRenderer.invoke('updates:notes', String(version)),
    onChange: (callback) => {
      const listener = (_event, state) => callback(state);
      ipcRenderer.on('updates:changed', listener);
      return () => ipcRenderer.removeListener('updates:changed', listener);
    },
  },
});

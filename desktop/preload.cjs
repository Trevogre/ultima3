// What the game's page may ask of the desktop app (main.cjs), and nothing more: the release update it found, if any
// (updates.cjs), and to open that release's page in the system browser.
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('u3native', {
  updateOffer: () => ipcRenderer.invoke('update-offer'),
  openRelease: () => ipcRenderer.invoke('open-release'),
});

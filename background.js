// background.js
chrome.runtime.onInstalled.addListener(() => {
  // Configura el comportamiento para que al hacer clic en el icono se abra el Side Panel
  chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true })
    .catch((error) => console.error(error));
});
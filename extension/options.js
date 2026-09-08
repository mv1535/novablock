/* La porte s'ouvre dans une vue séparée : annuler rend la page précédente
 * exactement dans son état initial, sur PC comme dans un navigateur Android. */
document.getElementById('lienPorte').addEventListener('click', (evenement) => {
  evenement.preventDefault();
  chrome.runtime.sendMessage({ type: 'ongletActif' }, (actif) => {
    chrome.runtime.sendMessage({
      type: 'ouvrirDefi',
      raison: 'reglages',
      sourceTabId: actif && actif.ok ? actif.tabId : null
    });
  });
});

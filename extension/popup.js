/* Popup PC et navigateurs Android compatibles : une action principale,
 * retourner à l'application sans recharger ni modifier son onglet.
 */
(function () {
  'use strict';

  const { origineLisible } = globalThis.NovablockRules;
  let sourceTabId = null;

  function envoyer(message) {
    return new Promise((resoudre) => {
      chrome.runtime.sendMessage(message, (reponse) => {
        if (chrome.runtime.lastError) resoudre(null);
        else resoudre(reponse || null);
      });
    });
  }

  function formater(ms) {
    const total = Math.max(0, Math.ceil(ms / 1000));
    const minutes = String(Math.floor(total / 60)).padStart(2, '0');
    const secondes = String(total % 60).padStart(2, '0');
    return `${minutes}:${secondes}`;
  }

  async function rafraichir() {
    const etat = await envoyer({ type: 'etat' });
    if (!etat) return;
    const restant = etat.accesJusqua - Date.now();
    document.getElementById('statut').textContent =
      restant > 0 ? `Ouverts · ${formater(restant)}` : 'Bloqués';
    document.getElementById('blocages').textContent = etat.compteurBlocages || 0;
    document.getElementById('deblocages').textContent = etat.compteurDeblocages || 0;
  }

  async function trouverApplication() {
    const actif = await envoyer({ type: 'ongletActif' });
    if (!actif || !actif.ok) return;
    sourceTabId = actif.tabId;
    const nom = origineLisible(actif.url);
    document.getElementById('retourApplication').textContent = `Retourner à ${nom}`;
  }

  async function retourner() {
    if (Number.isInteger(sourceTabId)) {
      await envoyer({ type: 'activerOnglet', tabId: sourceTabId });
    }
    window.close();
    setTimeout(() => {
      if (history.length > 1) history.back();
    }, 120);
  }

  document.getElementById('retourApplication').addEventListener('click', retourner);

  document.getElementById('demanderAcces').addEventListener('click', async () => {
    await envoyer({ type: 'ouvrirDefi', raison: 'court', sourceTabId });
    window.close();
  });

  document.getElementById('lienDesinstallation').addEventListener('click', async (evenement) => {
    evenement.preventDefault();
    await envoyer({ type: 'ouvrirDefi', raison: 'reglages', sourceTabId });
    window.close();
  });

  trouverApplication();
  rafraichir();
  setInterval(rafraichir, 1000);
})();

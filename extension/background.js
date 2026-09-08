/* Novablock — service worker.
 * Principe UX : le contenu court est neutralisé dans sa page, puis le retour
 * emprunte d'abord l'historique réel de l'onglet. La page, son défilement et
 * l'état de l'application monopage restent donc intacts.
 */

importScripts('url-rules.js');

const { estBloquee, repliSain } = globalThis.NovablockRules;
const DUREE_ACCES_MS = 15 * 60 * 1000;
const ETAT_PAR_DEFAUT = Object.freeze({
  accesJusqua: 0,
  sasFranchiLe: 0,
  compteurDeblocages: 0,
  compteurBlocages: 0
});
const blocagesRecents = new Map();
const CLE_DERNIER_ONGLET = 'dernier_onglet_utilisateur';

function stockageNavigation() {
  // storage.session survit à la mise en veille du service worker sans laisser
  // l'historique de navigation sur disque. Quelques navigateurs Android ne
  // l'implémentent pas encore : local est alors un repli fonctionnel.
  return chrome.storage.session || chrome.storage.local;
}

function cleNavigation(tabId) {
  return `navigation_${tabId}`;
}

async function lireEtat() {
  return chrome.storage.local.get(ETAT_PAR_DEFAUT);
}

async function lireNavigation(tabId) {
  const cle = cleNavigation(tabId);
  const resultat = await stockageNavigation().get(cle);
  return resultat[cle] || {
    urlSaine: '',
    urlBloquee: '',
    openerTabId: null,
    bloqueeLe: 0
  };
}

async function ecrireNavigation(tabId, modification) {
  const cle = cleNavigation(tabId);
  const courant = await lireNavigation(tabId);
  await stockageNavigation().set({ [cle]: { ...courant, ...modification } });
}

function estPageExtension(url) {
  return Boolean(url && url.startsWith(chrome.runtime.getURL('')));
}

async function memoriserPageSaine(tabId, url, openerTabId) {
  if (!Number.isInteger(tabId) || !/^https?:\/\//i.test(url || '') || estBloquee(url)) return;
  await ecrireNavigation(tabId, {
    urlSaine: url,
    openerTabId: Number.isInteger(openerTabId) ? openerTabId : null
  });
}

async function compterBlocage(tabId, url) {
  const maintenant = Date.now();
  const precedent = blocagesRecents.get(tabId);
  if (precedent && precedent.url === url && maintenant - precedent.le < 1200) return;

  blocagesRecents.set(tabId, { url, le: maintenant });
  const etat = await lireEtat();
  await chrome.storage.local.set({ compteurBlocages: (etat.compteurBlocages || 0) + 1 });
}

async function signalerBlocage(tabId, url, cause) {
  if (!Number.isInteger(tabId) || !estBloquee(url)) return;

  const etat = await lireEtat();
  if (etat.accesJusqua > Date.now()) return;

  let onglet = null;
  try {
    onglet = await chrome.tabs.get(tabId);
  } catch (_erreur) {
    return;
  }

  await ecrireNavigation(tabId, {
    urlBloquee: url,
    openerTabId: Number.isInteger(onglet.openerTabId) ? onglet.openerTabId : null,
    bloqueeLe: Date.now()
  });
  await compterBlocage(tabId, url);

  try {
    await chrome.tabs.sendMessage(tabId, {
      type: 'afficherBlocage',
      url,
      cause: cause || 'navigation'
    });
  } catch (_erreur) {
    // À document_start, le script de contenu peut ne pas encore écouter. Il
    // vérifie lui-même l'URL dès son chargement et affiche le même écran.
  }
}

async function surveiller(tabId, url, openerTabId) {
  if (!url || typeof url !== 'string' || estPageExtension(url)) return;
  if (estBloquee(url)) {
    await signalerBlocage(tabId, url, 'navigation');
    return;
  }
  await memoriserPageSaine(tabId, url, openerTabId);
}

async function ongletExiste(tabId) {
  if (!Number.isInteger(tabId)) return false;
  try {
    await chrome.tabs.get(tabId);
    return true;
  } catch (_erreur) {
    return false;
  }
}

async function activerOnglet(tabId) {
  if (!(await ongletExiste(tabId))) return false;
  const onglet = await chrome.tabs.update(tabId, { active: true });
  if (Number.isInteger(onglet.windowId) && chrome.windows && chrome.windows.update) {
    try {
      await chrome.windows.update(onglet.windowId, { focused: true });
    } catch (_erreur) {
      // Certains navigateurs Android n'exposent pas windows.update.
    }
  }
  return true;
}

async function memoriserOngletUtilisateur(tabId) {
  if (!Number.isInteger(tabId)) return;
  try {
    const onglet = await chrome.tabs.get(tabId);
    if (!estPageExtension(onglet.url || '')) {
      await stockageNavigation().set({ [CLE_DERNIER_ONGLET]: tabId });
    }
  } catch (_erreur) {
    // L'onglet a pu être fermé entre l'activation et sa lecture.
  }
}

async function dernierOngletUtilisateur() {
  const resultat = await stockageNavigation().get(CLE_DERNIER_ONGLET);
  const tabId = resultat[CLE_DERNIER_ONGLET];
  if (!(await ongletExiste(tabId))) return null;
  return chrome.tabs.get(tabId);
}

async function restaurerOnglet(tabId) {
  if (!Number.isInteger(tabId)) return { ok: false, methode: 'aucune' };

  let onglet;
  try {
    onglet = await chrome.tabs.get(tabId);
  } catch (_erreur) {
    return { ok: false, methode: 'onglet-ferme' };
  }

  const navigation = await lireNavigation(tabId);

  // C'est le seul chemin qui restaure exactement une application monopage :
  // position de défilement, recherche, vidéo et filtres compris.
  if (typeof chrome.tabs.goBack === 'function') {
    // Un balayage dans le lecteur peut avoir empilé plusieurs Shorts. On les
    // saute dans la même action afin que l'utilisateur ne clique qu'une fois.
    for (let recul = 0; recul < 6; recul += 1) {
      try {
        await chrome.tabs.goBack(tabId);
        const apresRetour = await chrome.tabs.get(tabId);
        if (!estBloquee(apresRetour.url || '')) {
          return { ok: true, methode: 'historique' };
        }
      } catch (_erreur) {
        break; // Aucun historique : replis déterministes ci-dessous.
      }
    }
  }

  if (navigation.urlSaine && !estBloquee(navigation.urlSaine)) {
    await chrome.tabs.update(tabId, { url: navigation.urlSaine, active: true });
    return { ok: true, methode: 'derniere-page' };
  }

  const openerTabId = Number.isInteger(onglet.openerTabId)
    ? onglet.openerTabId
    : navigation.openerTabId;
  if (await activerOnglet(openerTabId)) {
    await chrome.tabs.remove(tabId);
    return { ok: true, methode: 'onglet-source' };
  }

  await chrome.tabs.update(tabId, {
    url: repliSain(navigation.urlBloquee || onglet.url),
    active: true
  });
  return { ok: true, methode: 'accueil' };
}

function urlDuDefi(raison, sourceTabId, reprendreShort) {
  const params = new URLSearchParams({ raison });
  if (Number.isInteger(sourceTabId)) params.set('sourceTab', String(sourceTabId));
  if (reprendreShort) params.set('reprendre', '1');
  return chrome.runtime.getURL(`block.html?${params.toString()}`);
}

async function ouvrirDefi(sourceTabId, raison) {
  const valide = Number.isInteger(sourceTabId) && (await ongletExiste(sourceTabId));
  const source = valide ? await chrome.tabs.get(sourceTabId) : null;
  const reprendreShort = raison !== 'reglages' && Boolean(source && estBloquee(source.url || ''));
  return chrome.tabs.create({
    url: urlDuDefi(
      raison === 'reglages' ? 'reglages' : 'court',
      valide ? sourceTabId : null,
      reprendreShort
    ),
    active: true,
    ...(valide ? { openerTabId: sourceTabId } : {})
  });
}

async function fermerVueEtRetourner(vueTabId, sourceTabId, restaurerSource = false) {
  let resultatRestauration = null;
  if (restaurerSource && (await ongletExiste(sourceTabId))) {
    resultatRestauration = await restaurerOnglet(sourceTabId);
  }
  const sourceActivee = await activerOnglet(sourceTabId);
  if (Number.isInteger(vueTabId) && (await ongletExiste(vueTabId))) {
    await chrome.tabs.remove(vueTabId);
  }
  return {
    ok: sourceActivee || Boolean(resultatRestauration && resultatRestauration.ok),
    methode: resultatRestauration
      ? resultatRestauration.methode
      : sourceActivee
        ? 'onglet-source'
        : 'fermeture'
  };
}

async function reprendreApresAcces(vueTabId, sourceTabId, reprendreShort) {
  if (!Number.isInteger(sourceTabId) || !(await ongletExiste(sourceTabId))) {
    return fermerVueEtRetourner(vueTabId, null);
  }

  const navigation = await lireNavigation(sourceTabId);
  const destination = reprendreShort && estBloquee(navigation.urlBloquee)
    ? navigation.urlBloquee
    : '';
  if (destination) {
    const source = await chrome.tabs.get(sourceTabId);
    if (source.url === destination) {
      await activerOnglet(sourceTabId);
      try {
        await chrome.tabs.sendMessage(sourceTabId, { type: 'accesAccorde' });
      } catch (_erreur) {
        await chrome.tabs.update(sourceTabId, { url: destination, active: true });
      }
    } else {
      await chrome.tabs.update(sourceTabId, { url: destination, active: true });
    }
  } else {
    await activerOnglet(sourceTabId);
  }
  if (Number.isInteger(vueTabId) && (await ongletExiste(vueTabId))) {
    await chrome.tabs.remove(vueTabId);
  }
  return { ok: true };
}

/* Navigation classique et navigation interne des applications monopages. */
chrome.webNavigation.onBeforeNavigate.addListener((details) => {
  if (details.frameId === 0) surveiller(details.tabId, details.url).catch(() => {});
});

chrome.webNavigation.onCommitted.addListener((details) => {
  if (details.frameId === 0) surveiller(details.tabId, details.url).catch(() => {});
});

chrome.webNavigation.onHistoryStateUpdated.addListener((details) => {
  if (details.frameId === 0) surveiller(details.tabId, details.url).catch(() => {});
});

chrome.tabs.onUpdated.addListener((tabId, info, tab) => {
  const url = info.url || tab.url;
  if (url) surveiller(tabId, url, tab.openerTabId).catch(() => {});
});

chrome.tabs.onRemoved.addListener((tabId) => {
  blocagesRecents.delete(tabId);
  stockageNavigation().remove(cleNavigation(tabId)).catch(() => {});
});

chrome.tabs.onActivated.addListener(({ tabId }) => {
  memoriserOngletUtilisateur(tabId).catch(() => {});
});

chrome.alarms.create('verification-acces', { periodInMinutes: 0.5 });
chrome.alarms.onAlarm.addListener(async (alarme) => {
  if (alarme.name !== 'verification-acces') return;
  const etat = await lireEtat();
  if (etat.accesJusqua > Date.now()) return;
  const onglets = await chrome.tabs.query({});
  await Promise.all(
    onglets
      .filter((onglet) => Number.isInteger(onglet.id) && estBloquee(onglet.url || ''))
      .map((onglet) => signalerBlocage(onglet.id, onglet.url, 'expiration'))
  );
});

chrome.runtime.onInstalled.addListener(() => {
  chrome.storage.local.get(ETAT_PAR_DEFAUT).then((etat) => chrome.storage.local.set(etat));
});

chrome.runtime.onMessage.addListener((message, sender, repondre) => {
  (async () => {
    const maintenant = Date.now();

    if (message.type === 'etat') {
      return lireEtat();
    }

    if (message.type === 'verifierUrl') {
      const etat = await lireEtat();
      return {
        bloque: estBloquee(message.url) && etat.accesJusqua <= maintenant,
        accesJusqua: etat.accesJusqua
      };
    }

    if (message.type === 'blocageIntercepte') {
      const tabId = sender.tab && sender.tab.id;
      if (Number.isInteger(tabId) && estBloquee(message.url)) {
        const tab = await chrome.tabs.get(tabId);
        await memoriserPageSaine(tabId, tab.url, tab.openerTabId);
        await ecrireNavigation(tabId, { urlBloquee: message.url, bloqueeLe: maintenant });
        await compterBlocage(tabId, message.url);
      }
      return { ok: true };
    }

    if (message.type === 'retourSansIrritant') {
      const tabId = sender.tab && sender.tab.id;
      return restaurerOnglet(tabId);
    }

    if (message.type === 'ouvrirDefi') {
      let sourceTabId = Number.isInteger(message.sourceTabId)
        ? message.sourceTabId
        : sender.tab && sender.tab.id;
      if (!Number.isInteger(sourceTabId)) {
        const dernier = await dernierOngletUtilisateur();
        sourceTabId = dernier && dernier.id;
      }
      const onglet = await ouvrirDefi(sourceTabId, message.raison || 'court');
      return { ok: true, tabId: onglet.id };
    }

    if (message.type === 'accorderAcces') {
      const etat = await lireEtat();
      const jusqua = maintenant + DUREE_ACCES_MS;
      await chrome.storage.local.set({
        accesJusqua: jusqua,
        compteurDeblocages: (etat.compteurDeblocages || 0) + 1
      });
      return { ok: true, jusqua };
    }

    if (message.type === 'reprendreApresAcces') {
      return reprendreApresAcces(
        sender.tab && sender.tab.id,
        Number(message.sourceTabId),
        message.reprendreShort === true
      );
    }

    if (message.type === 'fermerVueEtRetourner') {
      return fermerVueEtRetourner(
        sender.tab && sender.tab.id,
        Number(message.sourceTabId),
        message.restaurerSource === true
      );
    }

    if (message.type === 'sasFranchi') {
      await chrome.storage.local.set({ sasFranchiLe: maintenant });
      return { ok: true, le: maintenant };
    }

    if (message.type === 'ongletActif') {
      const onglets = await chrome.tabs.query({ active: true, currentWindow: true });
      let actif = onglets[0] || null;
      if (!actif || estPageExtension(actif.url || '')) {
        actif = await dernierOngletUtilisateur();
      }
      return actif
        ? { ok: true, tabId: actif.id, url: actif.url || '', titre: actif.title || '' }
        : { ok: false };
    }

    if (message.type === 'activerOnglet') {
      return { ok: await activerOnglet(Number(message.tabId)) };
    }

    return { ok: false };
  })()
    .then(repondre)
    .catch((erreur) => repondre({ ok: false, erreur: erreur && erreur.message }));
  return true;
});

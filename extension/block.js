/* Novablock — moteur de maintien.
 * Le chronometre n'avance que si trois conditions sont vraies en meme temps :
 * le pointeur est enfonce, il se trouve sur la cible, et la fenetre est au premier plan.
 * La cible derive lentement : il faut la suivre, un poids pose sur la souris ne suffit pas.
 */

(function () {
  'use strict';

  const params = new URLSearchParams(location.search);
  const raison = params.get('raison') === 'reglages' ? 'reglages' : 'court';
  const sourceTabId = Number.parseInt(params.get('sourceTab') || '', 10);
  const reprendreShort = params.get('reprendre') === '1';

  const CONFIG = {
    court: {
      duree: 2 * 60 * 1000,
      facteurAmplitude: 0.55,
      etiquette: 'Contenu bloqué',
      titre: 'Bloqué.',
      soustitre:
        "Pour obtenir quinze minutes d'accès, maintenez le bouton enfoncé pendant deux minutes sans relâcher. La cible se déplace : suivez-la.",
      succesTitre: 'Quinze minutes accordées'
    },
    reglages: {
      duree: 15 * 60 * 1000,
      facteurAmplitude: 1,
      etiquette: 'Désinstallation',
      titre: 'Encore verrouillé.',
      soustitre:
        "Novablock est installée par stratégie Windows : Chrome n'affiche aucun bouton de suppression. Pour obtenir la commande de retrait, maintenez le bouton enfoncé pendant quinze minutes sans relâcher. La cible se déplace : suivez-la.",
      succesTitre: 'Commande de retrait délivrée'
    }
  }[raison];

  const el = {
    etiquette: document.getElementById('etiquette'),
    titre: document.getElementById('titre'),
    soustitre: document.getElementById('soustitre'),
    arene: document.getElementById('arene'),
    cible: document.getElementById('cible'),
    cibleTexte: document.getElementById('cibleTexte'),
    chrono: document.getElementById('chrono'),
    jauge: document.getElementById('jauge'),
    jaugeRemplissage: document.getElementById('jaugeRemplissage'),
    etatTexte: document.getElementById('etatTexte'),
    succes: document.getElementById('succes'),
    succesTitre: document.getElementById('succesTitre'),
    succesTexte: document.getElementById('succesTexte'),
    succesActions: document.getElementById('succesActions'),
    stats: document.getElementById('stats'),
    boutonSortie: document.getElementById('boutonSortie'),
    sortieDetail: document.getElementById('sortieDetail')
  };

  el.etiquette.textContent = CONFIG.etiquette;
  el.titre.textContent = CONFIG.titre;
  el.soustitre.textContent = CONFIG.soustitre;

  /* ---------- Etat du maintien ---------- */
  let enCours = false;
  let cumul = 0; // millisecondes accumulees
  let dernierTs = 0;
  let boucle = null;
  let abandons = 0;
  const pointeur = { x: -9999, y: -9999 };

  function formater(ms) {
    const total = Math.max(0, Math.ceil(ms / 1000));
    const m = String(Math.floor(total / 60)).padStart(2, '0');
    const s = String(total % 60).padStart(2, '0');
    return `${m}:${s}`;
  }

  function rendre() {
    const restant = CONFIG.duree - cumul;
    const pourcent = Math.min(100, (cumul / CONFIG.duree) * 100);
    el.chrono.textContent = formater(restant);
    el.jaugeRemplissage.style.width = `${pourcent}%`;
    el.jauge.setAttribute('aria-valuenow', String(Math.round(pourcent)));
    el.stats.textContent = abandons > 0 ? `Reprises depuis le début : ${abandons}` : '';
  }

  function amplitudes() {
    const a = el.arene.getBoundingClientRect();
    const c = el.cible.getBoundingClientRect();
    return {
      x: Math.max(0, (a.width - c.width) / 2 - 10) * CONFIG.facteurAmplitude,
      y: Math.max(0, (a.height - c.height) / 2 - 10) * CONFIG.facteurAmplitude
    };
  }

  function positionner(tSecondes) {
    const amp = amplitudes();
    const dx = Math.sin(tSecondes * 0.31) * amp.x;
    const dy = Math.sin(tSecondes * 0.47) * amp.y;
    el.cible.style.transform = `translate(${dx.toFixed(1)}px, ${dy.toFixed(1)}px)`;
  }

  function pointeurSurCible() {
    const r = el.cible.getBoundingClientRect();
    return (
      pointeur.x >= r.left && pointeur.x <= r.right && pointeur.y >= r.top && pointeur.y <= r.bottom
    );
  }

  function demarrer() {
    if (enCours) return;
    enCours = true;
    dernierTs = performance.now();
    el.cible.classList.add('actif');
    el.cibleTexte.textContent = 'Ne relâchez pas';
    el.etatTexte.textContent = 'Maintien en cours. Suivez la cible sans relâcher.';
    boucle = requestAnimationFrame(tourner);
  }

  function interrompre(motif) {
    if (!enCours) return;
    enCours = false;
    if (boucle) cancelAnimationFrame(boucle);
    if (cumul > 0) abandons += 1;
    cumul = 0;
    el.cible.classList.remove('actif');
    el.cible.style.transform = 'translate(0px, 0px)';
    el.cibleTexte.textContent = 'Maintenir';
    el.etatTexte.textContent = motif;
    rendre();
  }

  function tourner(ts) {
    if (!enCours) return;
    const dt = Math.min(ts - dernierTs, 250); // borne : evite un saut apres une pause du rendu
    dernierTs = ts;

    if (document.hidden) {
      interrompre('Onglet quitté : le compte est remis à zéro.');
      return;
    }
    if (!document.hasFocus()) {
      interrompre('Fenêtre en arrière-plan : le compte est remis à zéro.');
      return;
    }

    cumul += dt;
    positionner(cumul / 1000);

    if (!pointeurSurCible()) {
      interrompre('Le curseur a quitté la cible : le compte est remis à zéro.');
      return;
    }

    rendre();

    if (cumul >= CONFIG.duree) {
      enCours = false;
      reussir();
      return;
    }
    boucle = requestAnimationFrame(tourner);
  }

  /* ---------- Ecoutes ---------- */
  el.cible.addEventListener('pointerdown', (e) => {
    if (!e.isTrusted) return; // ignore les evenements synthetiques
    e.preventDefault();
    pointeur.x = e.clientX;
    pointeur.y = e.clientY;
    demarrer();
  });

  document.addEventListener('pointermove', (e) => {
    pointeur.x = e.clientX;
    pointeur.y = e.clientY;
  });

  ['pointerup', 'pointercancel'].forEach((nom) => {
    document.addEventListener(nom, () => interrompre('Bouton relâché : le compte est remis à zéro.'));
  });

  window.addEventListener('blur', () => interrompre('Fenêtre quittée : le compte est remis à zéro.'));
  document.addEventListener('contextmenu', (e) => e.preventDefault());

  /* ---------- Reussite ---------- */
  function reussir() {
    el.cible.classList.remove('actif');
    el.cible.style.transform = 'translate(0px, 0px)';
    el.jaugeRemplissage.style.width = '100%';
    el.arene.hidden = true;
    el.succes.hidden = false;
    el.succesTitre.textContent = CONFIG.succesTitre;

    if (raison === 'court') {
      chrome.runtime.sendMessage({ type: 'accorderAcces' }, (rep) => {
        el.succesTexte.textContent =
          "Quinze minutes d'accès viennent d'être ouvertes. Retour à votre application…";
        if (rep && rep.ok) {
          setTimeout(() => {
            chrome.runtime.sendMessage({
              type: 'reprendreApresAcces',
              sourceTabId,
              reprendreShort
            });
          }, 700);
        }
      });
      return;
    }

    chrome.runtime.sendMessage({ type: 'sasFranchi' }, () => {
      el.succesTexte.textContent =
        "Novablock est imposée par la console Google Workspace. Pour la retirer :";
      const bloc = document.createElement('pre');
      bloc.className = 'procedure mono';
      bloc.textContent =
        "1. admin.google.com\n" +
        "2. Appareils > Chrome > Apps & extensions\n" +
        "3. Onglet « Users & browsers », unité NA\n" +
        "4. Ouvrir l'entrée Novablock, icône corbeille\n" +
        "5. Cliquer sur SAVE (sans quoi rien n'est enregistré)\n" +
        "6. Fermer Chrome complètement, puis le rouvrir";
      el.succesActions.appendChild(bloc);
    });
  }

  /* ---------- Initialisation ---------- */
  /* --- Sortie ---
   * On ne touche pas a l'historique : revenir en arriere retomberait sur le
   * format court et redeclencherait le mur. On demande au service worker de
   * naviguer vers la derniere page saine de l'onglet. */

  function quitter() {
    chrome.runtime.sendMessage({
      type: 'fermerVueEtRetourner',
      sourceTabId,
      restaurerSource: raison === 'court' && reprendreShort
    });
  }

  el.boutonSortie.textContent = "Retourner où j'étais";
  el.sortieDetail.textContent = Number.isInteger(sourceTabId)
    ? 'votre page est restée ouverte, sans perdre sa position'
    : "Novablock fermera cette vue et rendra l'application précédente";

  el.boutonSortie.addEventListener('click', quitter);

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') quitter();
  });

  chrome.runtime.sendMessage({ type: 'etat' }, (etat) => {
    if (!etat) return;
    const restant = etat.accesJusqua - Date.now();
    if (raison === 'court' && restant > 0) {
      el.soustitre.textContent = `Un accès est déjà ouvert pour encore ${formater(restant)}.`;
    }
    if (etat.compteurBlocages) {
      el.stats.textContent = `Blocages depuis l'installation : ${etat.compteurBlocages}`;
    }
  });

  rendre();
})();

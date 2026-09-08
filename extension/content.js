/* Novablock — interception et écran de blocage intégré.
 * Aucun clic sur un format court ne remplace la page courante. Si une URL
 * bloquée arrive tout de même (lien externe, clavier, restauration), l'écran
 * Novablock reste dans l'application et un clic ramène à l'état précédent.
 */
(function () {
  'use strict';

  const { estBloquee, origineLisible } = globalThis.NovablockRules;
  let derniereUrl = location.href;
  let protectionActive = true; // fermeture sûre durant les quelques ms d'initialisation
  let retourEnCours = false;
  let hote = null;
  let interfaceRacine = null;
  let minuterieToast = null;

  if (estBloquee(location.href)) {
    document.documentElement.setAttribute('data-novablock-page', 'blocked');
  }

  function envoyer(message) {
    return new Promise((resoudre) => {
      try {
        chrome.runtime.sendMessage(message, (reponse) => {
          if (chrome.runtime.lastError) {
            resoudre(null);
            return;
          }
          resoudre(reponse || null);
        });
      } catch (_erreur) {
        resoudre(null);
      }
    });
  }

  function couperLesVideos() {
    document.querySelectorAll('video').forEach((video) => {
      try {
        video.pause();
        video.muted = true;
        video.removeAttribute('autoplay');
      } catch (_erreur) {
        // Le lecteur peut être détaché par l'application pendant la boucle.
      }
    });
  }

  function creerInterface() {
    if (interfaceRacine) {
      if (hote && !hote.isConnected) (document.documentElement || document).appendChild(hote);
      return interfaceRacine;
    }

    hote = document.createElement('novablock-interface');
    hote.setAttribute('aria-live', 'polite');
    const ombre = hote.attachShadow({ mode: 'open' });
    ombre.innerHTML = `
      <style>
        :host {
          all: initial;
          color-scheme: dark;
          font-family: Montserrat, "Segoe UI", system-ui, -apple-system, sans-serif;
        }
        *, *::before, *::after { box-sizing: border-box; }
        .ecran {
          position: fixed;
          inset: 0;
          z-index: 2147483647;
          display: none;
          place-items: center;
          padding: max(20px, env(safe-area-inset-top)) max(20px, env(safe-area-inset-right))
            max(20px, env(safe-area-inset-bottom)) max(20px, env(safe-area-inset-left));
          background: rgba(20, 23, 20, .96);
          color: #f2f3f0;
          cursor: pointer;
          -webkit-tap-highlight-color: transparent;
          overscroll-behavior: contain;
        }
        .ecran.visible { display: grid; }
        .carte {
          width: min(560px, 100%);
          padding: clamp(24px, 5vw, 44px);
          border: 1px solid #3c4843;
          border-radius: 24px;
          background: #242a26;
          box-shadow: 0 24px 80px rgba(0, 0, 0, .42);
          text-align: center;
        }
        .icone {
          width: 52px;
          height: 52px;
          margin: 0 auto 20px;
          display: grid;
          place-items: center;
          border-radius: 50%;
          background: #193e3b;
          color: #56d0c9;
          font-size: 26px;
          font-weight: 900;
        }
        h1 { margin: 0 0 10px; font-size: clamp(30px, 7vw, 48px); line-height: 1.05; }
        p { margin: 0; color: #b9c0ba; font-size: clamp(16px, 3vw, 19px); line-height: 1.55; }
        .retour {
          width: 100%;
          min-height: 56px;
          margin-top: 28px;
          padding: 12px 20px;
          border: 0;
          border-radius: 14px;
          background: #198481;
          color: white;
          font: inherit;
          font-size: 17px;
          font-weight: 750;
          cursor: pointer;
          touch-action: manipulation;
        }
        .retour:hover { background: #209b97; }
        .defi {
          min-height: 48px;
          margin-top: 12px;
          padding: 10px 16px;
          border: 1px solid #48534c;
          border-radius: 12px;
          background: transparent;
          color: #b9c0ba;
          font: inherit;
          font-size: 14px;
          cursor: pointer;
          touch-action: manipulation;
        }
        .defi:hover { color: #f2f3f0; border-color: #198481; }
        .indice { margin-top: 18px; font-size: 13px; color: #858e87; }
        .toast {
          position: fixed;
          left: 50%;
          bottom: max(22px, env(safe-area-inset-bottom));
          z-index: 2147483647;
          max-width: calc(100vw - 32px);
          padding: 12px 17px;
          border: 1px solid #3c4843;
          border-radius: 999px;
          background: #242a26;
          color: #eef1ed;
          box-shadow: 0 12px 36px rgba(0, 0, 0, .32);
          font-size: 14px;
          font-weight: 650;
          line-height: 1.3;
          opacity: 0;
          pointer-events: none;
          transform: translate(-50%, 12px);
          transition: opacity 160ms ease, transform 160ms ease;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        .toast.visible { opacity: 1; transform: translate(-50%, 0); }
        @media (max-width: 560px) {
          .ecran { align-items: end; padding: 12px; }
          .carte { border-radius: 24px 24px 18px 18px; }
          .indice { display: none; }
        }
        @media (prefers-reduced-motion: reduce) {
          .toast { transition: none; }
        }
      </style>
      <section class="ecran" role="dialog" aria-modal="true" aria-labelledby="novablock-titre">
        <div class="carte">
          <div class="icone" aria-hidden="true">✓</div>
          <h1 id="novablock-titre">Short bloqué</h1>
          <p>Novablock vous ramène exactement où vous étiez dans <span class="application">l'application</span>.</p>
          <button class="retour" type="button">Retourner où j'étais</button>
          <button class="defi" type="button">Débloquer 15 minutes</button>
          <p class="indice">Cliquez n'importe où sur cet écran ou appuyez sur Échap.</p>
        </div>
      </section>
      <div class="toast" role="status">Short bloqué · vous êtes resté ici</div>
    `;
    (document.documentElement || document).appendChild(hote);

    interfaceRacine = {
      ecran: ombre.querySelector('.ecran'),
      application: ombre.querySelector('.application'),
      retour: ombre.querySelector('.retour'),
      defi: ombre.querySelector('.defi'),
      toast: ombre.querySelector('.toast')
    };

    interfaceRacine.ecran.addEventListener('click', (evenement) => {
      if (evenement.target === interfaceRacine.defi) return;
      retournerOuJetais();
    });
    interfaceRacine.retour.addEventListener('click', (evenement) => {
      evenement.stopPropagation();
      retournerOuJetais();
    });
    interfaceRacine.defi.addEventListener('click', (evenement) => {
      evenement.stopPropagation();
      if (interfaceRacine.defi.disabled) return;
      interfaceRacine.defi.disabled = true;
      envoyer({ type: 'ouvrirDefi', raison: 'court' });
      setTimeout(() => { interfaceRacine.defi.disabled = false; }, 1000);
    });

    return interfaceRacine;
  }

  function montrerToast() {
    const ui = creerInterface();
    ui.toast.classList.add('visible');
    clearTimeout(minuterieToast);
    minuterieToast = setTimeout(() => ui.toast.classList.remove('visible'), 2400);
  }

  function montrerEcran() {
    couperLesVideos();
    document.documentElement.setAttribute('data-novablock-page', 'blocked');
    const ui = creerInterface();
    ui.application.textContent = origineLisible(location.href);
    ui.ecran.classList.add('visible');
    ui.retour.textContent = "Retourner où j'étais";
    retourEnCours = false;
    requestAnimationFrame(() => ui.retour.focus({ preventScroll: true }));
  }

  function cacherEcran() {
    document.documentElement.removeAttribute('data-novablock-page');
    if (interfaceRacine) interfaceRacine.ecran.classList.remove('visible');
    retourEnCours = false;
  }

  async function retournerOuJetais() {
    if (retourEnCours) return;
    retourEnCours = true;
    if (interfaceRacine) interfaceRacine.retour.textContent = 'Retour en cours…';

    const reponse = await envoyer({ type: 'retourSansIrritant' });
    if (reponse && reponse.ok) return;

    // Repli si le service worker a été redémarré au mauvais instant.
    if (history.length > 1) history.back();
    else location.replace('https://www.youtube.com/');
  }

  function appliquerMasquage(actif) {
    document.documentElement.setAttribute('data-novablock', actif ? 'on' : 'off');
  }

  async function verifier() {
    const reponse = await envoyer({ type: 'verifierUrl', url: location.href });
    if (!reponse) return;

    protectionActive = reponse.accesJusqua <= Date.now();
    appliquerMasquage(protectionActive);

    if (reponse.bloque) montrerEcran();
    else cacherEcran();
  }

  function lienDepuisEvenement(evenement) {
    const chemin = typeof evenement.composedPath === 'function' ? evenement.composedPath() : [];
    for (const element of chemin) {
      if (element && element.tagName === 'A' && element.href) return element;
    }
    const cible = evenement.target;
    return cible && typeof cible.closest === 'function' ? cible.closest('a[href]') : null;
  }

  function intercepterLien(evenement) {
    if (!protectionActive) return;
    const lien = lienDepuisEvenement(evenement);
    if (!lien || !estBloquee(lien.href, location.href)) return;

    evenement.preventDefault();
    evenement.stopPropagation();
    if (typeof evenement.stopImmediatePropagation === 'function') evenement.stopImmediatePropagation();
    envoyer({ type: 'blocageIntercepte', url: lien.href });
    montrerToast();
  }

  function surveillerUrl() {
    if (location.href === derniereUrl) return;
    derniereUrl = location.href;
    verifier();
  }

  document.addEventListener('click', intercepterLien, true);
  document.addEventListener('auxclick', intercepterLien, true);
  document.addEventListener('keydown', (evenement) => {
    if (evenement.key === 'Escape' && interfaceRacine && interfaceRacine.ecran.classList.contains('visible')) {
      evenement.preventDefault();
      retournerOuJetais();
    }
  }, true);

  const observateur = new MutationObserver(() => {
    surveillerUrl();
    if (protectionActive && estBloquee(location.href)) couperLesVideos();
  });
  observateur.observe(document, { subtree: true, childList: true });
  window.addEventListener('popstate', surveillerUrl);
  window.addEventListener('pageshow', verifier);
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) verifier();
  });
  document.addEventListener('play', (evenement) => {
    if (!protectionActive || !estBloquee(location.href)) return;
    const media = evenement.target;
    if (media && typeof media.pause === 'function') {
      media.pause();
      media.muted = true;
    }
  }, true);

  chrome.runtime.onMessage.addListener((message, _sender, repondre) => {
    if (message.type === 'afficherBlocage' || message.type === 'expirationAcces') {
      protectionActive = true;
      appliquerMasquage(true);
      montrerEcran();
      repondre({ ok: true });
    } else if (message.type === 'accesAccorde') {
      verifier().then(() => repondre({ ok: true }));
      return true;
    }
  });

  setInterval(surveillerUrl, 650);
  setInterval(verifier, 15000);
  verifier();
})();

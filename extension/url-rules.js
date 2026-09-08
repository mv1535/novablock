/* Règles d'URL partagées par le service worker, les pages et le script de contenu.
 * Ce fichier reste volontairement sans dépendance afin d'être testable dans Node.
 */
(function (racine, fabrique) {
  const api = fabrique();
  if (typeof module === 'object' && module.exports) module.exports = api;
  racine.NovablockRules = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  const MOTIFS_BLOQUES = [
    /^https?:\/\/([\w-]+\.)*youtube\.com\/shorts(?:\/|$|\?)/i,
    /^https?:\/\/([\w-]+\.)*youtube\.com\/hashtag\/[^/]+\/shorts(?:\/|$|\?)/i,
    /^https?:\/\/([\w-]+\.)*instagram\.com\/reels?(?:\/|$|\?)/i,
    /^https?:\/\/([\w-]+\.)*instagram\.com\/[^/]+\/reels(?:\/|$|\?)/i,
    /^https?:\/\/([\w-]+\.)*facebook\.com\/reels?(?:\/|$|\?)/i,
    /^https?:\/\/([\w-]+\.)*facebook\.com\/[^/]+\/reels(?:\/|$|\?)/i,
    /^https?:\/\/([\w-]+\.)*facebook\.com\/watch\/?\?.*\bis_reel(?:=1|=true)?(?:&|$)/i,
    /^https?:\/\/fb\.watch\//i
  ];

  function normaliserUrl(valeur, base) {
    if (!valeur || typeof valeur !== 'string') return '';
    try {
      return new URL(valeur, base || undefined).href;
    } catch (_erreur) {
      return '';
    }
  }

  function estBloquee(valeur, base) {
    const url = normaliserUrl(valeur, base);
    return Boolean(url && MOTIFS_BLOQUES.some((motif) => motif.test(url)));
  }

  function origineLisible(valeur) {
    const url = normaliserUrl(valeur);
    if (!url) return 'votre application';
    try {
      const analyse = new URL(url);
      const hote = analyse.hostname.replace(/^www\./, '');
      if (hote.endsWith('youtube.com')) return 'YouTube';
      if (hote.endsWith('instagram.com')) return 'Instagram';
      if (hote.endsWith('facebook.com') || hote === 'fb.watch') return 'Facebook';
      return hote;
    } catch (_erreur) {
      return 'votre application';
    }
  }

  function repliSain(valeur) {
    const url = normaliserUrl(valeur);
    if (!url) return 'https://www.youtube.com/';
    const analyse = new URL(url);
    const hote = analyse.hostname.toLowerCase();
    if (hote.endsWith('instagram.com')) return 'https://www.instagram.com/';
    if (hote.endsWith('facebook.com') || hote === 'fb.watch') return 'https://www.facebook.com/';
    return 'https://www.youtube.com/';
  }

  return Object.freeze({
    estBloquee,
    normaliserUrl,
    origineLisible,
    repliSain
  });
});

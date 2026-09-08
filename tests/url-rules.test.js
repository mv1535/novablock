'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const rules = require('../extension/url-rules.js');

test('bloque les lecteurs courts connus', () => {
  const blocked = [
    'https://www.youtube.com/shorts/abc123',
    'https://m.youtube.com/shorts/abc123?feature=share',
    'https://youtube.com/hashtag/chat/shorts',
    'https://www.instagram.com/reel/ABC/',
    'https://instagram.com/reels/',
    'https://facebook.com/reel/123',
    'https://www.facebook.com/watch/?v=12&is_reel=1',
    'https://fb.watch/abc/'
  ];
  for (const url of blocked) assert.equal(rules.estBloquee(url), true, url);
});

test('laisse les parcours normaux et Explorer intacts', () => {
  const allowed = [
    'https://www.youtube.com/watch?v=abc123',
    'https://www.youtube.com/results?search_query=shorts+film',
    'https://www.instagram.com/explore/',
    'https://www.instagram.com/p/ABC/',
    'https://www.facebook.com/watch/?v=12',
    'https://example.com/shorts/abc'
  ];
  for (const url of allowed) assert.equal(rules.estBloquee(url), false, url);
});

test('résout les liens relatifs avant de les classifier', () => {
  assert.equal(rules.estBloquee('/shorts/abc', 'https://www.youtube.com/feed/subscriptions'), true);
  assert.equal(rules.estBloquee('/watch?v=abc', 'https://www.youtube.com/'), false);
});

test('choisit un accueil sain propre à chaque plateforme', () => {
  assert.equal(rules.repliSain('https://m.youtube.com/shorts/x'), 'https://www.youtube.com/');
  assert.equal(rules.repliSain('https://instagram.com/reel/x'), 'https://www.instagram.com/');
  assert.equal(rules.repliSain('https://fb.watch/x'), 'https://www.facebook.com/');
});

test('le manifeste charge les règles avant le script de contenu', () => {
  const manifestPath = path.join(__dirname, '..', 'extension', 'manifest.json');
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  assert.equal(manifest.version, '1.1.0');
  assert.deepEqual(manifest.content_scripts[0].js, ['url-rules.js', 'content.js']);
  assert.equal(manifest.content_scripts[0].matches.includes('*://fb.watch/*'), true);

  const referencedFiles = [
    manifest.background.service_worker,
    ...manifest.content_scripts.flatMap((script) => [...script.js, ...script.css]),
    manifest.options_page,
    manifest.action.default_popup
  ];
  for (const relativePath of referencedFiles) {
    assert.equal(
      fs.existsSync(path.join(__dirname, '..', 'extension', relativePath)),
      true,
      `fichier manifeste manquant: ${relativePath}`
    );
  }
});

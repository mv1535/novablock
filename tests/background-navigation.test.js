'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');

class MockEvent {
  constructor() { this.listeners = []; }
  addListener(listener) { this.listeners.push(listener); }
}

function storageArea() {
  const values = Object.create(null);
  return {
    values,
    async get(query) {
      if (typeof query === 'string') return { [query]: values[query] };
      const result = { ...query };
      for (const key of Object.keys(query || {})) {
        if (Object.prototype.hasOwnProperty.call(values, key)) result[key] = values[key];
      }
      return result;
    },
    async set(patch) { Object.assign(values, patch); },
    async remove(key) { delete values[key]; }
  };
}

function environment(initialTabs) {
  const local = storageArea();
  const session = storageArea();
  const tabs = new Map(initialTabs.map((tab) => [tab.id, { active: false, history: [], ...tab }]));
  const events = {
    message: new MockEvent(),
    installed: new MockEvent(),
    before: new MockEvent(),
    committed: new MockEvent(),
    history: new MockEvent(),
    updated: new MockEvent(),
    removed: new MockEvent(),
    activated: new MockEvent(),
    alarm: new MockEvent()
  };

  global.importScripts = () => {
    global.NovablockRules = require('../extension/url-rules.js');
  };
  global.chrome = {
    storage: { local, session },
    runtime: {
      getURL: (file = '') => `chrome-extension://novablock/${file}`,
      onMessage: events.message,
      onInstalled: events.installed
    },
    webNavigation: {
      onBeforeNavigate: events.before,
      onCommitted: events.committed,
      onHistoryStateUpdated: events.history
    },
    alarms: {
      create() {},
      onAlarm: events.alarm
    },
    windows: { async update() {} },
    tabs: {
      onUpdated: events.updated,
      onRemoved: events.removed,
      onActivated: events.activated,
      async get(tabId) {
        if (!tabs.has(tabId)) throw new Error('No tab');
        return tabs.get(tabId);
      },
      async update(tabId, patch) {
        const tab = await this.get(tabId);
        if (patch.url) tab.url = patch.url;
        if (typeof patch.active === 'boolean') tab.active = patch.active;
        return tab;
      },
      async goBack(tabId) {
        const tab = await this.get(tabId);
        if (!tab.history || tab.history.length < 2) throw new Error('No history');
        tab.history.pop();
        tab.url = tab.history[tab.history.length - 1];
        return tab;
      },
      async remove(tabId) { tabs.delete(tabId); },
      async query(query) {
        return [...tabs.values()].filter((tab) => !query.active || tab.active);
      },
      async create(properties) {
        const id = Math.max(0, ...tabs.keys()) + 1;
        const tab = { id, windowId: 1, active: properties.active, url: properties.url, history: [properties.url] };
        if (Number.isInteger(properties.openerTabId)) tab.openerTabId = properties.openerTabId;
        tabs.set(id, tab);
        return tab;
      },
      async sendMessage() { return { ok: true }; }
    }
  };

  const backgroundPath = path.resolve(__dirname, '../extension/background.js');
  delete require.cache[backgroundPath];
  require(backgroundPath);

  async function message(payload, senderTabId) {
    const listener = events.message.listeners[0];
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error('Message timeout')), 1000);
      listener(payload, { tab: Number.isInteger(senderTabId) ? tabs.get(senderTabId) : undefined }, (value) => {
        clearTimeout(timeout);
        resolve(value);
      });
    });
  }

  return { tabs, local, session, events, message };
}

test('revient par l’historique et conserve la page exacte', { concurrency: false }, async () => {
  const safe = 'https://www.youtube.com/results?search_query=menuiserie';
  const blocked = 'https://www.youtube.com/shorts/abc';
  const env = environment([{ id: 1, windowId: 1, active: true, url: blocked, history: [safe, blocked] }]);
  const result = await env.message({ type: 'retourSansIrritant' }, 1);
  assert.equal(result.methode, 'historique');
  assert.equal(env.tabs.get(1).url, safe);
});

test('saute plusieurs Shorts avec un seul clic', { concurrency: false }, async () => {
  const safe = 'https://www.youtube.com/feed/subscriptions';
  const env = environment([{
    id: 2,
    windowId: 1,
    active: true,
    url: 'https://www.youtube.com/shorts/c',
    history: [safe, 'https://www.youtube.com/shorts/a', 'https://www.youtube.com/shorts/b', 'https://www.youtube.com/shorts/c']
  }]);
  const result = await env.message({ type: 'retourSansIrritant' }, 2);
  assert.equal(result.methode, 'historique');
  assert.equal(env.tabs.get(2).url, safe);
});

test('ferme un nouvel onglet de Short et réactive son onglet source', { concurrency: false }, async () => {
  const env = environment([
    { id: 3, windowId: 1, active: false, url: 'https://www.youtube.com/', history: ['https://www.youtube.com/'] },
    { id: 4, windowId: 1, active: true, openerTabId: 3, url: 'https://www.youtube.com/shorts/x', history: ['https://www.youtube.com/shorts/x'] }
  ]);
  const result = await env.message({ type: 'retourSansIrritant' }, 4);
  assert.equal(result.methode, 'onglet-source');
  assert.equal(env.tabs.has(4), false);
  assert.equal(env.tabs.get(3).active, true);
});

test('utilise un accueil sûr si aucun historique ni onglet source n’existe', { concurrency: false }, async () => {
  const env = environment([{
    id: 5,
    windowId: 1,
    active: true,
    url: 'https://www.youtube.com/shorts/direct',
    history: ['https://www.youtube.com/shorts/direct']
  }]);
  const result = await env.message({ type: 'retourSansIrritant' }, 5);
  assert.equal(result.methode, 'accueil');
  assert.equal(env.tabs.get(5).url, 'https://www.youtube.com/');
});

test('un clic intercepté ne modifie jamais l’URL courante', { concurrency: false }, async () => {
  const safe = 'https://www.youtube.com/results?search_query=atelier';
  const env = environment([{ id: 6, windowId: 1, active: true, url: safe, history: [safe] }]);
  await env.message({ type: 'blocageIntercepte', url: 'https://www.youtube.com/shorts/nope' }, 6);
  assert.equal(env.tabs.get(6).url, safe);
  assert.equal(env.local.values.compteurBlocages, 1);
});

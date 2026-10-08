import React from 'react';
import { createRoot } from 'react-dom/client';
window.__ModuleLoader__ = { load({ id, factory }) {
  if (id !== 'dsh-code-review-graph') throw new Error('Unexpected native client module');
  window.crgClient = factory(specifier => {
    if (specifier !== 'react') throw new Error(`Unexpected client external: ${specifier}`);
    return React;
  });
} };
window.mountGraph = () => {
const { apply } = window.crgClient;
let descriptor, body;
const undo = [];
const bytes = path => Uint8Array.from(atob(window.assets[path.split('/').at(-1)]), c => c.charCodeAt(0));
const response = path => ({ ok: true, value: { data: window.readerVersion === 'old' ? window.assets[path.split('/').at(-1)] : bytes(path) } });
const reader = window.readerVersion === 'old'
  ? { readAll: async (_session, path) => response(path), readRelated: async (_session, _base, path) => response(path) }
  : { readBytes: async (_session, path) => response(path) };
const ctx = {
  effect: fn => { const dispose = fn(); if (typeof dispose === 'function') undo.push(dispose); return dispose; },
  sidebarRightTabs: { register: value => { descriptor = value; return () => {}; } },
  slots: { inject: (_name, fn) => fn(), register: (options, component) => { body = { options, component }; return () => {}; } },
  remote: { workspaceFiles: reader },
};
apply(ctx);
if (body.options.key !== descriptor.id) throw new Error('Sidebar body must register under the native tab provider ID');
window.clientRegistration = { id: descriptor.id, kind: descriptor.kind, key: body.options.key };
const signal = new AbortController().signal;
const Graph = body.component;
createRoot(document.getElementById('root')).render(<Graph sessionId="fixture-session" useTabInfo={() => ({ tab: { signal } })} />);
};

import React from 'react';
import { createRoot } from 'react-dom/client';
import { apply } from '../src/client.tsx';
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
if (body.options.key !== descriptor.kind) throw new Error('Sidebar body must register under the tab kind');
window.clientRegistration = { id: descriptor.id, kind: descriptor.kind, key: body.options.key };
const signal = new AbortController().signal;
const Graph = body.component;
createRoot(document.getElementById('root')).render(<Graph sessionId="fixture-session" useTabInfo={() => ({ tab: { signal } })} />);

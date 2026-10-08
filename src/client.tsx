import React, { useEffect, useState } from 'react';
import type { Context } from '@deepseek-ai/cordis';
import type {} from '@deepseek-ai/dsh-client-ui-sidebar-right/client';
import type {} from '@deepseek-ai/dsh-client-ui-slots';
import type {} from '@deepseek-ai/dsh-client-ui-renderer/client';
import type {} from '@deepseek-ai/dsh-api-remotes/client';
import type {} from '@deepseek-ai/dsh-api-workspace-files/client';
import { inlineGraph } from './html.ts';

export const inject = ['slots', 'sidebarRightTabs', 'remote', 'remote.workspaceFiles'];
export const name = 'code-review-graph-client';
type ReadResult = { ok: true; value: { data: Uint8Array | string } } | { ok: false; error: { message: string } };
type WorkspaceReader = {
  readBytes?: (session: string, path: string, options: object, signal: AbortSignal) => Promise<ReadResult>;
  readAll?: (session: string, path: string, signal: AbortSignal) => Promise<ReadResult>;
  readRelated?: (session: string, base: string, path: string, signal: AbortSignal) => Promise<ReadResult>;
};
export async function readAsset(reader: WorkspaceReader, session: string, path: string, signal: AbortSignal, base?: string): Promise<string> {
  const result = reader.readBytes ? await reader.readBytes(session, path, base ? { baseFile: base } : {}, signal)
    : base && reader.readRelated ? await reader.readRelated(session, base, path, signal)
    : reader.readAll ? await reader.readAll(session, path, signal) : (() => { throw new Error('Unsupported DSH file reader'); })();
  if (!result.ok) throw new Error(result.error.message);
  if (result.value.data instanceof Uint8Array) return new TextDecoder().decode(result.value.data);
  const base64 = result.value.data;
  if (typeof base64 !== 'string') throw new Error('Invalid graph asset response');
  return new TextDecoder().decode(Uint8Array.from(atob(base64), c => c.charCodeAt(0)));
}

export function apply(ctx: Context): void {
  const id = 'dsh-code-review-graph';
  ctx.effect(() => ctx.sidebarRightTabs.register({ id, kind: 'code-review-graph', priority: 'builtin', title: () => 'Code graph / 代码图谱', guide: [{ id: 'graph', order: 30, title: () => 'Code graph / 代码图谱', description: () => 'Explore dependencies, changes and execution paths locally.' }] }));
  function Graph({ sessionId, useTabInfo }: { sessionId: string; useTabInfo: () => { tab: { signal: AbortSignal } } }) {
    const { tab } = useTabInfo();
    const [html, setHtml] = useState('');
    const [error, setError] = useState('');
    const [generation, refresh] = useState(0);
    const download = () => {
      const url = URL.createObjectURL(new Blob([html], { type: 'text/html;charset=utf-8' }));
      const link = document.createElement('a'); link.href = url; link.download = 'code-review-graph.html'; link.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    };
    useEffect(() => {
      const life = new AbortController();
      const signal = AbortSignal.any([life.signal, tab.signal]);
      const base = '.code-review-graph/graph.html';
      const reader = ctx.remote.workspaceFiles as unknown as WorkspaceReader;
      setError('');
      void readAsset(reader, sessionId, base, signal).then(html => inlineGraph(html, path => readAsset(reader, sessionId, path, signal, base))).then(result => {
        if (!signal.aborted) setHtml(result);
      }).catch(error => { if (!signal.aborted) setError(String(error)); });
      return () => life.abort();
    }, [sessionId, generation, tab.signal]);
    return <section style={{ height: '100%', display: 'flex', flexDirection: 'column', gap: 8 }}>
      <div><button type="button" onClick={() => refresh(n => n + 1)}>Refresh / 刷新</button> <button type="button" disabled={!html} onClick={download}>Export HTML / 导出 HTML</button></div>
      {error && <p role="status">Generate the graph with crg_visualize, then refresh. / 使用 crg_visualize 生成图谱后刷新。<br />{error}</p>}
      {html && <iframe title="Interactive code graph / 交互代码图谱" sandbox="allow-scripts allow-downloads" srcDoc={html} style={{ width: '100%', flex: 1, border: 0 }} />}
    </section>;
  }
  ctx.effect(() => ctx.slots.inject('sidebar.right.pane.tab', () => ctx.slots.register({ name: 'sidebar.right.pane.tab', key: 'code-review-graph' }, Graph)));
}

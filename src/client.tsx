import React, { useEffect, useRef, useState } from 'react';
import type { Context } from '@deepseek-ai/cordis';
import type {} from '@deepseek-ai/dsh-client-ui-sidebar-right/client';
import type {} from '@deepseek-ai/dsh-client-ui-slots';
import type {} from '@deepseek-ai/dsh-client-ui-renderer/client';
import type {} from '@deepseek-ai/dsh-api-remotes/client';
import type {} from '@deepseek-ai/dsh-api-workspace-files/client';
import { inlineGraph } from './html.ts';

export const inject = ['slots', 'sidebarRightTabs', 'remote', 'remote.workspaceFiles', 'remote.commands'];
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
    const [notice, setNotice] = useState('');
    const [busy, setBusy] = useState(false);
    const operation = useRef<AbortController>();
    const [generation, refresh] = useState(0);
    useEffect(() => {
      setHtml(''); setNotice(''); setError(''); setBusy(false);
      return () => { operation.current?.abort(); operation.current = undefined; };
    }, [sessionId, tab.signal]);
    const execute = async (command: 'crg-setup' | 'crg-graph') => {
      if (operation.current) return;
      const current = new AbortController(); operation.current = current;
      const signal = AbortSignal.any([current.signal, tab.signal]);
      setBusy(true); setError('');
      setNotice(command === 'crg-setup' ? '正在准备引擎；首次需要下载依赖… / Preparing engine; first use downloads dependencies…' : '正在准备引擎并生成图谱… / Preparing engine and generating graph…');
      try {
        const result = await ctx.remote.commands.execute(sessionId as Parameters<typeof ctx.remote.commands.execute>[0], `/${command}`, [], signal);
        signal.throwIfAborted();
        if (!result.ok) throw new Error(result.error.message);
        if (!result.value) throw new Error('Graph commands are unavailable. Enable the Host component. / 图谱命令不可用，请启用插件组件。');
        if (result.value.result.kind === 'error') throw new Error(result.value.result.text);
        setNotice(result.value.result.text ?? '完成 / Done');
        if (command === 'crg-graph') refresh(n => n + 1);
      } catch (error) {
        if (operation.current !== current) return;
        if (current.signal.aborted) setNotice('已取消，可重新尝试。 / Cancelled. You can retry.');
        else if (!tab.signal.aborted) { setNotice(''); setError(String(error)); }
      } finally {
        if (operation.current === current) { operation.current = undefined; setBusy(false); }
      }
    };
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
      <div>
        <button type="button" disabled={busy} onClick={() => void execute('crg-graph')}>{html ? '更新图谱 / Update graph' : '准备引擎并生成图谱 / Set up and generate graph'}</button>{' '}
        <button type="button" disabled={busy} onClick={() => void execute('crg-setup')}>准备引擎 / Set up engine</button>{' '}
        {busy && <button type="button" onClick={() => operation.current?.abort()}>取消 / Cancel</button>}{' '}
        <button type="button" disabled={busy} onClick={() => refresh(n => n + 1)}>Refresh / 重新读取</button>{' '}
        <button type="button" disabled={!html} onClick={download}>Export HTML / 导出 HTML</button>
      </div>
      {!html && !busy && <p>点击“准备引擎并生成图谱”即可开始，无需聊天或填写参数。首次会在 DSH 的隔离目录下载引擎依赖，需要 uv 或 Python 3.10+。 / Click Set up and generate graph. No chat or parameters needed. First use downloads isolated engine dependencies; uv or Python 3.10+ is required.</p>}
      {notice && <p role="status" style={{ whiteSpace: 'pre-wrap' }}>{notice}</p>}
      {error && <details open><summary>无法加载或生成图谱 / Graph unavailable</summary><p role="alert" style={{ whiteSpace: 'pre-wrap' }}>{error}</p></details>}
      {html && <iframe title="Interactive code graph / 交互代码图谱" sandbox="allow-scripts allow-downloads" srcDoc={html} style={{ width: '100%', flex: 1, border: 0 }} />}
    </section>;
  }
  ctx.effect(() => ctx.slots.inject('sidebar.right.pane.tab', () => ctx.slots.register({ name: 'sidebar.right.pane.tab', key: id }, Graph)));
}

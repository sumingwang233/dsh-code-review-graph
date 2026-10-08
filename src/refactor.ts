import type { Context } from '@deepseek-ai/cordis';
import type { ToolRunContext } from '@deepseek-ai/dsh-tools';
import type {} from '@deepseek-ai/dsh-fs';
import type {} from '@deepseek-ai/dsh-sandbox-policy';
import { checkedPath, sha256 } from './safety.ts';

export interface EditPlan { files: { path: string; before_sha256: string; after_content: string; edit_count: number }[] }
export async function commitPlan(ctx: Context, exec: ToolRunContext, root: string, plan: EditPlan) {
  if (!exec.agent) throw new Error('Refactor requires a session-owned agent');
  const policy = ctx.sandboxPolicy.resolve({ session: exec.agent.session });
  if (policy.mode === 'read-only') throw new Error('Refactor is denied by read-only policy');
  if (!Array.isArray(plan.files)) throw new Error('Invalid edit plan');
  const prepared = [];
  const seen = new Set<string>();
  for (const file of plan.files) {
    if (typeof file.path !== 'string' || !/^[a-f0-9]{64}$/.test(file.before_sha256) || typeof file.after_content !== 'string' || !Number.isInteger(file.edit_count) || file.edit_count < 0) throw new Error('Invalid edit plan file');
    exec.signal.throwIfAborted();
    const path = await checkedPath(root, file.path);
    if (seen.has(path)) throw new Error('Duplicate edit target');
    seen.add(path);
    const target = await ctx.fs.resolve(path, { cwd: root, signal: exec.signal });
    const before = await ctx.fs.stat(target, exec.signal);
    if (!before || before.type !== 'file') throw new Error('Edit target is not a regular file');
    const bytes = await ctx.fs.readBytes(target, exec.signal, 32 * 1024 * 1024);
    if (sha256(bytes) !== file.before_sha256) throw new Error(`Stale edit plan: ${path}`);
    const after = await ctx.fs.stat(target, exec.signal);
    if (after?.version !== before.version) throw new Error(`File changed during preflight: ${path}`);
    const intent = await ctx.waterfall('fs/write-intent', target, exec, () => undefined);
    if (intent && (intent.kind !== 'replaceIfVersion' || intent.version !== before.version)) throw new Error(`File intent disagrees with edit plan: ${path}`);
    prepared.push({ file, path, target, original: Buffer.from(bytes).toString('utf8'), intent: intent ?? { kind: 'replaceIfVersion' as const, version: before.version } });
  }
  const applied: string[] = [];
  const recovery: EditPlan['files'] = [];
  try {
    for (const item of prepared) {
      exec.signal.throwIfAborted();
      await checkedPath(root, item.path);
      const outcome = await ctx.fs.writeText(item.target, item.file.after_content, item.intent, exec.signal, policy);
      ctx.emit('fs/observed', item.target, { kind: 'present', version: outcome.version }, exec);
      applied.push(item.path);
      recovery.push({ path: item.path, before_sha256: sha256(item.file.after_content), after_content: item.original, edit_count: item.file.edit_count });
    }
  } catch (error) {
    // Return the complete recovery patch through the tool output; never silently roll back a later edit.
    return { status: 'partial_failure', error: String(error), files_modified: applied, recovery_patch: { files: recovery } };
  }
  return { status: 'ok', files_modified: applied, edits_applied: plan.files.reduce((n, f) => n + f.edit_count, 0) };
}

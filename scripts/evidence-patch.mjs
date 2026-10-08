// Emit a native apply_patch document; this script never writes source or evidence files.
import { readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';

const version = process.argv[2];
if (!['0.1.5-rc.2', '0.2.0-rc.2'].includes(version)) throw new Error('Unsupported DSH release');
const input = JSON.parse(await readFile(`test-results/session-${version}-${process.platform}.json`, 'utf8'));
if (input.calls.at(-1)?.name !== 'mcp__code_review_graph__run_postprocess_tool' || input.calls.at(-1)?.result.isError) throw new Error('Incomplete session evidence');
const engine = JSON.parse(await readFile('engine.json', 'utf8'));
const artifact = input.calls.find(c => c.name === 'crg_visualize').result.value.path;
const temporary = dirname(dirname(dirname(artifact)));
const temporarySpellings = [temporary, ...input.calls.map(c => c.args.repo_root).filter(p => typeof p === 'string')];
const forms = [...new Set(temporarySpellings.flatMap(p => [p, p.replaceAll('\\', '/'), p.replaceAll('/', '\\'), p.replaceAll('/', '\\').replaceAll('\\', '\\\\')]))];
function redact(value) {
  if (typeof value === 'string') {
    for (const form of forms) value = value.replaceAll(form, '<TEST_TMP>');
    return value;
  }
  if (Array.isArray(value)) return value.map(redact);
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([k, v]) => [redact(k), redact(v)]));
  return value;
}
const document = redact({
  ...input,
  engine: { baseline: engine.baseline, commit: engine.commit },
  provenance: 'Captured by tests/integration.mjs using unmodified release packages and the real local contribution engine.',
  redaction: 'Only fixture temporary paths are replaced by <TEST_TMP>. Duplicate rendered text is omitted when result.value is present; values and error content are retained.',
  calls: input.calls.map(call => ({ ...call, result: call.result.value === undefined ? call.result : { ...call.result, content: undefined } })),
});
const content = JSON.stringify(document, null, 2);
const target = resolve(`docs/evidence/session-${version}-${process.platform}.json`).replaceAll('\\', '/');
process.stdout.write(`*** Begin Patch\n*** Add File: ${target}\n${content.split('\n').map(line => '+' + line).join('\n')}\n*** End Patch\n`);

import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, writeFile, access } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { execFileSync } from 'node:child_process';
import { cli, version } from './runtime.mjs';
import { scrubEnv } from '../dist/safety.js';
const tarball = resolve('dsh-code-review-graph-0.1.0.tgz');

test(`DSH ${version}: real Web/headless bundle lifecycle and Desktop ownership`, { timeout: 240000 }, async () => {
  await access(tarball);
  const home = await mkdtemp(join(tmpdir(), 'dsh-crg-profile-'));
  const env = { ...scrubEnv(process.env), DSH_HOME: home, CI: '1' };
  const log = [];
  function invoke(args, expectFailure = false) {
    try { const text = execFileSync(process.execPath, [cli, ...args], { env, encoding: 'utf8', windowsHide: true, timeout: 120000, stdio: 'pipe' }); log.push({ args, outcome: 'ok', text }); if (expectFailure) assert.fail('Expected Desktop ownership rejection'); return text; }
    catch (error) { if (!expectFailure) throw error; log.push({ args, outcome: 'owned-by-desktop', text: String(error.stderr) }); }
  }
  for (const profile of ['web', 'headless']) {
    invoke(['plugin', '--profile', profile, 'add', tarball]);
    const manifestPath = join(home, 'profiles', profile, 'package.json');
    let manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
    assert.ok(manifest.dependencies['dsh-code-review-graph']);
    assert.ok(manifest.dsh.profile.bundles.includes('dsh-code-review-graph'));
    manifest.userOwned = { preserve: true }; await writeFile(manifestPath, JSON.stringify(manifest, null, 2));
    const before = await readFile(manifestPath);
    // The upstream adapter recognizes this manifest and avoids an unnecessary CLI rewrite on reinstall.
    invoke(['plugin', '--profile', profile, 'add', tarball]);
    manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
    assert.deepEqual(manifest.userOwned, { preserve: true });
    const dump = invoke(['--profile', profile, '--dump-config']);
    assert.ok(dump.includes('dsh-code-review-graph'), 'Native patch must join the profile composition');
    invoke(['plugin', '--profile', profile, 'remove', 'dsh-code-review-graph']);
    manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
    assert.ok(!manifest.dependencies?.['dsh-code-review-graph']);
    assert.ok(!manifest.dsh.profile.bundles.includes('dsh-code-review-graph'));
    assert.deepEqual(manifest.userOwned, { preserve: true });
    log.push({ profile, retained: 'userOwned', firstInstallBytes: before.length });
  }
  invoke(['plugin', '--profile', 'desktop', 'add', tarball], true);
  await mkdir('test-results', { recursive: true });
  await writeFile(`test-results/install-${version}-${process.platform}.json`, JSON.stringify({ release: version, isolatedHome: home, log }, null, 2));
});

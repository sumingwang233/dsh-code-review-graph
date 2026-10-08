import test from 'node:test';
import assert from 'node:assert/strict';
import { _electron as electron } from '@playwright/test';
import { mkdtemp, mkdir, readFile, writeFile, copyFile, realpath } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve, dirname, delimiter } from 'node:path';
import { execFileSync } from 'node:child_process';
import { scrubEnv, sha256, contained } from '../dist/safety.js';
const version = process.env.DSH_VERSION ?? '0.2.0-rc.2';

const release = JSON.parse(await readFile('package.json', 'utf8')).version;

test(`Real DSH Desktop ${version}: published package install, enable, native graph and removal`, { timeout: 240000 }, async () => {
  assert.ok(process.env.DSH_DESKTOP_EXECUTABLE, 'Set DSH_DESKTOP_EXECUTABLE to an actual supported Desktop application');
  assert.ok(process.env.CRG_COMMAND, 'Set CRG_COMMAND to a prepared real engine');
  const tarball = resolve(`dsh-code-review-graph-${release}.tgz`);
  const packageSha256 = sha256(await readFile(tarball));
  const dir = await mkdtemp(join(tmpdir(), 'dsh-crg-desktop-'));
  for (const name of ['home', 'appdata', 'user', 'electron']) await mkdir(join(dir, name));
  const home = join(dir, 'home'), profile = join(home, 'profiles', 'desktop');
  await writeFile(join(home, 'cordis.patch.yml'), '- id: ui-settings-account\n  config:\n    version: 1\n    step: done\n    completion: skipped\n');
  const env = { ...scrubEnv(process.env), DSH_HOME: home, APPDATA: join(dir, 'appdata'), USERPROFILE: join(dir, 'user'), HOME: join(dir, 'user') };
  // Reuse an existing real Python; engine installation still happens through the native UI.
  const pathKey = Object.keys(env).find(key => key.toUpperCase() === 'PATH') ?? 'PATH';
  env[pathKey] = dirname(process.env.CRG_COMMAND) + delimiter + (env[pathKey] ?? '');
  const fixture = process.env.DSH_DESKTOP_PROFILE_FIXTURE;
  if (fixture) {
    await mkdir(profile, { recursive: true });
    // Only package-manager inputs; never copy accounts, credentials, sessions or user patches.
    for (const name of ['package.json', 'pnpm-lock.yaml', 'pnpm-workspace.yaml']) await copyFile(join(fixture, name), join(profile, name));
    assert.ok(process.env.DSH_DESKTOP_PNPM, 'Provide the application bundled pnpm entry for dependency-combination reproduction');
    execFileSync(process.env.DSH_DESKTOP_EXECUTABLE, ['--expose-internals', process.env.DSH_DESKTOP_PNPM, 'install', '--frozen-lockfile'], {
      cwd: profile, env: { ...env, ELECTRON_RUN_AS_NODE: '1', CI: '1' }, timeout: 90000, windowsHide: true, stdio: 'pipe',
    });
  }
  // The official shell hardcodes 19387. Change only this test Host's listener to
  // an OS-assigned port so an existing user Desktop can keep running unchanged.
  const preload = join(dir, 'isolated-port.cjs');
  await writeFile(preload, `const net = require('node:net'); const listen = net.Server.prototype.listen; net.Server.prototype.listen = function(...args) { if (args[0] === 19387) args[0] = 0; return Reflect.apply(listen, this, args); };`);
  const app = await electron.launch({ executablePath: process.env.DSH_DESKTOP_EXECUTABLE, args: [`--user-data-dir=${join(dir, 'electron')}`], env, timeout: 45000 });
  const evidence = { release: version, plugin: release, platform: process.platform, packageSha256, variant: fixture ? 'dependency-combination' : 'clean',
    execution: 'Actual packaged Electron app; native plugin manager; real workspace-file API and CRG renderer; no model inference',
    isolation: 'Temporary DSH_HOME, userData, HOME/USERPROFILE and APPDATA; only the test Host listener uses port 0', operations: [], pageErrors: [] };
  const artifact = `test-results/desktop-${version}-${process.platform}-${evidence.variant}`;
  let page;
  try {
    const facts = await app.evaluate(({ app, BrowserWindow }, preload) => {
      // Suppress every test-owned window, including late welcome windows.
      // Never start sign-in or share the user's browser/account configuration.
      BrowserWindow.prototype.show = BrowserWindow.prototype.showInactive = () => {};
      const quiet = w => {
        w.hide();
        w.webContents.on('did-finish-load', () => {
          if (w.webContents.getURL().includes('welcome.html')) void w.webContents.executeJavaScript('window.dshWelcome?.skip()').catch(() => {});
        });
      };
      app.on('browser-window-created', (_event, w) => quiet(w));
      for (const w of BrowserWindow.getAllWindows()) quiet(w);
      const cp = process.getBuiltinModule('node:child_process'), spawn = cp.spawn;
      cp.spawn = function(command, args, options) {
        if (args?.some(x => /dsh-desktop-host[\\/]lib[\\/]index.js$/.test(x))) args = ['--require', preload, ...args];
        return spawn(command, args, options);
      };
      process.getBuiltinModule('node:module').syncBuiltinESMExports();
      return { version: app.getVersion(), userData: app.getPath('userData') };
    }, preload);
    assert.equal(facts.version, version, 'Do not substitute a different Desktop release');
    assert.equal(resolve(facts.userData).toLowerCase(), resolve(dir, 'electron').toLowerCase());
    await app.evaluate(({ BrowserWindow }) => { for (const w of BrowserWindow.getAllWindows()) w.hide(); });
    for (let attempt = 0; attempt < 450; attempt++) {
      page = app.windows().find(p => !p.isClosed() && p.url().startsWith('dsh-app://'));
      if (page) break;
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    assert.ok(page, 'Native workspace must start without signing in');
    page.on('pageerror', error => evidence.pageErrors.push(error.message));
    await page.getByRole('button', { name: /^(插件|Plugins)$/ }).waitFor({ timeout: 45000 });
    const manifestPath = join(profile, 'package.json');
    const before = JSON.parse(await readFile(manifestPath, 'utf8'));
    before.crgDesktopTest = { preserve: true }; await writeFile(manifestPath, JSON.stringify(before, null, 2));
    await page.evaluate(() => {
      const loader = window.__ModuleLoader__, load = loader.load.bind(loader);
      // Observe the real factory/apply, without replacing any native services.
      loader.load = entry => {
        if (entry.id === 'dsh-code-review-graph') {
          const factory = entry.factory;
          entry = { ...entry, factory: require => {
            const exports = factory(require);
            return { ...exports, apply: (ctx, ...args) => { window.__crgDesktopContext = ctx; return exports.apply(ctx, ...args); } };
          } };
        }
        return load(entry);
      };
    });
    async function management(endpoint, action) {
      const response = page.waitForResponse(r => new URL(r.url()).pathname.endsWith(`/pluginManager/${endpoint}`), { timeout: 120000 });
      await action(); const envelope = await (await response).json();
      assert.equal(envelope.result.ok, true, JSON.stringify(envelope));
      evidence.operations.push({ endpoint, result: envelope.result.value });
      return envelope.result.value;
    }
    async function install() {
      await page.getByRole('button', { name: /^(添加插件|Add plugin)$/ }).click();
      await page.getByPlaceholder(/例如 dsh-plugin-whale-pet|e\.g\. dsh-plugin-whale-pet/).fill(tarball);
      const result = await management('installBundle', () => page.getByRole('button', { name: /^(安装|Install)$/ }).click());
      assert.equal(result.packageResult.exitCode, 0); assert.notEqual(result.packageResult.timedOut, true);
      assert.equal(result.application, 'applied');
      await management('setBundleEnabled', () => page.getByRole('button', { name: /^(立即启用|Enable now)$/ }).click());
      await page.waitForFunction(() => window.__crgDesktopContext?.sidebarRightTabs.entries().some(t => t.id === 'dsh-code-review-graph'));
      const installed = JSON.parse(await readFile(join(profile, 'node_modules', 'dsh-code-review-graph', 'package.json'), 'utf8'));
      assert.equal(installed.version, release);
    }
    await page.getByRole('button', { name: /^(插件|Plugins)$/ }).click();
    await install();
    // Switch to a real session and use its actual workspace-file permission path.
    // Theme plugins may cover the stock button; invoke its real handler without
    // testing unrelated themes' hit targets or changing their configuration.
    await page.getByRole('button', { name: /^(新建会话|New session)$/ }).first().dispatchEvent('click');
    await page.locator('[data-sidebar-right-session]').first().waitFor({ state: 'attached' });
    const sessionId = await page.locator('[data-sidebar-right-session]').first().getAttribute('data-sidebar-right-session');
    const workspace = join(dir, 'user', 'Documents', 'deepseek-harness', 'default-workspace');
    await mkdir(workspace, { recursive: true });
    const cwd = await realpath(workspace);
    assert.ok(contained(await realpath(dir), await realpath(cwd)), 'Graph fixture must remain inside isolated test directory');
    // An empty GUI draft may not yet exist on the Host. Adopt its preallocated
    // identity through the actual Session Controller, without starting a model.
    await page.evaluate(({ sessionId, cwd }) => new Promise((resolve, reject) => {
      window.__crgDesktopContext.inject(['sessions'], async ctx => {
        try { resolve(await ctx.sessions.create({ sessionId, cwd })); } catch (error) { reject(error); }
      });
    }), { sessionId, cwd });
    execFileSync('git', ['init', cwd], { stdio: 'pipe', windowsHide: true });
    await writeFile(join(cwd, 'demo.py'), 'def total(a, b):\n    return a + b\n\ndef main():\n    return total(2, 3)\n');
    await page.evaluate(sessionId => new Promise(resolve => {
      window.__crgDesktopContext.inject(['sidebarRight'], ctx => { ctx.sidebarRight.openTabIn(sessionId, 'code-review-graph'); resolve(); });
    }), sessionId);
    const commandResponse = page.waitForResponse(r => new URL(r.url()).pathname.endsWith('/commands/execute'), { timeout: 150000 });
    await page.getByRole('button', { name: '准备引擎并生成图谱 / Set up and generate graph' }).click();
    const command = await (await commandResponse).json();
    assert.equal(command.result.ok, true, JSON.stringify(command));
    assert.equal(command.result.value.result.kind, 'success', JSON.stringify(command));
    const engineStamp = JSON.parse(await readFile(join(home, 'code-review-graph/engine/dsh-crg-source.json'), 'utf8'));
    assert.equal(engineStamp.source, JSON.parse(await readFile('engine.json', 'utf8')).source);
    evidence.operations.push({ endpoint: 'commands/execute', line: '/crg-graph', result: command.result.value });
    evidence.enginePreparation = { nativeButton: true, isolated: true, pinnedSource: engineStamp.source };
    const frame = page.frameLocator('iframe[title="Interactive code graph / 交互代码图谱"]');
    await frame.locator('#graph-svg circle, #graph-svg .node-shape').first().waitFor({ timeout: 20000 });
    await frame.locator('#search').fill('total'); await frame.locator('.sr-item').first().waitFor();
    const exportedPath = join(dir, 'code-review-graph.html');
    // Keep Electron's real download pipeline; supply only the save destination.
    await app.evaluate(({ BrowserWindow }, path) => {
      const sessions = new Set(BrowserWindow.getAllWindows().map(w => w.webContents.session));
      for (const session of sessions) session.once('will-download', (_event, item) => {
        item.setSavePath(path);
        globalThis.__crgDownload = { filename: item.getFilename() };
        item.once('done', (_event, state) => { globalThis.__crgDownload.state = state; });
      });
    }, exportedPath);
    await page.getByRole('button', { name: 'Export HTML / 导出 HTML' }).click();
    let exported;
    for (let attempt = 0; attempt < 100; attempt++) {
      exported = await readFile(exportedPath, 'utf8').catch(() => undefined);
      if (exported) break;
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    evidence.download = await app.evaluate(() => globalThis.__crgDownload);
    assert.ok(exported?.includes('graph-svg'), `Native Electron export must save a complete graph HTML file: ${JSON.stringify(evidence.download)}`);
    evidence.graph = { nativeSidebar: true, nativeGenerationButton: true, actualWorkspaceReader: true, search: true, export: true };
    await page.getByRole('button', { name: /^(插件|Plugins)$/ }).click();
    async function remove() {
      const card = page.getByRole('button', { name: /^(查看|View) dsh-code-review-graph$/ });
      const uninstall = page.getByRole('button', { name: /^(卸载|Uninstall) dsh-code-review-graph$/ });
      await card.or(uninstall).first().waitFor();
      if (await card.isVisible()) await card.click();
      await uninstall.click();
      await management('removeBundle', () => page.getByRole('button', { name: /^(确认卸载|卸载|Uninstall)$/ }).last().click());
      const after = JSON.parse(await readFile(manifestPath, 'utf8'));
      assert.deepEqual(after.crgDesktopTest, { preserve: true });
      assert.deepEqual(after.dependencies ?? {}, before.dependencies ?? {});
      assert.deepEqual(after.dsh.profile.bundles, before.dsh.profile.bundles);
    }
    await remove(); await install(); await remove();
    assert.deepEqual(evidence.pageErrors, []);
    evidence.passed = true;
  } catch (error) {
    evidence.failure = String(error); await mkdir('test-results', { recursive: true });
    if (page && !page.isClosed()) { evidence.failureUI = await page.locator('body').innerText().then(text => text.slice(-3500)).catch(() => undefined); await page.screenshot({ path: `${artifact}-failure.png`, timeout: 1000 }).catch(() => {}); }
    throw error;
  } finally {
    await app.close(); await mkdir('test-results', { recursive: true });
    let text = JSON.stringify(evidence, null, 2);
    for (const root of new Set([dir, await realpath(dir)])) text = text.replaceAll(root.replaceAll('\\', '\\\\'), '<TEST_TMP>').replaceAll(root.replaceAll('\\', '/'), '<TEST_TMP>');
    await writeFile(`${artifact}.json`, text);
  }
});

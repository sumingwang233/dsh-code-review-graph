import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, readdir, mkdir, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { execFileSync } from 'node:child_process';
import { chromium } from '@playwright/test';
import { build } from 'esbuild';
import { version } from './runtime.mjs';

test(`Web/Desktop client graph, ${version} asset reader`, { timeout: 120000 }, async () => {
  const transcript = JSON.parse(await readFile(`test-results/session-${version}-${process.platform}.json`, 'utf8'));
  const entry = transcript.calls.find(c => c.name === 'crg_visualize' && c.args.mode === 'full');
  const path = entry.result.value?.path ?? JSON.parse(entry.result.content[0].text).path;
  const directory = dirname(path), root = dirname(directory);
  const bundle = await build({ entryPoints: ['tests/browser-harness.jsx'], bundle: true, format: 'iife', platform: 'browser', write: false });
  const client = await readFile('dist/client.js', 'utf8');
  const browser = await chromium.launch(process.env.PLAYWRIGHT_CHANNEL ? { channel: process.env.PLAYWRIGHT_CHANNEL } : {});
  const page = await browser.newPage({ viewport: { width: 1400, height: 900 }, acceptDownloads: true });
  const escaped = [];
  await page.route('**/*', route => { escaped.push(route.request().url()); return route.abort(); });
  const errors = []; page.on('pageerror', e => errors.push(e.message));
  try {
    for (const mode of ['full', 'file', 'community']) {
      execFileSync(process.env.CRG_COMMAND, ['visualize', '--repo', root, '--mode', mode], { stdio: 'pipe', windowsHide: true });
      const assets = {};
      for (const name of await readdir(directory)) if (/\.html$|\.js$/.test(name)) assets[name] = (await readFile(join(directory, name))).toString('base64');
      await page.setContent('<div id="root" style="height:100vh"></div>');
      await page.evaluate(({ assets, old }) => { window.assets = assets; window.readerVersion = old ? 'old' : 'new'; }, { assets, old: version === '0.1.5-rc.2' });
      await page.addScriptTag({ content: bundle.outputFiles[0].text });
      await page.addScriptTag({ content: client });
      await page.evaluate(() => window.mountGraph());
      const frame = page.frameLocator('iframe');
      await frame.locator('#stats-bar').waitFor();
      const svg = frame.locator('#graph-svg'); await svg.waitFor();
      await frame.locator('#graph-svg circle, #graph-svg .node-shape').first().waitFor();
      assert.equal(await page.locator('iframe').getAttribute('sandbox'), 'allow-scripts allow-downloads');
      assert.deepEqual(await page.evaluate(() => window.clientRegistration), { id: 'dsh-code-review-graph', kind: 'code-review-graph', key: 'dsh-code-review-graph' });
      const search = mode === 'full' ? 'added' : mode === 'file' ? 'demo' : 'repo';
      await frame.locator('#search').fill(search);
      await frame.locator('.sr-item').first().waitFor();
      assert.ok((await frame.locator('.sr-item').first().innerText()).toLowerCase().includes(search));
      await frame.locator('#search').press('Enter');
      await frame.locator('#btn-fit').click();
      await frame.locator('#btn-labels').click();
      const before = await svg.locator('g').first().getAttribute('transform');
      await svg.hover(); await page.mouse.wheel(0, -300);
      await page.waitForTimeout(300);
      const after = await svg.locator('g').first().getAttribute('transform');
      assert.notEqual(before, after, 'Zoom changes the viewport');
      await frame.locator('#search').fill('');
      await frame.locator('#btn-fit').click();
      const node = frame.locator('#graph-svg circle, #graph-svg .node-shape').first(); const box = await node.boundingBox();
      if (box) { await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2); await page.mouse.down(); await page.mouse.move(box.x + box.width / 2 + 40, box.y + box.height / 2 + 30); await page.mouse.up(); }
      const filter = frame.locator('input[type="checkbox"]').first();
      if (await filter.count()) { await filter.uncheck(); await filter.check(); }
      if (mode === 'community') {
        await frame.locator('#graph-svg .node-circle').first().dblclick();
        await frame.locator('#btn-back').waitFor({ state: 'visible' });
        await frame.locator('#btn-back').click();
        assert.equal(await frame.locator('#btn-back').isVisible(), false);
      }
      const exported = page.waitForEvent('download');
      await page.getByRole('button', { name: 'Export HTML / 导出 HTML' }).click();
      assert.equal((await exported).suggestedFilename(), 'code-review-graph.html');
      await mkdir('test-results', { recursive: true });
      await page.screenshot({ path: resolve('test-results', `graph-${mode}-${version}-${process.platform}.png`) });
    }
    assert.deepEqual(escaped, [], 'Graph must make no network requests');
    assert.deepEqual(errors, [], 'Graph renderer must have no page errors');
    await writeFile(`test-results/browser-${version}-${process.platform}.json`, JSON.stringify({ release: version, surface: 'native Web/Desktop client contribution mounted with workspace-reader fixture', views: ['full', 'file', 'community'], checked: ['sidebar-kind registration', 'offline asset inlining', 'search', 'filters', 'zoom', 'drag', 'community drill/back', 'HTML download', 'sandbox'], networkRequests: escaped, pageErrors: errors }, null, 2));
  } catch (error) {
    await page.screenshot({ path: resolve('test-results', `graph-failure-${version}.png`) });
    throw new Error(`${String(error)}; UI: ${(await page.locator('body').innerText()).slice(0, 2000)}; page errors: ${errors.join('; ')}`);
  } finally { await browser.close(); }
});

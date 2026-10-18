import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, realpath } from 'node:fs/promises';
import { basename, join } from 'node:path';
import { tmpdir } from 'node:os';
import { repository } from '../dist/safety.js';

const workspace = () => mkdtemp(join(tmpdir(), 'dsh-crg-repository-'));
const mark = async (root, marker = '.git') => { await mkdir(join(root, marker), { recursive: true }); return root; };
// Windows tmpdir() returns an 8.3 short path; the resolver reports the long one.
const mentions = (message, path) => message.toLowerCase().includes(basename(path).toLowerCase());

test('a session opened below a repository root resolves to that repository', async () => {
  const root = await mark(await workspace());
  const nested = join(root, 'packages', 'app', 'src');
  await mkdir(nested, { recursive: true });
  assert.equal(await repository(root), await realpath(root));
  assert.equal(await repository(nested), await realpath(root));
  assert.equal(await repository(join(root, 'packages')), await realpath(root));
});

test('svn workspaces resolve the same way', async () => {
  const root = await mark(await workspace(), '.svn');
  const nested = join(root, 'trunk', 'src');
  await mkdir(nested, { recursive: true });
  assert.equal(await repository(nested), await realpath(root));
});

test('a lab workspace resolves to its single nested repository', async () => {
  const lab = await workspace();
  const repo = await mark(join(lab, 'project'));
  await mkdir(join(lab, 'downloads'), { recursive: true });
  await mkdir(join(lab, 'stage', 'tools'), { recursive: true });
  assert.equal(await repository(lab), await realpath(repo));
});

test('several nested repositories are reported instead of guessed', async () => {
  const lab = await workspace();
  const first = await mark(join(lab, 'one'));
  const second = await mark(join(lab, 'two'));
  await assert.rejects(repository(lab), error => {
    assert.match(error.message, /Select a Git or SVN repository before using the graph/);
    assert.match(error.message, /2 repositories/);
    assert.ok(mentions(error.message, first) && mentions(error.message, second), error.message);
    return true;
  });
});

test('scanning never descends into dependencies or an already found repository', async () => {
  const lab = await workspace();
  const hidden = await mark(join(lab, 'node_modules', 'some-package'));
  await assert.rejects(repository(lab), /no repository was found beneath it/);
  assert.ok(hidden); // the dependency copy exists but must stay invisible
  const outer = await mark(join(lab, 'repo'));
  await mkdir(join(outer, 'inner'), { recursive: true });
  await mark(join(outer, 'inner', 'nested'));
  assert.equal(await repository(lab), await realpath(outer));
});

test('a workspace with no repository anywhere fails with an actionable message', async () => {
  const plain = await workspace();
  await assert.rejects(repository(plain), error => {
    assert.match(error.message, /Select a Git or SVN repository before using the graph/);
    assert.ok(mentions(error.message, plain), error.message);
    assert.match(error.message, /git init/);
    return true;
  });
});

test('repositoryRoot overrides the session workspace', async () => {
  const plain = await workspace();
  const repo = await mark(await workspace());
  assert.equal(await repository(plain, repo), await realpath(repo));
  await assert.rejects(repository(plain, join(plain, 'missing')), /repositoryRoot does not exist/);
  await assert.rejects(repository(plain, plain), /is not a Git or SVN repository/);
  await assert.rejects(repository(plain, 'relative/path'), /must be an absolute path/);
});

test('a missing or relative workspace is rejected', async () => {
  await assert.rejects(repository(undefined), /no local absolute workspace/);
  await assert.rejects(repository(''), /no local absolute workspace/);
  await assert.rejects(repository('relative/dir'), /no local absolute workspace/);
});

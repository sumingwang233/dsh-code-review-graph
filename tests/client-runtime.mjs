import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { runInNewContext } from 'node:vm';

export function loadClient() {
  const require = createRequire(import.meta.url);
  let client;
  runInNewContext(readFileSync(new URL('../dist/client.js', import.meta.url), 'utf8'), {
    window: { __ModuleLoader__: { load({ id, factory }) {
      assert.equal(id, 'dsh-code-review-graph');
      assert.equal(client, undefined, 'Client registers exactly once');
      client = factory(specifier => {
        assert.equal(specifier, 'react', 'Only the host React instance may be external');
        return require('react');
      });
    } } }, TextDecoder, Uint8Array, atob,
  });
  assert.equal(typeof client?.apply, 'function');
  return client;
}

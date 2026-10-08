import test from 'node:test';
import assert from 'node:assert/strict';
import { loadClient } from './client-runtime.mjs';

test('published browser artifact registers a native DSH module factory', () => {
  const client = loadClient();
  assert.equal(client.name, 'code-review-graph-client');
  assert.equal(typeof client.readAsset, 'function');
});

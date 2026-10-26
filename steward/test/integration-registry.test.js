const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');
const { validateManifest, loadIntegrations, actionFor } = require('../src/core/integration-registry');
const { invokeLocal } = require('../src/core/local-rpc');
const { createLocalBridge } = require('../../memo/src/transport/local-bridge');

function manifest() {
  return {
    protocol: 'steward.department/v1', id: 'memo', name: 'Memo',
    transport: { type: 'windows-named-pipe', endpoint: '\\\\.\\pipe\\test-memo' },
    actions: [{ id: 'capture', mode: 'write', approval: 'none', input: { text: 'string' }, output: { summary: 'string' } }]
  };
}

test('validates the public department contract', () => {
  assert.deepEqual(validateManifest(manifest()), []);
  assert.match(validateManifest({})[0], /协议/);
});

test('loads only explicitly approved actions from the local registry', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'steward-registry-'));
  const steward = path.join(root, 'steward');
  const memo = path.join(root, 'memo');
  fs.mkdirSync(steward); fs.mkdirSync(memo);
  fs.writeFileSync(path.join(memo, 'steward.department.json'), JSON.stringify(manifest()));
  fs.writeFileSync(path.join(steward, 'registry.json'), JSON.stringify({ version: 1, integrations: [{ id: 'memo', manifest: '../memo/steward.department.json', enabled: true, approvedActions: ['capture'] }] }));
  const loaded = loadIntegrations({ registryPath: path.join(steward, 'registry.json'), dashboardRoot: root });
  assert.equal(loaded.issues.length, 0);
  assert.equal(loaded.integrations.length, 1);
  assert.equal(actionFor(loaded.integrations[0], 'capture').mode, 'write');
  assert.equal(actionFor(loaded.integrations[0], 'list'), null);
});

test('uses a local named-pipe bridge without opening a web port', async () => {
  const endpoint = `\\\\.\\pipe\\steward-test-${process.pid}-${Date.now()}`;
  const bridge = createLocalBridge({
    pipeName: endpoint,
    logger: { warn() {} },
    handleRequest: async (request) => ({ status: 'completed', echo: request.params.payload.text })
  });
  await bridge.start();
  try {
    const result = await invokeLocal(endpoint, { protocol: 'steward.department/v1', method: 'execute', params: { payload: { text: '仅本地' } } });
    assert.deepEqual(result, { status: 'completed', echo: '仅本地' });
  } finally {
    await bridge.stop();
  }
});

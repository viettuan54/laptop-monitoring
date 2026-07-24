const { test } = require('node:test');
const assert = require('node:assert/strict');

const requireOwnedDevice = require('../src/middlewares/deviceOwnership.middleware');

function createResponse() {
  return {
    statusCode: 200,
    body: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(body) {
      this.body = body;
      return this;
    },
  };
}

test('releases the RLS connection before continuing to a slow controller', async () => {
  const events = [];
  const req = {
    params: { device_id: '42' },
    db: {
      async query(sql, params) {
        events.push(['query', sql, params]);
        return { rows: [{ device_id: 42 }] };
      },
    },
    async releaseRls(success) {
      events.push(['release', success]);
    },
  };
  const res = createResponse();

  await requireOwnedDevice(req, res, () => {
    events.push(['next']);
  });

  assert.deepEqual(events.map(([event]) => event), ['query', 'release', 'next']);
  assert.equal(events[1][1], true);
  assert.equal(req.db, null);
});

test('releases with rollback and denies an unowned device', async () => {
  const releases = [];
  const req = {
    params: { device_id: '99' },
    db: {
      async query() {
        return { rows: [] };
      },
    },
    async releaseRls(success) {
      releases.push(success);
    },
  };
  const res = createResponse();
  let continued = false;

  await requireOwnedDevice(req, res, () => {
    continued = true;
  });

  assert.deepEqual(releases, [false]);
  assert.equal(continued, false);
  assert.equal(res.statusCode, 404);
});

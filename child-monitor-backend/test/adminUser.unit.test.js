const { test } = require('node:test');
const assert = require('node:assert/strict');

const adminController = require('../src/controllers/admin.controller');

function response() {
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

test('admin cannot demote or disable their own account', async () => {
  for (const body of [{ role: 'parent' }, { is_active: false }]) {
    const req = {
      params: { id: '7' },
      body,
      currentUser: { user_id: 7, role: 'admin' },
    };
    const res = response();

    await adminController.updateUser(req, res);

    assert.equal(res.statusCode, 400);
    assert.match(res.body.message, /cannot demote or disable/i);
  }
});

test('admin user update validates id and editable fields before querying DB', async () => {
  const invalidRequests = [
    { params: { id: 'abc' }, body: { role: 'parent' } },
    { params: { id: '8' }, body: {} },
    { params: { id: '8' }, body: { role: 'owner' } },
    { params: { id: '8' }, body: { is_active: 'false' } },
    { params: { id: '8' }, body: { is_verified: 1 } },
  ];

  for (const req of invalidRequests) {
    req.currentUser = { user_id: 7, role: 'admin' };
    const res = response();

    await adminController.updateUser(req, res);

    assert.equal(res.statusCode, 400);
    assert.ok(res.body.message);
  }
});

test('admin cannot delete their own account', async () => {
  const req = {
    params: { id: '7' },
    currentUser: { user_id: 7, role: 'admin' },
  };
  const res = response();

  await adminController.deleteUser(req, res);

  assert.equal(res.statusCode, 400);
  assert.match(res.body.message, /cannot delete your own/i);
});

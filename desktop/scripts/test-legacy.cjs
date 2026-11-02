const assert = require('node:assert/strict');
const path = require('node:path');
const http = require('node:http');

const appPath = path.resolve(process.argv[2]);
const LocalDatabase = require(path.join(appPath, 'database.cjs'));
const fetch = require(path.join(appPath, 'node_modules/node-fetch'));

async function test() {
    assert.equal(process.versions.electron, '22.3.27');
    const database = new LocalDatabase(':memory:');
    assert.ok(database.getSetting('device_uuid'));
    assert.throws(() => database.transaction(() => {
        database.setSetting('rolled_back', 'yes');
        throw new Error('rollback');
    }));
    assert.equal(database.getSetting('rolled_back'), null);
    const sale = database.saveSale({ items: [{ product_id: 1, key: 'p:1', name: 'Test', quantity: 2, price: 10 }], payment_method: 'cash' });
    assert.equal(sale.total, 20);
    assert.equal(database.pendingSales().length, 1);
    database.markSyncing(sale.uuid);
    database.markFailed(sale.uuid, 'Offline');
    assert.equal(database.pendingSales().length, 1);
    database.markSynced(sale.uuid, { order_id: 'test-order', synced_at: new Date().toISOString() });
    assert.equal(database.pendingSales().length, 0);
    database.db.close();

    const server = http.createServer((request, response) => {
        response.setHeader('Content-Type', 'application/json');
        response.end(JSON.stringify({ method: request.method, auth: request.headers.authorization }));
    });
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    try {
        const response = await fetch(`http://127.0.0.1:${server.address().port}`, {
            method: 'POST', headers: { Authorization: 'Bearer test' }, body: '{}', signal: AbortSignal.timeout(5000),
        });
        assert.equal(response.ok, true);
        assert.deepEqual(await response.json(), { method: 'POST', auth: 'Bearer test' });
    } finally {
        server.close();
    }
    console.log('Electron 22: SQLite transactions, sale synchronization, and HTTP requests passed.');
}
test().catch(error => { console.error(error); process.exitCode = 1; });

const DatabaseSync = Number(process.versions.node.split('.')[0]) >= 22
    ? require('node:sqlite').DatabaseSync
    : require('better-sqlite3');
const crypto = require('node:crypto');

class LocalDatabase {
    constructor(path) {
        this.db = new DatabaseSync(path);
        this.db.exec('PRAGMA journal_mode = WAL');
        this.db.exec('PRAGMA foreign_keys = ON');
        this.migrate();
    }

    migrate() {
        this.db.exec(`
            CREATE TABLE IF NOT EXISTS settings (
                key TEXT PRIMARY KEY,
                value TEXT NOT NULL
            );
            CREATE TABLE IF NOT EXISTS categories (
                id INTEGER PRIMARY KEY,
                name TEXT NOT NULL
            );
            CREATE TABLE IF NOT EXISTS products (
                key TEXT PRIMARY KEY,
                product_id INTEGER NOT NULL,
                variant_id INTEGER,
                name TEXT NOT NULL,
                variation_name TEXT,
                sku TEXT,
                barcode TEXT,
                price REAL NOT NULL,
                regular_price REAL NOT NULL,
                stock_quantity INTEGER NOT NULL DEFAULT 0,
                category_ids TEXT NOT NULL DEFAULT '[]'
            );
            CREATE INDEX IF NOT EXISTS products_barcode_idx ON products(barcode);
            CREATE TABLE IF NOT EXISTS customers (
                id INTEGER PRIMARY KEY,
                name TEXT NOT NULL,
                phone_number TEXT,
                email TEXT
            );
            CREATE TABLE IF NOT EXISTS sales (
                uuid TEXT PRIMARY KEY,
                payload TEXT NOT NULL,
                total REAL NOT NULL,
                status TEXT NOT NULL DEFAULT 'pending',
                attempts INTEGER NOT NULL DEFAULT 0,
                last_error TEXT,
                server_order_id TEXT,
                created_at TEXT NOT NULL,
                synced_at TEXT
            );
            CREATE INDEX IF NOT EXISTS sales_status_idx ON sales(status, created_at);
        `);
        // A process can exit after marking a row syncing but before receiving the
        // response. Idempotent server UUIDs make retrying these rows safe.
        this.db.prepare(`
            UPDATE sales SET status = 'failed', last_error = 'Interrupted during synchronization'
            WHERE status = 'syncing'
        `).run();

        if (!this.getSetting('device_uuid')) {
            this.setSetting('device_uuid', crypto.randomUUID());
        }
    }

    getSetting(key) {
        return this.db.prepare('SELECT value FROM settings WHERE key = ?').get(key)?.value ?? null;
    }

    setSetting(key, value) {
        this.db.prepare(`
            INSERT INTO settings(key, value) VALUES (?, ?)
            ON CONFLICT(key) DO UPDATE SET value = excluded.value
        `).run(key, String(value));
    }

    replaceCatalog(catalog) {
        this.transaction(() => {
            this.db.prepare('DELETE FROM categories').run();
            this.db.prepare('DELETE FROM products').run();
            this.db.prepare('DELETE FROM customers').run();

            const categoryInsert = this.db.prepare('INSERT INTO categories(id, name) VALUES (?, ?)');
            for (const category of catalog.categories) categoryInsert.run(category.id, category.name);

            const productInsert = this.db.prepare(`
                INSERT INTO products(
                    key, product_id, variant_id, name, variation_name, sku, barcode,
                    price, regular_price, stock_quantity, category_ids
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `);
            for (const product of catalog.products) {
                if (product.variants.length) {
                    for (const variant of product.variants) {
                        productInsert.run(
                            `v:${variant.id}`, product.id, variant.id, product.name, variant.name,
                            variant.sku, variant.barcode, variant.price, variant.regular_price,
                            variant.stock_quantity, JSON.stringify(product.category_ids),
                        );
                    }
                } else {
                    productInsert.run(
                        `p:${product.id}`, product.id, null, product.name, null,
                        product.sku, product.barcode, product.price, product.regular_price,
                        product.stock_quantity, JSON.stringify(product.category_ids),
                    );
                }
            }

            const customerInsert = this.db.prepare(
                'INSERT INTO customers(id, name, phone_number, email) VALUES (?, ?, ?, ?)'
            );
            for (const customer of catalog.customers) {
                customerInsert.run(customer.id, customer.name, customer.phone_number, customer.email);
            }
            this.setSetting('last_catalog_sync_at', catalog.server_time);
        });
    }

    catalog() {
        return {
            products: this.db.prepare('SELECT * FROM products ORDER BY name, variation_name').all()
                .map(product => ({ ...product, category_ids: JSON.parse(product.category_ids) })),
            categories: this.db.prepare('SELECT * FROM categories ORDER BY name').all(),
            customers: this.db.prepare('SELECT * FROM customers ORDER BY name').all(),
        };
    }

    saveSale(input) {
        const uuid = crypto.randomUUID();
        const createdAt = new Date().toISOString();
        const items = input.items.map(item => ({
            product_id: item.product_id,
            product_variant_id: item.variant_id,
            name: item.name,
            variation_name: item.variation_name,
            quantity: item.quantity,
            unit_price: item.price,
        }));
        const subTotal = items.reduce((sum, item) => sum + item.quantity * item.unit_price, 0);
        const discount = input.discount_type === 'percent'
            ? subTotal * Math.min(input.discount_value || 0, 100) / 100
            : (input.discount_value || 0);
        const tax = input.tax_type === 'percent'
            ? subTotal * Math.min(input.tax_value || 0, 100) / 100
            : (input.tax_value || 0);
        const total = Math.max(0, subTotal - discount + tax);
        const payload = {
            sale_uuid: uuid,
            created_at: createdAt,
            customer_id: input.customer_id || null,
            customer_name: input.customer_name || 'Walk-in Customer',
            discount_type: input.discount_type || null,
            discount_value: Number(input.discount_value || 0),
            tax_type: input.tax_type || null,
            tax_value: Number(input.tax_value || 0),
            payment_method: input.payment_method,
            tendered_amount: Number(input.tendered_amount || total),
            payment_reference: input.payment_reference || null,
            items,
        };

        this.transaction(() => {
            this.db.prepare(`
                INSERT INTO sales(uuid, payload, total, status, created_at)
                VALUES (?, ?, ?, 'pending', ?)
            `).run(uuid, JSON.stringify(payload), total, createdAt);
            const decrement = this.db.prepare(
                'UPDATE products SET stock_quantity = stock_quantity - ? WHERE key = ?'
            );
            for (const item of input.items) decrement.run(item.quantity, item.key);
        });

        return { uuid, total, created_at: createdAt };
    }

    pendingSales() {
        return this.db.prepare(`
            SELECT uuid, payload FROM sales
            WHERE status IN ('pending', 'failed')
            ORDER BY created_at LIMIT 50
        `).all();
    }

    markSyncing(uuid) {
        this.db.prepare(`
            UPDATE sales SET status = 'syncing', attempts = attempts + 1, last_error = NULL
            WHERE uuid = ?
        `).run(uuid);
    }

    markSynced(uuid, result) {
        this.db.prepare(`
            UPDATE sales SET status = 'synced', server_order_id = ?, synced_at = ?, last_error = NULL
            WHERE uuid = ?
        `).run(result.order_id, result.synced_at, uuid);
    }

    markFailed(uuid, error) {
        this.db.prepare(`
            UPDATE sales SET status = 'failed', last_error = ? WHERE uuid = ?
        `).run(String(error).slice(0, 1000), uuid);
    }

    status() {
        const counts = this.db.prepare(
            'SELECT status, COUNT(*) count FROM sales GROUP BY status'
        ).all();
        return {
            online: false,
            last_catalog_sync_at: this.getSetting('last_catalog_sync_at'),
            sales: Object.fromEntries(counts.map(row => [row.status, row.count])),
            authenticated: Boolean(this.getSetting('api_token')),
        };
    }

    transaction(callback) {
        this.db.exec('BEGIN IMMEDIATE');
        try {
            const result = callback();
            this.db.exec('COMMIT');
            return result;
        } catch (error) {
            this.db.exec('ROLLBACK');
            throw error;
        }
    }
}

module.exports = LocalDatabase;

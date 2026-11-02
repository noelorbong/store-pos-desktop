self.addEventListener('install', () => {
    self.skipWaiting();
});

self.addEventListener('activate', (event) => {
    event.waitUntil(self.clients.claim());
});

self.addEventListener('push', (event) => {
    let payload = {};

    if (event.data) {
        try {
            payload = event.data.json();
        } catch {
            payload = {
                title: 'Notification',
                body: event.data.text(),
            };
        }
    }

    const title = payload.title || 'New order received';
    const options = {
        body: payload.body || 'A new customer order has been placed.',
        icon: payload.icon || '/favicon.ico',
        badge: payload.badge || '/favicon.ico',
        data: payload.data || {},
    };

    event.waitUntil((async () => {
        await self.registration.showNotification(title, options);

        const clients = await self.clients.matchAll({
            type: 'window',
            includeUncontrolled: true,
        });

        for (const client of clients) {
            client.postMessage({
                type: 'store-pos:new-order',
                order: payload.order || null,
            });
        }
    })());
});

self.addEventListener('notificationclick', (event) => {
    event.notification.close();

    event.waitUntil(
        self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
            for (const client of clients) {
                if ('focus' in client) return client.focus();
            }
            return self.clients.openWindow('/admin/orders');
        })
    );
});

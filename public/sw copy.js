self.addEventListener('install', (event) => {
    self.skipWaiting();
});

self.addEventListener('activate', (event) => {
    self.clients.claim();
});

self.addEventListener('fetch', (event) => {
    event.respondWith(fetch(event.request));
});

self.addEventListener('push', (event) => {
    let payload = {};

    if (event.data) {
        try {
            payload = event.data.json();
        } catch {
            const text = event.data.text();
            payload = {
                title: 'Notification',
                body: text,
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

    event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', (event) => {
    event.notification.close();

    event.waitUntil(
        self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
            for (const client of clients) {
                if ('focus' in client) {
                    return client.focus();
                }
            }

            return self.clients.openWindow('/admin/orders');
        }),
    );
});

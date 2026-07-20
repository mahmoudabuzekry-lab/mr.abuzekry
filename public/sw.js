// Service Worker for Background/Offline Push Notifications
self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

// Listen for background push events
self.addEventListener('push', (event) => {
  let data = { title: 'تنبيه جديد', body: 'لديك إشعار جديد من منصة الأستاذ محمود أبوذكري.' };
  if (event.data) {
    try {
      data = event.data.json();
    } catch (e) {
      data = { title: 'تنبيه جديد', body: event.data.text() };
    }
  }

  const options = {
    body: data.body,
    icon: '/favicon.ico',
    badge: '/favicon.ico',
    vibrate: [200, 100, 200],
    tag: data.tag || 'bg-push-notification',
    data: {
      url: '/'
    },
    actions: [
      { action: 'open', title: 'فتح المنصة' }
    ]
  };

  event.waitUntil(
    self.registration.showNotification(data.title, options)
  );
});

// Handle notification clicks even when the app is closed
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      // If a window is already open, focus it
      for (const client of clientList) {
        if ('focus' in client) {
          return client.focus();
        }
      }
      // Otherwise, open a new window
      if (clients.openWindow) {
        return clients.openWindow('/');
      }
    })
  );
});

const CACHE_NAME = 'all-word-cache-v2'; // Имя кэша обновлено до v2
const urlsToCache = [
    '/',
    '/index.html',
    '/style.css',
    '/script.js',
    '/manifest.json',
    'https://fonts.googleapis.com/css2?family=Orbitron:wght@400;500&family=Roboto:wght@300;400&display=swap'
];

// Установка Service Worker и кэширование основных ресурсов
self.addEventListener('install', event => {
    self.skipWaiting(); // Принудительная активация нового SW
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then(cache => {
                console.log('Кэш v2 открыт');
                return cache.addAll(urlsToCache);
            })
    );
});

// Активация Service Worker и очистка старого кэша
self.addEventListener('activate', event => {
    const cacheWhitelist = [CACHE_NAME]; // Оставляем только кэш v2
    event.waitUntil(
        caches.keys().then(cacheNames => {
            return Promise.all(
                cacheNames.map(cacheName => {
                    if (cacheWhitelist.indexOf(cacheName) === -1) {
                        // Удаляем все старые кэши (например, all-word-cache-v1)
                        return caches.delete(cacheName);
                    }
                })
            );
        })
    );
    return self.clients.claim(); // Захватываем контроль над открытыми страницами
});

// Перехват сетевых запросов
self.addEventListener('fetch', event => {
    event.respondWith(
        caches.match(event.request)
            .then(response => {
                // Если ресурс есть в кэше, возвращаем его
                if (response) {
                    return response;
                }
                // Иначе, выполняем сетевой запрос
                return fetch(event.request);
            })
    );
});
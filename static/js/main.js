/* ====================================================
   BHARAT BYTE CLIENT-SIDE CORE CONTROLLER
   Decoupled Static App Integration, Dynamic APIs & Maps
   ==================================================== */

document.addEventListener('DOMContentLoaded', () => {

    const API_BASE_URL = (() => {
        // If hosted on GitHub Pages, use Vercel production URL
        if (window.location.hostname && !['localhost', '127.0.0.1'].includes(window.location.hostname)) {
            return 'https://bharat-byte-solutions.vercel.app';
        }
        // If opened locally via file:// protocol or local static server (Live Server on port 5500, etc.)
        if (window.location.protocol === 'file:' || window.location.port !== '5000') {
            return 'http://127.0.0.1:5000';
        }
        return '';
    })();



    // Helper to get authenticated URL query parameters
    function getAuthQueryString() {
        const uid = localStorage.getItem('user_id');
        return uid ? `user_id=${uid}` : '';
    }

    // Helper to get authenticated JSON body items
    function injectAuthPayload(payload = {}) {
        const uid = localStorage.getItem('user_id');
        if (uid) {
            payload['user_id'] = parseInt(uid);
            payload['lister_id'] = parseInt(uid);
        }
        return payload;
    }

    // =========================================
    // 1. LOADER SYSTEM
    // =========================================
    const loader = document.getElementById('loader');
    if (loader) {
        setTimeout(() => {
            loader.style.opacity = '0';
            loader.style.transition = 'opacity 0.6s ease';
            setTimeout(() => {
                loader.style.display = 'none';
            }, 600);
        }, 800); // Standard quick transition
    }

    // =========================================
    // 2. THEME SWITCHER (DARK / LIGHT MODE)
    // =========================================
    const themeBtn = document.querySelector('.theme-switch-btn');
    const currentTheme = localStorage.getItem('theme') || 'light';

    document.documentElement.setAttribute('data-theme', currentTheme);
    updateThemeIcon(currentTheme);

    if (themeBtn) {
        themeBtn.addEventListener('click', () => {
            const activeTheme = document.documentElement.getAttribute('data-theme');
            const newTheme = activeTheme === 'dark' ? 'light' : 'dark';
            document.documentElement.setAttribute('data-theme', newTheme);
            localStorage.setItem('theme', newTheme);
            updateThemeIcon(newTheme);
        });
    }

    function updateThemeIcon(theme) {
        if (!themeBtn) return;
        const icon = themeBtn.querySelector('i');
        if (theme === 'dark') {
            icon.className = 'bx bx-sun text-warning';
        } else {
            icon.className = 'bx bx-moon text-dark';
        }
    }

    // =========================================
    // 3. MULTILINGUAL DICTIONARY
    // =========================================
    const langSelect = document.getElementById('language-select');
    const translations = {
        'en': {
            'app_title': 'Bharat Byte',
            'find_nearby': 'Find Nearby Stalls & Accommodations',
            'search_placeholder': 'Search dosa, rooms, PGs, medicals...',
            'gps_btn': 'Get Location',
            'categories': 'Popular Categories',
            'trending_locations': 'Trending Locations',
            'featured': 'Featured Listings',
            'ai_assistant_title': 'AI Search Assistant',
            'ai_placeholder': 'Ask me anything! e.g., "girls pg with AC under 8000"'
        },
        'hi': {
            'app_title': 'भारत बाइट',
            'find_nearby': 'नज़दीकी दुकानें और रहने की जगह खोजें',
            'search_placeholder': 'डोसा, कमरे, पीजी, दवा की दुकान खोजें...',
            'gps_btn': 'स्थान प्राप्त करें',
            'categories': 'लोकप्रिय श्रेणियां',
            'trending_locations': 'रुझान वाले शहर',
            'featured': 'विशेष रुप से प्रदर्शित सूचियाँ',
            'ai_assistant_title': 'एआई खोज सहायक',
            'ai_placeholder': 'मुझसे कुछ भी पूछें! जैसे, "8000 के अंदर एसी वाला गर्ल्स पीजी"'
        },
        'gu': {
            'app_title': 'ભારત બાઇટ',
            'find_nearby': 'નજીકની ફૂડ સ્ટોલ્સ અને રૂમ શોધો',
            'search_placeholder': 'ઢોસા, પીજી, રૂમ, મેડિકલ સ્ટોર શોધો...',
            'gps_btn': 'લોકેશન મેળવો',
            'categories': 'લોકપ્રિય શ્રેણીઓ',
            'trending_locations': 'ટ્રેન્ડિંગ લોકેશન્સ',
            'featured': 'ફીચર્ડ લિસ્ટિંગ્સ',
            'ai_assistant_title': 'AI શોધ સહાયક',
            'ai_placeholder': 'મને કંઈ પણ પૂછો! જેમ કે, "8000 નીચે એસી વાળું ગર્લ્સ પીજી"'
        }
    };

    if (langSelect) {
        langSelect.addEventListener('change', (e) => {
            const lang = e.target.value;
            applyTranslations(lang);
        });
    }

    function applyTranslations(lang) {
        if (!translations[lang]) return;
        const dict = translations[lang];

        document.querySelectorAll('[data-translate]').forEach(el => {
            const key = el.getAttribute('data-translate');
            if (dict[key]) {
                if (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA') {
                    el.placeholder = dict[key];
                } else {
                    el.innerHTML = dict[key];
                }
            }
        });
    }

    // =========================================
    // 4. SESSION VALIDATION & HEADER INJECTION
    // =========================================
    async function loadUserSession() {
        const authContainer = document.getElementById('auth-cta-container');
        const notifWrapper = document.getElementById('notif-dropdown-wrapper');
        const listerStudioNav = document.getElementById('nav-lister-studio');
        
        const cachedId = localStorage.getItem('user_id');
        if (!cachedId) return;

        try {
            const res = await fetch(`${API_BASE_URL}/api/auth/session?user_id=${cachedId}`);
            const result = await res.json();

            if (result.status === 'success' && result.logged_in) {
                const user = result.user;
                
                // Show lister nav if applicable
                if (user.role === 'lister' && listerStudioNav) {
                    listerStudioNav.classList.remove('d-none');
                }

                // Show notifications badge
                if (notifWrapper) {
                    notifWrapper.classList.remove('d-none');
                    const badge = document.getElementById('notif-badge');
                    if (result.unread_notifications_count > 0) {
                        badge.classList.remove('d-none');
                        badge.textContent = result.unread_notifications_count;
                    }
                    
                    // Render notifications
                    const container = document.getElementById('notif-items-container');
                    if (container && result.notifications.length > 0) {
                        let html = '';
                        result.notifications.forEach(n => {
                            html += `
                                <li class="mb-2 p-2 rounded ${!n.is_read ? 'bg-light border-start border-primary border-3' : ''}">
                                    <div class="fw-semibold text-truncate small text-dark">${n.title}</div>
                                    <div class="text-muted small" style="font-size: 0.8rem;">${n.message}</div>
                                </li>
                            `;
                        });
                        container.innerHTML = html;
                    }
                }

                // Inject user profile dropdown
                if (authContainer) {
                    authContainer.innerHTML = `
                        <div class="dropdown">
                            <button class="btn btn-primary dropdown-toggle px-3" type="button" id="userMenu" data-bs-toggle="dropdown" aria-expanded="false">
                                <i class="bx bx-user-circle"></i> ${user.username}
                            </button>
                            <ul class="dropdown-menu dropdown-menu-end shadow border-0" aria-labelledby="userMenu" style="border-radius: 8px;">
                                <li class="px-3 py-2 border-bottom">
                                    <div class="fw-bold small text-dark">${user.username}</div>
                                    <div class="text-muted small" style="font-size: 0.8rem;">Points: ₹${user.reward_points}</div>
                                    <div class="badge bg-primary mt-1">${user.role.toUpperCase()}</div>
                                </li>
                                ${user.role === 'lister' ? `<li><a class="dropdown-item py-2" href="dashboard.html"><i class="bx bx-grid-alt"></i> Lister Studio</a></li>` : ''}
                                ${user.role === 'admin' ? `<li><a class="dropdown-item py-2" href="admin_dashboard.html"><i class="bx bx-shield-quarter"></i> Admin cockpit</a></li>` : ''}
                                <li><a class="dropdown-item py-2" href="#" id="app-signout-btn"><i class="bx bx-log-out text-danger"></i> Sign Out</a></li>
                            </ul>
                        </div>
                    `;

                    // Bind logout handler
                    document.getElementById('app-signout-btn').addEventListener('click', async (e) => {
                        e.preventDefault();
                        try {
                            await fetch(`${API_BASE_URL}/api/auth/logout`, { method: 'POST' });
                            localStorage.clear();
                            window.location.href = 'index.html';
                        } catch (err) {
                            console.error(err);
                        }
                    });
                }
            }
        } catch (err) {
            console.error("Session sync issue:", err);
        }
    }

    loadUserSession();

    // =========================================
    // 5. GPS GEOLOCATION & MAP INTEGRATION (AUTOMATED)
    // =========================================
    let userLat = null;
    let userLng = null;
    let map = null;
    let markersLayer = null;
    let listingsData = [];

    const latInput = document.getElementById('user-lat');
    const lngInput = document.getElementById('user-lng');

    function autoFetchLocation() {
        if (navigator.geolocation) {
            navigator.geolocation.getCurrentPosition(
                (position) => {
                    userLat = position.coords.latitude;
                    userLng = position.coords.longitude;
                    if (latInput) latInput.value = userLat;
                    if (lngInput) lngInput.value = userLng;
                    console.log(`Automatic Geolocation acquired: ${userLat}, ${userLng}`);
                    
                    const heroGps = document.getElementById('hero-gps-display');
                    if (heroGps) {
                        heroGps.value = `${userLat.toFixed(4)}, ${userLng.toFixed(4)}`;
                    }
                    
                    if (map) {
                        map.setView([userLat, userLng], 14);
                        L.circle([userLat, userLng], {
                            color: 'red',
                            fillColor: '#f03',
                            fillOpacity: 0.3,
                            radius: 500
                        }).addTo(map).bindPopup("Your Geolocation").openPopup();
                    }
                    
                    // Reload listings to filter by nearby items
                    const listGrid = document.getElementById('listings-search-grid');
                    if (listGrid) {
                        loadListings();
                    }
                },
                (error) => {
                    console.warn("Background Geolocation declined or failed. Defaulting to Gandhinagar.", error);
                    // Fallback to Gandhinagar Center
                    userLat = 23.2156;
                    userLng = 72.6369;
                    if (latInput) latInput.value = userLat;
                    if (lngInput) lngInput.value = userLng;
                    
                    const heroGps = document.getElementById('hero-gps-display');
                    if (heroGps) {
                        heroGps.value = "Gandhinagar, GJ";
                    }
                    
                    const listGrid = document.getElementById('listings-search-grid');
                    if (listGrid) {
                        loadListings();
                    }
                }
            );
        } else {
            console.warn("Geolocation not supported by browser.");
        }
    }

    // Trigger automatic geolocation discovery on load
    autoFetchLocation();

    const mapElement = document.getElementById('leaflet-map');
    if (mapElement) {
        const defaultLat = 23.2156;
        const defaultLng = 72.6369;
        
        map = L.map('leaflet-map').setView([defaultLat, defaultLng], 13);
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '&copy; OpenStreetMap contributors'
        }).addTo(map);

        markersLayer = L.layerGroup().addTo(map);
    }

    // =========================================
    // 6. REST API FOR DISCOVERY SEARCH
    // =========================================
    const searchForm = document.getElementById('discovery-search-form');
    if (searchForm || mapElement) {
        loadListings();
        
        document.querySelectorAll('.filter-trigger').forEach(el => {
            el.addEventListener('change', () => loadListings());
        });
        
        const priceSlider = document.getElementById('filter-price');
        if (priceSlider) {
            priceSlider.addEventListener('input', (e) => {
                document.getElementById('price-val-display').textContent = e.target.value;
                loadListings();
            });
        }

        const distanceSlider = document.getElementById('filter-distance');
        if (distanceSlider) {
            distanceSlider.addEventListener('input', (e) => {
                document.getElementById('distance-val-display').textContent = e.target.value + " km";
                loadListings();
            });
        }

        if (searchForm) {
            searchForm.addEventListener('submit', (e) => {
                e.preventDefault();
                loadListings();
            });
        }
    }

    async function loadListings() {
        const listGrid = document.getElementById('listings-search-grid');
        if (!listGrid) return;

        listGrid.innerHTML = `
            <div class="col-12 text-center py-5">
                <div class="spinner-border text-primary" role="status"></div>
                <p class="mt-3 text-muted">Scanning Bharat Byte database...</p>
            </div>
        `;

        const params = new URLSearchParams();
        
        const catElem = document.getElementById('filter-category');
        if (catElem) params.append('category', catElem.value);

        const searchElem = document.getElementById('filter-search');
        if (searchElem && searchElem.value) params.append('search', searchElem.value);

        if (userLat) {
            params.append('latitude', userLat);
            params.append('longitude', userLng);
            const distElem = document.getElementById('filter-distance');
            if (distElem) params.append('distance', distElem.value);
        }

        const priceElem = document.getElementById('filter-price');
        if (priceElem) params.append('price', priceElem.value);

        const ratingElem = document.getElementById('filter-rating');
        if (ratingElem && ratingElem.value != 'all') params.append('rating', ratingElem.value);

        const verifiedElem = document.getElementById('filter-verified');
        if (verifiedElem && verifiedElem.checked) params.append('verified', 'true');

        const genderElem = document.getElementById('filter-gender');
        if (genderElem && genderElem.value != 'all') params.append('gender', genderElem.value);

        const acElem = document.getElementById('filter-ac');
        if (acElem && acElem.checked) params.append('ac', 'true');

        const wifiElem = document.getElementById('filter-wifi');
        if (wifiElem && wifiElem.checked) params.append('wifi', 'true');

        const parkingElem = document.getElementById('filter-parking');
        if (parkingElem && parkingElem.checked) params.append('parking', 'true');

        const foodElem = document.getElementById('filter-food');
        if (foodElem && foodElem.checked) params.append('food', 'true');

        const furnishedElem = document.getElementById('filter-furnished');
        if (furnishedElem && furnishedElem.value != 'all') params.append('furnished', furnishedElem.value);

        const uid = localStorage.getItem('user_id');
        if (uid) params.append('user_id', uid);

        try {
            const res = await fetch(`${API_BASE_URL}/api/listings?${params.toString()}`);
            const result = await res.json();
            
            if (result.status === 'success') {
                listingsData = result.data;
                renderListingsGrid(listingsData);
                renderMapMarkers(listingsData);
            } else {
                listGrid.innerHTML = `<div class="col-12 alert alert-danger">${result.message}</div>`;
            }
        } catch (error) {
            console.error(error);
            listGrid.innerHTML = `<div class="col-12 alert alert-danger">Error querying server data.</div>`;
        }
    }

    function renderListingsGrid(listings) {
        const listGrid = document.getElementById('listings-search-grid');
        if (!listGrid) return;

        if (listings.length === 0) {
            listGrid.innerHTML = `
                <div class="col-12 text-center py-5">
                    <i class="bx bx-search-alt text-muted" style="font-size: 4rem;"></i>
                    <h4 class="mt-3">No Listings Found</h4>
                    <p class="text-muted">Try broadening your discovery filters, increasing price ceilings, or checking your GPS settings.</p>
                </div>
            `;
            return;
        }

        let html = '';
        listings.forEach(item => {
            const imgUrl = item.images.length > 0 ? item.images[0] : 'https://images.unsplash.com/photo-1564013799919-ab600027ffc6?auto=format&fit=crop&w=800&q=80';
            const priceText = item.price > 0 ? `₹${item.price}` : 'Free/Inquiry';
            
            let badges = '';
            if (item.is_premium) badges += '<span class="badge badge-premium me-1">PREMIUM</span>';
            if (item.vendor_verified) badges += '<span class="badge badge-verified me-1"><i class="bx bxs-shield-checked"></i> VERIFIED</span>';
            if (item.is_trending) badges += '<span class="badge badge-trending"><i class="bx bxs-hot"></i> TRENDING</span>';

            let categoryIcon = 'bx-building-house';
            if (item.category === 'street_food') categoryIcon = 'bx-restaurant';
            else if (item.category === 'tiffin') categoryIcon = 'bx-dish';
            else if (item.category === 'medical') categoryIcon = 'bx-first-aid';

            let distanceBadge = '';
            if (item.distance !== null && item.distance !== undefined) {
                distanceBadge = `<span class="badge bg-secondary mb-2"><i class="bx bx-navigation"></i> ${item.distance} km away</span>`;
            }

            let genderBadge = '';
            if (item.category === 'pg' || item.category === 'hostel' || item.category === 'room') {
                genderBadge = `<span class="badge badge-gender badge-${item.gender_preference} d-inline-block">${item.gender_preference}</span>`;
            }

            html += `
                <div class="col-md-6 mb-4">
                    <div class="listing-card">
                        <div class="card-img-wrapper">
                            <img src="${imgUrl}" alt="${item.title}">
                            <div class="position-absolute top-2 left-2 p-2 d-flex flex-wrap gap-1" style="z-index: 10;">
                                ${badges}
                            </div>
                            <button class="btn btn-sm btn-light position-absolute top-2 right-2 rounded-circle favorite-btn-toggle" data-id="${item.id}" style="z-index: 10;">
                                <i class="${item.is_favorited ? 'bx bxs-heart text-danger' : 'bx bx-heart'}" style="font-size: 1.2rem;"></i>
                            </button>
                        </div>
                        <div class="p-3">
                            <div class="d-flex justify-content-between align-items-center mb-1">
                                <span class="text-muted small"><i class="bx ${categoryIcon}"></i> ${item.category.toUpperCase()}</span>
                                <span class="rating-badge"><i class="bx bxs-star"></i> ${item.hygiene_rating}</span>
                            </div>
                            <h5 class="card-title text-truncate mb-1"><a href="listing_detail.html?id=${item.id}" class="text-decoration-none text-dark">${item.title}</a></h5>
                            <p class="text-muted small mb-2 text-truncate"><i class="bx bx-map"></i> ${item.address}, ${item.city}</p>
                            ${distanceBadge} ${genderBadge}
                            <hr class="my-2">
                            <div class="d-flex justify-content-between align-items-center">
                                <span class="fs-5 fw-bold text-primary">${priceText}</span>
                                <a href="listing_detail.html?id=${item.id}" class="btn btn-sm btn-outline-primary">View Details</a>
                            </div>
                        </div>
                    </div>
                </div>
            `;
        });
        listGrid.innerHTML = html;

        // Bind Favorite Toggles
        document.querySelectorAll('.favorite-btn-toggle').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                e.stopPropagation();
                e.preventDefault();
                const listingId = btn.getAttribute('data-id');
                const heart = btn.querySelector('i');
                const userId = localStorage.getItem('user_id');

                if (!userId) {
                    alert("Please Sign In to save listings to favorites!");
                    return;
                }
                
                try {
                    const res = await fetch(`${API_BASE_URL}/api/listings/${listingId}/favorite?user_id=${userId}`, { method: 'POST' });
                    const val = await res.json();
                    if (val.status === 'success') {
                        if (val.action === 'added') {
                            heart.className = 'bx bxs-heart text-danger';
                        } else {
                            heart.className = 'bx bx-heart';
                        }
                    } else {
                        alert(val.message);
                    }
                } catch (error) {
                    console.error(error);
                }
            });
        });
    }

    function renderMapMarkers(listings) {
        if (!map || !markersLayer) return;
        markersLayer.clearLayers();

        listings.forEach(item => {
            const imgUrl = item.images.length > 0 ? item.images[0] : 'https://images.unsplash.com/photo-1564013799919-ab600027ffc6?auto=format&fit=crop&w=800&q=80';
            const priceText = item.price > 0 ? `₹${item.price}` : 'Inquiry';

            let markerColor = 'blue';
            if (item.category === 'street_food') markerColor = 'orange';
            else if (item.category === 'pg' || item.category === 'hostel') markerColor = 'violet';
            else if (item.category === 'medical') markerColor = 'green';

            const customMarker = L.circleMarker([item.latitude, item.longitude], {
                radius: 10,
                fillColor: markerColor === 'orange' ? '#f97316' : markerColor === 'violet' ? '#db2777' : markerColor === 'green' ? '#10b981' : '#4f46e5',
                color: '#fff',
                weight: 2,
                opacity: 1,
                fillOpacity: 0.9
            }).addTo(markersLayer);

            const popupContent = `
                <div class="map-popup-card">
                    <img src="${imgUrl}" alt="${item.title}">
                    <div class="map-popup-info">
                        <h6 class="mb-1 text-truncate">${item.title}</h6>
                        <p class="text-muted small mb-2 text-truncate"><i class="bx bx-map"></i> ${item.address}</p>
                        <div class="d-flex justify-content-between align-items-center">
                            <span class="fw-bold text-primary">${priceText}</span>
                            <a href="listing_detail.html?id=${item.id}" class="btn btn-xs btn-primary py-1 px-2" style="font-size: 0.75rem;">View</a>
                        </div>
                    </div>
                </div>
            `;
            customMarker.bindPopup(popupContent);
        });
    }

    // =========================================
    // 7. HOMEPAGE DYNAMIC DATA LOADERS
    // =========================================
    async function loadHomepageContent() {
        const featContainer = document.getElementById('featured-listings-container');
        if (!featContainer) return;

        try {
            const userId = localStorage.getItem('user_id');
            const url = userId ? `${API_BASE_URL}/api/home-data?user_id=${userId}` : `${API_BASE_URL}/api/home-data`;
            
            const res = await fetch(url);
            const data = await res.json();
            
            if (data.status === 'success') {
                // Ingest Statistics
                document.getElementById('stat-listings').textContent = data.stats.listings;
                document.getElementById('stat-users').textContent = data.stats.users;
                document.getElementById('stat-listers').textContent = data.stats.listers;
                document.getElementById('stat-cities').textContent = data.stats.cities;

                // Render Featured Listings Grid
                if (data.featured.length === 0) {
                    featContainer.innerHTML = `<div class="col-12 text-center py-4"><p class="text-muted">No premium listings found. Seed database to unlock results.</p></div>`;
                } else {
                    let featHtml = '';
                    data.featured.forEach(item => {
                        const img = item.images.length > 0 ? item.images[0] : 'https://images.unsplash.com/photo-1564013799919-ab600027ffc6?auto=format&fit=crop&w=800&q=80';
                        featHtml += `
                            <div class="col-lg-4 col-md-6 mb-4">
                                <div class="listing-card">
                                    <div class="card-img-wrapper">
                                        <img src="${img}" alt="${item.title}">
                                        <div class="position-absolute top-2 left-2 p-2 d-flex flex-wrap gap-1" style="z-index: 10;">
                                            ${item.is_premium ? '<span class="badge badge-premium">PREMIUM</span>' : ''}
                                            ${item.vendor_verified ? '<span class="badge badge-verified"><i class="bx bxs-shield-checked"></i> VERIFIED</span>' : ''}
                                        </div>
                                    </div>
                                    <div class="p-3">
                                        <div class="d-flex justify-content-between align-items-center mb-1">
                                            <span class="text-muted small"><i class="bx bx-purchase-tag"></i> ${item.category.toUpperCase()}</span>
                                            <span class="rating-badge"><i class="bx bxs-star"></i> ${item.hygiene_rating}</span>
                                        </div>
                                        <h5 class="card-title text-truncate mb-1"><a href="listing_detail.html?id=${item.id}" class="text-decoration-none text-dark">${item.title}</a></h5>
                                        <p class="text-muted small mb-2 text-truncate"><i class="bx bx-map"></i> ${item.address}, ${item.city}</p>
                                        <hr class="my-2">
                                        <div class="d-flex justify-content-between align-items-center">
                                            <span class="fs-5 fw-bold text-primary">₹${Math.round(item.price)}</span>
                                            <a href="listing_detail.html?id=${item.id}" class="btn btn-sm btn-outline-primary">View Details</a>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        `;
                    });
                    featContainer.innerHTML = featHtml;
                }

                // Render Food split
                const foodContainer = document.getElementById('trending-food-container');
                if (foodContainer) {
                    if (data.popular_food.length === 0) {
                        foodContainer.innerHTML = '<p class="text-muted">No street food listings seeded.</p>';
                    } else {
                        let foodHtml = '';
                        data.popular_food.forEach(food => {
                            const img = food.images.length > 0 ? food.images[0] : 'https://images.unsplash.com/photo-1668236543090-82eba5ee5976?auto=format&fit=crop&w=800&q=80';
                            foodHtml += `
                                <div class="col-12 mb-3">
                                    <div class="d-flex gap-3 bg-light p-3 border rounded shadow-sm align-items-center">
                                        <img src="${img}" alt="${food.title}" class="rounded" style="width: 90px; height: 90px; object-fit: cover;">
                                        <div class="flex-grow-1 text-truncate">
                                            <h6 class="fw-bold mb-1"><a href="listing_detail.html?id=${food.id}" class="text-decoration-none text-dark">${food.title}</a></h6>
                                            <p class="text-muted small mb-1 text-truncate"><i class="bx bx-map"></i> ${food.address}</p>
                                            <div class="d-flex gap-2 align-items-center">
                                                <span class="rating-badge bg-warning-subtle text-warning" style="font-size: 0.8rem;"><i class="bx bxs-star"></i> ${food.hygiene_rating} Hygiene</span>
                                                <span class="fw-semibold text-primary" style="font-size: 0.85rem;">₹${Math.round(food.price)}</span>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            `;
                        });
                        foodContainer.innerHTML = foodHtml;
                    }
                }

                // Render Stays split
                const staysContainer = document.getElementById('recommended-stays-container');
                if (staysContainer) {
                    if (data.recommended_rooms.length === 0) {
                        staysContainer.innerHTML = '<p class="text-muted">No accommodations found.</p>';
                    } else {
                        let staysHtml = '';
                        data.recommended_rooms.forEach(rm => {
                            const img = rm.images.length > 0 ? rm.images[0] : 'https://images.unsplash.com/photo-1598928506311-c55ded91a20c?auto=format&fit=crop&w=800&q=80';
                            staysHtml += `
                                <div class="col-12 mb-3">
                                    <div class="d-flex gap-3 bg-light p-3 border rounded shadow-sm align-items-center">
                                        <img src="${img}" alt="${rm.title}" class="rounded" style="width: 90px; height: 90px; object-fit: cover;">
                                        <div class="flex-grow-1 text-truncate">
                                            <h6 class="fw-bold mb-1"><a href="listing_detail.html?id=${rm.id}" class="text-decoration-none text-dark">${rm.title}</a></h6>
                                            <p class="text-muted small mb-1 text-truncate"><i class="bx bx-purchase-tag"></i> ${rm.category.toUpperCase()} (${rm.gender_preference.toUpperCase()})</p>
                                            <div class="d-flex gap-3 align-items-center">
                                                <span class="fw-bold text-primary">₹${Math.round(rm.price)}/mo</span>
                                                <span class="text-muted small"><i class="bx bx-show"></i> ${rm.views_count} Views</span>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            `;
                        });
                        staysContainer.innerHTML = staysHtml;
                    }
                }
            }
        } catch (err) {
            console.error("Homepage load failed:", err);
        }
    }

    loadHomepageContent();

    // =========================================
    // 8. LISTING DETAILS PAGE CONTENT LOADER
    // =========================================
    async function loadListingDetailPage() {
        const titleElem = document.getElementById('detail-title');
        if (!titleElem) return;

        const urlParams = new URLSearchParams(window.location.search);
        const listingId = urlParams.get('id');
        if (!listingId) {
            titleElem.textContent = "Error: No listing specified.";
            return;
        }

        try {
            const uid = localStorage.getItem('user_id');
            const url = uid 
                ? `${API_BASE_URL}/api/listings?id=${listingId}&user_id=${uid}` 
                : `${API_BASE_URL}/api/listings?id=${listingId}`;

            const res = await fetch(url);
            const val = await res.json();

            if (val.status === 'success' && val.data.length > 0) {
                const item = val.data[0];
                
                // Document headers
                titleElem.textContent = item.title;
                document.getElementById('breadcrumb-title').textContent = item.title;
                document.getElementById('detail-address').textContent = `${item.address}, ${item.city}`;
                document.getElementById('detail-description').textContent = item.description;
                document.getElementById('detail-price').textContent = `₹${Math.round(item.price)}`;

                // Badges
                let badges = `<span class="badge bg-primary text-uppercase">${item.category}</span>`;
                if (item.is_premium) badges += '<span class="badge badge-premium">PREMIUM BOOST</span>';
                if (item.vendor_verified) badges += '<span class="badge badge-verified"><i class="bx bxs-shield-checked"></i> VERIFIED VENDOR</span>';
                if (item.is_trending) badges += '<span class="badge badge-trending"><i class="bx bxs-hot"></i> TRENDING</span>';
                document.getElementById('badges-container').innerHTML = badges;

                // Favorite button state
                const favBtn = document.getElementById('detail-fav-btn');
                const favIcon = document.getElementById('detail-fav-icon');
                if (item.is_favorited) {
                    favIcon.className = 'bx bxs-heart text-danger fs-5';
                }

                if (favBtn) {
                    favBtn.addEventListener('click', async () => {
                        if (!uid) {
                            alert("Please Sign In to save listings to favorites!");
                            return;
                        }
                        try {
                            const fRes = await fetch(`${API_BASE_URL}/api/listings/${item.id}/favorite?user_id=${uid}`, { method: 'POST' });
                            const fVal = await fRes.json();
                            if (fVal.status === 'success') {
                                alert(fVal.message);
                                if (fVal.action === 'added') {
                                    favIcon.className = 'bx bxs-heart text-danger fs-5';
                                } else {
                                    favIcon.className = 'bx bx-heart fs-5';
                                }
                            }
                        } catch (err) {
                            console.error(err);
                        }
                    });
                }

                // WhatsApp Chat Link
                const waLink = document.getElementById('wa-chat-link');
                if (waLink) {
                    const waText = encodeURIComponent(`Namaste, I am interested in your listing '${item.title}' on Bharat Byte. Please provide more details!`);
                    waLink.href = `https://wa.me/919835088300?text=${waText}`;
                }

                // Live Chat welcome
                const chatWelcome = document.getElementById('chat-welcome-msg');
                if (chatWelcome) {
                    chatWelcome.innerHTML = `Namaste! How can I help you find details about <strong>${item.title}</strong> today? Ask me about AC, WiFi, food, or occupancy!`;
                }

                // Carousel media
                const carouselInner = document.getElementById('carousel-images-container');
                if (item.images.length > 0) {
                    let imgsHtml = '';
                    item.images.forEach((img, i) => {
                        imgsHtml += `
                            <div class="carousel-item ${i === 0 ? 'active' : ''} h-100">
                                <img src="${img}" class="d-block w-100 h-100" style="object-fit: cover;" alt="Listing Media">
                            </div>
                        `;
                    });
                    carouselInner.innerHTML = imgsHtml;
                    if (item.images.length > 1) {
                        document.getElementById('carousel-prev').classList.remove('d-none');
                        document.getElementById('carousel-next').classList.remove('d-none');
                    }
                }

                // Specs list
                const specs = document.getElementById('detail-specifications');
                let specsHtml = '';
                if (['pg', 'hostel', 'room', 'flat'].includes(item.category)) {
                    specsHtml += `
                        <div class="col-md-6">
                            <div class="p-3 bg-light rounded" style="background: var(--bg-main) !important; border: 1px solid var(--border-color);">
                                <div class="small text-muted mb-1">Gender Preference</div>
                                <div class="fw-bold fs-6 text-uppercase text-primary">${item.gender_preference}</div>
                            </div>
                        </div>
                        <div class="col-md-6">
                            <div class="p-3 bg-light rounded" style="background: var(--bg-main) !important; border: 1px solid var(--border-color);">
                                <div class="small text-muted mb-1">Furnishing Status</div>
                                <div class="fw-bold fs-6 text-uppercase text-primary">${item.furnished_status}</div>
                            </div>
                        </div>
                    `;
                }
                specsHtml += `
                    <div class="col-md-6">
                        <div class="p-3 bg-light rounded" style="background: var(--bg-main) !important; border: 1px solid var(--border-color);">
                            <div class="small text-muted mb-1">Hygiene / Star Rating</div>
                            <div class="fw-bold fs-6 text-emerald"><i class="bx bxs-star text-warning"></i> ${item.hygiene_rating} / 5.0 Rating</div>
                        </div>
                    </div>
                    <div class="col-md-6">
                        <div class="p-3 bg-light rounded" style="background: var(--bg-main) !important; border: 1px solid var(--border-color);">
                            <div class="small text-muted mb-1">Contact Status</div>
                            <div class="fw-bold fs-6 text-emerald"><i class="bx bx-check-shield text-success"></i> Instant Response Guaranteed</div>
                        </div>
                    </div>
                `;
                specs.innerHTML = specsHtml;

                // Amenities Options
                const amenitiesCard = document.getElementById('detail-amenities-card');
                const amenitiesContainer = document.getElementById('detail-amenities-container');
                if (item.amenities.length > 0 || item.food_included) {
                    amenitiesCard.classList.remove('d-none');
                    let amHtml = '';
                    item.amenities.forEach(am => {
                        if (am.trim()) {
                            amHtml += `
                                <div class="col">
                                    <div class="d-flex align-items-center gap-2 py-2 px-3 bg-light rounded" style="background: var(--bg-main) !important; border: 1px solid var(--border-color);">
                                        <i class="bx bx-check-circle text-success fs-5"></i>
                                        <span class="fw-bold small text-uppercase">${am.trim()}</span>
                                    </div>
                                </div>
                            `;
                        }
                    });
                    if (item.food_included) {
                        amHtml += `
                            <div class="col">
                                <div class="d-flex align-items-center gap-2 py-2 px-3 bg-light rounded" style="background: var(--bg-main) !important; border: 1px solid var(--border-color);">
                                    <i class="bx bx-restaurant text-success fs-5"></i>
                                    <span class="fw-bold small text-uppercase">Food Included</span>
                                </div>
                            </div>
                        `;
                    }
                    amenitiesContainer.innerHTML = amHtml;
                }

                // Render mini Leaflet Map
                const detailMap = L.map('detail-mini-map').setView([item.latitude, item.longitude], 15);
                L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
                    attribution: '&copy; OpenStreetMap contributors'
                }).addTo(detailMap);
                L.marker([item.latitude, item.longitude]).addTo(detailMap).bindPopup(item.title).openPopup();

                // Dynamic Review Post Panel Setup
                const reviewBox = document.getElementById('write-review-container');
                const cachedUser = localStorage.getItem('username');
                if (uid && cachedUser) {
                    reviewBox.innerHTML = `
                        <div class="bg-light p-3 rounded mb-4" style="background: var(--bg-main) !important; border: 1px solid var(--border-color);">
                            <h6 class="fw-bold mb-2">Leave a Rating & Review</h6>
                            <form id="review-post-form">
                                <div class="mb-3 d-flex align-items-center gap-3">
                                    <label class="small fw-semibold text-muted mb-0">Star Rating:</label>
                                    <select id="review-rating" class="form-select form-select-sm border-secondary text-dark w-auto" required>
                                        <option value="5">5 Stars ⭐⭐⭐⭐⭐ (Excellent)</option>
                                        <option value="4">4 Stars ⭐⭐⭐⭐ (Very Good)</option>
                                        <option value="3">3 Stars ⭐⭐⭐ (Average)</option>
                                        <option value="2">2 Stars ⭐⭐ (Poor)</option>
                                        <option value="1">1 Star ⭐ (Unsatisfying)</option>
                                    </select>
                                </div>
                                <div class="mb-3">
                                    <textarea id="review-comment" class="form-control" rows="3" placeholder="Share your experience with food taste, room space, clean amenities, vendor safety..."></textarea>
                                </div>
                                <button type="submit" class="btn btn-sm btn-primary">Post Review</button>
                            </form>
                        </div>
                    `;

                    // Bind Review submit
                    document.getElementById('review-post-form').addEventListener('submit', async (ev) => {
                        ev.preventDefault();
                        const rating = document.getElementById('review-rating').value;
                        const comment = document.getElementById('review-comment').value;

                        try {
                            const rvRes = await fetch(`${API_BASE_URL}/api/listings/${item.id}/review?user_id=${uid}`, {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({ rating: parseInt(rating), comment: comment })
                            });
                            const rvVal = await rvRes.json();
                            
                            if (rvVal.status === 'success') {
                                alert(rvVal.message);
                                const reviewsList = document.getElementById('reviews-list-container');
                                const noRevMsg = document.getElementById('no-reviews-msg');
                                if (noRevMsg) noRevMsg.remove();
                                
                                const div = document.createElement('div');
                                div.className = 'border-bottom pb-3';
                                div.innerHTML = `
                                    <div class="d-flex justify-content-between mb-1">
                                        <h6 class="fw-bold mb-0 text-dark">${cachedUser}</h6>
                                        <span class="text-warning small fw-bold">${'⭐'.repeat(rating)}</span>
                                    </div>
                                    <p class="text-muted mb-1 small" style="line-height: 1.5;">"${comment}"</p>
                                    <div class="text-muted" style="font-size: 0.75rem;">Just posted</div>
                                `;
                                reviewsList.insertBefore(div, reviewsList.firstChild);
                                
                                const countElem = document.getElementById('total-reviews-count');
                                countElem.textContent = parseInt(countElem.textContent) + 1;
                                
                                document.getElementById('review-comment').value = '';
                            } else {
                                alert(rvVal.message);
                            }
                        } catch (err) {
                            console.error(err);
                        }
                    });
                }

                // Autocomplete values in Inquiry forms
                if (uid && cachedUser) {
                    const cachedEmail = localStorage.getItem('email') || `${cachedUser.toLowerCase().replace(/\s+/g, '')}@gmail.com`;
                    const nameInput = document.getElementById('inq-name');
                    const emailInput = document.getElementById('inq-email');
                    if (nameInput) nameInput.value = cachedUser;
                    if (emailInput) emailInput.value = cachedEmail;
                }

                // Setup inquiries / visit form submissions
                const handleInquirySubmit = async (e, formId) => {
                    e.preventDefault();
                    const form = document.getElementById(formId);
                    const inqType = form.getAttribute('data-type');

                    let name, email, phone, msg, scheduleDate = null;
                    if (inqType === 'inquiry') {
                        name = document.getElementById('inq-name').value;
                        email = document.getElementById('inq-email').value;
                        phone = document.getElementById('inq-phone').value;
                        msg = document.getElementById('inq-message').value;
                    } else {
                        name = cachedUser || "Guest User";
                        email = localStorage.getItem('email') || 'guest@bharatbyte.com';
                        phone = document.getElementById('visit-phone').value;
                        msg = document.getElementById('visit-notes').value || "Scheduling a visit request.";
                        scheduleDate = document.getElementById('visit-datetime').value;
                    }

                    try {
                        const iRes = await fetch(`${API_BASE_URL}/api/listings/${item.id}/inquire`, {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({
                                name: name,
                                email: email,
                                phone: phone,
                                message: msg,
                                type: inqType,
                                schedule_date: scheduleDate,
                                user_id: uid ? parseInt(uid) : null
                            })
                        });
                        const iVal = await iRes.json();
                        if (iVal.status === 'success') {
                            alert(iVal.message);
                            form.reset();
                        } else {
                            alert(iVal.message);
                        }
                    } catch (err) {
                        console.error(err);
                        alert("Inquiry submission failed.");
                    }
                };

                document.getElementById('inquiry-submit-form').addEventListener('submit', (e) => handleInquirySubmit(e, 'inquiry-submit-form'));
                document.getElementById('visit-schedule-form').addEventListener('submit', (e) => handleInquirySubmit(e, 'visit-schedule-form'));

                // Report fake submission
                document.getElementById('report-fake-form').addEventListener('submit', async (e) => {
                    e.preventDefault();
                    const reason = document.getElementById('report-reason').value;
                    if (!uid) {
                        alert("Please Sign In to file reports!");
                        return;
                    }
                    try {
                        const rRes = await fetch(`${API_BASE_URL}/api/listings/${item.id}/report?user_id=${uid}`, {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ reason: reason })
                        });
                        const rVal = await rRes.json();
                        alert(rVal.message);
                        bootstrap.Modal.getInstance(document.getElementById('reportModal')).hide();
                        document.getElementById('report-reason').value = '';
                    } catch (err) {
                        console.error(err);
                    }
                });
            }
        } catch (error) {
            console.error("Listing details load issue:", error);
            titleElem.textContent = "Listing details unavailable.";
        }
    }

    loadListingDetailPage();

    // =========================================
    // 9. LISTER STUDIO DASHBOARD DATA LOADER
    // =========================================
    async function loadListerDashboard() {
        const listerGrid = document.getElementById('lister-listings-container');
        if (!listerGrid) return;

        const uid = localStorage.getItem('user_id');
        const role = localStorage.getItem('role');

        if (!uid || role !== 'lister') {
            alert("Lister session expired. Access denied.");
            window.location.href = 'auth.html';
            return;
        }

        try {
            const res = await fetch(`${API_BASE_URL}/api/lister/listings?user_id=${uid}`);
            const val = await res.json();

            if (val.status === 'success') {
                // Statistics
                document.getElementById('stat-listings-count').textContent = val.listings.length;
                document.getElementById('stat-views-count').textContent = val.total_views;
                document.getElementById('stat-leads-count').textContent = val.total_inquiries;
                
                const rate = val.total_views > 0 ? ((val.total_inquiries / val.total_views) * 100).toFixed(1) + "%" : "0.0%";
                document.getElementById('stat-conversion-rate').textContent = rate;

                // Load User stats
                const code = localStorage.getItem('referral_code') || "BBLISTER";
                const pts = localStorage.getItem('reward_points') || "0";
                document.getElementById('referral-code-badge').textContent = code;
                document.getElementById('reward-points-value').textContent = `${pts} pts`;
                document.getElementById('reward-points-rupees').textContent = pts;

                // Render Active Listings
                if (val.listings.length === 0) {
                    listerGrid.innerHTML = `
                        <div class="text-center py-5 text-muted col-12">
                            <i class="bx bx-info-circle text-muted fs-1 mb-2"></i>
                            <h5>No active listings. Click 'Add New Service' tab to build one!</h5>
                        </div>
                    `;
                } else {
                    let html = '';
                    val.listings.forEach(item => {
                        const img = item.images.length > 0 ? item.images[0] : 'https://images.unsplash.com/photo-1564013799919-ab600027ffc6?auto=format&fit=crop&w=800&q=80';
                        html += `
                            <div class="col-md-6 mb-4" id="list-card-${item.id}">
                                <div class="d-flex bg-light p-3 border rounded shadow-sm gap-3 align-items-center" style="background: var(--bg-main) !important; border: 1px solid var(--border-color) !important;">
                                    <img src="${img}" class="rounded" style="width: 100px; height: 100px; object-fit: cover;" alt="Listing Thumbnail">
                                    <div class="flex-grow-1 text-truncate">
                                        <h6 class="fw-bold mb-1"><a href="listing_detail.html?id=${item.id}" class="text-decoration-none text-dark">${item.title}</a></h6>
                                        <div class="small text-muted mb-2"><i class="bx bx-show"></i> ${item.views_count} Views | <i class="bx bx-chat"></i> ${item.inquiries_count} Leads</div>
                                        <div class="d-flex gap-2">
                                            <button onclick="promoteListing('${item.id}')" class="btn btn-xs btn-warning py-1 px-2 fw-semibold text-white border-0" style="font-size: 0.75rem;"><i class="bx bxs-hot"></i> Boost Premium</button>
                                            <button onclick="deleteListing('${item.id}')" class="btn btn-xs btn-danger py-1 px-2 fw-semibold border-0" style="font-size: 0.75rem;"><i class="bx bx-trash"></i> Delete</button>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        `;
                    });
                    listerGrid.innerHTML = html;
                }

                // Render Inquiries Table
                const inquiriesContainer = document.getElementById('lister-inquiries-container');
                if (val.inquiries.length === 0) {
                    inquiriesContainer.innerHTML = `<tr><td colspan="6" class="text-center py-4 text-muted">No inquiries received for your listings yet.</td></tr>`;
                } else {
                    let inqHtml = '';
                    val.inquiries.forEach(inq => {
                        inqHtml += `
                            <tr id="inq-row-${inq.id}">
                                <td>
                                    <div class="fw-bold text-dark">${inq.name}</div>
                                    <div class="text-muted small" style="font-size: 0.75rem;">ID: #${inq.id}</div>
                                </td>
                                <td>
                                    <div class="small"><i class="bx bx-envelope text-dark"></i> ${inq.email}</div>
                                    <div class="small"><i class="bx bx-phone text-dark"></i> ${inq.phone}</div>
                                </td>
                                <td style="max-width: 200px; white-space: normal;">
                                    <div class="small text-muted">"${inq.message}"</div>
                                </td>
                                <td>
                                    <span class="badge ${inq.type === 'visit_schedule' ? 'bg-success' : inq.type === 'booking' ? 'bg-primary' : 'bg-secondary'}">
                                        ${inq.type.toUpperCase()}
                                    </span>
                                </td>
                                <td class="small text-primary fw-semibold">
                                    ${inq.schedule_date ? inq.schedule_date : 'N/A'}
                                </td>
                                <td>
                                    <select onchange="updateInquiryStatus('${inq.id}', this.value)" class="form-select form-select-sm border-secondary w-auto">
                                        <option value="pending" ${inq.status === 'pending' ? 'selected' : ''}>Pending ⏳</option>
                                        <option value="contacted" ${inq.status === 'contacted' ? 'selected' : ''}>Contacted 📞</option>
                                        <option value="resolved" ${inq.status === 'resolved' ? 'selected' : ''}>Resolved ✅</option>
                                    </select>
                                </td>
                            </tr>
                        `;
                    });
                    inquiriesContainer.innerHTML = inqHtml;
                }
            }
        } catch (err) {
            console.error("Lister dashboard load issue:", err);
        }
    }

    loadListerDashboard();

    // Bind dashboard global helper functions window definitions
    window.promoteListing = async function(id) {
        try {
            const res = await fetch(`${API_BASE_URL}/api/listings/${id}/promote?user_id=${localStorage.getItem('user_id')}`, { method: 'POST' });
            const val = await res.json();
            alert(val.message);
            loadListerDashboard();
        } catch (err) {
            console.error(err);
        }
    };

    window.deleteListing = async function(id) {
        if (!confirm("Are you sure you want to permanently delete this listing?")) return;
        try {
            const res = await fetch(`${API_BASE_URL}/api/listings/${id}/delete?user_id=${localStorage.getItem('user_id')}`, { method: 'POST' });
            const val = await res.json();
            if (val.status === 'success') {
                alert(val.message);
                loadListerDashboard();
            } else {
                alert(val.message);
            }
        } catch (err) {
            console.error(err);
        }
    };

    window.updateInquiryStatus = async function(id, newStatus) {
        try {
            const res = await fetch(`${API_BASE_URL}/api/inquiries/${id}/status?user_id=${localStorage.getItem('user_id')}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ status: newStatus })
            });
            const val = await res.json();
            alert(val.message);
        } catch (err) {
            console.error(err);
        }
    };

    // Bind Lister creation form submit call
    const createForm = document.getElementById('listing-creation-form');
    if (createForm) {
        createForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const uid = localStorage.getItem('user_id');

            const title = document.getElementById('list-title').value;
            const category = document.getElementById('list-category').value;
            const price = document.getElementById('list-price').value;
            const lat = document.getElementById('list-lat').value;
            const lng = document.getElementById('list-lng').value;
            const address = document.getElementById('list-address').value;
            const city = document.getElementById('list-city').value;
            const images = document.getElementById('list-images').value;
            const videos = document.getElementById('list-videos').value;
            const gender = document.getElementById('list-gender').value;
            const furnished = document.getElementById('list-furnished').value;
            const food = document.getElementById('list-food').checked;
            const desc = document.getElementById('list-description').value;

            const amenities = Array.from(document.querySelectorAll('.list-amenities-check:checked')).map(el => el.value).join(',');

            try {
                const res = await fetch(`${API_BASE_URL}/api/listings/create?user_id=${uid}`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        title: title,
                        category: category,
                        price: price,
                        latitude: lat,
                        longitude: lng,
                        address: address,
                        city: city,
                        images: images,
                        videos: videos,
                        gender_preference: gender,
                        furnished_status: furnished,
                        food_included: food,
                        amenities: amenities,
                        description: desc
                    })
                });
                const val = await res.json();
                
                if (val.status === 'success') {
                    alert(val.message);
                    createForm.reset();
                    // Go to Active Listings tab
                    bootstrap.Tab.getInstance(document.getElementById('my-listings-tab')).show();
                    loadListerDashboard();
                } else {
                    alert(val.message);
                }
            } catch (err) {
                console.error(err);
                alert("Error creating listing.");
            }
        });
    }

    // AI description simulation inside lister creation
    const aiDescBtn = document.getElementById('ai-desc-generate-btn');
    if (aiDescBtn) {
        aiDescBtn.addEventListener('click', async () => {
            const title = document.getElementById('list-title').value;
            const category = document.getElementById('list-category').value;
            const price = document.getElementById('list-price').value;
            const gender = document.getElementById('list-gender').value;
            const furnished = document.getElementById('list-furnished').value;
            const amenities = Array.from(document.querySelectorAll('.list-amenities-check:checked')).map(el => el.value).join(', ');

            if (!title) {
                alert("Please add a listing title first to give context!");
                return;
            }

            aiDescBtn.disabled = true;
            aiDescBtn.textContent = "Writing description...";

            try {
                const res = await fetch(`${API_BASE_URL}/api/ai/generate-description`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        title: title,
                        category: category,
                        price: price,
                        amenities: amenities,
                        gender_preference: gender,
                        furnished_status: furnished
                    })
                });
                const result = await res.json();
                
                if (result.status === 'success') {
                    const descArea = document.getElementById('list-description');
                    if (descArea) {
                        descArea.value = result.ai_description;
                    }
                } else {
                    alert(result.message);
                }
            } catch (err) {
                console.error(err);
                alert("AI Server failed to generate description.");
            } finally {
                aiDescBtn.disabled = false;
                aiDescBtn.textContent = "Generate AI Description ✨";
            }
        });
    }

    // =========================================
    // 10. ADMINISTRATIVE CONSOLE DATA LOADER
    // =========================================
    async function loadAdminDashboard() {
        const reportsContainer = document.getElementById('admin-reports-container');
        if (!reportsContainer) return;

        const uid = localStorage.getItem('user_id');
        const role = localStorage.getItem('role');

        if (!uid || role !== 'admin') {
            alert("Admin credentials expired. Access denied.");
            window.location.href = 'admin_login.html';
            return;
        }

        try {
            const res = await fetch(`${API_BASE_URL}/api/admin/dashboard?user_id=${uid}`);
            const val = await res.json();

            if (val.status === 'success') {
                // Ingest stats cards
                document.getElementById('stat-reports-count').textContent = val.stats.reports;
                document.getElementById('stat-users-count').textContent = val.stats.users;
                document.getElementById('stat-listers-count').textContent = val.stats.listers;
                document.getElementById('stat-listings-count').textContent = val.stats.listings;

                // Render Flags / Reports Table
                if (val.reports.length === 0) {
                    reportsContainer.innerHTML = `<tr><td colspan="6" class="text-center py-4 text-muted">No listing flags reported yet. Excellent!</td></tr>`;
                } else {
                    let repHtml = '';
                    val.reports.forEach(rep => {
                        repHtml += `
                            <tr id="report-row-${rep.id}" class="${rep.status === 'pending' ? 'table-warning-subtle' : ''}">
                                <td>
                                    <div class="fw-bold text-dark">${rep.listing_title}</div>
                                    <div class="text-muted small" style="font-size: 0.75rem;">Listing ID: #${rep.listing_id}</div>
                                </td>
                                <td style="max-width: 250px; white-space: normal;">
                                    <div class="small fw-semibold text-danger">"${rep.reason}"</div>
                                </td>
                                <td>
                                    <div class="small fw-bold text-dark">${rep.user_username}</div>
                                    <div class="text-muted small" style="font-size: 0.75rem;">${rep.user_email}</div>
                                </td>
                                <td class="small text-muted">${rep.created_at}</td>
                                <td>
                                    <span class="badge ${rep.status === 'resolved' ? 'bg-success' : 'bg-danger'}">
                                        ${rep.status.toUpperCase()}
                                    </span>
                                </td>
                                <td>
                                    ${rep.status === 'pending' ? `
                                    <div class="d-flex gap-2">
                                        <button onclick="resolveReport(${rep.id}, 'delete_listing')" class="btn btn-xs btn-danger py-1 px-2 fw-semibold border-0" style="font-size: 0.75rem;"><i class="bx bx-trash"></i> Ban Listing</button>
                                        <button onclick="resolveReport(${rep.id}, 'dismiss')" class="btn btn-xs btn-secondary py-1 px-2 fw-semibold border-0" style="font-size: 0.75rem;"><i class="bx bx-check"></i> Dismiss</button>
                                    </div>
                                    ` : `<span class="text-muted small">Resolved</span>`}
                                </td>
                            </tr>
                        `;
                    });
                    reportsContainer.innerHTML = repHtml;
                }

                // Render Listings Audit Table
                const auditContainer = document.getElementById('admin-listings-container');
                if (val.listings.length === 0) {
                    auditContainer.innerHTML = `<tr><td colspan="6" class="text-center py-4 text-muted">No active listings stored in database.</td></tr>`;
                } else {
                    let lisHtml = '';
                    val.listings.forEach(item => {
                        lisHtml += `
                            <tr id="listing-audit-row-${item.id}">
                                <td>
                                    <div class="fw-bold text-dark">${item.title}</div>
                                    <div class="text-muted small" style="font-size: 0.75rem;">Lister ID: #${item.lister_id}</div>
                                </td>
                                <td>
                                    <span class="badge bg-secondary text-uppercase">${item.category}</span>
                                </td>
                                <td class="small text-muted">${item.address}, ${item.city}</td>
                                <td class="fw-bold text-primary">₹${Math.round(item.price)}</td>
                                <td>
                                    <div class="form-check form-switch">
                                        <input onchange="toggleVerifyBadge(${item.id})" class="form-check-input" type="checkbox" id="verifyBadge-${item.id}" ${item.vendor_verified ? 'checked' : ''}>
                                        <label class="form-check-label small fw-bold text-success" for="verifyBadge-${item.id}">Verified Badge</label>
                                    </div>
                                </td>
                                <td>
                                    <button onclick="adminDeleteListing(${item.id})" class="btn btn-xs btn-outline-danger py-1 px-2 border-0" style="font-size: 0.75rem;"><i class="bx bx-trash"></i> Delete</button>
                                </td>
                            </tr>
                        `;
                    });
                    auditContainer.innerHTML = lisHtml;
                }

                // Render Users Accounts Table
                const usersContainer = document.getElementById('admin-users-container');
                let userHtml = '';
                val.users.forEach(u => {
                    userHtml += `
                        <tr>
                            <td>
                                <div class="fw-bold text-dark">${u.username}</div>
                                <div class="text-muted small" style="font-size: 0.75rem;">User ID: #${u.id}</div>
                            </td>
                            <td class="text-muted">${u.email}</td>
                            <td>
                                <span class="badge ${u.role === 'admin' ? 'bg-danger' : u.role === 'lister' ? 'bg-primary' : 'bg-secondary'}">
                                    ${u.role.toUpperCase()}
                                </span>
                            </td>
                            <td>
                                ${u.is_verified 
                                    ? '<span class="text-success fw-bold"><i class="bx bx-check-circle"></i> Yes</span>' 
                                    : '<span class="text-danger fw-bold"><i class="bx bx-x-circle"></i> No</span>'}
                            </td>
                            <td class="fw-semibold text-primary">${u.reward_points} pts</td>
                            <td class="small text-muted">${u.created_at}</td>
                        </tr>
                    `;
                });
                usersContainer.innerHTML = userHtml;
            }
        } catch (err) {
            console.error("Admin dashboard load issue:", err);
        }
    }

    loadAdminDashboard();

    // =========================================
    // 12. DIRECT CHAT SIMULATOR
    // =========================================
    const directChatForm = document.getElementById('live-chat-send-form');
    if (directChatForm) {
        directChatForm.addEventListener('submit', (e) => {
            e.preventDefault();
            const input = document.getElementById('live-chat-input');
            const text = input.value.trim();
            if (!text) return;

            const logs = document.getElementById('live-chat-logs');
            const sentDiv = document.createElement('div');
            sentDiv.className = 'chat-msg sent';
            sentDiv.textContent = text;
            logs.appendChild(sentDiv);
            logs.scrollTop = logs.scrollHeight;
            input.value = '';

            setTimeout(() => {
                const receivedDiv = document.createElement('div');
                receivedDiv.className = 'chat-msg received';
                receivedDiv.textContent = "Namaste! Thank you for contacting Bharat Byte. I received your inquiry. Let me review your request and get back to you shortly!";
                logs.appendChild(receivedDiv);
                logs.scrollTop = logs.scrollHeight;
            }, 1500);
        });
    }

    // =========================================
    // 13. MOBILE MAP/LIST FAB VIEW TOGGLE
    // =========================================
    const mobileToggleBtn = document.getElementById('mobile-view-toggle-btn');
    if (mobileToggleBtn) {
        mobileToggleBtn.addEventListener('click', () => {
            const splitContainer = document.querySelector('.split-container');
            if (splitContainer) {
                splitContainer.classList.toggle('show-map-view');
                const isMapView = splitContainer.classList.contains('show-map-view');
                
                const btnText = mobileToggleBtn.querySelector('span');
                const btnIcon = mobileToggleBtn.querySelector('i');
                if (isMapView) {
                    if (btnText) btnText.textContent = 'Show List';
                    if (btnIcon) btnIcon.className = 'bx bx-list-ul';
                } else {
                    if (btnText) btnText.textContent = 'Show Map';
                    if (btnIcon) btnIcon.className = 'bx bx-map';
                }
                
                // Redraw leaflet map boundary on toggle size changes
                if (map && isMapView) {
                    setTimeout(() => {
                        map.invalidateSize();
                    }, 100);
                }
            }
        });
    }

});

/* ====================================================
   BHARAT BYTE CORE CLIENT CONTROLLER
   Unified Maps, AI, Multi-theme, Translation, & APIs
   ==================================================== */

document.addEventListener('DOMContentLoaded', () => {

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
        }, 1200); // Standard quick transition
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

        // Apply translations to data-translate attributes
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
    // 4. GPS GEOLOCATION & MAP INTEGRATION
    // =========================================
    let userLat = null;
    let userLng = null;
    let map = null;
    let markersLayer = null;
    let listingsData = [];

    const gpsBtn = document.getElementById('gps-btn');
    const latInput = document.getElementById('user-lat');
    const lngInput = document.getElementById('user-lng');
    const locationDisplay = document.getElementById('gps-status-text');

    if (gpsBtn) {
        gpsBtn.addEventListener('click', () => {
            if (locationDisplay) locationDisplay.textContent = "Locating...";
            if (navigator.geolocation) {
                navigator.geolocation.getCurrentPosition(
                    (position) => {
                        userLat = position.coords.latitude;
                        userLng = position.coords.longitude;
                        if (latInput) latInput.value = userLat;
                        if (lngInput) lngInput.value = userLng;
                        if (locationDisplay) locationDisplay.textContent = `Location Verified: ${userLat.toFixed(4)}, ${userLng.toFixed(4)}`;
                        
                        // If map exists, pan to location
                        if (map) {
                            map.setView([userLat, userLng], 14);
                            // Add red dot for user
                            L.circle([userLat, userLng], {
                                color: 'red',
                                fillColor: '#f03',
                                fillOpacity: 0.3,
                                radius: 500
                            }).addTo(map).bindPopup("Your Geolocation").openPopup();
                        }

                        // Trigger listings reload
                        loadListings();
                    },
                    (error) => {
                        console.error(error);
                        if (locationDisplay) locationDisplay.textContent = "Permission denied or unavailable.";
                    }
                );
            } else {
                if (locationDisplay) locationDisplay.textContent = "GPS not supported by browser.";
            }
        });
    }

    // Initialize Leaflet Map
    const mapElement = document.getElementById('leaflet-map');
    if (mapElement) {
        // Start centered on Gandhinagar (Capital of Gujarat)
        const defaultLat = 23.2156;
        const defaultLng = 72.6369;
        
        map = L.map('leaflet-map').setView([defaultLat, defaultLng], 13);
        
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '&copy; OpenStreetMap contributors'
        }).addTo(map);

        markersLayer = L.layerGroup().addTo(map);
    }

    // =========================================
    // 5. REST API FOR DISCOVERY SEARCH
    // =========================================
    const searchForm = document.getElementById('discovery-search-form');
    if (searchForm || mapElement) {
        loadListings(); // Load initially
        
        // Listeners for side filters
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

        // Build query URL
        const params = new URLSearchParams();
        
        // Category Selector
        const catElem = document.getElementById('filter-category');
        if (catElem) params.append('category', catElem.value);

        // Search String
        const searchElem = document.getElementById('filter-search');
        if (searchElem && searchElem.value) params.append('search', searchElem.value);

        // GPS Coordinates
        if (userLat) {
            params.append('latitude', userLat);
            params.append('longitude', userLng);
            const distElem = document.getElementById('filter-distance');
            if (distElem) params.append('distance', distElem.value);
        }

        // Price, Rating, Verified
        const priceElem = document.getElementById('filter-price');
        if (priceElem) params.append('price', priceElem.value);

        const ratingElem = document.getElementById('filter-rating');
        if (ratingElem && ratingElem.value != 'all') params.append('rating', ratingElem.value);

        const verifiedElem = document.getElementById('filter-verified');
        if (verifiedElem && verifiedElem.checked) params.append('verified', 'true');

        // Accommodation Specifics
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

        try {
            const res = await fetch(`/api/listings?${params.toString()}`);
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
            
            // Generate dynamic badges
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
                            <h5 class="card-title text-truncate mb-1"><a href="/listings/${item.id}" class="text-decoration-none text-dark">${item.title}</a></h5>
                            <p class="text-muted small mb-2 text-truncate"><i class="bx bx-map"></i> ${item.address}, ${item.city}</p>
                            ${distanceBadge} ${genderBadge}
                            <hr class="my-2">
                            <div class="d-flex justify-content-between align-items-center">
                                <span class="fs-5 fw-bold text-primary">${priceText}</span>
                                <a href="/listings/${item.id}" class="btn btn-sm btn-outline-primary">View Details</a>
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
                
                try {
                    const res = await fetch(`/api/listings/${listingId}/favorite`, { method: 'POST' });
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

            // Custom markers based on category
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
                            <a href="/listings/${item.id}" class="btn btn-xs btn-primary py-1 px-2" style="font-size: 0.75rem;">View</a>
                        </div>
                    </div>
                </div>
            `;
            customMarker.bindPopup(popupContent);
        });
    }

    // =========================================
    // 6. AI SEARCH ASSISTANT PANEL
    // =========================================
    const chatInput = document.getElementById('ai-chat-input');
    const chatBtn = document.getElementById('ai-chat-btn');
    const chatLogs = document.getElementById('ai-chat-logs');

    if (chatBtn && chatInput) {
        chatBtn.addEventListener('click', () => submitAIChat());
        chatInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') submitAIChat();
        });
    }

    async function submitAIChat() {
        const text = chatInput.value.trim();
        if (!text) return;

        // Append user query to chat logs
        appendChatMessage(text, 'sent');
        chatInput.value = '';

        // Typing indicator
        const typingId = appendChatMessage("Analyzing parameters...", 'received typing');

        try {
            const response = await fetch('/api/ai/search-assistant', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ message: text })
            });
            const result = await response.json();
            
            // Remove typing element
            const typingElem = document.getElementById(typingId);
            if (typingElem) typingElem.remove();

            if (result.status === 'success') {
                appendChatMessage(result.reply, 'received');
                
                // Dynamically apply parsed filters to discovery fields & trigger reload!
                const parsed = result.filters;
                
                if (parsed.category !== 'all') {
                    const catSelect = document.getElementById('filter-category');
                    if (catSelect) catSelect.value = parsed.category;
                }
                
                if (parsed.gender !== 'all') {
                    const genderSelect = document.getElementById('filter-gender');
                    if (genderSelect) genderSelect.value = parsed.gender;
                }

                if (parsed.price) {
                    const priceSlider = document.getElementById('filter-price');
                    if (priceSlider) {
                        priceSlider.value = parsed.price;
                        document.getElementById('price-val-display').textContent = parsed.price;
                    }
                }

                if (parsed.ac) {
                    const acCheck = document.getElementById('filter-ac');
                    if (acCheck) acCheck.checked = true;
                }
                if (parsed.wifi) {
                    const wifiCheck = document.getElementById('filter-wifi');
                    if (wifiCheck) wifiCheck.checked = true;
                }
                if (parsed.parking) {
                    const parkingCheck = document.getElementById('filter-parking');
                    if (parkingCheck) parkingCheck.checked = true;
                }

                // Reload map & listings
                loadListings();
            } else {
                appendChatMessage("Sorry, I had trouble parsing that recommendation. Can you ask in a different way?", 'received');
            }
        } catch (error) {
            console.error(error);
            const typingElem = document.getElementById(typingId);
            if (typingElem) typingElem.remove();
            appendChatMessage("Connection issue with AI processor.", 'received');
        }
    }

    function appendChatMessage(message, senderClass) {
        if (!chatLogs) return null;
        const msgId = 'msg-' + Math.random().toString(36).substr(2, 9);
        const div = document.createElement('div');
        div.id = msgId;
        div.className = `chat-msg ${senderClass}`;
        div.innerHTML = message;
        chatLogs.appendChild(div);
        chatLogs.scrollTop = chatLogs.scrollHeight;
        return msgId;
    }

    // =========================================
    // 7. AI DESCRIPTION BUILDER (LISTERS)
    // =========================================
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
                const res = await fetch('/api/ai/generate-description', {
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
    // 8. DIRECT CHAT & WHATSAPP
    // =========================================
    const directChatForm = document.getElementById('live-chat-send-form');
    if (directChatForm) {
        directChatForm.addEventListener('submit', (e) => {
            e.preventDefault();
            const input = document.getElementById('live-chat-input');
            const text = input.value.trim();
            if (!text) return;

            // Render sent message
            const logs = document.getElementById('live-chat-logs');
            const sentDiv = document.createElement('div');
            sentDiv.className = 'chat-msg sent';
            sentDiv.textContent = text;
            logs.appendChild(sentDiv);
            logs.scrollTop = logs.scrollHeight;
            input.value = '';

            // Simulate automatic vendor quick reply after 1.5s
            setTimeout(() => {
                const receivedDiv = document.createElement('div');
                receivedDiv.className = 'chat-msg received';
                receivedDiv.textContent = "Namaste! Thank you for contacting Bharat Byte. I received your inquiry. Let me review your request and get back to you shortly!";
                logs.appendChild(receivedDiv);
                logs.scrollTop = logs.scrollHeight;
            }, 1500);
        });
    }

});

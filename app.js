/**
 * UK Foodie Interactive Map Application
 * High-performance, rich interactive map with local database and photo gallery
 */

(function () {
  'use strict';

  // State
  let restaurants = [];
  let filteredList = [];
  let currentRestaurant = null;
  let currentPhotoIndex = 0;
  let activePhotos = [];
  
  // Filters
  const state = {
    search: '',
    rating: 'all', // all, star, thumb_up, thumb_down, closed
    city: 'all',   // all, 伦敦, 剑桥, 牛津, 爱丁堡, 格拉斯哥, 曼彻斯特, 伯明翰, 康沃尔彭赞斯
    area: 'all',   // for london: all, Soho, Battersea, etc.
    category: 'all', // all, 中餐, 亚洲菜, 西餐, 甜品饮品, 酒吧夜生活
    tag: 'all',
    theme: localStorage.getItem('foodie_theme') || 'light'
  };

  // City view coordinates
  const CITY_COORDS = {
    'all': { center: [54.0, -2.5], zoom: 6 },
    '伦敦': { center: [51.5074, -0.1278], zoom: 12 },
    '市中心/Soho': { center: [51.5134, -0.1315], zoom: 15 },
    'Battersea': { center: [51.4740, -0.1680], zoom: 14 },
    'Kensington': { center: [51.4988, -0.1749], zoom: 14 },
    'White City': { center: [51.5085, -0.2230], zoom: 14 },
    '爱丁堡': { center: [55.9533, -3.1883], zoom: 13 },
    '格拉斯哥': { center: [55.8642, -4.2518], zoom: 13 },
    '曼彻斯特': { center: [53.4808, -2.2426], zoom: 13 },
    '伯明翰': { center: [52.4862, -1.8904], zoom: 13 },
    '剑桥': { center: [52.2053, 0.1218], zoom: 14 },
    '牛津': { center: [51.7520, -1.2577], zoom: 14 },
    '康沃尔彭赞斯': { center: [50.1500, -5.5000], zoom: 11 }
  };

  // Map variables
  let map = null;
  let markerCluster = null;
  let markersMap = new Map(); // resto_id -> array of Leaflet markers
  let tileLayers = {};
  let currentTileLayer = null;

  // DOM Elements
  const elList = document.getElementById('restoList');
  const elCount = document.getElementById('visibleCount');
  const elTotalPhotos = document.getElementById('totalPhotosCount');
  const elSearch = document.getElementById('searchInput');
  const elSearchClear = document.getElementById('searchClear');
  const elLondonAreaWrap = document.getElementById('londonAreaWrap');
  const elLondonAreaSelect = document.getElementById('londonAreaSelect');
  const elCategoryChips = document.getElementById('categoryChips');
  const elRatingChips = document.getElementById('ratingChips');
  const elCityChips = document.getElementById('cityChips');
  const elDetailDrawer = document.getElementById('detailDrawer');
  const elDrawerContent = document.getElementById('drawerContent');
  const elDrawerClose = document.getElementById('drawerClose');
  const elLightbox = document.getElementById('lightboxModal');
  const elLightboxImg = document.getElementById('lightboxImg');
  const elLightboxCaption = document.getElementById('lightboxCaption');
  const elLuckyBtn = document.getElementById('btnLucky');
  const elLuckyModal = document.getElementById('luckyModal');
  const elLuckyCard = document.getElementById('luckyCard');
  const elLuckyClose = document.getElementById('luckyClose');
  const elThemeToggle = document.getElementById('btnThemeToggle');
  const elToast = document.getElementById('toastMsg');

  // Initialize
  async function init() {
    initTheme();
    initMap();
    await loadData();
    setupEventListeners();
    applyFilters();
  }

  // Theme
  function initTheme() {
    document.documentElement.setAttribute('data-theme', state.theme);
    updateThemeIcon();
  }

  function toggleTheme() {
    state.theme = state.theme === 'light' ? 'dark' : 'light';
    localStorage.setItem('foodie_theme', state.theme);
    document.documentElement.setAttribute('data-theme', state.theme);
    updateThemeIcon();
    switchMapTheme(state.theme);
  }

  function updateThemeIcon() {
    if (elThemeToggle) {
      elThemeToggle.innerHTML = state.theme === 'dark' ? '☀️ 浅色' : '🌙 深色';
    }
  }

  // Map initialization
  function initMap() {
    // 1. OpenStreetMap 标准图层 (Default)
    tileLayers.osm = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      maxZoom: 19
    });

    // 2. OpenStreetMap HOT 人道救援增强版
    tileLayers.osmHot = L.tileLayer('https://{s}.tile.openstreetmap.fr/hot/{z}/{x}/{y}.png', {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      maxZoom: 19
    });

    // 3. CartoDB 极简浅色 (Voyager)
    tileLayers.cartoLight = L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>',
      subdomains: 'abcd',
      maxZoom: 19
    });

    // 4. CartoDB 深色模式 (Dark Matter)
    tileLayers.cartoDark = L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
      attribution: '&copy; OpenStreetMap &copy; CARTO',
      subdomains: 'abcd',
      maxZoom: 19
    });

    // Default to OpenStreetMap
    const defaultLayer = state.theme === 'dark' ? tileLayers.cartoDark : tileLayers.osm;

    map = L.map('map', {
      center: CITY_COORDS['伦敦'].center,
      zoom: CITY_COORDS['伦敦'].zoom,
      zoomControl: false,
      layers: [defaultLayer]
    });

    currentTileLayer = defaultLayer;

    // Add Layer Switcher control
    const baseLayers = {
      "🗺️ OpenStreetMap 标准": tileLayers.osm,
      "🎨 OpenStreetMap 详细": tileLayers.osmHot,
      "☀️ 极简浅色": tileLayers.cartoLight,
      "🌙 极简深色": tileLayers.cartoDark
    };
    L.control.layers(baseLayers, null, { position: 'bottomleft' }).addTo(map);

    // Zoom control in bottom right
    L.control.zoom({ position: 'bottomright' }).addTo(map);

    // Marker cluster group
    markerCluster = L.markerClusterGroup({
      showCoverageOnHover: false,
      maxClusterRadius: 40,
      iconCreateFunction: function (cluster) {
        const count = cluster.getChildCount();
        return L.divIcon({
          html: `<div class="marker-cluster-custom-inner">${count}</div>`,
          className: 'marker-cluster-custom',
          iconSize: [38, 38]
        });
      }
    });

    map.addLayer(markerCluster);
  }

  function switchMapTheme(theme) {
    if (!map) return;
    map.removeLayer(currentTileLayer);
    currentTileLayer = theme === 'dark' ? tileLayers.cartoDark : tileLayers.osm;
    map.addLayer(currentTileLayer);
  }

  // Load Data
  async function loadData() {
    if (window.RESTAURANTS_DATA && Array.isArray(window.RESTAURANTS_DATA)) {
      restaurants = window.RESTAURANTS_DATA;
    } else {
      try {
        const res = await fetch('data/restaurants.json');
        restaurants = await res.json();
      } catch (err) {
        console.error('Failed to load restaurants data:', err);
      }
    }

    // Populate London Area options
    populateLondonAreas();
  }

  function populateLondonAreas() {
    const londonAreas = new Set();
    restaurants.forEach(r => {
      if (r.city === '伦敦' && r.area && !r.area.startsWith('🔗') && !r.area.startsWith('🥤') && !r.area.startsWith('🍸')) {
        londonAreas.add(r.area);
      }
    });

    const sortedAreas = Array.from(londonAreas).sort();
    sortedAreas.forEach(area => {
      const opt = document.createElement('option');
      opt.value = area;
      opt.textContent = area;
      elLondonAreaSelect.appendChild(opt);
    });
  }

  // Filter Logic
  function applyFilters() {
    filteredList = restaurants.filter(item => {
      // Search keyword
      if (state.search) {
        const q = state.search.toLowerCase();
        const inName = item.name.toLowerCase().includes(q);
        const inNotes = item.notes && item.notes.toLowerCase().includes(q);
        const inArea = item.area && item.area.toLowerCase().includes(q);
        const inCity = item.city && item.city.toLowerCase().includes(q);
        const inCat = item.categories.some(c => c.toLowerCase().includes(q));
        const inSubtags = item.subtags.some(t => t.toLowerCase().includes(q));
        const inLoc = item.locations.some(l => 
          (l.address && l.address.toLowerCase().includes(q)) || 
          (l.postcode && l.postcode.toLowerCase().includes(q))
        );
        if (!inName && !inNotes && !inArea && !inCity && !inCat && !inSubtags && !inLoc) {
          return false;
        }
      }

      // Rating filter
      if (state.rating !== 'all') {
        if (state.rating === 'closed') {
          if (!item.is_closed) return false;
        } else {
          if (item.rating !== state.rating) return false;
        }
      }

      // City filter
      if (state.city !== 'all') {
        if (state.city === '康沃尔') {
          if (!item.city.includes('康沃尔')) return false;
        } else if (item.city !== state.city) {
          return false;
        }
      }

      // London Area filter
      if (state.city === '伦敦' || state.city === 'all') {
        if (state.area !== 'all') {
          if (item.area !== state.area) return false;
        }
      }

      // Category filter
      if (state.category !== 'all') {
        if (!item.categories.includes(state.category)) return false;
      }

      return true;
    });

    updateStats();
    renderCards();
    updateMapMarkers();
  }

  function updateStats() {
    if (elCount) {
      elCount.textContent = filteredList.length;
    }
    if (elTotalPhotos) {
      const photoCount = filteredList.reduce((acc, cur) => acc + (cur.images ? cur.images.length : 0), 0);
      elTotalPhotos.textContent = photoCount;
    }
  }

  // Render cards in sidebar
  function renderCards() {
    if (!elList) return;
    elList.innerHTML = '';

    if (filteredList.length === 0) {
      elList.innerHTML = `
        <div class="empty-state">
          <div class="empty-icon">🍽️</div>
          <div style="font-weight: 600; margin-bottom: 6px;">没有找到匹配的餐厅</div>
          <div style="font-size: 13px;">请尝试更换搜索词或重置筛选条件</div>
        </div>
      `;
      return;
    }

    const fragment = document.createDocumentFragment();

    filteredList.forEach(item => {
      const card = document.createElement('div');
      card.className = `resto-card ${currentRestaurant && currentRestaurant.id === item.id ? 'active' : ''}`;
      card.id = `card_${item.id}`;

      // Thumbnail
      const hasImage = item.images && item.images.length > 0;
      const thumbSrc = hasImage ? item.images[0].path : 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100" viewBox="0 0 24 24" fill="none" stroke="%2394a3b8" stroke-width="1.5"><path d="M18 8h1a4 4 0 0 1 0 8h-1M2 8h16v9a4 4 0 0 1-4 4H6a4 4 0 0 1-4-4V8zM6 1v3M10 1v3M14 1v3"/></svg>';
      const photoCountBadge = hasImage ? `<div class="resto-photo-count">📸 ${item.images.length}</div>` : '';

      // Rating badge
      let ratingBadge = '';
      if (item.is_closed) {
        ratingBadge = `<span class="badge-rating closed">⚠️ 已关门</span>`;
      } else if (item.rating === 'star') {
        ratingBadge = `<span class="badge-rating star">🌟 强烈推荐</span>`;
      } else if (item.rating === 'thumb_up') {
        ratingBadge = `<span class="badge-rating thumb_up">👍 口碑推荐</span>`;
      } else if (item.rating === 'thumb_down') {
        ratingBadge = `<span class="badge-rating thumb_down">👎 避坑排雷</span>`;
      }

      // Address excerpt
      const firstLoc = item.locations && item.locations.length > 0 ? item.locations[0] : null;
      const postcodeStr = firstLoc && firstLoc.postcode ? `📍 ${firstLoc.postcode}` : (firstLoc ? `📍 ${firstLoc.address.slice(0, 24)}...` : '');

      // Categories and subtags
      const catPill = item.categories.length > 0 ? `<span class="pill-cat">${item.categories[0]}</span>` : '';
      const areaPill = item.area ? `<span class="pill-city">${item.city !== item.area ? item.city + ' · ' + item.area : item.city}</span>` : '';

      card.innerHTML = `
        <div class="resto-thumb-wrap">
          <img class="resto-thumb" src="${thumbSrc}" alt="${escapeHtml(item.name)}" loading="lazy" />
          ${photoCountBadge}
        </div>
        <div class="resto-info">
          <div>
            <div class="resto-title-row">
              <span class="resto-name">${escapeHtml(item.name)}</span>
              ${ratingBadge}
            </div>
            <div class="resto-meta-row">
              ${areaPill}
              ${catPill}
            </div>
            ${item.notes ? `<div class="resto-snippet">${escapeHtml(item.notes)}</div>` : ''}
          </div>
          ${postcodeStr ? `<div class="resto-address-sub">${escapeHtml(postcodeStr)}</div>` : ''}
        </div>
      `;

      card.addEventListener('click', () => {
        selectRestaurant(item, true);
      });

      fragment.appendChild(card);
    });

    elList.appendChild(fragment);
  }

  // Update Map Markers
  function updateMapMarkers() {
    if (!markerCluster) return;

    markerCluster.clearLayers();
    markersMap.clear();

    const bounds = L.latLngBounds();
    let hasCoords = false;

    filteredList.forEach(item => {
      if (!item.locations || item.locations.length === 0) return;

      const itemMarkers = [];

      item.locations.forEach((loc, locIdx) => {
        if (!loc.lat || !loc.lng) return;

        hasCoords = true;
        bounds.extend([loc.lat, loc.lng]);

        // Pin styling & icon
        let pinClass = 'pin-normal';
        let pinIcon = '🍽️';

        if (item.is_closed) {
          pinClass = 'pin-closed';
          pinIcon = '⚠️';
        } else if (item.rating === 'star') {
          pinClass = 'pin-star';
          pinIcon = '🌟';
        } else if (item.rating === 'thumb_up') {
          pinClass = 'pin-thumb_up';
          pinIcon = '👍';
        } else if (item.rating === 'thumb_down') {
          pinClass = 'pin-thumb_down';
          pinIcon = '👎';
        } else if (item.categories.includes('酒吧夜生活')) {
          pinIcon = '🍸';
        } else if (item.categories.includes('甜品饮品')) {
          pinIcon = '🧋';
        }

        const customIcon = L.divIcon({
          className: 'custom-pin-wrap',
          html: `
            <div class="custom-pin ${pinClass}">
              <span class="custom-pin-inner">${pinIcon}</span>
            </div>
          `,
          iconSize: [34, 34],
          iconAnchor: [17, 34],
          popupAnchor: [0, -34]
        });

        const marker = L.marker([loc.lat, loc.lng], { icon: customIcon });

        // Popup content
        const thumbSrc = item.images && item.images.length > 0 ? item.images[0].path : '';
        const popupHtml = `
          <div class="popup-card">
            ${thumbSrc ? `
              <div class="popup-thumb-wrap">
                <img class="popup-thumb" src="${thumbSrc}" alt="${escapeHtml(item.name)}" />
                ${item.images.length > 1 ? `<div class="resto-photo-count">📸 ${item.images.length} 张照片</div>` : ''}
              </div>
            ` : ''}
            <div class="popup-body">
              <div class="popup-header">
                <div class="popup-title">${escapeHtml(item.name)}</div>
              </div>
              <div style="display: flex; gap: 4px; flex-wrap: wrap;">
                <span class="pill-city">${escapeHtml(item.city)} · ${escapeHtml(item.area)}</span>
                ${item.categories.map(c => `<span class="pill-cat">${escapeHtml(c)}</span>`).join('')}
              </div>
              ${item.notes ? `<div class="popup-notes">${escapeHtml(item.notes)}</div>` : ''}
              <div class="popup-footer">
                <button class="popup-btn-detail" onclick="window.foodieApp.openDetail('${item.id}')">查看探店详情 & 实拍图</button>
              </div>
            </div>
          </div>
        `;

        marker.bindPopup(popupHtml, { maxWidth: 300 });

        marker.on('click', () => {
          selectRestaurant(item, false);
        });

        markerCluster.addLayer(marker);
        itemMarkers.push(marker);
      });

      markersMap.set(item.id, itemMarkers);
    });

    // If city selected and bounds valid, fit bounds gently
    if (state.city === 'all' && !state.search && state.rating === 'all' && state.category === 'all') {
      // Default to London view for initial aesthetic focus
      map.setView(CITY_COORDS['伦敦'].center, CITY_COORDS['伦敦'].zoom);
    } else if (hasCoords && filteredList.length > 0) {
      if (filteredList.length === 1) {
        const first = filteredList[0].locations[0];
        if (first && first.lat) {
          map.setView([first.lat, first.lng], 16);
        }
      } else {
        map.fitBounds(bounds, { padding: [50, 50], maxZoom: 15 });
      }
    }
  }

  // Select Restaurant
  function selectRestaurant(item, flyTo = true) {
    currentRestaurant = item;

    // Highlight card in sidebar
    document.querySelectorAll('.resto-card').forEach(c => c.classList.remove('active'));
    const activeCard = document.getElementById(`card_${item.id}`);
    if (activeCard) {
      activeCard.classList.add('active');
      activeCard.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }

    // Fly to location on map
    if (flyTo && item.locations && item.locations.length > 0) {
      const loc = item.locations[0];
      if (loc.lat && loc.lng) {
        map.flyTo([loc.lat, loc.lng], 16, {
          duration: 1.0,
          easeLinearity: 0.25
        });

        // Open popup
        const markers = markersMap.get(item.id);
        if (markers && markers.length > 0) {
          setTimeout(() => {
            markers[0].openPopup();
          }, 800);
        }
      }
    }

    // Open detail drawer
    openDetailDrawer(item);
  }

  // Detail Drawer
  function openDetailDrawer(item) {
    if (!elDetailDrawer || !elDrawerContent) return;

    currentRestaurant = item;
    activePhotos = item.images || [];
    currentPhotoIndex = 0;

    let ratingBadge = '';
    if (item.is_closed) {
      ratingBadge = `<span class="badge-rating closed" style="font-size: 13px; padding: 4px 10px;">⚠️ 该店已停业/闭店</span>`;
    } else if (item.rating === 'star') {
      ratingBadge = `<span class="badge-rating star" style="font-size: 13px; padding: 4px 10px;">🌟 强烈推荐 · 神店必吃</span>`;
    } else if (item.rating === 'thumb_up') {
      ratingBadge = `<span class="badge-rating thumb_up" style="font-size: 13px; padding: 4px 10px;">👍 值得一试 · 口碑好店</span>`;
    } else if (item.rating === 'thumb_down') {
      ratingBadge = `<span class="badge-rating thumb_down" style="font-size: 13px; padding: 4px 10px;">👎 避坑排雷 · 不建议尝试</span>`;
    }

    // Photo Gallery HTML
    let galleryHtml = '';
    if (activePhotos.length > 0) {
      const mainPhoto = activePhotos[0];
      galleryHtml = `
        <div class="gallery-section">
          <div class="gallery-main-wrap" id="galleryMainWrap" onclick="window.foodieApp.openLightbox(0)">
            <img class="gallery-main-img" id="galleryMainImg" src="${mainPhoto.path}" alt="${escapeHtml(mainPhoto.alt)}" />
            <div class="gallery-zoom-hint">🔍 点击放大实拍图 (${activePhotos.length} 张)</div>
          </div>
          ${activePhotos.length > 1 ? `
            <div class="gallery-thumbs">
              ${activePhotos.map((p, idx) => `
                <div class="gallery-thumb ${idx === 0 ? 'active' : ''}" onclick="window.foodieApp.switchMainPhoto(${idx})">
                  <img src="${p.path}" alt="${escapeHtml(p.alt)}" />
                </div>
              `).join('')}
            </div>
          ` : ''}
        </div>
      `;
    }

    // Locations HTML
    let locationsHtml = '';
    if (item.locations && item.locations.length > 0) {
      locationsHtml = `
        <div class="drawer-loc-card">
          <div class="review-label">📍 餐厅地址与一键导航</div>
          ${item.locations.map((loc, idx) => {
            const googleMapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(loc.address || item.name + ' ' + (loc.postcode || ''))}`;
            const appleMapsUrl = `https://maps.apple.com/?q=${encodeURIComponent(loc.address || item.name)}`;
            return `
              <div class="loc-item">
                <div class="loc-address">
                  <span>📌</span>
                  <div>
                    <strong>${escapeHtml(loc.address)}</strong>
                    ${loc.postcode ? `<div style="color: var(--text-muted); font-size: 12px; margin-top: 2px;">邮编: ${escapeHtml(loc.postcode)}</div>` : ''}
                  </div>
                </div>
                <div class="loc-actions">
                  <button class="btn" onclick="window.foodieApp.copyText('${escapeHtml(loc.address)}')">📋 复制地址</button>
                  <a class="btn" href="${googleMapsUrl}" target="_blank" rel="noopener">🗺️ Google 地图导航</a>
                  <a class="btn" href="${appleMapsUrl}" target="_blank" rel="noopener">🍎 Apple 地图导航</a>
                </div>
              </div>
            `;
          }).join('')}
        </div>
      `;
    }

    elDrawerContent.innerHTML = `
      ${galleryHtml}

      <div class="drawer-title-block">
        <h2 class="drawer-title">${escapeHtml(item.name)}</h2>
        <div class="drawer-badges">
          ${ratingBadge}
          <span class="pill-city">${escapeHtml(item.city)} · ${escapeHtml(item.area)}</span>
          ${item.categories.map(c => `<span class="pill-cat">${escapeHtml(c)}</span>`).join('')}
          ${item.subtags.map(t => `<span class="pill-cat" style="background:#eff6ff; color:#1d4ed8; border-color:#bfdbfe;">#${escapeHtml(t)}</span>`).join('')}
        </div>
      </div>

      ${item.notes ? `
        <div class="drawer-review-card">
          <div class="review-label">📝 探店笔记 & 点单攻略</div>
          <div class="review-text">${escapeHtml(item.notes)}</div>
        </div>
      ` : ''}

      ${locationsHtml}
    `;

    elDetailDrawer.classList.add('open');
  }

  function closeDetailDrawer() {
    if (elDetailDrawer) {
      elDetailDrawer.classList.remove('open');
    }
  }

  // Gallery Switching
  function switchMainPhoto(index) {
    currentPhotoIndex = index;
    const mainImg = document.getElementById('galleryMainImg');
    if (mainImg && activePhotos[index]) {
      mainImg.src = activePhotos[index].path;
      mainImg.alt = escapeHtml(activePhotos[index].alt);
    }

    document.querySelectorAll('.gallery-thumb').forEach((t, i) => {
      t.classList.toggle('active', i === index);
    });
  }

  // Lightbox Modal
  function openLightbox(index = 0) {
    if (!activePhotos || activePhotos.length === 0) return;
    currentPhotoIndex = index;
    updateLightbox();
    if (elLightbox) {
      elLightbox.classList.add('active');
    }
  }

  function closeLightbox() {
    if (elLightbox) {
      elLightbox.classList.remove('active');
    }
  }

  function nextPhoto() {
    if (activePhotos.length <= 1) return;
    currentPhotoIndex = (currentPhotoIndex + 1) % activePhotos.length;
    updateLightbox();
  }

  function prevPhoto() {
    if (activePhotos.length <= 1) return;
    currentPhotoIndex = (currentPhotoIndex - 1 + activePhotos.length) % activePhotos.length;
    updateLightbox();
  }

  function updateLightbox() {
    const photo = activePhotos[currentPhotoIndex];
    if (photo && elLightboxImg) {
      elLightboxImg.src = photo.path;
      if (elLightboxCaption) {
        elLightboxCaption.textContent = `${currentRestaurant ? currentRestaurant.name : ''} (${currentPhotoIndex + 1} / ${activePhotos.length})`;
      }
    }
  }

  // Lucky Restaurant Picker ("今天吃什么？")
  function pickLuckyRestaurant() {
    // Pick from star or thumb_up or currently filtered list
    let candidates = filteredList.filter(r => !r.is_closed && (r.rating === 'star' || r.rating === 'thumb_up'));
    if (candidates.length === 0) {
      candidates = filteredList.filter(r => !r.is_closed);
    }
    if (candidates.length === 0) {
      showToast('当前筛选条件下没有可推荐的餐厅');
      return;
    }

    const lucky = candidates[Math.floor(Math.random() * candidates.length)];
    
    if (elLuckyCard) {
      const hasImg = lucky.images && lucky.images.length > 0;
      elLuckyCard.innerHTML = `
        <div class="lucky-icon">🎉</div>
        <div class="lucky-title">今天就吃它啦！</div>
        <div style="font-size: 18px; font-weight: 700; color: var(--primary);">${escapeHtml(lucky.name)}</div>
        <div style="display: flex; justify-content: center; gap: 6px; margin-top: 4px;">
          <span class="pill-city">${escapeHtml(lucky.city)} · ${escapeHtml(lucky.area)}</span>
          <span class="pill-cat">${escapeHtml(lucky.categories.join(' / '))}</span>
        </div>
        ${hasImg ? `
          <div style="width: 100%; height: 160px; border-radius: 12px; overflow: hidden; margin-top: 10px;">
            <img src="${lucky.images[0].path}" style="width: 100%; height: 100%; object-fit: cover;" />
          </div>
        ` : ''}
        ${lucky.notes ? `<div style="font-size: 13px; color: var(--text-muted); margin-top: 8px;">"${escapeHtml(lucky.notes.slice(0, 80))}..."</div>` : ''}
        <div style="display: flex; gap: 10px; margin-top: 16px;">
          <button class="btn btn-primary" style="flex: 1;" onclick="window.foodieApp.acceptLucky('${lucky.id}')">立刻导航定位</button>
          <button class="btn" style="flex: 1;" onclick="window.foodieApp.pickLucky()">再抽一次 🎲</button>
        </div>
      `;
    }

    if (elLuckyModal) {
      elLuckyModal.classList.add('active');
    }
  }

  function acceptLucky(id) {
    if (elLuckyModal) elLuckyModal.classList.remove('active');
    const target = restaurants.find(r => r.id === id);
    if (target) {
      selectRestaurant(target, true);
    }
  }

  // Toast
  function showToast(msg) {
    if (!elToast) return;
    elToast.textContent = msg;
    elToast.classList.add('show');
    setTimeout(() => {
      elToast.classList.remove('show');
    }, 2200);
  }

  function copyText(text) {
    if (navigator.clipboard) {
      navigator.clipboard.writeText(text).then(() => {
        showToast('✅ 已复制到剪贴板！');
      }).catch(() => {
        showToast('地址已选中，请按 Ctrl+C 复制');
      });
    } else {
      showToast('地址: ' + text);
    }
  }

  // Event Listeners
  function setupEventListeners() {
    // Search input with debounce
    let debounceTimer = null;
    if (elSearch) {
      elSearch.addEventListener('input', (e) => {
        clearTimeout(debounceTimer);
        const val = e.target.value.trim();
        if (elSearchClear) {
          elSearchClear.classList.toggle('visible', val.length > 0);
        }
        debounceTimer = setTimeout(() => {
          state.search = val;
          applyFilters();
        }, 200);
      });
    }

    if (elSearchClear) {
      elSearchClear.addEventListener('click', () => {
        elSearch.value = '';
        elSearchClear.classList.remove('visible');
        state.search = '';
        applyFilters();
      });
    }

    // Rating Chips
    if (elRatingChips) {
      elRatingChips.querySelectorAll('.chip').forEach(chip => {
        chip.addEventListener('click', () => {
          elRatingChips.querySelectorAll('.chip').forEach(c => c.classList.remove('active'));
          chip.classList.add('active');
          state.rating = chip.dataset.rating;
          applyFilters();
        });
      });
    }

    // City Chips
    if (elCityChips) {
      elCityChips.querySelectorAll('.chip').forEach(chip => {
        chip.addEventListener('click', () => {
          elCityChips.querySelectorAll('.chip').forEach(c => c.classList.remove('active'));
          chip.classList.add('active');
          state.city = chip.dataset.city;

          // Toggle London area select visibility
          if (elLondonAreaWrap) {
            elLondonAreaWrap.style.display = (state.city === '伦敦' || state.city === 'all') ? 'flex' : 'none';
          }

          // Fly map to city
          if (CITY_COORDS[state.city]) {
            map.flyTo(CITY_COORDS[state.city].center, CITY_COORDS[state.city].zoom);
          }

          applyFilters();
        });
      });
    }

    // London Area Select
    if (elLondonAreaSelect) {
      elLondonAreaSelect.addEventListener('change', (e) => {
        state.area = e.target.value;
        if (state.area !== 'all' && CITY_COORDS[state.area]) {
          map.flyTo(CITY_COORDS[state.area].center, CITY_COORDS[state.area].zoom);
        }
        applyFilters();
      });
    }

    // Category Chips
    if (elCategoryChips) {
      elCategoryChips.querySelectorAll('.chip').forEach(chip => {
        chip.addEventListener('click', () => {
          elCategoryChips.querySelectorAll('.chip').forEach(c => c.classList.remove('active'));
          chip.classList.add('active');
          state.category = chip.dataset.category;
          applyFilters();
        });
      });
    }

    // Drawer close
    if (elDrawerClose) {
      elDrawerClose.addEventListener('click', closeDetailDrawer);
    }

    // Theme toggle
    if (elThemeToggle) {
      elThemeToggle.addEventListener('click', toggleTheme);
    }

    // Lucky button
    if (elLuckyBtn) {
      elLuckyBtn.addEventListener('click', pickLuckyRestaurant);
    }

    if (elLuckyClose && elLuckyModal) {
      elLuckyClose.addEventListener('click', () => elLuckyModal.classList.remove('active'));
      elLuckyModal.addEventListener('click', (e) => {
        if (e.target === elLuckyModal) elLuckyModal.classList.remove('active');
      });
    }

    // Lightbox modal controls
    if (elLightbox) {
      const btnClose = document.getElementById('lightboxClose');
      const btnPrev = document.getElementById('lightboxPrev');
      const btnNext = document.getElementById('lightboxNext');

      if (btnClose) btnClose.addEventListener('click', closeLightbox);
      if (btnPrev) btnPrev.addEventListener('click', prevPhoto);
      if (btnNext) btnNext.addEventListener('click', nextPhoto);

      elLightbox.addEventListener('click', (e) => {
        if (e.target === elLightbox) closeLightbox();
      });
    }

    // Keyboard navigation
    document.addEventListener('keydown', (e) => {
      if (elLightbox && elLightbox.classList.contains('active')) {
        if (e.key === 'Escape') closeLightbox();
        if (e.key === 'ArrowRight') nextPhoto();
        if (e.key === 'ArrowLeft') prevPhoto();
      } else if (elDetailDrawer && elDetailDrawer.classList.contains('open')) {
        if (e.key === 'Escape') closeDetailDrawer();
      }
    });

    // Map Quick City Buttons
    document.querySelectorAll('.btn-city-jump').forEach(btn => {
      btn.addEventListener('click', () => {
        const targetCity = btn.dataset.city;
        if (CITY_COORDS[targetCity]) {
          map.flyTo(CITY_COORDS[targetCity].center, CITY_COORDS[targetCity].zoom);
        }
      });
    });

    // Map Locate Me button
    const btnLocate = document.getElementById('btnLocateMe');
    if (btnLocate) {
      btnLocate.addEventListener('click', () => {
        if ('geolocation' in navigator) {
          navigator.geolocation.getCurrentPosition(pos => {
            const lat = pos.coords.latitude;
            const lng = pos.coords.longitude;
            map.flyTo([lat, lng], 15);
            L.circleMarker([lat, lng], {
              radius: 8,
              color: '#ffffff',
              weight: 3,
              fillColor: '#3b82f6',
              fillOpacity: 1
            }).addTo(map).bindPopup('📍 您当前所在位置').openPopup();
          }, () => {
            showToast('无法获取当前 GPS 定位');
          });
        } else {
          showToast('浏览器不支持定位');
        }
      });
    }

    // Map Reset View
    const btnReset = document.getElementById('btnResetMap');
    if (btnReset) {
      btnReset.addEventListener('click', () => {
        map.flyTo(CITY_COORDS['伦敦'].center, CITY_COORDS['伦敦'].zoom);
      });
    }
  }

  // Helper
  function escapeHtml(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  // Expose global methods
  window.foodieApp = {
    openDetail: function (id) {
      const item = restaurants.find(r => r.id === id);
      if (item) selectRestaurant(item, false);
    },
    switchMainPhoto: switchMainPhoto,
    openLightbox: openLightbox,
    copyText: copyText,
    pickLucky: pickLuckyRestaurant,
    acceptLucky: acceptLucky
  };

  // Start app
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();

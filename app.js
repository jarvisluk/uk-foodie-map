/**
 * UK Foodie Interactive Map — App Logic (v2, floating panels)
 */
(function () {
  'use strict';

  /* ── State ── */
  let restaurants = [];
  let filteredList = [];
  let currentRestaurant = null;
  let activePhotos = [];
  let currentPhotoIndex = 0;

  const state = {
    search: '',
    rating: 'all',
    city: 'all',
    area: 'all',
    category: 'all',
    theme: localStorage.getItem('foodie_theme') || 'light',
    leftOpen: true,
    rightOpen: false
  };

  const CITY_COORDS = {
    'all':          { center: [54.0, -2.5],       zoom: 6  },
    '伦敦':          { center: [51.5074, -0.1278],  zoom: 12 },
    '市中心/Soho':   { center: [51.5134, -0.1315],  zoom: 15 },
    'Battersea':    { center: [51.4740, -0.1680],   zoom: 14 },
    'Kensington':   { center: [51.4988, -0.1749],   zoom: 14 },
    'White City':   { center: [51.5085, -0.2230],   zoom: 14 },
    '爱丁堡':        { center: [55.9533, -3.1883],   zoom: 13 },
    '格拉斯哥':      { center: [55.8642, -4.2518],   zoom: 13 },
    '曼彻斯特':      { center: [53.4808, -2.2426],   zoom: 13 },
    '伯明翰':        { center: [52.4862, -1.8904],   zoom: 13 },
    '剑桥':          { center: [52.2053, 0.1218],    zoom: 14 },
    '牛津':          { center: [51.7520, -1.2577],   zoom: 14 },
    '康沃尔彭赞斯':   { center: [50.1500, -5.5000],  zoom: 11 }
  };

  /* ── Map variables ── */
  let map, markerCluster, currentTileLayer;
  const tileLayers = {};
  const markersMap = new Map();

  /* ── DOM refs ── */
  const $ = id => document.getElementById(id);

  /* ── Init ── */
  async function init() {
    applyTheme();
    initMap();
    await loadData();
    setupPanels();
    setupFilters();
    setupMapControls();
    setupLightbox();
    setupLuckyModal();
    setupKeyboard();
    applyFilters();
  }

  /* ── Theme ── */
  function applyTheme() {
    document.documentElement.setAttribute('data-theme', state.theme);
    const btn = $('btnThemeToggle');
    if (btn) btn.textContent = state.theme === 'dark' ? '☀️' : '🌙';
  }

  function toggleTheme() {
    state.theme = state.theme === 'dark' ? 'light' : 'dark';
    localStorage.setItem('foodie_theme', state.theme);
    applyTheme();
    // Switch map tile
    map.removeLayer(currentTileLayer);
    currentTileLayer = state.theme === 'dark' ? tileLayers.cartoDark : tileLayers.osm;
    map.addLayer(currentTileLayer);
  }

  /* ── Map ── */
  function initMap() {
    tileLayers.osm = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      maxZoom: 19
    });
    tileLayers.osmHot = L.tileLayer('https://{s}.tile.openstreetmap.fr/hot/{z}/{x}/{y}.png', {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      maxZoom: 19
    });
    tileLayers.cartoLight = L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
      attribution: '&copy; OpenStreetMap &copy; CARTO', subdomains: 'abcd', maxZoom: 19
    });
    tileLayers.cartoDark = L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
      attribution: '&copy; OpenStreetMap &copy; CARTO', subdomains: 'abcd', maxZoom: 19
    });

    currentTileLayer = state.theme === 'dark' ? tileLayers.cartoDark : tileLayers.osm;

    map = L.map('map', {
      center: CITY_COORDS['伦敦'].center,
      zoom: CITY_COORDS['伦敦'].zoom,
      zoomControl: false,
      layers: [currentTileLayer]
    });

    L.control.zoom({ position: 'bottomright' }).addTo(map);
    L.control.layers({
      '🗺️ OpenStreetMap': tileLayers.osm,
      '🎨 OSM 详细': tileLayers.osmHot,
      '☀️ 极简浅色': tileLayers.cartoLight,
      '🌙 极简深色': tileLayers.cartoDark
    }, null, { position: 'bottomleft' }).addTo(map);

    markerCluster = L.markerClusterGroup({
      showCoverageOnHover: false,
      maxClusterRadius: 40,
      iconCreateFunction(cluster) {
        return L.divIcon({
          html: `<div class="marker-cluster-custom-inner">${cluster.getChildCount()}</div>`,
          className: 'marker-cluster-custom',
          iconSize: [38, 38]
        });
      }
    });
    map.addLayer(markerCluster);
  }

  /* ── Load Data ── */
  async function loadData() {
    if (window.RESTAURANTS_DATA && Array.isArray(window.RESTAURANTS_DATA)) {
      restaurants = window.RESTAURANTS_DATA;
    } else {
      try {
        restaurants = await fetch('data/restaurants.json').then(r => r.json());
      } catch (e) { console.error(e); }
    }
    populateLondonAreas();
  }

  function populateLondonAreas() {
    const sel = $('londonAreaSelect');
    if (!sel) return;
    const areas = new Set();
    restaurants.forEach(r => {
      if (r.city === '伦敦' && r.area && !r.area.startsWith('🔗') && !r.area.startsWith('🥤') && !r.area.startsWith('🍸')) {
        areas.add(r.area);
      }
    });
    [...areas].sort().forEach(a => {
      const o = document.createElement('option');
      o.value = a; o.textContent = a;
      sel.appendChild(o);
    });
  }

  /* ── Panel toggle ── */
  function setupPanels() {
    // Left panel toggle
    $('toggleLeft').addEventListener('click', () => {
      state.leftOpen = !state.leftOpen;
      $('leftPanel').classList.toggle('collapsed', !state.leftOpen);
      document.body.classList.toggle('left-collapsed', !state.leftOpen);
      $('toggleLeftIcon').textContent = state.leftOpen ? '◀' : '▶';
    });

    // Right panel toggle (close)
    $('toggleRight').addEventListener('click', () => {
      closeRightPanel();
    });

    // Start: right collapsed, left open
    document.body.classList.add('right-collapsed');
    document.body.classList.remove('left-collapsed');
  }

  function openRightPanel(item) {
    state.rightOpen = true;
    $('rightPanel').classList.remove('collapsed');
    document.body.classList.remove('right-collapsed');
    renderDrawer(item);
  }

  function closeRightPanel() {
    state.rightOpen = false;
    $('rightPanel').classList.add('collapsed');
    document.body.classList.add('right-collapsed');
    $('drawerContent').innerHTML = `
      <div class="drawer-placeholder">
        <div style="font-size:48px">🗺️</div>
        <div style="font-weight:600;margin-top:12px">点击地图图钉</div>
        <div style="font-size:13px;color:var(--text-muted);margin-top:6px">或左侧餐厅卡片<br>查看探店详情</div>
      </div>`;
    currentRestaurant = null;
    document.querySelectorAll('.resto-card').forEach(c => c.classList.remove('active'));
  }

  /* ── Filters ── */
  function setupFilters() {
    // Search
    let debounce;
    $('searchInput').addEventListener('input', e => {
      clearTimeout(debounce);
      const v = e.target.value.trim();
      $('searchClear').classList.toggle('visible', v.length > 0);
      debounce = setTimeout(() => { state.search = v; applyFilters(); }, 200);
    });
    $('searchClear').addEventListener('click', () => {
      $('searchInput').value = '';
      $('searchClear').classList.remove('visible');
      state.search = '';
      applyFilters();
    });

    // Rating chips
    $('ratingChips').addEventListener('click', e => {
      const chip = e.target.closest('.chip');
      if (!chip) return;
      $('ratingChips').querySelectorAll('.chip').forEach(c => c.classList.remove('active'));
      chip.classList.add('active');
      state.rating = chip.dataset.rating;
      applyFilters();
    });

    // City chips
    $('cityChips').addEventListener('click', e => {
      const chip = e.target.closest('.chip');
      if (!chip) return;
      $('cityChips').querySelectorAll('.chip').forEach(c => c.classList.remove('active'));
      chip.classList.add('active');
      state.city = chip.dataset.city;
      $('londonAreaWrap').style.display = (state.city === '伦敦' || state.city === 'all') ? '' : 'none';
      const coords = CITY_COORDS[state.city] || CITY_COORDS['all'];
      map.flyTo(coords.center, coords.zoom, { duration: 1.0 });
      applyFilters();
    });

    // London area
    $('londonAreaSelect').addEventListener('change', e => {
      state.area = e.target.value;
      const coords = CITY_COORDS[state.area];
      if (coords) map.flyTo(coords.center, coords.zoom, { duration: 0.8 });
      applyFilters();
    });

    // Category chips
    $('categoryChips').addEventListener('click', e => {
      const chip = e.target.closest('.chip');
      if (!chip) return;
      $('categoryChips').querySelectorAll('.chip').forEach(c => c.classList.remove('active'));
      chip.classList.add('active');
      state.category = chip.dataset.category;
      applyFilters();
    });
  }

  function applyFilters() {
    filteredList = restaurants.filter(r => {
      if (state.search) {
        const q = state.search.toLowerCase();
        const hit = [r.name, r.notes, r.area, r.city, ...r.categories, ...r.subtags,
          ...(r.locations || []).map(l => l.address + ' ' + (l.postcode || ''))
        ].join(' ').toLowerCase();
        if (!hit.includes(q)) return false;
      }
      if (state.rating !== 'all') {
        if (state.rating === 'closed') { if (!r.is_closed) return false; }
        else if (r.rating !== state.rating) return false;
      }
      if (state.city !== 'all') {
        const cityMatch = state.city === '康沃尔' ? r.city.includes('康沃尔') : r.city === state.city;
        if (!cityMatch) return false;
      }
      if (state.area !== 'all' && r.area !== state.area) return false;
      if (state.category !== 'all' && !r.categories.includes(state.category)) return false;
      return true;
    });

    // Stats
    const photoCount = filteredList.reduce((a, r) => a + (r.images || []).length, 0);
    $('visibleCount').textContent = filteredList.length;
    $('totalPhotosCount').textContent = photoCount;

    renderCards();
    updateMarkers();
  }

  /* ── Cards ── */
  function renderCards() {
    const el = $('restoList');
    if (!el) return;
    el.innerHTML = '';

    if (!filteredList.length) {
      el.innerHTML = '<div class="empty-state">😢 没有符合条件的餐厅<br>试试更换筛选条件</div>';
      return;
    }

    const frag = document.createDocumentFragment();
    filteredList.forEach(item => {
      const card = document.createElement('div');
      card.className = `resto-card${currentRestaurant?.id === item.id ? ' active' : ''}`;
      card.id = `card_${item.id}`;

      const hasImg = item.images?.length > 0;
      const thumb = hasImg ? item.images[0].path : '';
      const ratingBadge = buildRatingBadge(item);
      const firstLoc = item.locations?.[0];
      const addrStr = firstLoc?.postcode ? `📍 ${firstLoc.postcode}` : (firstLoc ? `📍 ${firstLoc.address.slice(0, 22)}…` : '');

      card.innerHTML = `
        <div class="card-thumb">
          ${thumb ? `<img src="${thumb}" alt="${h(item.name)}" loading="lazy" />` : ''}
          ${item.images?.length > 1 ? `<div class="card-photo-count">📸${item.images.length}</div>` : ''}
        </div>
        <div class="card-body">
          <div>
            <div class="card-title-row">
              <span class="card-name">${h(item.name)}</span>
              ${ratingBadge}
            </div>
            <div class="card-meta">
              <span class="pill">${h(item.city)}${item.area !== item.city ? ' · ' + h(item.area) : ''}</span>
              ${item.categories.slice(0,1).map(c => `<span class="pill pill-cat">${h(c)}</span>`).join('')}
            </div>
            ${item.notes ? `<div class="card-snippet">${h(item.notes)}</div>` : ''}
          </div>
          ${addrStr ? `<div class="card-address">${h(addrStr)}</div>` : ''}
        </div>
      `;

      card.addEventListener('click', () => selectRestaurant(item, true));
      frag.appendChild(card);
    });
    el.appendChild(frag);
  }

  function buildRatingBadge(item) {
    if (item.is_closed) return `<span class="badge badge-closed">⚠️关</span>`;
    if (item.rating === 'star')      return `<span class="badge badge-star">🌟</span>`;
    if (item.rating === 'thumb_up')  return `<span class="badge badge-up">👍</span>`;
    if (item.rating === 'thumb_down') return `<span class="badge badge-down">👎</span>`;
    return '';
  }

  /* ── Markers ── */
  function updateMarkers() {
    markerCluster.clearLayers();
    markersMap.clear();

    const bounds = L.latLngBounds();
    let hasCoords = false;

    filteredList.forEach(item => {
      const locs = (item.locations || []).filter(l => l.lat && l.lng);
      if (!locs.length) return;

      const pinClass = item.is_closed ? 'pin-closed'
        : item.rating === 'star' ? 'pin-star'
        : item.rating === 'thumb_up' ? 'pin-thumb_up'
        : item.rating === 'thumb_down' ? 'pin-thumb_down'
        : 'pin-normal';
      const pinIcon = item.is_closed ? '⚠️'
        : item.rating === 'star' ? '🌟'
        : item.rating === 'thumb_up' ? '👍'
        : item.rating === 'thumb_down' ? '👎'
        : item.categories.includes('酒吧夜生活') ? '🍸'
        : item.categories.includes('甜品饮品') ? '🧋'
        : '🍽️';

      const icon = L.divIcon({
        className: '',
        html: `<div class="custom-pin ${pinClass}"><span class="custom-pin-inner">${pinIcon}</span></div>`,
        iconSize: [32, 32],
        iconAnchor: [16, 32],
        popupAnchor: [0, -32]
      });

      const itemMarkers = locs.map((loc, i) => {
        hasCoords = true;
        bounds.extend([loc.lat, loc.lng]);

        const thumb = item.images?.[0]?.path || '';
        const popup = `
          <div>
            ${thumb ? `<img class="popup-img" src="${thumb}" alt="${h(item.name)}" />` : ''}
            <div class="popup-body">
              <div class="popup-title">${h(item.name)}</div>
              <div class="popup-sub">${h(item.city)} · ${h(item.area)}${item.images?.length > 1 ? ` · 📸${item.images.length}张` : ''}</div>
              <button class="popup-btn" onclick="window._foodie.openDetail('${item.id}')">查看探店详情</button>
            </div>
          </div>`;

        const m = L.marker([loc.lat, loc.lng], { icon });
        m.bindPopup(popup, { maxWidth: 270 });
        m.on('click', () => selectRestaurant(item, false));
        markerCluster.addLayer(m);
        return m;
      });

      markersMap.set(item.id, itemMarkers);
    });

    // Fit bounds only when filtered / searched
    const isDefaultView = state.search === '' && state.rating === 'all' && state.category === 'all' && state.city === 'all';
    if (!isDefaultView && hasCoords) {
      if (filteredList.length === 1) {
        const l = filteredList[0].locations?.[0];
        if (l?.lat) map.setView([l.lat, l.lng], 16);
      } else {
        map.fitBounds(bounds, { padding: [50, 50], maxZoom: 15 });
      }
    }
  }

  /* ── Select / Drawer ── */
  function selectRestaurant(item, flyTo) {
    currentRestaurant = item;
    document.querySelectorAll('.resto-card').forEach(c => c.classList.remove('active'));
    const card = $(`card_${item.id}`);
    if (card) { card.classList.add('active'); card.scrollIntoView({ behavior: 'smooth', block: 'nearest' }); }

    if (flyTo && item.locations?.[0]?.lat) {
      map.flyTo([item.locations[0].lat, item.locations[0].lng], 16, { duration: 0.9 });
      setTimeout(() => markersMap.get(item.id)?.[0]?.openPopup(), 700);
    }
    activePhotos = item.images || [];
    currentPhotoIndex = 0;
    openRightPanel(item);
  }

  function renderDrawer(item) {
    const el = $('drawerContent');
    if (!el) return;

    const ratingLabel = item.is_closed ? '<span class="badge badge-closed">⚠️ 已关门</span>'
      : item.rating === 'star' ? '<span class="badge badge-star">🌟 强烈推荐</span>'
      : item.rating === 'thumb_up' ? '<span class="badge badge-up">👍 口碑好店</span>'
      : item.rating === 'thumb_down' ? '<span class="badge badge-down">👎 避坑排雷</span>'
      : '';

    const galleryHtml = activePhotos.length > 0 ? `
      <div class="gallery-main" onclick="window._foodie.openLightbox(0)">
        <img id="galleryMainImg" src="${activePhotos[0].path}" alt="${h(item.name)}" />
        <div class="gallery-hint">🔍 放大 (${activePhotos.length} 张)</div>
      </div>
      ${activePhotos.length > 1 ? `
        <div class="gallery-thumbs">
          ${activePhotos.map((p,i) => `
            <div class="gallery-thumb${i===0?' active':''}" onclick="window._foodie.switchPhoto(${i})">
              <img src="${p.path}" alt="${h(p.alt||item.name)}" />
            </div>`).join('')}
        </div>` : ''}
    ` : '';

    const locsHtml = (item.locations || []).map((loc, i) => `
      ${i > 0 ? '<hr class="loc-divider" />' : ''}
      <div class="loc-address">
        <span>📌</span>
        <div>
          <div>${h(loc.address)}</div>
          ${loc.postcode ? `<div style="font-size:11px;color:var(--text-muted)">邮编: ${h(loc.postcode)}</div>` : ''}
        </div>
      </div>
      <div class="loc-actions">
        <button class="btn-sm" onclick="window._foodie.copy('${h(loc.address)}')">📋 复制</button>
        <a class="btn-sm" href="https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(loc.address)}" target="_blank" rel="noopener">🗺️ Google</a>
        <a class="btn-sm" href="https://maps.apple.com/?q=${encodeURIComponent(loc.address)}" target="_blank" rel="noopener">🍎 Apple</a>
      </div>
    `).join('');

    el.innerHTML = `
      ${galleryHtml}
      <div class="drawer-body">
        <div>
          <div class="drawer-title">${h(item.name)}</div>
          <div class="drawer-badges">
            ${ratingLabel}
            <span class="pill">${h(item.city)} · ${h(item.area)}</span>
            ${item.categories.map(c => `<span class="pill pill-cat">${h(c)}</span>`).join('')}
            ${item.subtags.slice(0,3).map(t => `<span class="pill" style="background:#eff6ff;color:#2563eb;border:1px solid #bfdbfe">#${h(t)}</span>`).join('')}
          </div>
        </div>
        ${item.notes ? `
          <div class="section-card">
            <div class="section-label">📝 探店笔记</div>
            <div class="section-text">${h(item.notes)}</div>
          </div>` : ''}
        ${item.locations?.length ? `
          <div class="section-card">
            <div class="section-label">📍 地址与导航</div>
            ${locsHtml}
          </div>` : ''}
      </div>`;
  }

  /* ── Gallery / Lightbox ── */
  function switchPhoto(idx) {
    currentPhotoIndex = idx;
    const img = $('galleryMainImg');
    if (img && activePhotos[idx]) img.src = activePhotos[idx].path;
    document.querySelectorAll('.gallery-thumb').forEach((t, i) => t.classList.toggle('active', i === idx));
  }

  function openLightbox(idx = 0) {
    currentPhotoIndex = idx;
    updateLightbox();
    $('lightboxModal').classList.add('active');
  }
  function closeLightbox() { $('lightboxModal').classList.remove('active'); }
  function prevPhoto() { currentPhotoIndex = (currentPhotoIndex - 1 + activePhotos.length) % activePhotos.length; updateLightbox(); }
  function nextPhoto() { currentPhotoIndex = (currentPhotoIndex + 1) % activePhotos.length; updateLightbox(); }
  function updateLightbox() {
    const p = activePhotos[currentPhotoIndex];
    if (!p) return;
    $('lightboxImg').src = p.path;
    $('lightboxCaption').textContent = `${currentRestaurant?.name || ''} (${currentPhotoIndex + 1} / ${activePhotos.length})`;
  }

  function setupLightbox() {
    $('lightboxClose').addEventListener('click', closeLightbox);
    $('lightboxPrev').addEventListener('click', prevPhoto);
    $('lightboxNext').addEventListener('click', nextPhoto);
    $('lightboxModal').addEventListener('click', e => { if (e.target === $('lightboxModal')) closeLightbox(); });
  }

  /* ── Lucky modal ── */
  function setupLuckyModal() {
    $('btnLucky').addEventListener('click', pickLucky);
  }

  function pickLucky() {
    let pool = filteredList.filter(r => !r.is_closed && (r.rating === 'star' || r.rating === 'thumb_up'));
    if (!pool.length) pool = filteredList.filter(r => !r.is_closed);
    if (!pool.length) { showToast('当前没有可推荐的餐厅'); return; }
    const lucky = pool[Math.floor(Math.random() * pool.length)];
    const img = lucky.images?.[0]?.path || '';
    $('luckyCard').innerHTML = `
      <div style="font-size:44px">🎉</div>
      <div style="font-size:16px;font-weight:700;color:var(--text-main)">今天就吃它！</div>
      <div style="font-size:18px;font-weight:700;color:var(--primary)">${h(lucky.name)}</div>
      <div style="display:flex;justify-content:center;gap:6px;flex-wrap:wrap">
        <span class="pill">${h(lucky.city)} · ${h(lucky.area)}</span>
        ${lucky.categories.map(c=>`<span class="pill pill-cat">${h(c)}</span>`).join('')}
      </div>
      ${img ? `<div style="width:100%;height:150px;border-radius:10px;overflow:hidden"><img src="${img}" style="width:100%;height:100%;object-fit:cover" /></div>` : ''}
      ${lucky.notes ? `<div style="font-size:12px;color:var(--text-muted)">"${h(lucky.notes.slice(0,80))}…"</div>` : ''}
      <div style="display:flex;gap:10px;margin-top:8px">
        <button class="btn-sm btn-sm-primary" style="flex:1" onclick="window._foodie.acceptLucky('${lucky.id}')">定位导航</button>
        <button class="btn-sm" style="flex:1" onclick="window._foodie.pickLucky()">再抽一次 🎲</button>
        <button class="btn-sm" onclick="document.getElementById('luckyModal').classList.remove('active')">✕</button>
      </div>`;
    $('luckyModal').classList.add('active');
    $('luckyModal').onclick = e => { if (e.target === $('luckyModal')) $('luckyModal').classList.remove('active'); };
  }

  function acceptLucky(id) {
    $('luckyModal').classList.remove('active');
    const r = restaurants.find(x => x.id === id);
    if (r) selectRestaurant(r, true);
  }

  /* ── Map controls ── */
  function setupMapControls() {
    $('btnThemeToggle').addEventListener('click', toggleTheme);
    $('btnResetMap').addEventListener('click', () => map.flyTo(CITY_COORDS['伦敦'].center, CITY_COORDS['伦敦'].zoom));
    $('btnLocateMe').addEventListener('click', () => {
      if (!navigator.geolocation) { showToast('浏览器不支持定位'); return; }
      navigator.geolocation.getCurrentPosition(p => {
        map.flyTo([p.coords.latitude, p.coords.longitude], 15);
        L.circleMarker([p.coords.latitude, p.coords.longitude], {
          radius: 8, color: '#fff', weight: 3, fillColor: '#3b82f6', fillOpacity: 1
        }).addTo(map).bindPopup('📍 当前位置').openPopup();
      }, () => showToast('无法获取定位'));
    });

    // Right panel starts collapsed
    $('rightPanel').classList.add('collapsed');
    document.body.classList.add('right-collapsed');
  }

  /* ── Keyboard ── */
  function setupKeyboard() {
    document.addEventListener('keydown', e => {
      if ($('lightboxModal').classList.contains('active')) {
        if (e.key === 'Escape') closeLightbox();
        if (e.key === 'ArrowRight') nextPhoto();
        if (e.key === 'ArrowLeft') prevPhoto();
      } else if (e.key === 'Escape' && state.rightOpen) {
        closeRightPanel();
      }
    });
  }

  /* ── Toast ── */
  function showToast(msg) {
    const el = $('toastMsg');
    el.textContent = msg;
    el.classList.add('show');
    setTimeout(() => el.classList.remove('show'), 2200);
  }

  /* ── Copy ── */
  function copy(text) {
    navigator.clipboard?.writeText(text)
      .then(() => showToast('✅ 已复制到剪贴板'))
      .catch(() => showToast(text));
  }

  /* ── Escape HTML ── */
  function h(str) {
    return String(str || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');
  }

  /* ── Global API (for HTML onclick) ── */
  window._foodie = {
    openDetail: id => {
      const r = restaurants.find(x => x.id === id);
      if (r) selectRestaurant(r, false);
    },
    openLightbox,
    switchPhoto,
    copy,
    pickLucky,
    acceptLucky
  };

  /* ── Boot ── */
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();

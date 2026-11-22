'use strict';
/* 銃猟禁止区域オフライン地図
   データ: 北海道森林管理局 ArcGIS Online 公開レイヤー / 背景: 国土地理院 地理院タイル */

const SVC = 'https://services9.arcgis.com/2y39yojBa5v84JFa/arcgis/rest/services/';
const WEBMAP = 'https://hokkaido.maps.arcgis.com/sharing/rest/content/items/ec2d85cbff1e45bfabea944009435411/data?f=json';
const TILE_URL = 'https://cyberjapandata.gsi.go.jp/xyz/std/{z}/{x}/{y}.png';
const STALE_DAYS = 7;

// 描画順（下から上）。title は公式Webマップ上のレイヤー名に対する照合で、年度で名前が変わっても追従する。
const LAYERS = [
  { id: 'kinshi',  name: '銃猟立入禁止区域',   title: /立入禁止区域図/,      svc: '令和８年度立入禁止区域図', minZoom: 7,  on: true,  core: true },
  { id: 'hourei',  name: '法令等禁止区域',     title: /法令等禁止区域/,      svc: '法令等禁止区域(2026)',     minZoom: 7,  on: true,  core: true },
  { id: 'jishuku', name: '銃猟自粛区域',       title: /銃猟自粛区域/,        svc: '銃猟自粛区域',             minZoom: 7,  on: true,  core: true },
  { id: 'ryouku',  name: '猟区',               title: /^猟区$/,              svc: 'ryouku',                   minZoom: 7,  on: true,  core: true },
  { id: 'doumin',  name: '道民の森',           title: /道民の森/,            svc: '道民の森',                 minZoom: 7,  on: true,  core: true },
  { id: 'rinpanK', name: '林班界（国有林）',   title: /^林班（国有林）$/,    svc: '林班（国有林）',           minZoom: 12, on: false, core: false },
  { id: 'rinpanD', name: '林班界（道有林）',   title: /^林班（道有林）$/,    svc: '林班（道有林）',           minZoom: 12, on: false, core: false },
  { id: 'sagyo',   name: '作業道',             title: /^作業道$/,            svc: '作業道',                   minZoom: 12, on: true,  core: true },
  { id: 'rindoK',  name: '林道（国有林）',     title: /^林道（国有林）$/,    svc: '林道（国有林）',           minZoom: 10, on: true,  core: true },
  { id: 'rindoD',  name: '林道（道有林）',     title: /^林道（道有林）$/,    svc: '林道（道有林）',           minZoom: 10, on: true,  core: true },
  { id: 'kaihou',  name: '道有林 開放林道',    title: /開放林道/,            svc: '道有林_開放林道',          minZoom: 9,  on: true,  core: true },
  { id: 'shuryo',  name: '道有林 狩猟通行路線', title: /狩猟通行路線/,       svc: '道有林_狩猟通行路線',      minZoom: 9,  on: true,  core: true },
  { id: 'gate',    name: 'ゲート・通行止め',   title: /ゲート/,              svc: 'ゲート、通行止め情報',     minZoom: 11, on: true,  core: true },
];

const STYLE = {
  kinshi: f => {
    const c = f.properties['色分け'];
    const fill = c === 1 ? '#ff0000' : c === 0 ? '#ff7f7f' : '#ff00ff';
    return { stroke: true, color: '#7a0000', weight: 0.6, opacity: 0.7, fillColor: fill, fillOpacity: 0.45 };
  },
  hourei:  () => ({ color: '#000', weight: 0.8, fillColor: '#ffff00', fillOpacity: 0.45 }),
  jishuku: () => ({ color: '#000', weight: 0.8, dashArray: '4 3', fillColor: '#ffff00', fillOpacity: 0.45 }),
  ryouku:  () => ({ color: '#267300', weight: 1, fillColor: '#267300', fillOpacity: 0.3 }),
  doumin:  () => ({ color: '#000', weight: 1.5, fillColor: '#ff0000', fillOpacity: 0.45 }),
  rinpanK: () => ({ color: '#38a800', weight: 1, fill: false }),
  rinpanD: () => ({ color: '#df73ff', weight: 1, fill: false }),
  sagyo:   () => ({ color: '#474747', weight: 1.5, dashArray: '5 4' }),
  rindoK:  () => ({ color: '#800000', weight: 2.5 }),
  rindoD:  () => ({ color: '#800000', weight: 2.5 }),
  kaihou:  () => ({ color: '#a553b7', weight: 2.5 }),
  shuryo:  () => ({ color: '#008000', weight: 4 }),
};
const GATE_STYLE = {
  'ゲート':   { radius: 6, color: '#111', weight: 3, fillColor: '#fff', fillOpacity: 1 },
  '通行止め': { radius: 6, color: '#fff', weight: 2, fillColor: '#e00000', fillOpacity: 1 },
  _other:     { radius: 6, color: '#fff', weight: 2, fillColor: '#1565c0', fillOpacity: 1 },
};

// ポップアップに出す項目（内部ID類は出さない）
const FIELD_LABEL = {
  '禁止期間': '禁止期間', '規制理由': '規制理由', '自粛期b': '自粛期間', '振興局': '振興局', '市町村': '市町村', '地区名': '地区名',
  'chiki_na': '地域名', 'shitei_syu': '指定の種類', '銃猟禁': '区分', 'name': '名称', '制限': '制限',
  '林道名': '林道名', '名称': '名称', '路線番号': '路線番号', '管轄': '管轄', '管理区': '管理区', '管理署': '管理署',
  'field_2': '種別', 'field_3': '路線・場所', 'field_6': '管轄', '備考': '備考',
  '署名称': '森林管理署', '国有林名': '国有林名', '林班主番': '林班', '林班枝番': '枝番', '担当区': '担当区', '県市町村': '市町村', '林班': '林班',
};

/* ---------- IndexedDB ---------- */
let dbp;
function db() {
  if (!dbp) dbp = new Promise((res, rej) => {
    const r = indexedDB.open('ryoumap', 1);
    r.onupgradeneeded = () => { r.result.createObjectStore('layers'); r.result.createObjectStore('tiles'); };
    r.onsuccess = () => res(r.result);
    r.onerror = () => rej(r.error);
  });
  return dbp;
}
async function idb(store, mode, fn) {
  const d = await db();
  return new Promise((res, rej) => {
    const tx = d.transaction(store, mode);
    const rq = fn(tx.objectStore(store));
    tx.oncomplete = () => res(rq && rq.result);
    tx.onerror = tx.onabort = () => rej(tx.error || new Error('保存に失敗しました'));
  });
}
const idbGet = (s, k) => idb(s, 'readonly', o => o.get(k));
const idbPut = (s, k, v) => idb(s, 'readwrite', o => o.put(v, k));
const idbCount = s => idb(s, 'readonly', o => o.count());
const idbClear = s => idb(s, 'readwrite', o => o.clear());

/* ---------- 小物 ---------- */
const $ = id => document.getElementById(id);
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const WD = '日月火水木金土';
function fmtDate(ms) {
  if (!ms) return '不明';
  const d = new Date(ms);
  return `${d.getMonth() + 1}/${d.getDate()}(${WD[d.getDay()]})`;
}
function fmtDateTime(ms) {
  const d = new Date(ms);
  return `${fmtDate(ms)} ${d.getHours()}:${String(d.getMinutes()).padStart(2, '0')}`;
}
let toastT;
function toast(msg, ms = 3500) {
  const t = $('toast'); t.textContent = msg; t.hidden = false;
  clearTimeout(toastT); toastT = setTimeout(() => { t.hidden = true; }, ms);
}
function pref(key, def) { try { const v = localStorage.getItem(key); return v === null ? def : JSON.parse(v); } catch (e) { return def; } }
function setPref(key, v) { try { localStorage.setItem(key, JSON.stringify(v)); } catch (e) { /* 保存できなくても動作は続ける */ } }
async function fetchJson(url, timeoutMs = 60000) {
  const ac = new AbortController(); const t = setTimeout(() => ac.abort(), timeoutMs);
  try {
    const r = await fetch(url, { signal: ac.signal, cache: 'no-store' });
    if (!r.ok) throw new Error('HTTP ' + r.status);
    const j = await r.json();
    if (j && j.error) throw new Error(j.error.message || 'サーバーエラー');
    return j;
  } finally { clearTimeout(t); }
}

/* ---------- 地図と背景タイル ---------- */
const view = pref('view', { c: [43.2, 142.6], z: 8 });
const map = L.map('map', { center: view.c, zoom: view.z, minZoom: 5, maxZoom: 18, zoomControl: false, preferCanvas: true });
L.control.scale({ imperial: false, position: 'bottomleft' }).addTo(map);
map.attributionControl.setPrefix(false);
map.on('moveend', () => { const c = map.getCenter(); setPref('view', { c: [c.lat, c.lng], z: map.getZoom() }); });

const tileKey = (z, x, y) => `${z}/${x}/${y}`;
const tileUrl = (z, x, y) => TILE_URL.replace('{z}', z).replace('{x}', x).replace('{y}', y);
async function fetchTile(z, x, y) {
  const ac = new AbortController(); const t = setTimeout(() => ac.abort(), 20000);
  try {
    const r = await fetch(tileUrl(z, x, y), { signal: ac.signal });
    if (r.status === 404) return null;            // 海上など、タイルが存在しない場所
    if (!r.ok) throw new Error('HTTP ' + r.status);
    return await r.arrayBuffer();
  } finally { clearTimeout(t); }
}
// 保存済みの上位ズームのタイルを拡大して代用する（圏外で未保存のズームを開いたとき用）
async function ancestorTile(z, x, y) {
  for (let d = 1; d <= 5 && z - d >= 5; d++) {
    const buf = await idbGet('tiles', tileKey(z - d, x >> d, y >> d));
    if (!buf) continue;
    const src = new Image(); const u = URL.createObjectURL(new Blob([buf], { type: 'image/png' }));
    await new Promise((res, rej) => { src.onload = res; src.onerror = rej; src.src = u; });
    const n = 1 << d, s = 256 / n, cv = document.createElement('canvas'); cv.width = cv.height = 256;
    const g = cv.getContext('2d'); g.imageSmoothingEnabled = true;
    g.drawImage(src, (x - ((x >> d) << d)) * s, (y - ((y >> d) << d)) * s, s, s, 0, 0, 256, 256);
    URL.revokeObjectURL(u);
    return cv.toDataURL('image/png');
  }
  return null;
}
const OfflineTiles = L.GridLayer.extend({
  createTile(c, done) {
    const img = document.createElement('img'); img.alt = ''; img.setAttribute('role', 'presentation');
    let objUrl = null;
    img.onload = () => { if (objUrl) URL.revokeObjectURL(objUrl); done(null, img); };
    img.onerror = () => done(new Error('tile'), img);
    const show = buf => { objUrl = URL.createObjectURL(new Blob([buf], { type: 'image/png' })); img.src = objUrl; };
    (async () => {
      const key = tileKey(c.z, c.x, c.y);
      let buf = await idbGet('tiles', key).catch(() => null);
      if (buf) return show(buf);
      try {
        buf = await fetchTile(c.z, c.x, c.y);
        if (buf) { idbPut('tiles', key, buf).catch(() => {}); return show(buf); }
      } catch (e) { /* 圏外など。下で代用を試す */ }
      const alt = await ancestorTile(c.z, c.x, c.y).catch(() => null);
      if (alt) img.src = alt; else done(new Error('tile'), img);
    })();
    return img;
  },
});
new OfflineTiles({ minZoom: 5, maxZoom: 18, attribution: '<a href="https://maps.gsi.go.jp/development/ichiran.html" target="_blank" rel="noopener">地理院タイル</a> ／ 北海道森林管理局' }).addTo(map);

/* ---------- 禁止区域などの重ね描き ---------- */
const renderer = L.canvas({ padding: 0.3, tolerance: 10 });
const groups = {};     // id -> L.GeoJSON
const meta = {};       // id -> {fetchedAt, lastEdit, count}
const enabled = pref('layers', Object.fromEntries(LAYERS.map(l => [l.id, l.on])));
LAYERS.forEach(l => { if (!(l.id in enabled)) enabled[l.id] = l.on; });

// 図形は画面付近にあるものだけを地図に載せる（全道分を常時描くとスマホでは重いため）
function buildGroup(l, gj) {
  const opt = { interactive: false, renderer };
  if (l.id === 'gate') {
    opt.pointToLayer = (f, ll) => L.circleMarker(ll, Object.assign({ renderer, interactive: false }, GATE_STYLE[f.properties.field_2] || GATE_STYLE._other));
  } else {
    opt.style = f => Object.assign({ renderer, interactive: false, lineJoin: 'round' }, STYLE[l.id](f));
  }
  const items = [];
  L.geoJSON(gj, opt).eachLayer(ly => {
    const b = ly.getBounds ? ly.getBounds() : L.latLngBounds(ly.getLatLng(), ly.getLatLng());
    if (b.isValid()) items.push({ ly, b, on: false });
  });
  const kind = l.id === 'gate' ? 2 : (items[0] && items[0].ly instanceof L.Polygon) ? 0 : 1;   // 0=面 1=線 2=点
  return { items, kind };
}
function dropGroup(id) {
  const g = groups[id]; if (!g) return;
  for (const it of g.items) if (it.on) { map.removeLayer(it.ly); it.on = false; }
}
function refreshLayers() {
  const z = map.getZoom(), vb = map.getBounds().pad(0.35);
  let addedBelow = false;
  for (const l of LAYERS) {
    const g = groups[l.id]; if (!g) continue;
    const show = enabled[l.id] && z >= l.minZoom;
    for (const it of g.items) {
      const want = show && vb.intersects(it.b);
      if (want && !it.on) {
        map.addLayer(it.ly); it.on = true;
        if (g.kind === 0) it.ly.bringToBack(); else if (g.kind === 1) addedBelow = true;
      } else if (!want && it.on) { map.removeLayer(it.ly); it.on = false; }
    }
  }
  // 描画順を保つ: 面 < 線 < 点。線を後から足したときは点を最前面に戻す
  if (addedBelow && groups.gate) for (const it of groups.gate.items) if (it.on) it.ly.bringToFront();
}
map.on('moveend', refreshLayers);

async function loadStored() {
  for (const l of LAYERS) {
    const rec = await idbGet('layers', l.id).catch(() => null);
    if (!rec) continue;
    groups[l.id] = buildGroup(l, JSON.parse(rec.geojson));
    meta[l.id] = { fetchedAt: rec.fetchedAt, checkedAt: rec.checkedAt, lastEdit: rec.lastEdit, count: rec.count };
  }
  refreshLayers(); renderLayerList(); renderStatus();
}

/* ---------- タップで情報表示（重なっている全レイヤーを拾う） ---------- */
function propsHtml(l, p) {
  let h = `<h4>${esc(l.name)}</h4>`;
  if (l.id === 'kinshi') h += `<div class="big ng">${esc(p['禁止期間'] || '期間の記載なし')}</div>`;
  if (l.id === 'gate') h += `<div class="big">${esc(p.field_2 || '種別不明')}</div>`;
  const rows = [];
  for (const k in p) {
    const v = p[k];
    if (!(k in FIELD_LABEL) || v === null || String(v).trim() === '') continue;
    if ((l.id === 'kinshi' && k === '禁止期間') || (l.id === 'gate' && k === 'field_2')) continue;
    rows.push(`<dt>${esc(FIELD_LABEL[k])}</dt><dd>${esc(v)}</dd>`);
  }
  if (rows.length) h += `<dl>${rows.join('')}</dl>`;
  return h;
}
map.on('click', e => {
  const pt = map.latLngToLayerPoint(e.latlng), hits = [];
  for (let i = LAYERS.length - 1; i >= 0; i--) {         // 上のレイヤーから
    const l = LAYERS[i], g = groups[l.id];
    if (!g) continue;
    let n = 0;
    for (const it of g.items) {
      const ly = it.ly;
      if (n >= 3) break;
      if (!it.on || !ly._containsPoint || !ly._pxBounds) continue;
      const b = ly._pxBounds;
      if (pt.x < b.min.x - 12 || pt.x > b.max.x + 12 || pt.y < b.min.y - 12 || pt.y > b.max.y + 12) continue;
      let hit = false;
      try { hit = ly._containsPoint(pt); } catch (err) { hit = false; }
      if (hit) { hits.push(propsHtml(l, ly.feature.properties)); n++; }
    }
  }
  if (!hits.length) return;
  L.popup({ maxWidth: 300, autoPanPadding: [20, 70] }).setLatLng(e.latlng).setContent(`<div class="pop">${hits.join('')}</div>`).openOn(map);
});

/* ---------- データ更新 ---------- */
async function resolveUrls() {
  const urls = {};
  try {
    const wm = await fetchJson(WEBMAP, 20000);
    for (const ol of wm.operationalLayers || []) {
      if (!ol.url || !ol.title) continue;
      for (const l of LAYERS) if (!urls[l.id] && l.title.test(ol.title)) urls[l.id] = ol.url;
    }
  } catch (e) { /* 取れなければ既定のURLを使う */ }
  LAYERS.forEach(l => { if (!urls[l.id]) urls[l.id] = SVC + encodeURIComponent(l.svc) + '/FeatureServer/0'; });
  return urls;
}
async function downloadLayer(url, onProg) {
  const info = await fetchJson(url + '?f=json', 30000);
  const ei = info.editingInfo || {};
  const lastEdit = ei.dataLastEditDate || ei.lastEditDate || null;
  const page = Math.min(info.maxRecordCount || 1000, 2000);
  const oid = info.objectIdField || 'FID';
  const feats = [];
  for (let off = 0; ; ) {
    const q = `${url}/query?where=1%3D1&outFields=*&outSR=4326&geometryPrecision=5&maxAllowableOffset=0.00002&f=geojson&orderByFields=${encodeURIComponent(oid)}&resultOffset=${off}&resultRecordCount=${page}`;
    const j = await fetchJson(q, 120000);
    const fs = j.features || [];
    for (const f of fs) if (f.geometry) feats.push(f);
    off += fs.length; onProg(off);
    const more = j.exceededTransferLimit || (j.properties && j.properties.exceededTransferLimit);
    if (!fs.length || (!more && fs.length < page)) break;
  }
  return { lastEdit, gj: { type: 'FeatureCollection', features: feats } };
}
let updating = false;
async function updateData(force) {
  if (updating) return;
  updating = true; $('bUpdate').disabled = $('bForce').disabled = true;
  const box = $('upProg'); box.hidden = false;
  const lines = {}; const draw = () => { box.textContent = LAYERS.filter(l => lines[l.id]).map(l => `${l.name}: ${lines[l.id]}`).join('\n'); };
  let changed = 0, failed = 0;
  try {
    box.textContent = '公式マップに接続しています…';
    const urls = await resolveUrls();
    for (const l of LAYERS) {
      if (!l.core && !enabled[l.id]) continue;      // 任意レイヤーはオンのときだけ取得
      try {
        lines[l.id] = '確認中…'; draw();
        if (!force && meta[l.id]) {
          const info = await fetchJson(urls[l.id] + '?f=json', 30000);
          const ei = info.editingInfo || {}; const le = ei.dataLastEditDate || ei.lastEditDate || null;
          if (le && le === meta[l.id].lastEdit) {
            const rec = await idbGet('layers', l.id); rec.checkedAt = Date.now(); await idbPut('layers', l.id, rec);
            meta[l.id].checkedAt = rec.checkedAt;
            lines[l.id] = `変更なし（公式更新 ${fmtDate(le)}）`; draw(); continue;
          }
        }
        const { lastEdit, gj } = await downloadLayer(urls[l.id], n => { lines[l.id] = `取得中… ${n}件`; draw(); });
        const now = Date.now();
        await idbPut('layers', l.id, { geojson: JSON.stringify(gj), fetchedAt: now, checkedAt: now, lastEdit, count: gj.features.length });
        dropGroup(l.id);
        groups[l.id] = buildGroup(l, gj);
        meta[l.id] = { fetchedAt: now, checkedAt: now, lastEdit, count: gj.features.length };
        lines[l.id] = `更新しました（${gj.features.length}件、公式更新 ${fmtDate(lastEdit)}）`; draw(); changed++;
      } catch (e) {
        failed++; lines[l.id] = `失敗（${e.name === 'AbortError' ? '時間切れ' : e.message}）— 前回のデータのままです`; draw();
      }
    }
    setPref('lastCheck', Date.now());
    refreshLayers(); renderLayerList(); renderStatus();
    toast(failed ? `${failed}件のレイヤーを取得できませんでした。電波の良い場所でやり直してください。` : changed ? 'データを更新しました' : '最新です（公式側に変更なし）', 5000);
  } finally {
    updating = false; $('bUpdate').disabled = $('bForce').disabled = false;
  }
}

/* ---------- 地形図の範囲保存 ---------- */
const AVG_KB = z => (z <= 14 ? 59 : z === 15 ? 35 : z === 16 ? 10 : 6);
const MAX_TILES = 150000;   // これ以上は一度に取らない（地理院サーバーへの負荷と端末容量のため）
const CONFIRM_MB = 300;     // これを超えるときは確認を出す
function lon2x(lon, z) { return Math.floor((lon + 180) / 360 * (1 << z)); }
function lat2y(lat, z) { const r = lat * Math.PI / 180; return Math.floor((1 - Math.log(Math.tan(r) + 1 / Math.cos(r)) / Math.PI) / 2 * (1 << z)); }
function tilesForView(maxZ) {
  const b = map.getBounds(), list = []; let kb = 0;
  for (let z = 8; z <= maxZ; z++) {
    const x0 = lon2x(b.getWest(), z), x1 = lon2x(b.getEast(), z), y0 = lat2y(b.getNorth(), z), y1 = lat2y(b.getSouth(), z);
    for (let x = x0; x <= x1; x++) for (let y = y0; y <= y1; y++) list.push([z, x, y]);
    kb += (x1 - x0 + 1) * (y1 - y0 + 1) * AVG_KB(z);
  }
  return { list, mb: kb / 1024 };
}
function renderTileEst() {
  if ($('sheet').hidden) return;
  const { list, mb } = tilesForView(+$('selZ').value);
  const over = list.length > MAX_TILES;
  const size = mb < 10 ? mb.toFixed(1) + 'MB' : mb < 1000 ? Math.round(mb) + 'MB' : (mb / 1024).toFixed(1) + 'GB';
  const min = Math.ceil(list.length / 15 / 60);
  $('tileEst').textContent = `この範囲: 約${list.length.toLocaleString()}枚・約${size}` + (list.length > 2000 ? `・目安${min}分以上` : '')
    + (over ? `（一度に保存できる上限 ${MAX_TILES.toLocaleString()}枚を超えています。範囲を分けるか、詳しさを下げてください）` : '');
  $('bTiles').disabled = over || tileJob;
}
let tileJob = false, tileStop = false;
async function saveTiles() {
  const { list, mb } = tilesForView(+$('selZ').value);
  if (list.length > MAX_TILES || tileJob) return;
  if (mb > CONFIRM_MB && !confirm(`約${list.length.toLocaleString()}枚・約${mb < 1000 ? Math.round(mb) + 'MB' : (mb / 1024).toFixed(1) + 'GB'}を保存します。\n時間がかかるので、Wi-Fiと充電のある場所で、画面を開いたままにしてください。途中で止めても、次回は続きから保存します。\n\n開始しますか？`)) return;
  let wake = null;
  try { if (navigator.wakeLock) wake = await navigator.wakeLock.request('screen'); } catch (e) { wake = null; }   // 保存中の画面消灯を防ぐ
  tileJob = true; tileStop = false; $('bTiles').disabled = true; $('bTilesStop').hidden = false;
  const box = $('tileProg'); box.hidden = false;
  if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(() => {});
  let done = 0, got = 0, fail = 0, i = 0;
  const worker = async () => {
    while (i < list.length && !tileStop) {
      const [z, x, y] = list[i++], key = tileKey(z, x, y);
      try {
        if (!(await idbGet('tiles', key))) {
          let buf = null;
          for (let a = 0; a < 2 && !buf; a++) { try { buf = await fetchTile(z, x, y); break; } catch (e) { if (a === 1) throw e; } }
          if (buf) { await idbPut('tiles', key, buf); got++; }
        }
      } catch (e) { fail++; if (e && e.name === 'QuotaExceededError') { tileStop = true; toast('端末の保存容量が足りません', 6000); } }
      done++;
      if (done % 20 === 0 || done === list.length) box.textContent = `保存中… ${done.toLocaleString()} / ${list.length.toLocaleString()}枚` + (fail ? `（失敗 ${fail}）` : '');
    }
  };
  await Promise.all([worker(), worker(), worker(), worker()]);
  box.textContent = (tileStop ? '中止しました。' : '完了しました。') + ` 新規保存 ${got.toLocaleString()}枚` + (fail ? `、失敗 ${fail}枚（もう一度押すと不足分だけ取り直します）` : '');
  if (wake) wake.release().catch(() => {});
  tileJob = false; $('bTilesStop').hidden = true; renderTileEst(); renderStore();
}
async function renderStore() {
  let s = '';
  try {
    const n = await idbCount('tiles'); s = `保存済みの地形図: ${n.toLocaleString()}枚`;
    if (navigator.storage && navigator.storage.estimate) { const e = await navigator.storage.estimate(); if (e.usage) s += `／アプリの使用容量: 約${Math.round(e.usage / 1048576)}MB`; }
  } catch (e) { s = ''; }
  $('storeInfo').textContent = s;
}

/* ---------- 画面部品 ---------- */
function renderLayerList() {
  $('layerList').innerHTML = LAYERS.map(l => {
    const m = meta[l.id];
    const note = m ? `${m.count.toLocaleString()}件` : (l.core ? '未取得' : '');
    return `<label><input type="checkbox" data-id="${l.id}" ${enabled[l.id] ? 'checked' : ''}>${esc(l.name)}${l.core ? '' : ' <span class="opt">任意</span>'}<span class="cnt">${note}</span></label>`;
  }).join('');
}
$('layerList').addEventListener('change', e => {
  const id = e.target.dataset.id; if (!id) return;
  enabled[id] = e.target.checked; setPref('layers', enabled); refreshLayers();
  const l = LAYERS.find(x => x.id === id);
  if (enabled[id] && !groups[id]) toast(`「${l.name}」は未取得です。「更新を確認して取得」を押すと取得します。`, 5000);
  else if (enabled[id] && map.getZoom() < l.minZoom) toast(`「${l.name}」は地図を拡大すると表示されます`);
});
function renderStatus() {
  const k = meta.kinshi, st = $('status');
  st.className = '';
  if (!k) { $('stData').textContent = 'データ未取得 — ☰ から更新してください'; st.className = 'bad'; $('dataInfo').textContent = 'まだ取得していません。電波のある場所で「更新を確認して取得」を押してください。'; return; }
  const checked = k.checkedAt || k.fetchedAt, days = (Date.now() - checked) / 86400000;
  $('stData').textContent = `禁止区域 ${fmtDate(k.lastEdit)}版・確認${fmtDate(checked)}` + (days >= STALE_DAYS ? ` 要更新(${Math.floor(days)}日前)` : '');
  if (days >= STALE_DAYS) st.className = 'warn';
  $('dataInfo').textContent = `禁止区域データ: 公式の更新日 ${fmtDate(k.lastEdit)}／最後に確認した日時 ${fmtDateTime(checked)}。公式の図は毎週更新されるので、出猟前に必ず確認してください。`;
}
function renderNet() { $('stNet').textContent = navigator.onLine ? '' : '圏外'; }
window.addEventListener('online', renderNet); window.addEventListener('offline', renderNet);

$('bMenu').onclick = () => { $('sheet').hidden = false; renderTileEst(); renderStore(); };
$('bClose').onclick = () => { $('sheet').hidden = true; };
$('bUpdate').onclick = () => updateData(false);
$('bForce').onclick = () => updateData(true);
$('bTiles').onclick = saveTiles;
$('bTilesStop').onclick = () => { tileStop = true; };
$('selZ').onchange = renderTileEst;
map.on('moveend', renderTileEst);
$('bTilesClear').onclick = async () => {
  if (!confirm('保存した地形図を全て削除します。よろしいですか？（禁止区域データは残ります）')) return;
  await idbClear('tiles'); renderStore(); toast('地形図を削除しました');
};

/* ---------- 現在地 ---------- */
let watchId = null, posMarker = null, posCircle = null, follow = false;
$('bGps').onclick = () => {
  if (watchId !== null && follow) { navigator.geolocation.clearWatch(watchId); watchId = null; follow = false; $('bGps').classList.remove('on'); if (posMarker) { map.removeLayer(posMarker); map.removeLayer(posCircle); posMarker = posCircle = null; } return; }
  if (!navigator.geolocation) { toast('この端末では現在地を取得できません'); return; }
  follow = true; $('bGps').classList.add('on');
  if (posMarker) { map.setView(posMarker.getLatLng(), Math.max(map.getZoom(), 15)); return; }
  if (watchId === null) watchId = navigator.geolocation.watchPosition(p => {
    const ll = [p.coords.latitude, p.coords.longitude], first = !posMarker;
    if (first) {
      posCircle = L.circle(ll, { radius: p.coords.accuracy, color: '#1565c0', weight: 1, fillOpacity: 0.12, interactive: false }).addTo(map);
      posMarker = L.marker(ll, { interactive: false, icon: L.divIcon({ className: 'me', iconSize: [20, 20], iconAnchor: [10, 10] }) }).addTo(map);
    } else { posMarker.setLatLng(ll); posCircle.setLatLng(ll); posCircle.setRadius(p.coords.accuracy); }
    if (follow) map.setView(ll, first ? Math.max(map.getZoom(), 15) : map.getZoom(), { animate: !first });
  }, err => {
    toast(err.code === 1 ? '位置情報の利用が許可されていません。設定アプリで許可してください。' : '現在地を取得できません（空が開けた場所で試してください）', 5000);
    if (err.code === 1) { navigator.geolocation.clearWatch(watchId); watchId = null; follow = false; $('bGps').classList.remove('on'); }
  }, { enableHighAccuracy: true, maximumAge: 5000, timeout: 30000 });
};
map.on('dragstart', () => { if (follow) { follow = false; $('bGps').classList.remove('on'); } });

/* ---------- 起動 ---------- */
renderLayerList(); renderStatus(); renderNet();
loadStored().then(() => { if (!meta.kinshi) $('sheet').hidden = false, renderTileEst(), renderStore(); });
if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(() => {});

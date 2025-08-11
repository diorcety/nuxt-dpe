<template>
  <div>
    <div id="map" style="height: 100vh">
      <!-- Loading Spinner -->
      <div v-if="loading" class="loading-spinner">
        <div class="spinner"></div>
      </div>
    </div>
    <div id="controls" :class="{ collapsed: isControlsCollapsed }">
      <div class="toggle-icon" @click="toggleControls">
        <svg
          v-if="!isControlsCollapsed"
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
          class="feather feather-chevron-right"
          width="24"
          height="24"
        >
          <path d="M9 18l6-6-6-6" />
        </svg>
        <svg
          v-else
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
          class="feather feather-chevron-left"
          width="24"
          height="24"
        >
          <path d="M15 18l-6-6 6-6" />
        </svg>
      </div>
      <div v-if="!isControlsCollapsed">
        <h3>OSM - DPE</h3>
        <div>
          <label
            >Département:
            <input v-model="dept" style="width: 60px" @input="updateUrlParams"
          /></label>
          <label style="margin-left: 8px">
            Type:
            <select
              v-model="type"
              style="width: 120px"
              @input="updateUrlParams"
            >
              <option value="all">Tout</option>
              <option value="appartement">Appartement</option>
              <option value="maison">Maison</option>
            </select>
          </label>
        </div>
        <div>
          <label
            >Date min:
            <input type="date" v-model="dateMin" @input="updateUrlParams"
          /></label>
          <label style="margin-left: 8px"
            >Date max:
            <input type="date" v-model="dateMax" @input="updateUrlParams"
          /></label>
        </div>
        <div>
          <label>Étiquette DPE:</label>
          <div
            v-for="(label, key) in dpeLabels"
            :key="key"
            style="display: inline-block; margin-right: 2px"
          >
            <input
              type="checkbox"
              :id="key"
              :value="key"
              v-model="selectedDpeLabels"
              @change="updateUrlParams"
            />
            <label :for="key">{{ label }}</label>
          </div>
        </div>
        <div>
          <button @click="fetchData">Charger les données ADEME</button>
          <button @click="clearMarkers">Effacer les marqueurs</button>
          <button @click="zoomAll">Zoom sur les marqueurs</button>
          <button @click="cleanLogs" v-if="isDev">Effacer les logs</button>
        </div>
        <div v-if="isDev">
          <small>Log:</small>
          <div id="log">
            <div v-for="(l, i) in logs" :key="i">{{ l }}</div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { onMounted, ref } from "vue";
import "leaflet/dist/leaflet.css";
import L from "leaflet";
import proj4 from "proj4";

// Constants
proj4.defs(
  "EPSG:2154",
  "+proj=lcc +lat_1=49 +lat_2=44 +lat_0=46.5 +lon_0=3 +x_0=700000 +y_0=6600000 +ellps=GRS80 +units=m +no_defs",
);

const dpeLabels = ref({
  A: "A",
  B: "B",
  C: "C",
  D: "D",
  E: "E",
  F: "F",
  G: "G",
});

const dpeColors = {
  A: "#1E7E34",
  B: "#4CAF50",
  C: "#81C784",
  D: "#FFEB3B",
  E: "#FF9800",
  F: "#F57C00",
  G: "#D32F2F",
};

// Data
const dept = ref("38");
const type = ref("maison");
const today = new Date();
const prior = new Date(today);
prior.setDate(today.getDate() - 30);
const dateMax = ref(today.toISOString().slice(0, 10));
const dateMin = ref(prior.toISOString().slice(0, 10));
const selectedDpeLabels = ref(["A", "B", "C", "D", "E", "F", "G"]);
const lat = ref(45.75);
const long = ref(4.85);
const zoom = ref(10);
const loaded = ref(false);

// States
const isDev = computed(() => process.env.NODE_ENV === "development");
const isControlsCollapsed = ref(false); // Initially, the controls are not collapsed
const loading = ref(false); // Track loading state
const logs = ref([]);
let map, markersLayer;

// Toggle the collapse/expand state
function toggleControls() {
  isControlsCollapsed.value = !isControlsCollapsed.value;
  updateUrlParams();
}

// Read URL parameters and update form data
function readUrlParams() {
  const params = new URLSearchParams(window.location.search);

  dept.value = params.get("dept") || "69";
  type.value = params.get("type") || "maison";
  dateMax.value = params.get("dateMax") || today.toISOString().slice(0, 10);
  dateMin.value = params.get("dateMin") || prior.toISOString().slice(0, 10);

  const dpeParam = params.get("dpeLabels");
  if (dpeParam) {
    selectedDpeLabels.value = dpeParam.split(","); // Convert comma-separated string to array
  }

  lat.value = parseFloat(params.get("lat")) || 45.75;
  long.value = parseFloat(params.get("long")) || 4.85;
  zoom.value = parseInt(params.get("zoom")) || 10;

  loaded.value = JSON.parse(params.get("loaded")) || false;
  isControlsCollapsed.value =
    JSON.parse(params.get("controls_collapsed")) || false;
}

// Update URL parameters when form data changes
function updateUrlParams() {
  const params = new URLSearchParams();

  params.set("dept", dept.value);
  params.set("type", type.value);
  params.set("dateMin", dateMin.value);
  params.set("dateMax", dateMax.value);

  if (selectedDpeLabels.value.length > 0) {
    params.set("dpeLabels", selectedDpeLabels.value.join(",")); // Convert array to comma-separated string
  }

  params.set("lat", lat.value);
  params.set("long", long.value);
  params.set("zoom", zoom.value);

  params.set("loaded", loaded.value);
  params.set("controls_collapsed", isControlsCollapsed.value);

  // Update the URL without reloading the page
  window.history.replaceState({}, "", "?" + params.toString());
}

function log(...args) {
  if (isDev) {
    logs.value.unshift(args.join(" "));
    console.log(args.join(" "));
  }
}

function lambert93ToWgs84(x, y) {
  const [lon, lat] = proj4("EPSG:2154", "EPSG:4326", [x, y]);
  return { lat, lon };
}

function getDpeIcon(dpeLabel, isApartment = false) {
  const color = dpeColors[dpeLabel] || "#999";
  const strokeColor = "#333"; // optional: outline color

  if (isApartment) {
    return L.divIcon({
      className: "custom-icon",
      html: `
        <svg width="40" height="40" viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg">
          <rect x="14" y="12" width="36" height="40" fill="${color}" stroke="${strokeColor}" stroke-width="3" rx="4" ry="4"/>
          <rect x="20" y="20" width="8" height="8" fill="#ffffff" />
          <rect x="36" y="20" width="8" height="8" fill="#ffffff" />
          <rect x="20" y="34" width="8" height="8" fill="#ffffff" />
          <rect x="36" y="34" width="8" height="8" fill="#ffffff" />
        </svg>`,
      iconSize: [40, 40],
      iconAnchor: [20, 40],
      popupAnchor: [0, -40],
    });
  } else {
    return L.divIcon({
      className: "custom-icon",
      html: `
        <svg width="40" height="40" viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg">
          <path d="M32 12 L12 32 H20 V52 H44 V32 H52 L32 12 Z" fill="${color}" stroke="${strokeColor}" stroke-width="3"/>
          <rect x="26" y="36" width="12" height="16" fill="#ffffff" stroke="#222" stroke-width="2" />
        </svg>`,
      iconSize: [40, 40],
      iconAnchor: [20, 40],
      popupAnchor: [0, -40],
    });
  }
}

function buildQueryString(filters) {
  const queryParts = [];

  // Loop through the filters object to build the query string
  for (const [key, value] of Object.entries(filters)) {
    if (Array.isArray(value)) {
      // If value is an array, join the items using OR
      const orJoinedValue = value.map((v) => `${key}:${v}`).join(" OR ");
      queryParts.push(`(${orJoinedValue})`);
    } else if (value) {
      // Otherwise, just add the key:value pair
      queryParts.push(`${key}:${value}`);
    }
  }

  return queryParts.join(" AND ");
}

function quoted_string(str) {
  return '"' + str + '"';
}

async function fetchAdeme() {
  const BASE_URL =
    "https://data.ademe.fr/data-fair/api/v1/datasets/dpe03existant/lines";
  let page = 1;
  let all = [];

  const filters = {
    code_departement_ban: quoted_string(dept.value),
    type_batiment: type.value !== "all" ? quoted_string(type.value) : undefined,
    date_etablissement_dpe: `[${dateMin.value} TO ${dateMax.value}]`,
    etiquette_dpe: selectedDpeLabels.value.map((key) => quoted_string(key)),
  };
  const qs = buildQueryString(filters);

  while (true) {
    const params = new URLSearchParams({
      q_mode: "complete",
      size: "100",
      page: String(page),
      qs,
    });
    const url = BASE_URL + "?" + params.toString();
    log("Fetching", url);
    const r = await fetch(url);
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    const data = await r.json();
    const results = data.results || [];
    log(`Page ${page} — ${results.length} rows`);
    if (!results.length) break;
    all = all.concat(results);
    page++;
  }
  log("Total fetched:", all.length);
  return all;
}

function escapeHtml(s) {
  return String(s || "").replace(
    /[&<>\"]+/g,
    (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c],
  );
}

function addRowsToMap(rows) {
  let added = 0;
  for (const row of rows) {
    try {
      const x = parseFloat(row.coordonnee_cartographique_x_ban);
      const y = parseFloat(row.coordonnee_cartographique_y_ban);
      if (Number.isNaN(x) || Number.isNaN(y)) continue;
      const { lat, lon } = lambert93ToWgs84(x, y);
      const name = row.numero_dpe || "Inconnu";
      const desc = row.adresse_ban || "";
      const popupHtml = `
  <div style="font-family: Arial, sans-serif; font-size: 14px; color: #333; padding: 8px; line-height: 1.5;">
    <b>
      <a 
        href="https://observatoire-dpe-audit.ademe.fr/afficher-dpe/${name}" 
        target="_blank" 
        style="text-decoration: none; color: #388E3C; font-weight: bold;"
      >
        ${escapeHtml(name)}
      </a>
    </b>
    <br>
    <a 
      href="https://www.openstreetmap.org/search?query=${desc}" 
      target="_blank" 
      style="text-decoration: none; color: #2196F3; font-size: 13px;"
    >
      ${escapeHtml(desc)}
    </a>
    <br>
    <small style="color: #888;">
      ${escapeHtml(row.date_etablissement_dpe || "Date not available")}
    </small>
  </div>
`;
      const isApartment = row.type_batiment
        ?.toLowerCase()
        .includes("appartement");
      const dpe = row.etiquette_dpe?.toUpperCase() || "NC";
      const icon = getDpeIcon(dpe, isApartment);
      const marker = L.marker([lat, lon], { icon }).bindPopup(popupHtml);
      markersLayer.addLayer(marker);
      added++;
    } catch (err) {
      log("Error adding marker:", err.message);
    }
  }
  log(`Added ${added} markers`);
}

async function fetchData(zoom = true) {
  loading.value = true;
  markersLayer.clearLayers();
  const rows = await fetchAdeme();
  addRowsToMap(rows);
  loaded.value = true;
  if (zoom && markersLayer.getLayers().length)
    map.fitBounds(markersLayer.getBounds(), { padding: [40, 40] });
  loading.value = false;
}

function clearMarkers() {
  markersLayer.clearLayers();
  loaded.value = false;
  log("Cleared markers");
}

function zoomAll() {
  if (markersLayer.getLayers().length)
    map.fitBounds(markersLayer.getBounds(), { padding: [40, 40] });
}

function cleanLogs() {
  logs.value = [];
}

onMounted(async () => {
  readUrlParams();

  map = L.map("map").setView([lat.value, long.value], zoom.value);
  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 19,
    attribution: "&copy; OpenStreetMap contributors",
  }).addTo(map);
  markersLayer = L.featureGroup().addTo(map);

  // Update URL parameters when the map moves or zooms
  map.on("moveend", () => {
    const center = map.getCenter();
    lat.value = center.lat;
    long.value = center.lng;
    zoom.value = map.getZoom();
    updateUrlParams();
  });

  // Fetch the data on mount if requested
  if (loaded.value) {
    await fetchData(false);
  }
});
</script>

<style scoped>
#map {
  position: relative; /* Ensure the map container is the reference for absolute positioning */
}

.loading-spinner {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(255, 255, 255, 0.5);
  z-index: 2000; /* Make sure it's on top of the map */
}

.spinner {
  border: 4px solid transparent;
  border-top: 4px solid #4caf50;
  border-radius: 50%;
  width: 40px;
  height: 40px;
  animation: spin 1s linear infinite;
}

@keyframes spin {
  0% {
    transform: rotate(0deg);
  }
  100% {
    transform: rotate(360deg);
  }
}

#controls {
  position: absolute;
  z-index: 1000;
  right: 10px; /* Align controls on the right side */
  top: 10px;
  background: rgba(255, 255, 255, 0.95);
  padding: 12px;
  border-radius: 8px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
  transition: all 0.3s ease;
}

#controls.collapsed {
  width: 30px;
  padding: 10px;
}

#log {
  max-height: 120px;
  overflow: auto;
  font-size: 13px;
  background: #f7f7f7;
  padding: 6px;
  border-radius: 6px;
  display: block;
}

button {
  cursor: pointer;
  padding: 6px 12px;
  background-color: #4caf50;
  color: white;
  border: none;
  border-radius: 4px;
  margin-top: 10px;
  margin-left: 5px;
  margin-right: 5px;
}

button:hover {
  background-color: #45a049;
}
</style>

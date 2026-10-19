"use strict";

const LAT = 42.66; // Approximate center of ZIP 12206
const LON = -73.79;
const TIMEZONE = "America/New_York";
const $ = id => document.getElementById(id);

const weatherDescriptions = {
  0: ["Clear sky", "☀️"],
  1: ["Mostly clear", "🌤️"],
  2: ["Partly cloudy", "⛅"],
  3: ["Overcast", "☁️"],
  45: ["Fog", "🌫️"],
  48: ["Freezing fog", "🌫️"],
  51: ["Light drizzle", "🌦️"],
  53: ["Drizzle", "🌦️"],
  55: ["Heavy drizzle", "🌧️"],
  56: ["Freezing drizzle", "🌧️"],
  57: ["Freezing drizzle", "🌧️"],
  61: ["Light rain", "🌦️"],
  63: ["Rain", "🌧️"],
  65: ["Heavy rain", "🌧️"],
  66: ["Freezing rain", "🌧️"],
  67: ["Heavy freezing rain", "🌧️"],
  71: ["Light snow", "🌨️"],
  73: ["Snow", "🌨️"],
  75: ["Heavy snow", "❄️"],
  77: ["Snow grains", "🌨️"],
  80: ["Rain showers", "🌦️"],
  81: ["Showers", "🌧️"],
  82: ["Heavy showers", "⛈️"],
  85: ["Snow showers", "🌨️"],
  86: ["Heavy snow showers", "❄️"],
  95: ["Thunderstorm", "⛈️"],
  96: ["Thunderstorm with hail", "⛈️"],
  99: ["Severe thunderstorm", "⛈️"]
};

function condition(code) {
  return weatherDescriptions[code] || ["Conditions unavailable", "🌡️"];
}

function number(value, digits = 0) {
  return Number.isFinite(value) ? value.toFixed(digits) : "—";
}

function temp(value) {
  return Number.isFinite(value) ? `${Math.round(value)}°` : "—";
}

function rain(value) {
  if (!Number.isFinite(value)) return "—";
  if (value < 0.005) return "0 in";
  return `${value.toFixed(2)} in`;
}

function clockTick() {
  const now = new Date();
  $("clock").textContent = new Intl.DateTimeFormat("en-US", {
    timeZone: TIMEZONE,
    hour: "numeric",
    minute: "2-digit"
  }).format(now);

  $("date").textContent = new Intl.DateTimeFormat("en-US", {
    timeZone: TIMEZONE,
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric"
  }).format(now);
}

function localDate(iso) {
  // Parse API local time without converting it to the tablet's timezone.
  return new Date(`${iso}-05:00`);
}

function shortTime(iso) {
  // Forecast timestamps are already in the requested local timezone.
  const hour = Number(iso.slice(11, 13));
  const suffix = hour < 12 ? "AM" : "PM";
  return `${hour % 12 || 12}${suffix}`;
}

function shortDay(iso, index) {
  if (index === 0) return "Today";
  if (index === 1) return "Tomorrow";
  return new Intl.DateTimeFormat("en-US", {
    timeZone: TIMEZONE,
    weekday: "short"
  }).format(new Date(`${iso}T12:00:00-04:00`));
}

function renderCurrent(data) {
  const c = data.current;
  const [description, icon] = condition(c.weather_code);

  $("location").textContent = "ALBANY, NEW YORK · 12206";
  $("greeting").textContent =
    new Date().toLocaleTimeString("en-US", {
      timeZone: TIMEZONE, hour: "numeric"
    }).includes("AM") ? "Good morning" : "Weather at home";

  $("temperature").textContent = temp(c.temperature_2m);
  $("condition").textContent = description;
  $("current-icon").textContent = icon;
  $("feels").textContent = `Feels like ${temp(c.apparent_temperature)}`;
  $("wind").textContent = `${number(c.wind_speed_10m)} mph`;
  $("wind-direction").textContent =
    `${number(c.wind_direction_10m)}° direction`;
  $("humidity").textContent = `${number(c.relative_humidity_2m)}%`;
  $("rain-now").textContent = rain(c.precipitation);
}

function renderHourly(data) {
  const h = data.hourly;
  const now = Date.now();
  const indexes = [];

  for (let i = 0; i < h.time.length; i++) {
    const timestamp = new Date(h.time[i]).getTime();
    if (timestamp >= now - 30 * 60 * 1000) indexes.push(i);
    if (indexes.length === 8) break;
  }

  $("hourly").innerHTML = indexes.map(i => {
    const [desc, icon] = condition(h.weather_code[i]);
    const amount = h.precipitation[i];
    const chance = h.precipitation_probability[i];
    const wet = (amount || 0) >= 0.005 || (chance || 0) >= 30;

    return `
      <div class="hour ${wet ? "wet" : ""}">
        <div class="time">${shortTime(h.time[i])}</div>
        <div class="icon" title="${desc}">${icon}</div>
        <div class="temp">${temp(h.temperature_2m[i])}</div>
        <div class="rain">${rain(amount)}</div>
        <div class="chance">${number(chance)}% chance</div>
      </div>`;
  }).join("");
}

function renderDaily(data) {
  const d = data.daily;
  $("daily").innerHTML = d.time.map((day, i) => {
    const [desc, icon] = condition(d.weather_code[i]);
    return `
      <div class="day">
        <div class="name">${shortDay(day, i)}</div>
        <div class="icon" title="${desc}">${icon}</div>
        <div class="high">${temp(d.temperature_2m_max[i])}</div>
        <div class="low">${temp(d.temperature_2m_min[i])}</div>
        <div class="rain">${rain(d.precipitation_sum[i])}</div>
        <div class="chance">${number(d.precipitation_probability_max[i])}% max</div>
      </div>`;
  }).join("");
}

async function loadWeather() {
  $("updated").textContent = "Updating forecast…";

  const params = new URLSearchParams({
    latitude: LAT,
    longitude: LON,
    timezone: TIMEZONE,
    temperature_unit: "fahrenheit",
    wind_speed_unit: "mph",
    precipitation_unit: "inch",
    forecast_days: "7",
    current: [
      "temperature_2m", "relative_humidity_2m",
      "apparent_temperature", "is_day", "precipitation",
      "weather_code", "wind_speed_10m", "wind_direction_10m"
    ].join(","),
    hourly: [
      "temperature_2m", "precipitation_probability",
      "precipitation", "weather_code", "wind_speed_10m"
    ].join(","),
    daily: [
      "weather_code", "temperature_2m_max", "temperature_2m_min",
      "precipitation_sum", "precipitation_probability_max"
    ].join(",")
  });

  try {
    const response = await fetch(
      `https://api.open-meteo.com/v1/forecast?${params}`
    );
    if (!response.ok) throw new Error(`Weather API: ${response.status}`);

    const data = await response.json();
    renderCurrent(data);
    renderHourly(data);
    renderDaily(data);

    $("updated").textContent =
      `Forecast updated ${new Intl.DateTimeFormat("en-US", {
        timeZone: TIMEZONE, hour: "numeric", minute: "2-digit"
      }).format(new Date())}`;
  } catch (error) {
    console.error(error);
    $("updated").textContent =
      "Weather unavailable. Check Wi-Fi and tap Refresh weather.";
  }
}

let radarMap;
let radarLayer;

async function loadRadar() {
  try {
    const response = await fetch(
      "https://api.rainviewer.com/public/weather-maps.json"
    );
    if (!response.ok) throw new Error("Radar metadata unavailable");

    const data = await response.json();
    const frames = data.radar?.past || [];
    if (!frames.length) throw new Error("No recent radar frames");

    const frame = frames[frames.length - 1];

    if (!radarMap && window.L) {
      radarMap = L.map("radar", {
        zoomControl: true,
        scrollWheelZoom: false
      }).setView([LAT, LON], 6);

      L.tileLayer(
        "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
        {
          maxZoom: 7,
          attribution: "© OpenStreetMap contributors"
        }
      ).addTo(radarMap);
    }

    if (!radarMap) throw new Error("Map library hasn't loaded");

    if (radarLayer) radarMap.removeLayer(radarLayer);

    const tileURL =
      `${data.host}${frame.path}/256/{z}/{x}/{y}/2/1_0.png`;

    radarLayer = L.tileLayer(tileURL, {
      opacity: 0.65,
      maxZoom: 7,
      attribution: "Radar © RainViewer"
    }).addTo(radarMap);

    $("updated").textContent += " · Radar refreshed";
  } catch (error) {
    console.error(error);
    if (!radarMap) {
      $("radar").innerHTML =
        '<div style="padding:18px;color:#a1b3ca">' +
        'Radar is temporarily unavailable. Weather forecasts can still work.' +
        '</div>';
    }
  }
}

clockTick();
setInterval(clockTick, 1000);

$("refresh").addEventListener("click", () => {
  loadWeather();
  loadRadar();
});

loadWeather();
loadRadar();
setInterval(loadWeather, 15 * 60 * 1000);
setInterval(loadRadar, 10 * 60 * 1000);
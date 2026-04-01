const player = document.getElementById("cxunoPlayer");
const btnPlayPause = document.getElementById("btnPlayPause");
const btnStop = document.getElementById("btnStop");
const equalizer = document.querySelector(".equalizer");
const background = document.querySelector(".background-image");
const liveStatusText = document.getElementById("liveStatusText");
const equalizerShowName = document.getElementById("equalizerShowName");
const currentShowTime = document.getElementById("currentShowTime");
const nextShowText = document.getElementById("nextShowText");
const contactForm = document.getElementById("contactForm");
const contactSubmit = document.getElementById("contactSubmit");
const contactStatus = document.getElementById("contactStatus");
const voiceForm = document.getElementById("voiceForm");
const voiceSubmit = document.getElementById("voiceSubmit");
const voiceStatus = document.getElementById("voiceStatus");
const menuItems = Array.from(document.querySelectorAll(".bottom-menu .menu-item"));
const pageSections = Array.from(document.querySelectorAll("[data-section]"));

const columns = Array.from(document.querySelectorAll(".column"));
const SPEED_FACTOR = 1.15; // +15% mas rapido
const BASE_STEP_MS = 160;
const STEP_MS = BASE_STEP_MS / SPEED_FACTOR;
const TOP_WHITE_BOOST = 0.20; // +20% de probabilidad para encender la punta blanca
const TOP_WHITE_NEAR_PEAK_LEVEL = 6.4;
const WEB3FORMS_ENDPOINT = "https://api.web3forms.com/submit";
const WEB3FORMS_ACCESS_KEY = "b88a1559-09a9-4c9a-946d-a1b7084e9ae3";
const DAY_KEYS = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];
const DAY_LABELS = {
  mon: "Lunes",
  tue: "Martes",
  wed: "Miercoles",
  thu: "Jueves",
  fri: "Viernes",
  sat: "Sabado",
  sun: "Domingo"
};
let equalizerIntervalId = null;
let currentLevels = [];
let targetLevels = [];
let scrollHideTimeoutId = null;

function parseMinutes(timeText) {
  const [hours, minutes] = timeText.split(":").map(Number);
  return (hours * 60) + minutes;
}

function createScheduleEntries(schedule) {
  if (!schedule || !Array.isArray(schedule.shows)) return [];

  return schedule.shows.flatMap((show) => {
    const startMinutes = parseMinutes(show.start);
    const endMinutes = parseMinutes(show.end);
    return show.days.map((dayKey) => ({
      ...show,
      dayKey,
      startMinutes,
      endMinutes
    }));
  });
}

function getDayKey(dayIndex) {
  return DAY_KEYS[dayIndex];
}

function getPreviousDayKey(dayKey) {
  const index = DAY_KEYS.indexOf(dayKey);
  return DAY_KEYS[(index + 6) % 7];
}

function isShowLive(show, nowDayKey, nowMinutes, previousDayKey) {
  if (show.overnight) {
    return (show.dayKey === nowDayKey && nowMinutes >= show.startMinutes)
      || (show.dayKey === previousDayKey && nowMinutes < show.endMinutes);
  }

  return show.dayKey === nowDayKey
    && nowMinutes >= show.startMinutes
    && nowMinutes < show.endMinutes;
}

function getOccurrenceStartOffset(show, nowDayIndex, nowMinutes) {
  const showDayIndex = DAY_KEYS.indexOf(show.dayKey);
  const showAbsolute = (showDayIndex * 1440) + show.startMinutes;
  const nowAbsolute = (nowDayIndex * 1440) + nowMinutes;
  let offset = showAbsolute - nowAbsolute;

  if (offset < 0) {
    offset += 7 * 1440;
  }

  return offset;
}

function formatTimeRange(show) {
  return `${show.start} - ${show.end}`;
}

function formatNextShow(show, offsetMinutes) {
  if (offsetMinutes < 1440) {
    return `Sigue: ${show.name} · ${formatTimeRange(show)}`;
  }

  return `Sigue: ${show.name} · ${DAY_LABELS[show.dayKey]} ${formatTimeRange(show)}`;
}

function updateScheduleDisplay() {
  const scheduleEntries = createScheduleEntries(window.RADIO_SCHEDULE);
  if (!scheduleEntries.length) return;

  const now = new Date();
  const nowDayKey = getDayKey(now.getDay());
  const previousDayKey = getPreviousDayKey(nowDayKey);
  const nowMinutes = (now.getHours() * 60) + now.getMinutes();
  const nowDayIndex = now.getDay();

  const currentShow = scheduleEntries.find((show) => isShowLive(show, nowDayKey, nowMinutes, previousDayKey));

  const nextShowCandidates = scheduleEntries
    .map((show) => ({
      show,
      offset: getOccurrenceStartOffset(show, nowDayIndex, nowMinutes)
    }))
    .filter(({ offset, show }) => !currentShow || offset > 0 || show.id !== currentShow.id)
    .sort((left, right) => left.offset - right.offset);

  const nextShow = nextShowCandidates[0];

  if (currentShow) {
    if (liveStatusText) liveStatusText.textContent = "EN VIVO";
    if (equalizerShowName) equalizerShowName.textContent = currentShow.name;
    if (currentShowTime) currentShowTime.textContent = formatTimeRange(currentShow);
  } else {
    if (liveStatusText) liveStatusText.textContent = "AUTOMATICA";
    if (equalizerShowName) equalizerShowName.textContent = "CXUNO Radio";
    if (currentShowTime) currentShowTime.textContent = "Sin programa en vivo en este momento";
  }

  if (nextShowText) {
    nextShowText.textContent = nextShow
      ? formatNextShow(nextShow.show, nextShow.offset)
      : "Sin proximos programas cargados";
  }
}

// Cambia el ícono del botón Play/Pause
function updateToggleButton(playing) {
  if (!btnPlayPause) return;
  btnPlayPause.textContent = playing ? "⏸" : "▶";
  btnPlayPause.classList.toggle("btn-play", !playing);
  btnPlayPause.classList.toggle("btn-pause", playing);
}

// Alterna entre reproducir y pausar
async function togglePlayPause() {
  if (!player) return;
  if (player.paused) {
    try {
      await player.play();
    } catch (error) {
      console.error("Error al reproducir:", error);
    }
  } else {
    player.pause();
  }
}

// Detiene completamente el stream
function stopRadio() {
  if (!player) return;
  player.pause();
  player.currentTime = 0;
  const currentSrc = player.src;
  player.src = "";
  player.src = currentSrc;
  updateToggleButton(false);
  hideEqualizer();
}

function applyColumnLevels() {
  columns.forEach((col, i) => {
    const spans = col.querySelectorAll("span");
    let visible = Math.max(0, Math.min(spans.length, Math.round(currentLevels[i] || 0)));

    // Mantiene el mismo patron base, pero hace que haya mas "picos" blancos
    // cuando una banda ya esta cerca del limite superior.
    if (
      visible >= spans.length - 1
      && (currentLevels[i] || 0) >= TOP_WHITE_NEAR_PEAK_LEVEL
      && Math.random() < TOP_WHITE_BOOST
    ) {
      visible = spans.length;
    }

    spans.forEach((span, idx) => {
      if (idx < visible) {
        span.classList.add("active");
      } else {
        span.classList.remove("active");
      }
    });
  });
}

function stepEqualizer() {
  if (!columns.length) return;

  // Cambios graduales por columna para un movimiento mas organico.
  targetLevels = targetLevels.map((target, i) => {
    if (Math.random() < 0.38) {
      const bandBias = Math.sin((Date.now() / 220) + i * 0.45) * 1.6;
      const randomKick = Math.floor(Math.random() * 7);
      return Math.max(1, Math.min(8, Math.round(3 + bandBias + randomKick / 2)));
    }
    return target;
  });

  currentLevels = currentLevels.map((current, i) => {
    const next = current + (targetLevels[i] - current) * 0.42;
    return Math.max(0, Math.min(8, next));
  });

  applyColumnLevels();
}

// Animacion del ecualizador fragmentado
function animateEqualizer() {
  if (!columns.length || equalizerIntervalId !== null) return;

  currentLevels = columns.map(() => 0);
  targetLevels = columns.map((_, i) => 2 + (i % 3));
  equalizerIntervalId = setInterval(stepEqualizer, STEP_MS);
}

function stopEqualizerAnimation() {
  if (equalizerIntervalId !== null) {
    clearInterval(equalizerIntervalId);
    equalizerIntervalId = null;
  }
}

// Muestra el ecualizador y oculta el fondo
function showEqualizer() {
  animateEqualizer();
  if (equalizer) {
    equalizer.classList.remove("stopped");
  }
  if (background) {
    background.style.opacity = 0; // oculta fondo al reproducir
  }
}

function hideEqualizer() {
  stopEqualizerAnimation();
  const spans = document.querySelectorAll(".column span");
  spans.forEach(s => s.classList.remove("active"));
  if (equalizer) {
    equalizer.classList.add("stopped");
  }
  if (background) {
    background.style.opacity = 0.4; // reaparece fondo al pausar/detener
  }
}

function setActiveMenuItem(targetId) {
  if (!targetId) return;

  menuItems.forEach((item) => {
    const isActive = item.dataset.target === targetId;
    item.classList.toggle("active", isActive);
    item.setAttribute("aria-current", isActive ? "page" : "false");
  });
}

function scrollToSection(targetId) {
  const section = document.getElementById(targetId);
  if (!section) return;

  section.scrollIntoView({ behavior: "smooth", block: "start" });
  setActiveMenuItem(targetId);
}

function bindMenuAnchors() {
  if (!menuItems.length) return;

  menuItems.forEach((item) => {
    item.addEventListener("click", (event) => {
      const targetId = item.dataset.target;
      if (!targetId) return;
      event.preventDefault();
      scrollToSection(targetId);
    });
  });
}

function watchSectionsForMenuState() {
  if (!pageSections.length || !menuItems.length || !("IntersectionObserver" in window)) {
    return;
  }

  const observer = new IntersectionObserver(
    (entries) => {
      entries
        .filter((entry) => entry.isIntersecting)
        .sort((a, b) => b.intersectionRatio - a.intersectionRatio)
        .slice(0, 1)
        .forEach((entry) => setActiveMenuItem(entry.target.id));
    },
    { threshold: [0.35, 0.55, 0.75] }
  );

  pageSections.forEach((section) => observer.observe(section));
}

function showScrollbarWhileScrolling() {
  document.body.classList.add("scrolling");
  if (scrollHideTimeoutId) {
    clearTimeout(scrollHideTimeoutId);
  }

  scrollHideTimeoutId = setTimeout(() => {
    document.body.classList.remove("scrolling");
  }, 650);
}

function bindScrollIndicator() {
  window.addEventListener("scroll", showScrollbarWhileScrolling, { passive: true });
  window.addEventListener("wheel", showScrollbarWhileScrolling, { passive: true });
  window.addEventListener("touchmove", showScrollbarWhileScrolling, { passive: true });
}

function setContactStatus(message, type = "") {
  if (!contactStatus) return;
  contactStatus.textContent = message;
  contactStatus.classList.remove("is-success", "is-error");
  if (type) {
    contactStatus.classList.add(type);
  }
}

async function submitWeb3Form(formEl, submitEl, statusEl, successMessage, errorMessage) {
  if (!formEl) return;

  if (!formEl.reportValidity()) {
    return;
  }

  const formData = new FormData(formEl);
  if (formData.get("botcheck")) {
    return;
  }

  if (WEB3FORMS_ACCESS_KEY === "REEMPLAZAR_CON_TU_ACCESS_KEY_WEB3FORMS") {
    setContactStatus("Falta configurar la access key de Web3Forms. Pega la key y reintentá.", "is-error");
    return;
  }

  formData.set("access_key", WEB3FORMS_ACCESS_KEY);

  if (submitEl) {
    submitEl.disabled = true;
  }

  if (statusEl) {
    statusEl.textContent = "Enviando mensaje...";
    statusEl.classList.remove("is-success", "is-error");
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 14000);

  try {
    const response = await fetch(WEB3FORMS_ENDPOINT, {
      method: "POST",
      body: formData,
      signal: controller.signal
    });

    const result = await response.json();
    if (!response.ok || !result.success) {
      throw new Error(result.message || "No se pudo enviar el mensaje.");
    }

    if (statusEl) {
      statusEl.textContent = successMessage;
      statusEl.classList.remove("is-error");
      statusEl.classList.add("is-success");
    }
    formEl.reset();
  } catch (error) {
    console.error("Error al enviar formulario:", error);
    if (statusEl) {
      statusEl.textContent = errorMessage;
      statusEl.classList.remove("is-success");
      statusEl.classList.add("is-error");
    }
  } finally {
    clearTimeout(timeoutId);
    if (submitEl) {
      submitEl.disabled = false;
    }
  }
}

async function submitContactForm(event) {
  event.preventDefault();
  await submitWeb3Form(
    contactForm,
    contactSubmit,
    contactStatus,
    "Mensaje enviado correctamente.",
    "No pudimos enviar el mensaje. Probá nuevamente en unos instantes."
  );
}

async function submitVoiceForm(event) {
  event.preventDefault();
  await submitWeb3Form(
    voiceForm,
    voiceSubmit,
    voiceStatus,
    "Gracias por compartir tu opinión. Tu mensaje fue recibido correctamente.",
    "No pudimos enviar tu opinión en este momento. Probá nuevamente en unos instantes."
  );
}

function bindContactForm() {
  if (!contactForm) return;
  contactForm.addEventListener("submit", submitContactForm);
}

function bindVoiceForm() {
  if (!voiceForm) return;
  voiceForm.addEventListener("submit", submitVoiceForm);
}


// Eventos del reproductor
if (player) {
  player.addEventListener("playing", () => {
    updateToggleButton(true);
    showEqualizer();
  });

  player.addEventListener("pause", () => {
    updateToggleButton(false);
    hideEqualizer();
  });

  player.addEventListener("ended", () => {
    updateToggleButton(false);
    hideEqualizer();
  });
}

// Eventos de botones
if (btnPlayPause) {
  btnPlayPause.addEventListener("click", togglePlayPause);
}

if (btnStop) {
  btnStop.addEventListener("click", stopRadio);
}

bindMenuAnchors();
watchSectionsForMenuState();
bindScrollIndicator();
bindContactForm();
bindVoiceForm();
setActiveMenuItem("inicio");

updateScheduleDisplay();
setInterval(updateScheduleDisplay, 60000);



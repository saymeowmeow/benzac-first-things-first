const state = {
  stream: null,
  facing: "user",
  patchSize: 58,
  patch: { x: 50, y: 34 },
  dragging: false,
  question: 0,
  answers: { concern: null, spread: null, feel: null, pattern: null },
};

const $ = (selector) => document.querySelector(selector);
const screens = ["intro", "camera-screen", "question-screen", "outcome-screen"];

function showScreen(id) {
  screens.forEach((screen) => document.getElementById(screen).classList.toggle("active", screen === id));
}

function stopCamera() {
  state.stream?.getTracks().forEach((track) => track.stop());
  state.stream = null;
  $("#camera").srcObject = null;
}

async function startCamera(mode = state.facing) {
  const error = $("#camera-error");
  error.classList.remove("active");
  stopCamera();
  if (!navigator.mediaDevices?.getUserMedia) {
    error.querySelector("p").textContent = "Camera access is not supported in this browser.";
    error.classList.add("active");
    return;
  }
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: mode }, width: { ideal: 1080 }, height: { ideal: 1440 } }, audio: false });
    state.stream = stream;
    const video = $("#camera");
    video.srcObject = stream;
    await video.play();
    video.classList.toggle("mirrored", mode === "user");
    showScreen("camera-screen");
  } catch {
    error.querySelector("p").textContent = "Camera permission was not granted. Allow camera access and try again.";
    error.classList.add("active");
  }
}

function setPatch(x, y) {
  state.patch = { x, y };
  const patch = $("#patch");
  patch.style.left = `${x}%`;
  patch.style.top = `${y}%`;
  patch.style.width = `${state.patchSize}px`;
  patch.style.height = `${state.patchSize}px`;
}

function movePatch(clientX, clientY) {
  const stage = $("#stage");
  const rect = stage.getBoundingClientRect();
  const pad = (state.patchSize / 2 / rect.width) * 100;
  const x = Math.min(100 - pad, Math.max(pad, ((clientX - rect.left) / rect.width) * 100));
  const y = Math.min(100 - pad, Math.max(pad, ((clientY - rect.top) / rect.height) * 100));
  setPatch(x, y);
}

const questions = [
  {
    label: "What looks closest?",
    key: "concern",
    grid: true,
    options: [
      ["emerging", "New raised spot"], ["blocked", "Whitehead or blackhead"],
      ["multiple", "Several red pimples"], ["deep", "Deep or painful bump"],
      ["marks", "Flat marks after pimples"], ["rash", "Itchy or rash-like area"],
      ["unsure", "I'm not sure"],
    ],
  },
  {
    label: "How much skin is affected?",
    key: "spread",
    options: [
      ["one", "One spot", "A single visible concern"], ["few", "A few spots", "A small cluster or scattered spots"],
      ["many", "Many or widespread", "Across a larger part of the face"],
    ],
  },
  {
    label: "How does it feel?",
    key: "feel",
    options: [
      ["calm", "Not painful or itchy", "Mainly visible rather than uncomfortable"],
      ["tender", "Slightly tender", "A little sensitive when touched"],
      ["deep", "Deep or painful", "Feels under the skin or hurts without touching"],
      ["itchy", "Itchy, burning or rapidly irritated", "May not behave like an ordinary pimple"],
    ],
  },
  {
    label: "Which describes the pattern?",
    key: "pattern",
    options: [
      ["first", "First or occasional", "New to me or happens rarely"],
      ["recurring", "Keeps returning", "Comes back in the same or new areas"],
      ["persistent", "Has not settled", "Persistent, worsening or leaving scars"],
    ],
  },
];

function renderQuestion() {
  const q = questions[state.question];
  $("#progress").style.width = `${((state.question + 1) / questions.length) * 100}%`;
  const buttons = q.options.map(([value, title, detail]) => `
    <button data-answer="${value}"><b>${title}</b>${detail ? `<span>${detail}</span>` : ""}</button>
  `).join("");
  $("#question-card").innerHTML = `
    <p>QUESTION ${state.question + 1} OF ${questions.length}</p>
    <h2>${q.label}</h2>
    <div class="${q.grid ? "answer-grid" : "answer-list"}">${buttons}</div>
    ${state.question ? '<button class="back-button" id="question-back">Back</button>' : ""}
  `;
  $("#question-card").querySelectorAll("[data-answer]").forEach((button) => button.addEventListener("click", () => {
    state.answers[q.key] = button.dataset.answer;
    if (state.question < questions.length - 1) {
      state.question += 1;
      renderQuestion();
    } else renderOutcome();
  }));
  $("#question-back")?.addEventListener("click", () => { state.question -= 1; renderQuestion(); });
}

const outcomes = {
  spot: {
    kicker: "LIKELY CONCERN PATTERN", title: "An emerging surface spot",
    body: "A single new raised spot is usually better protected than picked or squeezed.",
    recommendation: "Generic category: hydrocolloid pimple patches and similar products. Benzac option: [[Power Patch]] or [[Power Patch]] Skin Restore.",
    action: "Clean and dry the area, apply one patch as directed, then leave it undisturbed.", claim: true,
  },
  routine: {
    kicker: "LIKELY CONCERN PATTERN", title: "Mild recurring breakouts",
    body: "Several spots, blocked pores or repeat breakouts usually need a simple routine rather than only a spot fix.",
    recommendation: "Generic category: a salicylic-acid cleanser or gentle non-comedogenic cleanser and similar products. Benzac options: Foaming Cleanser (2% Salicylic Acid) or Bar for Acne (2% Salicylic Acid). Choose one cleanser, not both.",
    action: "Start one product at a time, follow its directions and stop if irritation develops.",
  },
  marks: {
    kicker: "LIKELY CONCERN PATTERN", title: "Post-pimple marks",
    body: "Flat marks left after a pimple are different from a new raised spot, so a hydrocolloid patch may not be the right match.",
    recommendation: "Generic categories: a gentle non-comedogenic cleanser and broad-spectrum sunscreen, or similar products. A hydrocolloid patch is not designed to remove a flat mark.",
    action: "Avoid picking and introduce new products slowly. Seek expert advice if marks persist or worsen.",
  },
  expert: {
    kicker: "SAFEST NEXT STEP", title: "Get an expert look",
    body: "Deep, painful, itchy, widespread, uncertain or persistent concerns can resemble acne but may need different care.",
    recommendation: "No product recommendation from this check. Speak to a dermatologist or pharmacist; involve a parent or guardian if you are under 18.",
    action: "Do not squeeze the area or combine multiple active products while you wait for advice.",
  },
};

function outcomeKey() {
  const { concern, spread, feel, pattern } = state.answers;
  if (["deep", "rash", "unsure"].includes(concern) || spread === "many" || ["deep", "itchy"].includes(feel) || pattern === "persistent") return "expert";
  if (concern === "marks") return "marks";
  if (concern === "emerging" && spread === "one") return "spot";
  return "routine";
}

function highlight(text) {
  return text.replaceAll("[[Power Patch]]", '<mark>Power Patch</mark>');
}

function renderOutcome() {
  const key = outcomeKey();
  const o = outcomes[key];
  $("#outcome-card").className = `outcome-card outcome-${key}`;
  $("#outcome-card").innerHTML = `
    <p class="result-kicker">${o.kicker}</p><h2>${o.title}</h2><p class="outcome-body">${o.body}</p>
    <div class="recommendation-box"><span>SUGGESTED NEXT OPTION</span><strong>${highlight(o.recommendation)}</strong></div>
    <p class="next-action">${o.action}</p>
    ${o.claim ? '<p class="claim">Benzac <mark>Power Patch</mark> targets emerging spots in <strong>6 hours*</strong></p>' : ""}
    <p class="diagnostic-note">This is a pattern-based product guide, not a medical diagnosis.</p>
    <div class="result-actions"><button id="share">Share experience</button>${key !== "expert" ? '<a href="#product">See suggested products</a>' : ""}</div>
    <button class="retry-button" id="retry-check">↻ Retry skin check</button><small class="delete-note">Your current answers are discarded.</small>
  `;
  showScreen("outcome-screen");
  $("#retry-check").addEventListener("click", resetCheck);
  $("#share").addEventListener("click", shareExperience);
}

function resetCheck() {
  stopCamera();
  state.question = 0;
  state.answers = { concern: null, spread: null, feel: null, pattern: null };
  showScreen("intro");
}

async function shareExperience() {
  const data = { title: "First Things First - Benzac", text: "Pause before you pick. Try the private first-acne product guide.", url: location.href.split("#")[0] };
  if (navigator.share) await navigator.share(data);
  else if (navigator.clipboard) await navigator.clipboard.writeText(data.url);
}

$("#start-camera").addEventListener("click", () => startCamera());
$("#retry-camera").addEventListener("click", () => startCamera());
$("#flip-camera").addEventListener("click", async () => { state.facing = state.facing === "user" ? "environment" : "user"; await startCamera(state.facing); });
$("#identify").addEventListener("click", () => { stopCamera(); state.question = 0; renderQuestion(); showScreen("question-screen"); });
document.querySelectorAll("[data-pos]").forEach((button) => button.addEventListener("click", () => { const [x, y] = button.dataset.pos.split(",").map(Number); setPatch(x, y); }));
document.querySelectorAll("[data-size]").forEach((button) => button.addEventListener("click", () => { state.patchSize = Number(button.dataset.size); document.querySelectorAll("[data-size]").forEach((b) => b.classList.toggle("active", b === button)); setPatch(state.patch.x, state.patch.y); }));

const patch = $("#patch");
patch.addEventListener("pointerdown", (event) => { state.dragging = true; patch.setPointerCapture(event.pointerId); movePatch(event.clientX, event.clientY); });
$("#stage").addEventListener("pointermove", (event) => { if (state.dragging) movePatch(event.clientX, event.clientY); });
$("#stage").addEventListener("pointerup", () => { state.dragging = false; });
$("#stage").addEventListener("pointercancel", () => { state.dragging = false; });
window.addEventListener("pagehide", stopCamera);
setPatch(50, 34);

if (!API.isLoggedIn()) location.href = "login.html";
const $ = (id) => document.getElementById(id);
const tripForm = $("tripForm");
const toast = $("toast");
let activeTrip = null;
let contacts = [];
let lastCoords = null;
let toastTimer;

function notify(message) {
  toast.textContent = message;
  toast.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove("show"), 3000);
}
function localDateString(date = new Date()) {
  const offset = date.getTimezoneOffset();
  return new Date(date.getTime() - offset * 60000).toISOString().slice(0, 10);
}
$("departureDate").value = localDateString();
$("departureTime").value = new Date().toTimeString().slice(0, 5);

function chosenTransport() {
  return document.querySelector('input[name="transport"]:checked').value;
}
function updateTransportFields() {
  const type = chosenTransport();
  $("publicFields").classList.toggle("hidden", type !== "Public transport");
  $("ownFields").classList.toggle("hidden", type !== "Own vehicle");
  $("otherFields").classList.toggle("hidden", type !== "Other");
  $("publicType").required = type === "Public transport";
  $("ownType").required = type === "Own vehicle";
}
document.querySelectorAll('input[name="transport"]').forEach(radio => radio.addEventListener("change", updateTransportFields));
updateTransportFields();

function getTripFromForm() {
  const type = chosenTransport();
  let transportDetails = type;
  if (type === "Public transport") {
    transportDetails = $("publicType").value + ($("publicVehicle").value.trim() ? " · Vehicle: " + $("publicVehicle").value.trim() : "");
  } else if (type === "Own vehicle") {
    transportDetails = $("ownType").value + ($("ownVehicle").value.trim() ? " · Reg: " + $("ownVehicle").value.trim() : "");
  } else if (type === "Other") {
    transportDetails = $("otherType").value.trim() || "Other";
  }
  return {
    start: $("startLocation").value.trim(),
    destination: $("destination").value.trim(),
    date: $("departureDate").value,
    departure: $("departureTime").value,
    arrival: $("arrivalTime").value,
    transport: type,
    transportDetails,
    savedAt: new Date().toISOString()
  };
}
function formatDate(date) {
  if (!date) return "Not specified";
  return new Date(date + "T12:00:00").toLocaleDateString(undefined, {day:"numeric", month:"short", year:"numeric"});
}
function renderTrip() {
  const container = $("journeySummary");
  if (!activeTrip) {
    container.innerHTML = '<div class="journey-empty"><span>⌖</span><b>No active trip yet</b><small>Save your trip details to see your journey here.</small></div>';
    $("shareTrip").disabled = true;
    return;
  }
  const t = activeTrip;
  container.innerHTML = `
    <div class="journey-data">
      <div class="journey-route"><small>STARTING POINT · ${escapeHtml(t.departure)}</small><b>${escapeHtml(t.start)}</b></div>
      <div class="journey-route destination-route"><small>DESTINATION · ${escapeHtml(t.arrival || "Arrival time not set")}</small><b>${escapeHtml(t.destination)}</b></div>
      <div class="journey-detail"><span>Travel date</span><b>${escapeHtml(formatDate(t.date))}</b></div>
      <div class="journey-detail"><span>Transport</span><b>${escapeHtml(t.transportDetails)}</b></div>
      <div class="journey-detail"><span>Last updated</span><b>${escapeHtml(new Date(t.savedAt).toLocaleTimeString([], {hour:"2-digit",minute:"2-digit"}))}</b></div>
    </div>`;
  $("shareTrip").disabled = false;
}
function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, ch => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[ch]));
}
tripForm.addEventListener("submit", async event => {
  event.preventDefault();
  try {
    const { trip } = await API.saveTrip(getTripFromForm());
    activeTrip = trip;
    renderTrip();
    notify("Trip saved. Your trusted contacts can follow it with your share link.");
    $("journeySummary").scrollIntoView({behavior:"smooth", block:"nearest"});
  } catch (err) { notify(err.message); }
});

$("useLocation").addEventListener("click", () => {
  if (!navigator.geolocation) {
    $("locationStatus").textContent = "This browser does not support location access.";
    return;
  }
  $("locationStatus").textContent = "Requesting permission for your location…";
  navigator.geolocation.getCurrentPosition(position => {
    lastCoords = { latitude: position.coords.latitude, longitude: position.coords.longitude, recordedAt: new Date() };
    const coordsText = `${lastCoords.latitude.toFixed(5)}, ${lastCoords.longitude.toFixed(5)}`;
    $("startLocation").value = `GPS: ${coordsText}`;
    $("lastLocation").textContent = `${coordsText} · ${lastCoords.recordedAt.toLocaleTimeString([], {hour:"2-digit",minute:"2-digit"})}`;
    $("locationStatus").textContent = "Last known coordinates recorded. A map address lookup is not configured.";
    API.sendLocation({ latitude: lastCoords.latitude, longitude: lastCoords.longitude, accuracy: position.coords.accuracy })
      .then(() => notify("Location recorded."))
      .catch(err => notify(err.message));
  }, error => {
    const messages = {
      1: "Location permission was denied. You can type your starting point instead.",
      2: "Your location is currently unavailable. Please type your starting point.",
      3: "Location request timed out. Please try again or type your starting point."
    };
    $("locationStatus").textContent = messages[error.code] || "Could not get your location. Please type it instead.";
  }, {enableHighAccuracy:true, timeout:10000, maximumAge:60000});
});

$("saveContact").addEventListener("click", async () => {
  const name = $("contactName").value.trim();
  const phone = $("contactPhone").value.trim();
  if (!name || !phone) {
    notify("Enter a contact name and phone number first.");
    return;
  }
  if (!/^[+()\d\s.-]{7,25}$/.test(phone)) {
    notify("Please check the phone number format.");
    return;
  }
  try {
    const { contact } = await API.addContact(name, phone);
    contacts.push(contact);
  } catch (err) { notify(err.message); return; }
  $("contactName").value = "";
  $("contactPhone").value = "";
  renderContacts();
  notify("Trusted contact added.");
});
function renderContacts() {
  const list = $("contactList");
  if (!contacts.length) {
    list.innerHTML = '<div class="empty-contacts">No contacts added yet. Add someone you trust.</div>';
    return;
  }
  list.innerHTML = contacts.map((c, i) => `
    <div class="contact-item">
      <div class="contact-avatar">${escapeHtml(c.name.charAt(0).toUpperCase())}</div>
      <div class="contact-meta"><b>${escapeHtml(c.name)}</b><small>${escapeHtml(c.phone)}</small></div>
      <button class="remove-contact" type="button" data-remove="${i}" aria-label="Remove ${escapeHtml(c.name)}">Remove</button>
    </div>`).join("");
  list.querySelectorAll("[data-remove]").forEach(button => button.addEventListener("click", async () => {
    const index = Number(button.dataset.remove);
    try {
      await API.removeContact(contacts[index].id);
      contacts.splice(index, 1);
      renderContacts();
    } catch (err) { notify(err.message); }
  }));
}

function buildTripMessage(prefix = "My travel details") {
  if (!activeTrip) return "I am using NightGuard. Please check in with me.";
  const link = activeTrip.shareUrl ? `\nFollow my trip: ${activeTrip.shareUrl}` : "";
  return `${prefix} — NightGuard\nStarting location: ${activeTrip.start}\nDestination: ${activeTrip.destination}\nDeparture: ${formatDate(activeTrip.date)} at ${activeTrip.departure}\nExpected arrival: ${activeTrip.arrival || "Not specified"}\nTransport: ${activeTrip.transportDetails}\n${lastCoords ? `Last known coordinates: ${lastCoords.latitude}, ${lastCoords.longitude}\n` : ""}Please check in with me.${link}`;
}
async function shareText(message) {
  if (navigator.share) {
    try { await navigator.share({title:"NightGuard travel details", text:message}); return true; }
    catch (error) { if (error.name === "AbortError") return false; }
  }
  try {
    await navigator.clipboard.writeText(message);
    notify("Details copied. Paste them into a message to your trusted contact.");
    return true;
  } catch {
    window.prompt("Copy these details and send them to your trusted contact:", message);
    return false;
  }
}
$("shareTrip").addEventListener("click", () => {
  if (activeTrip) shareText(buildTripMessage("My planned journey"));
});

const sosButton = $("sosButton");
let holdTimer = null;
let holdTriggered = false;
function startHold(event) {
  if (event.type === "keydown" && ![" ", "Enter"].includes(event.key)) return;
  if (event.type === "keydown" && event.repeat) return;
  event.preventDefault();
  holdTriggered = false;
  sosButton.classList.add("holding");
  $("sosStatus").textContent = "Keep holding…";
  holdTimer = setTimeout(async () => {
    holdTriggered = true;
    sosButton.classList.remove("holding");
    $("sosStatus").textContent = "SOS message prepared. Choose a way to send it.";
    const recipients = contacts.map(c => c.phone).join(",");
    const message = buildTripMessage("SOS — I may need help. Please contact me now");
    // Log on the server and (if SMS is configured) text trusted contacts automatically.
    try {
      const r = await API.sos({ message, latitude: lastCoords && lastCoords.latitude, longitude: lastCoords && lastCoords.longitude });
      if (r.smsSent > 0) {
        $("sosStatus").textContent = `SOS sent to ${r.smsSent} trusted contact(s).`;
        notify("SOS alert sent. If you are in danger, also call your local emergency number (112 in India).");
        return;
      }
    } catch (err) { notify("Could not reach the server: " + err.message); }
    // Opens the user's own messaging app; it does not send automatically.
    if (recipients) {
      const smsUrl = `sms:${encodeURIComponent(recipients)}?body=${encodeURIComponent(message)}`;
      window.location.href = smsUrl;
    } else {
      await shareText(message);
    }
    notify("Emergency message prepared. Confirm sending in your messaging app.");
  }, 1300);
}
function cancelHold() {
  clearTimeout(holdTimer);
  sosButton.classList.remove("holding");
  if (!holdTriggered) $("sosStatus").textContent = "Press and hold for 1.3 seconds to prepare an alert.";
}
sosButton.addEventListener("pointerdown", startHold);
sosButton.addEventListener("pointerup", cancelHold);
sosButton.addEventListener("pointerleave", cancelHold);
sosButton.addEventListener("pointercancel", cancelHold);
sosButton.addEventListener("keydown", startHold);
sosButton.addEventListener("keyup", cancelHold);
sosButton.addEventListener("contextmenu", e => e.preventDefault());

// This prototype intentionally does not store contacts or location on a server.
// It also does not pretend to track a powered-off phone.
renderTrip();
renderContacts();
(async () => {
  try {
    const [t, c, l] = await Promise.all([API.activeTrip(), API.contacts(), API.lastLocation()]);
    activeTrip = t.trip; contacts = c.contacts;
    if (l.location) {
      lastCoords = l.location;
      $("lastLocation").textContent = `${l.location.latitude.toFixed(5)}, ${l.location.longitude.toFixed(5)} · ${new Date(l.location.recordedAt).toLocaleTimeString([], {hour:"2-digit",minute:"2-digit"})}`;
    }
    renderTrip(); renderContacts();
  } catch (err) { if (!API.isLoggedIn()) location.href = "login.html"; }
})();

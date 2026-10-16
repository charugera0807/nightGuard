const router = require("express").Router();
const db = require("../db");
const { requireAuth } = require("../auth");
const { sendSms } = require("../sms");

router.use(requireAuth);

// Logs the SOS and, if Twilio is configured, texts every trusted contact.
router.post("/", async (req, res) => {
  const message = String(req.body.message || "").trim().slice(0, 1000);
  if (!message) return res.status(400).json({ error: "Message is required." });
  const lat = Number(req.body.latitude), lng = Number(req.body.longitude);
  const hasCoords = req.body.latitude != null && Number.isFinite(lat) && Number.isFinite(lng);

  const trip = db.prepare("SELECT id, share_token FROM trips WHERE user_id = ? AND status = 'active' ORDER BY id DESC LIMIT 1").get(req.userId);
  const contacts = db.prepare("SELECT name, phone FROM contacts WHERE user_id = ?").all(req.userId);

  const link = trip ? `\nLive trip: ${process.env.PUBLIC_URL || ""}/share.html?t=${trip.share_token}` : "";
  const maps = hasCoords ? `\nMap: https://maps.google.com/?q=${lat},${lng}` : "";
  const body = message + maps + link;

  let sent = 0;
  for (const c of contacts) {
    try { if (await sendSms(c.phone, body)) sent++; } catch (e) { console.error("SMS failed:", e.message); }
  }

  db.prepare("INSERT INTO sos_events (user_id, trip_id, message, latitude, longitude, sms_sent) VALUES (?, ?, ?, ?, ?, ?)")
    .run(req.userId, trip ? trip.id : null, message, hasCoords ? lat : null, hasCoords ? lng : null, sent);

  res.status(201).json({ ok: true, contacts: contacts.length, smsSent: sent, smsEnabled: !!process.env.TWILIO_ACCOUNT_SID });
});

module.exports = router;

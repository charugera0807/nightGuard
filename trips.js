const router = require("express").Router();
const crypto = require("crypto");
const db = require("../db");
const { requireAuth } = require("../auth");

router.use(requireAuth);

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;
const TRANSPORTS = ["Public transport", "Own vehicle", "Walking", "Other"];

const shape = (t) => t && {
  id: t.id, start: t.start, destination: t.destination, date: t.date,
  departure: t.departure, arrival: t.arrival || "", transport: t.transport,
  transportDetails: t.transport_details, status: t.status, savedAt: t.saved_at + "Z",
  shareToken: t.share_token,
  shareUrl: `${process.env.PUBLIC_URL || ""}/share.html?t=${t.share_token}`
};

// Create a trip (replaces any previously active trip)
router.post("/", (req, res) => {
  const b = req.body;
  const trip = {
    start: String(b.start || "").trim().slice(0, 200),
    destination: String(b.destination || "").trim().slice(0, 200),
    date: String(b.date || ""),
    departure: String(b.departure || ""),
    arrival: String(b.arrival || ""),
    transport: String(b.transport || ""),
    transportDetails: String(b.transportDetails || "").trim().slice(0, 200)
  };
  if (!trip.start || !trip.destination) return res.status(400).json({ error: "Start and destination are required." });
  if (!DATE_RE.test(trip.date) || !TIME_RE.test(trip.departure)) return res.status(400).json({ error: "Valid date and departure time are required." });
  if (trip.arrival && !TIME_RE.test(trip.arrival)) return res.status(400).json({ error: "Invalid arrival time." });
  if (!TRANSPORTS.includes(trip.transport)) return res.status(400).json({ error: "Invalid transport type." });

  const create = db.transaction(() => {
    db.prepare("UPDATE trips SET status = 'completed' WHERE user_id = ? AND status = 'active'").run(req.userId);
    const info = db.prepare(`INSERT INTO trips
      (user_id, start, destination, date, departure, arrival, transport, transport_details, share_token)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`)
      .run(req.userId, trip.start, trip.destination, trip.date, trip.departure,
           trip.arrival || null, trip.transport, trip.transportDetails || trip.transport,
           crypto.randomBytes(16).toString("hex"));
    return db.prepare("SELECT * FROM trips WHERE id = ?").get(info.lastInsertRowid);
  });
  res.status(201).json({ trip: shape(create()) });
});

router.get("/active", (req, res) => {
  const t = db.prepare("SELECT * FROM trips WHERE user_id = ? AND status = 'active' ORDER BY id DESC LIMIT 1").get(req.userId);
  res.json({ trip: shape(t) || null });
});

router.get("/", (req, res) => {
  const rows = db.prepare("SELECT * FROM trips WHERE user_id = ? ORDER BY id DESC LIMIT 50").all(req.userId);
  res.json({ trips: rows.map(shape) });
});

// Record a location ping (client sends coordinates from the browser's geolocation)
router.post("/location", (req, res) => {
  const lat = Number(req.body.latitude), lng = Number(req.body.longitude);
  const acc = req.body.accuracy == null ? null : Number(req.body.accuracy);
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180)
    return res.status(400).json({ error: "Invalid coordinates." });

  const trip = db.prepare("SELECT id FROM trips WHERE user_id = ? AND status = 'active' ORDER BY id DESC LIMIT 1").get(req.userId);
  const info = db.prepare("INSERT INTO locations (user_id, trip_id, latitude, longitude, accuracy) VALUES (?, ?, ?, ?, ?)")
    .run(req.userId, trip ? trip.id : null, lat, lng, Number.isFinite(acc) ? acc : null);
  res.status(201).json({ id: info.lastInsertRowid, recordedAt: new Date().toISOString() });
});

router.get("/location/last", (req, res) => {
  const row = db.prepare("SELECT latitude, longitude, accuracy, recorded_at FROM locations WHERE user_id = ? ORDER BY id DESC LIMIT 1").get(req.userId);
  res.json({ location: row ? { latitude: row.latitude, longitude: row.longitude, accuracy: row.accuracy, recordedAt: row.recorded_at + "Z" } : null });
});

router.post("/:id/complete", (req, res) => {
  const info = db.prepare("UPDATE trips SET status = 'completed' WHERE id = ? AND user_id = ?").run(req.params.id, req.userId);
  if (!info.changes) return res.status(404).json({ error: "Trip not found." });
  res.json({ ok: true });
});

module.exports = router;

const router = require("express").Router();
const db = require("../db");

// Public, read-only view for trusted contacts. Token is unguessable; no phone numbers or email exposed.
router.get("/:token", (req, res) => {
  const t = db.prepare(`SELECT t.*, u.name AS owner FROM trips t JOIN users u ON u.id = t.user_id WHERE t.share_token = ?`).get(req.params.token);
  if (!t) return res.status(404).json({ error: "Trip not found." });

  const loc = t.status === "active"
    ? db.prepare("SELECT latitude, longitude, recorded_at FROM locations WHERE trip_id = ? ORDER BY id DESC LIMIT 1").get(t.id)
    : null;

  res.json({
    owner: t.owner.split(" ")[0],
    status: t.status,
    start: t.start, destination: t.destination, date: t.date,
    departure: t.departure, arrival: t.arrival || "", transportDetails: t.transport_details,
    lastLocation: loc ? { latitude: loc.latitude, longitude: loc.longitude, recordedAt: loc.recorded_at + "Z" } : null
  });
});

module.exports = router;

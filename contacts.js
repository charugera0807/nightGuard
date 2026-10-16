const router = require("express").Router();
const db = require("../db");
const { requireAuth } = require("../auth");

const PHONE_RE = /^[+()\d\s.-]{7,25}$/;
router.use(requireAuth);

router.get("/", (req, res) => {
  res.json({ contacts: db.prepare("SELECT id, name, phone FROM contacts WHERE user_id = ? ORDER BY id").all(req.userId) });
});

router.post("/", (req, res) => {
  const name = String(req.body.name || "").trim().slice(0, 80);
  const phone = String(req.body.phone || "").trim();
  if (!name || !phone) return res.status(400).json({ error: "Name and phone number are required." });
  if (!PHONE_RE.test(phone)) return res.status(400).json({ error: "Please check the phone number format." });

  const count = db.prepare("SELECT COUNT(*) c FROM contacts WHERE user_id = ?").get(req.userId).c;
  if (count >= 10) return res.status(400).json({ error: "You can save up to 10 trusted contacts." });

  const info = db.prepare("INSERT INTO contacts (user_id, name, phone) VALUES (?, ?, ?)").run(req.userId, name, phone);
  res.status(201).json({ contact: { id: info.lastInsertRowid, name, phone } });
});

router.delete("/:id", (req, res) => {
  const info = db.prepare("DELETE FROM contacts WHERE id = ? AND user_id = ?").run(req.params.id, req.userId);
  if (!info.changes) return res.status(404).json({ error: "Contact not found." });
  res.json({ ok: true });
});

module.exports = router;

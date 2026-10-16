require("dotenv").config();
const path = require("path");
const express = require("express");
const helmet = require("helmet");
const cors = require("cors");
const rateLimit = require("express-rate-limit");

if (!process.env.JWT_SECRET || process.env.JWT_SECRET === "change-me") {
  console.error("Set a strong JWT_SECRET in your .env file.");
  process.exit(1);
}

require("./db"); // initialise schema

const app = express();
app.set("trust proxy", 1);
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
      fontSrc: ["'self'", "https://fonts.gstatic.com"],
      imgSrc: ["'self'", "data:"]
    }
  }
}));
const origins = (process.env.CORS_ORIGIN || "").split(",").map(s => s.trim()).filter(Boolean);
if (origins.length) app.use(cors({ origin: origins }));
app.use(express.json({ limit: "10kb" }));

app.use("/api", rateLimit({ windowMs: 15 * 60 * 1000, limit: 300, standardHeaders: true, legacyHeaders: false }));
app.use("/api/auth", rateLimit({ windowMs: 15 * 60 * 1000, limit: 20, standardHeaders: true, legacyHeaders: false }));

app.get("/api/health", (_req, res) => res.json({ ok: true }));
app.use("/api/auth", require("./routes/auth"));
app.use("/api/trips", require("./routes/trips"));
app.use("/api/contacts", require("./routes/contacts"));
app.use("/api/sos", require("./routes/sos"));
app.use("/api/share", require("./routes/share"));

// Serve the frontend from /public
app.use(express.static(path.join(__dirname, "..", "public")));

app.use("/api", (_req, res) => res.status(404).json({ error: "Not found." }));
app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(err.status || 500).json({ error: err.status ? err.message : "Something went wrong." });
});

const port = process.env.PORT || 3000;
app.listen(port, () => console.log(`NightGuard running on http://localhost:${port}`));

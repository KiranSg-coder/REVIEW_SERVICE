require("dotenv").config();
const express = require("express");
const cors = require("cors");
const app = express();
const sequelizeConnection = require("./config/database");

const meRoutes = require("./routes/me.routes");
const publicRoutes = require("./routes/public.routes");
const internalRoutes = require("./routes/internal.routes");
const healthRoutes = require("./routes/health.routes");
const retentionRoutes = require("./routes/retention.routes");

/** Listen before DB sync so gateway never hangs on a dead port during boot. */
let dbReady = false;

const corsOrigin =
  process.env.CORS_ORIGIN === "*"
    ? true
    : (process.env.CORS_ORIGIN || "http://localhost:5173")
      .split(",")
      .map((s) => s.trim());

app.use(cors({ origin: corsOrigin, credentials: true }));
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true }));

app.get("/healthz", (_req, res) => {
  if (!dbReady) {
    return res.status(503).json({ status: "starting" });
  }
  return res.status(200).json({ status: "ok" });
});

app.use((req, res, next) => {
  if (dbReady) return next();
  if (req.path === "/healthz" || req.path === "/") {
    if (req.path === "/") {
      return res.send("Review service starting.....");
    }
    return next();
  }
  return res.status(503).json({
    success: false,
    error: {
      code: "SERVICE_STARTING",
      message: "Review service is starting. Retry shortly.",
    },
  });
});

app.get("/", (_req, res) => {
  res.send(
    dbReady ? "Review service running....." : "Review service starting.....",
  );
});

// Mount retention before /me so /me/retention/* is never swallowed by meRoutes.
app.use("/me/retention", retentionRoutes);
app.use("/me", meRoutes);
app.use("/public", publicRoutes);
app.use("/internal", internalRoutes);
app.use("/health", healthRoutes);

const PORT = process.env.PORT || 6003;
app.listen(PORT, () => {
  console.log(`Review service listening on port ${PORT} (dbReady=${dbReady})`);
});

sequelizeConnection
  .authenticate()
  .then(() => {
    console.log("Database connection has been established successfully.");
    return sequelizeConnection.sync();
  })
  .then(() => {
    dbReady = true;
    console.log(`Review service ready on port ${PORT}`);
    try {
      const { registerEventSubscriptions } = require("./startup/registerSubscriptions");
      registerEventSubscriptions();
    } catch (e) {
      console.warn("[Review] Could not register event subscriptions:", e.message);
    }
  })
  .catch((err) => {
    console.error("Error occurred while syncing database: ", err);
  });

module.exports = app;

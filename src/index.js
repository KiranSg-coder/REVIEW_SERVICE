require("dotenv").config();
const express = require("express");
const cors = require("cors");
const app = express();
const sequelizeConnection = require("./config/database");

const meRoutes = require("./routes/me.routes");
const publicRoutes = require("./routes/public.routes");
const internalRoutes = require("./routes/internal.routes");
const healthRoutes = require("./routes/health.routes");

const corsOrigin =
  process.env.CORS_ORIGIN === "*"
    ? true
    : (process.env.CORS_ORIGIN || "http://localhost:5173")
        .split(",")
        .map((s) => s.trim());

app.use(cors({ origin: corsOrigin, credentials: true }));
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true }));

app.get("/", (req, res) => {
  res.send("Review service running.....");
});

app.use("/me", meRoutes);
app.use("/public", publicRoutes);
app.use("/internal", internalRoutes);
app.use("/health", healthRoutes);

sequelizeConnection
  .authenticate()
  .then(() => {
    console.log("Database connection has been established successfully.");
    return sequelizeConnection.sync();
  })
  .then(() => {
    const PORT = process.env.PORT || 6013;
    app.listen(PORT, () => {
      console.log(`Review service running on port ${PORT}`);
    });
  })
  .catch((err) => {
    console.error("Error occurred while syncing database: ", err);
  });

module.exports = app;

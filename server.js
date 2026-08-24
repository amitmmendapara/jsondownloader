const express = require("express");
const cors = require("cors");
require("dotenv").config();
const compression = require("compression");
const morgan = require("morgan");

const app = express();

const { connectRedis } = require("./config/redisClient");
const connectDb = require("./db/connectDb");

const PORT = process.env.PORT;

app.use(cors());
app.use(compression());
app.set("trust proxy", true);
app.use(morgan("dev"));

// ======================================================
// Cashfree webhook
// IMPORTANT: this route must use express.raw()
// ======================================================

// If your Cashfree webhook is inside version/v1,
// mount that webhook separately BEFORE express.json().
//
// Example:
// app.use(
//   "/api/v1/cashfree/webhook",
//   express.raw({ type: "application/json" }),
//   cashfreeWebhook
// );

// ======================================================
// JSON parser for all normal APIs
// ======================================================

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ======================================================
// All API routes
// ======================================================

app.use("/api/v1", require("./version/v1"));

// ======================================================
// Database
// ======================================================

connectDb();

// ======================================================
// Redis
// ======================================================

connectRedis();

// ======================================================
// Start server
// ======================================================

app.listen(PORT, async () => {
  console.log("✅ Server started successfully!");
  console.log(`✅ Listening at: http://localhost:${PORT}/api/v1/decode`);
});

// ======================================================
// Graceful shutdown
// ======================================================

process.on("SIGINT", async () => {
  process.exit(0);
});
const axios = require("axios");

async function registerOnce() {
  const EVENT_BUS_URL = (process.env.EVENT_BUS_URL || "http://localhost:6007").replace(
    /\/$/,
    ""
  );
  const SERVICE_KEY = process.env.INTERNAL_SERVICE_KEY;
  const baseUrl = (process.env.REVIEW_SERVICE_URL || "http://localhost:6003").replace(
    /\/$/,
    ""
  );
  const webhookUrl = `${baseUrl}/internal/event`;

  const eventTypes = [
    "ENROLLMENT_SLOT_COMPLETED",
    "LEARNING_TOPIC_PROGRESS_UPDATED",
  ];

  try {
    for (const eventType of eventTypes) {
      const sub = {
        eventType,
        subscriberName: "REVIEW_SERVICE",
        webhookUrl,
        serviceType: "INTERNAL",
        priority: 200,
        maxRetries: 3,
        timeoutMs: 10000,
      };

      await axios.post(`${EVENT_BUS_URL}/subscription/register`, sub, {
        headers: {
          "Content-Type": "application/json",
          "X-Service-Key": SERVICE_KEY,
        },
        timeout: 5000,
      });

      console.log(`[Review] Subscribed to ${eventType}`);
    }
  } catch (err) {
    console.error("[Review] Subscription registration failed:", err.message);
    throw err; // Phase 1 (R10): let the wrapper retry
  }
}

/**
 * Phase 1 (R10): registration used to stop at the first error and never retry, so a service
 * started before the Event Bus silently received no events. Registration is an upsert in the
 * Event Bus, so retrying is safe. Backoff: 15 s, 30 s, 60 s, ... (max 6 attempts).
 */
function registerEventSubscriptions(attempt = 1) {
  return registerOnce().catch(() => {
    if (attempt >= 6) {
      console.error("[Subscriptions] giving up after 6 attempts — restart the service once the Event Bus is up");
      return;
    }
    const delay = Math.min(300000, 15000 * 2 ** (attempt - 1));
    console.warn(`[Subscriptions] retrying registration in ${Math.round(delay / 1000)} s (attempt ${attempt + 1}/6)`);
    const t = setTimeout(() => registerEventSubscriptions(attempt + 1), delay);
    if (t && typeof t.unref === "function") t.unref();
  });
}

module.exports = { registerEventSubscriptions, registerOnce };

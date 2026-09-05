const axios = require("axios");

async function registerEventSubscriptions() {
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
  }
}

module.exports = { registerEventSubscriptions };

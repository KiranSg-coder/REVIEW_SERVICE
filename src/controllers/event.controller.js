const {
  upsertFromSlotPayload,
  upsertGuidedTopic,
} = require("./retention.controller");

const handleEvent = async (req, res) => {
  try {
    const { eventType, payload } = req.body || {};
    console.log(`[Review Event] ${eventType}`);

    if (eventType === "ENROLLMENT_SLOT_COMPLETED") {
      const result = await upsertFromSlotPayload(payload || {});
      return res.json({ success: true, ...result });
    }

    if (eventType === "LEARNING_TOPIC_PROGRESS_UPDATED") {
      const result = await upsertGuidedTopic(payload || {});
      return res.json({ success: true, ...result });
    }

    return res.json({ success: true, action: "IGNORED" });
  } catch (error) {
    console.error("[Review Event]", error.message);
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

module.exports = { handleEvent };

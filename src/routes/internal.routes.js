const express = require("express");
const router = express.Router();
const ctrl = require("../controllers/internal.controller");
const { handleEvent } = require("../controllers/event.controller");

router.get("/moderator/queue", ctrl.moderatorQueue);
router.get("/retention/due-summary", ctrl.retentionDueSummary);
router.patch("/reviews/:reviewId/visibility", ctrl.setVisibility);
router.post("/review-reports/:reportId/resolve", ctrl.resolveReviewReport);
router.post("/plan-reports/:reportId/resolve", ctrl.resolvePlanReport);
router.post("/event", handleEvent);

module.exports = router;

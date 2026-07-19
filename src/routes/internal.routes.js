const express = require("express");
const router = express.Router();
const ctrl = require("../controllers/internal.controller");

router.get("/moderator/queue", ctrl.moderatorQueue);
router.patch("/reviews/:reviewId/visibility", ctrl.setVisibility);
router.post("/review-reports/:reportId/resolve", ctrl.resolveReviewReport);
router.post("/plan-reports/:reportId/resolve", ctrl.resolvePlanReport);

module.exports = router;

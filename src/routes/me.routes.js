const express = require("express");
const router = express.Router();
const extractUser = require("../middleware/extractUser");
const ctrl = require("../controllers/me.controller");

router.post("/reviews/plans/:planId", extractUser, ctrl.upsertReview);
router.delete("/reviews/plans/:planId", extractUser, ctrl.removeReview);
router.get("/reviews/plans/:planId", extractUser, ctrl.getMineForPlan);
router.get("/reviews", extractUser, ctrl.listMine);
router.post("/reviews/:reviewId/report", extractUser, ctrl.reportReview);
router.post("/plans/:planId/report", extractUser, ctrl.reportPlan);

module.exports = router;

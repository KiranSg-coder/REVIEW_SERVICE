const express = require("express");
const router = express.Router();
const ctrl = require("../controllers/public.controller");

router.get("/plans/:planId/reviews", ctrl.listByPlanPublic);
router.get("/plans/:planId/stats", ctrl.statsByPlan);

module.exports = router;

const express = require("express");
const extractUser = require("../middleware/extractUser");
const ctrl = require("../controllers/retention.controller");

const router = express.Router();

router.get("/today", extractUser, ctrl.getTodayQueue);
router.get("/cards", extractUser, ctrl.listCards);
router.get("/mastery", extractUser, ctrl.masterySummary);
router.get("/history", extractUser, ctrl.getHistory);
router.get("/calendar", extractUser, ctrl.getCalendar);
router.post("/cards/:cardId/start", extractUser, ctrl.startCard);
router.post("/cards/:cardId/complete", extractUser, ctrl.completeCard);

module.exports = router;

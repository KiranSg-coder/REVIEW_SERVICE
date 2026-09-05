const { QueryTypes } = require("sequelize");
const sequelize = require("../config/database");

function pickRow(result) {
  if (!Array.isArray(result) || !result.length) return null;
  return result[0] || null;
}

function mapCard(r) {
  if (!r) return null;
  let reviewConfig = null;
  if (r.REVIEWCONFIGJSON) {
    try {
      reviewConfig =
        typeof r.REVIEWCONFIGJSON === "string"
          ? JSON.parse(r.REVIEWCONFIGJSON)
          : r.REVIEWCONFIGJSON;
    } catch {
      reviewConfig = null;
    }
  }
  return {
    cardId: r.CARDID != null ? Number(r.CARDID) : null,
    sourceType: r.SOURCETYPE ?? null,
    sourceId: r.SOURCEID ?? null,
    enrollmentId: r.ENROLLMENTID != null ? Number(r.ENROLLMENTID) : null,
    planId: r.PLANID != null ? Number(r.PLANID) : null,
    slotId: r.SLOTID != null ? Number(r.SLOTID) : null,
    topicId: r.TOPICID != null ? Number(r.TOPICID) : null,
    title: r.TITLE ?? null,
    slotType: r.SLOTTYPE ?? null,
    reviewMethod: r.REVIEWMETHOD ?? null,
    reviewDifficulty: r.REVIEWDIFFICULTY ?? null,
    reviewTemplate: r.REVIEWTEMPLATE ?? null,
    reviewConfigJson: reviewConfig,
    estimatedRecallMinutes:
      r.ESTIMATEDRECALLMINUTES != null ? Number(r.ESTIMATEDRECALLMINUTES) : null,
    masteryState: r.MASTERYSTATE ?? null,
    isActive: r.ISACTIVE == null ? true : Boolean(r.ISACTIVE),
    dueAt: r.DUEAT ?? null,
    intervalDays: r.INTERVALDAYS != null ? Number(r.INTERVALDAYS) : null,
    repetition: r.REPETITION != null ? Number(r.REPETITION) : null,
    easeFactor: r.EASEFACTOR != null ? Number(r.EASEFACTOR) : null,
    lastReviewedAt: r.LASTREVIEWEDAT ?? null,
    isOverdue: Boolean(r.ISOVERDUE),
    daysOverdue: r.DAYSOVERDUE != null ? Number(r.DAYSOVERDUE) : 0,
  };
}

const getTodayQueue = async (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit, 10) || 50, 100);
    const result = await sequelize.query(
      `EXEC USP_RETENTION_GET_TODAY @USERID=:userId, @QUEUEDATE=NULL, @LIMIT=:limit`,
      {
        replacements: { userId: req.userId, limit },
        type: QueryTypes.SELECT,
      }
    );
    const items = (Array.isArray(result) ? result : []).map(mapCard).filter(Boolean);
    return res.json({
      success: true,
      data: {
        date: new Date().toISOString().slice(0, 10),
        total: items.length,
        items,
      },
    });
  } catch (error) {
    console.error("getTodayQueue:", error.message);
    return res.status(500).json({ success: false, message: "Failed to load review queue" });
  }
};

const listCards = async (req, res) => {
  try {
    const enrollmentId = req.query.enrollmentId
      ? parseInt(req.query.enrollmentId, 10)
      : null;
    const limit = Math.min(parseInt(req.query.limit, 10) || 100, 200);
    const result = await sequelize.query(
      `EXEC USP_RETENTION_GET_CARDS @USERID=:userId, @ENROLLMENTID=:enrollmentId, @LIMIT=:limit`,
      {
        replacements: {
          userId: req.userId,
          enrollmentId: Number.isFinite(enrollmentId) ? enrollmentId : null,
          limit,
        },
        type: QueryTypes.SELECT,
      }
    );
    const items = (Array.isArray(result) ? result : []).map(mapCard).filter(Boolean);
    return res.json({ success: true, data: { items, total: items.length } });
  } catch (error) {
    console.error("listCards:", error.message);
    return res.status(500).json({ success: false, message: "Failed to list retention cards" });
  }
};

const masterySummary = async (req, res) => {
  try {
    const enrollmentId = req.query.enrollmentId
      ? parseInt(req.query.enrollmentId, 10)
      : null;
    const result = await sequelize.query(
      `EXEC USP_RETENTION_MASTERY_SUMMARY @USERID=:userId, @ENROLLMENTID=:enrollmentId`,
      {
        replacements: {
          userId: req.userId,
          enrollmentId: Number.isFinite(enrollmentId) ? enrollmentId : null,
        },
        type: QueryTypes.SELECT,
      }
    );
    const row = pickRow(result) || {};
    return res.json({
      success: true,
      data: {
        totalCards: Number(row.TotalCards || 0),
        masteredCards: Number(row.MasteredCards || 0),
        learningCards: Number(row.LearningCards || 0),
        inReviewCards: Number(row.InReviewCards || 0),
        strongCards: Number(row.StrongCards || 0),
        masteryPercent: Number(row.MasteryPercent || 0),
      },
    });
  } catch (error) {
    console.error("masterySummary:", error.message);
    return res.status(500).json({ success: false, message: "Failed to load mastery summary" });
  }
};

const startCard = async (req, res) => {
  try {
    const cardId = parseInt(req.params.cardId, 10);
    const result = await sequelize.query(
      `EXEC USP_RETENTION_GET_CARDS @USERID=:userId, @ENROLLMENTID=NULL, @LIMIT=500`,
      { replacements: { userId: req.userId }, type: QueryTypes.SELECT }
    );
    const card = (Array.isArray(result) ? result : [])
      .map(mapCard)
      .find((c) => c.cardId === cardId);
    if (!card) {
      return res.status(404).json({ success: false, message: "Card not found" });
    }
    return res.json({
      success: true,
      data: {
        session: {
          cardId: card.cardId,
          title: card.title,
          template: card.reviewTemplate || "FLASHCARD",
          estimatedRecallMinutes: card.estimatedRecallMinutes || 2,
          masteryState: card.masteryState,
          reviewConfig: card.reviewConfigJson || null,
          prompt:
            card.reviewTemplate === "REFLECTION"
              ? `In your own words, what stuck from “${card.title || "this lesson"}”?`
              : card.reviewTemplate === "CHECKLIST"
                ? `Confirm you can still do the steps from “${card.title || "this lesson"}”.`
                : card.reviewTemplate === "PRACTICE_AGAIN" ||
                    card.reviewTemplate === "READ_AGAIN"
                  ? `Revisit “${card.title || "this lesson"}” briefly, then rate how clear it felt.`
                  : `Recall the key idea from “${card.title || "this lesson"}”.`,
        },
      },
    });
  } catch (error) {
    console.error("startCard:", error.message);
    return res.status(500).json({ success: false, message: "Failed to start review" });
  }
};

const getHistory = async (req, res) => {
  try {
    const enrollmentId = req.query.enrollmentId
      ? parseInt(req.query.enrollmentId, 10)
      : null;
    const limit = Math.min(parseInt(req.query.limit, 10) || 50, 200);
    const result = await sequelize.query(
      `EXEC USP_RETENTION_GET_HISTORY @USERID=:userId, @ENROLLMENTID=:enrollmentId, @LIMIT=:limit`,
      {
        replacements: {
          userId: req.userId,
          enrollmentId: Number.isFinite(enrollmentId) ? enrollmentId : null,
          limit,
        },
        type: QueryTypes.SELECT,
      }
    );
    const items = (Array.isArray(result) ? result : []).map((r) => ({
      attemptId: Number(r.ATTEMPTID),
      cardId: Number(r.CARDID),
      outcome: r.OUTCOME,
      confidence: r.CONFIDENCE != null ? Number(r.CONFIDENCE) : null,
      durationSeconds: r.DURATIONSECONDS != null ? Number(r.DURATIONSECONDS) : null,
      templateUsed: r.TEMPLATEUSED,
      attemptedAt: r.ATTEMPTEDAT,
      title: r.TITLE,
      masteryState: r.MASTERYSTATE,
      enrollmentId: r.ENROLLMENTID != null ? Number(r.ENROLLMENTID) : null,
      sourceType: r.SOURCETYPE,
      reviewTemplate: r.REVIEWTEMPLATE,
    }));
    return res.json({ success: true, data: { items, total: items.length } });
  } catch (error) {
    console.error("getHistory:", error.message);
    return res.status(500).json({ success: false, message: "Failed to load review history" });
  }
};

const getCalendar = async (req, res) => {
  try {
    const from = req.query.from || null;
    const to = req.query.to || null;
    const result = await sequelize.query(
      `EXEC USP_RETENTION_GET_CALENDAR @USERID=:userId, @FROMDATE=:fromDate, @TODATE=:toDate`,
      {
        replacements: {
          userId: req.userId,
          fromDate: from,
          toDate: to,
        },
        type: QueryTypes.SELECT,
      }
    );
    const days = (Array.isArray(result) ? result : []).map((r) => ({
      date: r.CALENDARDATE,
      kind: r.KIND,
      cardCount: Number(r.CARDCOUNT || 0),
    }));
    return res.json({ success: true, data: { days } });
  } catch (error) {
    console.error("getCalendar:", error.message);
    return res.status(500).json({ success: false, message: "Failed to load review calendar" });
  }
};

const completeCard = async (req, res) => {
  try {
    const cardId = parseInt(req.params.cardId, 10);
    const {
      outcome = "GOOD",
      confidence,
      durationSeconds,
      templateUsed,
      responseJson,
    } = req.body || {};

    const responseStr =
      responseJson != null
        ? typeof responseJson === "string"
          ? responseJson
          : JSON.stringify(responseJson)
        : null;

    const result = await sequelize.query(
      `EXEC USP_RETENTION_COMPLETE_ATTEMPT
        @USERID=:userId,
        @CARDID=:cardId,
        @OUTCOME=:outcome,
        @CONFIDENCE=:confidence,
        @DURATIONSECONDS=:durationSeconds,
        @TEMPLATEUSED=:templateUsed,
        @RESPONSEJSON=:responseJson`,
      {
        replacements: {
          userId: req.userId,
          cardId,
          outcome: String(outcome).toUpperCase(),
          confidence: confidence != null ? parseInt(confidence, 10) : null,
          durationSeconds:
            durationSeconds != null ? parseInt(durationSeconds, 10) : null,
          templateUsed: templateUsed || null,
          responseJson: responseStr,
        },
        type: QueryTypes.SELECT,
      }
    );

    const row = pickRow(result);
    if (!row || Number(row.SUCCESS) === 0) {
      return res.status(400).json({
        success: false,
        message: row?.MESSAGE || "Complete failed",
      });
    }

    return res.json({
      success: true,
      data: {
        cardId: Number(row.CARDID),
        masteryState: row.MASTERYSTATE,
        nextReviewDate: row.NEXTREVIEWDATE,
        intervalDays: Number(row.INTERVALDAYS),
        repetition: Number(row.REPETITION),
      },
    });
  } catch (error) {
    console.error("completeCard:", error.message);
    return res.status(500).json({ success: false, message: "Failed to complete review" });
  }
};

/** Internal: create/upsert card from enrollment slot completion event */
const upsertFromSlotPayload = async (payload) => {
  if (!payload?.userId || !payload?.slotId) return { action: "IGNORED" };
  if (payload.skipped) return { action: "SKIPPED_SLOT" };

  const result = await sequelize.query(
    `EXEC USP_RETENTION_UPSERT_FROM_SLOT
      @USERID=:userId,
      @ENROLLMENTID=:enrollmentId,
      @PLANID=:planId,
      @SLOTID=:slotId,
      @TITLE=:title,
      @SLOTTYPE=:slotType,
      @REQUIRESREVIEW=:requiresReview,
      @REVIEWMETHOD=:reviewMethod,
      @REVIEWDIFFICULTY=:reviewDifficulty,
      @REVIEWTEMPLATE=:reviewTemplate,
      @ESTIMATEDRECALLMINUTES=:estimatedRecallMinutes,
      @REVIEWCONFIGJSON=:reviewConfigJson,
      @FIRSTINTERVALDAYS=NULL`,
    {
      replacements: {
        userId: Number(payload.userId),
        enrollmentId: payload.enrollmentId != null ? Number(payload.enrollmentId) : null,
        planId: payload.planId != null ? Number(payload.planId) : null,
        slotId: Number(payload.slotId),
        title: payload.title || null,
        slotType: payload.slotType || null,
        requiresReview: payload.requiresReview ? 1 : 0,
        reviewMethod: payload.reviewMethod || "NONE",
        reviewDifficulty: payload.reviewDifficulty || null,
        reviewTemplate: payload.reviewTemplate || null,
        estimatedRecallMinutes:
          payload.estimatedRecallMinutes != null
            ? Number(payload.estimatedRecallMinutes)
            : null,
        reviewConfigJson:
          payload.reviewConfigJson != null
            ? typeof payload.reviewConfigJson === "string"
              ? payload.reviewConfigJson
              : JSON.stringify(payload.reviewConfigJson)
            : null,
      },
      type: QueryTypes.SELECT,
    }
  );
  const row = pickRow(result);
  return {
    action: row?.ACTION || "UPSERTED",
    cardId: row?.CARDID != null ? Number(row.CARDID) : null,
    dueAt: row?.DUEAT || null,
  };
};

const upsertGuidedTopic = async (payload) => {
  if (!payload?.userId || !payload?.topicId) return { action: "IGNORED" };
  const result = await sequelize.query(
    `EXEC USP_RETENTION_UPSERT_GUIDED_TOPIC
      @USERID=:userId,
      @TOPICID=:topicId,
      @TITLE=:title,
      @LEITNERBOX=:leitnerBox,
      @NEXTREVIEWDATE=:nextReviewDate,
      @MASTERYLEVEL=:masteryLevel`,
    {
      replacements: {
        userId: Number(payload.userId),
        topicId: Number(payload.topicId),
        title: payload.title || null,
        leitnerBox: payload.leitnerBox != null ? Number(payload.leitnerBox) : 1,
        nextReviewDate: payload.nextReviewDate || null,
        masteryLevel: payload.masteryLevel || null,
      },
      type: QueryTypes.SELECT,
    }
  );
  const row = pickRow(result);
  return { action: "UPSERTED", cardId: row?.CARDID != null ? Number(row.CARDID) : null };
};

module.exports = {
  getTodayQueue,
  listCards,
  masterySummary,
  startCard,
  completeCard,
  getHistory,
  getCalendar,
  upsertFromSlotPayload,
  upsertGuidedTopic,
};

const { QueryTypes } = require("sequelize");
const sequelize = require("../config/database");
const { syncCreatorRollupForPlan } = require("../lib/catalogRollupSync");

const upsertReview = async (req, res) => {
  try {
    const { planId } = req.params;
    const {
      rating,
      title,
      body,
      reviewText,
      planVersion,
      enrollmentId,
      submittedAfterComplete,
      allowRestoreVisible,
    } = req.body;

    if (rating == null || rating < 1 || rating > 5) {
      return res
        .status(400)
        .json({ success: false, message: "rating is required (1-5)" });
    }

    let pv =
      planVersion != null ? parseInt(planVersion, 10) : NaN;
    if (!Number.isFinite(pv) && req.body.planVersionNumber != null) {
      pv = parseInt(req.body.planVersionNumber, 10);
    }
    if (!Number.isFinite(pv)) {
      return res
        .status(400)
        .json({ success: false, message: "planVersion is required" });
    }

    const textBody =
      body != null && String(body).trim() !== ""
        ? String(body).trim()
        : reviewText != null && String(reviewText).trim() !== ""
          ? String(reviewText).trim()
          : null;

    const eid =
      enrollmentId != null ? parseInt(enrollmentId, 10) : null;
    const sac =
      submittedAfterComplete != null
        ? !!submittedAfterComplete
        : true;
    const arv =
      allowRestoreVisible != null ? !!allowRestoreVisible : true;

    const result = await sequelize.query(
      `EXEC USP_REVIEW_UPSERT
        @USERID=:userId,
        @PLANID=:planId,
        @PLANVERSION=:planVersion,
        @ENROLLMENTID=:enrollmentId,
        @RATING=:rating,
        @TITLE=:title,
        @BODY=:body,
        @SUBMITTEDAFTERCOMPLETE=:sac,
        @ALLOWRESTOREVISIBLE=:arv`,
      {
        replacements: {
          userId: req.userId,
          planId: parseInt(planId, 10),
          planVersion: pv,
          enrollmentId: Number.isFinite(eid) ? eid : null,
          rating: parseInt(rating, 10),
          title: title != null ? String(title).trim() : null,
          body: textBody,
          sac,
          arv,
        },
        type: QueryTypes.SELECT,
      }
    );

    const row = result[0];
    if (!row || row.SUCCESS === 0) {
      return res
        .status(400)
        .json({ success: false, message: row?.MESSAGE || "Review upsert failed" });
    }

    await syncCreatorRollupForPlan(planId);

    return res.status(200).json({
      success: true,
      data: { reviewId: row.REVIEWID },
      message: row.MESSAGE,
    });
  } catch (error) {
    console.error("upsertReview error:", error.message);
    return res
      .status(500)
      .json({ success: false, message: "Internal server error" });
  }
};

const removeReview = async (req, res) => {
  try {
    const { planId } = req.params;

    const result = await sequelize.query(
      `EXEC USP_REVIEW_REMOVE_BY_USER @USERID=:userId, @PLANID=:planId`,
      {
        replacements: {
          userId: req.userId,
          planId: parseInt(planId, 10),
        },
        type: QueryTypes.SELECT,
      }
    );

    const row = result[0];
    if (!row || row.SUCCESS === 0) {
      return res
        .status(400)
        .json({ success: false, message: row?.MESSAGE || "Remove failed" });
    }

    await syncCreatorRollupForPlan(planId);

    return res.status(200).json({ success: true, message: row.MESSAGE });
  } catch (error) {
    console.error("removeReview error:", error.message);
    return res
      .status(500)
      .json({ success: false, message: "Internal server error" });
  }
};

const getMineForPlan = async (req, res) => {
  try {
    const { planId } = req.params;

    const result = await sequelize.query(
      `EXEC USP_REVIEW_GET_BY_USER_AND_PLAN @USERID=:userId, @PLANID=:planId`,
      {
        replacements: {
          userId: req.userId,
          planId: parseInt(planId, 10),
        },
        type: QueryTypes.SELECT,
      }
    );

    const row = result[0] || null;
    if (!row) {
      return res
        .status(404)
        .json({ success: false, message: "No review for this plan" });
    }

    return res.status(200).json({ success: true, data: row });
  } catch (error) {
    console.error("getMineForPlan error:", error.message);
    return res
      .status(500)
      .json({ success: false, message: "Internal server error" });
  }
};

const listMine = async (req, res) => {
  try {
    const pageSize = parseInt(req.query.pageSize, 10) || 50;
    const page = parseInt(req.query.page, 10) || 1;

    const result = await sequelize.query(
      `EXEC USP_REVIEW_LIST_BY_USER
        @USERID=:userId,
        @PAGESIZE=:pageSize,
        @PAGENUMBER=:page`,
      {
        replacements: { userId: req.userId, pageSize, page },
        type: QueryTypes.SELECT,
      }
    );

    const rows = result || [];
    const total = rows.length > 0 ? rows[0].TOTALCOUNT ?? rows.length : 0;
    const items = rows.map(({ TOTALCOUNT, ...rest }) => rest);

    return res.status(200).json({
      success: true,
      data: items,
      total,
      page,
      pageSize,
    });
  } catch (error) {
    console.error("listMine error:", error.message);
    return res
      .status(500)
      .json({ success: false, message: "Internal server error" });
  }
};

const reportReview = async (req, res) => {
  try {
    const { reviewId } = req.params;
    const { reasonCode, detail } = req.body;

    if (!reasonCode || String(reasonCode).trim() === "") {
      return res
        .status(400)
        .json({ success: false, message: "reasonCode is required" });
    }

    const result = await sequelize.query(
      `EXEC USP_REVIEW_REPORT_SUBMIT
        @REVIEWID=:reviewId,
        @REPORTEDBYUSERID=:userId,
        @REASONCODE=:reasonCode,
        @DETAIL=:detail`,
      {
        replacements: {
          reviewId: parseInt(reviewId, 10),
          userId: req.userId,
          reasonCode: String(reasonCode).trim(),
          detail: detail != null ? String(detail).trim() : null,
        },
        type: QueryTypes.SELECT,
      }
    );

    const row = result[0];
    if (!row || row.SUCCESS === 0) {
      return res
        .status(400)
        .json({ success: false, message: row?.MESSAGE || "Report failed" });
    }

    return res.status(201).json({
      success: true,
      data: { reportId: row.REPORTID },
      message: row.MESSAGE,
    });
  } catch (error) {
    console.error("reportReview error:", error.message);
    return res
      .status(500)
      .json({ success: false, message: "Internal server error" });
  }
};

const reportPlan = async (req, res) => {
  try {
    const { planId } = req.params;
    const { reasonCode, detail } = req.body;

    if (!reasonCode || String(reasonCode).trim() === "") {
      return res
        .status(400)
        .json({ success: false, message: "reasonCode is required" });
    }

    const result = await sequelize.query(
      `EXEC USP_PLAN_CONTENT_REPORT_SUBMIT
        @PLANID=:planId,
        @REPORTEDBYUSERID=:userId,
        @REASONCODE=:reasonCode,
        @DETAIL=:detail`,
      {
        replacements: {
          planId: parseInt(planId, 10),
          userId: req.userId,
          reasonCode: String(reasonCode).trim(),
          detail: detail != null ? String(detail).trim() : null,
        },
        type: QueryTypes.SELECT,
      }
    );

    const row = result[0];
    if (!row || row.SUCCESS === 0) {
      return res
        .status(400)
        .json({ success: false, message: row?.MESSAGE || "Report failed" });
    }

    return res.status(201).json({
      success: true,
      data: { reportId: row.REPORTID },
      message: row.MESSAGE,
    });
  } catch (error) {
    console.error("reportPlan error:", error.message);
    return res
      .status(500)
      .json({ success: false, message: "Internal server error" });
  }
};

module.exports = {
  upsertReview,
  removeReview,
  getMineForPlan,
  listMine,
  reportReview,
  reportPlan,
};

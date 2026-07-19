const { QueryTypes } = require("sequelize");
const sequelize = require("../config/database");

const moderatorQueue = async (req, res) => {
  try {
    const reviewPageSize = parseInt(req.query.reviewPageSize, 10) || 50;
    const reviewPage = parseInt(req.query.reviewPage, 10) || 1;
    const planPageSize = parseInt(req.query.planPageSize, 10) || 50;
    const planPage = parseInt(req.query.planPage, 10) || 1;

    const rOff = (reviewPage - 1) * reviewPageSize;
    const pOff = (planPage - 1) * planPageSize;

    const reviewFlags = await sequelize.query(
      `SELECT
          R.REPORTID,
          R.REVIEWID,
          R.REPORTEDBYUSERID,
          R.REASONCODE,
          R.DETAIL,
          R.STATUS,
          R.CREATEDDATE,
          R.RESOLVEDDATE,
          R.MODERATORUSERID,
          R.MODERATORNOTE,
          COUNT(*) OVER() AS TOTALCOUNT
       FROM dbo.REVIEW_REPORT R
       WHERE R.STATUS = N'OPEN'
       ORDER BY R.CREATEDDATE DESC
       OFFSET :rOff ROWS FETCH NEXT :rPs ROWS ONLY`,
      {
        replacements: { rOff, rPs: reviewPageSize },
        type: QueryTypes.SELECT,
      }
    );

    const planFlags = await sequelize.query(
      `SELECT
          P.REPORTID,
          P.PLANID,
          P.REPORTEDBYUSERID,
          P.REASONCODE,
          P.DETAIL,
          P.STATUS,
          P.CREATEDDATE,
          P.RESOLVEDDATE,
          P.MODERATORUSERID,
          P.MODERATORNOTE,
          COUNT(*) OVER() AS TOTALCOUNTPLAN
       FROM dbo.PLAN_CONTENT_REPORT P
       WHERE P.STATUS = N'OPEN'
       ORDER BY P.CREATEDDATE DESC
       OFFSET :pOff ROWS FETCH NEXT :pPs ROWS ONLY`,
      {
        replacements: { pOff, pPs: planPageSize },
        type: QueryTypes.SELECT,
      }
    );

    const reviewTotal =
      reviewFlags.length > 0 ? reviewFlags[0].TOTALCOUNT ?? 0 : 0;
    const planTotal =
      planFlags.length > 0 ? planFlags[0].TOTALCOUNTPLAN ?? 0 : 0;

    const rItems = reviewFlags.map(
      ({ TOTALCOUNT, ...rest }) => rest
    );
    const pItems = planFlags.map(
      ({ TOTALCOUNTPLAN, ...rest }) => rest
    );

    return res.status(200).json({
      success: true,
      data: {
        reviewFlags: rItems,
        planFlags: pItems,
        reviewFlagsTotal: reviewTotal,
        planFlagsTotal: planTotal,
        reviewPage,
        reviewPageSize,
        planPage,
        planPageSize,
      },
    });
  } catch (error) {
    console.error("moderatorQueue error:", error.message);
    return res
      .status(500)
      .json({ success: false, message: "Internal server error" });
  }
};

const setVisibility = async (req, res) => {
  try {
    const { reviewId } = req.params;
    const { newVisibility, moderatorUserId } = req.body;

    const modId =
      moderatorUserId != null
        ? parseInt(moderatorUserId, 10)
        : parseInt(req.headers["x-moderator-user-id"], 10) || 0;

    if (!newVisibility || String(newVisibility).trim() === "") {
      return res.status(400).json({
        success: false,
        message: "newVisibility is required",
      });
    }

    if (!modId) {
      return res.status(400).json({
        success: false,
        message: "moderator user id required (body.moderatorUserId or x-moderator-user-id)",
      });
    }

    const result = await sequelize.query(
      `EXEC USP_REVIEW_MODERATOR_SET_VISIBILITY
        @REVIEWID=:reviewId,
        @MODERATORUSERID=:modId,
        @NEWVISIBILITY=:vis`,
      {
        replacements: {
          reviewId: parseInt(reviewId, 10),
          modId,
          vis: String(newVisibility).trim(),
        },
        type: QueryTypes.SELECT,
      }
    );

    const row = result[0];
    if (!row || row.SUCCESS === 0) {
      return res
        .status(400)
        .json({ success: false, message: row?.MESSAGE || "Update failed" });
    }

    return res.status(200).json({
      success: true,
      data: { reviewId: row.REVIEWID },
      message: row.MESSAGE,
    });
  } catch (error) {
    console.error("setVisibility error:", error.message);
    return res
      .status(500)
      .json({ success: false, message: "Internal server error" });
  }
};

const resolveReviewReport = async (req, res) => {
  try {
    const { reportId } = req.params;
    const { newStatus, moderatorUserId, moderatorNote } = req.body;

    const modId =
      moderatorUserId != null
        ? parseInt(moderatorUserId, 10)
        : parseInt(req.headers["x-moderator-user-id"], 10) || 0;

    if (!newStatus) {
      return res
        .status(400)
        .json({ success: false, message: "newStatus is required" });
    }

    if (!modId) {
      return res.status(400).json({
        success: false,
        message: "moderator user id required",
      });
    }

    const result = await sequelize.query(
      `EXEC USP_REVIEW_REPORT_RESOLVE
        @REPORTID=:reportId,
        @MODERATORUSERID=:modId,
        @NEWSTATUS=:st,
        @MODERATORNOTE=:note`,
      {
        replacements: {
          reportId: parseInt(reportId, 10),
          modId,
          st: String(newStatus).trim().toUpperCase(),
          note: moderatorNote != null ? String(moderatorNote).trim() : null,
        },
        type: QueryTypes.SELECT,
      }
    );

    const row = result[0];
    if (!row || row.SUCCESS === 0) {
      return res
        .status(400)
        .json({ success: false, message: row?.MESSAGE || "Resolve failed" });
    }

    return res.status(200).json({ success: true, message: row.MESSAGE });
  } catch (error) {
    console.error("resolveReviewReport error:", error.message);
    return res
      .status(500)
      .json({ success: false, message: "Internal server error" });
  }
};

const resolvePlanReport = async (req, res) => {
  try {
    const { reportId } = req.params;
    const { newStatus, moderatorUserId, moderatorNote } = req.body;

    const modId =
      moderatorUserId != null
        ? parseInt(moderatorUserId, 10)
        : parseInt(req.headers["x-moderator-user-id"], 10) || 0;

    if (!newStatus) {
      return res
        .status(400)
        .json({ success: false, message: "newStatus is required" });
    }

    if (!modId) {
      return res.status(400).json({
        success: false,
        message: "moderator user id required",
      });
    }

    const result = await sequelize.query(
      `EXEC USP_PLAN_CONTENT_REPORT_RESOLVE
        @REPORTID=:reportId,
        @MODERATORUSERID=:modId,
        @NEWSTATUS=:st,
        @MODERATORNOTE=:note`,
      {
        replacements: {
          reportId: parseInt(reportId, 10),
          modId,
          st: String(newStatus).trim().toUpperCase(),
          note: moderatorNote != null ? String(moderatorNote).trim() : null,
        },
        type: QueryTypes.SELECT,
      }
    );

    const row = result[0];
    if (!row || row.SUCCESS === 0) {
      return res
        .status(400)
        .json({ success: false, message: row?.MESSAGE || "Resolve failed" });
    }

    return res.status(200).json({ success: true, message: row.MESSAGE });
  } catch (error) {
    console.error("resolvePlanReport error:", error.message);
    return res
      .status(500)
      .json({ success: false, message: "Internal server error" });
  }
};

module.exports = {
  moderatorQueue,
  setVisibility,
  resolveReviewReport,
  resolvePlanReport,
};

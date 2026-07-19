const { QueryTypes } = require("sequelize");
const sequelize = require("../config/database");

const listByPlanPublic = async (req, res) => {
  try {
    const { planId } = req.params;
    const pageSize = parseInt(req.query.pageSize, 10) || 20;
    const page = parseInt(req.query.page, 10) || 1;

    const result = await sequelize.query(
      `EXEC USP_REVIEW_LIST_BY_PLAN_PUBLIC
        @PLANID=:planId,
        @PAGESIZE=:pageSize,
        @PAGENUMBER=:page`,
      {
        replacements: {
          planId: parseInt(planId, 10),
          pageSize,
          page,
        },
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
    console.error("listByPlanPublic error:", error.message);
    return res
      .status(500)
      .json({ success: false, message: "Internal server error" });
  }
};

const statsByPlan = async (req, res) => {
  try {
    const { planId } = req.params;

    const result = await sequelize.query(
      `EXEC USP_REVIEW_STATS_BY_PLAN @PLANID=:planId`,
      {
        replacements: { planId: parseInt(planId, 10) },
        type: QueryTypes.SELECT,
      }
    );

    const row = result[0] || {};
    return res.status(200).json({
      success: true,
      data: {
        planId: parseInt(planId, 10),
        reviewCount: row.REVIEWCOUNT ?? 0,
        avgRating: row.AVGRATING ?? null,
        fiveStarCount: row.FIVESTARCOUNT ?? 0,
        lowRatingCount: row.LOWRATINGCOUNT ?? 0,
      },
    });
  } catch (error) {
    console.error("statsByPlan error:", error.message);
    return res
      .status(500)
      .json({ success: false, message: "Internal server error" });
  }
};

module.exports = { listByPlanPublic, statsByPlan };

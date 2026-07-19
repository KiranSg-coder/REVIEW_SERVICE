const axios = require("axios");
const { QueryTypes } = require("sequelize");
const sequelize = require("../config/database");

const CREATOR_SERVICE_URL =
  process.env.CREATOR_SERVICE_URL || "http://localhost:6011";

/**
 * After review mutations, push review aggregates into Creator catalog rollup
 * (USP_CATALOG_ROLLUP_UPSERT keeps enrollCount when null).
 */
async function syncCreatorRollupForPlan(planId) {
  if (process.env.SKIP_CREATOR_ROLLUP_SYNC === "1") return;

  const pid = parseInt(planId, 10);
  const statsRows = await sequelize.query(
    `EXEC USP_REVIEW_STATS_BY_PLAN @PLANID=:planId`,
    { replacements: { planId: pid }, type: QueryTypes.SELECT }
  );
  const stats = statsRows[0] || {};

  let planVersion = 1;
  try {
    const resp = await axios.get(
      `${CREATOR_SERVICE_URL}/catalog/plans/${pid}`
    );
    const plan = resp.data?.data?.plan;
    planVersion =
      plan?.CURRENTVERSIONNO || plan?.PLANVERSION || 1;
  } catch {
    return;
  }

  try {
    await axios.post(`${CREATOR_SERVICE_URL}/internal/rollup/sync`, {
      planId: pid,
      planVersion,
      avgRating: stats.AVGRATING ?? null,
      reviewCount: stats.REVIEWCOUNT ?? null,
      enrollCount: null,
      completionPercent: null,
    });
  } catch (err) {
    console.warn(
      "catalogRollupSync warning:",
      err.response?.data || err.message
    );
  }
}

module.exports = { syncCreatorRollupForPlan };

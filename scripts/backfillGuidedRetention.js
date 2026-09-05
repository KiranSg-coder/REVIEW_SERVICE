/**
 * One-time backfill: LEARNING_SERVICE.USER_TOPIC_PROGRESS → RETENTION cards.
 *
 * Usage (from REVIEW_SERVICE):
 *   node scripts/backfillGuidedRetention.js
 *
 * Env (optional): DB_HOST, DB_USER, DB_PASSWORD, LEARNING_DB_NAME, REVIEW_DB_NAME
 */
const { Sequelize, QueryTypes } = require("sequelize");

const host = process.env.DB_HOST || "DESKTOP-C1F49GD";
const user = process.env.DB_USER || "auth";
const pass = process.env.DB_PASSWORD || "1234";
const learningDb = process.env.LEARNING_DB_NAME || "LEARNING_SERVICE";
const reviewDb = process.env.REVIEW_DB_NAME || "REVIEW_SERVICE";

function makeSequelize(database) {
  return new Sequelize(database, user, pass, {
    host,
    dialect: "mssql",
    logging: false,
    dialectOptions: {
      options: { encrypt: true, trustServerCertificate: true },
    },
  });
}

async function main() {
  const learning = makeSequelize(learningDb);
  const review = makeSequelize(reviewDb);

  await learning.authenticate();
  await review.authenticate();

  const rows = await learning.query(
    `SELECT
        UTP.USERID,
        UTP.TOPICID,
        TM.TOPICNAME AS TITLE,
        UTP.LEITNERBOX,
        UTP.NEXTREVIEWDATE,
        UTP.MASTERYLEVEL
     FROM USER_TOPIC_PROGRESS UTP
     LEFT JOIN TOPIC_MASTER TM ON TM.TOPICID = UTP.TOPICID
     WHERE UTP.NEXTREVIEWDATE IS NOT NULL
        OR ISNULL(UTP.MASTERYLEVEL, N'NOT_STARTED') NOT IN (N'NOT_STARTED', N'')`,
    { type: QueryTypes.SELECT }
  );

  console.log(`Found ${rows.length} topic progress rows to upsert`);

  let ok = 0;
  let fail = 0;
  for (const r of rows) {
    try {
      await review.query(
        `EXEC USP_RETENTION_UPSERT_GUIDED_TOPIC
          @USERID=:userId,
          @TOPICID=:topicId,
          @TITLE=:title,
          @LEITNERBOX=:leitnerBox,
          @NEXTREVIEWDATE=:nextReviewDate,
          @MASTERYLEVEL=:masteryLevel`,
        {
          replacements: {
            userId: Number(r.USERID),
            topicId: Number(r.TOPICID),
            title: r.TITLE || null,
            leitnerBox: r.LEITNERBOX != null ? Number(r.LEITNERBOX) : 1,
            nextReviewDate: r.NEXTREVIEWDATE || null,
            masteryLevel: r.MASTERYLEVEL || null,
          },
          type: QueryTypes.SELECT,
        }
      );
      ok += 1;
    } catch (err) {
      fail += 1;
      console.error(`topic ${r.TOPICID} user ${r.USERID}:`, err.message);
    }
  }

  console.log(`Done. upserted=${ok} failed=${fail}`);
  await learning.close();
  await review.close();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

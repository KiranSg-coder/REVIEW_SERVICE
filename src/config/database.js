const { Sequelize } = require("sequelize");

const dbName = process.env.DB_NAME || "REVIEW_SERVICE";
const dbUser = process.env.DB_USER || "auth";
const dbPass = process.env.DB_PASSWORD || "1234";
const dbHost = process.env.DB_HOST || "DESKTOP-C1F49GD";
const dbPort = parseInt(process.env.DB_PORT || "1433", 10);

const sequelize = new Sequelize(dbName, dbUser, dbPass, {
  host: dbHost,
  port: dbPort,
  dialect: "mssql",
  logging: false,
  dialectOptions: {
    options: {
      encrypt: true,
      trustServerCertificate: true,
    },
  },
  pool: { max: 5, min: 0, idle: 30000 },
});

module.exports = sequelize;

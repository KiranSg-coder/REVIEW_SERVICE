const { resolveUserId } = require("../lib/resolveUserContext");

const extractUser = (req, res, next) => {
  const userId = resolveUserId(req);
  if (!userId || Number.isNaN(userId)) {
    return res
      .status(401)
      .json({ success: false, message: "Missing user context" });
  }
  req.userId = userId;
  next();
};

module.exports = extractUser;

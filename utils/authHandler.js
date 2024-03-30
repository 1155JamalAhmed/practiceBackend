const User = require("../models/userModel");
const { promisify } = require("util");
const jwt = require("jsonwebtoken");

exports.authenticate = async (token) => {
  const decoded = await promisify(jwt.verify)(token, process.env.JWT_SECRET);
  const currentUser = await User.findById(decoded.id);

  if (currentUser.isPasswordChangedAfterJWTIssued(decoded.iat)) {
    return new Error("Password has been changed please login again");
  }

  return currentUser;
};

const User = require("../models/userModel");
const catchAsync = require("../utils/catchAsync");
const jwt = require("jsonwebtoken");
const AppError = require("../utils/appError");
const { promisify } = require("util");
const crypto = require("crypto");

const signToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN,
  });
};

const createSendToken = (user, statusCode, req, res) => {
  const token = signToken(user._id);
  const cookieOptions = {
    expires: new Date(
      Date.now() + process.env.JWT_COOKIE_EXPIRES_IN * 24 * 60 * 60 * 1000
    ),
    httpOnly: true,
    secure: req.secure || req.headers["x-forwarded-proto"] === "https",
  };
  res.cookie("jwt", token, cookieOptions);

  // ** remove passsword from the output
  user.password = undefined;

  res.status(statusCode).json({
    status: "success",
    token,
    data: {
      user,
    },
  });
};

exports.signup = catchAsync(async (req, res, next) => {
  const newUser = await User.create({
    name: req.body.name,
    email: req.body.email,
    password: req.body.password,
    passwordConfirm: req.body.passwordConfirm,
    role: req.body.role,
    active: true,
  });
  createSendToken(newUser, 201, req, res);
});

exports.login = catchAsync(async (req, res, next) => {
  const { email, password } = req.body;

  // ** 1) check if email and password exist
  if (!email || !password) {
    return next(new AppError("Please provide email and password", 400));
  }

  // ** 2 check if user exists && password is correct
  /* ** because the password is select: false in userModel hence, we explicitly
  have to ask for password ** */
  const user = await User.findOne({ email }).select("+password");

  if (!user || !(await user.correctPassword(password, user.password))) {
    return next(new AppError("Incorrect email or password", 401));
  }

  // ** 3 if everything ok, then send the token
  createSendToken(user, 200, req, res);
});

exports.logout = (req, res) => {
  res.cookie("jwt", "loggedOut", {
    expires: new Date(Date.now() + 10 * 1000),
    httpOnly: true,
  });
  res.status(200).json({ status: "success" });
};

// ! Never disable this
// ** protecting resources from unauthenticated access
exports.protect = catchAsync(async (req, res, next) => {
  // 1 ** Getting token and check i it's there
  let token;
  if (
    req.headers.authorization &&
    req.headers.authorization.startsWith("Bearer")
  ) {
    // ** taking jwt token from the authorization
    token = req.headers.authorization.split(" ")[1];
  } else if (req.cookies.jwt) {
    token = req.cookies.jwt;
  }

  if (!token) {
    return next(
      new AppError("You are not logged in! Please login to get access", 401)
    );
  }

  // 2 ** Verification of token
  const decoded = await promisify(jwt.verify)(token, process.env.JWT_SECRET);

  // 3 ** check if user still exits
  const currentUser = await User.findById(decoded.id);
  if (!currentUser) {
    return next(
      new AppError(
        "The user belonging to this token does no longer exists",
        401
      )
    );
  }

  // 4 ** check if user changed password after the token was issued

  // ** decode.iat is the timestamp when the jwt was created
  if (currentUser.isPasswordChangedAfterJWTIssued(decoded.iat)) {
    return next(
      new AppError(
        "User recently changed the password! Please login again.",
        401
      )
    );
  }

  // Grant Access to the protected route
  req.user = currentUser;
  res.locals.user = currentUser;
  next();
});

// ! Only for rendered pages, no errors!
exports.isLoggedIn = async (req, res, next) => {
  if (req.cookies.jwt) {
    try {
      const token = req.cookies.jwt;

      // 2 ** Verification of token
      const decoded = await promisify(jwt.verify)(
        token,
        process.env.JWT_SECRET
      );

      // 3 ** check if user still exits
      const currentUser = await User.findById(decoded.id);
      if (!currentUser) {
        return next();
      }

      // 4 ** check if user changed password after the token was issued

      // ** decode.iat is the timestamp when the jwt was created
      if (currentUser.isPasswordChangedAfterJWTIssued(decoded.iat)) {
        return next();
      }

      // There is a loggedin user
      res.locals.user = currentUser;
      return next();
    } catch (err) {
      return next();
    }
  }
  return next();
};

// ** protecting resources from unauthorized access
exports.restrictTo = (...roles) => {
  return (req, res, next) => {
    // roles ['admin','lead-guide']
    if (!roles.includes(req.user.role)) {
      return next(
        new AppError("You do not have permission to perfornm this action", 403)
      );
    }
    next();
  };
};

exports.forgotPassword = catchAsync(async (req, res, next) => {
  // ** 1) Get user by his email
  if (!req.body.email) {
    return next(new AppError("Please provide your email", 400));
  }

  const user = await User.findOne({ email: req.body.email });

  if (!User) {
    return next(new AppError("There is no user with this email", 404));
  }

  // ** 2) Generate the random token and expiry time
  // ** store it in database
  const resetToken = user.createPasswordResetToken();
  await user.save({ validateBeforeSave: false });

  // ** 3) Send the random token to user's email
  try {
    const resetURL = `${req.protocol}://${req.get(
      "host"
    )}/api/v1/users/resetPassword/${resetToken}`;
    // await sendEmail({
    //   email: user.email,
    //   subject: 'Your password reset token (valid for 10 min)',
    //   message,
    // });
    await new Email(user, resetURL).sendPasswordReset();

    res.status(200).json({
      status: "success",
      message: "Token sent to the email",
    });
  } catch (err) {
    user.passwordResetToken = undefined;
    user.passwordResetExpires = undefined;
    await user.save({ validateBeforeSave: false });
    return next(
      new AppError(
        "There was an error while sending the email. Try again later!",
        500
      )
    );
  }
});

exports.resetPassword = catchAsync(async (req, res, next) => {
  // ** 1) Get user based on the token
  const hashedToken = crypto
    .createHash("sha256")
    .update(req.params.token)
    .digest("hex");

  const user = await User.findOne({
    passwordResetToken: hashedToken,
    passwordResetExpires: { $gt: Date.now() },
  });

  // ** 2) If token has not expired, and there is a user, set the new password
  if (!user) {
    return next(new AppError("Token is invalid or has expired", 400));
  }
  user.password = req.body.password;
  user.passwordConfirm = req.body.passwordConfirm;
  user.passwordResetToken = undefined;
  user.passwordResetExpires = undefined;
  await user.save();

  // ** 3) Update changedPasswordAt property for the user
  // ** this part is in the userModel as a middleware

  // ** 4) Log the user in, send JWT
  createSendToken(user, 200, req, res);
});

exports.updatePassword = catchAsync(async (req, res, next) => {
  if (
    !req.body.password ||
    !req.body.newPassword ||
    !req.body.passwordNewConfirm
  ) {
    return next(
      new AppError(
        "You have to provide old password, newPassword and passwordNewConfirm",
        400
      )
    );
  }

  // ** 1) Get user from the collection
  const user = await User.findById(req.user.id).select("+password");

  // ** 2) check if POSTed current password is correct
  if (!(await user.correctPassword(req.body.password, user.password))) {
    return next(new AppError("Password is not correct!", 401));
  }

  // ** 3) If so, update the password
  user.password = req.body.newPassword;
  user.passwordConfirm = req.body.passwordNewConfirm;
  await user.save();

  // ** 4) Log user in, send JWT
  createSendToken(user, 200, req, res);
});

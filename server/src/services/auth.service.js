const User = require("../models/user.model");
const AppError = require("../utils/AppError");
const { signToken } = require("../utils/token");

exports.register = async (data) => {
  const { name, email, password, role, department, jobTitle } = data;
  const existing = await User.findOne({ email });
  if (existing) throw new AppError("Email already in use", 409);

  const user = await User.create({ name, email, password, role, department, jobTitle });
  const token = signToken({ id: user._id, role: user.role });
  return { user, token };
};

exports.login = async ({ email, password }) => {
  if (!email || !password) throw new AppError("Email and password are required", 400);

  const user = await User.findOne({ email });
  // ⚠️ Plaintext compare for now.
  // After bcrypt:  if (!user || !(await user.comparePassword(password)))
  if (!user || user.password !== password) {
    throw new AppError("Invalid credentials", 401);
  }

  const token = signToken({ id: user._id, role: user.role });
  return { user, token };
};

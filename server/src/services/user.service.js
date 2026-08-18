const User = require("../models/user.model");
const AppError = require("../utils/AppError");

// Business logic for users. Knows nothing about Express (no req/res here).

exports.createUser = async (data) => {
  const { name, email, password, role, department, jobTitle } = data;

  const existing = await User.findOne({ email });
  if (existing) throw new AppError("Email already in use", 409);

  return User.create({ name, email, password, role, department, jobTitle });
};

exports.listUsers = async (query = {}) => {
  const { role, department, includeInactive } = query;

  const filter = {};
  if (includeInactive !== "true") filter.isActive = true;
  if (role) filter.role = role;
  if (department) filter.department = department;

  return User.find(filter).sort({ createdAt: -1 });
};

exports.getUserById = async (id) => {
  const user = await User.findById(id);
  if (!user) throw new AppError("User not found", 404);
  return user;
};

exports.updateUser = async (id, data) => {
  const { name, email, password, role, department, jobTitle, isActive } = data;

  const user = await User.findByIdAndUpdate(
    id,
    { name, email, password, role, department, jobTitle, isActive },
    { new: true, runValidators: true },
  );
  if (!user) throw new AppError("User not found", 404);
  return user;
};

// Soft delete: keep the record, just mark it inactive.
exports.deactivateUser = async (id) => {
  const user = await User.findByIdAndUpdate(id, { isActive: false }, { new: true });
  if (!user) throw new AppError("User not found", 404);
  return user;
};

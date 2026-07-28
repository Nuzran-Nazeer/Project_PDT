const express = require("express");
const mongoose = require("mongoose");
const router = express.Router();
const User = require("../models/User");

// Validate :id is a proper ObjectId before hitting the DB
router.param("id", (req, res, next, id) => {
  if (!mongoose.isValidObjectId(id)) {
    return res.status(400).json({ error: "Invalid user id" });
  }
  next();
});

// Create a user
router.post("/", async (req, res) => {
  try {
    const { name, email, role, department, jobTitle } = req.body;
    const user = await User.create({ name, email, role, department, jobTitle });
    res.status(201).json(user);
  } catch (err) {
    if (err.code === 11000) {
      return res.status(409).json({ error: "Email already in use" });
    }
    res.status(400).json({ error: err.message });
  }
});

// List users - active only by default; ?role= & ?department= filters; ?includeInactive=true
router.get("/", async (req, res) => {
  try {
    const { role, department, includeInactive } = req.query;
    const filter = {};
    if (includeInactive !== "true") filter.isActive = true;
    if (role) filter.role = role;
    if (department) filter.department = department;

    const users = await User.find(filter).sort({ createdAt: -1 });
    res.json(users);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get one user
router.get("/:id", async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ error: "User not found" });
    res.json(user);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Update a user
router.put("/:id", async (req, res) => {
  try {
    const { name, email, role, department, jobTitle, isActive } = req.body;
    const user = await User.findByIdAndUpdate(
      req.params.id,
      { name, email, role, department, jobTitle, isActive },
      { new: true, runValidators: true }
    );
    if (!user) return res.status(404).json({ error: "User not found" });
    res.json(user);
  } catch (err) {
    if (err.code === 11000) {
      return res.status(409).json({ error: "Email already in use" });
    }
    res.status(400).json({ error: err.message });
  }
});

// Soft delete - mark inactive instead of removing
router.delete("/:id", async (req, res) => {
  try {
    const user = await User.findByIdAndUpdate(
      req.params.id,
      { isActive: false },
      { new: true }
    );
    if (!user) return res.status(404).json({ error: "User not found" });
    res.json({ message: "User deactivated", user });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;

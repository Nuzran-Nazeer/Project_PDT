const mongoose = require("mongoose");

// Connects to MongoDB. Reads MONGO_URI at call time (after dotenv is loaded).
const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log("MongoDB connected");
  } catch (err) {
    console.error("MongoDB connection error:", err.message);
    process.exit(1);
  }
};

module.exports = connectDB;

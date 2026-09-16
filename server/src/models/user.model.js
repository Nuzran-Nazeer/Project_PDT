const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");

const {
  GRANTABLE_ROLES,
  USER_STATUS,
  LOCATIONS,
  JOB_FAMILIES,
  DESIGNATIONS,
  DESIGNATION_NAMES,
  PAR_GROUPS,
  parGroupFor,
  EMPLOYEE_ID_PATTERN,
  BCRYPT_COST,
  MIN_PASSWORD_LENGTH,
} = require("../config/constants");

const userSchema = new mongoose.Schema(
  {
    employeeId: {
      type: String,
      required: [true, "Employee ID is required"],
      unique: true,
      uppercase: true,
      trim: true,
      match: [EMPLOYEE_ID_PATTERN, "Employee ID must look like ALT-0241"],
    },
    name: {
      type: String,
      required: [true, "Name is required"],
      trim: true,
    },
    email: {
      type: String,
      required: [true, "Email is required"],
      unique: true,
      lowercase: true,
      trim: true,
    },
    // Generated in pre('validate'), never typed.
    username: {
      type: String,
      unique: true,
      lowercase: true,
      trim: true,
    },

    // ⚠️ Assign plaintext; the pre('save') hook hashes it. Hashing before assigning
    // double-hashes and the account is permanently unopenable, with no error (B1).
    password: {
      type: String,
      minlength: [
        MIN_PASSWORD_LENGTH,
        `Password must be at least ${MIN_PASSWORD_LENGTH} characters`,
      ],
      select: false,
    },

    status: {
      type: String,
      enum: {
        values: USER_STATUS,
        message: "{VALUE} is not a valid status",
      },
      default: "invited",
    },

    // A SHA-256 hash of the code, never the code itself. See utils/inviteCode.js.
    inviteToken: { type: String, select: false, index: true },
    inviteExpiresAt: { type: Date },

    // ⚠️ Granted roles only. `supervisor` is never stored: it is derived from unit leads.
    roles: {
      type: [
        {
          type: String,
          enum: {
            values: GRANTABLE_ROLES,
            message: "{VALUE} is not a grantable role",
          },
        },
      ],
      default: ["employee"],
    },

    designation: {
      type: String,
      enum: {
        values: DESIGNATION_NAMES,
        message: "{VALUE} is not a recognised designation",
      },
    },
    // Derived from designation in pre('validate').
    jobFamily: {
      type: String,
      enum: {
        values: JOB_FAMILIES,
        message: "{VALUE} is not a valid job family",
      },
    },
    level: { type: String, trim: true },
    location: {
      type: String,
      enum: {
        values: LOCATIONS,
        message: "{VALUE} is not a valid location",
      },
    },

    // Immutable because it decides parGroup, and an appraisal group must never move.
    joinedDate: {
      type: Date,
      required: [true, "Joined date is required"],
      immutable: true,
    },
    probationEndDate: { type: Date },
    parGroup: {
      type: String,
      enum: {
        values: PAR_GROUPS,
        message: "{VALUE} is not a valid appraisal group",
      },
      immutable: true,
    },
  },
  { timestamps: true },
);

// ⚠️ Mongoose 9 hooks take no `next` callback: `function (next)` throws "next is not a function".
userSchema.pre("validate", function () {
  if (this.designation) {
    this.jobFamily = DESIGNATIONS[this.designation];
  }

  if (this.isNew && this.joinedDate && !this.parGroup) {
    this.parGroup = parGroupFor(this.joinedDate);
  }

  // Last word of the name plus the employee ID's digits: ALT-0241 gives nazeer0241.
  if (this.isNew && !this.username && this.name && this.employeeId) {
    const words = this.name.trim().split(/\s+/);
    const lastName = words[words.length - 1].toLowerCase().replace(/[^a-z]/g, "");
    const digits = this.employeeId.replace(/\D/g, "");
    this.username = `${lastName}${digits}`;
  }
});

// ⚠️ The one path a password takes into the database. Without the isModified guard any
// unrelated save re-hashes the hash and locks the user out.
userSchema.pre("save", async function () {
  if (!this.isModified("password")) return;
  if (!this.password) return;

  this.password = await bcrypt.hash(this.password, BCRYPT_COST);
});

userSchema.methods.comparePassword = function (plainText) {
  if (!this.password) return Promise.resolve(false);
  return bcrypt.compare(plainText, this.password);
};

// A query that re-selects the password still cannot leak it through a response.
userSchema.set("toJSON", {
  transform: (doc, ret) => {
    delete ret.password;
    delete ret.inviteToken;
    return ret;
  },
});

const User = mongoose.model("User", userSchema);

module.exports = User;

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
    // -----------------------------------------------------------------------
    // Identity
    // -----------------------------------------------------------------------
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
    // Generated in pre('validate'), never typed by anyone. Login accepts either this
    // or the email address.
    username: {
      type: String,
      unique: true,
      lowercase: true,
      trim: true,
    },

    // -----------------------------------------------------------------------
    // Credentials
    // -----------------------------------------------------------------------
    // NAMED FOR WHAT IS ASSIGNED, NOT WHAT IS STORED. Every write site assigns
    // PLAINTEXT and the pre('save') hook below hashes it. Do not hash before
    // assigning — the hook would hash it a second time and the account would be
    // permanently unopenable, with no error raised anywhere.  (Build decision B1)
    //
    // `select: false` keeps it out of every query result. Login is the only place
    // allowed to ask for it back, via .select("+password").
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

    // Set when HR generates an invite, cleared the moment it is redeemed.
    //
    // This holds a SHA-256 HASH of the code, never the code itself — the raw code
    // exists once, in the response HR reads, and is never stored. `select: false`
    // keeps the hash out of query results; `index: true` is for the redemption
    // lookup, which finds the account BY this field. See utils/inviteCode.js.
    inviteToken: { type: String, select: false, index: true },
    inviteExpiresAt: { type: Date },

    // -----------------------------------------------------------------------
    // Roles
    // -----------------------------------------------------------------------
    // GRANTED roles only. `supervisor` is never stored — it is derived from who
    // leads which unit on a given date. See config/constants.js.
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

    // -----------------------------------------------------------------------
    // Job
    // -----------------------------------------------------------------------
    designation: {
      type: String,
      enum: {
        values: DESIGNATION_NAMES,
        message: "{VALUE} is not a recognised designation",
      },
    },
    // Derived from designation in pre('validate'). Selects the review form.
    jobFamily: {
      type: String,
      enum: {
        values: JOB_FAMILIES,
        message: "{VALUE} is not a valid job family",
      },
    },
    // Free label, e.g. "SE II". A promotion-track indicator; drives nothing.
    level: { type: String, trim: true },
    location: {
      type: String,
      enum: {
        values: LOCATIONS,
        message: "{VALUE} is not a valid location",
      },
    },

    // -----------------------------------------------------------------------
    // Dates
    // -----------------------------------------------------------------------
    // Immutable because it decides parGroup, and an appraisal group must never move
    // once set — moving it changes which cycle a person's history belongs to.
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

// ---------------------------------------------------------------------------
// Derivations — run before validation so the derived values are validated too
// ---------------------------------------------------------------------------
// NOTE: Mongoose 9 middleware does NOT receive a `next` callback — it is
// promise-based. Almost every tutorial online still writes `function (next)` and
// calls `next()`; on this version that throws "next is not a function".
userSchema.pre("validate", function () {
  if (this.designation) {
    this.jobFamily = DESIGNATIONS[this.designation];
  }

  // Set once, on creation only. `immutable: true` blocks later changes anyway;
  // this guard makes the intent explicit.
  if (this.isNew && this.joinedDate && !this.parGroup) {
    this.parGroup = parGroupFor(this.joinedDate);
  }

  // Username: last word of the name + the employee ID's digits.
  //   "Nuzran Nazeer" + ALT-0241  ->  nazeer0241
  // Collision-free because the employee ID is unique by definition.
  if (this.isNew && !this.username && this.name && this.employeeId) {
    const words = this.name.trim().split(/\s+/);
    const lastName = words[words.length - 1].toLowerCase().replace(/[^a-z]/g, "");
    const digits = this.employeeId.replace(/\D/g, "");
    this.username = `${lastName}${digits}`;
  }
});

// ---------------------------------------------------------------------------
// Password hashing — the ONE path a password takes into the database
// ---------------------------------------------------------------------------
// Hashing here rather than in a service means no future write site can forget:
// a seed script, an HR reset and the invite-completion route all pass through it.
//
// The isModified guard is not optional. Without it, any unrelated save — changing
// a designation, say — re-hashes the existing hash and locks the user out forever.
userSchema.pre("save", async function () {
  if (!this.isModified("password")) return;
  if (!this.password) return;

  this.password = await bcrypt.hash(this.password, BCRYPT_COST);
});

userSchema.methods.comparePassword = function (plainText) {
  if (!this.password) return Promise.resolve(false);
  return bcrypt.compare(plainText, this.password);
};

// Belt and braces alongside `select: false`: even if a query explicitly re-selects
// the password, it never survives being turned into JSON for a response.
userSchema.set("toJSON", {
  transform: (doc, ret) => {
    delete ret.password;
    delete ret.inviteToken;
    return ret;
  },
});

const User = mongoose.model("User", userSchema);

module.exports = User;

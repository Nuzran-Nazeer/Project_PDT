const mongoose = require("mongoose");
const { ORG_UNIT_TYPES } = require("../config/constants");

// The company as a tree, shape only. Who belongs to a unit and who leads it are
// separate dated collections, because both change over time.
const orgUnitSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, "Name is required"],
      trim: true,
    },

    // A label, not a level. See config/constants.js for why nothing checks that a
    // sub-unit sits under a unit.
    type: {
      type: String,
      required: [true, "Type is required"],
      enum: {
        values: ORG_UNIT_TYPES,
        message: "{VALUE} is not a valid unit type",
      },
    },

    // null means the root, and exactly one unit may have it. Enforced in the service:
    // a field-level validator sees only this document.
    parentUnitId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "OrgUnit",
      default: null,
      index: true,
    },

    // Set false by discontinueUnit() and nothing else. Never removed: past appraisals
    // were run inside it.
    active: { type: Boolean, default: true },

    // The last day the unit operated, null while live. Without it, "was this unit
    // live in March" would have no answer.
    //
    // ⚠️ Missing from Docs/PDT-DATA-MODEL.md, which still lists four fields here.
    discontinuedOn: { type: Date, default: null },
  },
  { timestamps: true },
);

const OrgUnit = mongoose.model("OrgUnit", orgUnitSchema);

module.exports = OrgUnit;

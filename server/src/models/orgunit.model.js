const mongoose = require("mongoose");
const { ORG_UNIT_TYPES } = require("../config/constants");

// Shape only. Who belongs to a unit and who leads it are separate dated collections.
const orgUnitSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, "Name is required"],
      trim: true,
    },

    // A label, not a level.
    type: {
      type: String,
      required: [true, "Type is required"],
      enum: {
        values: ORG_UNIT_TYPES,
        message: "{VALUE} is not a valid unit type",
      },
    },

    // null means the root. One root only, enforced in the service.
    parentUnitId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "OrgUnit",
      default: null,
      index: true,
    },

    // Set false by discontinueUnit() and nothing else.
    active: { type: Boolean, default: true },

    // The last day the unit operated, null while live.
    discontinuedOn: { type: Date, default: null },
  },
  { timestamps: true },
);

const OrgUnit = mongoose.model("OrgUnit", orgUnitSchema);

module.exports = OrgUnit;

const mongoose = require("mongoose");
const { ORG_UNIT_TYPES } = require("../config/constants");

// The company as a tree. Engineering has Backend, Frontend and Platform beneath it;
// Quality has nothing beneath it and needs nothing. The shape is DATA, so adding a
// layer is a record rather than a code change.  (System spec §0.1, §0.2)
//
// This collection holds the SHAPE only. Who belongs to a unit and who leads it are
// separate dated collections, because both change and every rule in this system is
// about a period. Nothing here says who supervises whom — that is derived from the
// unit-lead history, and it arrives with story 11.
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

    // null means "this is the root". EXACTLY ONE unit may have it, which is what
    // makes the company a single tree rather than several. Enforced in the service,
    // not here: it is a rule about the other documents in the collection, and a
    // field-level validator can only see this one.
    parentUnitId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "OrgUnit",
      default: null,
      index: true,
    },

    // In the design and therefore on the model, but NOTHING SETS IT FALSE YET and no
    // route exposes it. Closing a unit is not specified: what happens to its members,
    // its children and its lead are all open questions, and guessing at them would
    // produce code that looks reasonable and is wrong. It stays true until a story
    // decides.
    active: { type: Boolean, default: true },
  },
  { timestamps: true },
);

const OrgUnit = mongoose.model("OrgUnit", orgUnitSchema);

module.exports = OrgUnit;

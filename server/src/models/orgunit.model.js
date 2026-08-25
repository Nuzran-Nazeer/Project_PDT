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

    // Set false by discontinueUnit() and by nothing else. A discontinued unit is NOT
    // removed: it stays in the tree, and everything recorded about it stays readable,
    // because last year's appraisals were run inside it.
    active: { type: Boolean, default: true },

    // The last day the unit operated. Null while it is live.
    //
    // ⚠️ NOT IN Docs/PDT-DATA-MODEL.md, which lists four fields for this collection.
    // Added 2026-08-25 on Nuzran's decision, and THE DATA MODEL IS OWED THE SAME
    // CHANGE in both copies -- it is his file, not Claude's.
    //
    // Why it earns a field. Without it, closing a unit would be the only undated state
    // change in a system where every other fact is a period with dates on both ends,
    // and "was this unit live in March" would have no answer. With it, and the
    // createdAt that timestamps already provides, the tree can be asked about as at a
    // date like everything else.
    discontinuedOn: { type: Date, default: null },
  },
  { timestamps: true },
);

const OrgUnit = mongoose.model("OrgUnit", orgUnitSchema);

module.exports = OrgUnit;

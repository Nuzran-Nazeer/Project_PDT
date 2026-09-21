const path = require("path");
const Module = require("module");

const SERVER = path.join(__dirname, "..", "server");

// ⚠️ A harness runs from Project_PDT/ but its dependencies are the server's, and `scripts/`
// deliberately has no package.json of its own: a second copy of Mongoose would register the
// models twice. Resolution is pointed at the server instead.
Module.globalPaths.push(path.join(SERVER, "node_modules"));
module.paths.push(path.join(SERVER, "node_modules"));

const mongoose = require(path.join(SERVER, "node_modules", "mongoose"));
require(path.join(SERVER, "node_modules", "dotenv")).config({
  path: path.join(SERVER, ".env"),
});

// ⚠️ Three databases sit on one cluster: `test` for development, `qa` for browser tests and
// `live` for the hosted site. A harness builds and deletes records, so it is pinned to `test`
// and refuses to run anywhere else rather than trusting whatever MONGO_URI happens to name.
const HARNESS_DB = "test";

const connect = async () => {
  const uri = process.env.MONGO_URI;
  if (!uri) {
    throw new Error("MONGO_URI is not set. Copy server/.env.example to server/.env.");
  }

  await mongoose.connect(uri, { dbName: HARNESS_DB });

  if (mongoose.connection.name !== HARNESS_DB) {
    await mongoose.disconnect();
    throw new Error(
      `Refusing to run: connected to "${mongoose.connection.name}", not "${HARNESS_DB}".`,
    );
  }

  return mongoose.connection;
};

// ⚠️ `test` holds real demo data. It is never empty and is never cleared: a harness builds
// its own people and deletes only the ids it created. Nothing reused is ever tracked here.
const tracker = () => {
  const created = [];

  return {
    track(doc) {
      created.push({ model: doc.constructor, id: doc._id });
      return doc;
    },
    async cleanUp() {
      for (const { model, id } of created.reverse()) {
        await model.deleteOne({ _id: id });
      }
    },
  };
};

// Assertions are counted rather than thrown on, so one failure does not hide the rest.
const results = { passed: 0, failed: 0 };

const check = (label, condition, detail) => {
  if (condition) {
    results.passed += 1;
    console.log(`  PASS  ${label}`);
  } else {
    results.failed += 1;
    console.log(`  FAIL  ${label}${detail ? ` — ${detail}` : ""}`);
  }
};

// Every guard in this feature refuses by throwing, so "was it refused" is "did it throw with
// the status we expected". A call that succeeds when it should not is a failure, not an error.
const refuses = async (label, status, fn) => {
  try {
    await fn();
    check(label, false, "it was allowed");
  } catch (err) {
    check(label, err.statusCode === status, `expected ${status}, got ${err.statusCode}`);
  }
};

const report = async (title) => {
  console.log(`\n${title}: ${results.passed} passed, ${results.failed} failed\n`);
  await mongoose.disconnect();
  process.exit(results.failed === 0 ? 0 : 1);
};

module.exports = { connect, tracker, check, refuses, report, HARNESS_DB };

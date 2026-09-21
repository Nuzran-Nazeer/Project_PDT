// Asserts the six criteria of writing a development plan against a published review.
// Run from Project_PDT/ as: node scripts/plan-write.js

const { connect, tracker, check, refuses, report } = require("./harness-guard");

const OrgUnit = require("../server/src/models/orgunit.model");
const User = require("../server/src/models/user.model");
const UnitMembership = require("../server/src/models/unitmembership.model");
const UnitLead = require("../server/src/models/unitlead.model");
const Cycle = require("../server/src/models/cycle.model");
const Review = require("../server/src/models/review.model");
const Plan = require("../server/src/models/plan.model");

const service = require("../server/src/services/plan.service");

const stamp = Date.now().toString().slice(-6);
const track = tracker();

const day = (offset) => {
  const now = new Date();
  return new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + offset),
  );
};

// ⚠️ An employee ID is exactly four digits, so a harness cannot make one unique by stamping
// it. It takes the next free one instead, counting down from the top of the range so a run
// never collides with the demo data, which counts up.
let nextId = 9999;
const freeEmployeeId = async () => {
  for (; nextId > 9000; nextId -= 1) {
    const candidate = `ALT-${nextId}`;
    if (!(await User.exists({ employeeId: candidate }))) {
      nextId -= 1;
      return candidate;
    }
  }
  throw new Error("No free employee ID in the harness range");
};

let seq = 0;
const person = async (name, designation) => {
  seq += 1;
  return track.track(
    // ⚠️ Own people only. Nothing reused from the demo data is ever created or deleted here.
    await User.create({
      employeeId: await freeEmployeeId(),
      name,
      email: `pdp.${stamp}.${seq}@harness.invalid`,
      designation,
      location: "Colombo",
      joinedDate: new Date("2020-01-15"),
      status: "active",
    }),
  );
};

const run = async () => {
  await connect();

  // A unit of its own, led by one supervisor, so nothing here depends on the demo tree.
  const unit = track.track(
    await OrgUnit.create({ name: `Harness unit ${stamp}`, type: "unit" }),
  );
  const otherUnit = track.track(
    await OrgUnit.create({ name: `Harness unit ${stamp}b`, type: "unit" }),
  );

  const supervisor = await person("Harness Supervisor", "Tech Lead");
  const stranger = await person("Harness Stranger", "Tech Lead");
  const employee = await person("Harness Employee", "Software Engineer");
  const unpublished = await person("Harness Unpublished", "Software Engineer");
  const formerly = await person("Harness Formerly", "Software Engineer");

  track.track(
    await UnitLead.create({ unitId: unit._id, userId: supervisor._id, from: day(-400) }),
  );
  track.track(
    await UnitLead.create({
      unitId: otherUnit._id,
      userId: stranger._id,
      from: day(-400),
    }),
  );

  for (const member of [supervisor, employee, unpublished]) {
    track.track(
      await UnitMembership.create({
        userId: member._id,
        unitId: unit._id,
        from: day(-400),
      }),
    );
  }

  // Supervised last year and not now: their membership of the unit has already ended.
  track.track(
    await UnitMembership.create({
      userId: formerly._id,
      unitId: unit._id,
      from: day(-400),
      to: day(-30),
    }),
  );

  const cycle = track.track(
    await Cycle.create({
      parGroup: employee.parGroup,
      year: 2099,
      startDate: day(-300),
      endDate: day(-10),
      status: "published",
    }),
  );

  const reviewFor = async (user, status) =>
    track.track(
      await Review.create({
        cycleId: cycle._id,
        userId: user._id,
        status,
        publishedAt: status === "published" ? day(-5) : null,
        snapshot: { jobFamily: user.jobFamily },
      }),
    );

  const published = await reviewFor(employee, "published");
  const draftReview = await reviewFor(unpublished, "normalising");
  const formerReview = await reviewFor(formerly, "published");

  const actor = { id: String(supervisor._id) };
  const intruder = { id: String(stranger._id) };

  // 1 · A plan starts from a published review, and a second attempt opens the same plan.
  const plan = await service.startPlanFromReview(String(published._id), actor);
  check("1 · a plan starts from a published review", plan.status === "draft");

  const again = await service.startPlanFromReview(String(published._id), actor);
  check(
    "1 · a second attempt opens the plan already there",
    again.id === plan.id &&
      (await Plan.countDocuments({ reviewId: published._id })) === 1,
  );
  track.track(await Plan.findById(plan.id));

  // ⚠️ The database constraint is tested by writing straight to the collection: through the
  // service the existing-plan read answers first and the index is never reached.
  try {
    await Plan.collection.insertOne({
      userId: employee._id,
      reviewId: published._id,
      type: "PDP",
      status: "draft",
      createdBy: supervisor._id,
      actions: [],
      checkIns: [],
    });
    check(
      "1 · the database refuses a second plan on one review",
      false,
      "it was allowed",
    );
  } catch (err) {
    check("1 · the database refuses a second plan on one review", err.code === 11000);
  }

  // 2 · Refused where the review is not published, and where supervision is not today's.
  await refuses("2 · refused where the review is not published", 409, () =>
    service.startPlanFromReview(String(draftReview._id), actor),
  );
  await refuses("2 · refused where the actor does not supervise them today", 403, () =>
    service.startPlanFromReview(String(published._id), intruder),
  );
  await refuses("2 · refused for somebody supervised last year and not now", 403, () =>
    service.startPlanFromReview(String(formerReview._id), actor),
  );

  // 3 · An action saves only when every field is there, and the response names all the gaps.
  const competency = plan.competencies[0].key;
  const complete = {
    description: "Own the delivery schedule for one project",
    category: "taking_ownership",
    fromCompetency: competency,
    ownerId: String(employee._id),
    targetDate: day(90),
    successCriteria: "The schedule is current and reviewed weekly for two quarters",
  };

  try {
    await service.addAction(plan.id, actor, { category: "not_a_category" });
    check("3 · an incomplete action is refused", false, "it was allowed");
  } catch (err) {
    const named = err.details || [];
    check(
      "3 · an incomplete action is refused naming every empty field",
      err.statusCode === 400 &&
        [
          "description",
          "category",
          "ownerId",
          "targetDate",
          "successCriteria",
          "fromCompetency",
        ].every((field) => named.includes(field)),
      `named ${named.join(", ")}`,
    );
  }

  await refuses("3 · a competency outside that review is refused", 400, () =>
    service.addAction(plan.id, actor, {
      ...complete,
      fromCompetency: "strategic_thinking",
    }),
  );
  await refuses("3 · an owner who is neither the employee nor the supervisor", 400, () =>
    service.addAction(plan.id, actor, { ...complete, ownerId: String(stranger._id) }),
  );

  const withAction = await service.addAction(plan.id, actor, complete);
  check("3 · a complete action saves", withAction.actions.length === 1);

  const supervisorOwned = await service.addAction(plan.id, actor, {
    ...complete,
    description: "Run a design review for the team each month",
    category: "mentoring",
    ownerId: String(supervisor._id),
  });
  check(
    "3 · the supervisor may own an action",
    supervisorOwned.actions.length === 2 &&
      supervisorOwned.actions.some((a) => a.owner.id === String(supervisor._id)),
  );

  // 6 · The supervisor's view shows the competency and the owner against each action.
  const seen = await service.getPlanForSupervisor(plan.id, actor);
  check(
    "6 · every action shows the competency it came from and who owns it",
    seen.actions.every((a) => a.fromCompetency && a.competencyName && a.owner?.name),
  );

  // 4 · A draft stays editable; sharing is refused while there are no actions; a shared
  // plan is no longer editable.
  const edited = await service.editAction(plan.id, seen.actions[0].id, actor, {
    ...complete,
    description: "Own the delivery schedule for two projects",
  });
  check(
    "4 · a draft is editable",
    edited.actions.some((a) => a.description.endsWith("two projects")),
  );

  const emptyPlan = await service.startPlanFromReview(String(published._id), actor);
  for (const action of emptyPlan.actions) {
    await service.removeAction(emptyPlan.id, action.id, actor);
  }
  await refuses("4 · sharing is refused while the plan has no actions", 409, () =>
    service.sharePlan(emptyPlan.id, actor),
  );

  await service.addAction(plan.id, actor, complete);
  const shared = await service.sharePlan(plan.id, actor);
  check(
    "4 · sharing moves the plan to awaiting acknowledgement",
    shared.status === "awaiting_ack" && Boolean(shared.sharedAt) && !shared.canEdit,
  );
  await refuses("4 · a shared plan is no longer editable", 409, () =>
    service.addAction(plan.id, actor, complete),
  );

  // 5 · The team list marks each person owed, draft or shared, and leaves out anybody
  // supervised last year and not now.
  const listed = await service.teamPlans(String(supervisor._id));
  const byId = new Map(listed.people.map((p) => [p.id, p]));

  check(
    "5 · a person with a shared plan is listed as shared",
    byId.get(String(employee._id))?.state === "shared",
  );
  check(
    "5 · a person whose review is not published is absent",
    !byId.has(String(unpublished._id)),
  );
  check(
    "5 · a person supervised last year and not now is absent",
    !byId.has(String(formerly._id)),
  );

  // The owed state, shown on a second person whose review is published and has no plan.
  const owedPerson = await person("Harness Owed", "Software Engineer");
  track.track(
    await UnitMembership.create({
      userId: owedPerson._id,
      unitId: unit._id,
      from: day(-400),
    }),
  );
  await reviewFor(owedPerson, "published");

  const relisted = await service.teamPlans(String(supervisor._id));
  check(
    "5 · a person with a published review and no plan is listed as owed",
    relisted.people.find((p) => p.id === String(owedPerson._id))?.state === "owed",
  );
  const owedReview = await Review.findOne({
    userId: owedPerson._id,
    status: "published",
  });
  const drafted = await service.startPlanFromReview(String(owedReview._id), actor);
  track.track(await Plan.findById(drafted.id));

  const withDraft = await service.teamPlans(String(supervisor._id));
  check(
    "5 · a person whose plan is still a draft is listed as draft",
    withDraft.people.find((p) => p.id === String(owedPerson._id))?.state === "draft",
  );
};

run()
  .catch((err) => check("the harness ran to completion", false, err.message))
  .finally(async () => {
    // ⚠️ Only the ids this run created. Nothing else in `test` is touched.
    await track.cleanUp();
    await report("P1 · write a development plan");
  });

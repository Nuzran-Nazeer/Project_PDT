// Accounts from the qa seed, named by the part they play rather than by person, so a test
// reads as what it is testing.
//
// ⚠️ Read-only. The seed is the suite's fixed ground truth and no test may edit one of these
// records: a cast that changes underneath the suite is a failure nobody can reproduce. A test
// that needs a record in some other state provisions its own — see support/api.js.

export const SEEDED = {
  // ALT-1001. Holds `employee` alone and leads no unit, so the plainest landing there is.
  employee: {
    email: "employee@altrium.test",
    username: "employee1001",
    dashboard: "Employee dashboard",
  },

  // ALT-1003. Holds head_of_hr, hr and employee, and leads a unit as well, so four groups
  // resolve to one landing page: the case "highest role wins" is actually about.
  headOfHr: {
    email: "headhr@altrium.test",
    dashboard: "Head of HR dashboard",
  },

  // ALT-1002. An HR officer, so coverage applies to them: what they may do depends on
  // which units they cover, unlike the Head of HR.
  hr: {
    email: "hr@altrium.test",
    dashboard: "HR officer dashboard",
  },

  // ALT-3021. Created but never activated, so it has no password at all.
  invited: {
    email: "yohan.gomes@altrium.test",
  },
};

// Nobody at all. ⚠️ Must stay absent from the seed: the case it serves is that an unknown
// address is refused in exactly the words a known one is.
export const UNKNOWN_EMAIL = "no.such.person@altrium.test";

// Every demo account in the qa database shares one password (tests/.env).
export const PASSWORD = process.env.DEMO_PASSWORD;

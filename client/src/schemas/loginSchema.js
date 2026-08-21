import * as yup from "yup";

// Shape only. Whether the account exists, whether the password is right, and
// whether the account is active are all the server's business — and it answers
// all three with the same message on purpose, so nobody can probe which email
// addresses belong to staff.
//
// No minimum length on the password here. The server enforces 8 characters when
// a password is SET; enforcing it at sign-in would tell anyone with an older
// short password that their account exists.
export const loginSchema = yup.object({
  identifier: yup.string().trim().required("Enter your email address or username"),
  password: yup.string().required("Enter your password"),
});

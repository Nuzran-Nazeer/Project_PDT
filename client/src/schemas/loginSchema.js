import * as yup from "yup";

// Shape only. No minimum length on the password: the server enforces 8 when a
// password is SET, and enforcing it at sign-in would tell anyone with an older short
// password that their account exists.
export const loginSchema = yup.object({
  identifier: yup.string().trim().required("Enter your email address or username"),
  password: yup.string().required("Enter your password"),
});

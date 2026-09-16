import * as yup from "yup";

// ⚠️ No minimum length at sign-in: it would reveal that an account exists.
export const loginSchema = yup.object({
  identifier: yup.string().trim().required("Enter your email address or username"),
  password: yup.string().required("Enter your password"),
});

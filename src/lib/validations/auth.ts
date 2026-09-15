import { z } from "zod";
import { isValidStudentCode, isValidThaiCitizenId } from "./identifiers";
import { checkPasswordPolicy } from "./password";

// ข้อความ error เป็น key ของ next-intl (validation.*) — แปลที่ฝั่ง UI

export const requiredText = (max = 200) =>
  z.string().trim().min(1, "validation.required").max(max, "validation.tooLong");

export const optionalText = (max = 200) =>
  z
    .string()
    .trim()
    .max(max, "validation.tooLong")
    .optional()
    .transform((v) => (v ? v : undefined));

export const emailField = z
  .string()
  .trim()
  .toLowerCase()
  .min(1, "validation.required")
  .max(254, "validation.tooLong")
  .pipe(z.email("validation.email"));

const phoneField = z
  .string()
  .trim()
  .min(1, "validation.required")
  .regex(/^[0-9+\-\s()]{9,20}$/, "validation.phone");

export const consentField = z.boolean().refine((v) => v === true, "validation.consent");

function addPasswordIssues(ctx: z.RefinementCtx, password: string, path: string, email?: string) {
  for (const issue of checkPasswordPolicy(password, email)) {
    ctx.addIssue({ code: "custom", message: `validation.password.${issue}`, path: [path] });
  }
}

function addMismatchIssue(ctx: z.RefinementCtx, a: string, b: string, path: string) {
  if (a !== b)
    ctx.addIssue({ code: "custom", message: "validation.passwordMismatch", path: [path] });
}

export const loginSchema = z.object({
  email: emailField,
  password: z.string().min(1, "validation.required").max(200, "validation.tooLong"),
  remember: z.boolean().default(false),
});

export const ORG_TYPES = [
  "PRIVATE_COMPANY",
  "GOVERNMENT",
  "STATE_ENTERPRISE",
  "EDUCATION",
  "OTHER",
] as const;

export const registerOrganizationSchema = z
  .object({
    nameTh: requiredText(),
    nameEn: optionalText(),
    taxId: z
      .string()
      .transform((v) => v.replace(/\D/g, ""))
      .pipe(z.string().regex(/^\d{13}$/, "validation.taxId")),
    orgType: z.enum(ORG_TYPES, "validation.required"),
    address: requiredText(500),
    contactName: requiredText(),
    position: optionalText(),
    email: emailField,
    phone: phoneField,
    password: z.string(),
    confirmPassword: z.string(),
    consent: consentField,
  })
  .superRefine((data, ctx) => {
    addPasswordIssues(ctx, data.password, "password", data.email);
    addMismatchIssue(ctx, data.password, data.confirmPassword, "confirmPassword");
  });

export const registerAlumniSchema = z
  .object({
    studentCode: z.string().trim().refine(isValidStudentCode, "validation.studentCode"),
    citizenId: z
      .string()
      .transform((v) => v.replace(/\D/g, ""))
      .refine(isValidThaiCitizenId, "validation.citizenId"),
    email: emailField,
    password: z.string(),
    confirmPassword: z.string(),
    consent: consentField,
  })
  .superRefine((data, ctx) => {
    addPasswordIssues(ctx, data.password, "password", data.email);
    addMismatchIssue(ctx, data.password, data.confirmPassword, "confirmPassword");
  });

export const forgotPasswordSchema = z.object({ email: emailField });

export const resendVerificationSchema = z.object({ email: emailField });

export const resetPasswordSchema = z
  .object({
    token: z.string().min(1, "validation.required"),
    password: z.string(),
    confirmPassword: z.string(),
  })
  .superRefine((data, ctx) => {
    addPasswordIssues(ctx, data.password, "password");
    addMismatchIssue(ctx, data.password, data.confirmPassword, "confirmPassword");
  });

export const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, "validation.required"),
    newPassword: z.string(),
    confirmPassword: z.string(),
  })
  .superRefine((data, ctx) => {
    addPasswordIssues(ctx, data.newPassword, "newPassword");
    addMismatchIssue(ctx, data.newPassword, data.confirmPassword, "confirmPassword");
  });

export const profileSchema = z.object({
  name: requiredText(),
  position: optionalText(),
  phone: z
    .string()
    .trim()
    .regex(/^([0-9+\-\s()]{9,20})?$/, "validation.phone")
    .optional()
    .transform((v) => (v ? v : undefined)),
  locale: z.enum(["th", "en"]),
});

export type LoginInput = z.input<typeof loginSchema>;
export type RegisterOrganizationInput = z.input<typeof registerOrganizationSchema>;
export type RegisterAlumniInput = z.input<typeof registerAlumniSchema>;
export type ForgotPasswordInput = z.input<typeof forgotPasswordSchema>;
export type ResetPasswordInput = z.input<typeof resetPasswordSchema>;
export type ChangePasswordInput = z.input<typeof changePasswordSchema>;
export type ProfileInput = z.input<typeof profileSchema>;

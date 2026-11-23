import { z } from "zod";

export const licenseKeySchema = z.object({
  key: z.string().trim().min(1, "Enter your license key").max(200, "That key is too long"),
});

export const modeSchema = z.enum(["fast", "balanced", "premium"]);
export const durationSchema = z.union([
  z.literal(15),
  z.literal(30),
  z.literal(45),
  z.literal(60),
  z.literal(90),
]);

export const aiConfigSchema = z
  .object({
    provider: z.string().min(1).max(40),
    model: z.string().min(1, "Choose or type a model").max(200),
    baseUrl: z.string().trim().max(400).optional().default(""),
    apiKey: z.string().trim().max(500).optional(),
    keyMode: z.enum(["stored", "session", "none"]).optional().default("stored"),
  })
  .refine((v) => !/^data:/i.test(v.apiKey ?? ""), { message: "That does not look like an API key" });

export const providerTestSchema = z.object({
  provider: z.string().min(1).max(40),
  model: z.string().trim().max(200).optional().default(""),
  baseUrl: z.string().trim().max(400).optional().default(""),
  apiKey: z.string().trim().max(500).optional(),
  keyMode: z.enum(["stored", "session", "none"]).optional().default("stored"),
});

export const jobCreateSchema = z.object({
  niche: z
    .string()
    .trim()
    .min(2, "Tell us your niche")
    .max(400, "Keep the niche under 400 characters"),
  duration: durationSchema.default(30),
  mode: modeSchema.default("balanced"),
  referenceType: z.enum(["file", "youtube", "transcript"]),
  fileId: z.string().trim().max(100).optional(),
  youtubeUrl: z.string().trim().max(500).optional(),
  transcript: z.string().trim().max(120_000).optional(),
  referenceTitle: z.string().trim().max(300).optional(),
});

export const scriptPatchSchema = z
  .object({
    title: z.string().trim().min(1).max(200).optional(),
    body: z.string().trim().min(1).max(60_000).optional(),
  })
  .refine((v) => v.title !== undefined || v.body !== undefined, {
    message: "Nothing to update",
  });

export const actionSchema = z.object({
  action: z.enum([
    "regenerate",
    "new_version",
    "improve_hook",
    "more_engaging",
    "shorten",
    "expand",
  ]),
});

export const adminLoginSchema = z.object({
  password: z.string().min(1, "Enter the admin password").max(300),
});

export const adminLicenseCreateSchema = z.object({
  label: z.string().trim().max(120).optional().default(""),
  quantity: z.coerce.number().int().min(1).max(50).default(1),
  expiresInDays: z.coerce.number().int().min(0).max(3650).default(0),
  generationLimit: z.coerce.number().int().min(0).max(100000).default(0),
  notes: z.string().trim().max(500).optional().default(""),
});

export const adminLicensePatchSchema = z
  .object({
    action: z.enum(["revoke", "activate", "delete", "update"]).optional(),
    label: z.string().trim().max(120).optional(),
    expiresInDays: z.coerce.number().int().min(0).max(3650).optional(),
    clearExpiry: z.boolean().optional(),
    generationLimit: z.coerce.number().int().min(0).max(100000).optional(),
    notes: z.string().trim().max(500).optional(),
  })
  .refine((v) => v.action !== undefined || v.label !== undefined || v.expiresInDays !== undefined || v.generationLimit !== undefined || v.notes !== undefined || v.clearExpiry === true, {
    message: "Nothing to update",
  });

export const settingsSchema = z.object({
  license_generation_limit_default: z.coerce.number().int().min(0).max(100000).optional(),
  license_validity_days_default: z.coerce.number().int().min(0).max(3650).optional(),
  max_upload_mb: z.coerce.number().int().min(1).max(1024).optional(),
});

export const youtubeSchema = z.object({
  url: z.string().trim().min(5, "Paste a YouTube link").max(500),
});

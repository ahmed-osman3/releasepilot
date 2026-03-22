import { z } from "zod";

const envSchema = z.object({
  ENCRYPTION_MASTER_KEY: z
    .string()
    .length(64, "ENCRYPTION_MASTER_KEY must be exactly 64 hex characters (32 bytes)")
    .regex(/^[0-9a-f]+$/i, "ENCRYPTION_MASTER_KEY must be a hex string"),

  DATABASE_PATH: z.string().optional(),

  PORT: z.coerce
    .number({ message: "PORT must be a number" })
    .int()
    .min(1)
    .max(65535)
    .default(3000),
});

export type Env = z.infer<typeof envSchema>;

function parseEnv(): Env {
  const result = envSchema.safeParse(process.env);

  if (!result.success) {
    const errors = result.error.issues
      .map((issue) => `  ${issue.path.join(".")}: ${issue.message}`)
      .join("\n");
    throw new Error(`Invalid environment variables:\n${errors}`);
  }

  return result.data;
}

export const env = parseEnv();

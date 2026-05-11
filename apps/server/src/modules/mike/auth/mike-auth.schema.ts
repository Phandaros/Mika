import { z } from "zod";

export const mikeAuthLoginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1)
});

export type MikeAuthLoginInput = z.infer<typeof mikeAuthLoginSchema>;

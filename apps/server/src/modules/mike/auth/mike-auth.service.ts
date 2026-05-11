import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { env } from "../../../config/env.js";
import { Role, type Role as RoleValue } from "../../../lib/enums.js";
import { prisma } from "../../../lib/prisma.js";
import { AppError } from "../../../middleware/errorHandler.js";
import type { JwtUser } from "../../../middleware/auth.js";
import type { MikeAuthLoginInput } from "./mike-auth.schema.js";

const MIKE_TOKEN_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const MIKE_TOKEN_EXPIRES_IN = "7d";

function normalizeJwtRole(role: string): RoleValue {
  return Object.values(Role).includes(role as RoleValue) ? (role as RoleValue) : Role.DESIGNER;
}

function toJwtUser(user: { id: string; email: string; name: string; role: string }): JwtUser {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    role: normalizeJwtRole(user.role)
  };
}

export async function loginMikeUser(input: MikeAuthLoginInput): Promise<{
  token: string;
  user: JwtUser;
  expiresAt: string;
}> {
  const user = await prisma.user.findUnique({
    where: { email: input.email },
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      isActive: true,
      passwordHash: true
    }
  });

  if (!user?.passwordHash) {
    throw new AppError(401, "Invalid credentials");
  }

  if (!user.isActive) {
    throw new AppError(401, "Inactive user");
  }

  const passwordMatches = await bcrypt.compare(input.password, user.passwordHash);

  if (!passwordMatches) {
    throw new AppError(401, "Invalid credentials");
  }

  const jwtUser = toJwtUser(user);
  const token = jwt.sign(jwtUser, env.JWT_ACCESS_SECRET, { expiresIn: MIKE_TOKEN_EXPIRES_IN });
  const expiresAt = new Date(Date.now() + MIKE_TOKEN_TTL_MS).toISOString();

  return { token, user: jwtUser, expiresAt };
}

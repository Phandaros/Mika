import type { RequestHandler } from "express";
import { getAuthUser } from "../../../middleware/auth.js";
import { loginMikeUser } from "./mike-auth.service.js";
import type { MikeAuthLoginInput } from "./mike-auth.schema.js";

export const login: RequestHandler = async (req, res, next) => {
  try {
    const result = await loginMikeUser(req.body as MikeAuthLoginInput);

    res.json(result);
  } catch (error) {
    next(error);
  }
};

export const me: RequestHandler = (req, res, next) => {
  try {
    res.json(getAuthUser(req));
  } catch (error) {
    next(error);
  }
};

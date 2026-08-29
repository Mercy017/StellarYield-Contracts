import type { Request, Response, NextFunction } from "express";
import { AppError, ErrorCode } from "./errors.js";
import { config } from "../../config.js";

export function queryTimeoutMiddleware() {
  return (req: Request, _res: Response, next: NextFunction) => {
    const routePath = req.route?.path ?? req.path;
    const fullRoute = `${req.baseUrl}${routePath}`;
    const timeoutMs = config.routeQueryTimeoutsMs[fullRoute] ?? config.queryTimeoutMs;
    req.queryTimeoutMs = timeoutMs;
    next();
  };
}

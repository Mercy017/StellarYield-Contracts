import cors from "cors";
import express, { type Express } from "express";
import { config } from "./config.js";
import { healthRouter } from "./api/routes/health.js";
import { vaultsRouter } from "./api/routes/vaults.js";
import { usersRouter } from "./api/routes/users.js";
import { yieldsRouter } from "./api/routes/yields.js";
import { adminRouter } from "./api/routes/admin.js";
import { webhooksRouter } from "./api/routes/webhooks.js";
import { errorHandler } from "./api/middleware/errors.js";
import { publicLimiter, authLimiter } from "./api/middleware/rateLimit.js";
import { staticCacheMiddleware, cacheResponse, getCachedResponse } from "./api/middleware/responseCache.js";
import { queryTimeoutMiddleware } from "./api/middleware/queryTimeout.js";

// Cache static responses at startup
function initStaticCache(): void {
  const openapiSpec = {
    openapi: "3.0.3",
    info: { title: "StellarYield API", version: "1.0.0" },
    paths: {},
  };
  cacheResponse("openapi.json", openapiSpec, 200, { "Content-Type": "application/json" });

  const changelog = { version: "1.0.0", changes: [] };
  cacheResponse("changelog", changelog, 200, { "Content-Type": "application/json" });
}

initStaticCache();

export function createApp(): Express {
  const app = express();

  app.use(express.json());

  const origins = config.allowedOrigins;
  if (origins.length > 0) {
    const origin = origins.length === 1 && origins[0] === "*" ? "*" : origins;
    app.use(cors({ 
      origin,
      maxAge: config.cors.maxAge,
    }));
  }

  // Static cached endpoints — served from in-process memory
  app.get("/api/v1/openapi.json", staticCacheMiddleware("openapi.json"), (_req, res) => {
    const cached = getCachedResponse("openapi.json")!;
    res.set(cached.headers).status(cached.statusCode).send(cached.body);
  });

  app.get("/api/changelog", staticCacheMiddleware("changelog"), (_req, res) => {
    const cached = getCachedResponse("changelog")!;
    res.set(cached.headers).status(cached.statusCode).send(cached.body);
  });

  // Apply query timeout middleware to data routes
  app.use("/api/v1/vaults", queryTimeoutMiddleware());
  app.use("/api/v1/yields", queryTimeoutMiddleware());
  app.use("/api/v1/users", queryTimeoutMiddleware());

  app.use("/health", publicLimiter, healthRouter);
  app.use("/api/v1/vaults", publicLimiter, vaultsRouter);
  app.use("/api/v1/users", publicLimiter, usersRouter);
  app.use("/api/v1/yields", publicLimiter, yieldsRouter);
  app.use("/api/v1/admin", authLimiter, adminRouter);
  app.use("/api/v1/webhooks", authLimiter, webhooksRouter);

  app.use(errorHandler);

  return app;
}

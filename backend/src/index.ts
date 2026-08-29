import { createApp } from "./app.js";
import { config } from "./config.js";
import { logger } from "./logger.js";
import { indexer } from "./services/indexerSingleton.js";
import { invalidateCache, cacheResponse } from "./api/middleware/responseCache.js";

const app = createApp();

const server = app.listen(config.port, () => {
  // HTTP keep-alive tuning — hold connections above typical 60s LB idle timeout
  server.keepAliveTimeout = 65_000;
  server.headersTimeout = 66_000;

  logger.info(
    {
      port: config.port,
      env: config.nodeEnv,
      keepAliveTimeout: server.keepAliveTimeout,
      headersTimeout: server.headersTimeout,
    },
    "StellarYield backend started",
  );
  void indexer.start();
});

// Reload static response cache on SIGHUP
process.on("SIGHUP", () => {
  logger.info("SIGHUP received — reloading static response cache");
  invalidateCache();

  const openapiSpec = {
    openapi: "3.0.3",
    info: { title: "StellarYield API", version: "1.0.0" },
    paths: {},
  };
  cacheResponse("openapi.json", openapiSpec, 200, { "Content-Type": "application/json" });

  const changelog = { version: "1.0.0", changes: [] };
  cacheResponse("changelog", changelog, 200, { "Content-Type": "application/json" });
});

process.on("SIGTERM", () => {
  indexer.stop();
  server.close(() => {
    logger.info("StellarYield backend stopped");
  });
});

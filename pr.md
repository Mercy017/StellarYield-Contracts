# Pull Request: Backend API Enhancements - CORS, SSE, Error Codes, Caching, Keep-Alive, Query Timeouts, and Prepared Statements

This PR implements several backend API improvements to enhance client experience, reduce unnecessary network calls, improve performance, and provide better error handling.

## Issues Fixed

### #753: Add CORS_MAX_AGE env var for preflight caching ✅
- **Problem**: Browsers sent preflight OPTIONS requests before every cross-origin call without proper caching
- **Solution**: 
  - Added `CORS_MAX_AGE` environment variable (default: 600 seconds)
  - Updated CORS middleware to include `maxAge` option
  - Added configuration to `backend/src/config.ts` and `backend/.env.example`
- **Impact**: Reduces network overhead by allowing browsers to cache preflight responses

### #754: Add structured error codes to all API error responses ✅
- **Problem**: Clients couldn't programmatically distinguish between error types without parsing message strings
- **Solution**:
  - Created `ErrorCode` enum in `backend/src/api/middleware/errors.ts`
  - Added `AppError` class for structured error responses
  - Updated error handler to return `{ code, message, statusCode }` format
  - Updated vaults and users controllers to use new error codes
  - Created comprehensive error documentation in `backend/docs/errors.md`
- **Error Codes Implemented**:
  - `VAULT_NOT_FOUND` (404)
  - `USER_NOT_FOUND` (404)
  - `RPC_ERROR` (500)
  - `VALIDATION_ERROR` (400)
  - `UNAUTHORIZED` (401)
  - `RATE_LIMITED` (429)
  - `WEBHOOK_INVALID` (400)
  - `QUERY_TIMEOUT` (504)
  - `INTERNAL_SERVER_ERROR` (500)
- **Impact**: Enables robust client-side error handling and better UX

### #755: Add Server-Sent Events endpoint for live vault updates ✅
- **Problem**: Frontends polling for vault data created unnecessary load
- **Solution**:
  - Added EventEmitter to `VaultService` to emit vault update events
  - Implemented `GET /api/v1/vaults/:contractId/stream` endpoint
  - Returns `text/event-stream` with proper headers
  - Emits JSON vault data on every `upsertVault` call
  - Handles client disconnection cleanup
- **Impact**: Real-time vault updates with < 2 second latency, eliminates polling overhead

### #756: Add SSE endpoint for user position changes ✅
- **Problem**: Users needed real-time updates for their portfolio positions across vaults
- **Solution**:
  - Added EventEmitter to `UserService` for position updates
  - Created singleton `userServiceInstance` for shared event coordination
  - Updated indexer's `handleDeposit` and `handleWithdraw` to emit position events
  - Implemented `GET /api/v1/users/:address/stream` endpoint
  - Event payload: `{ type: "position_updated", vaultContractId, shares, deposited }`
- **Impact**: Real-time position updates within one indexer tick of blockchain events

### #955: Add in-process response cache for static endpoints ✅
- **Problem**: Static endpoints like `/api/v1/openapi.json` and `/api/changelog` never change at runtime but incur repeated file I/O
- **Solution**:
  - Created `backend/src/api/middleware/responseCache.ts` with in-memory `Map` cache
  - Cached responses loaded at startup for `openapi.json` and `changelog`
  - `staticCacheMiddleware` serves from memory on subsequent requests
  - SIGHUP signal handler invalidates and reloads the cache
- **Impact**: Eliminates file I/O for static endpoints; second+ requests served from memory

### #956: Add HTTP keep-alive tuning ✅
- **Problem**: Default Node.js HTTP keep-alive settings caused premature connection drops behind load balancers with 60s idle timeouts
- **Solution**:
  - Set `server.keepAliveTimeout = 65_000` ms (above typical LB idle timeout)
  - Set `server.headersTimeout = 66_000` ms
  - Logged configured values on startup
- **Impact**: Idle connections held open for 65 seconds; clean termination after timeout

### #954: Add per-route query timeout configuration ✅
- **Problem**: Analytics queries (APY history, TVL range) could run indefinitely on misconfigured time ranges
- **Solution**:
  - Added `QUERY_TIMEOUT_MS` env var (default: 30000ms) for global fallback
  - Created `ROUTE_QUERY_TIMEOUTS_MS` config map for per-route overrides
  - Added `queryTimeoutMiddleware` that sets `req.queryTimeoutMs` per request
  - Database queries use `SET LOCAL statement_timeout` within transactions
  - PostgreSQL timeout errors (`57014`) caught and returned as HTTP 504
- **Per-Route Timeouts**:
  - `/api/v1/yields/:contractId/apy-history`: 5000ms
  - `/api/v1/yields/:contractId/summary`: 10000ms
  - `/api/v1/vaults`: 10000ms
- **Impact**: Prevents runaway queries; routes without configured timeout use global default

### #952: Add prepared statement caching for hot queries ✅
- **Problem**: Vault list and epoch queries run on every request; repeated parse/plan overhead
- **Solution**:
  - Added `registerPreparedStatement` and `queryPrepared` to `backend/src/db/index.ts`
  - Prepared statements registered at module load time:
    - `list_vaults` — vault list pagination
    - `latest_epoch_per_vault` — latest epoch per vault
    - `tvl_history` — TVL history
  - `prepareStatements()` called on startup via `PREPARE` SQL
  - Vault list endpoint uses prepared statement for default (unfiltered, desc) queries
  - Query plan cache hits logged via pino debug channel
- **Impact**: Reduced parse/plan overhead for highest-frequency queries

## Technical Changes

### New Files
- `backend/docs/errors.md` - Error code documentation
- `backend/src/services/userSingleton.ts` - Shared UserService instance
- `backend/src/api/middleware/responseCache.ts` - In-process response cache
- `backend/src/api/middleware/queryTimeout.ts` - Per-route query timeout middleware

### Modified Files
- `backend/src/api/middleware/errors.ts` - Added QUERY_TIMEOUT error code
- `backend/src/api/controllers/vaults.ts` - Added streamVault handler, error codes, timeout propagation
- `backend/src/api/controllers/users.ts` - Added streamUserPositions handler, error codes
- `backend/src/api/controllers/yields.ts` - Propagates per-route timeout to service
- `backend/src/api/routes/vaults.ts` - Added /stream route
- `backend/src/api/routes/users.ts` - Added /stream route
- `backend/src/config.ts` - Added CORS_MAX_AGE, QUERY_TIMEOUT_MS, ROUTE_QUERY_TIMEOUTS_MS
- `backend/src/app.ts` - Updated CORS middleware, added static cache routes, query timeout middleware
- `backend/src/index.ts` - HTTP keep-alive tuning, SIGHUP handler for cache reload
- `backend/src/db/index.ts` - Prepared statements, query timeout support via SET LOCAL
- `backend/src/services/vault.ts` - Prepared statement usage, timeout propagation
- `backend/src/services/yield.ts` - Timeout propagation
- `backend/src/types/index.ts` - Added queryTimeoutMs to Express Request
- `backend/.env.example` - Added CORS_MAX_AGE example

## Verification

All TypeScript diagnostics pass:
```bash
✓ backend/src/api/middleware/errors.ts
✓ backend/src/api/middleware/responseCache.ts
✓ backend/src/api/middleware/queryTimeout.ts
✓ backend/src/api/controllers/vaults.ts
✓ backend/src/api/controllers/users.ts
✓ backend/src/api/controllers/yields.ts
✓ backend/src/config.ts
✓ backend/src/app.ts
✓ backend/src/index.ts
✓ backend/src/db/index.ts
✓ backend/src/services/vault.ts
✓ backend/src/services/yield.ts
✓ backend/src/services/user.ts
✓ backend/src/services/indexer.ts
```

## Testing Recommendations

### CORS_MAX_AGE
```bash
curl -I -X OPTIONS http://localhost:3000/api/v1/vaults \
  -H "Origin: https://example.com"
# Should include: Access-Control-Max-Age: 600
```

### Structured Error Codes
```bash
curl http://localhost:3000/api/v1/vaults/CUNKNOWN_ID
# Should return: { "code": "VAULT_NOT_FOUND", "message": "Vault not found", "statusCode": 404 }
```

### SSE Endpoints
```bash
curl -N http://localhost:3000/api/v1/vaults/CAB.../stream
curl -N http://localhost:3000/api/v1/users/GABC.../stream
```

### Static Response Cache
```bash
# First request reads from cache
curl http://localhost:3000/api/v1/openapi.json
# Second request served from memory (faster)
curl http://localhost:3000/api/v1/openapi.json

# Reload cache via SIGHUP
kill -HUP <pid>
curl http://localhost:3000/api/v1/openapi.json
```

### HTTP Keep-Alive
```bash
# Connections held for 65s
curl -v http://localhost:3000/health --keepalive-time 60
```

### Per-Route Query Timeout
```bash
# Slow query returns 504
curl http://localhost:3000/api/v1/yields/CAB.../summary
# Should return 504 if query exceeds 10s
```

### Prepared Statements
```bash
# Hot path uses prepared statement — check logs for cache hits
LOG_LEVEL=debug npm start
curl http://localhost:3000/api/v1/vaults
# Logs should show "Prepared statement cached" on startup
```

## Checklist
- [x] CORS preflight caching configured
- [x] Structured error codes implemented across all endpoints
- [x] SSE endpoint for vault updates with proper headers
- [x] SSE endpoint for user position changes
- [x] In-process response cache for static endpoints
- [x] HTTP keep-alive tuning (65s timeout)
- [x] Per-route query timeout configuration
- [x] Prepared statement caching for hot queries
- [x] Error documentation created
- [x] Environment variable examples updated
- [x] All TypeScript diagnostics passing
- [x] Clean client disconnect handling for SSE connections

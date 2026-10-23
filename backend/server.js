require("dotenv").config({ path: require("path").join(__dirname, "..", ".env") });
const express = require("express");
const http = require("http");
const mongoose = require("mongoose");
const jwt = require("jsonwebtoken");
const helmet = require("helmet");
const cors = require("cors");
const cookieParser = require("cookie-parser");
const path = require("path");
const cluster = require("cluster");
const os = require("os");
const User = require("./models/User");
const { setSocketIO } = require("./realtime");
const { configurePassport, passport } = require("./config/passport");

const { apiLimiter } = require("./middleware/rateLimiter");
const { sanitizeBody } = require("./middleware/sanitize");

// Fail closed: a forgotten or weak JWT secret in production means anyone can mint admin tokens.
if (process.env.NODE_ENV === "production") {
  const secret = process.env.JWT_SECRET || "";
  const weak = secret.length < 32 || /^(secret|changeme|test|password|final-check|boot-check|your_jwt_secret)/i.test(secret);
  if (weak) {
    console.error("❌  Refusing to start: JWT_SECRET must be set to a random value of at least 32 characters in production.");
    console.error("    Generate one with:  openssl rand -hex 32");
    process.exit(1);
  }
}

// ─── Concurrency / scaling config (all opt-in, zero cost by default) ──────
// WEB_CONCURRENCY: number of Node worker processes (default 1 — safe for a
// single fractional-CPU free-tier instance; raise it on a paid plan with
// more CPU cores). Socket.IO rooms (per-branch, per-role broadcasts) only
// work correctly across multiple workers if every worker shares the same
// pub/sub bus, so clustering is only enabled when REDIS_URL is also set —
// otherwise a user connected to worker B would silently miss a broadcast
// emitted from worker A. A free Redis instance (e.g. Upstash's free tier,
// no credit card required) is enough to unlock this safely; see README.
const REQUESTED_WORKERS = parseInt(process.env.WEB_CONCURRENCY || "1", 10) || 1;
const HAS_REDIS = Boolean(process.env.REDIS_URL);
const WORKER_COUNT = HAS_REDIS ? Math.max(1, Math.min(REQUESTED_WORKERS, os.cpus().length)) : 1;

if (REQUESTED_WORKERS > 1 && !HAS_REDIS) {
  console.warn(
    `⚠️  WEB_CONCURRENCY=${REQUESTED_WORKERS} was requested but no REDIS_URL is set. Running with 1 worker instead — ` +
      `without a shared Redis pub/sub bus, Socket.IO broadcasts would only reach clients on the worker that emitted ` +
      `them. Set REDIS_URL (a free Upstash/Redis Cloud instance works) to safely scale past 1 worker.`
  );
}

if (WORKER_COUNT > 1 && cluster.isPrimary) {
  console.log(`🧵  Primary ${process.pid} starting ${WORKER_COUNT} workers (WEB_CONCURRENCY=${WORKER_COUNT}, Redis-backed)`);
  for (let i = 0; i < WORKER_COUNT; i++) cluster.fork({ YP_WORKER_INDEX: String(i) });
  cluster.on("exit", (worker, code, signal) => {
    console.error(`Worker ${worker.process.pid} exited (${signal || code}) — restarting`);
    cluster.fork();
  });
} else {
  startServer();
}

function startServer() {
  const app = express();

  // Required behind reverse proxies (Render, Nginx, etc.) so rate limiting and req.ip work correctly.
  app.set("trust proxy", process.env.TRUST_PROXY || 1);

  // This server only returns JSON and protected file downloads (the UI is the separate Next.js app),
  // so nothing here ever needs to run scripts or load subresources: lock it down completely.
  app.use(
    helmet({
      crossOriginEmbedderPolicy: false,
      crossOriginResourcePolicy: { policy: "same-site" },
      contentSecurityPolicy: {
        useDefaults: false,
        directives: { defaultSrc: ["'none'"], frameAncestors: ["'none'"], baseUri: ["'none'"], formAction: ["'none'"] },
      },
      referrerPolicy: { policy: "no-referrer" },
      hsts: process.env.NODE_ENV === "production" ? { maxAge: 15552000, includeSubDomains: true } : false,
    })
  );
  app.disable("x-powered-by");
  // Gzip every API response: JSON shrinks a lot, which matters most on phone networks.
  app.use(require("compression")());

  const ALLOWED = (process.env.ALLOWED_ORIGINS || process.env.CLIENT_URL || "http://localhost:5000,http://localhost:3000")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  app.use(
    cors({
      origin: (origin, cb) => {
        if (!origin || ALLOWED.includes(origin)) return cb(null, true);
        return cb(null, false);
      },
      credentials: true,
      methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
      allowedHeaders: ["Content-Type", "Authorization"],
    })
  );

  app.use(express.json({ limit: "2mb" }));
  app.use(express.urlencoded({ extended: true }));
  app.use(cookieParser());
  configurePassport();
  app.use(passport.initialize());

  app.use("/api/", apiLimiter);
  app.use(sanitizeBody);

  // NOTE: uploaded documents are deliberately NOT served statically — they contain national IDs,
  // KRA certificates and medical records. They are only reachable via the authorised /api/files route.

  // Register all API routes before frontend static so /api/* is never shadowed by files.
  app.use("/api/auth", require("./routes/auth"));
  app.use("/api/admin", require("./routes/admin"));
  app.use("/api/admin", require("./routes/promotionAdmin"));
  app.use("/api/supervisor", require("./routes/supervisor"));
  app.use("/api/general-supervisor", require("./routes/generalSupervisor"));
  app.use("/api/staff", require("./routes/staff"));
  app.use("/api/attendance", require("./routes/attendance"));
  app.use("/api/leave", require("./routes/leave"));
  app.use("/api/pay", require("./routes/pay"));
  app.use("/api/uniform", require("./routes/uniform"));
  app.use("/api/notifications", require("./routes/notifications"));
  app.use("/api/profile", require("./routes/profile"));
  app.use("/api/user", require("./routes/profile"));
  app.use("/api/contracts", require("./routes/contracts"));
  app.use("/api/analytics", require("./routes/analytics"));
  app.use("/api/public", require("./routes/public"));
  app.use("/api/timetable", require("./routes/timetable"));
  app.use("/api/reports", require("./routes/reports"));
  app.use("/api/files", require("./routes/files"));
  app.use("/api/preferences", require("./routes/preferences"));
  app.use("/api/messages", require("./routes/messages"));

  // One service serves everything: the API above, and the web app (run next to it by start-all.js).
  // Only used when WEB_INTERNAL_URL is set, so a separate frontend deployment still works.
  if (process.env.WEB_INTERNAL_URL) {
    const { createProxyMiddleware } = require("http-proxy-middleware");
    app.use(
      createProxyMiddleware({
        target: process.env.WEB_INTERNAL_URL,
        changeOrigin: false,
        ws: false,
        pathFilter: (p) => !p.startsWith("/api") && !p.startsWith("/socket.io"),
      })
    );
  }

  app.get("/api/health", (req, res) =>
    res.json({ status: "ok", ts: Date.now(), worker: process.env.YP_WORKER_INDEX || "0", pid: process.pid })
  );

  app.use((req, res) => {
    if (req.path.startsWith("/api"))
      return res.status(404).json({ success: false, message: "Route not found." });
    return res.status(404).send("Not found");
  });

  // eslint-disable-next-line no-unused-vars
  app.use((err, req, res, next) => {
    const status = err.status || err.statusCode || (err.name === "MulterError" ? 400 : 500);
    const safe = status < 500 ? err.message : "Internal server error.";
    console.error("GLOBAL ERROR:", err.stack || err.message);
    console.error(`[${status}] ${req.method} ${req.path} — ${err.message}`);
    const payload = { success: false, message: safe, ...(err.code && { code: err.code }) };
    if (process.env.NODE_ENV === "development" && status >= 500) payload.stack = err.stack;
    res.status(status).json(payload);
  });

  // Cron jobs touch the DB and must run exactly once across the whole
  // deployment, not once per worker (duplicate auto-clock-outs, duplicate
  // report emails, etc). With clustering off (the default) there's only
  // ever one process, so this always runs. With clustering on, only the
  // first worker (YP_WORKER_INDEX === "0") schedules them.
  if (process.env.YP_WORKER_INDEX === undefined || process.env.YP_WORKER_INDEX === "0") {
    require("./jobs/autoClockOut");
    require("./jobs/storageWatch");
    require("./jobs/rollupAttendanceCache");
    require("./jobs/attendanceAbsenceBackfill");
    require("./jobs/attendanceReportCron").scheduleReportCrons();
  }

  const mongoUri = process.env.MONGODB_URI || process.env.MONGO_URI || "mongodb://localhost:27017/wms_db";
  // Explicit, configurable pool size instead of relying on Mongoose's
  // default of 100 — keeps a predictable ceiling on simultaneous in-flight
  // queries per process. Free MongoDB Atlas (M0) clusters cap total
  // connections around 500, so this also leaves headroom if you ever run
  // more than one worker/instance against the same free cluster.
  const maxPoolSize = parseInt(process.env.MONGO_MAX_POOL_SIZE || "20", 10);

  mongoose.connection.on("connected", () => console.log("MongoDB connected (event)"));
  mongoose.connection.on("error", (err) => console.error("MongoDB error:", err.message));

  mongoose
    .connect(mongoUri, { serverSelectionTimeoutMS: 5000, maxPoolSize })
    .then(() => {
      console.log(`✅  MongoDB connected (maxPoolSize=${maxPoolSize})`);
      const PORT = process.env.PORT || 5000;
      const server = http.createServer(app);
      const { Server } = require("socket.io");
      const io = new Server(server, {
        cors: {
          origin: (origin, cb) => {
            if (!origin || ALLOWED.includes(origin)) return cb(null, true);
            return cb(null, false);
          },
          credentials: true,
        },
      });

      io.use(async (socket, next) => {
        try {
          const token = socket.handshake.auth?.token;
          if (!token) return next(new Error("Unauthorized"));
          const decoded = jwt.verify(token, process.env.JWT_SECRET);
          const user = await User.findById(decoded.id).select("role branch_id is_active");
          if (!user?.is_active) return next(new Error("Unauthorized"));
          socket.user = user;
          next();
        } catch (e) {
          next(new Error("Unauthorized"));
        }
      });

      io.on("connection", (socket) => {
        if (socket.user.role === "admin") socket.join("admins");
        if (socket.user.role === "general_supervisor") socket.join("general_supervisors");
        socket.join(`user:${socket.user._id.toString()}`);
        if (socket.user.branch_id) socket.join(`branch:${socket.user.branch_id.toString()}`);
      });

      setSocketIO(io);

      const listen = () =>
        server.listen(PORT, () => {
          const tag = process.env.YP_WORKER_INDEX !== undefined ? ` [worker ${process.env.YP_WORKER_INDEX}, pid ${process.pid}]` : "";
          console.log(`\n🚀  koin  →  http://localhost:${PORT}${tag}`);
          console.log(`📱  App            →  http://localhost:${PORT}/`);
          console.log(`🔌  Realtime       →  Socket.IO (attendance:changed)${HAS_REDIS ? " + Redis adapter" : ""}`);
        });

      // Optional: attach the Redis adapter so Socket.IO broadcasts reach
      // every worker/instance, not just the one that emitted them. Entirely
      // free to run — e.g. Upstash's free Redis tier — and only activates
      // if REDIS_URL is set; otherwise behaves exactly as before.
      if (HAS_REDIS) {
        const { createClient } = require("redis");
        const { createAdapter } = require("@socket.io/redis-adapter");
        const pubClient = createClient({ url: process.env.REDIS_URL });
        const subClient = pubClient.duplicate();
        Promise.all([pubClient.connect(), subClient.connect()])
          .then(() => {
            io.adapter(createAdapter(pubClient, subClient));
            console.log("🔌  Socket.IO Redis adapter connected — realtime events now shared across workers.");
            listen();
          })
          .catch((err) => {
            console.error("❌  Redis adapter failed to connect, continuing without it:", err.message);
            listen();
          });
      } else {
        listen();
      }
    })
    .catch((err) => {
      console.error("❌  MongoDB failed:", err.message);
      process.exit(1);
    });
}

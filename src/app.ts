import express from "express";
import cors from "cors";
import errorHandler from "./middleware/errorHandler.middleware";

// Create the Express application instance
// This "app" object is what we attach middleware and routes to
const app = express();

// ─── MIDDLEWARE ───────────────────────────────────────────────────────────────
// Middleware are functions that run on every request BEFORE it reaches your routes.
// Think of them as a pipeline — each one does something to the request/response.

// Allows the frontend (different domain/port) to make requests to this API.
// Without this, browsers block cross-origin requests by default (CORS policy).
app.use(cors());

// Tells Express to parse incoming JSON request bodies.
// Without this, req.body would always be undefined when the frontend sends JSON.
app.use(express.json());

// ─── HEALTH CHECK ─────────────────────────────────────────────────────────────
// A simple route to confirm the server is running.
// You can test this in your browser or with a tool like Postman.
// The underscore prefix on _req is a TypeScript convention that means
// "I know this parameter exists but I intentionally don't need it here"
app.get("/health", (_req, res) => {
  res.json({ status: "ok", message: "Vendorly API is running" });
});

// ─── ROUTES ───────────────────────────────────────────────────────────────────
// We'll register all our feature routes here later, e.g.:
// app.use("/api/auth", authRoutes);
// app.use("/api/products", productRoutes);

// ─── GLOBAL ERROR HANDLER ─────────────────────────────────────────────────────
// Must be registered LAST — after all routes.
// Express knows this is an error handler because it has 4 parameters (err, req, res, next).
// Any "throw new ApiError()" or "next(error)" call anywhere in the app ends up here.
app.use(errorHandler);

export default app;

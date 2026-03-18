import dotenv from "dotenv";

// Load environment variables from the .env file into process.env
// This must run BEFORE anything else so the rest of the app can access them
dotenv.config();

import app from "./app";
import connectDB from "./config/db";

// Read the PORT from environment variables, or default to 5000
// process.env is a Node.js object that holds all your environment variables
const PORT = process.env.PORT || 5000;

// Connect to MongoDB first, then start the server.
// We don't want to accept requests before the DB is ready.
connectDB().then(() => {
  app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
});

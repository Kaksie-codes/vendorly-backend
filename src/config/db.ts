import mongoose from "mongoose";

// This function connects our app to MongoDB using Mongoose.
// We export it as a function so we can call it from server.ts at startup.
const connectDB = async (): Promise<void> => {
  try {
    const mongoURL = process.env.MONGO_URL;

    // If the MONGO_URL variable is missing from .env, fail immediately with a clear error.
    // Better to crash early with a useful message than fail silently later.
    if (!mongoURL) {
      throw new Error("MONGO_URL is not defined in your .env file");
    }

    await mongoose.connect(mongoURL);

    console.log("MongoDB connected successfully");
  } catch (error) {
    console.error("MongoDB connection failed:", error);

    // Exit the process entirely if DB connection fails.
    // There's no point running the API if it can't talk to the database.
    process.exit(1);
  }
};

export default connectDB;

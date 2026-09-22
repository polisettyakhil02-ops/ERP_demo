import mongoose from "mongoose";

export const connectDB = async () => {
  try {
    const uri = process.env.MONGO_URI;
    const dbName = process.env.MONGO_DB_NAME;

    if (!uri) {
      throw new Error("MONGO_URI is not set in environment variables");
    }

    mongoose.set("strictQuery", true);

    const connection = await mongoose.connect(uri, {
      dbName: dbName,
      serverSelectionTimeoutMS: 10000,
      socketTimeoutMS: 45000,
    });

    console.log(
      `✅ MongoDB Connected to database: ${connection.connection.name}`,
    );
    return connection;
  } catch (err) {
    console.error("❌ [db] Failed to connect to MongoDB:", err.message);
    throw err;
  }
};

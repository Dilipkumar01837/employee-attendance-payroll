const mongoose = require("mongoose");
require("./dns");

const isSRVResolutionFailure = (error) => {
  if (!error) return false;
  if (error.code === "querySrv" || error.code === "ECONNREFUSED") return true;

  return /querySrv|ENOTFOUND.*_mongodb\._tcp/i.test(
    `${error.code || ""} ${error.message || ""}`
  );
};

const connectDB = async () => {
  if (mongoose.connection.readyState >= 1) {
    return;
  }

  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log("MongoDB connected successfully");
  } catch (error) {
    if (isSRVResolutionFailure(error)) {
      throw new Error(
        `MongoDB connection failed: could not resolve the SRV record for this ` +
          `mongodb+srv:// URI (${error.message}).\n` +
          `  This is a DNS problem, not a network or credentials problem.\n` +
          `  Fix: set DNS_SERVERS in backend/.env to a resolver that answers SRV ` +
          `queries, e.g. DNS_SERVERS=8.8.8.8,1.1.1.1\n` +
          `  To confirm the cluster itself is reachable, test TCP 27017 against a ` +
          `resolved shard host.`
      );
    }

    throw new Error(`MongoDB connection failed: ${error.message}`);
  }
};

module.exports = connectDB;

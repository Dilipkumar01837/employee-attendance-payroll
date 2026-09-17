require("dotenv").config();
const express = require("express");
const cors = require("cors");
const connectDB = require("./config/db");
const authRoutes = require("./routes/authRoutes");
const employeeRoutes = require("./routes/employeeRoutes");
const { notFound, errorHandler } = require("./middleware/error");

const app = express();

app.use(cors({ origin: process.env.CLIENT_URL || "http://localhost:5173" }));
app.use(express.json());

app.get("/api/health", (req, res) => res.json({ status: "ok" }));
app.use("/api/auth", authRoutes);
app.use("/api/employees", employeeRoutes);

app.use(notFound);
app.use(errorHandler);

if (require.main === module) {
  connectDB()
    .then(() => {
      const port = process.env.PORT || 5000;
      app.listen(port, () => console.log(`Backend running on http://localhost:${port}`));
    })
    .catch((err) => {
      console.error("Startup failed:", err.message);
      process.exit(1);
    });
}

module.exports = app;

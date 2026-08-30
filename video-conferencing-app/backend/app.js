import express from "express";
import { createServer } from "node:http";
import cors from "cors";
import mongoose from "mongoose";

import "dotenv/config";

import { connectToSocket } from "./src/controllers/socketManager.js";
import userRoutes from "./src/routes/user.routes.js";

const clientOrigin = process.env.CLIENT_ORIGIN || "http://localhost:3000";

const app = express();
app.use(cors({ origin: clientOrigin }));
app.use(express.json());

const server = createServer(app);

// Initialize Socket.IO
connectToSocket(server);

app.set("port", process.env.PORT || 8000);

// User routes
app.use("/api/v1/users", userRoutes);
app.use("/api/v2/users", userRoutes);

// Test route
app.get("/home", (req, res) => {
    return res.json({ hello: "world" });
});

// MongoDB connection & server start
const start = async () => {
    try {
        await mongoose.connect(
           process.env.MONGO_URI
        );
        console.log("MongoDB connected");

        server.listen(app.get("port"), () => {
            console.log(`App listening on port ${app.get("port")}`);
        });
    } catch (err) {
        console.error("MongoDB connection error:", err);
        process.exitCode = 1;
    }
};

start();

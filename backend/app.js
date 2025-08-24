import express from "express";
import { createServer } from "node:http";
import cors from "cors";
import mongoose from "mongoose";

import { connectToSocket } from "./src/controllers/socketManager.js";
import userRoutes from "./src/routes/user.routes.js";

const app = express();
app.use(cors());
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
            "mongodb+srv://darshana:test123@meeting-app.l8lqzdw.mongodb.net/?retryWrites=true&w=majority&appName=meeting-app"
        );
        console.log("MongoDB connected");

        server.listen(app.get("port"), () => {
            console.log(`App listening on port ${app.get("port")}`);
        });
    } catch (err) {
        console.error("MongoDB connection error:", err);
    }
};

start();

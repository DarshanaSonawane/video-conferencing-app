import { User } from "../models/user.model.js";
import bcrypt from "bcrypt";
import crypto from "crypto";

// Login
const login = async (req, res) => {
    const { username, password } = req.body;
    if (!username || !password) {
        return res.status(400).json({ message: "Please provide username and password" });
    }

    try {
        const user = await User.findOne({ username });
        if (!user) return res.status(404).json({ message: "User not found" });

        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) return res.status(401).json({ message: "Invalid credentials" });

        const token = crypto.randomBytes(20).toString("hex");
        user.token = token;
        await user.save();

        return res.status(200).json({ token });
    } catch (err) {
        return res.status(500).json({ message: "Something went wrong", error: err.message });
    }
};

// Register
const register = async (req, res) => {
    const { name, username, password } = req.body;

    try {
        const existingUser = await User.findOne({ username });
        if (existingUser) return res.status(409).json({ message: "User already exists" });

        const hashedPassword = await bcrypt.hash(password, 10);

        const newUser = new User({
            name,
            username,
            password: hashedPassword
        });

        await newUser.save();

        res.status(201).json({ message: "User registered successfully" });
    } catch (err) {
        return res.status(500).json({ message: "Something went wrong", error: err.message });
    }
};

export { login, register };

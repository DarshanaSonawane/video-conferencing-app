import { User } from "../models/user.model.js";
import { Meeting } from "../models/meeting.model.js";
import { Transcript } from "../models/transcript.model.js";
import { generateMeetingSummary } from "../services/summarizer.service.js";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";

const login = async (req, res) => {
    const { username, password } = req.body;
    if (!username || !password) return res.status(400).json({ message: "Please provide username and password" });

    try {
        const user = await User.findOne({ username });
        if (!user) return res.status(404).json({ message: "User not found" });
        if (!await bcrypt.compare(password, user.password)) return res.status(401).json({ message: "Invalid credentials" });

        const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, { expiresIn: "7d" });
        return res.status(200).json({ token });
    } catch (err) {
        return res.status(500).json({ message: "Something went wrong", error: err.message });
    }
};

const register = async (req, res) => {
    const { name, username, password } = req.body;
    if (!name?.trim() || !username?.trim() || !password) return res.status(400).json({ message: "Name, username and password are required" });

    try {
        if (await User.findOne({ username })) return res.status(409).json({ message: "User already exists" });
        await User.create({ name: name.trim(), username: username.trim(), password: await bcrypt.hash(password, 10) });
        return res.status(201).json({ message: "User registered successfully" });
    } catch (err) {
        return res.status(500).json({ message: "Something went wrong", error: err.message });
    }
};

// Verify a signed JWT and load the matching user; returns null for invalid/expired tokens.
const findUserByToken = async (token) => {
    if (!token) return null;
    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        return await User.findById(decoded.id);
    } catch {
        return null;
    }
};

const addToActivity = async (req, res) => {
    const { token, meeting_code: meetingCode } = req.body;
    if (!meetingCode?.trim()) return res.status(400).json({ message: "Meeting code is required" });
    try {
        const user = await findUserByToken(token);
        if (!user) return res.status(401).json({ message: "Invalid or expired token" });
        const meeting = await Meeting.create({ user_id: user._id.toString(), meetingCode: meetingCode.trim() });
        return res.status(201).json(meeting);
    } catch (err) {
        return res.status(500).json({ message: "Could not save meeting activity", error: err.message });
    }
};

const getAllActivity = async (req, res) => {
    try {
        const user = await findUserByToken(req.query.token);
        if (!user) return res.status(401).json({ message: "Invalid or expired token" });
        return res.status(200).json(await Meeting.find({ user_id: user._id.toString() }).sort({ date: -1 }));
    } catch (err) {
        return res.status(500).json({ message: "Could not get meeting activity", error: err.message });
    }
};

// Persist the running transcript captured during a call, keyed by meeting code.
// Upsert keeps one document per meeting; concurrent savers converge on the
// same room-wide transcript so last-write-wins is safe.
const saveTranscript = async (req, res) => {
    const { token, meeting_code: meetingCode, entries } = req.body;
    if (!meetingCode?.trim()) return res.status(400).json({ message: "Meeting code is required" });
    if (!Array.isArray(entries)) return res.status(400).json({ message: "Transcript entries are required" });

    try {
        const user = await findUserByToken(token);
        if (!user) return res.status(401).json({ message: "Invalid or expired token" });

        const cleanedEntries = entries
            .filter((entry) => entry?.text?.trim())
            .map((entry) => ({
                speaker: entry.speaker?.trim() || "Unknown",
                text: entry.text.trim(),
                timestamp: entry.timestamp || null
            }));

        const transcript = await Transcript.findOneAndUpdate(
            { meetingCode: meetingCode.trim() },
            { $set: { entries: cleanedEntries, date: new Date() } },
            { upsert: true, returnDocument: "after", setDefaultsOnInsert: true }
        );

        return res.status(201).json(transcript);
    } catch (err) {
        return res.status(500).json({ message: "Could not save transcript", error: err.message });
    }
};

const getTranscript = async (req, res) => {
    const meetingCode = req.query.meeting_code;
    if (!meetingCode?.trim()) return res.status(400).json({ message: "Meeting code is required" });

    try {
        const user = await findUserByToken(req.query.token);
        if (!user) return res.status(401).json({ message: "Invalid or expired token" });

        const transcript = await Transcript.findOne({ meetingCode: meetingCode.trim() });
        if (!transcript) return res.status(404).json({ message: "No transcript found for this meeting" });

        return res.status(200).json(transcript);
    } catch (err) {
        return res.status(500).json({ message: "Could not get transcript", error: err.message });
    }
};

// Generate an AI summary (OpenRouter GPT-4o) for a saved meeting transcript
// and persist it on the transcript document. Cached summaries are reused so
// reopening the screen never pays for a second generation.
const summarizeMeeting = async (req, res) => {
    const { token, meeting_code: meetingCode } = req.body;
    if (!meetingCode?.trim()) return res.status(400).json({ message: "Meeting code is required" });

    try {
        const user = await findUserByToken(token);
        if (!user) return res.status(401).json({ message: "Invalid or expired token" });

        const transcript = await Transcript.findOne({ meetingCode: meetingCode.trim() });
        if (!transcript || !transcript.entries.length) {
            return res.status(404).json({ message: "No transcript found for this meeting" });
        }

        // Reuse the cached summary instead of paying for a second generation.
        // Summaries saved before the "highlights" section existed are treated
        // as stale and regenerated with the current prompt.
        if (transcript.summary && transcript.summary.overall && Array.isArray(transcript.summary.highlights)) {
            return res.status(200).json({ meetingCode: transcript.meetingCode, summary: transcript.summary });
        }

        try {
            const summary = await generateMeetingSummary(transcript.entries);
            transcript.summary = summary;
            transcript.summarizedAt = new Date();
            await transcript.save();
            return res.status(200).json({ meetingCode: transcript.meetingCode, summary });
        } catch (err) {
            console.log("Summarizer failed:", err.message);
            return res.status(502).json({ message: err.message || "Could not generate meeting summary" });
        }
    } catch (err) {
        return res.status(500).json({ message: "Could not generate meeting summary", error: err.message });
    }
};

export { login, register, addToActivity, getAllActivity, saveTranscript, getTranscript, summarizeMeeting };

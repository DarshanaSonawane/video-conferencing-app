import mongoose, { Schema } from "mongoose";

const transcriptEntrySchema = new Schema({
    speaker: { type: String, default: "Unknown" },
    text: { type: String, required: true },
    timestamp: { type: String, default: null }
}, { _id: false });

// Structured AI summary produced by the OpenRouter GPT-4o summarizer.
const summarySchema = new Schema({
    overall: { type: String, default: "" },
    highlights: { type: [String], default: [] },
    decisions: { type: [String], default: [] },
    actionItems: [{
        task: { type: String, default: "" },
        owner: { type: String, default: "" }
    }],
    chapters: [{
        title: { type: String, default: "" },
        startTime: { type: String, default: "" },
        endTime: { type: String, default: "" }
    }]
}, { _id: false });

const transcriptSchema = new Schema({
    meetingCode: { type: String, required: true, unique: true },
    entries: { type: [transcriptEntrySchema], default: [] },
    summary: { type: summarySchema, default: null },
    summarizedAt: { type: Date, default: null },
    date: { type: Date, default: Date.now }
});

const Transcript = mongoose.model("Transcript", transcriptSchema);
export { Transcript };
// AI meeting summarization via OpenRouter (GPT-4o).
// Takes the finalized transcript entries captured during a call and produces
// a structured JSON summary: overall overview, key decisions, action items
// with owners, and topic-wise chapters with timestamps.

const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";
const OPENROUTER_MODEL = "openai/gpt-4o";

// Newline separator used when flattening transcript entries into prompt lines.
const LINE_BREAK = String.fromCharCode(10);

const SYSTEM_PROMPT = `You are an expert meeting analyst. You read raw meeting transcripts and produce precise, structured summaries.
Always reply with ONLY valid minified JSON — no markdown fences, no commentary — matching exactly this shape:
{"overall_summary": string, "highlights": string[], "key_decisions": string[], "action_items": [{"task": string, "owner": string}], "chapters": [{"title": string, "start_time": "HH:MM:SS", "end_time": "HH:MM:SS"}]}
Rules:
- overall_summary: a 2-6 sentence executive summary of the whole meeting. Even short or informal meetings must be summarized meaningfully — never dismiss them as having no substance.
- highlights: important announcements, news, milestones or notable statements shared during the meeting (examples: layoffs or hiring news, product launches, targets, blockers, big numbers). Include them here even when stated casually by a single speaker; empty array only if truly nothing notable was said.
- key_decisions: any choice, agreement or conclusion reached, including casual phrasing like "we decided", "we agreed", "let's go with"; empty array if genuinely none were made.
- action_items: every commitment or task mentioned, including self-assigned ones like "I will prepare X by Thursday" (owner = the speaker who committed); use "" for the owner when unknown; empty array if none.
- chapters: topic-wise sections ordered chronologically covering the full meeting span. Copy the [HH:MM:SS] markers from the transcript verbatim for start_time and end_time.
- Never invent facts that are not supported by the transcript.`;

const USER_PROMPT_PREFIX = `Summarize the following meeting transcript:

`;

// Formats an ISO timestamp as elapsed HH:MM:SS relative to the first entry,
// giving the model natural chapter markers to reference.
function formatElapsed(iso, baseMs) {
    const ms = Math.max(0, new Date(iso).getTime() - baseMs);
    const total = Math.floor(ms / 1000);
    const h = String(Math.floor(total / 3600)).padStart(2, "0");
    const m = String(Math.floor((total % 3600) / 60)).padStart(2, "0");
    const s = String(total % 60).padStart(2, "0");
    return `${h}:${m}:${s}`;
}

export function buildTranscriptPrompt(entries) {
    const firstStamp = entries.find((entry) => entry.timestamp)?.timestamp;
    const baseMs = firstStamp ? new Date(firstStamp).getTime() : null;

    return entries.map((entry, index) => {
        const stamp = baseMs != null && entry.timestamp ? formatElapsed(entry.timestamp, baseMs) : `#${index + 1}`;
        return `[${stamp}] ${entry.speaker}: ${entry.text}`;
    }).join(LINE_BREAK);
}

// Tolerant JSON extraction — models occasionally wrap output in fences or prose.
function parseSummary(content) {
    let text = content.trim();
    const fence = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
    if (fence) text = fence[1].trim();

    const start = text.indexOf("{");
    const end = text.lastIndexOf("}");
    if (start === -1 || end === -1 || end <= start) throw new Error("Model did not return valid JSON");

    const parsed = JSON.parse(text.slice(start, end + 1));

    return {
        overall: typeof parsed.overall_summary === "string" ? parsed.overall_summary.trim() : "",
        highlights: Array.isArray(parsed.highlights)
            ? parsed.highlights.filter((h) => typeof h === "string" && h.trim()).map((h) => h.trim())
            : [],
        decisions: Array.isArray(parsed.key_decisions)
            ? parsed.key_decisions.filter((d) => typeof d === "string" && d.trim()).map((d) => d.trim())
            : [],
        actionItems: Array.isArray(parsed.action_items)
            ? parsed.action_items
                .filter((a) => a && typeof a.task === "string" && a.task.trim())
                .map((a) => ({ task: a.task.trim(), owner: typeof a.owner === "string" ? a.owner.trim() : "" }))
            : [],
        chapters: Array.isArray(parsed.chapters)
            ? parsed.chapters
                .filter((c) => c && typeof c.title === "string" && c.title.trim())
                .map((c) => ({
                    title: c.title.trim(),
                    startTime: typeof c.start_time === "string" ? c.start_time : "",
                    endTime: typeof c.end_time === "string" ? c.end_time : ""
                }))
            : []
    };
}

export async function generateMeetingSummary(entries) {
    const apiKey = process.env.OPENROUTER_API_KEY;
    if (!apiKey?.trim() || apiKey.includes("your_openrouter")) {
        throw new Error("OpenRouter API key is not configured. Add OPENROUTER_API_KEY to backend/.env");
    }

    const response = await fetch(OPENROUTER_URL, {
        method: "POST",
        headers: {
            "Authorization": `Bearer ${apiKey}`,
            "Content-Type": "application/json"
        },
        body: JSON.stringify({
            model: OPENROUTER_MODEL,
            temperature: 0.3,
            max_tokens: 1600,
            messages: [
                { role: "system", content: SYSTEM_PROMPT },
                { role: "user", content: USER_PROMPT_PREFIX + buildTranscriptPrompt(entries) }
            ]
        })
    });

    if (!response.ok) {
        const detail = await response.text().catch(() => "");
        throw new Error(`OpenRouter request failed (${response.status}): ${detail.slice(0, 300)}`);
    }

    const payload = await response.json();
    const content = payload?.choices?.[0]?.message?.content;
    if (!content) throw new Error("OpenRouter returned an empty completion");

    return parseSummary(content);
}
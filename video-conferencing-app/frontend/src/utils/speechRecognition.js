// Browser speech-to-text built on the Web Speech API.
// Each participant transcribes their own microphone locally — audio never
// leaves the machine; only finalized text is relayed over Socket.IO.

const SpeechRecognitionImpl =
    typeof window !== "undefined" &&
    (window.SpeechRecognition || window.webkitSpeechRecognition);

// True when the current browser exposes the Web Speech API (Chrome/Edge).
export function isSpeechRecognitionSupported() {
    return Boolean(SpeechRecognitionImpl);
}

/**
 * Continuous dictation service around the Web Speech API.
 *
 * Chrome ends a recognition session after a few seconds of silence, so the
 * service transparently restarts itself while running. Sessions that die
 * almost instantly (blocked/unavailable mic) are counted as quick failures
 * and give up after a threshold instead of spinning forever.
 *
 * Usage:
 *   const service = new SpeechRecognitionService();
 *   service.start({
 *       onInterim: (text) => ...,   // partial hypothesis, fired repeatedly
 *       onFinal: (text) => ...,     // finalized sentence
 *       onError: (reason) => ...,   // "unsupported" | "not-allowed" | ...
 *   });
 *   // ...later:
 *   service.stop();
 */
export class SpeechRecognitionService {
    constructor() {
        this.recognition = null;
        this.running = false;
        this.intentionalStop = false;
        this.restartTimer = null;
        this.sessionStartedAt = 0;
        this.quickFailures = 0;
        this.callbacks = {};
    }

    start({ lang = "en-US", onInterim, onFinal, onError } = {}) {
        if (!SpeechRecognitionImpl) {
            onError?.("unsupported");
            return false;
        }
        if (this.running) return true;

        this.callbacks = { onInterim, onFinal, onError };
        this.running = true;
        this.intentionalStop = false;
        this.quickFailures = 0;
        this.spawnRecognition(lang);
        return true;
    }

    spawnRecognition(lang) {
        const recognition = new SpeechRecognitionImpl();
        recognition.lang = lang;
        recognition.continuous = true;
        recognition.interimResults = true;

        recognition.onresult = (event) => {
            let interim = "";
            for (let i = event.resultIndex; i < event.results.length; i++) {
                const result = event.results[i];
                const text = result[0].transcript.trim();
                if (!text) continue;

                if (result.isFinal) {
                    this.callbacks.onFinal?.(text);
                } else {
                    interim += `${text} `;
                }
            }
            if (interim.trim()) {
                this.callbacks.onInterim?.(interim.trim());
            }
        };

        recognition.onerror = (event) => {
            // "no-speech" and "aborted" are routine during continuous listening.
            if (event.error === "no-speech" || event.error === "aborted") return;
            if (event.error === "not-allowed" || event.error === "service-not-allowed") {
                this.running = false;
            }
            this.callbacks.onError?.(event.error);
        };

        recognition.onend = () => {
            if (!this.running || this.intentionalStop) return;

            // A session that dies almost instantly usually means the mic is
            // blocked or unavailable — bail out after repeated quick failures.
            if (Date.now() - this.sessionStartedAt < 1000) {
                this.quickFailures += 1;
                if (this.quickFailures >= 10) {
                    this.running = false;
                    this.callbacks.onError?.("unavailable");
                    return;
                }
            } else {
                this.quickFailures = 0;
            }

            this.restartTimer = setTimeout(() => {
                if (this.running && !this.intentionalStop) {
                    this.spawnRecognition(lang);
                }
            }, 300);
        };

        this.recognition = recognition;
        this.sessionStartedAt = Date.now();
        try {
            recognition.start();
        } catch (e) {
            // start() throws if a session is already active — safe to ignore,
            // onend will schedule the next attempt.
            console.log("Speech recognition start failed:", e);
        }
    }

    stop() {
        this.running = false;
        this.intentionalStop = true;
        clearTimeout(this.restartTimer);
        try {
            this.recognition?.stop();
        } catch (e) { console.log(e); }
        this.recognition = null;
    }
}
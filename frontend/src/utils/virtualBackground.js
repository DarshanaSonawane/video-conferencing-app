import { SelfieSegmentation } from "@mediapipe/selfie_segmentation";

// WASM/model assets are fetched from a pinned CDN version at runtime.
const MODEL_BASE = "https://cdn.jsdelivr.net/npm/@mediapipe/selfie_segmentation@0.1.1675465747";

// Procedurally generated preset backgrounds (no binary assets needed).
export const BACKGROUND_PRESETS = [
    { id: "sunset", label: "Sunset", colors: ["#ff7e5f", "#feb47b", "#4a2c6d"] },
    { id: "ocean", label: "Ocean", colors: ["#0f2027", "#203a43", "#2c5364"] },
    { id: "aurora", label: "Aurora", colors: ["#0b486b", "#3b8d99", "#a8e063"] },
];

const ORBS = [
    [0.15, 0.25, 0.20],
    [0.82, 0.22, 0.15],
    [0.68, 0.78, 0.22],
    [0.28, 0.82, 0.13],
    [0.52, 0.45, 0.11],
];

// Renders a preset scene onto an offscreen canvas.
export function createPresetBackground(preset, width = 1280, height = 720) {
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");

    const gradient = ctx.createLinearGradient(0, 0, width * 0.35, height);
    gradient.addColorStop(0, preset.colors[0]);
    gradient.addColorStop(0.55, preset.colors[1]);
    gradient.addColorStop(1, preset.colors[2]);
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, width, height);

    // Soft glowing orbs for depth
    ORBS.forEach(([x, y, r]) => {
        const orb = ctx.createRadialGradient(width * x, height * y, 0, width * x, height * y, width * r);
        orb.addColorStop(0, "rgba(255,255,255,0.16)");
        orb.addColorStop(1, "rgba(255,255,255,0)");
        ctx.fillStyle = orb;
        ctx.fillRect(0, 0, width, height);
    });

    return canvas;
}

// Draws `source` scaled to fully cover width x height (center-cropped).
function drawCover(ctx, source, width, height) {
    const sw = source.videoWidth || source.naturalWidth || source.width;
    const sh = source.videoHeight || source.naturalHeight || source.height;
    if (!sw || !sh) return;
    const scale = Math.max(width / sw, height / sh);
    const dw = sw * scale;
    const dh = sh * scale;
    ctx.drawImage(source, (width - dw) / 2, (height - dh) / 2, dw, dh);
}

/**
 * Runs MediaPipe Selfie Segmentation over the camera feed and composites
 * the person over either a blurred copy of the frame or a replacement image.
 *
 * Usage:
 *   const processor = new VirtualBackgroundProcessor();
 *   const processed = await processor.start(rawCameraStream, "blur");
 *   // ...later:
 *   processor.setMode("image", someCanvasOrImg);
 *   const original = processor.stop();
 */
export class VirtualBackgroundProcessor {
    constructor() {
        this.segmenter = null;
        this.modelLoading = null;
        this.videoEl = null;
        this.canvas = null;
        this.ctx = null;
        this.outputStream = null;
        this.originalStream = null;
        this.running = false;
        this.busy = false;
        this.rafId = null;
        this.mode = "blur";
        this.backgroundSource = null;
    }

    _ensureModel() {
        if (this.segmenter) return Promise.resolve();
        if (!this.modelLoading) {
            this.modelLoading = new Promise((resolve, reject) => {
                const segmenter = new SelfieSegmentation({
                    locateFile: (file) => `${MODEL_BASE}/${file}`,
                });
                segmenter.setOptions({ modelSelection: 1 });
                segmenter.onResults((results) => this._onResults(results));
                // Sending the first frame loads the WASM/model assets.
                segmenter.send({ image: document.createElement("canvas") })
                    .then(() => {
                        this.segmenter = segmenter;
                        resolve();
                    })
                    .catch(reject);
            }).catch((e) => {
                this.modelLoading = null;
                throw e;
            });
        }
        return this.modelLoading;
    }

    /**
     * Starts processing `stream`'s video track.
     * Returns a new MediaStream: [processedVideoTrack, ...originalAudioTracks].
     */
    async start(stream, mode = "blur", backgroundSource = null) {
        this.stopLoop();
        this.originalStream = stream;

        const videoTrack = stream.getVideoTracks()[0];
        if (!videoTrack) throw new Error("No video track to process");

        const settings = videoTrack.getSettings ? videoTrack.getSettings() : {};
        const width = Math.min(settings.width || 1280, 1280);
        const height = Math.min(settings.height || 720, 720);

        // Hidden <video> that plays the raw camera feed
        this.videoEl = document.createElement("video");
        this.videoEl.srcObject = new MediaStream([videoTrack]);
        this.videoEl.muted = true;
        this.videoEl.playsInline = true;
        await this.videoEl.play();

        this.canvas = document.createElement("canvas");
        this.canvas.width = width;
        this.canvas.height = height;
        this.ctx = this.canvas.getContext("2d");

        await this._ensureModel();
        this.setMode(mode, backgroundSource);

        this.running = true;
        this._loop();

        this.outputStream = this.canvas.captureStream(30);
        return new MediaStream([
            ...this.outputStream.getVideoTracks(),
            ...stream.getAudioTracks(),
        ]);
    }

    /** Switch effect on the fly without restarting the pipeline. */
    setMode(mode, backgroundSource = null) {
        this.mode = mode;
        this.backgroundSource = backgroundSource;
    }

    _loop = () => {
        if (!this.running) return;
        if (!this.busy && this.videoEl && this.videoEl.readyState >= 2) {
            this.busy = true;
            this.segmenter
                .send({ image: this.videoEl })
                .catch(() => {})
                .finally(() => { this.busy = false; });
        }
        this.rafId = requestAnimationFrame(this._loop);
    };

    _onResults(results) {
        if (!this.running || !this.ctx) return;
        const { width, height } = this.canvas;
        const ctx = this.ctx;
        const frame = results.image;

        ctx.save();
        ctx.clearRect(0, 0, width, height);

        // 1) Person only: segmentation mask ∩ camera frame
        ctx.drawImage(results.segmentationMask, 0, 0, width, height);
        ctx.globalCompositeOperation = "source-in";
        ctx.drawImage(frame, 0, 0, width, height);

        // 2) Background drawn BEHIND the person
        ctx.globalCompositeOperation = "destination-over";
        if (this.mode === "image" && this.backgroundSource) {
            drawCover(ctx, this.backgroundSource, width, height);
        } else {
            ctx.filter = "blur(14px)";
            ctx.drawImage(frame, 0, 0, width, height);
            ctx.filter = "none";
        }
        ctx.restore();
    }

    stopLoop() {
        this.running = false;
        if (this.rafId) cancelAnimationFrame(this.rafId);
        this.rafId = null;
    }

    /**
     * Stops processing and releases internal resources.
     * Returns the original camera stream so callers can swap back to it.
     */
    stop() {
        this.stopLoop();
        try {
            if (this.videoEl) {
                this.videoEl.pause();
                this.videoEl.srcObject = null;
            }
        } catch (e) { /* noop */ }
        this.videoEl = null;
        this.canvas = null;
        this.ctx = null;
        this.outputStream = null;
        return this.originalStream;
    }
}
import React, { useContext, useEffect, useRef, useState } from 'react'
import io from "socket.io-client";
import { useNavigate } from 'react-router-dom';
import { Badge, IconButton, TextField } from '@mui/material';
import { Button } from '@mui/material';
import VideocamIcon from '@mui/icons-material/Videocam';
import VideocamOffIcon from '@mui/icons-material/VideocamOff'
import CallEndIcon from '@mui/icons-material/CallEnd'
import MicIcon from '@mui/icons-material/Mic'
import MicOffIcon from '@mui/icons-material/MicOff'
import ScreenShareIcon from '@mui/icons-material/ScreenShare';
import StopScreenShareIcon from '@mui/icons-material/StopScreenShare'
import ChatIcon from '@mui/icons-material/Chat'
import WallpaperIcon from '@mui/icons-material/Wallpaper';
import ClosedCaptionIcon from '@mui/icons-material/ClosedCaption';
import ArticleIcon from '@mui/icons-material/Article';
import { motion, AnimatePresence } from 'framer-motion';
import server from '../environment';
import { VirtualBackgroundProcessor, BACKGROUND_PRESETS, createPresetBackground } from '../utils/virtualBackground';
import { SpeechRecognitionService, isSpeechRecognitionSupported } from '../utils/speechRecognition';
import { AuthContext } from '../contexts/AuthContext';

import styles from "../styles/VideoComponent.module.css";

const server_url = server;

var connections = {};

const peerConfigConnections = {
    "iceServers": [
        { "urls": "stun:stun.l.google.com:19302" }
    ]
}

const REACTION_EMOJIS = ["👍", "❤️", "👏", "😂"];

export default function VideoMeetComponent() {

    var socketRef = useRef();
    let socketIdRef = useRef();

    let localVideoref = useRef();

    let [videoAvailable, setVideoAvailable] = useState(true);

    let [audioAvailable, setAudioAvailable] = useState(true);

    let [video, setVideo] = useState([]);

    let [audio, setAudio] = useState();

    let [screen, setScreen] = useState();

    let [showModal, setModal] = useState(true);

    let [screenAvailable, setScreenAvailable] = useState();

    let [messages, setMessages] = useState([])

    let [message, setMessage] = useState("");

    let [newMessages, setNewMessages] = useState(0);

    let [askForUsername, setAskForUsername] = useState(true);

    let [username, setUsername] = useState(() => localStorage.getItem("username") || "");

    const videoRef = useRef([])

    let [videos, setVideos] = useState([])

    let [reactions, setReactions] = useState([]);

    const reactionIdRef = useRef(0);

    let [bgPanelOpen, setBgPanelOpen] = useState(false);

    let [bgMode, setBgMode] = useState("none");

    let [bgPresetId, setBgPresetId] = useState(null);

    const vbProcessorRef = useRef(null);

    const originalCameraStreamRef = useRef(null);

    const vbStateRef = useRef({ mode: "none", source: null, presetId: null });

    // ---- Live captions & running transcript ----
    const { saveTranscript } = useContext(AuthContext);

    const routeTo = useNavigate();

    let [captionsSupported] = useState(() => isSpeechRecognitionSupported());

    let [captionsOn, setCaptionsOn] = useState(false);

    // Latest interim caption per participant, keyed by socket id.
    let [liveCaptions, setLiveCaptions] = useState({});

    // Finalized transcript entries shared by everyone in the room.
    let [transcript, setTranscript] = useState([]);

    let [transcriptOpen, setTranscriptOpen] = useState(false);

    const speechServiceRef = useRef(null);

    const transcriptListRef = useRef(null);

    const usernameRef = useRef(username);

    useEffect(() => {
        usernameRef.current = username;
    }, [username]);

    // TODO
    // if(isChrome() === false) {


    // }

    useEffect(() => {
        getPermissions();
    }, [])

    // Stop dictation if the meeting component unmounts mid-call.
    useEffect(() => () => {
        speechServiceRef.current?.stop();
    }, [])

    let getDislayMedia = () => {
        if (screen) {
            if (navigator.mediaDevices.getDisplayMedia) {
                navigator.mediaDevices.getDisplayMedia({ video: true, audio: true })
                    .then(getDislayMediaSuccess)
                    .then((stream) => { })
                    .catch((e) => console.log(e))
            }
        }
    }

    const getPermissions = async () => {
        try {
            const videoPermission = await navigator.mediaDevices.getUserMedia({ video: true });
            if (videoPermission) {
                setVideoAvailable(true);
                console.log('Video permission granted');
            } else {
                setVideoAvailable(false);
                console.log('Video permission denied');
            }

            const audioPermission = await navigator.mediaDevices.getUserMedia({ audio: true });
            if (audioPermission) {
                setAudioAvailable(true);
                console.log('Audio permission granted');
            } else {
                setAudioAvailable(false);
                console.log('Audio permission denied');
            }

            if (navigator.mediaDevices.getDisplayMedia) {
                setScreenAvailable(true);
            } else {
                setScreenAvailable(false);
            }

            if (videoAvailable || audioAvailable) {
                const userMediaStream = await navigator.mediaDevices.getUserMedia({ video: videoAvailable, audio: audioAvailable });
                if (userMediaStream) {
                    window.localStream = userMediaStream;
                    if (localVideoref.current) {
                        localVideoref.current.srcObject = userMediaStream;
                    }
                }
            }
        } catch (error) {
            console.log(error);
        }
    };

    useEffect(() => {
        if (video !== undefined && audio !== undefined) {
            getUserMedia();
            console.log("SET STATE HAS ", video, audio);

        }


    }, [video, audio])
    let getMedia = () => {
        setVideo(videoAvailable);
        setAudio(audioAvailable);
        connectToSocketServer();

    }




    // Attach a media stream to a peer connection using modern APIs.
    // Reuses an existing sender of the same kind via replaceTrack, otherwise adds a new track.
    let attachStreamToPeer = (peerConnection, stream) => {
        if (!peerConnection || !stream) return;

        const senders = peerConnection.getSenders();

        stream.getTracks().forEach((track) => {
            const sender = senders.find(s => s.track && s.track.kind === track.kind);
            if (sender) {
                sender.replaceTrack(track).catch(e => console.log(e));
            } else {
                peerConnection.addTrack(track, stream);
            }
        });
    };

    let getUserMediaSuccess = (stream) => {
        try {
            window.localStream.getTracks().forEach(track => track.stop())
        } catch (e) { console.log(e) }

        window.localStream = stream
        localVideoref.current.srcObject = stream
        originalCameraStreamRef.current = stream;

        // Re-apply the virtual background if one was active before the camera restarted
        if (vbStateRef.current.mode !== "none") {
            applyBackground(vbStateRef.current.mode, vbStateRef.current.source, vbStateRef.current.presetId);
        }

        for (let id in connections) {
            if (id === socketIdRef.current) continue

            attachStreamToPeer(connections[id], window.localStream)

            connections[id].createOffer().then((description) => {
                console.log(description)
                connections[id].setLocalDescription(description)
                    .then(() => {
                        socketRef.current.emit('signal', id, JSON.stringify({ 'sdp': connections[id].localDescription }))
                    })
                    .catch(e => console.log(e))
            })
        }

        stream.getTracks().forEach(track => track.onended = () => {
            setVideo(false);
            setAudio(false);

            try {
                let tracks = localVideoref.current.srcObject.getTracks()
                tracks.forEach(track => track.stop())
            } catch (e) { console.log(e) }

            let blackSilence = (...args) => new MediaStream([black(...args), silence()])
            window.localStream = blackSilence()
            localVideoref.current.srcObject = window.localStream

            for (let id in connections) {
                attachStreamToPeer(connections[id], window.localStream)

                connections[id].createOffer().then((description) => {
                    connections[id].setLocalDescription(description)
                        .then(() => {
                            socketRef.current.emit('signal', id, JSON.stringify({ 'sdp': connections[id].localDescription }))
                        })
                        .catch(e => console.log(e))
                })
            }
        })
    }

    let getUserMedia = () => {
        if ((video && videoAvailable) || (audio && audioAvailable)) {
            navigator.mediaDevices.getUserMedia({ video: video, audio: audio })
                .then(getUserMediaSuccess)
                .then((stream) => { })
                .catch((e) => console.log(e))
        } else {
            try {
                let tracks = localVideoref.current.srcObject.getTracks()
                tracks.forEach(track => track.stop())
            } catch (e) { }
        }
    }





    let getDislayMediaSuccess = (stream) => {
        console.log("HERE")
        try {
            window.localStream.getTracks().forEach(track => track.stop())
        } catch (e) { console.log(e) }

        window.localStream = stream
        localVideoref.current.srcObject = stream

        for (let id in connections) {
            if (id === socketIdRef.current) continue

            attachStreamToPeer(connections[id], window.localStream)

            connections[id].createOffer().then((description) => {
                connections[id].setLocalDescription(description)
                    .then(() => {
                        socketRef.current.emit('signal', id, JSON.stringify({ 'sdp': connections[id].localDescription }))
                    })
                    .catch(e => console.log(e))
            })
        }

        stream.getTracks().forEach(track => track.onended = () => {
            setScreen(false)

            try {
                let tracks = localVideoref.current.srcObject.getTracks()
                tracks.forEach(track => track.stop())
            } catch (e) { console.log(e) }

            let blackSilence = (...args) => new MediaStream([black(...args), silence()])
            window.localStream = blackSilence()
            localVideoref.current.srcObject = window.localStream

            getUserMedia()

        })
    }

    let gotMessageFromServer = (fromId, message) => {
        var signal = JSON.parse(message)

        if (fromId !== socketIdRef.current) {
            if (signal.sdp) {
                connections[fromId].setRemoteDescription(new RTCSessionDescription(signal.sdp)).then(() => {
                    if (signal.sdp.type === 'offer') {
                        connections[fromId].createAnswer().then((description) => {
                            connections[fromId].setLocalDescription(description).then(() => {
                                socketRef.current.emit('signal', fromId, JSON.stringify({ 'sdp': connections[fromId].localDescription }))
                            }).catch(e => console.log(e))
                        }).catch(e => console.log(e))
                    }
                }).catch(e => console.log(e))
            }

            if (signal.ice) {
                connections[fromId].addIceCandidate(new RTCIceCandidate(signal.ice)).catch(e => console.log(e))
            }
        }
    }




    let connectToSocketServer = () => {
        socketRef.current = io.connect(server_url, { secure: false })

        socketRef.current.on('signal', gotMessageFromServer)

        socketRef.current.on('connect', () => {
            socketRef.current.emit('join-call', window.location.href)
            socketIdRef.current = socketRef.current.id

            socketRef.current.on('chat-message', addMessage)

            socketRef.current.on('reaction', ({ emoji, userId }) => {
                const id = ++reactionIdRef.current;
                setReactions((prev) => [...prev.slice(-19), { id, emoji, userId }]);
                setTimeout(() => {
                    setReactions((prevReactions) => prevReactions.filter((r) => r.id !== id));
                }, 2400);
            })

            socketRef.current.on('transcript-history', (history) => {
                if (Array.isArray(history)) setTranscript(history);
            })

            socketRef.current.on('caption-final', handleCaptionFinal)

            socketRef.current.on('user-left', (id) => {
                setVideos((videos) => videos.filter((video) => video.socketId !== id))
            })

            socketRef.current.on('user-joined', (id, clients) => {
                clients.forEach((socketListId) => {

                    connections[socketListId] = new RTCPeerConnection(peerConfigConnections)
                    // Wait for their ice candidate       
                    connections[socketListId].onicecandidate = function (event) {
                        if (event.candidate != null) {
                            socketRef.current.emit('signal', socketListId, JSON.stringify({ 'ice': event.candidate }))
                        }
                    }

                    // Wait for their video stream
                    connections[socketListId].ontrack = (event) => {
                        const stream = event.streams[0];
                        console.log("BEFORE:", videoRef.current);
                        console.log("FINDING ID: ", socketListId);

                        let videoExists = videoRef.current.find(video => video.socketId === socketListId);

                        if (videoExists) {
                            console.log("FOUND EXISTING");

                            // Update the stream of the existing video
                            setVideos(videos => {
                                const updatedVideos = videos.map(video =>
                                    video.socketId === socketListId ? { ...video, stream: stream } : video
                                );
                                videoRef.current = updatedVideos;
                                return updatedVideos;
                            });
                        } else {
                            // Create a new video
                            console.log("CREATING NEW");
                            let newVideo = {
                                socketId: socketListId,
                                stream: stream,
                                autoplay: true,
                                playsinline: true
                            };

                            setVideos(videos => {
                                const updatedVideos = [...videos, newVideo];
                                videoRef.current = updatedVideos;
                                return updatedVideos;
                            });
                        }
                    };


                    // Add the local video stream
                    if (window.localStream !== undefined && window.localStream !== null) {
                        attachStreamToPeer(connections[socketListId], window.localStream)
                    } else {
                        let blackSilence = (...args) => new MediaStream([black(...args), silence()])
                        window.localStream = blackSilence()
                        attachStreamToPeer(connections[socketListId], window.localStream)
                    }
                })

                if (id === socketIdRef.current) {
                    for (let id2 in connections) {
                        if (id2 === socketIdRef.current) continue

                        try {
                            attachStreamToPeer(connections[id2], window.localStream)
                        } catch (e) { }

                        connections[id2].createOffer().then((description) => {
                            connections[id2].setLocalDescription(description)
                                .then(() => {
                                    socketRef.current.emit('signal', id2, JSON.stringify({ 'sdp': connections[id2].localDescription }))
                                })
                                .catch(e => console.log(e))
                        })
                    }
                }
            })
        })
    }

    let silence = () => {
        let ctx = new AudioContext()
        let oscillator = ctx.createOscillator()
        let dst = oscillator.connect(ctx.createMediaStreamDestination())
        oscillator.start()
        ctx.resume()
        return Object.assign(dst.stream.getAudioTracks()[0], { enabled: false })
    }
    let black = ({ width = 640, height = 480 } = {}) => {
        let canvas = Object.assign(document.createElement("canvas"), { width, height })
        canvas.getContext('2d').fillRect(0, 0, width, height)
        let stream = canvas.captureStream()
        return Object.assign(stream.getVideoTracks()[0], { enabled: false })
    }

    let handleVideo = () => {
        setVideo(!video);
        // getUserMedia();
    }
    let handleAudio = () => {
        setAudio(!audio)
        // getUserMedia();
    }

    useEffect(() => {
        if (screen !== undefined) {
            getDislayMedia();
        }
    }, [screen])
    let handleScreen = () => {
        setScreen(!screen);
    }

    // The room path doubles as the meeting code (see home.jsx navigation).
    let getMeetingCode = () => decodeURIComponent(window.location.pathname.slice(1));

    let setLiveCaption = (userId, text) => {
        setLiveCaptions((prev) => {
            if (!text) {
                if (!(userId in prev)) return prev;
                const next = { ...prev };
                delete next[userId];
                return next;
            }
            return { ...prev, [userId]: text };
        });
    };

    // Finalized segments arrive for every speaker through the server echo,
    // so local and remote captions share one code path.
    let handleCaptionFinal = ({ text, speaker, timestamp, userId }) => {
        setLiveCaption(userId, "");
        setTranscript((prev) => [...prev, { speaker, text, timestamp }]);
    };

    let toggleCaptions = () => {
        setCaptionsOn((prev) => !prev);
    };

    // Start/stop local speech-to-text as captions or the mic are toggled.
    useEffect(() => {
        if (!captionsOn || audio === false || !captionsSupported) {
            speechServiceRef.current?.stop();
            speechServiceRef.current = null;
            setLiveCaption(socketIdRef.current, "");
            return;
        }

        const service = new SpeechRecognitionService();
        speechServiceRef.current = service;
        service.start({
            onInterim: (text) => setLiveCaption(socketIdRef.current, text),
            onFinal: (text) => {
                socketRef.current?.emit("caption-final", { text, speaker: usernameRef.current || "You" });
            },
            onError: (reason) => {
                console.log("Captions error:", reason);
                if (reason === "not-allowed" || reason === "unavailable") setCaptionsOn(false);
            }
        });

        return () => {
            service.stop();
            if (speechServiceRef.current === service) speechServiceRef.current = null;
        };
    }, [captionsOn, audio, captionsSupported])

    // Keep the transcript panel pinned to the newest entry.
    useEffect(() => {
        if (transcriptOpen && transcriptListRef.current) {
            transcriptListRef.current.scrollTop = transcriptListRef.current.scrollHeight;
        }
    }, [transcript, transcriptOpen])

    let persistTranscript = () => {
        if (!transcript.length) return Promise.resolve();
        if (!localStorage.getItem("token")) return Promise.resolve(); // guest join — nothing to persist under
        return saveTranscript(getMeetingCode(), transcript).catch((e) => console.log(e));
    };

    let handleEndCall = async () => {
        try {
            vbProcessorRef.current?.stop();
            vbProcessorRef.current = null;
            speechServiceRef.current?.stop();
            speechServiceRef.current = null;
            let tracks = localVideoref.current.srcObject.getTracks()
            tracks.forEach(track => track.stop())
        } catch (e) { }
        try {
            await persistTranscript();
        } catch (e) { console.log(e); }

        // Calls with captured speech go to the AI summary screen; everything
        // else lands back on the landing page.
        if (transcript.length && localStorage.getItem("token")) {
            routeTo(`/summary/${encodeURIComponent(getMeetingCode())}`);
        } else {
            window.location.href = "/";
        }
    }

    let openChat = () => {
        setModal(true);
        setNewMessages(0);
    }
    let closeChat = () => {
        setModal(false);
    }
    let handleMessage = (e) => {
        setMessage(e.target.value);
    }

    const addMessage = (data, sender, socketIdSender) => {
        setMessages((prevMessages) => [
            ...prevMessages,
            { sender: sender, data: data }
        ]);
        if (socketIdSender !== socketIdRef.current) {
            setNewMessages((prevNewMessages) => prevNewMessages + 1);
        }
    };



    // Apply / change / remove the virtual background effect.
    let applyBackground = async (mode, source = null, presetId = null) => {
        try {
            vbStateRef.current = { mode, source, presetId };
            setBgMode(mode);
            setBgPresetId(presetId);

            const current = window.localStream;
            if (!current) return;

            // Turning OFF: restore the pristine camera stream everywhere.
            if (mode === "none") {
                vbProcessorRef.current?.stop();
                vbProcessorRef.current = null;
                const pristine = originalCameraStreamRef.current || current;
                window.localStream = pristine;
                localVideoref.current.srcObject = pristine;
                for (let id in connections) {
                    attachStreamToPeer(connections[id], pristine);
                }
                return;
            }

            if (!current.getVideoTracks().length) return;

            // First time engaging an effect: remember the raw camera stream.
            if (!vbProcessorRef.current) {
                originalCameraStreamRef.current = current;
            }

            const processor = vbProcessorRef.current || (vbProcessorRef.current = new VirtualBackgroundProcessor());
            const processed = await processor.start(originalCameraStreamRef.current, mode, source);

            window.localStream = processed;
            localVideoref.current.srcObject = processed;
            for (let id in connections) {
                attachStreamToPeer(connections[id], processed);
            }
        } catch (e) {
            console.log("Virtual background error:", e);
        }
    }

    let handlePresetBackground = (preset) => {
        applyBackground("image", createPresetBackground(preset), preset.id);
    }

    let handleCustomBackground = (e) => {
        const file = e.target.files && e.target.files[0];
        if (!file) return;
        const img = new Image();
        img.onload = () => {
            applyBackground("image", img, "custom");
        };
        img.src = URL.createObjectURL(file);
        e.target.value = "";
    }

    let sendReaction = (emoji) => {
        socketRef.current?.emit('reaction', { emoji });
    }

    let sendMessage = () => {
        console.log(socketRef.current);
        socketRef.current.emit('chat-message', message, username)
        setMessage("");

        // this.setState({ message: "", sender: username })
    }

    
    let connect = () => {
        if (!username.trim()) return;
        setAskForUsername(false);
        getMedia();
    }


    return (
        <div>

            {askForUsername === true ?

                <div className={styles.lobbyScreen}>
                    <div className={styles.lobbyBrand}><span></span> Webcrat Call</div>
                    <div className={styles.lobbyContent}>
                        <section className={styles.lobbyIntro}>
                            <p className={styles.lobbyEyebrow}>READY WHEN YOU ARE</p>
                            <h1>Join the conversation.</h1>
                            <p>Check your camera, choose a display name, and you are all set to enter the room.</p>
                            <div className={styles.roomPill}>? Meeting room: {decodeURIComponent(window.location.pathname.slice(1))}</div>
                        </section>
                        <section className={styles.lobbyCard}>
                            <div className={styles.previewFrame}>
                                <video ref={localVideoref} autoPlay muted playsInline></video>
                                <span className={styles.previewLabel}>You</span>
                            </div>
                            <div className={styles.lobbyForm}>
                                <label htmlFor="display-name">Your display name</label>
                                <TextField id="display-name" fullWidth placeholder="How should others see you?" value={username} onChange={e => setUsername(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && connect()} />
                                <Button variant="contained" onClick={connect} disabled={!username.trim()}>Join meeting <span>?</span></Button>
                                <p>Your camera and microphone are only shared after you join.</p>
                            </div>
                        </section>
                    </div>
                </div> :


                <div className={styles.meetVideoContainer}>

                    {showModal ? <div className={styles.chatRoom}>

                        <div className={styles.chatContainer}>
                            <h1>Chat</h1>

                            <div className={styles.chattingDisplay}>

                                {messages.length !== 0 ? messages.map((item, index) => {

                                    console.log(messages)
                                    return (
                                        <div style={{ marginBottom: "20px" }} key={index}>
                                            <p style={{ fontWeight: "bold" }}>{item.sender}</p>
                                            <p>{item.data}</p>
                                        </div>
                                    )
                                }) : <p>No Messages Yet</p>}


                            </div>

                            <div className={styles.chattingArea}>
                                <TextField value={message} onChange={(e) => setMessage(e.target.value)} id="outlined-basic" label="Enter Your chat" variant="outlined" />
                                <Button variant='contained' onClick={sendMessage}>Send</Button>
                            </div>


                        </div>
                    </div> : <></>}

                    {transcriptOpen ? <div className={styles.chatRoom}>

                        <div className={styles.chatContainer}>
                            <h1>Live transcript</h1>

                            <div className={styles.chattingDisplay} ref={transcriptListRef}>
                                {transcript.length !== 0 ? transcript.map((item, index) => (
                                    <div style={{ marginBottom: "20px" }} key={index}>
                                        <p style={{ fontWeight: "bold" }}>{item.speaker}</p>
                                        <p>{item.text}</p>
                                    </div>
                                )) : <p>No speech captured yet</p>}
                            </div>

                        </div>
                    </div> : <></>}


                    {bgPanelOpen ? (
                        <div className={styles.bgPanel}>
                            <div className={styles.bgPanelTitle}>Virtual background</div>
                            <div className={styles.bgOptions}>
                                <button type="button" className={`${styles.bgOption} ${bgMode === "none" ? styles.bgOptionActive : ""}`} onClick={() => applyBackground("none")}>
                                    <span className={styles.bgThumbNone}>🚫</span>
                                    <span>None</span>
                                </button>
                                <button type="button" className={`${styles.bgOption} ${bgMode === "blur" ? styles.bgOptionActive : ""}`} onClick={() => applyBackground("blur")}>
                                    <span className={styles.bgThumbBlur}></span>
                                    <span>Blur</span>
                                </button>
                                {BACKGROUND_PRESETS.map((preset) => (
                                    <button key={preset.id} type="button" className={`${styles.bgOption} ${bgPresetId === preset.id ? styles.bgOptionActive : ""}`} onClick={() => handlePresetBackground(preset)}>
                                        <span className={styles.bgThumb} style={{ background: `linear-gradient(135deg, ${preset.colors.join(", ")})` }}></span>
                                        <span>{preset.label}</span>
                                    </button>
                                ))}
                                <label className={`${styles.bgOption} ${bgPresetId === "custom" ? styles.bgOptionActive : ""}`}>
                                    <input type="file" accept="image/*" style={{ display: "none" }} onChange={handleCustomBackground} />
                                    <span className={styles.bgThumbUpload}>＋</span>
                                    <span>Upload</span>
                                </label>
                            </div>
                        </div>
                    ) : <></>}

                    <div className={styles.buttonContainers}>
                        <IconButton onClick={handleVideo} style={{ color: "white" }}>
                            {(video === true) ? <VideocamIcon /> : <VideocamOffIcon />}
                        </IconButton>
                        <IconButton onClick={handleEndCall} style={{ color: "red" }}>
                            <CallEndIcon  />
                        </IconButton>
                        <IconButton onClick={handleAudio} style={{ color: "white" }}>
                            {audio === true ? <MicIcon /> : <MicOffIcon />}
                        </IconButton>

                        {screenAvailable === true ?
                            <IconButton onClick={handleScreen} style={{ color: "white" }}>
                                {screen === true ? <ScreenShareIcon /> : <StopScreenShareIcon />}
                            </IconButton> : <></>}

                        <div className={styles.reactionBar}>
                            {REACTION_EMOJIS.map((emoji) => (
                                <button key={emoji} type="button" className={styles.reactionButton} onClick={() => sendReaction(emoji)} title={`Send ${emoji}`}>
                                    {emoji}
                                </button>
                            ))}
                        </div>

                        <IconButton onClick={() => setBgPanelOpen(!bgPanelOpen)} style={{ color: (bgPanelOpen || bgMode !== "none") ? "#8b83ff" : "white" }} title="Virtual background">
                            <WallpaperIcon />
                        </IconButton>

                        {captionsSupported ?
                            <IconButton onClick={toggleCaptions} style={{ color: captionsOn ? "#8b83ff" : "white" }} title="Live captions">
                                <ClosedCaptionIcon />
                            </IconButton> : <></>}

                        <IconButton onClick={() => setTranscriptOpen(!transcriptOpen)} style={{ color: transcriptOpen ? "#8b83ff" : "white" }} title="Live transcript">
                            <ArticleIcon />
                        </IconButton>

                        <Badge badgeContent={newMessages} max={999} color='orange'>
                            <IconButton onClick={() => setModal(!showModal)} style={{ color: "white" }}>
                                <ChatIcon />
                            </IconButton>
                        </Badge>

                    </div>


                    <video className={styles.meetUserVideo} ref={localVideoref} autoPlay muted></video>

                    {liveCaptions[socketIdRef.current] ?
                        <div className={styles.captionOverlaySelf}>
                            <span className={styles.captionBubble}>{liveCaptions[socketIdRef.current]}</span>
                        </div> : <></>}

                    <div className={styles.selfReactionOverlay}>
                        <AnimatePresence>
                            {reactions.filter((r) => r.userId === socketIdRef.current).map((r) => (
                                <motion.span
                                    key={r.id}
                                    className={styles.floatingEmoji}
                                    initial={{ opacity: 0, y: 30, scale: 0.4 }}
                                    animate={{ opacity: [0, 1, 1, 0], y: -110, scale: [0.4, 1.3, 1.05, 1.15] }}
                                    exit={{ opacity: 0, y: -150 }}
                                    transition={{ duration: 2.2, ease: 'easeOut' }}
                                >
                                    {r.emoji}
                                </motion.span>
                            ))}
                        </AnimatePresence>
                    </div>

                    <div className={styles.conferenceView}>
                        {videos.map((video) => (
                            <div key={video.socketId} className={styles.videoTile}>
                                <video

                                    data-socket={video.socketId}
                                    ref={ref => {
                                        if (ref && video.stream) {
                                            ref.srcObject = video.stream;
                                        }
                                    }}
                                    autoPlay
                                >
                                </video>
                                <div className={styles.reactionOverlay}>
                                    <AnimatePresence>
                                        {reactions.filter((r) => r.userId === video.socketId).map((r) => (
                                            <motion.span
                                                key={r.id}
                                                className={styles.floatingEmoji}
                                                initial={{ opacity: 0, y: 30, scale: 0.4 }}
                                                animate={{ opacity: [0, 1, 1, 0], y: -110, scale: [0.4, 1.3, 1.05, 1.15] }}
                                                exit={{ opacity: 0, y: -150 }}
                                                transition={{ duration: 2.2, ease: 'easeOut' }}
                                            >
                                                {r.emoji}
                                            </motion.span>
                                        ))}
                                    </AnimatePresence>
                                </div>
                                {liveCaptions[video.socketId] ?
                                    <div className={styles.captionOverlay}>
                                        <span className={styles.captionBubble}>{liveCaptions[video.socketId]}</span>
                                    </div> : <></>}
                            </div>

                        ))}

                    </div>

                </div>

            }

        </div>
    )
}

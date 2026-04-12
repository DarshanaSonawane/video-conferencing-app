# 📹 Video Conferencing App

A real-time video conferencing application where multiple users can join a call, chat with each other, and share their screens — built with JavaScript using WebRTC and Socket.IO.

---

## About

This project is a Zoom/Google Meet-inspired video conferencing app built from scratch. It supports multi-party video and audio calls, a real-time chat panel, and screen sharing — all running directly in the browser using WebRTC technology.

---

## Features

- 🎥 **Multi-user video & audio calls** — multiple participants in a single room
- 💬 **Real-time group chat** — send messages during a call
- 🖥️ **Screen sharing** — share your screen with all participants
- 🔇 **Mute / unmute audio** — toggle microphone on and off
- 📷 **Camera on / off** — toggle video feed
- 🔗 **Shareable room link** — invite others by sharing a room URL
- 📱 **Responsive UI** — works on desktop and mobile browsers

---

## Tech Stack

| Layer        | Technology                          |
|--------------|-------------------------------------|
| Frontend     | HTML, CSS, JavaScript / React       |
| Backend      | Node.js, Express.js                 |
| Real-time    | Socket.IO                           |
| Video/Audio  | WebRTC (PeerJS / native API)        |
| Screen Share | WebRTC `getDisplayMedia` API        |

---

## Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) (v16 or higher)
- A modern browser (Chrome, Firefox, Edge) with camera & microphone access

### Installation

1. **Clone the repository**

   ```bash
   git clone https://github.com/DarshanaSonawane/video-conferencing-app.git
   cd video-conferencing-app
   ```

2. **Install dependencies**

   ```bash
   npm install
   ```

3. **Start the server**

   ```bash
   npm start
   ```

4. Open your browser and visit `http://localhost:3000`

5. Share the room URL with others to start a multi-user call!

---

## Project Structure

```
video-conferencing-app/
├── public/                  # Frontend
│   ├── index.html           # Landing / join room page
│   ├── room.html            # Video call room
│   ├── style.css
│   └── app.js               # WebRTC + Socket.IO client logic
├── server/
│   ├── index.js             # Express + Socket.IO server
│   └── rooms.js             # Room management logic
├── package.json
└── README.md
```

---

## How It Works

```
User A joins room → Server creates/joins room via Socket.IO
                  → WebRTC peer connection established with User B
                  → Video/audio streams exchanged directly (P2P)
                  → Chat messages routed through Socket.IO server
                  → Screen share uses getDisplayMedia() API
```

1. A user creates or joins a room via a unique room ID
2. Socket.IO handles signalling between peers (offer, answer, ICE candidates)
3. WebRTC establishes a direct peer-to-peer media stream
4. Chat messages are broadcast to all users in the room via Socket.IO
5. Screen sharing replaces the user's video track with their display stream

---

## What I Learned

- How WebRTC handles peer-to-peer video and audio streaming
- Using Socket.IO for signalling and real-time messaging
- Managing multiple peer connections in a multi-user room
- Implementing screen sharing with the `getDisplayMedia` API
- Building a responsive video grid layout in CSS

---

## Screenshots

> _Add your screenshots here_

---

## Future Improvements

- [ ] Recording calls and saving to local storage
- [ ] Virtual backgrounds
- [ ] Raise hand / emoji reactions
- [ ] Authentication and persistent chat history
- [ ] Deploy to cloud (Railway, Render, or Vercel)

---

## License

This project is licensed under the [MIT License](LICENSE).

---

## Author

**Darshana Sonawane**  
[GitHub](https://github.com/DarshanaSonawane)

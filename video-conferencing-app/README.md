# 📹 Webcrat Call — Video Conferencing App

A real-time video conferencing application where multiple users can join a call, chat with each other, and share their screens — built with **React**, **Node.js**, **WebRTC**, and **Socket.IO**.

---

## About

This project is a Zoom/Google Meet-inspired video conferencing app built from scratch. It supports multi-party video and audio calls, a real-time chat panel, and screen sharing — all running directly in the browser using WebRTC technology.

---

## Features

- 🎥 **Multi-user video & audio calls** — multiple participants in a single room (P2P mesh via WebRTC)
- 💬 **Real-time group chat** — send messages during a call, with unread badge
- 🖥️ **Screen sharing** — share your screen with all participants (`getDisplayMedia`)
- 🎭 **Virtual backgrounds** — blur your background or replace it with a preset/custom image, powered by in-browser AI segmentation (MediaPipe Selfie Segmentation)
- 👏 **Live reactions** — send emoji pop-ups (👍 ❤️ 👏 😂) that float up over each participant's video tile
- 🔇 **Mute / unmute audio** — toggle microphone on and off
- 📷 **Camera on / off** — toggle video feed
- 👤 **User accounts** — register & login with JWT-based authentication (7-day expiry)
- 🕘 **Meeting history** — every joined meeting code is saved per user
- 👥 **Guest join** — join any room without an account
- 🔗 **Shareable room link** — invite others by sharing a room URL
- 📱 **Responsive UI** — works on desktop and mobile browsers

---

## Tech Stack

| Layer        | Technology                                        |
|--------------|---------------------------------------------------|
| Frontend     | React 19, Material UI v7, React Router v7         |
| Backend      | Node.js, Express 5                                |
| Real-time    | Socket.IO 4                                       |
| Video/Audio  | WebRTC (native API + Google STUN)                 |
| Screen Share | WebRTC `getDisplayMedia` API                      |
| Database     | MongoDB Atlas (Mongoose ODM)                      |
| Auth         | JWT (`jsonwebtoken`) + bcrypt password hashing    |
| Virtual BG   | MediaPipe Selfie Segmentation (WASM, in-browser)  |
| Animations   | Framer Motion                                     |

---

## Project Structure

```
video-conferencing-app/
├── backend/                        # Express + Socket.IO server
│   ├── app.js                      # Server entry: Express, CORS, routes, MongoDB
│   ├── .env.example                # Environment variable template
│   └── src/
│       ├── controllers/
│       │   ├── socketManager.js    # Socket.IO signaling (SDP / ICE relay, chat, rooms)
│       │   └── user.controller.js  # Register / login (JWT) / meeting activity
│       ├── models/
│       │   ├── user.model.js       # User schema
│       │   └── meeting.model.js    # Meeting history schema
│       └── routes/
│           └── user.routes.js      # REST endpoints under /api/v1/users
└── frontend/                       # React app (Create React App)
    ├── public/
    └── src/
        ├── App.js                  # Routes: /, /auth, /home, /history, /:url
        ├── environment.js          # Backend URL config
        ├── contexts/
        │   └── AuthContext.jsx     # Auth state + API calls (axios)
        ├── pages/
        │   ├── LandingPage.jsx     # Landing page (guest join / login / signup)
        │   ├── authentication.jsx  # Login & signup form
        │   ├── home.jsx            # Dashboard: enter meeting code
        │   ├── history.jsx         # Past meetings list
        │   └── VideoMeet.jsx       # Video call room (WebRTC peer logic)
        ├── styles/
        │   └── VideoComponent.module.css
        └── utils/
            └── withAuth.jsx        # Route protection HOC
```

---

## Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) (v16 or higher)
- A MongoDB Atlas cluster (free tier works) — [create one here](https://www.mongodb.com/atlas)
- A modern browser (Chrome, Firefox, Edge) with camera & microphone access

### 1. Backend setup

```bash
cd backend
npm install
```

Create a `.env` file (copy `.env.example`):

```bash
cp .env.example .env
```

Fill in your values:

| Variable        | Description                                              |
|-----------------|----------------------------------------------------------|
| `MONGO_URI`     | MongoDB Atlas connection string                          |
| `PORT`          | Backend port (default `8000`)                            |
| `CLIENT_ORIGIN` | Frontend origin allowed by CORS (default `http://localhost:3000`) |
| `JWT_SECRET`    | Long random string used to sign auth tokens              |

Start the server:

```bash
npm start
```

### 2. Frontend setup

In a new terminal:

```bash
cd frontend
npm install
npm start
```

The app opens at `http://localhost:3000`. The frontend talks to the backend at `http://localhost:8000` by default (configurable in `frontend/src/environment.js` or via `REACT_APP_API_URL`).

3. Register an account (or use **Join as guest**), enter a meeting code, and share the room URL with others to start a multi-user call!

---

## How It Works

```
User A joins room → Server creates/joins room via Socket.IO
                  → WebRTC peer connections established with all participants
                  → SDP offers/answers + ICE candidates relayed through Socket.IO
                  → Video/audio streams exchanged directly (P2P mesh)
                  → Chat messages routed through the Socket.IO server
                  → Screen share replaces outgoing tracks via replaceTrack()
```

1. A user creates or joins a room via a unique room ID (the URL path)
2. Socket.IO handles signalling between peers (offer, answer, ICE candidates)
3. WebRTC establishes direct peer-to-peer media streams using modern APIs (`addTrack`, `ontrack`, `replaceTrack`)
4. Chat messages are broadcast to all users in the room via Socket.IO
5. Screen sharing swaps the outgoing video/audio tracks for the display stream
6. Virtual backgrounds run a segmentation model per frame on a canvas; the composited track replaces the outgoing camera track via `replaceTrack()` — no server changes needed
7. Reactions are pure Socket.IO signaling events: the client emits `reaction`, the server relays it to everyone in the room, and each client animates the emoji over the sender's video tile with Framer Motion
8. JWT tokens (7-day expiry) authenticate activity-history requests

---

## What I Learned

- How WebRTC handles peer-to-peer video and audio streaming
- Using Socket.IO for signalling and real-time messaging
- Managing multiple peer connections in a multi-user mesh topology
- Implementing screen sharing with the `getDisplayMedia` API and track replacement
- Building JWT-based authentication with bcrypt password hashing
- Securing a full-stack app: CORS restrictions, gitignored secrets, env templates

---

## Screenshots

> _Add your screenshots here_

---

## Future Improvements

- [ ] Recording calls and saving to local storage
- [x] ~~Virtual backgrounds~~ ✅ Done
- [x] ~~Raise hand / emoji reactions~~ ✅ Done
- [ ] Refresh tokens & persistent chat history
- [ ] TURN server fallback for restrictive networks
- [ ] Deploy to cloud (Railway, Render, or Vercel)

---

## License

This project is licensed under the [MIT License](LICENSE).

---

## Author

**Darshana Sonawane**
[GitHub](https://github.com/DarshanaSonawane)
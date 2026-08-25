import { Server } from "socket.io";

let connections = {};
let messages = {};
let transcripts = {};
let timeOnline = {};

export const connectToSocket = (server) => {
  const io = new Server(server, {
    cors: {
      origin: process.env.CLIENT_ORIGIN || "http://localhost:3000",
      methods: ["GET", "POST"],
      allowedHeaders: "*",
      credentials: true
    }
  });
  
  
  io.on("connection", (socket) => {
    console.log("New connection:", socket.id);

    // Example: client should emit "join-call" with { path }
    socket.on("join-call", ({ path }) => {
      if (!connections[path]) connections[path] = [];
      connections[path].push(socket.id);
      timeOnline[socket.id] = new Date();

      // Notify existing users
      connections[path].forEach((id) => {
        io.to(id).emit("user-joined", socket.id, connections[path]);
      });

      // Send previous messages
      if (messages[path]) {
        messages[path].forEach((msg) => {
          io.to(socket.id).emit("chat-message", msg.data, msg.sender, msg["socket-id-sender"]);
        });
      }

      // Catch late joiners up on the running transcript so far.
      if (transcripts[path]) {
        io.to(socket.id).emit("transcript-history", transcripts[path]);
      }
    });

    socket.on("signal", (toId, message) => {
      io.to(toId).emit("signal", socket.id, message);
    });

    // Reactions: relay an emoji pop-up to every participant in the sender's room.
    // Purely a signaling event — clients render the animation locally.
    socket.on("reaction", ({ emoji } = {}) => {
      if (!emoji) return;

      const [matchingRoom] = Object.entries(connections).find(([room, users]) => users.includes(socket.id)) || [];

      if (matchingRoom) {
        const payload = { emoji, userId: socket.id };
        connections[matchingRoom].forEach((id) => {
          io.to(id).emit("reaction", payload);
        });
      }
    });

    socket.on("chat-message", (data, sender) => {
      // Find the room of this socket
      const [matchingRoom] = Object.entries(connections).find(([room, users]) => users.includes(socket.id)) || [];

      if (matchingRoom) {
        if (!messages[matchingRoom]) messages[matchingRoom] = [];

        messages[matchingRoom].push({
          sender,
          data,
          "socket-id-sender": socket.id
        });

        // Broadcast message
        connections[matchingRoom].forEach((id) => {
          io.to(id).emit("chat-message", data, sender, socket.id);
        });
      }
    });

    // Live captions: relay a finalized speech-to-text segment to every
    // participant and keep an in-memory buffer for late joiners.
    socket.on("caption-final", ({ text, speaker } = {}) => {
      if (!text?.trim()) return;

      const [matchingRoom] = Object.entries(connections).find(([room, users]) => users.includes(socket.id)) || [];

      if (matchingRoom) {
        if (!transcripts[matchingRoom]) transcripts[matchingRoom] = [];

        const entry = { speaker, text: text.trim(), timestamp: new Date().toISOString() };
        transcripts[matchingRoom].push(entry);

        connections[matchingRoom].forEach((id) => {
          io.to(id).emit("caption-final", { ...entry, userId: socket.id });
        });
      }
    });

    socket.on("disconnect", () => {
      console.log("Disconnected:", socket.id);

      for (const [room, users] of Object.entries(connections)) {
        const index = users.indexOf(socket.id);
        if (index !== -1) {
          // Notify others
          users.forEach((id) => {
            if (id !== socket.id) io.to(id).emit("user-left", socket.id);
          });

          users.splice(index, 1);

          if (users.length === 0) {
            delete connections[room];
            delete transcripts[room];
          }
        }
      }

      delete timeOnline[socket.id];
    });
  });

  return io;
};

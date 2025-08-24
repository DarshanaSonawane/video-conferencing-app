import { Server } from "socket.io";

let connections = {};
let messages = {};
let timeOnline = {};

export const connectToSocket = (server) => {
  const io = new Server(server, {
    cors: {
      origin: "*",
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
    });

    socket.on("signal", (toId, message) => {
      io.to(toId).emit("signal", socket.id, message);
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

          if (users.length === 0) delete connections[room];
        }
      }

      delete timeOnline[socket.id];
    });
  });

  return io;
};

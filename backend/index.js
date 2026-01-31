import express from "express";
import { Server } from "socket.io";
import path from "path";
import dotenv from "dotenv";
import axios from "axios";
dotenv.config();

const app = express();
app.use(express.json());

// ================= EXPRESS SERVER =================
const PORT = process.env.PORT || 5000;

const server = app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

// ================= SOCKET.IO =================
const io = new Server(server, {
  cors: {
    origin: "*",
  },
});

const rooms = new Map();

io.on("connection", (socket) => {
  console.log("User Connected:", socket.id);

  let currentRoom = null;
  let currentUser = null;

  // ================= JOIN ROOM =================
  socket.on("join", ({ roomId, userName }) => {
    if (currentRoom && rooms.has(currentRoom)) {
      socket.leave(currentRoom);
      rooms.get(currentRoom).delete(currentUser);
      io.to(currentRoom).emit("userJoined", Array.from(rooms.get(currentRoom)));
    }

    currentRoom = roomId;
    currentUser = userName;

    socket.join(roomId);
    if (!rooms.has(roomId)) rooms.set(roomId, new Set());
    rooms.get(roomId).add(userName);

    io.to(roomId).emit("userJoined", Array.from(rooms.get(roomId)));
  });

  // ================= CODE CHANGE =================
  socket.on("codeChange", ({ roomId, code }) => {
    socket.to(roomId).emit("codeUpdate", code);
  });

  // ================= TYPING =================
  socket.on("typing", ({ roomId, userName }) => {
    socket.to(roomId).emit("userTyping", userName);
  });

  // ================= LANGUAGE CHANGE =================
  socket.on("languageChange", ({ roomId, language }) => {
    io.to(roomId).emit("languageUpdate", language);
  });

  // ================= COMPILE CODE =================
  socket.on("compileCode", async ({ roomId, code, language, version, stdin }) => {
    try {
      const response = await axios.post("https://emkc.org/api/v2/piston/execute", {
        language,
        version,
        files: [{ content: code }],
        stdin: stdin || "", // <-- Pass input here
      });

      const output = response.data.run.output;
      io.to(roomId).emit("codeResponse", output);
    } catch (err) {
      io.to(roomId).emit("codeResponse", `Error: ${err.message}`);
    }
  });

  // ================= LEAVE ROOM =================
  socket.on("leaveRoom", () => {
    if (currentRoom && currentUser && rooms.has(currentRoom)) {
      rooms.get(currentRoom).delete(currentUser);
      io.to(currentRoom).emit("userJoined", Array.from(rooms.get(currentRoom)));
      socket.leave(currentRoom);
      currentRoom = null;
      currentUser = null;
    }
  });

  // ================= DISCONNECT =================
  socket.on("disconnect", () => {
    if (currentRoom && currentUser && rooms.has(currentRoom)) {
      rooms.get(currentRoom).delete(currentUser);
      io.to(currentRoom).emit("userJoined", Array.from(rooms.get(currentRoom)));
    }
  });
});

// ================= FRONTEND SERVE =================
const __dirname = path.resolve();
app.use(express.static(path.join(__dirname, "../frontend/dist")));

app.get(/.*/, (req, res) => {
  res.sendFile(path.join(__dirname, "../frontend/dist/index.html"));
});

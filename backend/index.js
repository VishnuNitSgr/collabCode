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

function getLanguageId(language) {
  const map = {
    cpp: 54,
    c: 50,
    python: 71,
    javascript: 63,
    java: 62,
  };
  return map[language.toLowerCase()] || 54;
}

// ================= SOCKET.IO =================
const io = new Server(server, {
  cors: {
    origin: "*",
  },
});

const rooms = new Map();
const roomCode = new Map();

io.on("connection", (socket) => {
  console.log("User Connected:", socket.id);

  let currentRoom = null;
  let currentUser = null;
  let isCompiling = false;

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
    if (roomCode.has(roomId)) {
      socket.emit("codeUpdate", roomCode.get(roomId));
    }
  });

  // ================= CODE CHANGE =================
  socket.on("codeChange", ({ roomId, code }) => {
    roomCode.set(roomId, code);
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
    if (isCompiling) return;
    isCompiling = true;
    try {
      const response = await axios.post(
        "https://api.jdoodle.com/v1/execute",
        {
          script: code,
          language: mapLanguage(language),
          versionIndex: "0",
          stdin: stdin || "",
          clientId: process.env.JDOODLE_CLIENT_ID,
          clientSecret: process.env.JDOODLE_CLIENT_SECRET,
        }
      );

      const { output, statusCode, memory, cpuTime } = response.data;

      let finalOutput = output || "No output";

      if (finalOutput.toLowerCase().includes("error")) {
        finalOutput = "❌ Error:\n" + finalOutput;
      }

      io.to(roomId).emit(
        "codeResponse",
        `Output:\n${finalOutput}\n\nStatus: ${statusCode}\nTime: ${cpuTime}s\nMemory: ${memory}KB`
      );
    } catch (err) {
      console.error("Compile Error:", err.response?.data || err.message);
      io.to(roomId).emit(
        "codeResponse",
        `Error: ${err.response?.data?.message || err.message}`
      );
    } finally {
      isCompiling = false;
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

function mapLanguage(language) {
  const map = {
    cpp: "cpp17",
    c: "c",
    python: "python3",
    javascript: "nodejs",
    java: "java",
  };
  return map[language.toLowerCase()] || "cpp17";
}
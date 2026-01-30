import "./App.css";
import { useState, useEffect } from "react";
import io from "socket.io-client";
import Editor from "@monaco-editor/react";

// ✅ Connect to backend socket
const socket = io("http://localhost:5500");

const App = () => {
  const [joined, setJoined] = useState(false);
  const [roomId, setRoomId] = useState("");
  const [userName, setUserName] = useState("");
  const [language, setLanguage] = useState("javascript");
  const [code, setCode] = useState("// start code here");
  const [users, setUsers] = useState([]);
  const [typing, setTyping] = useState("");
  const [copySuccess, setCopySuccess] = useState("");

  // ================= SOCKET LISTENERS =================
  useEffect(() => {
    socket.on("userJoined", (users) => setUsers(users));
    socket.on("codeUpdate", (newCode) => setCode(newCode));
    socket.on("userTyping", (user) => {
      setTyping(`${user.slice(0, 8)}... is typing`);
      setTimeout(() => setTyping(""), 1500);
    });
    socket.on("languageUpdate", (newLang) => setLanguage(newLang));

    return () => {
      socket.off("userJoined");
      socket.off("codeUpdate");
      socket.off("userTyping");
      socket.off("languageUpdate");
    };
  }, []);

  // ================= WINDOW CLOSE =================
  useEffect(() => {
    const handleUnload = () => socket.emit("leaveRoom");
    window.addEventListener("beforeunload", handleUnload);
    return () => window.removeEventListener("beforeunload", handleUnload);
  }, []);

  // ================= ACTIONS =================
  const joinRoom = () => {
    if (!roomId || !userName) return;
    socket.emit("join", { roomId, userName });
    setJoined(true);
  };

  const leaveRoom = () => {
    socket.emit("leaveRoom");
    setJoined(false);
    setRoomId("");
    setUserName("");
    setCode("// start code here");
    setLanguage("javascript");
    setUsers([]);
  };

  const handleCodeChange = (newCode) => {
    if (newCode === undefined) return;
    setCode(newCode);
    socket.emit("codeChange", { roomId, code: newCode });
    socket.emit("typing", { roomId, userName });
  };

  const handleLanguageChange = (e) => {
    const newLang = e.target.value;
    setLanguage(newLang);
    socket.emit("languageChange", { roomId, language: newLang });
  };

  const copyRoomId = () => {
    navigator.clipboard.writeText(roomId);
    setCopySuccess("Copied!");
    setTimeout(() => setCopySuccess(""), 2000);
  };

  // ================= JOIN PAGE =================
  if (!joined)
    return (
      <div className="join-container">
        <div className="join-form">
          <h1>Join Code Room</h1>
          <input placeholder="Room ID" value={roomId} onChange={(e) => setRoomId(e.target.value)} />
          <input placeholder="Your Name" value={userName} onChange={(e) => setUserName(e.target.value)} />
          <button onClick={joinRoom}>Join</button>
        </div>
      </div>
    );

  // ================= EDITOR PAGE =================
  return (
    <div className="editor-container">
      <div className="sidebar">
        <h2>Room: {roomId}</h2>
        <button onClick={copyRoomId}>Copy Room ID</button>
        {copySuccess && <p>{copySuccess}</p>}

        <h3>Users</h3>
        <ul>
          {users.map((u, i) => (
            <li key={i}>{u ? u.slice(0, 8) : "Anonymous"}</li>
          ))}
        </ul>

        <p className="typing">{typing}</p>

        <select value={language} onChange={handleLanguageChange}>
          <option value="javascript">JavaScript</option>
          <option value="python">Python</option>
          <option value="java">Java</option>
          <option value="cpp">C++</option>
        </select>

        <button className="leave-btn" onClick={leaveRoom}>
          Leave Room
        </button>
      </div>

      <div className="editor-wrapper">
        <Editor
          height="100%"
          language={language}
          value={code}
          onChange={handleCodeChange}
          theme="vs-dark"
          options={{ minimap: { enabled: false }, fontSize: 14 }}
        />
      </div>
    </div>
  );
};

export default App;

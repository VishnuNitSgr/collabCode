import "./App.css";
import { useState, useEffect } from "react";
import io from "socket.io-client";
import Editor from "@monaco-editor/react";

const socket = io(import.meta.env.VITE_SOCKET_URL || "http://localhost:5000");

const App = () => {
  const [joined, setJoined] = useState(false);
  const [roomId, setRoomId] = useState("");
  const [userName, setUserName] = useState("");
  const [language, setLanguage] = useState("javascript");
  const [code, setCode] = useState("// start code here");
  const [stdin, setStdin] = useState(""); // <-- Input for code
  const [users, setUsers] = useState([]);
  const [typing, setTyping] = useState("");
  const [copySuccess, setCopySuccess] = useState("");
  const [output, setOutput] = useState("");
  const [version] = useState("*");

  /* ================= SOCKET LISTENERS ================= */
  useEffect(() => {
    socket.on("userJoined", setUsers);
    socket.on("codeUpdate", setCode);
    socket.on("languageUpdate", setLanguage);

    socket.on("userTyping", (user) => {
      setTyping(`${user.slice(0, 8)}... is typing`);
      setTimeout(() => setTyping(""), 1500);
    });

    socket.on("codeResponse", (result) => {
      setOutput(result || "No output");
    });

    return () => {
      socket.off();
    };
  }, []);

  /* ================= ACTIONS ================= */
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
    setStdin("");
    setLanguage("javascript");
    setUsers([]);
    setOutput("");
  };

  const handleCodeChange = (newCode) => {
    if (!newCode) return;
    setCode(newCode);
    socket.emit("codeChange", { roomId, code: newCode });
    socket.emit("typing", { roomId, userName });
  };

  const runCode = () => {
    setOutput("Running...");
    socket.emit("compileCode", {
      roomId,
      code,
      language,
      version,
      stdin, // send input to backend
    });
  };

  /* ================= AVATAR GENERATOR ================= */
  const generateAvatar = (name) => {
    if (!name) return { initials: "?", bgColor: "#999" };
    const initials = name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .slice(0, 2)
      .toUpperCase();

    const colors = [
      "#FF6B6B",
      "#6BCB77",
      "#4D96FF",
      "#FFD93D",
      "#FF6EC7",
      "#6E44FF",
      "#FFA500",
    ];
    let hash = 0;
    for (let i = 0; i < name.length; i++) hash += name.charCodeAt(i);
    const bgColor = colors[hash % colors.length];

    return { initials, bgColor };
  };

  /* ================= JOIN PAGE ================= */
  if (!joined)
    return (
      <div className="join-container">
        <div className="join-form">
          <h1>Join Code Room</h1>
          <input
            placeholder="Room ID"
            value={roomId}
            onChange={(e) => setRoomId(e.target.value)}
          />
          <input
            placeholder="Your Name"
            value={userName}
            onChange={(e) => setUserName(e.target.value)}
          />
          <button onClick={joinRoom}>Join</button>
        </div>
      </div>
    );

  /* ================= EDITOR PAGE ================= */
  return (
    <div className="editor-container">
      <div className="sidebar">
        <h2>Room: {roomId}</h2>
        <button
          className="copy-button"
          onClick={() => {
            navigator.clipboard.writeText(roomId);
            setCopySuccess("Copied!");
            setTimeout(() => setCopySuccess(""), 2000);
          }}
        >
          Copy Room ID
        </button>
        {copySuccess && <p className="copy-success">{copySuccess}</p>}

        <h3>Users</h3>
        <ul>
          {users.map((u, i) => {
            const { initials, bgColor } = generateAvatar(u);
            return (
              <li key={i}>
                <span
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    width: "35px",
                    height: "35px",
                    borderRadius: "50%",
                    backgroundColor: bgColor,
                    color: "#fff",
                    marginRight: "0.75rem",
                    fontWeight: "bold",
                    fontSize: "0.8rem",
                  }}
                >
                  {initials}
                </span>
                {u ? u.slice(0, 8) : "Anonymous"}
              </li>
            );
          })}
        </ul>

        <p className="typing">{typing}</p>

        <select
          className="language-selector"
          value={language}
          onChange={(e) =>
            socket.emit("languageChange", { roomId, language: e.target.value })
          }
        >
          <option value="javascript">JavaScript</option>
          <option value="python">Python</option>
          <option value="java">Java</option>
          <option value="cpp">C++</option>
        </select>

        {/* Input for code */}
        <textarea
          placeholder="Input (stdin)"
          value={stdin}
          onChange={(e) => setStdin(e.target.value)}
          style={{
            width: "100%",
            height: "60px",
            marginBottom: "0.5rem",
            borderRadius: "10px",
            padding: "0.5rem",
            backgroundColor: "#2c2c2c",
            color: "#fff",
            border: "none",
            resize: "none",
          }}
        />

        <button className="copy-button" onClick={runCode}>
          ▶ Run Code
        </button>

        <button className="leave-btn" onClick={leaveRoom}>
          Leave Room
        </button>
      </div>

      <div className="editor-wrapper" style={{ flexDirection: "column" }}>
        <Editor
          height="65%"
          language={language}
          value={code}
          onChange={handleCodeChange}
          theme="vs-dark"
          options={{ minimap: { enabled: false }, fontSize: 14 }}
        />

        <div className="output-box">
          <pre>{output}</pre>
        </div>
      </div>
    </div>
  );
};

export default App;

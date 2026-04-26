import { useEffect } from "react";
import { io } from "socket.io-client";
import dotenv from "dotenv";

dotenv.config();
const socket = io(process.env.VITE_BACKEND_URL);

export default function TestVoice() {
  useEffect(() => {
    const peers = {};

    async function start() {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });

      socket.emit("join-voice", "room1");

      socket.on("connect", () => {
        console.log("Socket connected:", socket.id);
      });

      socket.on("disconnect", () => {
        console.log("Socket disconnected");
      });

      socket.on("user-joined-voice", async (userId) => {
        const pc = createPeer(userId, stream);

        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);

        socket.emit("offer", { target: userId, offer });
      });

      socket.on("offer", async ({ from, offer }) => {
        const pc = createPeer(from, stream);

        await pc.setRemoteDescription(offer);
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);

        socket.emit("answer", { target: from, answer });
      });

      socket.on("answer", async ({ from, answer }) => {
        const pc = peers[from];
        if (pc && pc.signalingState !== "stable") {
          await pc.setRemoteDescription(answer);
        }
      });

      socket.on("ice-candidate", async ({ from, candidate }) => {
        const pc = peers[from];
        if (pc && candidate) {
          await pc.addIceCandidate(candidate);
        }
      });

      function createPeer(userId, stream) {
        const pc = new RTCPeerConnection({
          iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
        });

        stream.getTracks().forEach((track) => pc.addTrack(track, stream));

        pc.ontrack = (event) => {
          const audio = new Audio();
          audio.srcObject = event.streams[0];
          audio.autoplay = true;
          audio.muted = false;
          audio.play().catch((err) => {
            console.log("Audio play failed:", err);
          });
        };

        peers[userId] = pc;

        pc.onicecandidate = (event) => {
          if (event.candidate) {
            socket.emit("ice-candidate", {
              target: userId,
              candidate: event.candidate,
            });
          }
        };

        return pc;
      }
    }

    start();
  }, []);

  return <div>🎤 Testing Voice Chat...</div>;
}

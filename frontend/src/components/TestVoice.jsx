import { useEffect } from "react";
import { io } from "socket.io-client";

const socket = io("http://localhost:5500");

export default function TestVoice() {
  useEffect(() => {
    let isStarted = false;
    const peers = {};
    const iceQueue = {};

    async function start() {
      if (isStarted) return;
      isStarted = true;
      let stream;
      try {
        stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      } catch (err) {
        console.log("MIC PERMISSION ERROR:", err);
        alert("Please allow microphone access to use voice chat");
        return;
      }

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

        // prevent duplicate or invalid state
        if (pc.signalingState !== "stable") {
          return;
        }

        try {
          await pc.setRemoteDescription(offer);

          if (pc.signalingState !== "have-remote-offer") return;

          const answer = await pc.createAnswer();

          // double check state before setting
          if (pc.signalingState !== "have-remote-offer") return;

          await pc.setLocalDescription(answer);

          socket.emit("answer", { target: from, answer });
        } catch (err) {
          console.log("Offer handling skipped due to state change:", err);
        }
      });

      socket.on("answer", async ({ from, answer }) => {
        const pc = peers[from];
        if (!pc) return;

        if (pc.currentRemoteDescription) {
          return; // already set, ignore duplicate
        }

        await pc.setRemoteDescription(answer);

        // flush queued ICE candidates
        if (iceQueue[from]) {
          for (const candidate of iceQueue[from]) {
            await pc.addIceCandidate(candidate);
          }
          iceQueue[from] = [];
        }
      });

      socket.on("ice-candidate", async ({ from, candidate }) => {
        const pc = peers[from];
        if (pc && candidate) {
          if (pc.remoteDescription) {
            await pc.addIceCandidate(candidate);
          } else {
            if (!iceQueue[from]) iceQueue[from] = [];
            iceQueue[from].push(candidate);
          }
        }
      });

      function createPeer(userId, stream) {
        if (peers[userId]) return peers[userId];

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

    return () => {
      socket.off("user-joined-voice");
      socket.off("offer");
      socket.off("answer");
      socket.off("ice-candidate");
    };
  }, []);

  return <div>🎤 Testing Voice Chat...</div>;
}

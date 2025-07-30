const socket = io(); // connect to server

const localVideo = document.getElementById('localVideo');
const remoteVideo = document.getElementById('remoteVideo');

let localStream;
let peerConnection;
const config = { iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] };

// Step 1: Join room (roomId can be from URL or predefined)
const roomId = 'testRoom'; // can be dynamic
socket.emit('join-room', roomId);

// Step 2: Get media and show local stream
navigator.mediaDevices.getUserMedia({ video: true, audio: true })
    .then((stream) => {
        localStream = stream;
        localVideo.srcObject = stream;

        setupPeerConnection();
    });

// Step 3: Create peer connection and add local stream
function setupPeerConnection() {
    peerConnection = new RTCPeerConnection(config);

    localStream.getTracks().forEach(track => {
        peerConnection.addTrack(track, localStream);
    });

    peerConnection.ontrack = (event) => {
        remoteVideo.srcObject = event.streams[0];
    };

    peerConnection.onicecandidate = (event) => {
        if (event.candidate) {
            socket.emit('ice-candidate', {
                roomId,
                candidate: event.candidate
            });
        }
    };
}

// Step 4: Handle signals
socket.on('user-joined', async () => {
    const offer = await peerConnection.createOffer();
    await peerConnection.setLocalDescription(offer);

    socket.emit('offer', { roomId, offer });
});

socket.on('offer', async (offer) => {
    if (!peerConnection) setupPeerConnection();

    await peerConnection.setRemoteDescription(new RTCSessionDescription(offer));
    const answer = await peerConnection.createAnswer();
    await peerConnection.setLocalDescription(answer);

    socket.emit('answer', { roomId, answer });
});

socket.on('answer', async (answer) => {
    await peerConnection.setRemoteDescription(new RTCSessionDescription(answer));
});

socket.on('ice-candidate', (candidate) => {
    peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
});


const socket = io(); // already available from <script src="/socket.io/socket.io.js">

// Send chat message
function sendChatMessage() {
    const input = document.getElementById('chatInput');
    const message = input.value.trim();
    if (message) {
        socket.emit('chat-message', message);
        appendChatMessage('You', message, true); // append own message
        input.value = '';
    }
}

// Enter key handling
function handleChatKeyPress(event) {
    if (event.key === 'Enter') {
        event.preventDefault();
        sendChatMessage();
    }
}

// Receive messages
socket.on('chat-message', ({ sender, message }) => {
    appendChatMessage(sender || 'Partner', message, false);
});

// Append to chat window
function appendChatMessage(sender, message, isOwn = false) {
    const chatMessages = document.getElementById('chatMessages');
    const msgDiv = document.createElement('div');
    msgDiv.className = `chat-message ${isOwn ? 'own' : 'other'}`;
    msgDiv.innerHTML = `
        <span class="message-time">${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
        <span class="message-sender">${sender}</span>
        <span class="message-text">${message}</span>
    `;
    chatMessages.appendChild(msgDiv);
    chatMessages.scrollTop = chatMessages.scrollHeight;
}

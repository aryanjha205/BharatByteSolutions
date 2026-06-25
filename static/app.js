const myId = 'user_' + Math.random().toString(36).substring(2, 9);
let selectedMode = 'video'; // 'video' is active by default to match screenshot
let socket = null;
let mqttClient = null;
let peerConnection = null;
let localStream = null;
let partnerId = null;
let isMatched = false;
let isInitiator = false;

const isLocalhost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
const useWebSocket = isLocalhost;

let searchTimerInterval = null;
let searchPublishInterval = null;
let searchSeconds = 0;

// STUN Configuration for WebRTC
const rtcConfig = {
    iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' },
        { urls: 'stun:stun2.l.google.com:19302' }
    ]
};

// UI Elements
const viewLobby = document.getElementById('view-lobby');
const viewSearching = document.getElementById('view-searching');
const viewChat = document.getElementById('view-chat');

const btnModeVideo = document.getElementById('btn-mode-video');
const btnStart = document.getElementById('btn-start');
const btnCancel = document.getElementById('btn-cancel');

const btnNext = document.getElementById('btn-next');
const btnStop = document.getElementById('btn-stop');
const chatForm = document.getElementById('chat-form');
const chatInput = document.getElementById('chat-input');
const btnSend = document.getElementById('btn-send');
const chatMessagesLog = document.getElementById('chat-messages-log');
const chatPartnerTitle = document.getElementById('chat-partner-title');

const localVideo = document.getElementById('local-video');
const remoteVideo = document.getElementById('remote-video');
const remotePlaceholder = document.getElementById('remote-placeholder');
const chatLayout = document.querySelector('.chat-layout');
const serverStatus = document.getElementById('server-status');
const searchModeText = document.getElementById('search-mode-text');
const searchTimer = document.getElementById('search-timer');

// The app is video-only, so keep matchmaking locked to video.
if (btnModeVideo) {
    btnModeVideo.classList.add('active');
    btnModeVideo.addEventListener('click', () => {
        selectedMode = 'video';
    });
}

// View switcher helper
function switchView(viewId) {
    [viewLobby, viewSearching, viewChat].forEach(view => {
        view.classList.remove('active');
    });
    document.getElementById(viewId).classList.add('active');
}

// Format timer
function formatTime(totalSeconds) {
    const mins = Math.floor(totalSeconds / 60).toString().padStart(2, '0');
    const secs = (totalSeconds % 60).toString().padStart(2, '0');
    return `${mins}:${secs}`;
}

// Timer Functions
function startSearchTimer() {
    clearInterval(searchTimerInterval);
    searchSeconds = 0;
    searchTimer.textContent = '00:00';
    searchTimerInterval = setInterval(() => {
        searchSeconds++;
        searchTimer.textContent = formatTime(searchSeconds);
    }, 1000);
}

function stopSearchTimer() {
    clearInterval(searchTimerInterval);
}

// Initialize WebSocket connection to local server
function initWebSocket() {
    if (socket && (socket.readyState === WebSocket.OPEN || socket.readyState === WebSocket.CONNECTING)) {
        return;
    }

    serverStatus.className = 'status-badge';
    serverStatus.querySelector('.status-text').textContent = 'Connecting...';

    const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    socket = new WebSocket(`${proto}//${window.location.host}/ws`);

    socket.onopen = () => {
        console.log('Connected to WebSocket signaling server.');
        serverStatus.className = 'status-badge connected';
        serverStatus.querySelector('.status-text').textContent = 'Connected';
    };

    socket.onclose = () => {
        console.log('WebSocket connection closed.');
        serverStatus.className = 'status-badge disconnected';
        serverStatus.querySelector('.status-text').textContent = 'Disconnected';
        if (useWebSocket) {
            // Reconnect after 2 seconds
            setTimeout(initWebSocket, 2000);
        }
    };

    socket.onerror = (err) => {
        console.error('WebSocket error:', err);
        serverStatus.className = 'status-badge disconnected';
        serverStatus.querySelector('.status-text').textContent = 'Connection Error';
    };

    socket.onmessage = async (event) => {
        const msg = JSON.parse(event.data);
        console.log('Incoming message:', msg.type);

        switch (msg.type) {
            case 'searching':
                // Matchmaker is searching
                break;
            case 'matched':
                isMatched = true;
                isInitiator = msg.initiator;
                startChatSession();
                break;
            case 'offer':
                if (peerConnection) {
                    await peerConnection.setRemoteDescription(new RTCSessionDescription(msg.offer));
                    const answer = await peerConnection.createAnswer();
                    await peerConnection.setLocalDescription(answer);
                    sendSignalingMessage({ type: 'answer', answer: answer });
                }
                break;
            case 'answer':
                if (peerConnection) {
                    await peerConnection.setRemoteDescription(new RTCSessionDescription(msg.answer));
                }
                break;
            case 'candidate':
                if (peerConnection && msg.candidate) {
                    try {
                        await peerConnection.addIceCandidate(new RTCIceCandidate(msg.candidate));
                    } catch (e) {
                        console.error('Error adding Ice Candidate:', e);
                    }
                }
                break;
            case 'chat_message':
                appendChatMessage('Stranger', msg.message);
                break;
            case 'peer_disconnected':
                handlePeerDisconnect();
                break;
        }
    };
}

// Initialize MQTT Client (Serverless matchmaker and signaling broker for GitHub Pages)
function initMQTT() {
    if (mqttClient && mqttClient.connected) {
        return;
    }

    serverStatus.className = 'status-badge';
    serverStatus.querySelector('.status-text').textContent = 'Connecting...';

    // Connect to public broker over secure WebSockets
    // broker.hivemq.com supports WebSockets SSL on port 8884
    mqttClient = mqtt.connect('wss://broker.hivemq.com:8884/mqtt', {
        clientId: myId,
        keepalive: 60,
        reconnectPeriod: 2000
    });

    mqttClient.on('connect', () => {
        console.log('Connected to public MQTT signaling broker.');
        serverStatus.className = 'status-badge connected';
        serverStatus.querySelector('.status-text').textContent = 'Connected';
        
        // Subscribe to our private signaling topic
        mqttClient.subscribe(`bharatbyte/user/${myId}`, (err) => {
            if (err) console.error('Subscription error:', err);
        });
    });

    mqttClient.on('close', () => {
        console.log('MQTT connection closed.');
        serverStatus.className = 'status-badge disconnected';
        serverStatus.querySelector('.status-text').textContent = 'Disconnected';
    });

    mqttClient.on('error', (err) => {
        console.error('MQTT error:', err);
        serverStatus.className = 'status-badge disconnected';
        serverStatus.querySelector('.status-text').textContent = 'Connection Error';
    });

    mqttClient.on('message', async (topic, payload) => {
        const msg = JSON.parse(payload.toString());
        
        // Handle incoming messages on our private topic
        if (topic === `bharatbyte/user/${myId}`) {
            console.log('Incoming MQTT message:', msg.type);

            switch (msg.type) {
                case 'invite':
                    // Auto-accept invitations if we are searching and not matched
                    if (!isMatched && searchPublishInterval) {
                        isMatched = true;
                        partnerId = msg.from;
                        isInitiator = false;
                        
                        // Stop searching
                        stopSearching();
                        
                        // Send accept response
                        sendDirectMessage(partnerId, { type: 'accept', from: myId });
                        
                        // Setup chat view & WebRTC
                        startChatSession();
                    }
                    break;

                case 'accept':
                    if (!isMatched && searchPublishInterval) {
                        isMatched = true;
                        partnerId = msg.from;
                        isInitiator = true;
                        
                        // Stop searching
                        stopSearching();
                        
                        // Setup chat view & WebRTC
                        startChatSession();
                    }
                    break;

                case 'offer':
                    if (peerConnection && msg.from === partnerId) {
                        await peerConnection.setRemoteDescription(new RTCSessionDescription(msg.offer));
                        const answer = await peerConnection.createAnswer();
                        await peerConnection.setLocalDescription(answer);
                        sendDirectMessage(partnerId, { type: 'answer', answer: answer, from: myId });
                    }
                    break;

                case 'answer':
                    if (peerConnection && msg.from === partnerId) {
                        await peerConnection.setRemoteDescription(new RTCSessionDescription(msg.answer));
                    }
                    break;

                case 'candidate':
                    if (peerConnection && msg.from === partnerId && msg.candidate) {
                        try {
                            await peerConnection.addIceCandidate(new RTCIceCandidate(msg.candidate));
                        } catch (e) {
                            console.error('Error adding Ice Candidate:', e);
                        }
                    }
                    break;

                case 'chat_message':
                    if (msg.from === partnerId) {
                        appendChatMessage('Stranger', msg.message);
                    }
                    break;

                case 'disconnect':
                    if (msg.from === partnerId) {
                        handlePeerDisconnect();
                    }
                    break;
            }
        } 
        // Handle matchmaking lobby announcements
        else if (topic === `bharatbyte/lobby/${selectedMode}`) {
            if (msg.id !== myId && !isMatched && searchPublishInterval) {
                // To avoid multiple duplicate invite messages, let the peer with lexicographically smaller ID send the invite
                if (myId < msg.id) {
                    sendDirectMessage(msg.id, { type: 'invite', from: myId });
                }
            }
        }
    });
}

// Send private messages directly to a specific user's topic
function sendDirectMessage(recipient, payload) {
    if (mqttClient && mqttClient.connected) {
        mqttClient.publish(`bharatbyte/user/${recipient}`, JSON.stringify(payload));
    }
}

// Initialize active connection based on environment
function initConnection() {
    if (useWebSocket) {
        initWebSocket();
    } else {
        initMQTT();
    }
}

// Unified signaling message sender
function sendSignalingMessage(payload) {
    if (useWebSocket) {
        if (socket && socket.readyState === WebSocket.OPEN) {
            socket.send(JSON.stringify(payload));
        }
    } else {
        if (partnerId) {
            sendDirectMessage(partnerId, payload);
        }
    }
}

// Start capturing local camera & microphone feed
async function setupLocalStream() {
    if (localStream) {
        return; // already active
    }
    try {
        const constraints = {
            audio: true,
            video: selectedMode === 'video'
        };

        // Fallback check for browser-specific getUserMedia and secure contexts (HTTPS/localhost)
        const getMedia = (navigator.mediaDevices && navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices)) ||
                         navigator.getUserMedia ||
                         navigator.webkitGetUserMedia ||
                         navigator.mozGetUserMedia ||
                         navigator.msGetUserMedia;

        if (!getMedia) {
            throw new Error("Your browser connection is not secure (requires HTTPS or localhost) or doesn't support camera access.");
        }

        localStream = await getMedia(constraints);
        localVideo.srcObject = localStream;
        localVideo.style.display = 'block';
    } catch (err) {
        console.error('Failed to access local media devices:', err);
        let errorMsg = err.message;
        if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
            errorMsg = "Permission denied. Please allow camera and microphone access in your browser settings.";
        } else if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') {
            errorMsg = "No camera or microphone found on your device.";
        }
        appendSystemMessage(`System Error: ${errorMsg}`);
    }
}

// Start matchmaking broadcast
async function startSearch() {
    initConnection();

    // Reset WebRTC match connection state (keep local camera stream)
    cleanupWebRTC();
    
    // Transition to the chat/video view immediately
    switchView('view-chat');
    
    selectedMode = 'video';
    
    // Configure UI layout classes immediately so local camera box positions correctly and voice layout hides
    chatLayout.className = 'chat-layout';
    chatLayout.classList.add(`mode-${selectedMode}`);
    if (selectedMode === 'video') {
        chatLayout.classList.add('video-active');
    }
    
    // Set UI to searching/connecting state
    chatPartnerTitle.textContent = "Searching for a stranger...";
    remotePlaceholder.style.display = 'flex';
    remotePlaceholder.querySelector('p').textContent = "Searching for a stranger...";
    
    // Disable text message input while searching
    chatInput.disabled = true;
    chatInput.placeholder = "Waiting for a partner...";
    if (btnSend) btnSend.disabled = true;
    
    // Start local camera stream immediately
    await setupLocalStream();

    startSearchTimer();

    if (useWebSocket) {
        // Send search command to backend WebSocket
        if (socket && socket.readyState === WebSocket.OPEN) {
            sendSignalingMessage({ type: 'search', mode: selectedMode });
        } else {
            // Queue it for when connection is established
            socket.addEventListener('open', () => {
                sendSignalingMessage({ type: 'search', mode: selectedMode });
            }, { once: true });
        }
    } else {
        // Subscribe to public matchmaking lobby
        mqttClient.subscribe(`bharatbyte/lobby/${selectedMode}`);

        // Publish our presence every 1.5 seconds to pair with strangers
        clearInterval(searchPublishInterval);
        searchPublishInterval = setInterval(() => {
            if (mqttClient && mqttClient.connected) {
                mqttClient.publish(`bharatbyte/lobby/${selectedMode}`, JSON.stringify({
                    id: myId,
                    timestamp: Date.now()
                }));
            }
        }, 1500);
    }
}

// Stop broadcasting search presence
function stopSearching() {
    stopSearchTimer();
    if (!useWebSocket) {
        clearInterval(searchPublishInterval);
        searchPublishInterval = null;
        if (mqttClient) {
            mqttClient.unsubscribe(`bharatbyte/lobby/${selectedMode}`);
        }
    }
}

// Configure chat screen and WebRTC when matched
async function startChatSession() {
    // Clear old messages
    chatMessagesLog.innerHTML = '<div class="system-message">System: Connected to a stranger! Say hello.</div>';
    chatPartnerTitle.textContent = `Connected with a Stranger`;
    
    // Enable text message input
    chatInput.disabled = false;
    chatInput.placeholder = "Type a message to stranger...";
    if (btnSend) btnSend.disabled = false;
    
    // Update remote placeholder text
    remotePlaceholder.querySelector('p').textContent = "Waiting for stranger's camera...";
    
    // Configure UI mode layout
    chatLayout.className = 'chat-layout';
    chatLayout.classList.add(`mode-${selectedMode}`);
    if (selectedMode === 'video') {
        chatLayout.classList.add('video-active');
    }

    switchView('view-chat');
    await setupMediaAndWebRTC();
}

// Setup Media Streams and WebRTC Connection
async function setupMediaAndWebRTC() {
    try {
        peerConnection = new RTCPeerConnection(rtcConfig);

        // Exchange candidates
        peerConnection.onicecandidate = (event) => {
            if (event.candidate) {
                if (useWebSocket) {
                    sendSignalingMessage({
                        type: 'candidate',
                        candidate: event.candidate
                    });
                } else {
                    sendSignalingMessage({
                        type: 'candidate',
                        candidate: event.candidate,
                        from: myId
                    });
                }
            }
        };

        // Render remote track
        peerConnection.ontrack = (event) => {
            console.log('Received remote track.');
            if (remoteVideo.srcObject !== event.streams[0]) {
                remoteVideo.srcObject = event.streams[0];
                remotePlaceholder.style.display = 'none';
            }
        };

        // Ensure local stream is running
        await setupLocalStream();

        // Add local tracks to WebRTC peer connection
        if (localStream) {
            localStream.getTracks().forEach(track => {
                peerConnection.addTrack(track, localStream);
            });
        }

        // Caller creates offer
        if (isInitiator) {
            const offer = await peerConnection.createOffer();
            await peerConnection.setLocalDescription(offer);
            if (useWebSocket) {
                sendSignalingMessage({
                    type: 'offer',
                    offer: offer
                });
            } else {
                sendSignalingMessage({
                    type: 'offer',
                    offer: offer,
                    from: myId
                });
            }
        }

    } catch (err) {
        console.error('Failed to set up WebRTC:', err);
        appendSystemMessage(`System Error: WebRTC connection failure. (${err.message})`);
    }
}

// Handle peer disconnection notice
function handlePeerDisconnect() {
    appendSystemMessage('Stranger disconnected.');
    cleanupWebRTC();
    
    // Auto re-search after a brief interval
    setTimeout(() => {
        const isSearching = useWebSocket ? !isMatched : !searchPublishInterval;
        if (isSearching && viewChat.classList.contains('active')) {
            appendSystemMessage('Matching you with a new stranger...');
            startSearch();
        }
    }, 2000);
}

// Clean up WebRTC peer connection and remote stream
function cleanupWebRTC() {
    if (!useWebSocket && isMatched && partnerId) {
        sendDirectMessage(partnerId, { type: 'disconnect', from: myId });
    }

    isMatched = false;
    partnerId = null;
    isInitiator = false;

    if (peerConnection) {
        peerConnection.close();
        peerConnection = null;
    }

    remoteVideo.srcObject = null;
    remotePlaceholder.style.display = 'flex';
}

// Stop and clean up local camera and audio stream
function cleanupLocalStream() {
    if (localStream) {
        localStream.getTracks().forEach(track => track.stop());
        localStream = null;
    }
    localVideo.srcObject = null;
}

function handleDisconnect() {
    if (useWebSocket) {
        sendSignalingMessage({ type: 'next' });
    }
    stopSearching();
    cleanupWebRTC();
    cleanupLocalStream();
    switchView('view-lobby');
}

// Chat UI updates
function appendChatMessage(sender, text) {
    const bubble = document.createElement('div');
    bubble.className = `chat-bubble ${sender.toLowerCase() === 'you' ? 'you' : 'stranger'}`;
    bubble.textContent = text;
    chatMessagesLog.appendChild(bubble);
    chatMessagesLog.scrollTop = chatMessagesLog.scrollHeight;
}

function appendSystemMessage(text) {
    const msg = document.createElement('div');
    msg.className = 'system-message';
    msg.textContent = `System: ${text}`;
    chatMessagesLog.appendChild(msg);
    chatMessagesLog.scrollTop = chatMessagesLog.scrollHeight;
}

// UI Event bindings
btnStart.addEventListener('click', async () => {
    await startSearch();
});

btnCancel.addEventListener('click', () => {
    handleDisconnect();
});

btnNext.addEventListener('click', () => {
    if (useWebSocket) {
        sendSignalingMessage({ type: 'next' });
    }
    cleanupWebRTC();
    appendSystemMessage('Finding a new stranger...');
    startSearch();
});

btnStop.addEventListener('click', () => {
    handleDisconnect();
});

chatForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const text = chatInput.value.trim();
    if (!text) return;

    if (isMatched) {
        if (useWebSocket) {
            sendSignalingMessage({
                type: 'chat_message',
                message: text
            });
        } else {
            sendSignalingMessage({
                type: 'chat_message',
                message: text,
                from: myId
            });
        }
        appendChatMessage('You', text);
        chatInput.value = '';
    } else {
        appendSystemMessage('You are not connected to a stranger yet.');
    }
});

// Initialize connection on load
window.addEventListener('load', () => {
    initConnection();
});

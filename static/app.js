const myId = 'user_' + Math.random().toString(36).substring(2, 9);
let selectedMode = 'video'; // 'video' is active by default to match screenshot
let mqttClient = null;
let peerConnection = null;
let localStream = null;
let partnerId = null;
let isMatched = false;
let isInitiator = false;

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

const btnModeText = document.getElementById('btn-mode-text');
const btnModeVoice = document.getElementById('btn-mode-voice');
const btnModeVideo = document.getElementById('btn-mode-video');
const btnStart = document.getElementById('btn-start');
const btnCancel = document.getElementById('btn-cancel');

const btnNext = document.getElementById('btn-next');
const btnStop = document.getElementById('btn-stop');
const chatForm = document.getElementById('chat-form');
const chatInput = document.getElementById('chat-input');
const chatMessagesLog = document.getElementById('chat-messages-log');
const chatPartnerTitle = document.getElementById('chat-partner-title');

const localVideo = document.getElementById('local-video');
const remoteVideo = document.getElementById('remote-video');
const remotePlaceholder = document.getElementById('remote-placeholder');
const chatLayout = document.querySelector('.chat-layout');
const serverStatus = document.getElementById('server-status');
const searchModeText = document.getElementById('search-mode-text');
const searchTimer = document.getElementById('search-timer');

// Mode Selection Event Listeners
const modeCards = [btnModeText, btnModeVoice, btnModeVideo];
modeCards.forEach(card => {
    card.addEventListener('click', () => {
        modeCards.forEach(c => c.classList.remove('active'));
        card.classList.add('active');
        selectedMode = card.dataset.mode;
    });
});

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

// Initialize MQTT Client (Serverless matchmaker and signaling broker)
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
            console.log('Incoming signaling message:', msg.type);

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
                            console.error('Error adding received ice candidate:', e);
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

// Start matchmaking broadcast
function startSearch() {
    initMQTT();

    // Reset state
    cleanupWebRTC();
    switchView('view-searching');
    searchModeText.textContent = `Searching for a partner in ${selectedMode.toUpperCase()} Mode`;
    startSearchTimer();

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

// Stop broadcasting search presence
function stopSearching() {
    clearInterval(searchPublishInterval);
    searchPublishInterval = null;
    stopSearchTimer();
    
    // Unsubscribe from lobby
    if (mqttClient) {
        mqttClient.unsubscribe(`bharatbyte/lobby/${selectedMode}`);
    }
}

// Configure chat screen and WebRTC when matched
async function startChatSession() {
    // Clear old messages
    chatMessagesLog.innerHTML = '<div class="system-message">System: Connected to a stranger! Say hello.</div>';
    chatPartnerTitle.textContent = `Connected with a Stranger (${selectedMode.toUpperCase()})`;
    
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
            if (event.candidate && partnerId) {
                sendDirectMessage(partnerId, {
                    type: 'candidate',
                    candidate: event.candidate,
                    from: myId
                });
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

        // Capture local camera & mic
        if (selectedMode === 'voice' || selectedMode === 'video') {
            const constraints = {
                audio: true,
                video: selectedMode === 'video'
            };

            localStream = await navigator.mediaDevices.getUserMedia(constraints);
            
            localStream.getTracks().forEach(track => {
                peerConnection.addTrack(track, localStream);
            });

            localVideo.srcObject = localStream;
            localVideo.style.display = 'block';
        } else {
            localVideo.style.display = 'none';
        }

        // Caller creates offer
        if (isInitiator) {
            const offer = await peerConnection.createOffer();
            await peerConnection.setLocalDescription(offer);
            sendDirectMessage(partnerId, {
                type: 'offer',
                offer: offer,
                from: myId
            });
        }

    } catch (err) {
        console.error('Failed to set up media/WebRTC:', err);
        appendSystemMessage(`System Error: Could not access media devices. (${err.message})`);
    }
}

// Handle peer disconnection notice
function handlePeerDisconnect() {
    appendSystemMessage('Stranger disconnected.');
    cleanupWebRTC();
    
    // Auto re-search after a brief interval
    setTimeout(() => {
        if (!isMatched && !searchPublishInterval && viewChat.classList.contains('active')) {
            appendSystemMessage('Matching you with a new stranger...');
            startSearch();
        }
    }, 2000);
}

// Terminate match connection
function cleanupWebRTC() {
    if (isMatched && partnerId) {
        sendDirectMessage(partnerId, { type: 'disconnect', from: myId });
    }

    isMatched = false;
    partnerId = null;
    isInitiator = false;

    if (peerConnection) {
        peerConnection.close();
        peerConnection = null;
    }

    if (localStream) {
        localStream.getTracks().forEach(track => track.stop());
        localStream = null;
    }

    localVideo.srcObject = null;
    remoteVideo.srcObject = null;
    remotePlaceholder.style.display = 'flex';
}

function handleDisconnect() {
    stopSearching();
    cleanupWebRTC();
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
btnStart.addEventListener('click', () => {
    startSearch();
});

btnCancel.addEventListener('click', () => {
    handleDisconnect();
});

btnNext.addEventListener('click', () => {
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

    if (isMatched && partnerId) {
        sendDirectMessage(partnerId, {
            type: 'chat_message',
            message: text,
            from: myId
        });
        appendChatMessage('You', text);
        chatInput.value = '';
    } else {
        appendSystemMessage('You are not connected to a stranger yet.');
    }
});

// Initialize MQTT connection on load
window.addEventListener('load', () => {
    initMQTT();
});

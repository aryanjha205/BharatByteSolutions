import json
import logging
import os
import ipaddress
from typing import Dict, List, Tuple
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from fastapi.middleware.cors import CORSMiddleware

# Set up logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("StrangerApp")

app = FastAPI(title="BharatByte Video Chat App")

# Allow CORS for local development and testing
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Queue for video-only matchmaking.
queues: Dict[str, List[WebSocket]] = {
    "video": []
}

# Active matches: maps WebSocket -> (Partner WebSocket, Mode)
matches: Dict[WebSocket, Tuple[WebSocket, str]] = {}

def clean_websocket(websocket: WebSocket):
    """Remove a websocket from matchmaking queues and notify partners on disconnect."""
    # Remove from all queues
    for mode in queues:
        if websocket in queues[mode]:
            queues[mode].remove(websocket)
            logger.info(f"Removed socket from {mode} queue.")

    # Handle active match cleanup
    if websocket in matches:
        partner, mode = matches[websocket]
        logger.info(f"Active match broken. Notifying partner.")
        
        # Clean partner's match
        if partner in matches:
            del matches[partner]
        
        # Clean own match
        del matches[websocket]
        
        # Send peer disconnected message to partner
        try:
            import asyncio
            asyncio.create_task(partner.send_json({"type": "peer_disconnected"}))
        except Exception as e:
            logger.error(f"Failed to notify partner of disconnect: {e}")

@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    await websocket.accept()
    logger.info("New WebSocket connection established.")
    
    try:
        while True:
            # Wait for messages from the client
            data = await websocket.receive_text()
            message = json.loads(data)
            msg_type = message.get("type")
            
            if msg_type == "search":
                # Start matchmaking
                mode = message.get("mode", "video")
                if mode not in queues:
                    mode = "video"
                
                # Cleanup any previous state before entering queue
                clean_websocket(websocket)
                
                # Check if there is someone waiting in the selected queue
                if queues[mode]:
                    partner = queues[mode].pop(0)
                    # Establish match
                    matches[websocket] = (partner, mode)
                    matches[partner] = (websocket, mode)
                    
                    logger.info(f"Match found! Mode: {mode}")
                    
                    # Notify both parties
                    await websocket.send_json({"type": "matched", "mode": mode, "initiator": True})
                    await partner.send_json({"type": "matched", "mode": mode, "initiator": False})
                else:
                    # Nobody waiting, add to queue
                    queues[mode].append(websocket)
                    logger.info(f"Added user to {mode} queue. Queue size: {len(queues[mode])}")
                    await websocket.send_json({"type": "searching", "mode": mode})
            
            elif msg_type == "next":
                # User wants to find a new stranger
                clean_websocket(websocket)
                await websocket.send_json({"type": "disconnected"})
                
            elif msg_type in ["offer", "answer", "candidate", "chat_message"]:
                # Signaling or chat message. Route it to the matched partner
                if websocket in matches:
                    partner, mode = matches[websocket]
                    try:
                        await partner.send_text(data)
                    except Exception as e:
                        logger.error(f"Error routing {msg_type} to partner: {e}")
                        clean_websocket(websocket)
                        await websocket.send_json({"type": "peer_disconnected"})
                else:
                    await websocket.send_json({"type": "error", "message": "You are not matched with anyone."})
            
            elif msg_type == "ping":
                # Keep connection alive
                await websocket.send_json({"type": "pong"})
                
    except WebSocketDisconnect:
        logger.info("WebSocket disconnected.")
    except Exception as e:
        logger.error(f"Connection error: {e}")
    finally:
        clean_websocket(websocket)
        try:
            await websocket.close()
        except Exception:
            pass

# Serve static files
app.mount("/static", StaticFiles(directory="static"), name="static")

@app.get("/sw.js")
async def get_sw():
    return FileResponse("static/sw.js", media_type="application/javascript")

@app.get("/manifest.json")
async def get_manifest():
    return FileResponse("static/manifest.json", media_type="application/json")

@app.get("/")
async def get_index():
    return FileResponse("index.html")

def generate_self_signed_cert(cert_path="cert.pem", key_path="key.pem"):
    try:
        from cryptography import x509
        from cryptography.x509.oid import NameOID
        from cryptography.hazmat.primitives import hashes
        from cryptography.hazmat.primitives.asymmetric import rsa
        from cryptography.hazmat.primitives import serialization
        import datetime

        logger.info("Generating self-signed SSL certificate...")
        
        # Generate private key
        private_key = rsa.generate_private_key(
            public_exponent=65537,
            key_size=2048,
        )
        
        # Create certificate
        subject = issuer = x509.Name([
            x509.NameAttribute(NameOID.COUNTRY_NAME, "IN"),
            x509.NameAttribute(NameOID.STATE_OR_PROVINCE_NAME, "Delhi"),
            x509.NameAttribute(NameOID.LOCALITY_NAME, "New Delhi"),
            x509.NameAttribute(NameOID.ORGANIZATION_NAME, "BharatByte"),
            x509.NameAttribute(NameOID.COMMON_NAME, "localhost"),
        ])
        
        cert = x509.CertificateBuilder().subject_name(
            subject
        ).issuer_name(
            issuer
        ).public_key(
            private_key.public_key()
        ).serial_number(
            x509.random_serial_number()
        ).not_valid_before(
            datetime.datetime.now(datetime.timezone.utc)
        ).not_valid_after(
            datetime.datetime.now(datetime.timezone.utc) + datetime.timedelta(days=365)
        ).add_extension(
            x509.SubjectAlternativeName([
                x509.DNSName("localhost"),
                x509.DNSName("127.0.0.1"),
                x509.IPAddress(ipaddress.IPv4Address("127.0.0.1")),
            ]),
            critical=False,
        ).sign(private_key, hashes.SHA256())
        
        # Write private key
        with open(key_path, "wb") as f:
            f.write(private_key.private_bytes(
                encoding=serialization.Encoding.PEM,
                format=serialization.PrivateFormat.TraditionalOpenSSL,
                encryption_algorithm=serialization.NoEncryption(),
            ))
            
        # Write certificate
        with open(cert_path, "wb") as f:
            f.write(cert.public_bytes(serialization.Encoding.PEM))
            
        logger.info(f"Self-signed SSL certificate successfully generated: {cert_path}, {key_path}")
        return True
    except Exception as e:
        logger.error(f"Failed to generate self-signed certificate: {e}")
        return False

if __name__ == "__main__":
    import uvicorn
    
    ssl_cert = "cert.pem"
    ssl_key = "key.pem"
    use_ssl = True

    if not os.path.exists(ssl_cert) or not os.path.exists(ssl_key):
        success = generate_self_signed_cert(ssl_cert, ssl_key)
        if not success:
            use_ssl = False
            
    # Print custom startup guidance for secure context
    print("*" * 80)
    print(" BHARATBYTE VIDEO CHAT APP - SERVER STARTING")
    print("*" * 80)
    if use_ssl:
        print(" Running in HTTPS mode (secure context enabled).")
        print(" Important: Your browser may show a 'Connection not private' security warning.")
        print(" Click 'Advanced' and then 'Proceed' to bypass it for local testing.")
        print(" URLs:")
        print(" -> https://localhost:8000")
        print(" -> https://127.0.0.1:8000")
    else:
        print(" Running in HTTP mode (no SSL).")
        print(" Important: To test camera/mic features, you MUST access the site via localhost:")
        print(" -> http://localhost:8000")
        print(" -> http://127.0.0.1:8000")
        print(" If you access using any other hostname or local network IP, browser camera access will fail.")
    print("*" * 80)

    if use_ssl:
        uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True, ssl_keyfile=ssl_key, ssl_certfile=ssl_cert)
    else:
        uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)

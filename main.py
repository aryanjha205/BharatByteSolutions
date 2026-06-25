import json
import logging
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

@app.get("/")
async def get_index():
    return FileResponse("index.html")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)

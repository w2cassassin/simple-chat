from fastapi import (
    APIRouter,
    WebSocket,
    WebSocketDisconnect,
    Depends,
    HTTPException,
    Header,
)
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy import or_, and_
from typing import Dict, List
from datetime import datetime
import json

from app.database import get_db
from app import models, schemas

router = APIRouter()


class ConnectionManager:
    def __init__(self):
        self.active_connections: Dict[str, WebSocket] = {}

    async def connect(self, websocket: WebSocket, username: str):
        await websocket.accept()
        if username in self.active_connections:
            await self.active_connections[username].close()
        self.active_connections[username] = websocket

    def disconnect(self, username: str):
        if username in self.active_connections:
            del self.active_connections[username]

    async def broadcast_online_users(self):
        users = list(self.active_connections.keys())
        for connection in self.active_connections.values():
            await connection.send_json({"type": "users_list", "users": users})

    async def send_message(self, message: dict, username: str):
        if username in self.active_connections:
            await self.active_connections[username].send_json(
                {"type": "new_message", **message}
            )


manager = ConnectionManager()


@router.get("/users/online", response_model=schemas.OnlineUsers)
async def get_online_users():
    return {"users": list(manager.active_connections.keys())}


@router.get("/messages/{username}", response_model=schemas.ChatHistory)
async def get_chat_history(
    username: str, with_user: str | None = None, db: AsyncSession = Depends(get_db)
):
    query = select(models.Message)

    if with_user:
        query = query.filter(
            or_(
                and_(
                    models.Message.sender_name == username,
                    models.Message.receiver_name == with_user,
                ),
                and_(
                    models.Message.sender_name == with_user,
                    models.Message.receiver_name == username,
                ),
            )
        )
    else:
        query = query.filter(
            or_(
                models.Message.sender_name == username,
                models.Message.receiver_name == username,
            )
        )

    query = query.order_by(models.Message.timestamp.desc())
    result = await db.execute(query)
    messages = result.scalars().all()

    messages_dict = [
        {
            "id": msg.id,
            "content": msg.content,
            "sender_name": msg.sender_name,
            "receiver_name": msg.receiver_name,
            "timestamp": msg.timestamp,
        }
        for msg in messages
    ]

    return {"messages": messages_dict}


@router.get("/chats/{username}", response_model=List[dict])
async def get_user_chats(username: str, db: AsyncSession = Depends(get_db)):
    query = (
        select(models.Message)
        .filter(
            or_(
                models.Message.sender_name == username,
                models.Message.receiver_name == username,
            )
        )
        .order_by(models.Message.timestamp.desc())
    )

    result = await db.execute(query)
    messages = result.scalars().all()

    chats = {}
    for msg in messages:
        other_user = (
            msg.receiver_name if msg.sender_name == username else msg.sender_name
        )
        if other_user not in chats:
            chats[other_user] = {
                "user": other_user,
                "last_message": msg.content,
                "timestamp": msg.timestamp.isoformat(),
                "unread": False,
            }

    return list(chats.values())


@router.post("/messages/", response_model=schemas.MessageResponse)
async def send_message(
    message: schemas.MessageCreate,
    db: AsyncSession = Depends(get_db),
    username: str = Header(...),
):
    db_message = models.Message(
        content=message.content,
        sender_name=username,
        receiver_name=message.receiver_name,
        timestamp=datetime.utcnow(),
    )
    db.add(db_message)
    await db.commit()
    await db.refresh(db_message)

    message_data = {
        "id": db_message.id,
        "content": db_message.content,
        "sender_name": db_message.sender_name,
        "receiver_name": db_message.receiver_name,
        "timestamp": db_message.timestamp,
    }

    await manager.send_message(
        {**message_data, "timestamp": message_data["timestamp"].isoformat()},
        message.receiver_name,
    )

    return message_data


@router.websocket("/chat/api/ws/{username}")
async def websocket_endpoint(websocket: WebSocket, username: str):
    await manager.connect(websocket, username)
    try:
        await manager.broadcast_online_users()

        while True:
            data = await websocket.receive_text()
            if data == "ping":
                await websocket.send_text("pong")

    except WebSocketDisconnect:
        manager.disconnect(username)
        await manager.broadcast_online_users()

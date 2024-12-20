from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy import or_, and_
from typing import Dict
import json
from datetime import datetime

from app.database import get_db
from app import models

router = APIRouter()


class ConnectionManager:
    def __init__(self):
        self.active_connections: Dict[str, WebSocket] = {}

    async def connect(self, websocket: WebSocket, username: str):
        await websocket.accept()
        self.active_connections[username] = websocket

    def disconnect(self, username: str):
        if username in self.active_connections:
            del self.active_connections[username]

    async def send_personal_message(self, message: str, username: str):
        if username in self.active_connections:
            await self.active_connections[username].send_text(message)

    def get_active_users(self):
        return list(self.active_connections.keys())


manager = ConnectionManager()


@router.websocket("/ws/{username}")
async def websocket_endpoint(
    websocket: WebSocket, username: str, db: AsyncSession = Depends(get_db)
):
    await manager.connect(websocket, username)
    try:
        for connection in manager.active_connections.values():
            await connection.send_json(
                {"type": "users_list", "users": manager.get_active_users()}
            )

        while True:
            data = await websocket.receive_text()
            message_data = json.loads(data)

            # Создаем запись в БД
            db_message = models.Message(
                content=message_data["content"],
                sender_name=username,
                receiver_name=message_data["receiver"],
                timestamp=datetime.utcnow(),
            )
            db.add(db_message)
            await db.commit()
            await db.refresh(db_message)
            message_out = {
                "type": "message",
                "id": db_message.id,
                "content": message_data["content"],
                "sender_name": username,
                "receiver_name": message_data["receiver"],
                "timestamp": db_message.timestamp.isoformat(),
            }

            if message_data["receiver"] in manager.active_connections:
                await manager.send_personal_message(
                    json.dumps(message_out), message_data["receiver"]
                )
            await websocket.send_json(message_out)

    except WebSocketDisconnect:
        manager.disconnect(username)
        # Оповещаем всех об отключении пользователя
        for connection in manager.active_connections.values():
            await connection.send_json(
                {"type": "users_list", "users": manager.get_active_users()}
            )


@router.get("/messages/{username}")
async def get_user_messages(username: str, db: AsyncSession = Depends(get_db)):
    query = (
        select(models.Message)
        .filter(
            or_(
                models.Message.sender_name == username,
                models.Message.receiver_name == username,
            )
        )
        .order_by(models.Message.timestamp.asc())
    )

    result = await db.execute(query)
    messages = result.scalars().all()
    return messages


@router.get("/users/active")
async def get_active_users():
    return {"users": manager.get_active_users()}


@router.get("/messages/{user1}/{user2}")
async def get_conversation(user1: str, user2: str, db: AsyncSession = Depends(get_db)):
    query = (
        select(models.Message)
        .filter(
            or_(
                and_(
                    models.Message.sender_name == user1,
                    models.Message.receiver_name == user2,
                ),
                and_(
                    models.Message.sender_name == user2,
                    models.Message.receiver_name == user1,
                ),
            )
        )
        .order_by(models.Message.timestamp.asc())
    )

    result = await db.execute(query)
    messages = result.scalars().all()
    return messages

from pydantic import BaseModel
from datetime import datetime
from typing import List

class MessageCreate(BaseModel):
    content: str
    receiver_name: str

class MessageResponse(BaseModel):
    id: int
    content: str
    sender_name: str
    receiver_name: str
    timestamp: datetime

    class Config:
        from_attributes = True

class ChatHistory(BaseModel):
    messages: List[MessageResponse]

class OnlineUsers(BaseModel):
    users: List[str]

class ChatInfo(BaseModel):
    user: str
    last_message: str
    timestamp: str
    unread: bool

from sqlalchemy import Column, Integer, String, DateTime, Index
from app.database import Base
import datetime


class Message(Base):
    __tablename__ = "messages"

    id = Column(Integer, primary_key=True, index=True)
    content = Column(String, nullable=False)
    timestamp = Column(DateTime, default=datetime.datetime.utcnow)
    sender_name = Column(String, nullable=False)
    receiver_name = Column(String, nullable=False)

    def dict(self):
        return {
            "id": self.id,
            "content": self.content,
            "sender_name": self.sender_name,
            "receiver_name": self.receiver_name,
            "timestamp": self.timestamp,
        }

    __table_args__ = (
        Index("idx_message_participants", "sender_name", "receiver_name"),
    )

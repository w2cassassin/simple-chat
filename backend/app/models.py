from sqlalchemy import Column, Integer, String, DateTime
from app.database import Base
import datetime

class Message(Base):
    __tablename__ = "messages"

    id = Column(Integer, primary_key=True, index=True)
    content = Column(String)
    timestamp = Column(DateTime, default=datetime.datetime.utcnow)
    sender_name = Column(String)
    receiver_name = Column(String)

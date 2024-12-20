import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import config from '../config';

function Chat({ username }) {
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [activeUsers, setActiveUsers] = useState([]);
  const [selectedUser, setSelectedUser] = useState(null);
  const [newChatUsername, setNewChatUsername] = useState('');
  const [showOnlineUsers, setShowOnlineUsers] = useState(false);
  const [chatHistory, setChatHistory] = useState([]);
  const wsRef = useRef(null);
  const messagesEndRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    wsRef.current = new WebSocket(`${config.WS_BASE_URL}/ws/${username}`);

    wsRef.current.onmessage = (event) => {
      const data = JSON.parse(event.data);
      if (data.type === 'users_list') {
        setActiveUsers(data.users.filter(user => user !== username));
      } else if (data.type === 'message') {
        setMessages(prevMessages => [...prevMessages, data]);
      }
    };

    return () => {
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, [username]);

  const loadChatMessages = async (otherUser) => {
    if (!otherUser) return;
    try {
      const response = await axios.get(`${config.API_BASE_URL}/messages/${username}/${otherUser}`);
      setMessages(response.data);
    } catch (error) {
      console.error('Error loading chat messages:', error);
    }
  };

  const loadChatHistory = async () => {
    try {
      const response = await axios.get(`${config.API_BASE_URL}/messages/${username}`);
      const messages = response.data;
      
      const uniqueUsers = new Set();
      messages.forEach(msg => {
        if (msg.sender_name === username) {
          uniqueUsers.add(msg.receiver_name);
        } else {
          uniqueUsers.add(msg.sender_name);
        }
      });
      
      const history = Array.from(uniqueUsers).map(user => {
        const lastMessage = messages
          .filter(msg => 
            (msg.sender_name === user && msg.receiver_name === username) ||
            (msg.sender_name === username && msg.receiver_name === user)
          )
          .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))[0];
        
        return {
          user,
          lastMessage: lastMessage?.content || '',
          timestamp: lastMessage?.timestamp || '',
        };
      }).sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

      setChatHistory(history);
    } catch (error) {
      console.error('Error loading chat history:', error);
    }
  };

  useEffect(() => {
    if (selectedUser) {
      loadChatMessages(selectedUser);
    }
    scrollToBottom();
  }, [selectedUser]);

  useEffect(() => {
    loadChatHistory();
  }, [messages]);

  const sendMessage = (e) => {
    e.preventDefault();
    if (!selectedUser || !newMessage.trim() || !wsRef.current) return;

    const messageData = {
      content: newMessage.trim(),
      receiver: selectedUser
    };

    if (wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(messageData));
      setNewMessage('');
    } else {
      console.error('WebSocket is not connected');
    }
  };

  const startNewChat = (e) => {
    e.preventDefault();
    if (newChatUsername.trim() && newChatUsername !== username) {
      setSelectedUser(newChatUsername);
      setNewChatUsername('');
      setMessages([]);
      loadChatMessages(newChatUsername);
    }
  };

  return (
    <div className="chat-container">
      <div className="sidebar">
        <div className="current-user">
          <h3>Ваш ник: {username}</h3>
        </div>
        
        <div className="new-chat-form">
          <form onSubmit={startNewChat}>
            <input
              type="text"
              value={newChatUsername}
              onChange={(e) => setNewChatUsername(e.target.value)}
              placeholder="Введите ник пользователя..."
            />
            <button type="submit">Начать чат</button>
          </form>
        </div>

        <button 
          className="show-online-users-btn"
          onClick={() => setShowOnlineUsers(!showOnlineUsers)}
        >
          Показать пользователей онлайн ({activeUsers.length})
        </button>

        {showOnlineUsers && (
          <div className="online-users-modal">
            <div className="modal-content">
              <h3>Пользователи онлайн</h3>
              {activeUsers.map(user => (
                <div
                  key={user}
                  className="online-user-item"
                  onClick={() => {
                    setSelectedUser(user);
                    setShowOnlineUsers(false);
                  }}
                >
                  {user} <span className="online-badge">●</span>
                </div>
              ))}
              <button onClick={() => setShowOnlineUsers(false)}>Закрыть</button>
            </div>
          </div>
        )}

        <div className="recent-chats">
          <h3>История чатов</h3>
          {chatHistory.map(({ user, lastMessage, timestamp }) => (
            <div
              key={user}
              className={`chat-item ${selectedUser === user ? 'active' : ''}`}
              onClick={() => setSelectedUser(user)}
            >
              <div className="chat-item-info">
                <div className="chat-item-name">
                  {user} {activeUsers.includes(user) && <span className="online-badge">●</span>}
                </div>
                <div className="chat-item-last-message">{lastMessage}</div>
              </div>
              <div className="chat-item-time">
                {new Date(timestamp).toLocaleTimeString()}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="chat-area">
        {selectedUser ? (
          <>
            <div className="chat-header">
              <h3>Чат с {selectedUser} {activeUsers.includes(selectedUser) && <span className="online-badge">●</span>}</h3>
            </div>
            <div className="messages">
              {messages.map((msg, index) => (
                <div
                  key={index}
                  className={`message ${msg.sender_name === username ? 'sent' : 'received'}`}
                >
                  <div className="message-content">{msg.content}</div>
                  <div className="message-info">
                    {new Date(msg.timestamp).toLocaleTimeString()}
                  </div>
                </div>
              ))}
              <div ref={messagesEndRef} />
            </div>
            <form onSubmit={sendMessage} className="message-form">
              <input
                type="text"
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
                placeholder="Введите сообщение..."
              />
              <button type="submit">Отправить</button>
            </form>
          </>
        ) : (
          <div className="no-chat-selected">
            Введите ник пользователя для начала общения
          </div>
        )}
      </div>
    </div>
  );
}

export default Chat;

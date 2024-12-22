import React, { useState, useEffect, useRef, useCallback } from 'react';
import axios from 'axios';
import config from '../config';
import { useNavigate } from 'react-router-dom';

function Chat({ username, onLogout }) {
  const navigate = useNavigate();
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [onlineUsers, setOnlineUsers] = useState([]);
  const [selectedUser, setSelectedUser] = useState(null);
  const [chats, setChats] = useState([]);
  const wsRef = useRef(null);
  const messagesEndRef = useRef(null);
  const [manualRecipient, setManualRecipient] = useState('');

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  useEffect(() => {
    const loadChats = async () => {
      try {
        const response = await axios.get(`${config.API_BASE_URL}/chats/${username}`);
        setChats(response.data);
      } catch (error) {
        console.error('Error loading chats:', error);
      }
    };
    loadChats();
  }, [username]);

  const updateChats = useCallback((newMessage, otherUser) => {
    setChats(prev => {
      const newChats = prev.filter(chat => chat.user !== otherUser);
      return [{
        user: otherUser,
        last_message: newMessage.content,
        timestamp: newMessage.timestamp,
        unread: false
      }, ...newChats];
    });
  }, []);

  const handleWebSocketMessage = useCallback((data) => {
    if (data.type === 'users_list') {
      setOnlineUsers(data.users.filter(user => user !== username));
    } else if (data.type === 'new_message') {
      if (data.sender_name === selectedUser || data.receiver_name === selectedUser) {
        setMessages(prev => [...prev, data]);
        scrollToBottom();
      }
      const otherUser = data.sender_name === username ? data.receiver_name : data.sender_name;
      updateChats(data, otherUser);
    }
  }, [username, selectedUser, scrollToBottom, updateChats]);

  useEffect(() => {
    const ws = new WebSocket(`${config.WS_BASE_URL}/ws/${username}`);
    wsRef.current = ws;

    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      handleWebSocketMessage(data);
    };

    const pingInterval = setInterval(() => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: 'ping' }));
      }
    }, 30000);

    return () => {
      clearInterval(pingInterval);
      ws.close();
    };
  }, [username, handleWebSocketMessage]);

  useEffect(() => {
    if (selectedUser) {
      axios.get(`${config.API_BASE_URL}/messages/${username}?with_user=${selectedUser}`)
        .then(response => {
          setMessages(response.data.messages);
          scrollToBottom();
        });
    }
  }, [selectedUser, username, scrollToBottom]);

  useEffect(() => {
    axios.get(`${config.API_BASE_URL}/users/online`)
      .then(response => {
        setOnlineUsers(response.data.users.filter(user => user !== username));
      });
  }, [username]);

  const sendMessage = async (e) => {
    e.preventDefault();
    const targetUser = selectedUser || manualRecipient.trim();
    if (!targetUser || !newMessage.trim()) return;

    try {
      const response = await axios.post(
        `${config.API_BASE_URL}/messages/`, 
        {
          content: newMessage.trim(),
          receiver_name: targetUser
        },
        {
          headers: {
            'Username': username,
            'Content-Type': 'application/json'
          }
        }
      );
      
      setNewMessage('');
      setMessages(prev => [...prev, response.data]);
      updateChats(response.data, targetUser);
      scrollToBottom();
    } catch (error) {
      console.error('Error sending message:', error);
    }
  };

  const startNewChat = (e) => {
    e.preventDefault();
    if (manualRecipient.trim()) {
      setSelectedUser(manualRecipient.trim());
      setManualRecipient('');
    }
  };

  const handleLogout = () => {
    wsRef.current?.close();
    onLogout();
    navigate('/login');
  };

  return (
    <div className="chat-container">
      <div className="sidebar">
        <div className="current-user">
          <h3>Ваш ник: {username}</h3>
          <button onClick={handleLogout} style={{ marginTop: '8px' }}>Выйти</button>
        </div>
        
        <div className="chats-list">
          <h3>Чаты</h3>
          {chats.map(chat => (
            <div
              key={chat.user}
              className={`chat-item ${selectedUser === chat.user ? 'active' : ''}`}
              onClick={() => setSelectedUser(chat.user)}
            >
              <div className="chat-item-info">
                <div className="chat-item-name">
                  {chat.user} 
                  {onlineUsers.includes(chat.user) && <span className="online-badge">●</span>}
                </div>
                <div className="chat-item-last-message">{chat.last_message}</div>
              </div>
              <div className="chat-item-time">
                {new Date(chat.timestamp).toLocaleTimeString()}
              </div>
            </div>
          ))}
        </div>

        <div className="online-users">
          <h3>Онлайн ({onlineUsers.length})</h3>
          {onlineUsers.map(user => (
            <div
              key={user}
              className="online-user-item"
              onClick={() => { setSelectedUser(user); setManualRecipient(''); }}
            >
              {user} <span className="online-badge">●</span>
            </div>
          ))}
        </div>

        <div className="new-chat-form">
          <form onSubmit={startNewChat}>
            <input
              type="text"
              placeholder="Введите ник для чата"
              value={manualRecipient}
              onChange={(e) => setManualRecipient(e.target.value)}
            />
            <button type="submit">Начать чат</button>
          </form>
        </div>
      </div>

      <div className="chat-area">
        {selectedUser ? (
          <>
            <div className="chat-header">
              <h3>Чат с {selectedUser}</h3>
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
            Выберите пользователя для начала общения
          </div>
        )}
      </div>
    </div>
  );
}

export default Chat;

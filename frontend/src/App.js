import React, { useState } from 'react';
import { BrowserRouter as Router, Route, Routes, Navigate } from 'react-router-dom';
import Login from './components/Login';
import Chat from './components/Chat';
import './App.css';

function App() {
  const [username, setUsername] = useState(localStorage.getItem('username') || '');

  const handleLogin = (name) => {
    setUsername(name);
    localStorage.setItem('username', name);
  };

  const handleLogout = () => {
    setUsername('');
    localStorage.removeItem('username');
  };

  return (
    <Router basename="/chat">
      <div className="App">
        <Routes>
          <Route
            path="/login"
            element={
              username ? <Navigate to="/" replace /> : <Login onLogin={handleLogin} />
            }
          />
          <Route
            path="/"
            element={
              !username ? (
                <Navigate to="/login" replace />
              ) : (
                <Chat username={username} onLogout={handleLogout} />
              )
            }
          />
        </Routes>
      </div>
    </Router>
  );
}

export default App;

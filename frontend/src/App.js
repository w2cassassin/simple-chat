import React, { useState } from 'react';
import { BrowserRouter as Router, Route, Switch, Redirect } from 'react-router-dom';
import Login from './components/Login';
import Chat from './components/Chat';
import './App.css';

function App() {
  const [username, setUsername] = useState(localStorage.getItem('username') || '');

  const handleLogin = (name) => {
    setUsername(name);
    localStorage.setItem('username', name);
  };

  return (
    <Router basename="/chat">
      <div className="App">
        <Switch>
          <Route exact path="/">
            {username ? <Redirect to="/chat" /> : <Login onLogin={handleLogin} />}
          </Route>
          <Route path="/chat">
            {!username ? <Redirect to="/" /> : <Chat username={username} />}
          </Route>
        </Switch>
      </div>
    </Router>
  );
}

export default App;

import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import HomePage from './HomePage';
import SentMailsPage from './SentMailsPage';

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={< HomePage/>} />
        <Route path="/sent-mails" element={<SentMailsPage />} />
      </Routes>
    </Router>
  );
}

export default App;

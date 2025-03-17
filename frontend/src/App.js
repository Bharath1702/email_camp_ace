import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import HomePage from './HomePage';
import SentMailsPage from './SentMailsPage';
import { ToastContainer } from 'react-toastify';

function App() {
  return (
    <Router>
      {/* Keep ToastContainer here so it's not unmounted when routes change */}
      <ToastContainer />
      
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/sent-mails" element={<SentMailsPage />} />
      </Routes>
    </Router>
  );
}

export default App;

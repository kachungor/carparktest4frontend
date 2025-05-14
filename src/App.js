// App.js
import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Spot1 from './Spot1';
import Spot2 from './Spot2';
import Spot3 from './Spot3';
import './App.css';

function App() {
  return (
    <Router>
      <div className="App">
        <Routes>
          <Route path="/" element={
            <div className="home-container">
              <h2>歡迎使用智能停車場充電系統</h2>
              <p>請掃描車位QR碼進入相應的車位充電頁面</p>
              <div className="qr-code-info">
                <p>測試連結:</p>
                <ul>
                  <li><a href="/spot1">1號車位</a></li>
                  <li><a href="/spot2">2號車位</a></li>
                  <li><a href="/spot3">3號車位</a></li>
                </ul>
              </div>
            </div>
          } />
          <Route path="/spot1" element={<Spot1 />} />
          <Route path="/spot2" element={<Spot2 />} />
          <Route path="/spot3" element={<Spot3 />} />
        </Routes>
      </div>
    </Router>
  );
}

export default App;
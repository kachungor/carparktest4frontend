// App.js
import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import SpotPage from './SpotPage';
import './App.css';

// 車位配置 - 簡單修改這個數組即可增加/減少車位
const PARKING_SPOTS = [7, 8, 9, 10, 11];

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
                  {/* 動態生成車位連結列表 */}
                  {PARKING_SPOTS.map(spotId => (
                    <li key={spotId}>
                      <a href={`/spot/${spotId}`}>{spotId}號車位</a>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          } />
          
          {/* 使用統一的路由模式 */}
          <Route path="/spot/:id" element={<SpotPage />} />
          
          {/* 處理舊的URL路徑，重定向到新路徑 */}
          <Route path="/spot1" element={<Navigate replace to="/spot/1" />} />
          <Route path="/spot2" element={<Navigate replace to="/spot/2" />} />
          <Route path="/spot3" element={<Navigate replace to="/spot/3" />} />
        </Routes>
      </div>
    </Router>
  );
}

export default App;

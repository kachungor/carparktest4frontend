// ParkingSpot.js
import React, { useState, useEffect } from 'react';
import axios from 'axios';
import './ParkingSpot.css';

const API_BASE = process.env.REACT_APP_API_BASE;

function ParkingSpot({ spotId }) {
  const [spot, setSpot] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedTime, setSelectedTime] = useState(15);
  const [userId] = useState(localStorage.getItem(`userId_spot${spotId}`) || Math.random().toString(36).substring(2, 15));
  const [remainingTime, setRemainingTime] = useState(null);
  const [chargingSpotId, setChargingSpotId] = useState(null);
  const [waitingCount, setWaitingCount] = useState(0);
  const [totalWaitTime, setTotalWaitTime] = useState(null);
  const [isChargingCableMoving, setIsChargingCableMoving] = useState(false);
  const [cableMovementTime, setCableMovementTime] = useState(null);
  
  useEffect(() => {
    // 儲存用戶ID到本地儲存
    localStorage.setItem(`userId_spot${spotId}`, userId);
    
    const fetchData = async () => {
      try {
        // 獲取當前車位數據
        const response = await axios.get(`${API_BASE}/api/parking-spot/${spotId}`);
        const currentSpot = response.data;
        setSpot(currentSpot);
        
        // 檢查充電器是否在移動中
        const movingResponse = await axios.get(`${API_BASE}/api/charging-move`);
        if (movingResponse.data && movingResponse.data.isMoving) {
          setIsChargingCableMoving(true);
          setCableMovementTime(movingResponse.data.remainingMoveTimeString);
        } else {
          setIsChargingCableMoving(false);
          setCableMovementTime(null);
        }
        
        // 查找是否有車位正在充電以及等待的車位數量
        const allSpotsResponse = await axios.get(`${API_BASE}/api/parking-spots`);
        const spots = allSpotsResponse.data;
        const chargingSpot = spots.find(s => s.status === '充電中' && s.startTime); // 確認已經開始計時的充電中車位
        const waitingSpots = spots.filter(s => s.status === '等待中');
        
        // 計算這個車位前面有幾個等待的車位
        const queueResponse = await axios.get(`${API_BASE}/api/charging-queue`);
        const queue = queueResponse.data;
        
        let positionInQueue = -1;
        let waitersAhead = 0;
        let cumulativeTime = 0;
        
        if (currentSpot.status === '等待中') {
          // 找出自己在隊列中的位置
          positionInQueue = queue.findIndex(q => q.spotId === parseInt(spotId));
          
          if (positionInQueue > 0) {
            waitersAhead = positionInQueue;
            
            // 計算前面車位的總充電時間
            const waitersSpotIds = queue.slice(0, positionInQueue).map(q => q.spotId);
            const waiterSpots = spots.filter(s => waitersSpotIds.includes(s.spotId));
            cumulativeTime = waiterSpots.reduce((total, s) => total + s.chargingTime, 0);
          }
        } else if (currentSpot.status === '空置中' && chargingSpot) {
          // 如果自己未在隊列中，計算目前所有等待車位的數量
          waitersAhead = waitingSpots.length;
          
          // 計算所有在等待的車位的總充電時間
          cumulativeTime = waitingSpots.reduce((total, s) => total + s.chargingTime, 0);
        }
        
        setWaitingCount(waitersAhead);
        
        if (chargingSpot) {
          setChargingSpotId(chargingSpot.spotId);
          
          // 計算剩餘時間
          const elapsed = (new Date() - new Date(chargingSpot.startTime)) / 1000; // 秒
          const remainingSecs = Math.max(0, chargingSpot.chargingTime * 60 - elapsed);
          const remainingMins = Math.floor(remainingSecs / 60);
          const remainingSec = Math.floor(remainingSecs % 60);
          const remainingTimeStr = `${remainingMins}分${remainingSec}秒`;
          
          setRemainingTime(remainingTimeStr);
          
          // 計算總等待時間 (當前充電剩餘時間 + 前面所有等待車位的充電時間)
          if (cumulativeTime > 0) {
            const totalSeconds = remainingSecs + (cumulativeTime * 60);
            const totalMins = Math.floor(totalSeconds / 60);
            const totalSecs = Math.floor(totalSeconds % 60);
            setTotalWaitTime(`${totalMins}分${totalSecs}秒`);
          }
        } else {
          setChargingSpotId(null);
          setRemainingTime(null);
          setTotalWaitTime(null);
        }
        
        // 如果後端返回了估計等待時間，則使用後端計算的結果
        if (currentSpot.estimatedWaitTime) {
          setTotalWaitTime(currentSpot.estimatedWaitTime);
        }
        
        setLoading(false);
      } catch (error) {
        setError('獲取車位數據失敗，請稍後再試');
        setLoading(false);
        console.error('獲取車位數據失敗:', error);
      }
    };
    
    fetchData();
    const interval = setInterval(fetchData, 1000); // 每秒更新一次
    
    return () => clearInterval(interval);
  }, [spotId, userId]);
  
  const requestCharging = async () => {
    try {
      await axios.post(`${API_BASE}/api/request-charging`, {
        spotId: spotId,
        chargingTime: selectedTime,
        userId: userId
      });
      alert(`已請求在${spotId}號車位充電${selectedTime}分鐘`);
    } catch (error) {
      if (error.response && error.response.status === 403) {
        alert('此車位已被預約或您已有一個充電請求');
      } else {
        alert('請求失敗，請稍後再試');
      }
      console.error('充電請求失敗:', error);
    }
  };
  
  const cancelCharging = async () => {
    try {
      await axios.post(`${API_BASE}/api/cancel-charging`, {
        spotId: spotId,
        userId: userId
      });
      alert('已取消充電請求');
    } catch (error) {
      alert('取消請求失敗');
      console.error('取消充電請求失敗:', error);
    }
  };
  
  if (loading) return <div className="loading">載入中...</div>;
  if (error) return <div className="error">{error}</div>;
  if (!spot) return <div className="error">找不到車位信息</div>;
  
  const getStatusClass = (status) => {
    switch(status) {
      case '空置中': return 'status-available';
      case '充電中': return 'status-charging';
      case '等待中': return 'status-waiting';
      case '結束': return 'status-finished';
      default: return '';
    }
  };
  
  // 確定顯示狀態
  let displayStatus = spot.status;
  let displayContent = null;
  
  // 檢查是否是自己的車位正在充電中但充電器還在移動中
  if (spot.status === '充電中' && !spot.startTime && spot.moveStartTime) {
    displayStatus = '充電器移動中';
    
    displayContent = (
      <div className="moving-info">
        <p>充電器正在移動中，請稍等...</p>
        {cableMovementTime && <p className="movement-time">預計完成時間: {cableMovementTime}</p>}
        {spot.userId === userId && (
          <button onClick={cancelCharging} className="action-btn cancel-btn">
            取消充電
          </button>
        )}
      </div>
    );
  }
  // 當前車位不是充電中，但有其他車位在充電
  else if (spot.status === '空置中' && chargingSpotId && chargingSpotId !== spotId) {
    displayStatus = '有人使用中';
    
    // 檢查是否有車位的充電器正在移動
    if (isChargingCableMoving) {
      displayStatus = '充電器移動中';
    }
    
    const queueMessage = waitingCount > 0 
      ? `目前有 ${waitingCount} 個車位正在等待充電` 
      : '目前沒有其他車位在等待';
    
    displayContent = (
      <div className="occupied-info">
        {isChargingCableMoving ? (
          <>
            <p className="warning">充電器正在移動中</p>
            {cableMovementTime && <p className="movement-time">還需: {cableMovementTime}</p>}
          </>
        ) : (
          <p className="warning">充電樁目前有人使用中</p>
        )}
        <p className="wait-time">剩餘時間: {remainingTime}</p>
        <p className="queue-info">{queueMessage}</p>
        {waitingCount > 0 && (
          <p className="total-wait-time">若現在加入等待，預計需要等待: {totalWaitTime}</p>
        )}
        <p>請稍後再試，或加入等待隊列</p>
        <div className="time-selector">
          <button 
            className={selectedTime === 5/60 ? 'active' : ''} 
            onClick={() => setSelectedTime(5/60)}
          >
            5秒
          </button>
          <button 
            className={selectedTime === 10/60 ? 'active' : ''} 
            onClick={() => setSelectedTime(10/60)}
          >
            10秒
          </button>
          <button 
            className={selectedTime === 15 ? 'active' : ''} 
            onClick={() => setSelectedTime(15)}
          >
            15分鐘
          </button>
          <button 
            className={selectedTime === 30 ? 'active' : ''} 
            onClick={() => setSelectedTime(30)}
          >
            30分鐘
          </button>
        </div>
        <button onClick={requestCharging} className="action-btn request-btn">
          加入等待隊列
        </button>
      </div>
    );
  } else if (spot.status === '空置中') {
    // 完全空置
    displayContent = (
      <div className="charging-form">
        <h3>設置充電時間:</h3>
        <div className="time-selector">
          <button 
            className={selectedTime === 5/60 ? 'active' : ''} 
            onClick={() => setSelectedTime(5/60)}
          >
            5秒
          </button>
          <button 
            className={selectedTime === 10/60 ? 'active' : ''} 
            onClick={() => setSelectedTime(10/60)}
          >
            10秒
          </button>
          <button 
            className={selectedTime === 15 ? 'active' : ''} 
            onClick={() => setSelectedTime(15)}
          >
            15分鐘
          </button>
          <button 
            className={selectedTime === 30 ? 'active' : ''} 
            onClick={() => setSelectedTime(30)}
          >
            30分鐘
          </button>
        </div>
        <button onClick={requestCharging} className="action-btn request-btn">
          開始充電
        </button>
      </div>
    );
  } else if (spot.status === '充電中' && spot.startTime) {
    // 當前車位正在充電且已經開始計時
    displayContent = (
      <div className="time-remaining">
        <h3>充電剩餘時間: {remainingTime}</h3>
        <div className="progress-bar">
          <div className="progress" 
               style={{width: `${remainingTime ? (parseInt(remainingTime.split('分')[0]) / spot.chargingTime) * 100 : 0}%`}}>
          </div>
        </div>
        {spot.userId === userId && (
          <button onClick={cancelCharging} className="action-btn cancel-btn">
            取消充電
          </button>
        )}
      </div>
    );
  } else if (spot.status === '等待中') {
    // 當前車位在等待
    // 顯示後端直接計算的等待時間，這是最準確的
    const waitTimeDisplay = spot.estimatedWaitTime || remainingTime || "計算中...";
    
    // 顯示前面有多少個車位在等待
    const queueText = waitingCount > 0 
      ? `您前面還有 ${waitingCount} 個車位在等待` 
      : '您是下一個可以充電的車位';
    
    displayContent = (
      <div className="waiting-info">
        <p>您正在等待充電</p>
        <p className="queue-position">{queueText}</p>
        <p className="wait-time">預計等待時間: {waitTimeDisplay}</p>
        {spot.userId === userId && (
          <button onClick={cancelCharging} className="action-btn cancel-btn">
            取消等待
          </button>
        )}
      </div>
    );
  } else if (spot.status === '結束') {
    // 當車位狀態為"結束"時
    displayContent = (
      <div className="finished-info">
        <p>充電已完成</p>
        <p>車位即將重置為空置狀態...</p>
      </div>
    );
  }

  return (
    <div className="parking-spot-container">
      <div className={`spot-details ${getStatusClass(spot.status)}`}>
        <h1>{spotId}號充電車位</h1>
        <div className="status-box">
          <h2>當前狀態: {displayStatus}</h2>
          
          {displayContent}
        </div>
        
        <div className="status-legend">
          <div className="legend-item">
            <span className="status-dot available"></span> 空置中
          </div>
          <div className="legend-item">
            <span className="status-dot charging"></span> 充電中
          </div>
          <div className="legend-item">
            <span className="status-dot waiting"></span> 等待中
          </div>
          <div className="legend-item">
            <span className="status-dot finished"></span> 充電結束
          </div>
          <div className="legend-item">
            <span className="status-dot moving"></span> 充電器移動中
          </div>
        </div>
      </div>
    </div>
  );
}

export default ParkingSpot;

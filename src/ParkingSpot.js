import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { Container, Row, Col, Button, Card, Badge, ProgressBar, Alert } from 'react-bootstrap';
import { format } from 'date-fns';
import LoadingSpinner from '../components/LoadingSpinner';
import ChargingForm from '../components/ChargingForm';
import './ParkingSpot.css';

const API_BASE = process.env.REACT_APP_API_BASE || 'https://carparktest4backend.onrender.com';

function ParkingSpot() {
  const { spotId } = useParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [spotData, setSpotData] = useState(null);
  const [userId, setUserId] = useState(localStorage.getItem('userId') || null);
  const [showChargingForm, setShowChargingForm] = useState(false);
  const [totalWaitTime, setTotalWaitTime] = useState(null);
  const [remainingChargingTime, setRemainingChargingTime] = useState(null);
  const [isChargingCableMoving, setIsChargingCableMoving] = useState(false);
  const [cableMovementTime, setCableMovementTime] = useState(null);
  const [timer, setTimer] = useState(0);

  // 用戶ID處理函數
  const handleSetUserId = (id) => {
    localStorage.setItem('userId', id);
    setUserId(id);
    window.location.reload(); // 刷新頁面以更新狀態
  };

  // 查詢車位狀態
  const fetchData = useCallback(async () => {
    try {
      console.log("開始獲取車位數據...");
      setLoading(true);
      
      // 獲取充電器移動狀態
      console.log(`請求URL: ${API_BASE}/api/charging-move`);
      const movingResponse = await axios.get(`${API_BASE}/api/charging-move`);
      console.log("充電器移動狀態響應:", movingResponse.data);
      
      if (movingResponse.data && movingResponse.data.isMoving) {
        setIsChargingCableMoving(true);
        setCableMovementTime(movingResponse.data.remainingMoveTimeFormatted || "計算中...");
      } else {
        setIsChargingCableMoving(false);
        setCableMovementTime(null);
      }
      
      // 查找是否有車位正在充電以及等待的車位數量
      console.log(`請求URL: ${API_BASE}/api/parking-spots`);
      const allSpotsResponse = await axios.get(`${API_BASE}/api/parking-spots`);
      console.log("所有車位數據響應:", allSpotsResponse.data);
      
      // 防禦性獲取spots數組
      const spots = allSpotsResponse.data && allSpotsResponse.data.spots 
        ? allSpotsResponse.data.spots 
        : [];
      
      console.log("處理後的spots數組:", spots);
      
      // 防禦性使用find和filter方法
      const chargingSpot = Array.isArray(spots) 
        ? spots.find(s => s.status === '充電中' && s.startTime)
        : null;
      
      const waitingSpots = Array.isArray(spots)
        ? spots.filter(s => s.status === '等待中')
        : [];
      
      // 計算這個車位前面有幾個等待的車位
      console.log(`請求URL: ${API_BASE}/api/charging-queue`);
      const queueResponse = await axios.get(`${API_BASE}/api/charging-queue`);
      console.log("充電隊列數據響應:", queueResponse.data);
      
      // 防禦性獲取queue數組
      const queue = queueResponse.data && queueResponse.data.queue
        ? queueResponse.data.queue
        : [];
      
      let positionInQueue = -1;
      let waitersAhead = 0;
      let cumulativeTime = 0;
      
      // 防禦性地計算隊列位置
      if (Array.isArray(queue)) {
        for (let i = 0; i < queue.length; i++) {
          if (parseInt(queue[i].spotId) === parseInt(spotId)) {
            positionInQueue = i;
            break;
          }
          waitersAhead++;
          // 添加每個等待者的充電時間和移動時間
          cumulativeTime += (queue[i].chargingTime || 0) * 60; // 轉換為秒
          cumulativeTime += 30; // 假設每次移動花費30秒
        }
      }
      
      // 獲取特定車位的信息
      console.log(`請求URL: ${API_BASE}/api/parking-spot/${spotId}`);
      const response = await axios.get(`${API_BASE}/api/parking-spot/${spotId}`);
      console.log("車位詳細數據響應:", response.data);
      
      // 設置車位數據
      if (response.data && response.data.success) {
        console.log("車位數據獲取成功，設置狀態...");
        setSpotData(response.data);
        
        // 如果後端返回了等待時間，則使用後端計算的結果
        const currentSpot = response.data;
        if (currentSpot.chargingInfo && currentSpot.chargingInfo.estimatedWaitTime) {
          setTotalWaitTime(currentSpot.chargingInfo.estimatedWaitTime);
        }
      } else {
        console.error("API返回成功但數據結構有問題:", response.data);
        setError("數據結構不正確或車位不存在");
      }
      
      setLoading(false);
    } catch (error) {
      console.error("獲取車位數據時出錯:", error);
      
      // 添加更詳細的錯誤日誌
      if (error.response) {
        console.error("錯誤響應數據:", error.response.data);
        console.error("錯誤狀態:", error.response.status);
      } else if (error.request) {
        console.error("請求發送但無響應");
      } else {
        console.error("請求設置錯誤:", error.message);
      }
      
      setError('獲取車位數據失敗，請稍後再試');
      setLoading(false);
    }
  }, [spotId]);

  // 請求充電
  const requestCharging = async (chargingTime) => {
    try {
      setLoading(true);
      
      if (!userId) {
        alert("請先設置您的用戶ID");
        setLoading(false);
        return;
      }
      
      const response = await axios.post(`${API_BASE}/api/request-charging`, {
        spotId: parseInt(spotId),
        chargingTime: parseInt(chargingTime),
        userId
      });
      
      if (response.data.success) {
        alert("充電請求已提交");
        setShowChargingForm(false);
        fetchData(); // 刷新狀態
      } else {
        alert(response.data.message || "請求失敗，請稍後再試");
        setLoading(false);
      }
    } catch (error) {
      console.error("提交充電請求失敗:", error);
      
      if (error.response && error.response.data && error.response.data.message) {
        alert(error.response.data.message);
      } else {
        alert("提交充電請求失敗，請稍後再試");
      }
      
      setLoading(false);
    }
  };

  // 取消充電請求
  const cancelCharging = async () => {
    if (!window.confirm("確定要取消充電嗎？")) {
      return;
    }
    
    try {
      setLoading(true);
      
      const response = await axios.post(`${API_BASE}/api/cancel-charging`, {
        spotId: parseInt(spotId),
        userId
      });
      
      if (response.data.success) {
        alert("已取消充電請求");
        fetchData(); // 刷新狀態
      } else {
        alert(response.data.message || "取消請求失敗，請稍後再試");
        setLoading(false);
      }
    } catch (error) {
      console.error("取消充電請求失敗:", error);
      alert("取消充電請求失敗，請稍後再試");
      setLoading(false);
    }
  };

  // 進入/返回大廳
  const goToLobby = () => {
    navigate('/');
  };

  // 計算充電進度百分比
  const calculateChargingProgress = (startTime, chargingTime) => {
    if (!startTime || !chargingTime) return 0;
    
    const start = new Date(startTime);
    const totalSeconds = chargingTime * 60;
    const elapsedSeconds = (new Date() - start) / 1000;
    
    return Math.min(Math.round((elapsedSeconds / totalSeconds) * 100), 100);
  };

  // 組件加載時獲取數據
  useEffect(() => {
    console.log("組件初始化，開始獲取數據...");
    console.log("API_BASE URL:", API_BASE);
    fetchData();
    
    // 每秒更新一次
    const interval = setInterval(fetchData, 1000);
    
    // 清理函數
    return () => clearInterval(interval);
  }, [spotId, fetchData]);

  // 渲染頁面
  return (
    <Container className="parking-spot-container">
      <h2 className="text-center my-4">車位 {spotId} 詳情</h2>
      
      {loading && <LoadingSpinner />}
      
      {error && !loading && (
        <Alert variant="danger">
          {error}
          <div className="mt-3">
            <Button variant="primary" onClick={fetchData}>重試</Button>{' '}
            <Button variant="secondary" onClick={goToLobby}>返回大廳</Button>
          </div>
        </Alert>
      )}
      
      {!loading && !error && spotData && (
        <Row>
          <Col md={8}>
            <Card className="mb-4 spot-card">
              <Card.Header>
                <h3>
                  {spotData.spot.status === '空置中' && <Badge bg="success">空置中</Badge>}
                  {spotData.spot.status === '充電中' && <Badge bg="danger">充電中</Badge>}
                  {spotData.spot.status === '等待中' && <Badge bg="warning">等待中</Badge>}
                  {spotData.spot.status === '結束' && <Badge bg="info">充電結束</Badge>}
                </h3>
              </Card.Header>
              
              <Card.Body>
                {/* 充電器移動中的提示 */}
                {isChargingCableMoving && (
                  <Alert variant="info">
                    <i className="bi bi-lightning-charge"></i> 充電器正在移動中... 
                    {cableMovementTime && `剩餘時間: ${cableMovementTime}`}
                  </Alert>
                )}
                
                {/* 充電中顯示 */}
                {spotData.spot.status === '充電中' && spotData.spot.startTime && (
                  <div className="charging-info">
                    <p><strong>開始時間:</strong> {format(new Date(spotData.spot.startTime), 'HH:mm:ss')}</p>
                    <p><strong>充電時間:</strong> {spotData.spot.chargingTime} 分鐘</p>
                    <p><strong>充電進度:</strong></p>
                    <ProgressBar 
                      now={calculateChargingProgress(spotData.spot.startTime, spotData.spot.chargingTime)} 
                      label={`${calculateChargingProgress(spotData.spot.startTime, spotData.spot.chargingTime)}%`} 
                    />
                    
                    {userId === spotData.spot.userId && (
                      <Button 
                        variant="danger" 
                        className="mt-3"
                        onClick={cancelCharging}
                      >
                        取消充電
                      </Button>
                    )}
                  </div>
                )}
                
                {/* 等待中顯示 */}
                {spotData.spot.status === '等待中' && (
                  <div className="waiting-info">
                    <p><strong>隊列位置:</strong> {spotData.queueInfo?.position > 0 ? spotData.queueInfo.position : '計算中...'}</p>
                    <p><strong>預計等待時間:</strong> {totalWaitTime || '計算中...'}</p>
                    
                    {userId === spotData.spot.userId && (
                      <Button 
                        variant="danger" 
                        className="mt-3"
                        onClick={cancelCharging}
                      >
                        取消等待
                      </Button>
                    )}
                  </div>
                )}
                
                {/* 空置中顯示 */}
                {spotData.spot.status === '空置中' && (
                  <div className="available-info">
                    <p>此車位目前可用，您可以申請充電。</p>
                    
                    {isChargingCableMoving ? (
                      <Alert variant="warning">
                        充電器正在移動中，請稍後再申請充電
                      </Alert>
                    ) : (
                      <>
                        {userId ? (
                          <Button 
                            variant="primary" 
                            onClick={() => setShowChargingForm(true)}
                            disabled={showChargingForm}
                          >
                            申請充電
                          </Button>
                        ) : (
                          <Alert variant="warning">
                            請先設置您的用戶ID才能申請充電
                          </Alert>
                        )}
                      </>
                    )}
                    
                    {showChargingForm && (
                      <div className="mt-3">
                        <ChargingForm 
                          onSubmit={requestCharging} 
                          onCancel={() => setShowChargingForm(false)}
                        />
                      </div>
                    )}
                  </div>
                )}
                
                {/* 充電結束顯示 */}
                {spotData.spot.status === '結束' && (
                  <div className="finished-info">
                    <p>充電已完成，車位即將釋放。</p>
                  </div>
                )}
              </Card.Body>
            </Card>
          </Col>
          
          <Col md={4}>
            <Card className="mb-4 user-card">
              <Card.Header>用戶信息</Card.Header>
              <Card.Body>
                {userId ? (
                  <div>
                    <p><strong>您的ID:</strong> {userId}</p>
                    <Button 
                      variant="outline-secondary" 
                      size="sm"
                      onClick={() => {
                        if (window.confirm("確定要重置用戶ID嗎？")) {
                          localStorage.removeItem('userId');
                          setUserId(null);
                        }
                      }}
                    >
                      重置ID
                    </Button>
                  </div>
                ) : (
                  <div className="user-id-form">
                    <p>請設置您的用戶ID以使用充電服務</p>
                    <input 
                      type="text" 
                      className="form-control mb-2"
                      placeholder="輸入ID" 
                      onChange={(e) => setUserId(e.target.value)}
                    />
                    <Button 
                      variant="primary" 
                      size="sm"
                      onClick={() => handleSetUserId(userId)}
                      disabled={!userId}
                    >
                      確認
                    </Button>
                  </div>
                )}
              </Card.Body>
            </Card>
            
            <Card className="system-info-card">
              <Card.Header>系統狀態</Card.Header>
              <Card.Body>
                <p>
                  <strong>充電器狀態:</strong> 
                  {isChargingCableMoving 
                    ? <Badge bg="warning">移動中</Badge> 
                    : <Badge bg="success">就緒</Badge>}
                </p>
                
                <p>
                  <strong>等待車位數:</strong> 
                  {spotData.queueInfo?.queueLength || 0}
                </p>
                
                <Button 
                  variant="secondary"
                  className="mt-2 w-100"
                  onClick={goToLobby}
                >
                  返回大廳
                </Button>
              </Card.Body>
            </Card>
          </Col>
        </Row>
      )}
    </Container>
  );
}

export default ParkingSpot;

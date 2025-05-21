// SpotPage.js
import React from 'react';
import { useParams } from 'react-router-dom';
import ParkingSpot from './ParkingSpot';

function SpotPage() {
  // 從URL參數中獲取車位ID
  const { id } = useParams();
  const spotId = parseInt(id, 10);
  
  // 檢查是否為有效車位ID
  if (isNaN(spotId) || spotId < 1) {
    return <div className="error">無效的車位ID</div>;
  }
  
  return <ParkingSpot spotId={spotId} />;
}

export default SpotPage;
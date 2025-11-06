import { Injectable } from '@nestjs/common';
import * as polyline from '@mapbox/polyline';

@Injectable()
export class RouteVisualizerService {
  /**
   * OTP API 응답에서 시각화 가능한 경로 데이터를 추출합니다.
   * @param otpResponse OTP API 응답 객체
   * @returns 시각화용 경로 데이터
   */
  extractRouteForVisualization(otpResponse: any) {
    if (!otpResponse?.plan?.itineraries) {
      throw new Error('유효하지 않은 OTP 응답 형식입니다.');
    }

    const itinerary = otpResponse.plan.itineraries[0]; // 첫 번째 경로 선택
    const visualizationData = {
      origin: {
        lat: otpResponse.plan.from.lat,
        lng: otpResponse.plan.from.lon,
        name: otpResponse.plan.from.name || '출발지'
      },
      destination: {
        lat: otpResponse.plan.to.lat,
        lng: otpResponse.plan.to.lon,
        name: otpResponse.plan.to.name || '도착지'
      },
      totalDuration: itinerary.duration,
      totalDistance: itinerary.walkDistance,
      legs: itinerary.legs.map((leg: any, index: number) => ({
        id: index,
        mode: leg.mode,
        duration: leg.duration,
        distance: leg.distance,
        from: {
          lat: leg.from.lat,
          lng: leg.from.lon,
          name: leg.from.name
        },
        to: {
          lat: leg.to.lat,
          lng: leg.to.lon,
          name: leg.to.name
        },
        // 인코딩된 폴리라인을 좌표 배열로 디코딩
        coordinates: leg.legGeometry?.points ? 
          this.decodePolyline(leg.legGeometry.points) : 
          [[leg.from.lat, leg.from.lon], [leg.to.lat, leg.to.lon]],
        routeInfo: leg.route ? {
          shortName: leg.routeShortName,
          longName: leg.routeLongName,
          color: leg.routeColor,
          textColor: leg.routeTextColor
        } : null
      }))
    };

    return visualizationData;
  }

  /**
   * Google 폴리라인 인코딩된 문자열을 좌표 배열로 디코딩합니다.
   * @param encodedPolyline 인코딩된 폴리라인 문자열
   * @returns [lat, lng] 형식의 좌표 배열
   */
  private decodePolyline(encodedPolyline: string): number[][] {
    try {
      // @mapbox/polyline 라이브러리 사용
      return polyline.decode(encodedPolyline);
    } catch (error) {
      console.error('폴리라인 디코딩 실패:', error);
      return [];
    }
  }

  /**
   * Leaflet.js에서 사용할 수 있는 JavaScript 코드를 생성합니다.
   * @param visualizationData 시각화 데이터
   * @returns Leaflet.js 코드 문자열
   */
  generateLeafletCode(visualizationData: any): string {
    return `
// Leaflet 지도 초기화
const map = L.map('map').setView([${visualizationData.origin.lat}, ${visualizationData.origin.lng}], 13);

// OpenStreetMap 타일 레이어 추가
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
  attribution: '© OpenStreetMap contributors'
}).addTo(map);

// 출발지 마커
L.marker([${visualizationData.origin.lat}, ${visualizationData.origin.lng}])
  .bindPopup('${visualizationData.origin.name}')
  .addTo(map);

// 도착지 마커
L.marker([${visualizationData.destination.lat}, ${visualizationData.destination.lng}])
  .bindPopup('${visualizationData.destination.name}')
  .addTo(map);

// 경로 구간별 폴리라인 그리기
${visualizationData.legs.map((leg: any) => `
// ${leg.mode} 구간 (${Math.round(leg.duration / 60)}분, ${Math.round(leg.distance)}m)
L.polyline(${JSON.stringify(leg.coordinates)}, {
  color: '${this.getModeColor(leg.mode)}',
  weight: ${this.getModeWeight(leg.mode)},
  ${leg.mode === 'WALK' ? "dashArray: '5, 5'," : ''}
  opacity: 0.7
}).bindPopup('${leg.mode}: ${leg.from.name} → ${leg.to.name}<br>소요시간: ${Math.round(leg.duration / 60)}분')
  .addTo(map);`).join('')}

// 전체 경로에 맞게 지도 범위 조정
const allCoordinates = ${JSON.stringify(visualizationData.legs.flatMap((leg: any) => leg.coordinates))};
const bounds = L.latLngBounds(allCoordinates);
map.fitBounds(bounds);

console.log('총 소요시간:', ${Math.round(visualizationData.totalDuration / 60)} + '분');
console.log('총 도보거리:', ${Math.round(visualizationData.totalDistance)} + 'm');
`;
  }

  /**
   * 이동 방식에 따른 색상을 반환합니다.
   */
  private getModeColor(mode: string): string {
    const colors: { [key: string]: string } = {
      'WALK': '#0066CC',
      'BUS': '#FF0000',
      'SUBWAY': '#9900CC',
      'RAIL': '#FF6600',
      'TRANSIT': '#00AA00'
    };
    return colors[mode] || '#666666';
  }

  /**
   * 이동 방식에 따른 선 굵기를 반환합니다.
   */
  private getModeWeight(mode: string): number {
    const weights: { [key: string]: number } = {
      'WALK': 3,
      'BUS': 5,
      'SUBWAY': 5,
      'RAIL': 5,
      'TRANSIT': 5
    };
    return weights[mode] || 3;
  }

  /**
   * HTML 페이지 전체를 생성합니다.
   * @param visualizationData 시각화 데이터
   * @returns 완전한 HTML 페이지 문자열
   */
  generateHTMLPage(visualizationData: any): string {
    return `<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>OTP 경로 시각화</title>
  
  <!-- Leaflet CSS -->
  <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" 
        integrity="sha256-p4NxAoJBhIIN+hmNHrzRCf9tD/miZyoHS5obTRR9BMY=" 
        crossorigin=""/>
  
  <style>
    body {
      margin: 0;
      padding: 20px;
      font-family: Arial, sans-serif;
    }
    #map {
      height: 600px;
      width: 100%;
      border: 1px solid #ccc;
      border-radius: 5px;
    }
    .info-panel {
      margin-bottom: 20px;
      padding: 15px;
      background-color: #f5f5f5;
      border-radius: 5px;
    }
    .route-info {
      display: flex;
      gap: 20px;
      flex-wrap: wrap;
    }
    .info-item {
      background: white;
      padding: 10px;
      border-radius: 3px;
      border-left: 4px solid #0066CC;
    }
  </style>
</head>
<body>
  <h1>OpenTripPlanner 경로 시각화</h1>
  
  <div class="info-panel">
    <h3>경로 정보</h3>
    <div class="route-info">
      <div class="info-item">
        <strong>총 소요시간:</strong> ${Math.round(visualizationData.totalDuration / 60)}분
      </div>
      <div class="info-item">
        <strong>총 도보거리:</strong> ${Math.round(visualizationData.totalDistance)}m
      </div>
      <div class="info-item">
        <strong>경유 구간:</strong> ${visualizationData.legs.length}개
      </div>
    </div>
  </div>
  
  <div id="map"></div>
  
  <!-- Leaflet JavaScript -->
  <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"
          integrity="sha256-20nQCchB9co0qIjJZRGuk2/Z9VM+kNiyxNV1lvTlZBo="
          crossorigin=""></script>
  
  <script>
    ${this.generateLeafletCode(visualizationData)}
  </script>
</body>
</html>`;
  }
}
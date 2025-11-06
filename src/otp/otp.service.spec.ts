import { Test, TestingModule } from '@nestjs/testing';
import { OtpService } from './otp.service';
import { RouteVisualizerService } from './route-visualizer.service';
import { PrismaService } from '../prisma/prisma.service';
import { HttpModule } from '@nestjs/axios';
import { ParticipantService } from '../party/services/participant.service';
import { JwtService } from '@nestjs/jwt';
import { MapService } from '../party/services/map.service';
import * as fs from 'fs';
import * as path from 'path';

describe('OtpService', () => {
  let service: OtpService;
  let visualizerService: RouteVisualizerService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      imports: [HttpModule], // ✅ HttpService 의존성 해결
      providers: [
        OtpService, 
        RouteVisualizerService, // ✅ 시각화 서비스 추가
        PrismaService, 
        ParticipantService,
        { provide: JwtService, useValue: {} },
        { provide: MapService, useValue: {} }, 
      ], // ✅ PrismaService 주입
    }).compile();

    service = module.get<OtpService>(OtpService);
    visualizerService = module.get<RouteVisualizerService>(RouteVisualizerService);
  });

  it('should get route and create visualization', async () => {
    const result = await service.getRoute('37.3908865,126.8627405','37.347061,126.820412','car');
    console.log('\n=== OTP API 응답 ===');
    console.log(JSON.stringify(result, null, 2));

    // ✅ 시각화 데이터 추출
    try {
      const visualizationData = visualizerService.extractRouteForVisualization(result);
      console.log('\n=== 시각화 데이터 ===');
      console.log(JSON.stringify(visualizationData, null, 2));

      // ✅ Leaflet.js 코드 생성
      const leafletCode = visualizerService.generateLeafletCode(visualizationData);
      console.log('\n=== Leaflet.js 코드 ===');
      console.log(leafletCode);

      // ✅ HTML 페이지 생성 및 파일 저장
      const htmlPage = visualizerService.generateHTMLPage(visualizationData);
      const outputPath = path.join(__dirname, '../../output');
      
      // output 디렉토리가 없으면 생성
      if (!fs.existsSync(outputPath)) {
        fs.mkdirSync(outputPath, { recursive: true });
      }

      const htmlFilePath = path.join(outputPath, 'route-visualization.html');
      fs.writeFileSync(htmlFilePath, htmlPage, 'utf8');
      
      console.log('\n=== HTML 파일 생성 완료 ===');
      console.log(`파일 경로: ${htmlFilePath}`);
      console.log('브라우저에서 이 파일을 열어 경로를 확인할 수 있습니다.');

      // ✅ 시각화 데이터도 JSON 파일로 저장
      const jsonFilePath = path.join(outputPath, 'route-data.json');
      fs.writeFileSync(jsonFilePath, JSON.stringify(visualizationData, null, 2), 'utf8');
      console.log(`JSON 데이터: ${jsonFilePath}`);

    } catch (error) {
      console.error('시각화 처리 중 오류:', error);
    }

    expect(result).toBeDefined();
  });
});
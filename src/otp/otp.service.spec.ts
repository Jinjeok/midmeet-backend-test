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

  // 🚇 대중교통 경로 테스트 (서울역 → 강남역)
  it('should get transit route from Seoul Station to Gangnam Station', async () => {
    console.log('\n🚇 === 대중교통 경로: 서울역 → 강남역 ===');
    
    const result = await service.getRoute(
      '37.5563,126.9723',  // 서울역 좌표
      '37.4979,127.0276',  // 강남역 좌표
      'WALK,TRANSIT'
    );
    
    await this.createVisualization(result, 'seoul-to-gangnam', '서울역-강남역');
    expect(result).toBeDefined();
  });

  // 🚌 버스 중심 경로 테스트 (홍대 → 이대)
  it('should get bus route from Hongik Univ to Ewha Univ', async () => {
    console.log('\n🚌 === 버스 경로: 홍익대 → 이화여대 ===');
    
    const result = await service.getRoute(
      '37.5511,126.9240',  // 홍익대 좌표
      '37.5594,126.9467',  // 이화여대 좌표
      'WALK,TRANSIT'
    );
    
    await this.createVisualization(result, 'hongik-to-ewha', '홍익대-이화여대');
    expect(result).toBeDefined();
  });

  // 🚶 도보 + 지하철 (잠실 → 코엑스)
  it('should get route from Jamsil to COEX', async () => {
    console.log('\n🚶🚇 === 도보+지하철: 잠실 → 코엑스 ===');
    
    const result = await service.getRoute(
      '37.5134,127.1000',  // 잠실역 좌표
      '37.5115,127.0595',  // 코엑스 좌표
      'WALK,TRANSIT'
    );
    
    await this.createVisualization(result, 'jamsil-to-coex', '잠실-코엑스');
    expect(result).toBeDefined();
  });

  // 🌉 한강 건너는 경로 (여의도 → 강남)
  it('should get route crossing Han River', async () => {
    console.log('\n🌉 === 한강 횡단: 여의도 → 강남 ===');
    
    const result = await service.getRoute(
      '37.5219,126.9245',  // 여의도 좌표
      '37.4979,127.0276',  // 강남역 좌표
      'WALK,TRANSIT'
    );
    
    await this.createVisualization(result, 'yeouido-to-gangnam', '여의도-강남');
    expect(result).toBeDefined();
  });

  // 🏢 비즈니스 구간 (을지로 → 종로)
  it('should get route from Euljiro to Jongno', async () => {
    console.log('\n🏢 === 도심 구간: 을지로 → 종로 ===');
    
    const result = await service.getRoute(
      '37.5663,126.9916',  // 을지로3가 좌표
      '37.5703,126.9924',  // 종로3가 좌표
      'WALK,TRANSIT'
    );
    
    await this.createVisualization(result, 'euljiro-to-jongno', '을지로-종로');
    expect(result).toBeDefined();
  });

  // 🎓 대학가 경로 (신촌 → 대학로)
  it('should get route from Sinchon to Daehangno', async () => {
    console.log('\n🎓 === 대학가: 신촌 → 대학로 ===');
    
    const result = await service.getRoute(
      '37.5584,126.9368',  // 신촌역 좌표
      '37.5805,127.0021',  // 혜화역(대학로) 좌표
      'WALK,TRANSIT'
    );
    
    await this.createVisualization(result, 'sinchon-to-daehangno', '신촌-대학로');
    expect(result).toBeDefined();
  });

  // 공통 시각화 생성 함수
  async createVisualization(result: any, fileName: string, routeName: string) {
    console.log(`\n=== ${routeName} OTP API 응답 ===`);
    console.log(JSON.stringify(result, null, 2));

    try {
      const visualizationData = visualizerService.extractRouteForVisualization(result);
      console.log(`\n=== ${routeName} 시각화 데이터 ===`);
      console.log(JSON.stringify(visualizationData, null, 2));

      // HTML 페이지 생성 및 파일 저장
      const htmlPage = visualizerService.generateHTMLPage(visualizationData);
      const outputPath = path.join(__dirname, '../../output');
      
      // output 디렉토리가 없으면 생성
      if (!fs.existsSync(outputPath)) {
        fs.mkdirSync(outputPath, { recursive: true });
      }

      const htmlFilePath = path.join(outputPath, `${fileName}.html`);
      fs.writeFileSync(htmlFilePath, htmlPage, 'utf8');
      
      console.log(`\n=== ${routeName} HTML 파일 생성 완료 ===`);
      console.log(`파일 경로: ${htmlFilePath}`);

      // JSON 데이터도 저장
      const jsonFilePath = path.join(outputPath, `${fileName}-data.json`);
      fs.writeFileSync(jsonFilePath, JSON.stringify(visualizationData, null, 2), 'utf8');
      console.log(`JSON 데이터: ${jsonFilePath}`);

    } catch (error) {
      console.error(`${routeName} 시각화 처리 중 오류:`, error);
    }
  }
});
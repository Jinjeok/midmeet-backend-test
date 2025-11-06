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

  // 공통 시각화 생성 함수 (it 블록 밖, describe 스코프에 선언)
  const createVisualization = async (
    result: any,
    fileName: string,
    routeName: string,
  ) => {
    // result null/undefined 방어
    if (!result || !result.plan) {
      console.warn(`${routeName}: OTP 응답이 비어있습니다.`);
      return;
    }

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
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      imports: [HttpModule],
      providers: [
        OtpService,
        RouteVisualizerService,
        PrismaService,
        ParticipantService,
        { provide: JwtService, useValue: {} },
        { provide: MapService, useValue: {} },
      ],
    }).compile();

    service = module.get<OtpService>(OtpService);
    visualizerService = module.get<RouteVisualizerService>(RouteVisualizerService);
  });

  // ts-jest hybrid module kind 경고 완화용 옵션 안내는 Jest 설정에서 처리 권장

  it('🚇 서울역 → 강남역 (대중교통)', async () => {
    const result = await service.getRoute(
      '37.5563,126.9723', // 서울역
      '37.4979,127.0276', // 강남역
      'WALK,TRANSIT',
    );

    await createVisualization(result, 'seoul-to-gangnam', '서울역-강남역');
    expect(result).toBeDefined();
  });

  it('🚌 홍익대 → 이화여대 (버스)', async () => {
    const result = await service.getRoute(
      '37.5511,126.9240', // 홍익대
      '37.5594,126.9467', // 이화여대
      'WALK,TRANSIT',
    );

    await createVisualization(result, 'hongik-to-ewha', '홍익대-이화여대');
    expect(result).toBeDefined();
  });

  it('🚶🚇 잠실 → 코엑스 (도보+지하철)', async () => {
    const result = await service.getRoute(
      '37.5134,127.1000', // 잠실역
      '37.5115,127.0595', // 코엑스
      'WALK,TRANSIT',
    );

    await createVisualization(result, 'jamsil-to-coex', '잠실-코엑스');
    expect(result).toBeDefined();
  });

  it('🌉 여의도 → 강남 (한강 횡단)', async () => {
    const result = await service.getRoute(
      '37.5219,126.9245', // 여의도
      '37.4979,127.0276', // 강남역
      'WALK,TRANSIT',
    );

    await createVisualization(result, 'yeouido-to-gangnam', '여의도-강남');
    expect(result).toBeDefined();
  });

  it('🏢 을지로 → 종로 (도심)', async () => {
    const result = await service.getRoute(
      '37.5663,126.9916', // 을지로3가
      '37.5703,126.9924', // 종로3가
      'WALK,TRANSIT',
    );

    await createVisualization(result, 'euljiro-to-jongno', '을지로-종로');
    expect(result).toBeDefined();
  });

  it('🎓 신촌 → 대학로 (대학가)', async () => {
    const result = await service.getRoute(
      '37.5584,126.9368', // 신촌역
      '37.5805,127.0021', // 혜화역(대학로)
      'WALK,TRANSIT',
    );

    await createVisualization(result, 'sinchon-to-daehangno', '신촌-대학로');
    expect(result).toBeDefined();
  });
});

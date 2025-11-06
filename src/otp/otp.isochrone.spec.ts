import { Test, TestingModule } from '@nestjs/testing';
import { OtpService } from './otp.service';
import { PrismaService } from '../prisma/prisma.service';
import { HttpModule } from '@nestjs/axios';
import { ParticipantService } from '../party/services/participant.service';
import { JwtService } from '@nestjs/jwt';
import { MapService } from '../party/services/map.service';
import * as fs from 'fs';
import * as path from 'path';

/**
 * Isochrone 생성 및 HTML 시각화 테스트 (타임아웃 확장)
 */

describe('OtpService Isochrone', () => {
  let service: OtpService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      imports: [HttpModule],
      providers: [
        OtpService,
        PrismaService,
        ParticipantService,
        { provide: JwtService, useValue: {} },
        { provide: MapService, useValue: {} },
      ],
    }).compile();

    service = module.get<OtpService>(OtpService);
  });

  const OUTPUT_DIR = path.join(__dirname, '../../output');
  const ensureOutputDir = () => {
    if (!fs.existsSync(OUTPUT_DIR)) fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  };

  // 타임아웃 30초로 확장 (원격 API 지연 대비)
  it('should create 10/20/30min isochrones around Seoul Station and build an HTML', async () => {
    jest.setTimeout(30000);

    const center = { lat: 37.5563, lon: 126.9723 };

    const cutoffs = [
      { label: '10min', value: 'PT10M', fallbackSeconds: 600, color: '#2E86DE' },
      { label: '20min', value: 'PT20M', fallbackSeconds: 1200, color: '#10AC84' },
      { label: '30min', value: 'PT30M', fallbackSeconds: 1800, color: '#F39C12' },
    ] as const;

    const layers: Array<{ label: string; color: string; geojson: any }> = [];

    for (const c of cutoffs) {
      try {
        const gj = await service.getIsochrone(center.lat, center.lon, c.value as any);
        layers.push({ label: c.label, color: c.color, geojson: gj });
      } catch (e) {
        try {
          const gj = await service.getIsochrone(center.lat, center.lon, String(c.fallbackSeconds) as any);
          layers.push({ label: c.label, color: c.color, geojson: gj });
        } catch (ee) {
          console.warn(`Isochrone failed for ${c.label}:`, (ee as Error).message);
        }
      }
    }

    ensureOutputDir();

    layers.forEach((l) => {
      const jsonFilePath = path.join(OUTPUT_DIR, `isochrone-${l.label}.json`);
      fs.writeFileSync(jsonFilePath, JSON.stringify(l.geojson, null, 2), 'utf8');
    });

    const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset=\"utf-8\" />
  <title>Isochrone (Seoul Station)</title>
  <link rel=\"stylesheet\" href=\"https://unpkg.com/leaflet@1.9.4/dist/leaflet.css\" />
  <style>#map{height: 640px} body{margin:16px;font-family:Arial}</style>
</head>
<body>
  <h2>Isochrone around Seoul Station (WALK+TRANSIT)</h2>
  <div id=\"map\"></div>
  <script src=\"https://unpkg.com/leaflet@1.9.4/dist/leaflet.js\"></script>
  <script>
    const map = L.map('map').setView([${center.lat}, ${center.lon}], 13);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { attribution: '© OpenStreetMap contributors' }).addTo(map);

    const layers = ${JSON.stringify(layers.map(l => ({ label: l.label, color: l.color, geojson: l.geojson })))};

    let bounds;
    layers.forEach((l) => {
      const layer = L.geoJSON(l.geojson, {
        style: { color: l.color, weight: 2, fillColor: l.color, fillOpacity: 0.25 }
      }).addTo(map);
      if (!bounds) bounds = layer.getBounds(); else bounds = bounds.extend(layer.getBounds());
    });

    if (bounds) map.fitBounds(bounds);

    L.marker([${center.lat}, ${center.lon}]).bindPopup('Center: Seoul Station').addTo(map);
  </script>
</body>
</html>`;

    const htmlPath = path.join(OUTPUT_DIR, 'isochrone.html');
    fs.writeFileSync(htmlPath, html, 'utf8');

    expect(layers.length).toBeGreaterThan(0);
  }, 30000);
});

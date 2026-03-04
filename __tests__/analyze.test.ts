import { describe, it, expect } from 'vitest';

// We test the POST endpoint behaviour by importing the route handler directly.
// Next.js route handlers export named HTTP method functions.
import { POST } from '@/app/api/analyze/route';

function makeRequest(body: unknown) {
  return new Request('http://localhost:3000/api/analyze', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

describe('POST /api/analyze', () => {
  it('returns 400 when lyrics are missing', async () => {
    const req = makeRequest({});
    const res = await POST(req as any);
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toBeDefined();
  });

  it('returns 400 when lyrics have fewer than 5 words', async () => {
    const req = makeRequest({ lyrics: 'too short' });
    const res = await POST(req as any);
    expect(res.status).toBe(400);
  });

  it('returns a valid analysis for English lyrics', async () => {
    const lyrics = `I love dancing in the sunshine
Happy days are here forever
Joy and peace fill my heart
Smiling bright under the blue sky
Dreams come alive tonight`;

    const req = makeRequest({ lyrics });
    const res = await POST(req as any);
    expect(res.status).toBe(200);

    const data = await res.json();

    // Shape checks
    expect(data.mood).toEqual(expect.any(String));
    expect(data.vibe).toEqual(expect.any(String));
    expect(data.energy).toEqual(expect.any(String));
    expect(data.sentiment).toEqual(expect.any(String));
    expect(data.themes).toEqual(expect.any(Array));
    expect(data.detailedAnalysis).toEqual(expect.any(String));
    expect(data.confidence).toBeGreaterThanOrEqual(0);
    expect(data.confidence).toBeLessThanOrEqual(1);
    expect(data.wordCount).toBeGreaterThan(0);
  });

  it('detects positive sentiment for happy lyrics', async () => {
    const lyrics = `Love and joy and happiness forever
Beautiful amazing wonderful sunshine
Hope and dream and smile and light
Sweet and bright and free and alive
Blessed peace in my heart today`;

    const req = makeRequest({ lyrics });
    const res = await POST(req as any);
    const data = await res.json();
    expect(data.sentiment).toMatch(/Positive/i);
  });

  it('detects negative sentiment for sad lyrics', async () => {
    const lyrics = `Sad pain and hurt all around me
Crying lonely in the dark tonight
Hate and death and fear and rage
Lost and broken tears falling down
Cold and empty suffering alone`;

    const req = makeRequest({ lyrics });
    const res = await POST(req as any);
    const data = await res.json();
    expect(data.sentiment).toMatch(/Negative/i);
  });

  it('extracts themes from lyrics', async () => {
    const lyrics = `I remember our love under the stars
We danced together forever in the moonlight
My heart still beats for you
Those memories of yesterday still shine
Hope and faith carry me through`;

    const req = makeRequest({ lyrics });
    const res = await POST(req as any);
    const data = await res.json();
    expect(data.themes.length).toBeGreaterThan(0);
  });

  it('higher word count yields higher confidence', async () => {
    const short = 'Love peace joy dream hope believe smile bright free alive sunshine';
    const long = (short + ' ').repeat(20).trim();

    const reqShort = makeRequest({ lyrics: short });
    const reqLong = makeRequest({ lyrics: long });

    const [resShort, resLong] = await Promise.all([
      POST(reqShort as any),
      POST(reqLong as any),
    ]);

    const dataShort = await resShort.json();
    const dataLong = await resLong.json();

    expect(dataLong.confidence).toBeGreaterThanOrEqual(dataShort.confidence);
  });
});

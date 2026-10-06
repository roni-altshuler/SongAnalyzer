/** Client-derived features have no server-verifiable recording permission. */
import { NextResponse } from 'next/server';
import { AUDIO_PERSISTENCE_DENIAL } from '@/lib/audio/policy';
export const runtime = 'nodejs';

export async function POST() {
  return NextResponse.json(AUDIO_PERSISTENCE_DENIAL, { status: 403 });
}

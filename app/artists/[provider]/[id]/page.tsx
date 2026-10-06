import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { artistIdentity, ARTIST_PROVIDER_LABELS } from '@/lib/artists/identity';
import ArtistProfile from '@/app/components/ArtistProfile';

interface PageProps { params: Promise<{ provider: string; id: string }> }

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { provider, id } = await params;
  const identity = artistIdentity(provider, id);
  return { title: identity ? `Artist profile · ${ARTIST_PROVIDER_LABELS[identity.provider]} — SongAnalyzer` : 'Artist not found — SongAnalyzer' };
}

export default async function ArtistPage({ params }: PageProps) {
  const { provider, id } = await params;
  const identity = artistIdentity(provider, id);
  if (!identity) notFound();
  // Provider-qualified route identity, with tab context loaded by the client.
  // No external artist, image, biography or catalog query is added here.
  return <ArtistProfile key={`${identity.provider}:${identity.id}`} identity={identity} />;
}

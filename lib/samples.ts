/**
 * Sample lyrics for the quick-start feature.
 * These are original, non-copyrighted example lyrics.
 */

import { SampleLyric } from './types';
import { ATLAS_SEED_LYRICS } from './seeds/atlas-seed-lyrics';

export const SAMPLE_LYRICS: SampleLyric[] = [
  {
    title: 'Golden Horizon',
    artist: 'Sample — Upbeat Pop',
    genre: 'pop',
    lyrics: `I'm chasing the sunrise, running through the fields
Every heartbeat tells me that this love is real
Dancing in the golden light, nothing else I need
You and I together, planting every seed

We're flying high above the clouds tonight
Stars are shining, everything feels right
Golden horizon, calling out our name
Nothing's gonna ever be the same

Laughing like we're kids again, spinning round and round
Joy is overflowing, our feet don't touch the ground
The world is open wide and the sky is blue
Every dream I ever had is coming true`,
  },
  {
    title: 'Midnight Echoes',
    artist: 'Sample — Melancholic Ballad',
    genre: 'ballad',
    lyrics: `In the silence of this room I hear your ghost
Whispers of a love that mattered more than most
Shadows on the wall still trace your silhouette
Memories I promised I would never forget

These midnight echoes won't let me sleep
Promises I made but could not keep
Tears fall softly on this empty bed
Haunted by the words that went unsaid

I miss the warmth you carried in your smile
I'd walk a thousand broken roads, another mile
But time moves forward even when hearts break
Lonely is the price we sometimes pay for love's sake`,
  },
  {
    title: 'Fire & Steel',
    artist: 'Sample — High Energy Rock',
    genre: 'rock',
    lyrics: `Rise up! The battle drums are beating loud
Thunder shaking through the roaring crowd
We're standing strong, we will not fall
When they push us down we'll break through every wall

Fire and steel, running through my veins
No more shackles, no more chains
Scream it louder, let the whole world hear
We're unstoppable, we conquer every fear

Fists up high, we fight for what is right
Burning brighter than the darkest night
Power surging, adrenaline explodes
We are warriors on the open road`,
  },
  {
    title: 'Quiet Rain',
    artist: 'Sample — Chill & Reflective',
    genre: 'chill',
    lyrics: `Soft rain falling on the window pane
Watching droplets trace a gentle refrain
Quiet moments in the afternoon
Drifting slowly like a lazy moon

The world outside can wait a little while
I'll pour some tea and sit here with a smile
No rush, no noise, just calm and peace
A gentle flow that brings a sweet release

Stars will come when evening takes its turn
And candles flicker as the embers burn
Sometimes stillness is the loudest song
In the quiet is where I belong`,
  },
];

/**
 * Five sample lyrics surfaced from the Mood Atlas seed corpus so the
 * sample-lyric picker can preview real atlas entries without duplicating
 * the text. Sourced from `lib/seeds/atlas-seed-lyrics.ts`; if the corpus
 * shrinks below 5 entries this falls back to whatever is available.
 */
export const seedLyrics: SampleLyric[] = ATLAS_SEED_LYRICS.slice(0, 5).map(
  (entry) => ({
    title: entry.title,
    artist: entry.artist,
    genre: entry.genre.toLowerCase(),
    lyrics: entry.lyrics,
  }),
);

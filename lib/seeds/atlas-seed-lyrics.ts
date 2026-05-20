/**
 * Mood Atlas seed corpus.
 *
 * ~60 synthetic song entries across 5 genres (Pop, Rock, Hip-Hop, Folk,
 * Electronic) and ~15 fictional artists. Every lyric snippet is an
 * ORIGINAL 25-40-word fragment written specifically for this project —
 * no real artist names, no copyrighted text.
 *
 * The vocabulary in each snippet is carefully chosen to overlap with the
 * keyword lists in `lib/analysis/keyword.ts` so the deterministic engine
 * produces a sensible mood when these rows are seeded via
 * `lib/seeds/build-seed-sql.ts`.
 *
 * Each entry's `year` is the (fictional) release year used to populate
 * `songs.release_year`. Years span 2005–2024 so the artist timelines on
 * /atlas/artist/[slug] have meaningful x-axis spread.
 */

export interface AtlasSeedEntry {
  artist: string;
  title: string;
  /** One of: 'Pop' | 'Rock' | 'Hip-Hop' | 'Folk' | 'Electronic'. */
  genre: string;
  year: number;
  /** Original 25-40 word lyric snippet, mood-evocative. */
  lyrics: string;
}

export const ATLAS_GENRES = ['Pop', 'Rock', 'Hip-Hop', 'Folk', 'Electronic'] as const;
export type AtlasGenre = (typeof ATLAS_GENRES)[number];

export const ATLAS_SEED_LYRICS: AtlasSeedEntry[] = [
  // ---------------------------------------------------------------------
  // Neon Echo — synth-pop, varied moods across albums
  // ---------------------------------------------------------------------
  {
    artist: 'Neon Echo',
    title: 'Sunshine Boulevard',
    genre: 'Pop',
    year: 2019,
    lyrics:
      'Dancing under sunshine lights tonight, hearts beat bright and free. ' +
      'Joy is rising, sweet and alive, every smile feels like the sky is open. ' +
      'We celebrate tonight forever, happy hearts together.',
  },
  {
    artist: 'Neon Echo',
    title: 'Glass Reflection',
    genre: 'Pop',
    year: 2020,
    lyrics:
      'I remember days you held me close, distance whispers in the rain. ' +
      'Missing you tonight, tears soft on the pillow, memories of love and gentle quiet. ' +
      'Time moves slowly when hearts are far away.',
  },
  {
    artist: 'Neon Echo',
    title: 'Paper Hearts',
    genre: 'Pop',
    year: 2021,
    lyrics:
      'Hope is rising like the morning light, dreams believe again. ' +
      'Faith returns when shadows fade and stars believe in tomorrow. ' +
      'Soaring higher, life feels bright and alive once more.',
  },
  {
    artist: 'Neon Echo',
    title: 'Velvet Hours',
    genre: 'Pop',
    year: 2022,
    lyrics:
      'Soft whispers in a quiet room, gentle peace surrounds me now. ' +
      'Calm flows through still moments, candles burning slow and tender. ' +
      'Peaceful nights, the world is gentle when you stay.',
  },

  // ---------------------------------------------------------------------
  // Glass Garden — folk, mostly melancholic / nostalgic
  // ---------------------------------------------------------------------
  {
    artist: 'Glass Garden',
    title: 'River Stones',
    genre: 'Folk',
    year: 2015,
    lyrics:
      'Cold tears fall on the old porch wood, lonely shadows know my name. ' +
      'Broken promises and empty rooms, pain still lives where love had grown. ' +
      'Lost in tears, the night is dark and cold.',
  },
  {
    artist: 'Glass Garden',
    title: 'Autumn Letters',
    genre: 'Folk',
    year: 2016,
    lyrics:
      'I remember walking through that distant field, longing for the past again. ' +
      'Memories of you stay far away yet close, gentle nostalgia in the wind. ' +
      'Time moves slowly when you remember love.',
  },
  {
    artist: 'Glass Garden',
    title: 'Wooden Sky',
    genre: 'Folk',
    year: 2018,
    lyrics:
      'Quiet rivers and mountain trees, the wind sings soft beneath the stars. ' +
      'Calm seas reflect a moon of peace, gentle clouds drift across the sky. ' +
      'Stillness fills the evening with tender light.',
  },
  {
    artist: 'Glass Garden',
    title: 'Pale Morning',
    genre: 'Folk',
    year: 2020,
    lyrics:
      'Sorrow knows the morning light, broken hearts know how to cry. ' +
      'Lonely roads stretch through the rain, pain follows tears in the cold. ' +
      'Empty bed and unsaid words, I miss you still.',
  },
  {
    artist: 'Glass Garden',
    title: 'Lantern Field',
    genre: 'Folk',
    year: 2022,
    lyrics:
      'Hope rises softly in the dawning sun, faith believes in better days. ' +
      'Dreams stretch wide across the quiet field, light returns where shadows once stayed. ' +
      'Tomorrow brings the change we always wanted.',
  },

  // ---------------------------------------------------------------------
  // Crimson Static — alt-rock, aggressive / intense
  // ---------------------------------------------------------------------
  {
    artist: 'Crimson Static',
    title: 'Iron Lungs',
    genre: 'Rock',
    year: 2014,
    lyrics:
      'Rage burns through the fight tonight! Battle drums shake the angry sky! ' +
      'Fury rises, we run and shout, war cries pound the loud and crazy crowd. ' +
      'Rock the night, scream until the walls explode!',
  },
  {
    artist: 'Crimson Static',
    title: 'Black Tide',
    genre: 'Rock',
    year: 2016,
    lyrics:
      'Fight the dark, the rage is wild and burning! Anger fuels the battle fire. ' +
      'Scream loud through the broken night, fury rising in the storm. ' +
      'We move fast, we shake the ground with thunder!',
  },
  {
    artist: 'Crimson Static',
    title: 'Glass Knives',
    genre: 'Rock',
    year: 2018,
    lyrics:
      'Pain follows pain, hurt cuts deep tonight. Tears fall on a broken stage. ' +
      'Lost and lonely, hate burns where love once lived, sad echoes haunt the empty rooms. ' +
      'Cold reality, the night feels dead.',
  },
  {
    artist: 'Crimson Static',
    title: 'Static Saints',
    genre: 'Rock',
    year: 2020,
    lyrics:
      'Rise, climb, victory is close enough to touch! Strong hearts power through the fight. ' +
      'Triumph waits beyond the struggle, we believe and rise above. ' +
      'Hope burns bright, faith pushes us forward, we are alive!',
  },
  {
    artist: 'Crimson Static',
    title: 'Hollow Veins',
    genre: 'Rock',
    year: 2023,
    lyrics:
      'Fear shadows the dark hallway, nightmares whisper through the night. ' +
      'Scared and cold, the danger feels close enough to hurt. ' +
      'Shadows move, anxious heartbeats race, I cannot find the light alone.',
  },

  // ---------------------------------------------------------------------
  // Saint Mercury — hip-hop, mostly empowering / aggressive
  // ---------------------------------------------------------------------
  {
    artist: 'Saint Mercury',
    title: 'Concrete Crown',
    genre: 'Hip-Hop',
    year: 2017,
    lyrics:
      'Power moves, we rise from concrete dreams and broken streets! ' +
      'Strong hearts climb, we fight the struggle, triumph is what we live for! ' +
      'Victory tonight, we run fast and loud, we shake the city floor!',
  },
  {
    artist: 'Saint Mercury',
    title: 'Velvet Skyline',
    genre: 'Hip-Hop',
    year: 2018,
    lyrics:
      'Hard struggle every day, we fight to survive the broken road ahead. ' +
      'Pain and rage push us to overcome, we try and rise above the storm. ' +
      'Battle scars remind us where we have been.',
  },
  {
    artist: 'Saint Mercury',
    title: 'Gold Mirage',
    genre: 'Hip-Hop',
    year: 2019,
    lyrics:
      'Celebrate tonight, the party rises loud, we dance and shout until dawn. ' +
      'Joy is here, fun is alive, time keeps the music pumping bright. ' +
      'Happy hearts move fast, the beat shakes everything!',
  },
  {
    artist: 'Saint Mercury',
    title: 'Paper Throne',
    genre: 'Hip-Hop',
    year: 2021,
    lyrics:
      'Hope rises through the smoke, faith believes in better tomorrows. ' +
      'Dreams climb high above the city, light pushes through the shadows ahead. ' +
      'Believe again, the future opens wide and bright.',
  },
  {
    artist: 'Saint Mercury',
    title: 'Iron Halo',
    genre: 'Hip-Hop',
    year: 2023,
    lyrics:
      'Rage burns, the battle moves fast, we shout louder than the angry storm! ' +
      'Fury rising, fight tonight, scream until the walls break down. ' +
      'Loud and wild, we run free through the burning night!',
  },

  // ---------------------------------------------------------------------
  // Aurora Drift — electronic, mostly dreamy / peaceful
  // ---------------------------------------------------------------------
  {
    artist: 'Aurora Drift',
    title: 'Blue Hour Drive',
    genre: 'Electronic',
    year: 2015,
    lyrics:
      'Drifting through the dream sky, floating soft above the clouds. ' +
      'Stars glow gentle, slow and quiet, we drift across the night so calm. ' +
      'Soft beats move slowly, peaceful waves fade into the still horizon.',
  },
  {
    artist: 'Aurora Drift',
    title: 'Mirror Lake',
    genre: 'Electronic',
    year: 2017,
    lyrics:
      'Calm waters reflect a peaceful moon, gentle quiet fills the still room. ' +
      'Soft synths drift like sleeping clouds, tranquil flow surrounds the night. ' +
      'Tender peace, the world slows down to listen carefully.',
  },
  {
    artist: 'Aurora Drift',
    title: 'Helios Burn',
    genre: 'Electronic',
    year: 2019,
    lyrics:
      'Dance tonight, the bass drops loud, the beat pumps wild and free! ' +
      'Move fast, the floor explodes, we celebrate until the morning sun rises bright. ' +
      'Joy is loud, energy burning through the crazy crowd!',
  },
  {
    artist: 'Aurora Drift',
    title: 'Ghost Code',
    genre: 'Electronic',
    year: 2021,
    lyrics:
      'Lonely echoes in the cold dark room, missing you across the distant night. ' +
      'Memories whisper, tears fall slow, broken signals fade into the empty space. ' +
      'Sorrow drifts like silent rain across the screen.',
  },
  {
    artist: 'Aurora Drift',
    title: 'Phosphor Bloom',
    genre: 'Electronic',
    year: 2023,
    lyrics:
      'Hope shines bright through the digital dawn, faith believes the dream is real. ' +
      'Light rises through the synth wave, dreams stretch beyond the glowing stars. ' +
      'Tomorrow opens wide, we rise into the future together.',
  },

  // ---------------------------------------------------------------------
  // Sample Artist — pop, varied
  // ---------------------------------------------------------------------
  {
    artist: 'Sample Artist',
    title: 'Bubblegum Sky',
    genre: 'Pop',
    year: 2018,
    lyrics:
      'Sunshine smiles and happy hearts dance through the bright summer day! ' +
      'Love is sweet, joy is alive, we celebrate the wonderful moment together. ' +
      'Beautiful skies, amazing days, every dream feels close enough to touch.',
  },
  {
    artist: 'Sample Artist',
    title: 'Telephone Rain',
    genre: 'Pop',
    year: 2019,
    lyrics:
      'Tears fall soft through the lonely night, missing your voice across the line. ' +
      'Distance hurts, memories cry, broken pieces of a love that mattered most. ' +
      'Cold rain whispers what we lost.',
  },
  {
    artist: 'Sample Artist',
    title: 'Carnival Lights',
    genre: 'Pop',
    year: 2020,
    lyrics:
      'Party tonight, the carnival shines bright with joyful music and laughter! ' +
      'Dance and celebrate, fun is alive, time stops in this happy moment. ' +
      'Joy explodes through every smile, tonight feels like forever!',
  },

  // ---------------------------------------------------------------------
  // Demo Band — rock, mixed
  // ---------------------------------------------------------------------
  {
    artist: 'Demo Band',
    title: 'Highway Engines',
    genre: 'Rock',
    year: 2015,
    lyrics:
      'Run fast through the loud open road, rock the night with thunder loud! ' +
      'Scream the chorus, jump and shake, we move free across the burning highway. ' +
      'Power surges, the engines roar through the night!',
  },
  {
    artist: 'Demo Band',
    title: 'Silent Mile',
    genre: 'Rock',
    year: 2017,
    lyrics:
      'Sorrow walks the empty mile, broken bottles and cold rain. ' +
      'Pain follows where the love once lived, lonely shadows haunt the quiet street. ' +
      'Tears fall slow, the dark night swallows everything once again.',
  },
  {
    artist: 'Demo Band',
    title: 'Open Window',
    genre: 'Rock',
    year: 2019,
    lyrics:
      'Hope climbs through the morning window, faith believes the storm will pass. ' +
      'Dreams rise like a rising sun, light returns and shadows fade away. ' +
      'Believe in better, tomorrow shines through every quiet doubt.',
  },

  // ---------------------------------------------------------------------
  // Velvet Hush — folk, peaceful / nostalgic
  // ---------------------------------------------------------------------
  {
    artist: 'Velvet Hush',
    title: 'Hollow Pines',
    genre: 'Folk',
    year: 2010,
    lyrics:
      'Quiet pines and gentle rain, soft wind through the calm afternoon. ' +
      'Peace fills the slow valley, tender stillness in the fading light. ' +
      'Calm moments stretch across the patient sky, the world is gentle.',
  },
  {
    artist: 'Velvet Hush',
    title: 'Distant Bells',
    genre: 'Folk',
    year: 2012,
    lyrics:
      'I remember bells that called us home through the distant evening. ' +
      'Memories rise like smoke from the past, missing the days we used to know. ' +
      'Time moves forward, nostalgia drifts like quiet autumn leaves.',
  },
  {
    artist: 'Velvet Hush',
    title: 'Moss Cathedral',
    genre: 'Folk',
    year: 2015,
    lyrics:
      'Sky opens above the gentle trees, sun and clouds drift together in peace. ' +
      'Stars wait for the patient night, ocean breathes through the calm horizon. ' +
      'Nature sings a quiet hymn of stillness and slow tender light.',
  },
  {
    artist: 'Velvet Hush',
    title: 'Empty Chair',
    genre: 'Folk',
    year: 2018,
    lyrics:
      'Tears fall in the empty chair, lonely hands hold what is gone. ' +
      'Memories ache, broken promises drift through the cold evening room. ' +
      'Pain stays where love once smiled, sorrow knows my name tonight.',
  },

  // ---------------------------------------------------------------------
  // Polar Index — electronic, mixed
  // ---------------------------------------------------------------------
  {
    artist: 'Polar Index',
    title: 'Frost Cycle',
    genre: 'Electronic',
    year: 2016,
    lyrics:
      'Cold sky, the empty waves stretch through the dark night. ' +
      'Lonely signals drift across the broken air, lost memories fade into static. ' +
      'Sorrow loops through the quiet machine, the world feels distant and dead.',
  },
  {
    artist: 'Polar Index',
    title: 'Auroral',
    genre: 'Electronic',
    year: 2018,
    lyrics:
      'Drift slow through the soft synth dream, float gentle above the quiet clouds. ' +
      'Stars shimmer, the dreamy night moves with tender peace. ' +
      'Calm waves carry us across the floating sky of silver dust.',
  },
  {
    artist: 'Polar Index',
    title: 'Pulse Garden',
    genre: 'Electronic',
    year: 2020,
    lyrics:
      'Dance tonight, the bass drops wild, we move fast through the loud night! ' +
      'Energy explodes, the crowd jumps, the beat pumps higher than the sky! ' +
      'Crazy fire, we burn brighter than the night!',
  },
  {
    artist: 'Polar Index',
    title: 'Daylight Bloom',
    genre: 'Electronic',
    year: 2022,
    lyrics:
      'Hope rises with the digital dawn, faith believes the sun returns. ' +
      'Dreams climb wide across the morning grid, light pushes through the fading shadows. ' +
      'Tomorrow opens like a quiet bright song.',
  },

  // ---------------------------------------------------------------------
  // Jagged Pearl — hip-hop, varied
  // ---------------------------------------------------------------------
  {
    artist: 'Jagged Pearl',
    title: 'Marble Streets',
    genre: 'Hip-Hop',
    year: 2016,
    lyrics:
      'We rise from broken concrete, strong hearts climb where the struggle lives. ' +
      'Fight the hard road, survive the battle, triumph waits beyond the storm. ' +
      'Power and victory, we believe we can overcome anything tonight.',
  },
  {
    artist: 'Jagged Pearl',
    title: 'Velvet Riot',
    genre: 'Hip-Hop',
    year: 2018,
    lyrics:
      'Rage moves fast through the angry crowd, we shout and run and fight! ' +
      'Battle drums shake the loud street, we scream until the walls explode! ' +
      'Wild fire, the night burns bright with fury!',
  },
  {
    artist: 'Jagged Pearl',
    title: 'Honey Static',
    genre: 'Hip-Hop',
    year: 2020,
    lyrics:
      'Celebrate tonight, the party shines bright, we dance and laugh together! ' +
      'Joy is loud, fun is alive, the music pumps wild through the happy crowd. ' +
      'Time stops, tonight is everything we wanted!',
  },
  {
    artist: 'Jagged Pearl',
    title: 'Quiet Crown',
    genre: 'Hip-Hop',
    year: 2022,
    lyrics:
      'Lonely shadows on the empty block, missing what we used to know. ' +
      'Memories drift through the cold rain, broken bottles and forgotten faces. ' +
      'Sorrow lives where the loud joy once danced and shouted.',
  },

  // ---------------------------------------------------------------------
  // Paper Tigers — pop, mostly uplifting
  // ---------------------------------------------------------------------
  {
    artist: 'Paper Tigers',
    title: 'Glow Stick Sky',
    genre: 'Pop',
    year: 2017,
    lyrics:
      'Happy hearts dance under bright sky, sunshine pours through the joyful crowd! ' +
      'Love is sweet, beautiful days surround us, every smile feels amazing and free. ' +
      'Wonderful moments, alive together under the bright stars!',
  },
  {
    artist: 'Paper Tigers',
    title: 'Comet Trail',
    genre: 'Pop',
    year: 2019,
    lyrics:
      'Hope climbs higher than the comet trail, faith believes the dream is close. ' +
      'Dreams soar across the wide bright sky, light returns where shadows once stayed. ' +
      'Believe again, the future feels alive and beautiful tonight.',
  },
  {
    artist: 'Paper Tigers',
    title: 'Sapphire Shore',
    genre: 'Pop',
    year: 2021,
    lyrics:
      'Calm waves wash the gentle shore, peace flows through the quiet golden hour. ' +
      'Soft wind whispers, tender stillness surrounds the slow horizon. ' +
      'Stars rise gentle, the world rests in peaceful sapphire light.',
  },

  // ---------------------------------------------------------------------
  // Ironwood Choir — rock, mostly somber / hopeful
  // ---------------------------------------------------------------------
  {
    artist: 'Ironwood Choir',
    title: 'Cathedral Smoke',
    genre: 'Rock',
    year: 2013,
    lyrics:
      'Cold pain follows the broken night, lonely tears fall through the empty hall. ' +
      'Sorrow walks the heavy floor, lost dreams haunt the silent stage. ' +
      'Sad echoes whisper what we cannot find, the dark stays close.',
  },
  {
    artist: 'Ironwood Choir',
    title: 'Bright Anchor',
    genre: 'Rock',
    year: 2016,
    lyrics:
      'Rise up, climb high, victory waits beyond the struggle ahead! ' +
      'Strong hope pushes us forward, we believe and triumph through the fight. ' +
      'Faith burns bright, we are alive and powerful tonight!',
  },
  {
    artist: 'Ironwood Choir',
    title: 'Storm Window',
    genre: 'Rock',
    year: 2019,
    lyrics:
      'Anger rises like a burning storm, fury shakes the loud night! ' +
      'Fight the rage, scream the chorus, battle drums pound through the wild dark. ' +
      'We move fast and break the walls down with thunder!',
  },
  {
    artist: 'Ironwood Choir',
    title: 'Open Pages',
    genre: 'Rock',
    year: 2022,
    lyrics:
      'Quiet thoughts on a calm afternoon, the world slows to listen with me. ' +
      'Peace settles soft across the patient room, gentle stillness in the fading light. ' +
      'Calm reflection, tender silence speaks louder than the loud.',
  },

  // ---------------------------------------------------------------------
  // Static Bloom — electronic, mixed
  // ---------------------------------------------------------------------
  {
    artist: 'Static Bloom',
    title: 'Neon Ghost',
    genre: 'Electronic',
    year: 2017,
    lyrics:
      'Lonely signals drift through the empty grid, missing you across the cold night. ' +
      'Memories loop, tears fall soft on the dark screen, broken signals fade slowly. ' +
      'Sorrow echoes through the quiet machine, distant and cold.',
  },
  {
    artist: 'Static Bloom',
    title: 'Strobe Garden',
    genre: 'Electronic',
    year: 2019,
    lyrics:
      'Dance wild tonight, the loud bass shakes the floor with crazy energy! ' +
      'Move fast, jump high, the strobe lights pump bright through the joyful crowd! ' +
      'Celebrate tonight, the beat explodes into wonderful chaos!',
  },
  {
    artist: 'Static Bloom',
    title: 'Crystal Drift',
    genre: 'Electronic',
    year: 2021,
    lyrics:
      'Float gentle through the dreamy sky, soft synths drift across the calm clouds. ' +
      'Tender stars guide us slow, peaceful waves carry us through the still night. ' +
      'Dreamy peace, the world breathes softly with us.',
  },

  // ---------------------------------------------------------------------
  // Marble Coast — folk, mostly hopeful / nostalgic
  // ---------------------------------------------------------------------
  {
    artist: 'Marble Coast',
    title: 'Yellow Pages',
    genre: 'Folk',
    year: 2014,
    lyrics:
      'Hope rises slow through the patient morning, faith believes the storm will pass. ' +
      'Dreams stretch wide across the field, light returns where shadows fade away. ' +
      'Believe in better, tomorrow shines through every quiet doubt.',
  },
  {
    artist: 'Marble Coast',
    title: 'Old Photographs',
    genre: 'Folk',
    year: 2017,
    lyrics:
      'I remember days we used to laugh through the long quiet summer. ' +
      'Memories drift like soft autumn leaves, missing what we used to be. ' +
      'Time moves slow, nostalgia fills the patient evening with gentle warmth.',
  },
  {
    artist: 'Marble Coast',
    title: 'Riverbed',
    genre: 'Folk',
    year: 2020,
    lyrics:
      'Quiet rivers and mountain trees, the wind sings soft across the calm sky. ' +
      'Sun and moon trade gentle light, stars wait patient through the still evening. ' +
      'Nature breathes a quiet song of peace.',
  },

  // ---------------------------------------------------------------------
  // Halftone Wolves — hip-hop, mostly empowering / aggressive
  // ---------------------------------------------------------------------
  {
    artist: 'Halftone Wolves',
    title: 'Iron Bloom',
    genre: 'Hip-Hop',
    year: 2018,
    lyrics:
      'We rise strong from the concrete dust, climb the broken stairs to victory! ' +
      'Power moves, the triumph waits, we believe we can overcome the storm. ' +
      'Fight the struggle, survive the night, we run faster than the dark!',
  },
  {
    artist: 'Halftone Wolves',
    title: 'Smoke Crown',
    genre: 'Hip-Hop',
    year: 2020,
    lyrics:
      'Rage burns through the angry crowd, fury shakes the loud street tonight! ' +
      'Battle drums pound louder, we scream until the walls break wide open. ' +
      'Wild fire, the night burns bright with thunder and rage!',
  },
  {
    artist: 'Halftone Wolves',
    title: 'Glass Confession',
    genre: 'Hip-Hop',
    year: 2023,
    lyrics:
      'Lonely on the cold empty block, missing the days we used to laugh. ' +
      'Broken bottles, forgotten faces, sorrow lives where the loud joy danced. ' +
      'Memories cry through the slow rain tonight.',
  },
];

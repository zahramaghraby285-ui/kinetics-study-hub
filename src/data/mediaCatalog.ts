export interface MediaItem {
  id: string;
  title: string;
  channel: string;
  duration: string;
  views: string;
  category: 'study' | 'quran' | 'podcasts' | 'lofi' | 'ambient' | 'lectures' | 'search';
  thumbnail: string;
  embedUrl?: string;
  openUrl?: string;
  spotifyEmbedUrl?: string;
}

export interface ChannelProfile {
  id: string;
  name: string;
  subtitle: string;
  searchQuery: string;
  thumbnail: string;
  bannerThumb: string;
}

export const FEATURED_CHANNELS: ChannelProfile[] = [
  {
    id: 'UCtU4a32r3E1-RLHI72u_JbA',
    name: 'عمر بن ضياء الدين',
    subtitle: 'تلاوات قرآنية خاشعة تريح القلب',
    searchQuery: 'عمر بن ضياء الدين',
    thumbnail: '/api/yt-thumb/z23pnK_-0og',
    bannerThumb: '/api/yt-thumb/1lYvrd68JwE',
  },
  {
    id: 'UC2qcjzOEX3lxE73cyroWdiw',
    name: 'وعي',
    subtitle: 'بودكاست وعي · أحمد عامر وحازم الصديق وشريف علي',
    searchQuery: 'وعي',
    thumbnail: '/api/yt-thumb/RhTxjl_W_BM',
    bannerThumb: '/api/yt-thumb/j5qOrqnDHyw',
  },
  {
    id: 'UCah56qawts736uNxZA3inLQ',
    name: 'أحمد عامر',
    subtitle: 'السيرة النبوية والقصص القرآني',
    searchQuery: 'أحمد عامر',
    thumbnail: '/api/yt-thumb/LI99lWP1zac',
    bannerThumb: '/api/yt-thumb/A6_y0HuwSQw',
  },
  {
    id: 'UCSJ4gkVC6NrvII8umztf0Ow',
    name: 'Lofi Girl',
    subtitle: 'Chill beats to relax & study to',
    searchQuery: 'Lofi Girl',
    thumbnail: '/api/yt-thumb/lTRiuFIWV54',
    bannerThumb: '/api/yt-thumb/n61ULEU7CO0',
  },
  {
    id: 'UC5CRP-6oxYenIgBj17CkBZg',
    name: 'Study With Me',
    subtitle: 'Pomodoro 50/10 & Calm Desk Sessions',
    searchQuery: 'Study With Me',
    thumbnail: '/api/yt-thumb/IdjDjxNn9ws',
    bannerThumb: '/api/yt-thumb/74cOUSKXMz0',
  },
  {
    id: 'UChyRMEp8zRio9nFnAjvzSnA',
    name: 'Cozy Rain & Ambience',
    subtitle: 'Rain sounds, fireplace & quiet library',
    searchQuery: 'Cozy Rain',
    thumbnail: '/api/yt-thumb/mPZkdNFkNps',
    bannerThumb: '/api/yt-thumb/Jvgx5HHJ0qw',
  },
  {
    id: 'UCYO_jab_esuFRV4b17AJtAw',
    name: '3Blue1Brown',
    subtitle: 'Visual Math & Deep Learning Lectures',
    searchQuery: '3Blue1Brown',
    thumbnail: '/api/yt-thumb/aircAruvnKk',
    bannerThumb: '/api/yt-thumb/8mAITcNt710',
  },
  {
    id: 'UCcabW7890RKJzL968QWEykA',
    name: 'Harvard CS50',
    subtitle: 'Computer Science University Lectures',
    searchQuery: 'CS50',
    thumbnail: '/api/yt-thumb/8mAITcNt710',
    bannerThumb: '/api/yt-thumb/aircAruvnKk',
  },
];

export const CATEGORIES = [
  { id: 'all', label: 'All' },
  { id: 'channels', label: 'Channels' },
  { id: 'quran', label: 'Quran' },
  { id: 'podcasts', label: 'Podcasts' },
  { id: 'study', label: 'Study' },
  { id: 'lofi', label: 'Lo-Fi' },
  { id: 'ambient', label: 'Rain' },
];

export const SPOTIFY_CATEGORIES = [
  { id: 'all', label: 'All' },
  { id: 'channels', label: 'Channels' },
  { id: 'quran', label: 'القرآن · عمر بن ضياء الدين' },
  { id: 'lofi', label: 'Lo-Fi' },
  { id: 'ambient', label: 'Rain & Piano' },
  { id: 'podcasts', label: 'Podcasts' },
];

// Every single item uses our same-origin /api/yt-thumb/<ID> endpoint so the video photo is 100% guaranteed to load!
export const HOME_MEDIA_ITEMS: MediaItem[] = [
  // عمر بن ضياء الدين & Quran Recitations
  {
    id: 'z23pnK_-0og',
    title: 'سورة البقرة كاملة · عمر بن ضياء الدين',
    channel: 'عمر بن ضياء الدين',
    duration: '2:05:50',
    views: '5.1M',
    category: 'quran',
    thumbnail: '/api/yt-thumb/z23pnK_-0og',
  },
  {
    id: '1lYvrd68JwE',
    title: 'سورة يوسف كاملة · عمر بن ضياء الدين',
    channel: 'عمر بن ضياء الدين',
    duration: '44:28',
    views: '5.1M',
    category: 'quran',
    thumbnail: '/api/yt-thumb/1lYvrd68JwE',
  },
  {
    id: 'Z4RGvJN1G9I',
    title: 'سورة يونس كاملة · عمر بن ضياء الدين',
    channel: 'عمر بن ضياء الدين',
    duration: '37:28',
    views: '506K',
    category: 'quran',
    thumbnail: '/api/yt-thumb/Z4RGvJN1G9I',
  },
  {
    id: 'Kw1gIMN_-8o',
    title: 'تلاوة هادئة تريح القلب · عمر بن ضياء الدين',
    channel: 'عمر بن ضياء الدين',
    duration: '1:46:44',
    views: '1.7M',
    category: 'quran',
    thumbnail: '/api/yt-thumb/Kw1gIMN_-8o',
  },

  // Podcasts (وعي & السيرة النبوية)
  {
    id: 'RhTxjl_W_BM',
    title: 'وعي · الحلقة الأولى',
    channel: 'بودكاست وعي',
    duration: '1:18:40',
    views: '3.1M',
    category: 'podcasts',
    thumbnail: '/api/yt-thumb/RhTxjl_W_BM',
  },
  {
    id: 'j5qOrqnDHyw',
    title: 'وعي · سلسلة الصحابة',
    channel: 'بودكاست وعي',
    duration: '1:42:15',
    views: '2.7M',
    category: 'podcasts',
    thumbnail: '/api/yt-thumb/j5qOrqnDHyw',
  },
  {
    id: 'tCPIDI1T544',
    title: 'وعي · أهمية القلب',
    channel: 'بودكاست وعي',
    duration: '1:29:10',
    views: '1.9M',
    category: 'podcasts',
    thumbnail: '/api/yt-thumb/tCPIDI1T544',
  },
  {
    id: 'ZGyswgp9Kc8',
    title: 'وعي · التدين والالتزام',
    channel: 'بودكاست وعي',
    duration: '1:34:50',
    views: '1.5M',
    category: 'podcasts',
    thumbnail: '/api/yt-thumb/ZGyswgp9Kc8',
  },
  {
    id: 'LI99lWP1zac',
    title: 'السيرة النبوية · العالم قبل الإسلام',
    channel: 'أحمد عامر',
    duration: '54:12',
    views: '4.2M',
    category: 'podcasts',
    thumbnail: '/api/yt-thumb/LI99lWP1zac',
  },
  {
    id: 'A6_y0HuwSQw',
    title: 'السيرة النبوية · مولد النبي وشبابه',
    channel: 'أحمد عامر',
    duration: '48:35',
    views: '3.6M',
    category: 'podcasts',
    thumbnail: '/api/yt-thumb/A6_y0HuwSQw',
  },
  {
    id: '6SiKw-qQ6mk',
    title: 'السيرة النبوية · نزول الوحي',
    channel: 'أحمد عامر',
    duration: '52:19',
    views: '2.9M',
    category: 'podcasts',
    thumbnail: '/api/yt-thumb/6SiKw-qQ6mk',
  },
  {
    id: '3rzbyI2_cvc',
    title: 'السيرة النبوية · بداية العهد المدني',
    channel: 'أحمد عامر',
    duration: '1:04:08',
    views: '2.1M',
    category: 'podcasts',
    thumbnail: '/api/yt-thumb/3rzbyI2_cvc',
  },

  // Study With Me
  {
    id: '74cOUSKXMz0',
    title: '3-Hour Study With Me · Pomodoro',
    channel: 'Study Focus',
    duration: '2:51:43',
    views: '3.1M',
    category: 'study',
    thumbnail: '/api/yt-thumb/74cOUSKXMz0',
  },
  {
    id: 'IdjDjxNn9ws',
    title: '4-Hour Sunset Study With Me',
    channel: 'Celine',
    duration: '4:00:08',
    views: '2.6M',
    category: 'study',
    thumbnail: '/api/yt-thumb/IdjDjxNn9ws',
  },
  {
    id: 'OS8lnKZdJYc',
    title: '2-Hour Calm Lofi Study With Me',
    channel: 'Autumn Desk',
    duration: '2:01:27',
    views: '1.9M',
    category: 'study',
    thumbnail: '/api/yt-thumb/OS8lnKZdJYc',
  },
  {
    id: 'VJhd3hvsMTo',
    title: '50/10 Pomodoro Study Session',
    channel: 'Focus Hub',
    duration: '3:00:17',
    views: '1.4M',
    category: 'study',
    thumbnail: '/api/yt-thumb/VJhd3hvsMTo',
  },

  // Lo-Fi
  {
    id: 'lTRiuFIWV54',
    title: '1 A.M Study Session · Lofi Beats',
    channel: 'Lofi Girl',
    duration: '1:01:14',
    views: '112M',
    category: 'lofi',
    thumbnail: '/api/yt-thumb/lTRiuFIWV54',
  },
  {
    id: 'n61ULEU7CO0',
    title: 'Best of Lofi Hip Hop Mix',
    channel: 'Lofi Girl',
    duration: '6:10:58',
    views: '34M',
    category: 'lofi',
    thumbnail: '/api/yt-thumb/n61ULEU7CO0',
  },
  {
    id: 'CFGLoQIhmow',
    title: 'Chill Study Beats Mix',
    channel: 'Lofi Girl',
    duration: '2:50:41',
    views: '18M',
    category: 'lofi',
    thumbnail: '/api/yt-thumb/CFGLoQIhmow',
  },
  {
    id: '-FlxM_0S2lA',
    title: '2-Hour Lofi Focus Session',
    channel: 'Lofi Girl',
    duration: '1:53:37',
    views: '22M',
    category: 'lofi',
    thumbnail: '/api/yt-thumb/FlxM_0S2lA'.replace('FlxM_0S2lA', '-FlxM_0S2lA'),
  },

  // Rain & Ambient
  {
    id: 'mPZkdNFkNps',
    title: 'Rain on Window · Deep Focus',
    channel: 'Ambience',
    duration: '8:00:14',
    views: '14M',
    category: 'ambient',
    thumbnail: '/api/yt-thumb/mPZkdNFkNps',
  },
  {
    id: 'Jvgx5HHJ0qw',
    title: 'Rooftop Study Room & Rain',
    channel: 'Chill Room',
    duration: '3:00:01',
    views: '3.2M',
    category: 'ambient',
    thumbnail: '/api/yt-thumb/Jvgx5HHJ0qw',
  },
  {
    id: 'AaMm5kZ3cRw',
    title: 'Cozy Cabin Rain & Fireplace',
    channel: 'Cozy Sounds',
    duration: '3:01:01',
    views: '2.8M',
    category: 'ambient',
    thumbnail: '/api/yt-thumb/AaMm5kZ3cRw',
  },
  {
    id: 'yIQd2Ya0Ziw',
    title: 'Night Rainstorm for Reading',
    channel: 'Nature Focus',
    duration: '8:00:00',
    views: '9.4M',
    category: 'ambient',
    thumbnail: '/api/yt-thumb/yIQd2Ya0Ziw',
  },
];

// Spotify & Audio Box items — every item has a real photo thumbnail via /api/yt-thumb/
export const SPOTIFY_HOME_ITEMS: MediaItem[] = [
  {
    id: 'z23pnK_-0og',
    title: 'سورة البقرة · عمر بن ضياء الدين',
    channel: 'عمر بن ضياء الدين',
    duration: '2:05:50',
    views: 'Audio & Video',
    category: 'quran',
    thumbnail: '/api/yt-thumb/z23pnK_-0og',
  },
  {
    id: '1lYvrd68JwE',
    title: 'سورة يوسف · عمر بن ضياء الدين',
    channel: 'عمر بن ضياء الدين',
    duration: '44:28',
    views: 'Audio & Video',
    category: 'quran',
    thumbnail: '/api/yt-thumb/1lYvrd68JwE',
  },
  {
    id: 'Z4RGvJN1G9I',
    title: 'سورة يونس · عمر بن ضياء الدين',
    channel: 'عمر بن ضياء الدين',
    duration: '37:28',
    views: 'Audio & Video',
    category: 'quran',
    thumbnail: '/api/yt-thumb/Z4RGvJN1G9I',
  },
  {
    id: 'Kw1gIMN_-8o',
    title: 'تلاوة هادئة · عمر بن ضياء الدين',
    channel: 'عمر بن ضياء الدين',
    duration: '1:46:44',
    views: 'Audio & Video',
    category: 'quran',
    thumbnail: '/api/yt-thumb/Kw1gIMN_-8o',
  },
  {
    id: 'sp-lofi-beats',
    title: 'Spotify · Lo-Fi Beats',
    channel: 'Spotify Playlist',
    duration: 'PLAYLIST',
    views: 'Spotify',
    category: 'lofi',
    thumbnail: '/api/yt-thumb/lTRiuFIWV54',
    spotifyEmbedUrl: 'https://open.spotify.com/embed/playlist/37i9dQZF1DWWQRwui0ExPn?utm_source=generator&theme=0',
    openUrl: 'https://open.spotify.com/playlist/37i9dQZF1DWWQRwui0ExPn',
  },
  {
    id: 'sp-deep-focus',
    title: 'Spotify · Deep Focus',
    channel: 'Spotify Playlist',
    duration: 'PLAYLIST',
    views: 'Spotify',
    category: 'ambient',
    thumbnail: '/api/yt-thumb/Jvgx5HHJ0qw',
    spotifyEmbedUrl: 'https://open.spotify.com/embed/playlist/37i9dQZF1DWZeKCadgRdKQ?utm_source=generator&theme=0',
    openUrl: 'https://open.spotify.com/playlist/37i9dQZF1DWZeKCadgRdKQ',
  },
  {
    id: 'sp-peaceful-piano',
    title: 'Spotify · Peaceful Piano',
    channel: 'Spotify Playlist',
    duration: 'PLAYLIST',
    views: 'Spotify',
    category: 'ambient',
    thumbnail: '/api/yt-thumb/IdjDjxNn9ws',
    spotifyEmbedUrl: 'https://open.spotify.com/embed/playlist/37i9dQZF1DX4sWSpwq3LiO?utm_source=generator&theme=0',
    openUrl: 'https://open.spotify.com/playlist/37i9dQZF1DX4sWSpwq3LiO',
  },
  {
    id: 'sp-night-rain',
    title: 'Spotify · Night Rain',
    channel: 'Spotify Playlist',
    duration: 'PLAYLIST',
    views: 'Spotify',
    category: 'ambient',
    thumbnail: '/api/yt-thumb/mPZkdNFkNps',
    spotifyEmbedUrl: 'https://open.spotify.com/embed/playlist/37i9dQZF1DXbcPC6Vvqudd?utm_source=generator&theme=0',
    openUrl: 'https://open.spotify.com/playlist/37i9dQZF1DXbcPC6Vvqudd',
  },
  {
    id: 'RhTxjl_W_BM',
    title: 'وعي · الحلقة الأولى',
    channel: 'بودكاست وعي',
    duration: '1:18:40',
    views: 'Podcast',
    category: 'podcasts',
    thumbnail: '/api/yt-thumb/RhTxjl_W_BM',
  },
  {
    id: 'LI99lWP1zac',
    title: 'السيرة النبوية · أحمد عامر',
    channel: 'أحمد عامر',
    duration: '54:12',
    views: 'Podcast',
    category: 'podcasts',
    thumbnail: '/api/yt-thumb/LI99lWP1zac',
  },
];

import React, { useState, useEffect, useRef } from 'react';
import {
  Home,
  Search,
  Play,
  ExternalLink,
  Tv,
  RotateCcw,
  ArrowRight,
  Clock,
  ArrowLeft,
  Users,
  ListVideo,
  Radio,
  ArrowUpDown,
  Link2,
  Check,
} from 'lucide-react';
import {
  CATEGORIES,
  HOME_MEDIA_ITEMS,
  FEATURED_CHANNELS,
  MediaItem,
  ChannelProfile,
} from '../data/mediaCatalog';

export interface WatchHistoryEntry {
  video: MediaItem;
  stoppedAtSeconds: number;
  lastWatchedAt: number;
}

export interface ChannelPlaylistItem {
  id: string;
  title: string;
  countText: string;
  thumbnail: string;
}

export interface MediaBoxState {
  pageName: string;
  isSpotifyBox?: boolean;
  mode: 'home' | 'watch';
  category: string;
  searchQuery: string;
  activeVideo: MediaItem | null;
  history: Record<string, WatchHistoryEntry>;
  savedChannels?: Record<string, ChannelProfile>;
}

export interface FourBoxesConfig {
  yt1: MediaBoxState;
  yt2: MediaBoxState;
  yt3: MediaBoxState;
  spotify: MediaBoxState;
}

interface SuiteProps {
  boxes: FourBoxesConfig;
  setBoxes: React.Dispatch<React.SetStateAction<FourBoxesConfig>>;
}

function formatResumeTime(seconds: number): string {
  const s = Math.max(0, Math.floor(seconds));
  const hrs = Math.floor(s / 3600);
  const mins = Math.floor((s % 3600) / 60);
  const secs = s % 60;
  if (hrs > 0) {
    return `${hrs}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  }
  return `${mins}:${String(secs).padStart(2, '0')}`;
}

interface SingleBoxProps {
  boxId: string;
  state: MediaBoxState;
  onUpdate: (patch: Partial<MediaBoxState>) => void;
}

const KineticsMediaBox: React.FC<SingleBoxProps> = ({
  boxId,
  state,
  onUpdate,
}) => {
  const [liveResults, setLiveResults] = useState<MediaItem[] | null>(null);
  const [liveChannels, setLiveChannels] = useState<ChannelProfile[]>([]);
  const [loadingSearch, setLoadingSearch] = useState(false);
  const [searchFocused, setSearchFocused] = useState(false);
  const [textSuggestions, setTextSuggestions] = useState<string[]>([]);
  const [videoSuggestions, setVideoSuggestions] = useState<MediaItem[]>([]);
  const [channelSuggestions, setChannelSuggestions] = useState<ChannelProfile[]>([]);

  // Complete Channel State: All Uploads, Live Streams, Playlists, and Oldest-First ("From the Start") Sort
  const [activeChannel, setActiveChannel] = useState<{
    id: string;
    name: string;
    subtitle: string;
    thumbnail: string;
  } | null>(null);
  const [channelUploads, setChannelUploads] = useState<MediaItem[]>([]);
  const [channelStreams, setChannelStreams] = useState<MediaItem[]>([]);
  const [channelPlaylists, setChannelPlaylists] = useState<ChannelPlaylistItem[]>([]);
  const [channelSubTab, setChannelSubTab] = useState<'videos' | 'playlists' | 'lives'>('videos');
  const [channelSortOrder, setChannelSortOrder] = useState<'from-start' | 'newest'>('from-start');
  const [activePlaylist, setActivePlaylist] = useState<{
    id: string;
    title: string;
    items: MediaItem[];
  } | null>(null);
  const [copiedVideoId, setCopiedVideoId] = useState<string | null>(null);

  const copyVideoLink = (e: React.MouseEvent, video: MediaItem) => {
    e.stopPropagation();
    const url = video.openUrl || `https://www.youtube.com/watch?v=${video.id}`;
    navigator.clipboard?.writeText(url).catch(() => {});
    setCopiedVideoId(video.id);
    window.setTimeout(() => {
      setCopiedVideoId((prev) => (prev === video.id ? null : prev));
    }, 1500);
  };

  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  const watchStartWallRef = useRef<number | null>(null);
  const baseResumeSecondsRef = useRef<number>(
    state.activeVideo?.id && state.history?.[state.activeVideo.id]
      ? state.history[state.activeVideo.id].stoppedAtSeconds
      : 0
  );
  const realPlayerTimeRef = useRef<number>(0);

  const [startOffsetSeconds, setStartOffsetSeconds] = useState<number>(() => {
    const activeId = state.activeVideo?.id;
    return activeId && state.history?.[activeId] ? state.history[activeId].stoppedAtSeconds : 0;
  });

  // Listen to real-time YouTube IFrame API postMessage events for exact currentTime tracking
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (!iframeRef.current || event.source !== iframeRef.current.contentWindow) return;
      if (typeof event.data !== 'string') return;
      try {
        const data = JSON.parse(event.data);
        if (
          data?.event === 'infoDelivery' &&
          typeof data?.info?.currentTime === 'number' &&
          data.info.currentTime > 0
        ) {
          realPlayerTimeRef.current = Math.floor(data.info.currentTime);
        }
      } catch {
        // ignore non-JSON messages
      }
    };
    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, []);

  // Subscribe iframe to YouTube API events & control play/pause without reloading
  useEffect(() => {
    if (state.mode === 'watch' && state.activeVideo) {
      watchStartWallRef.current = Date.now();
      try {
        iframeRef.current?.contentWindow?.postMessage(
          JSON.stringify({ event: 'listening', id: boxId }),
          '*'
        );
        iframeRef.current?.contentWindow?.postMessage(
          JSON.stringify({ event: 'command', func: 'playVideo', args: [] }),
          '*'
        );
      } catch {
        // ignore
      }
    } else if (state.mode === 'home') {
      try {
        iframeRef.current?.contentWindow?.postMessage(
          JSON.stringify({ event: 'command', func: 'pauseVideo', args: [] }),
          '*'
        );
      } catch {
        // ignore
      }
    }
  }, [state.mode, state.activeVideo?.id, boxId]);

  // Periodically auto-save current video timestamp into history every 3 seconds while watching
  useEffect(() => {
    if (state.mode !== 'watch' || !state.activeVideo) return;
    const interval = window.setInterval(() => {
      const currentVideo = state.activeVideo;
      if (!currentVideo) return;
      const wallElapsed = watchStartWallRef.current
        ? Math.max(0, Math.floor((Date.now() - watchStartWallRef.current) / 1000))
        : 0;
      const computedTime =
        realPlayerTimeRef.current > 0
          ? realPlayerTimeRef.current
          : baseResumeSecondsRef.current + wallElapsed;

      if (computedTime > 0) {
        onUpdate({
          history: {
            ...(state.history || {}),
            [currentVideo.id]: {
              video: currentVideo,
              stoppedAtSeconds: computedTime,
              lastWatchedAt: Date.now(),
            },
          },
        });
      }
    }, 3000);
    return () => window.clearInterval(interval);
  }, [state.mode, state.activeVideo?.id, state.history]);

  // Live YouTube Recommendations + Channels + Video Thumbnails inside search bar
  useEffect(() => {
    const q = state.searchQuery.trim();
    if (!q) {
      setTextSuggestions([]);
      setVideoSuggestions([]);
      setChannelSuggestions([]);
      return;
    }

    const localChannels = FEATURED_CHANNELS.filter(
      (ch) =>
        ch.name.toLowerCase().includes(q.toLowerCase()) ||
        ch.subtitle.toLowerCase().includes(q.toLowerCase())
    );
    setChannelSuggestions(localChannels);

    const localMatches = HOME_MEDIA_ITEMS.filter(
      (v) =>
        v.title.toLowerCase().includes(q.toLowerCase()) ||
        v.channel.toLowerCase().includes(q.toLowerCase())
    );
    setVideoSuggestions(localMatches);

    const timer = window.setTimeout(async () => {
      try {
        const resp = await fetch(`/api/youtube-search?q=${encodeURIComponent(q)}`);
        const data = await resp.json();

        if (Array.isArray(data.suggestions)) {
          setTextSuggestions(data.suggestions);
        }

        if (Array.isArray(data.channels) && data.channels.length > 0) {
          setChannelSuggestions(data.channels);
        }

        if (Array.isArray(data.items) && data.items.length > 0) {
          const mapped: MediaItem[] = data.items.map((item: any) => ({
            id: item.id,
            title: item.title,
            channel: item.channel,
            duration: item.duration,
            views: item.views,
            category: 'search',
            thumbnail: item.thumbnail,
          }));
          setVideoSuggestions(mapped);
        }
      } catch {
        // keep local matches
      }
    }, 200);

    return () => window.clearTimeout(timer);
  }, [state.searchQuery]);

  const saveCurrentProgress = () => {
    const currentVideo = state.activeVideo;
    if (!currentVideo) return state.history || {};
    let elapsed = 0;
    if (state.mode === 'watch' && watchStartWallRef.current) {
      elapsed = Math.max(0, Math.floor((Date.now() - watchStartWallRef.current) / 1000));
    }
    const newStoppedAt =
      realPlayerTimeRef.current > 0
        ? realPlayerTimeRef.current
        : baseResumeSecondsRef.current + elapsed;

    baseResumeSecondsRef.current = newStoppedAt;
    watchStartWallRef.current = Date.now();

    return {
      ...(state.history || {}),
      [currentVideo.id]: {
        video: currentVideo,
        stoppedAtSeconds: newStoppedAt,
        lastWatchedAt: Date.now(),
      },
    };
  };

  // Open a YouTube Channel inside the box: fetches ALL published videos, ALL playlists, and ALL live streams!
  const openChannelInsideBox = async (
    channelName: string,
    subtitle = 'Channel Uploads',
    thumb = '/api/yt-thumb/z23pnK_-0og',
    queryOverride?: string,
    channelId = ''
  ) => {
    const updatedHistory = saveCurrentProgress();
    try {
      iframeRef.current?.contentWindow?.postMessage(
        JSON.stringify({ event: 'command', func: 'pauseVideo', args: [] }),
        '*'
      );
    } catch {
      // ignore
    }

    setSearchFocused(false);
    setActivePlaylist(null);
    setChannelSubTab('videos');
    setChannelSortOrder('from-start');
    setActiveChannel({
      id: channelId,
      name: channelName,
      subtitle,
      thumbnail: thumb,
    });
    setLoadingSearch(true);

    const newChannelProfile: ChannelProfile = {
      id: channelId || `ch-${channelName}`,
      name: channelName,
      subtitle: subtitle || 'Watched / Searched Channel',
      searchQuery: queryOverride || channelName,
      thumbnail: thumb,
      bannerThumb: thumb,
    };
    const nextSavedChannels = {
      ...(state.savedChannels || {}),
      [channelName.toLowerCase()]: newChannelProfile,
    };
    onUpdate({ mode: 'home', history: updatedHistory, savedChannels: nextSavedChannels });

    try {
      const q = queryOverride || channelName;
      const resp = await fetch(
        `/api/youtube-channel?id=${encodeURIComponent(channelId)}&name=${encodeURIComponent(q)}`
      );
      const data = await resp.json();
      const officialName = data.channelName || channelName;
      setActiveChannel((prev) => (prev ? { ...prev, name: officialName } : prev));

      const uploads: MediaItem[] = Array.isArray(data.items)
        ? data.items.map((item: any) => ({
            id: item.id,
            title: item.title,
            channel: officialName,
            duration: item.duration,
            views: item.views,
            category: 'search',
            thumbnail: item.thumbnail,
          }))
        : [];

      const streams: MediaItem[] = Array.isArray(data.streams)
        ? data.streams.map((item: any) => ({
            id: item.id,
            title: item.title,
            channel: officialName,
            duration: item.duration || 'LIVE',
            views: item.views,
            category: 'search',
            thumbnail: item.thumbnail,
          }))
        : [];

      const playlists: ChannelPlaylistItem[] = Array.isArray(data.playlists)
        ? data.playlists
        : [];

      setChannelUploads(uploads);
      setChannelStreams(streams);
      setChannelPlaylists(playlists);
    } catch {
      setChannelUploads([]);
      setChannelStreams([]);
      setChannelPlaylists([]);
    } finally {
      setLoadingSearch(false);
    }
  };

  // Open a Channel Playlist to view all its episodes from Episode 1
  const openPlaylistInsideChannel = async (pl: ChannelPlaylistItem) => {
    setLoadingSearch(true);
    setActivePlaylist({ id: pl.id, title: pl.title, items: [] });
    try {
      const resp = await fetch(
        `/api/youtube-playlist?list=${encodeURIComponent(pl.id)}&channel=${encodeURIComponent(
          activeChannel?.name || 'Channel'
        )}`
      );
      const data = await resp.json();
      const items: MediaItem[] = Array.isArray(data.items)
        ? data.items.map((item: any) => ({
            id: item.id,
            title: item.title,
            channel: activeChannel?.name || item.channel,
            duration: item.duration,
            views: item.views,
            category: 'search',
            thumbnail: item.thumbnail,
          }))
        : [];
      setActivePlaylist({
        id: pl.id,
        title: data.title || pl.title,
        items,
      });
    } catch {
      setActivePlaylist({ id: pl.id, title: pl.title, items: [] });
    } finally {
      setLoadingSearch(false);
    }
  };

  const switchToHome = () => {
    const updatedHistory = saveCurrentProgress();
    try {
      iframeRef.current?.contentWindow?.postMessage(
        JSON.stringify({ event: 'command', func: 'pauseVideo', args: [] }),
        '*'
      );
    } catch {
      // ignore
    }
    onUpdate({ mode: 'home', history: updatedHistory });
  };

  const resumeWatching = () => {
    watchStartWallRef.current = Date.now();
    try {
      iframeRef.current?.contentWindow?.postMessage(
        JSON.stringify({ event: 'command', func: 'playVideo', args: [] }),
        '*'
      );
    } catch {
      // ignore
    }
    onUpdate({ mode: 'watch' });
  };

  const selectItem = (video: MediaItem) => {
    const updatedHistory = saveCurrentProgress();
    const isSame = state.activeVideo?.id === video.id;

    // Automatically add this video's channel to the user's Channels page!
    const matchedFeatured = FEATURED_CHANNELS.find(
      (fc) =>
        fc.name.toLowerCase() === video.channel.toLowerCase() ||
        video.channel.toLowerCase().includes(fc.name.toLowerCase())
    );
    const channelEntry: ChannelProfile = matchedFeatured || {
      id: `ch-${video.channel}`,
      name: video.channel,
      subtitle: `From watched video: ${video.title}`,
      searchQuery: video.channel,
      thumbnail: video.thumbnail,
      bannerThumb: video.thumbnail,
    };
    const nextSavedChannels: Record<string, ChannelProfile> = {
      ...(state.savedChannels || {}),
      [channelEntry.name.toLowerCase()]: channelEntry,
    };

    if (isSame) {
      watchStartWallRef.current = Date.now();
      try {
        iframeRef.current?.contentWindow?.postMessage(
          JSON.stringify({ event: 'command', func: 'playVideo', args: [] }),
          '*'
        );
      } catch {
        // ignore
      }
      onUpdate({ mode: 'watch', history: updatedHistory, savedChannels: nextSavedChannels });
      setSearchFocused(false);
      return;
    }

    const savedSecs = updatedHistory[video.id]?.stoppedAtSeconds || 0;
    realPlayerTimeRef.current = savedSecs;
    baseResumeSecondsRef.current = savedSecs;
    watchStartWallRef.current = Date.now();
    setStartOffsetSeconds(savedSecs);

    onUpdate({
      activeVideo: video,
      mode: 'watch',
      savedChannels: nextSavedChannels,
      history: {
        ...updatedHistory,
        [video.id]: {
          video,
          stoppedAtSeconds: savedSecs,
          lastWatchedAt: Date.now(),
        },
      },
    });
    setSearchFocused(false);
  };

  const executeQuerySearch = async (queryText: string) => {
    setSearchFocused(false);
    const q = queryText.trim();
    if (!q) {
      setLiveResults(null);
      setLiveChannels([]);
      setActiveChannel(null);
      setActivePlaylist(null);
      switchToHome();
      return;
    }

    const updatedHistory = saveCurrentProgress();
    setActiveChannel(null);
    setActivePlaylist(null);
    setLoadingSearch(true);
    onUpdate({ searchQuery: q, mode: 'home', history: updatedHistory });

    try {
      const resp = await fetch(`/api/youtube-search?q=${encodeURIComponent(q)}`);
      const data = await resp.json();

      if (Array.isArray(data.channels) && data.channels.length > 0) {
        setLiveChannels(data.channels);
        const topChannel = data.channels[0];
        onUpdate({
          savedChannels: {
            ...(state.savedChannels || {}),
            [topChannel.name.toLowerCase()]: topChannel,
          },
        });
      } else {
        setLiveChannels([]);
      }

      if (Array.isArray(data.items) && data.items.length > 0) {
        setLiveResults(
          data.items.map((item: any) => ({
            id: item.id,
            title: item.title,
            channel: item.channel,
            duration: item.duration,
            views: item.views,
            category: 'search',
            thumbnail: item.thumbnail,
          }))
        );
      } else {
        setLiveResults([]);
      }
    } catch {
      setLiveResults(null);
    } finally {
      setLoadingSearch(false);
    }
  };

  const handleSearchSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await executeQuerySearch(state.searchQuery);
  };

  const clearSearchAndChannel = () => {
    setLiveResults(null);
    setLiveChannels([]);
    setActiveChannel(null);
    setActivePlaylist(null);
    setTextSuggestions([]);
    setVideoSuggestions([]);
    setChannelSuggestions([]);
    const updatedHistory = saveCurrentProgress();
    onUpdate({ mode: 'home', searchQuery: '', category: 'all', history: updatedHistory });
  };

  const historyList: WatchHistoryEntry[] = Object.values(state.history || {}).sort(
    (a, b) => b.lastWatchedAt - a.lastWatchedAt
  );

  // Determine which videos to show
  let displayedItems: MediaItem[] = [];
  if (activeChannel) {
    if (activePlaylist) {
      displayedItems = activePlaylist.items;
    } else if (channelSubTab === 'lives') {
      displayedItems = channelStreams;
    } else {
      // 'from-start' reverses the chronological uploads list so Episode 1 / First Upload is #1 at the top!
      displayedItems =
        channelSortOrder === 'from-start'
          ? [...channelUploads].reverse()
          : channelUploads;
    }
  } else if (liveResults !== null) {
    displayedItems = liveResults;
  } else if (state.category === 'history') {
    displayedItems = historyList.map((h) => h.video);
  } else {
    displayedItems = HOME_MEDIA_ITEMS.filter((v) => {
      const matchesCat = state.category === 'all' || v.category === state.category;
      const q = state.searchQuery.trim().toLowerCase();
      const matchesText =
        !q ||
        v.title.toLowerCase().includes(q) ||
        v.channel.toLowerCase().includes(q);
      return matchesCat && matchesText;
    });
  }

  // Build Channels Page list: Channels from videos the user watched + Channels the user searched for + Featured channels
  const watchedChannelsFromHistory: ChannelProfile[] = historyList.map((h) => {
    const matchedFeatured = FEATURED_CHANNELS.find(
      (fc) =>
        fc.name.toLowerCase() === h.video.channel.toLowerCase() ||
        h.video.channel.toLowerCase().includes(fc.name.toLowerCase())
    );
    return (
      matchedFeatured || {
        id: `hist-ch-${h.video.channel}`,
        name: h.video.channel,
        subtitle: `Watched: ${h.video.title}`,
        searchQuery: h.video.channel,
        thumbnail: h.video.thumbnail,
        bannerThumb: h.video.thumbnail,
      }
    );
  });

  const savedChannelsList: ChannelProfile[] = Object.values(state.savedChannels || {}).reverse();

  const combinedChannelsMap = new Map<string, ChannelProfile>();
  for (const ch of [
    ...liveChannels,
    ...watchedChannelsFromHistory,
    ...savedChannelsList,
    ...FEATURED_CHANNELS,
  ]) {
    const key = ch.name.trim().toLowerCase();
    if (key && !combinedChannelsMap.has(key)) {
      combinedChannelsMap.set(key, ch);
    }
  }
  const displayedChannels: ChannelProfile[] = Array.from(combinedChannelsMap.values());

  const activeWatchUrl = state.activeVideo
    ? state.activeVideo.openUrl || `https://www.youtube.com/watch?v=${state.activeVideo.id}`
    : 'https://www.youtube.com';

  const buildEmbedSrc = (video: MediaItem | null, startSecs: number) => {
    if (!video) return '';
    if (video.embedUrl) return `${video.embedUrl}&enablejsapi=1`;
    const startParam = startSecs > 1 ? `&start=${Math.floor(startSecs)}` : '';
    return `https://www.youtube.com/embed/${video.id}?autoplay=1&playsinline=1&rel=0&enablejsapi=1${startParam}`;
  };

  const activeEmbedSrc = buildEmbedSrc(state.activeVideo, startOffsetSeconds);

  return (
    <section id={boxId} className="kinetics-video-box" aria-label={state.pageName}>
      {/* Clean Toolbar */}
      <div className="kinetics-box-toolbar" style={{ position: 'relative', zIndex: 25 }}>
        <div className="web-browser-dots" aria-hidden="true">
          <i />
          <i />
          <i />
        </div>

        <span className="kinetics-box-badge">
          <Tv size={13} />
          {state.pageName}
        </span>

        <button
          type="button"
          className={`kinetics-pill-btn ${state.mode === 'home' && !activeChannel ? 'active' : ''}`}
          onClick={() => {
            setActiveChannel(null);
            setActivePlaylist(null);
            setLiveResults(null);
            setLiveChannels([]);
            switchToHome();
          }}
        >
          <Home size={13} />
          Home
        </button>

        {state.activeVideo && (
          <button
            type="button"
            className={`kinetics-pill-btn ${state.mode === 'watch' ? 'active' : ''}`}
            onClick={resumeWatching}
          >
            <Play size={12} fill="currentColor" />
            {state.mode === 'home' ? 'Resume' : 'Playing'}
          </button>
        )}

        {/* Search Bar with All YouTube Recommendations, Channels & Video Thumbnails */}
        <div className="kinetics-search-wrapper" style={{ flex: 1, minWidth: 0, position: 'relative' }}>
          <form className="kinetics-search-bar" onSubmit={handleSearchSubmit}>
            <Search size={14} color="#9d9d9d" />
            <input
              type="text"
              value={state.searchQuery}
              onFocus={() => setSearchFocused(true)}
              onBlur={() => window.setTimeout(() => setSearchFocused(false), 240)}
              onChange={(e) => {
                onUpdate({ searchQuery: e.target.value });
                setSearchFocused(true);
                if (!e.target.value.trim()) {
                  setLiveResults(null);
                  setLiveChannels([]);
                }
              }}
              placeholder="Search videos or channels (e.g. عمر بن ضياء الدين, وعي, Lofi Girl)…"
              aria-label={`Search ${state.pageName}`}
            />
            {(liveResults !== null || state.searchQuery || activeChannel) && (
              <button
                type="button"
                onClick={clearSearchAndChannel}
                className="kinetics-pill-btn"
                style={{ padding: '3px 7px', fontSize: '0.6rem' }}
                title="Clear"
              >
                <RotateCcw size={11} />
              </button>
            )}
            <button type="submit" className="kinetics-go-btn" aria-label="Search">
              <ArrowRight size={13} />
            </button>
          </form>

          {/* Full YouTube Search Recommendations Dropdown */}
          {searchFocused &&
            state.searchQuery.trim().length > 0 &&
            (textSuggestions.length > 0 ||
              channelSuggestions.length > 0 ||
              videoSuggestions.length > 0) && (
              <div className="search-thumbnail-dropdown">
                <div className="search-dropdown-list">
                  {/* 1. Official YouTube Search Text Recommendations */}
                  {textSuggestions.length > 0 && (
                    <div className="search-suggest-pills">
                      {textSuggestions.map((sug) => (
                        <button
                          key={sug}
                          type="button"
                          className="search-suggest-chip"
                          onMouseDown={(e) => {
                            e.preventDefault();
                            executeQuerySearch(sug);
                          }}
                        >
                          <Search size={11} />
                          {sug}
                        </button>
                      ))}
                    </div>
                  )}

                  {/* 2. Matching YouTube Channels */}
                  {channelSuggestions.slice(0, 8).map((ch) => (
                    <button
                      key={`ch-sug-${ch.id}`}
                      type="button"
                      className="search-dropdown-item channel-dropdown-row"
                      onMouseDown={(e) => {
                        e.preventDefault();
                        openChannelInsideBox(
                          ch.name,
                          ch.subtitle,
                          ch.thumbnail,
                          ch.searchQuery,
                          ch.id
                        );
                      }}
                    >
                      <div className="channel-avatar-circle">
                        <img src={ch.thumbnail} alt={ch.name} />
                      </div>
                      <div className="search-dropdown-meta">
                        <div className="search-dropdown-title">
                          <span style={{ color: '#ff8b91', marginRight: 6 }}>Channel ·</span>
                          {ch.name}
                        </div>
                        <div className="search-dropdown-sub">{ch.subtitle}</div>
                      </div>
                    </button>
                  ))}

                  {/* 3. Matching YouTube Videos with Left Thumbnails & Right Title */}
                  {videoSuggestions.map((item) => {
                    const savedProgress = state.history?.[item.id]?.stoppedAtSeconds || 0;
                    return (
                      <button
                        key={`sug-${item.id}`}
                        type="button"
                        className="search-dropdown-item"
                        onMouseDown={(e) => {
                          e.preventDefault();
                          selectItem(item);
                        }}
                      >
                        <div className="search-dropdown-thumb">
                          <img src={item.thumbnail} alt={item.title} />
                          <span>{item.duration}</span>
                        </div>
                        <div className="search-dropdown-meta">
                          <div className="search-dropdown-title">{item.title}</div>
                          <div className="search-dropdown-sub">
                            {item.channel}
                            {savedProgress > 0 && (
                              <strong style={{ color: '#ff8b91', marginLeft: 6 }}>
                                · Resume {formatResumeTime(savedProgress)}
                              </strong>
                            )}
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
        </div>
      </div>

      {/* Category Chips */}
      <div className="kinetics-chips-bar" role="tablist">
        {CATEGORIES.map((cat) => (
          <button
            key={cat.id}
            type="button"
            className={`choice-pill ${
              state.category === cat.id && !activeChannel ? 'selected' : ''
            }`}
            onClick={() => {
              const updatedHistory = saveCurrentProgress();
              setActiveChannel(null);
              setActivePlaylist(null);
              if (cat.id !== 'channels') {
                setLiveResults(null);
              }
              onUpdate({ category: cat.id, mode: 'home', history: updatedHistory });
            }}
          >
            {cat.label}
          </button>
        ))}
        {historyList.length > 0 && (
          <button
            type="button"
            className={`choice-pill ${
              state.category === 'history' && liveResults === null && !activeChannel ? 'selected' : ''
            }`}
            onClick={() => {
              const updatedHistory = saveCurrentProgress();
              setLiveResults(null);
              setActiveChannel(null);
              setActivePlaylist(null);
              onUpdate({ category: 'history', mode: 'home', history: updatedHistory });
            }}
          >
            History ({historyList.length})
          </button>
        )}
      </div>

      {/* Full-Page Size Viewport */}
      <div className="kinetics-box-frame">
        {/* Persistent Player (Never Unmounts on Home so it Never Restarts!) */}
        {state.activeVideo && (
          <div
            className="box-active-player"
            style={{
              display: state.mode === 'watch' ? 'flex' : 'none',
            }}
          >
            <iframe
              ref={iframeRef}
              src={activeEmbedSrc}
              title={state.activeVideo.title}
              onLoad={() => {
                try {
                  iframeRef.current?.contentWindow?.postMessage(
                    JSON.stringify({ event: 'listening', id: boxId }),
                    '*'
                  );
                } catch {
                  // ignore
                }
              }}
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
              allowFullScreen
            />
            <div className="player-return-bar">
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
                <span>
                  <strong>{state.activeVideo.title}</strong>
                </span>
                <button
                  type="button"
                  className="channel-inline-btn"
                  onClick={() =>
                    openChannelInsideBox(
                      state.activeVideo!.channel,
                      'Channel Uploads',
                      state.activeVideo!.thumbnail
                    )
                  }
                >
                  <Users size={11} />
                  {state.activeVideo.channel}
                </button>
              </div>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <button
                  type="button"
                  className="kinetics-pill-btn active"
                  onClick={switchToHome}
                >
                  <Home size={12} />
                  Home
                </button>
                <a
                  href={activeWatchUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="kinetics-pill-btn"
                  style={{ textDecoration: 'none' }}
                >
                  <ExternalLink size={12} />
                </a>
              </div>
            </div>
          </div>
        )}

        {/* Homepage / Channel Vertical Feed (1, 2, 3...) — Compact Video Photo on Left, Title on Right */}
        {state.mode === 'home' && (
          <div className="yt-homepage-container">
            {/* Resume Paused Video Bar */}
            {state.activeVideo && (
              <div className="resume-history-banner">
                <div className="resume-banner-left">
                  <div className="resume-banner-thumb">
                    <img src={state.activeVideo.thumbnail} alt={state.activeVideo.title} />
                  </div>
                  <div className="resume-banner-info">
                    <strong>{state.activeVideo.title}</strong>
                    <small>
                      {state.history?.[state.activeVideo.id]?.stoppedAtSeconds
                        ? `Paused at ${formatResumeTime(
                            state.history[state.activeVideo.id].stoppedAtSeconds
                          )}`
                        : 'Paused in background'}
                    </small>
                  </div>
                </div>
                <button
                  type="button"
                  className="kinetics-pill-btn active"
                  onClick={resumeWatching}
                >
                  <Play size={12} fill="currentColor" />
                  Resume
                </button>
              </div>
            )}

            {/* Active Channel Header Banner with Videos / Playlists / Lives Tabs & From-Start Sort */}
            {activeChannel && (
              <div className="channel-view-banner" style={{ flexWrap: 'wrap' }}>
                <div className="channel-view-left">
                  <div className="channel-avatar-large">
                    <img src={activeChannel.thumbnail} alt={activeChannel.name} />
                  </div>
                  <div>
                    <div className="eyebrow">Official Channel</div>
                    <h3>{activeChannel.name}</h3>
                    <small>
                      {channelUploads.length} Videos · {channelPlaylists.length} Playlists
                      {channelStreams.length > 0 ? ` · ${channelStreams.length} Lives` : ''}
                    </small>
                  </div>
                </div>

                {/* Channel Sub-Navigation: Videos | Playlists | Lives + Sort From Start */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 7, flexWrap: 'wrap' }}>
                  <button
                    type="button"
                    className={`kinetics-pill-btn ${
                      channelSubTab === 'videos' && !activePlaylist ? 'active' : ''
                    }`}
                    onClick={() => {
                      setActivePlaylist(null);
                      setChannelSubTab('videos');
                    }}
                  >
                    <Tv size={12} />
                    Videos ({channelUploads.length})
                  </button>

                  <button
                    type="button"
                    className={`kinetics-pill-btn ${
                      channelSubTab === 'playlists' || activePlaylist ? 'active' : ''
                    }`}
                    onClick={() => {
                      setActivePlaylist(null);
                      setChannelSubTab('playlists');
                    }}
                  >
                    <ListVideo size={12} />
                    Playlists ({channelPlaylists.length})
                  </button>

                  {channelStreams.length > 0 && (
                    <button
                      type="button"
                      className={`kinetics-pill-btn ${
                        channelSubTab === 'lives' && !activePlaylist ? 'active' : ''
                      }`}
                      onClick={() => {
                        setActivePlaylist(null);
                        setChannelSubTab('lives');
                      }}
                    >
                      <Radio size={12} />
                      Lives ({channelStreams.length})
                    </button>
                  )}

                  {channelSubTab === 'videos' && !activePlaylist && (
                    <button
                      type="button"
                      className="kinetics-pill-btn"
                      onClick={() =>
                        setChannelSortOrder((prev) =>
                          prev === 'from-start' ? 'newest' : 'from-start'
                        )
                      }
                      title="Toggle between From the Start (Oldest #1) and Newest First"
                    >
                      <ArrowUpDown size={12} />
                      {channelSortOrder === 'from-start' ? 'From the Start (1 → All)' : 'Newest First'}
                    </button>
                  )}

                  <button
                    type="button"
                    className="kinetics-pill-btn"
                    onClick={() => {
                      if (activePlaylist) {
                        setActivePlaylist(null);
                        setChannelSubTab('playlists');
                      } else {
                        setActiveChannel(null);
                        setLiveResults(null);
                      }
                    }}
                  >
                    <ArrowLeft size={13} />
                    {activePlaylist ? 'Playlists' : 'Back'}
                  </button>
                </div>
              </div>
            )}

            {/* Vertical 1-Column Feed */}
            {!activeChannel && state.category === 'channels' ? (
              <div className="yt-homepage-vertical-list">
                {displayedChannels.map((ch, idx) => (
                  <button
                    key={ch.id}
                    type="button"
                    className="channel-vertical-card"
                    onClick={() =>
                      openChannelInsideBox(
                        ch.name,
                        ch.subtitle,
                        ch.thumbnail,
                        ch.searchQuery,
                        ch.id
                      )
                    }
                  >
                    <span className="vertical-index-badge">{idx + 1}</span>
                    <div className="channel-avatar-xl">
                      <img src={ch.thumbnail} alt={ch.name} />
                    </div>
                    <div className="channel-vertical-info">
                      <div className="eyebrow">YouTube Channel</div>
                      <h3>{ch.name}</h3>
                      <p>{ch.subtitle}</p>
                    </div>
                    <span className="kinetics-pill-btn active">
                      Open Channel
                    </span>
                  </button>
                ))}
              </div>
            ) : activeChannel && channelSubTab === 'playlists' && !activePlaylist ? (
              /* Channel Playlists Vertical List (Left Thumbnail, Right Title) */
              <div className="yt-homepage-vertical-list">
                {loadingSearch ? (
                  <div
                    style={{
                      padding: '60px 16px',
                      textAlign: 'center',
                      color: '#9d9d9d',
                      fontSize: '0.85rem',
                    }}
                  >
                    Loading playlists…
                  </div>
                ) : channelPlaylists.length === 0 ? (
                  <div
                    style={{
                      padding: '50px 16px',
                      textAlign: 'center',
                      color: '#9d9d9d',
                      fontSize: '0.82rem',
                    }}
                  >
                    No playlists found on this channel.
                  </div>
                ) : (
                  channelPlaylists.map((pl, index) => (
                    <div key={pl.id} className="yt-vertical-row-card">
                      <button
                        type="button"
                        className="yt-row-thumb-btn"
                        onClick={() => openPlaylistInsideChannel(pl)}
                      >
                        <div className="yt-row-photo-box">
                          <img src={pl.thumbnail} alt={pl.title} />
                          <span className="yt-index-number">{index + 1}</span>
                          <span className="yt-time-tag">{pl.countText}</span>
                          <div className="yt-hover-overlay">
                            <span className="study-video-play">
                              <ListVideo size={18} />
                            </span>
                          </div>
                        </div>
                      </button>

                      <div className="yt-row-right-info">
                        <button
                          type="button"
                          className="yt-title-trigger"
                          onClick={() => openPlaylistInsideChannel(pl)}
                        >
                          <div className="yt-row-heading">{pl.title}</div>
                        </button>
                        <div className="yt-row-meta">
                          <span className="yt-views-label">
                            {activeChannel.name} · {pl.countText}
                          </span>
                        </div>
                        <div className="yt-row-actions">
                          <button
                            type="button"
                            className="kinetics-pill-btn active"
                            onClick={() => openPlaylistInsideChannel(pl)}
                          >
                            <ListVideo size={12} />
                            Open Playlist Episodes
                          </button>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            ) : (
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                {/* Quick Channel Strip pinned cleanly at the top */}
                {!activeChannel &&
                  (state.category === 'all' || liveChannels.length > 0) && (
                    <div className="channels-strip-row">
                      {displayedChannels.map((ch) => (
                        <button
                          key={ch.id}
                          type="button"
                          className="channel-strip-pill"
                          onClick={() =>
                            openChannelInsideBox(
                              ch.name,
                              ch.subtitle,
                              ch.thumbnail,
                              ch.searchQuery,
                              ch.id
                            )
                          }
                        >
                          <img src={ch.thumbnail} alt={ch.name} />
                          <span>{ch.name}</span>
                        </button>
                      ))}
                    </div>
                  )}

                {/* Horizontal Channel Playlists Bar pinned cleanly at top of Channel Videos tab */}
                {activeChannel &&
                  !activePlaylist &&
                  channelSubTab === 'videos' &&
                  channelPlaylists.length > 0 && (
                    <div className="channels-strip-row">
                      {channelPlaylists.map((pl) => (
                        <button
                          key={pl.id}
                          type="button"
                          className="channel-strip-pill"
                          onClick={() => openPlaylistInsideChannel(pl)}
                        >
                          <img src={pl.thumbnail} alt={pl.title} />
                          <span>
                            Playlist: {pl.title} ({pl.countText})
                          </span>
                        </button>
                      ))}
                    </div>
                  )}

                <div className="yt-homepage-vertical-list">

                {loadingSearch ? (
                  <div
                    style={{
                      padding: '60px 16px',
                      textAlign: 'center',
                      color: '#9d9d9d',
                      fontSize: '0.85rem',
                    }}
                  >
                    Loading all channel videos &amp; playlists…
                  </div>
                ) : displayedItems.length === 0 ? (
                  <div
                    style={{
                      padding: '50px 16px',
                      textAlign: 'center',
                      color: '#9d9d9d',
                      fontSize: '0.82rem',
                    }}
                  >
                    No videos in this view.
                  </div>
                ) : (
                  displayedItems.map((video, index) => {
                    const historyEntry = state.history?.[video.id];
                    const isCurrentlyLoaded = state.activeVideo?.id === video.id;
                    return (
                      <div
                        key={`${video.id}-${index}`}
                        className={`yt-vertical-row-card ${
                          isCurrentlyLoaded ? 'currently-paused' : ''
                        }`}
                      >
                        {/* Left Side: Compact 16:9 Video Photo Thumbnail */}
                        <button
                          type="button"
                          className="yt-row-thumb-btn"
                          onClick={() => selectItem(video)}
                        >
                          <div className="yt-row-photo-box">
                            <img
                              src={video.thumbnail}
                              alt={video.title}
                              onError={(e) => {
                                const target = e.currentTarget;
                                if (!target.src.includes('i.ytimg.com')) {
                                  target.src = `https://i.ytimg.com/vi/${video.id}/hqdefault.jpg`;
                                }
                              }}
                            />
                            <span className="yt-index-number">{index + 1}</span>
                            {historyEntry && historyEntry.stoppedAtSeconds > 0 && (
                              <span className="yt-resume-tag">
                                <Clock size={10} /> {formatResumeTime(historyEntry.stoppedAtSeconds)}
                              </span>
                            )}
                            <span
                              className={`yt-time-tag ${
                                video.duration === 'LIVE' ? 'live' : ''
                              }`}
                            >
                              {video.duration}
                            </span>
                            <div className="yt-hover-overlay">
                              <span className="study-video-play">
                                <Play size={16} fill="currentColor" />
                              </span>
                            </div>
                          </div>
                        </button>

                        {/* Right Side: Video Title, Channel Name & Watch/Resume Action */}
                        <div className="yt-row-right-info">
                          <button
                            type="button"
                            className="yt-title-trigger"
                            onClick={() => selectItem(video)}
                          >
                            <div className="yt-row-heading">{video.title}</div>
                          </button>

                          <div className="yt-row-meta">
                            <button
                              type="button"
                              className="yt-channel-trigger"
                              onClick={() =>
                                openChannelInsideBox(
                                  video.channel,
                                  `Videos uploaded by ${video.channel}`,
                                  video.thumbnail
                                )
                              }
                            >
                              <Users size={12} />
                              <span>{video.channel}</span>
                            </button>

                            {video.views && (
                              <span className="yt-views-label">{video.views}</span>
                            )}

                            <button
                              type="button"
                              className="tiny-copy-link-btn"
                              onClick={(e) => copyVideoLink(e, video)}
                              title="Copy video link"
                            >
                              {copiedVideoId === video.id ? (
                                <Check size={10} />
                              ) : (
                                <Link2 size={10} />
                              )}
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </section>
  );
};

export const FourMediaBoxesSuite: React.FC<SuiteProps> = ({ boxes, setBoxes }) => {
  const updateBox = (key: keyof FourBoxesConfig, patch: Partial<MediaBoxState>) => {
    setBoxes((prev) => ({
      ...prev,
      [key]: { ...prev[key], ...patch },
    }));
  };

  return (
    <main className="four-boxes-stack">
      <KineticsMediaBox
        boxId="page-cinema"
        state={boxes.yt1}
        onUpdate={(patch) => updateBox('yt1', patch)}
      />

      <KineticsMediaBox
        boxId="page-podcasts"
        state={boxes.yt2}
        onUpdate={(patch) => updateBox('yt2', patch)}
      />

      <KineticsMediaBox
        boxId="page-lounge"
        state={boxes.yt3}
        onUpdate={(patch) => updateBox('yt3', patch)}
      />

      <KineticsMediaBox
        boxId="page-spotify"
        state={boxes.spotify}
        onUpdate={(patch) => updateBox('spotify', patch)}
      />
    </main>
  );
};

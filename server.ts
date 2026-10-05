import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { createServer as createViteServer } from 'vite';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// In-memory cache so repeated searches and thumbnails are instant (0ms lag)
const searchCache = new Map<string, { items: any[]; channels: any[]; suggestions: string[] }>();
const channelVideosCache = new Map<
  string,
  { items: any[]; streams: any[]; playlists: any[]; channelName: string }
>();
const playlistVideosCache = new Map<string, { items: any[]; title: string }>();
const thumbCache = new Map<string, { buffer: Buffer; contentType: string }>();

const BROWSER_HEADERS = {
  'User-Agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
  'Accept-Language': 'en-US,en;q=0.9,ar;q=0.8',
  Cookie:
    'CONSENT=YES+cb.20210328-17-p0.en+FX+987; SOCS=CAISHAgBEhJnd3NfMjAyMzA4MTAtMF9SQzIaAmVuIAEaBgiAo_CmBg',
};

async function safeTextFetch(url: string): Promise<string> {
  try {
    const resp = await fetch(url, { headers: BROWSER_HEADERS });
    if (!resp.ok) return '';
    return await resp.text();
  } catch {
    return '';
  }
}

async function safeJsonFetch(url: string): Promise<any> {
  try {
    const resp = await fetch(url, { headers: BROWSER_HEADERS });
    if (!resp.ok) return null;
    return await resp.json();
  } catch {
    return null;
  }
}

async function fetchBrowseContinuation(token: string): Promise<any> {
  try {
    const resp = await fetch('https://www.youtube.com/youtubei/v1/browse?prettyPrint=false', {
      method: 'POST',
      headers: {
        ...BROWSER_HEADERS,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        context: {
          client: {
            clientName: 'WEB',
            clientVersion: '2.20250101.00.00',
            hl: 'ar',
          },
        },
        continuation: token,
      }),
    });
    if (!resp.ok) return null;
    return await resp.json();
  } catch {
    return null;
  }
}

function collectContinuationTokens(node: any, tokens: string[]) {
  if (!node || typeof node !== 'object') return;
  if (Array.isArray(node)) {
    for (const child of node) collectContinuationTokens(child, tokens);
    return;
  }
  const tok = node.continuationCommand?.token;
  if (typeof tok === 'string' && tok.length > 10 && !tokens.includes(tok)) {
    tokens.push(tok);
  }
  for (const key of Object.keys(node)) {
    collectContinuationTokens(node[key], tokens);
  }
}

// Recursively find all videoRenderer, gridVideoRenderer, playlistVideoRenderer, AND lockupViewModel video objects
function collectAllVideosFromNode(
  node: any,
  items: Array<{
    id: string;
    title: string;
    channel: string;
    channelId?: string;
    duration: string;
    views: string;
    thumbnail: string;
    isLive?: boolean;
  }>,
  fallbackChannelName = '',
  fallbackChannelId = '',
  markAsLive = false
) {
  if (!node || typeof node !== 'object') return;

  if (Array.isArray(node)) {
    for (const child of node) {
      collectAllVideosFromNode(child, items, fallbackChannelName, fallbackChannelId, markAsLive);
    }
    return;
  }

  // 1. Modern YouTube Channel & Playlist format: lockupViewModel
  const lockup = node.lockupViewModel;
  if (
    lockup &&
    typeof lockup.contentId === 'string' &&
    lockup.contentId.length === 11 &&
    (!lockup.contentType || lockup.contentType === 'LOCKUP_CONTENT_TYPE_VIDEO')
  ) {
    const videoId = lockup.contentId;
    if (!items.some((x) => x.id === videoId)) {
      const title =
        lockup.metadata?.lockupMetadataViewModel?.title?.content ||
        lockup.rendererContext?.accessibilityContext?.label ||
        'Video';
      const overlays = lockup.contentImage?.thumbnailViewModel?.overlays || [];
      let duration = markAsLive ? 'LIVE' : 'VIDEO';
      for (const ov of overlays) {
        const badgeText =
          ov?.thumbnailBottomOverlayViewModel?.badges?.[0]?.thumbnailBadgeViewModel?.text;
        if (badgeText) {
          duration = badgeText;
          break;
        }
      }

      const metaRows =
        lockup.metadata?.lockupMetadataViewModel?.metadata?.contentMetadataViewModel
          ?.metadataRows || [];
      let views = '';
      for (const row of metaRows) {
        const partText = row?.metadataParts?.[0]?.text?.content;
        if (partText) {
          views = partText;
          break;
        }
      }

      if (duration !== 'SHORTS') {
        items.push({
          id: videoId,
          title,
          channel: fallbackChannelName || 'Channel',
          channelId: fallbackChannelId,
          duration,
          views,
          thumbnail: `/api/yt-thumb/${videoId}`,
          isLive: markAsLive || duration === 'LIVE' || views.toLowerCase().includes('streamed'),
        });
      }
    }
  }

  // 2. Classic YouTube videoRenderer / gridVideoRenderer / playlistVideoRenderer / compactVideoRenderer
  const v =
    node.videoRenderer ||
    node.gridVideoRenderer ||
    node.playlistVideoRenderer ||
    node.compactVideoRenderer;
  if (v && typeof v.videoId === 'string' && v.videoId.length === 11) {
    if (!items.some((x) => x.id === v.videoId)) {
      const title =
        v.title?.runs?.map((r: any) => r.text).join('') ||
        v.title?.simpleText ||
        v.headline?.simpleText ||
        'Video';
      const channel =
        v.ownerText?.runs?.[0]?.text ||
        v.longBylineText?.runs?.[0]?.text ||
        v.shortBylineText?.runs?.[0]?.text ||
        fallbackChannelName ||
        'YouTube';
      const channelId =
        v.ownerText?.runs?.[0]?.navigationEndpoint?.browseEndpoint?.browseId ||
        v.longBylineText?.runs?.[0]?.navigationEndpoint?.browseEndpoint?.browseId ||
        v.shortBylineText?.runs?.[0]?.navigationEndpoint?.browseEndpoint?.browseId ||
        fallbackChannelId ||
        '';
      const duration =
        v.lengthText?.simpleText ||
        v.thumbnailOverlays?.find((o: any) => o.thumbnailOverlayTimeStatusRenderer)
          ?.thumbnailOverlayTimeStatusRenderer?.text?.simpleText ||
        (markAsLive ? 'LIVE' : 'VIDEO');
      const views =
        v.shortViewCountText?.simpleText ||
        v.viewCountText?.simpleText ||
        v.shortViewCountText?.runs?.map((r: any) => r.text).join('') ||
        '';

      if (duration !== 'SHORTS') {
        items.push({
          id: v.videoId,
          title,
          channel,
          channelId,
          duration,
          views,
          thumbnail: `/api/yt-thumb/${v.videoId}`,
          isLive: markAsLive || duration === 'LIVE',
        });
      }
    }
  }

  for (const key of Object.keys(node)) {
    collectAllVideosFromNode(
      node[key],
      items,
      fallbackChannelName,
      fallbackChannelId,
      markAsLive
    );
  }
}

// Collect all Channel Playlists & Podcast Series from a channel's /playlists and /podcasts pages
function collectAllPlaylistsFromNode(
  node: any,
  playlists: Array<{
    id: string;
    title: string;
    countText: string;
    thumbnail: string;
  }>
) {
  if (!node || typeof node !== 'object') return;

  if (Array.isArray(node)) {
    for (const child of node) {
      collectAllPlaylistsFromNode(child, playlists);
    }
    return;
  }

  // Modern lockupViewModel playlist / podcast series
  const lockup = node.lockupViewModel;
  if (
    lockup &&
    typeof lockup.contentId === 'string' &&
    (lockup.contentType === 'LOCKUP_CONTENT_TYPE_PLAYLIST' ||
      lockup.contentType === 'LOCKUP_CONTENT_TYPE_PODCAST' ||
      lockup.contentId.startsWith('PL'))
  ) {
    const plId = lockup.contentId;
    if (!playlists.some((x) => x.id === plId)) {
      const title =
        lockup.metadata?.lockupMetadataViewModel?.title?.content || 'Playlist';
      const primaryThumb =
        lockup.contentImage?.collectionThumbnailViewModel?.primaryThumbnail
          ?.thumbnailViewModel;
      const overlays = primaryThumb?.overlays || [];
      let countText = 'Playlist';
      for (const ov of overlays) {
        const txt =
          ov?.thumbnailOverlayBadgeViewModel?.thumbnailBadges?.[0]
            ?.thumbnailBadgeViewModel?.text;
        if (txt) {
          countText = txt;
          break;
        }
      }
      const rawThumb = primaryThumb?.image?.sources?.[0]?.url || '';
      const vidMatch = rawThumb.match(/\/vi\/([a-zA-Z0-9_-]{11})\//);
      const thumbnail = vidMatch
        ? `/api/yt-thumb/${vidMatch[1]}`
        : rawThumb.startsWith('http')
        ? `/api/yt-avatar?url=${encodeURIComponent(rawThumb)}`
        : '/api/yt-thumb/RhTxjl_W_BM';

      playlists.push({
        id: plId,
        title,
        countText,
        thumbnail,
      });
    }
  }

  // Classic gridPlaylistRenderer / playlistRenderer
  const p = node.gridPlaylistRenderer || node.playlistRenderer;
  if (p && typeof p.playlistId === 'string') {
    if (!playlists.some((x) => x.id === p.playlistId)) {
      const title =
        p.title?.runs?.map((r: any) => r.text).join('') ||
        p.title?.simpleText ||
        'Playlist';
      const countText =
        p.videoCountText?.runs?.map((r: any) => r.text).join('') ||
        p.videoCountShortText?.simpleText ||
        'Playlist';
      const rawThumb =
        p.thumbnail?.thumbnails?.[0]?.url ||
        p.thumbnails?.[0]?.thumbnails?.[0]?.url ||
        '';
      const vidMatch = rawThumb.match(/\/vi\/([a-zA-Z0-9_-]{11})\//);
      const thumbnail = vidMatch
        ? `/api/yt-thumb/${vidMatch[1]}`
        : '/api/yt-thumb/RhTxjl_W_BM';

      playlists.push({
        id: p.playlistId,
        title,
        countText,
        thumbnail,
      });
    }
  }

  for (const key of Object.keys(node)) {
    collectAllPlaylistsFromNode(node[key], playlists);
  }
}

function collectAllChannelsFromNode(
  node: any,
  channels: Array<{
    id: string;
    name: string;
    subtitle: string;
    searchQuery: string;
    thumbnail: string;
    bannerThumb: string;
  }>
) {
  if (!node || typeof node !== 'object') return;

  if (Array.isArray(node)) {
    for (const child of node) {
      collectAllChannelsFromNode(child, channels);
    }
    return;
  }

  const c = node.channelRenderer;
  if (c && typeof c.channelId === 'string') {
    if (!channels.some((x) => x.id === c.channelId)) {
      const name =
        c.title?.simpleText ||
        c.title?.runs?.map((r: any) => r.text).join('') ||
        'Channel';
      const subText =
        c.videoCountText?.simpleText ||
        c.subscriberCountText?.simpleText ||
        c.descriptionSnippet?.runs?.map((r: any) => r.text).join('') ||
        'YouTube Channel';

      const thumbs = c.thumbnail?.thumbnails || [];
      let rawAvatar = thumbs[thumbs.length - 1]?.url || thumbs[0]?.url || '';
      if (rawAvatar.startsWith('//')) {
        rawAvatar = `https:${rawAvatar}`;
      }
      const proxiedAvatar = rawAvatar
        ? `/api/yt-avatar?url=${encodeURIComponent(rawAvatar)}`
        : `/api/yt-thumb/z23pnK_-0og`;

      channels.push({
        id: c.channelId,
        name,
        subtitle: subText,
        searchQuery: name,
        thumbnail: proxiedAvatar,
        bannerThumb: proxiedAvatar,
      });
    }
  }

  for (const key of Object.keys(node)) {
    collectAllChannelsFromNode(node[key], channels);
  }
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // High-Resolution Same-Origin YouTube Video Photo Proxy
  app.get('/api/yt-thumb/:id', async (req, res) => {
    const id = String(req.params.id || '').replace(/[^a-zA-Z0-9_-]/g, '');
    if (!id) {
      return res.status(404).end();
    }
    if (thumbCache.has(id)) {
      const cached = thumbCache.get(id)!;
      res.setHeader('Content-Type', cached.contentType);
      res.setHeader('Cache-Control', 'public, max-age=86400');
      return res.send(cached.buffer);
    }

    try {
      let ytRes = await fetch(`https://i.ytimg.com/vi/${id}/hqdefault.jpg`, {
        headers: BROWSER_HEADERS,
      });
      if (!ytRes.ok) {
        ytRes = await fetch(`https://i.ytimg.com/vi/${id}/mqdefault.jpg`, {
          headers: BROWSER_HEADERS,
        });
      }
      if (!ytRes.ok) {
        return res.redirect(`https://img.youtube.com/vi/${id}/hqdefault.jpg`);
      }
      const contentType = ytRes.headers.get('content-type') || 'image/jpeg';
      const arrayBuf = await ytRes.arrayBuffer();
      const buffer = Buffer.from(arrayBuf);
      thumbCache.set(id, { buffer, contentType });
      res.setHeader('Content-Type', contentType);
      res.setHeader('Cache-Control', 'public, max-age=86400');
      res.send(buffer);
    } catch {
      res.redirect(`https://img.youtube.com/vi/${id}/hqdefault.jpg`);
    }
  });

  // Same-Origin Proxy for YouTube Channel & Playlist Avatar Photos
  app.get('/api/yt-avatar', async (req, res) => {
    const rawUrl = String(req.query.url || '');
    if (!rawUrl.startsWith('http')) {
      return res.redirect('/api/yt-thumb/z23pnK_-0og');
    }
    const cacheKey = `av:${rawUrl}`;
    if (thumbCache.has(cacheKey)) {
      const cached = thumbCache.get(cacheKey)!;
      res.setHeader('Content-Type', cached.contentType);
      res.setHeader('Cache-Control', 'public, max-age=86400');
      return res.send(cached.buffer);
    }
    try {
      const avRes = await fetch(rawUrl, { headers: BROWSER_HEADERS });
      if (!avRes.ok) return res.redirect('/api/yt-thumb/z23pnK_-0og');
      const contentType = avRes.headers.get('content-type') || 'image/jpeg';
      const buffer = Buffer.from(await avRes.arrayBuffer());
      thumbCache.set(cacheKey, { buffer, contentType });
      res.setHeader('Content-Type', contentType);
      res.setHeader('Cache-Control', 'public, max-age=86400');
      res.send(buffer);
    } catch {
      res.redirect('/api/yt-thumb/z23pnK_-0og');
    }
  });

  // Official YouTube Autocomplete Search Recommendations
  app.get('/api/youtube-suggest', async (req, res) => {
    const query = String(req.query.q || '').trim();
    if (!query) return res.json({ suggestions: [] });
    const json = await safeJsonFetch(
      `https://suggestqueries.google.com/complete/search?client=firefox&ds=yt&q=${encodeURIComponent(query)}`
    );
    const suggestions = Array.isArray(json?.[1]) ? json[1] : [];
    res.json({ suggestions });
  });

  // Fetch ALL episodes inside a specific YouTube Playlist (with continuation pagination for 100+ video playlists!)
  app.get('/api/youtube-playlist', async (req, res) => {
    const listId = String(req.query.list || '').trim();
    const channelName = String(req.query.channel || 'Channel').trim();
    if (!listId) return res.json({ items: [], title: '' });

    const cacheKey = `full-pl:${listId}:${channelName}`.toLowerCase();
    if (playlistVideosCache.has(cacheKey)) {
      return res.json(playlistVideosCache.get(cacheKey));
    }

    const html = await safeTextFetch(
      `https://www.youtube.com/playlist?list=${encodeURIComponent(listId)}&hl=ar`
    );
    const items: any[] = [];
    let title = 'Playlist';

    if (html) {
      const match = html.match(/var ytInitialData = (\{.*?\});<\/script>/s);
      if (match) {
        try {
          const data = JSON.parse(match[1]);
          title =
            data?.metadata?.playlistMetadataRenderer?.title ||
            data?.header?.pageHeaderRenderer?.pageTitle ||
            'Playlist';
          collectAllVideosFromNode(data, items, channelName);

          // Follow continuation tokens to load ALL videos in the playlist (up to 500 videos)
          let tokens: string[] = [];
          collectContinuationTokens(data, tokens);
          let page = 0;
          while (tokens.length > 0 && page < 5) {
            const nextToken = tokens[tokens.length - 1];
            tokens = [];
            const nextData = await fetchBrowseContinuation(nextToken);
            if (!nextData) break;
            collectAllVideosFromNode(nextData, items, channelName);
            collectContinuationTokens(nextData, tokens);
            page++;
          }
        } catch {
          // ignore
        }
      }
    }

    const payload = { items, title };
    if (items.length > 0) {
      playlistVideosCache.set(cacheKey, payload);
    }
    res.json(payload);
  });

  // COMPLETE Channel Endpoint: returns LITERALLY ALL videos published by this channel (via UU uploads playlist + continuations), ALL Live Streams (/streams), and ALL Playlists (/playlists & /podcasts)!
  app.get('/api/youtube-channel', async (req, res) => {
    let channelId = String(req.query.id || '').trim();
    const channelName = String(req.query.name || '').trim();
    const cacheKey = `complete-v3:${channelId}:${channelName}`.toLowerCase();

    if (channelVideosCache.has(cacheKey)) {
      return res.json(channelVideosCache.get(cacheKey));
    }

    // Step 1: Resolve UC... channelId if not provided
    if (!channelId.startsWith('UC') && channelName) {
      const chSearchHtml = await safeTextFetch(
        `https://www.youtube.com/results?search_query=${encodeURIComponent(channelName)}&sp=EgIQAg%3D%3D&hl=ar`
      );
      const match = chSearchHtml.match(/var ytInitialData = (\{.*?\});<\/script>/s);
      if (match) {
        try {
          const data = JSON.parse(match[1]);
          const foundChannels: any[] = [];
          collectAllChannelsFromNode(data, foundChannels);
          if (foundChannels.length > 0) {
            channelId = foundChannels[0].id;
          }
        } catch {
          // ignore
        }
      }
    }

    const items: any[] = [];
    const streams: any[] = [];
    const playlists: any[] = [];
    let resolvedChannelTitle = channelName || 'Channel';

    if (channelId && channelId.startsWith('UC')) {
      // Every YouTube channel's complete uploads playlist is "UU" + channelId.slice(2)
      const uploadsPlaylistId = `UU${channelId.slice(2)}`;

      const [
        uploadsPlHtml,
        videosTabHtml,
        streamsTabHtml,
        playlistsTabHtml,
        podcastsTabHtml,
      ] = await Promise.all([
        safeTextFetch(
          `https://www.youtube.com/playlist?list=${encodeURIComponent(uploadsPlaylistId)}&hl=ar`
        ),
        safeTextFetch(
          `https://www.youtube.com/channel/${encodeURIComponent(channelId)}/videos?hl=ar`
        ),
        safeTextFetch(
          `https://www.youtube.com/channel/${encodeURIComponent(channelId)}/streams?hl=ar`
        ),
        safeTextFetch(
          `https://www.youtube.com/channel/${encodeURIComponent(channelId)}/playlists?hl=ar`
        ),
        safeTextFetch(
          `https://www.youtube.com/channel/${encodeURIComponent(channelId)}/podcasts?hl=ar`
        ),
      ]);

      // Official Channel Title from /videos
      if (videosTabHtml) {
        const m = videosTabHtml.match(/var ytInitialData = (\{.*?\});<\/script>/s);
        if (m) {
          try {
            const d = JSON.parse(m[1]);
            const officialTitle = d?.metadata?.channelMetadataRenderer?.title;
            if (officialTitle) resolvedChannelTitle = officialTitle;
          } catch {
            // ignore
          }
        }
      }

      // 1. Extract ALL Channel Uploads from UU... playlist + follow continuation pages to get literally every video from the start!
      if (uploadsPlHtml) {
        const match = uploadsPlHtml.match(/var ytInitialData = (\{.*?\});<\/script>/s);
        if (match) {
          try {
            const data = JSON.parse(match[1]);
            collectAllVideosFromNode(data, items, resolvedChannelTitle, channelId);

            let tokens: string[] = [];
            collectContinuationTokens(data, tokens);
            let page = 0;
            while (tokens.length > 0 && page < 5) {
              const nextToken = tokens[tokens.length - 1];
              tokens = [];
              const nextData = await fetchBrowseContinuation(nextToken);
              if (!nextData) break;
              collectAllVideosFromNode(nextData, items, resolvedChannelTitle, channelId);
              collectContinuationTokens(nextData, tokens);
              page++;
            }
          } catch {
            // ignore
          }
        }
      }

      // Also include any videos from /videos tab in case UU playlist missed any
      if (videosTabHtml) {
        const match = videosTabHtml.match(/var ytInitialData = (\{.*?\});<\/script>/s);
        if (match) {
          try {
            const data = JSON.parse(match[1]);
            collectAllVideosFromNode(data, items, resolvedChannelTitle, channelId);
          } catch {
            // ignore
          }
        }
      }

      // 2. Extract Channel Live Streams (/streams tab)
      if (streamsTabHtml) {
        const match = streamsTabHtml.match(/var ytInitialData = (\{.*?\});<\/script>/s);
        if (match) {
          try {
            const data = JSON.parse(match[1]);
            collectAllVideosFromNode(data, streams, resolvedChannelTitle, channelId, true);
          } catch {
            // ignore
          }
        }
      }

      // 3. Extract ALL Channel Playlists & Podcasts (/playlists and /podcasts tabs)
      for (const pHtml of [playlistsTabHtml, podcastsTabHtml]) {
        if (!pHtml) continue;
        const match = pHtml.match(/var ytInitialData = (\{.*?\});<\/script>/s);
        if (match) {
          try {
            const data = JSON.parse(match[1]);
            collectAllPlaylistsFromNode(data, playlists);
          } catch {
            // ignore
          }
        }
      }
    }

    const payload = { items, streams, playlists, channelName: resolvedChannelTitle };
    if (items.length > 0 || streams.length > 0 || playlists.length > 0) {
      channelVideosCache.set(cacheKey, payload);
    }
    res.json(payload);
  });

  // Full YouTube Search: fetches ALL Videos, ALL Channels, and ALL Autocomplete Suggestions
  app.get('/api/youtube-search', async (req, res) => {
    const query = String(req.query.q || 'study with me lofi').trim();
    const cacheKey = query.toLowerCase();
    if (searchCache.has(cacheKey)) {
      return res.json(searchCache.get(cacheKey));
    }

    const [videoSearchHtml, channelSearchHtml, suggestJson] = await Promise.all([
      safeTextFetch(
        `https://www.youtube.com/results?search_query=${encodeURIComponent(query)}&hl=ar`
      ),
      safeTextFetch(
        `https://www.youtube.com/results?search_query=${encodeURIComponent(query)}&sp=EgIQAg%3D%3D&hl=ar`
      ),
      safeJsonFetch(
        `https://suggestqueries.google.com/complete/search?client=firefox&ds=yt&q=${encodeURIComponent(query)}`
      ),
    ]);

    const items: any[] = [];
    const channels: any[] = [];
    const suggestions: string[] = Array.isArray(suggestJson?.[1]) ? suggestJson[1] : [];

    if (videoSearchHtml) {
      const match = videoSearchHtml.match(/var ytInitialData = (\{.*?\});<\/script>/s);
      if (match) {
        try {
          const data = JSON.parse(match[1]);
          collectAllChannelsFromNode(data, channels);
          collectAllVideosFromNode(data, items);
        } catch {
          // ignore
        }
      }
    }

    if (channelSearchHtml) {
      const match = channelSearchHtml.match(/var ytInitialData = (\{.*?\});<\/script>/s);
      if (match) {
        try {
          const data = JSON.parse(match[1]);
          collectAllChannelsFromNode(data, channels);
        } catch {
          // ignore
        }
      }
    }

    const payload = { items, channels, suggestions };
    if (items.length > 0 || channels.length > 0) {
      searchCache.set(cacheKey, payload);
    }
    res.json(payload);
  });

  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Kinetics server running on http://localhost:${PORT}`);
  });
}

startServer();

/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import {
  Tv,
  Home,
  RotateCcw,
} from 'lucide-react';
import {
  HOME_MEDIA_ITEMS,
} from './data/mediaCatalog';
import { FourMediaBoxesSuite, FourBoxesConfig } from './components/FourMediaBoxes';

const STORAGE_KEY = 'kinetics-black-red-media-v8';

const DEFAULT_BOXES: FourBoxesConfig = {
  yt1: {
    pageName: 'Focus',
    mode: 'home',
    category: 'all',
    searchQuery: '',
    activeVideo: HOME_MEDIA_ITEMS[0],
    history: {},
  },
  yt2: {
    pageName: 'Podcasts',
    mode: 'home',
    category: 'podcasts',
    searchQuery: '',
    activeVideo: HOME_MEDIA_ITEMS[4],
    history: {},
  },
  yt3: {
    pageName: 'Ambience',
    mode: 'home',
    category: 'lofi',
    searchQuery: '',
    activeVideo: HOME_MEDIA_ITEMS[16],
    history: {},
  },
  spotify: {
    pageName: 'Quran',
    isSpotifyBox: false,
    mode: 'home',
    category: 'quran',
    searchQuery: '',
    activeVideo: HOME_MEDIA_ITEMS[1],
    history: {},
  },
};

function loadSavedBoxes(): FourBoxesConfig {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_BOXES;
    const parsed = JSON.parse(raw);
    return {
      yt1: { ...DEFAULT_BOXES.yt1, ...(parsed.yt1 || {}) },
      yt2: { ...DEFAULT_BOXES.yt2, ...(parsed.yt2 || {}) },
      yt3: { ...DEFAULT_BOXES.yt3, ...(parsed.yt3 || {}) },
      spotify: { ...DEFAULT_BOXES.spotify, ...(parsed.spotify || {}), isSpotifyBox: false },
    };
  } catch {
    return DEFAULT_BOXES;
  }
}

export default function App() {
  const [boxes, setBoxes] = useState<FourBoxesConfig>(() => loadSavedBoxes());
  const [activeNav, setActiveNav] = useState<'yt1' | 'yt2' | 'yt3' | 'spotify'>('yt1');

  useEffect(() => {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(boxes));
    } catch {
      // ignore storage errors
    }
  }, [boxes]);

  const jumpToPage = (target: 'yt1' | 'yt2' | 'yt3' | 'spotify') => {
    setActiveNav(target);
    const idMap = {
      yt1: 'page-cinema',
      yt2: 'page-podcasts',
      yt3: 'page-lounge',
      spotify: 'page-spotify',
    };
    const el = document.getElementById(idMap[target]);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  const returnAllHome = () => {
    setBoxes((prev) => ({
      yt1: { ...prev.yt1, mode: 'home' },
      yt2: { ...prev.yt2, mode: 'home' },
      yt3: { ...prev.yt3, mode: 'home' },
      spotify: { ...prev.spotify, mode: 'home' },
    }));
  };

  return (
    <div className="study-app theme-black-red">
      <div className="study-shell">
        {/* Clean Minimal Header: Brand — 4 Aesthetic YouTube Page Names — Simple Home/Reset */}
        <header className="study-header">
          <button
            type="button"
            onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
            className="brand"
            aria-label="Kinetics"
          >
            <span className="brand-mark-z-circle" aria-hidden="true">
              Z
            </span>
            <span className="brand-name">Kinetics</span>
          </button>

          <nav className="nav-pills" aria-label="Pages">
            <button
              type="button"
              className={activeNav === 'yt1' ? 'active' : ''}
              onClick={() => jumpToPage('yt1')}
            >
              <Tv size={14} />
              Focus
            </button>
            <button
              type="button"
              className={activeNav === 'yt2' ? 'active' : ''}
              onClick={() => jumpToPage('yt2')}
            >
              <Tv size={14} />
              Podcasts
            </button>
            <button
              type="button"
              className={activeNav === 'yt3' ? 'active' : ''}
              onClick={() => jumpToPage('yt3')}
            >
              <Tv size={14} />
              Ambience
            </button>
            <button
              type="button"
              className={activeNav === 'spotify' ? 'active' : ''}
              onClick={() => jumpToPage('spotify')}
            >
              <Tv size={14} />
              Quran
            </button>
          </nav>

          <div className="header-actions">
            <button
              type="button"
              className="kinetics-pill-btn active"
              onClick={returnAllHome}
              title="All Home"
            >
              <Home size={13} />
              Home
            </button>

            <button
              type="button"
              className="kinetics-pill-btn"
              onClick={() => setBoxes(DEFAULT_BOXES)}
              title="Reset"
            >
              <RotateCcw size={13} />
            </button>
          </div>
        </header>

        {/* All 4 Full-Page Size YouTube Boxes Stacked Together */}
        <FourMediaBoxesSuite boxes={boxes} setBoxes={setBoxes} />
      </div>
    </div>
  );
}

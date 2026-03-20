<svelte:head>
  <title>GESTURE — Music Control</title>
  <link href="https://fonts.googleapis.com/css2?family=DM+Mono:wght@300;400;500&family=Syne:wght@400;700;800;900&display=swap" rel="stylesheet" />
  <script src="https://unpkg.com/ml5@1/dist/ml5.min.js"></script>
</svelte:head>

<script>
  import { onDestroy, onMount, tick } from 'svelte';
  import { browser } from '$app/environment';
  import { page } from '$app/stores';
  import { replaceState } from '$app/navigation'; // Add this import

  // ─── APP PHASE ──────────────────────────────────────────────────
  let phase = $state('setup');

  // ─── SETUP FORM STATE ───────────────────────────────────────────
  let tokenInput = $state('');
  let playlistInput = $state(''); 

  // ─── SPOTIFY STATE ──────────────────────────────────────────────
  let spotToken     = $state('');
  let spotPlaylist  = $state('');
  let isPlaying     = $state(false);
  let currentTrack  = $state(null);
  let trackProgress = $state(0);
  let volume        = $state(70);
  let topArtists    = $state([]);
  let spotStatus    = $state('idle');
  let pollTimer     = null;
  let embedSrc      = $state(null);
  let activeDeviceId = $state(null);

  // ─── GESTURE / CAMERA STATE ─────────────────────────────────────
  //let canvasEl      = $state(null);
  //let videoEl       = $state(null);
  let canvasEl      = $state('');
  let videoEl       = $state('');
  let hands         = $state([]);
  let camStatus     = $state('idle');
  let mlStatus      = $state('idle');
  let gestureLabel  = $state('—');
  let gestureEmoji  = $state('');
  let flashMsg      = $state(null);
  let flashTimer    = null;
  let animFrame     = null;

  let lastGesture     = $state('');
  let lastGestureTime = 0;
  const COOLDOWN      = 1500;

  // ─── LOG ────────────────────────────────────────────────────────
  let logs = $state([]);
  function addLog(source, msg) {
    const ts = new Date().toLocaleTimeString('en-US', { hour12: false });
    logs = [{ ts, source, msg, id: Math.random() }, ...logs].slice(0, 30);
  }

  // ─── DERIVED ────────────────────────────────────────────────────
  let elapsed  = $derived(currentTrack ? msToTime(currentTrack.duration_ms * (trackProgress / 100)) : '0:00');
  let total    = $derived(currentTrack ? msToTime(currentTrack.duration_ms) : '0:00');
  let albumArt = $derived(currentTrack?.album?.images?.[0]?.url ?? null);

  // ─── OAUTH & LAUNCH ─────────────────────────────────────────────
  onMount(async () => {
    const urlToken = $page.url.searchParams.get('token');
    if (urlToken) {
      tokenInput = urlToken;
      addLog('Auth', 'Token received, auto-launching...');
      await launch();
      const url = new URL(window.location);
      url.searchParams.delete('token');
      window.history.replaceState({}, '', url);
    }
  });

  async function launch() {
    if (!tokenInput || !tokenInput.trim()) {
      alert('Please enter your Spotify access token.');
      return; 
    }
    spotToken = tokenInput.trim();
    spotPlaylist = (playlistInput || '').trim();
    phase = 'app'; 
    await tick(); 
    try {
      await initCamera();
      await initML5();
      await initSpotify();
    } catch (err) {
      addLog('System', `Launch Error: ${err.message}`);
    }
    if (spotPlaylist) {
      const playlistId = spotPlaylist.split(':').pop();
      embedSrc = `https://open.spotify.com/embed/playlist/${playlistId}?utm_source=generator&theme=0`;
      spotifyPlay(spotPlaylist);
    }
  }

import { base } from '$app/paths';

function loginWithSpotify() {
  // This will become '/interactive-spotify/auth/callback' on GitHub
  // and just '/auth/callback' when you are working locally.
  window.location.href = `${base}/auth/callback`;
}

  // ─── CAMERA ─────────────────────────────────────────────────────
  async function initCamera() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { width: 640, height: 480, facingMode: 'user' } 
      });
      // Important: Assign to the element directly
      videoEl.srcObject = stream;
      await new Promise(r => videoEl.onloadedmetadata = r);
      videoEl.play();
      camStatus = 'active';
      addLog('Camera', 'Webcam ready');
    } catch (e) {
      camStatus = 'error';
      addLog('Camera', `Error: ${e.message}`);
    }
  }

  // ─── ML5 HANDPOSE ───────────────────────────────────────────────
  async function initML5() {
    mlStatus = 'loading';
    addLog('ml5', 'Loading HandPose model…');
    
    try {
      // 1. Double check the video is actually ready
      if (!videoEl || videoEl.readyState < 2) {
        await tick();
        addLog('ml5', 'Waiting for camera feed...');
      }

      // 2. Load the model
      const hp = await ml5.handPose({ flipped: true });
      
      // 3. Start detection using the video element directly
      hp.detectStart(videoEl, (results) => {
        hands = results;
      });

      mlStatus = 'active';
      addLog('ml5', 'HandPose active');
      
      // 4. Trigger the visual loop
      startDrawLoop();
    } catch (err) {
      mlStatus = 'error';
      addLog('ml5', `Model Error: ${err.message}`);
      console.error("ML5 Initialization Error:", err);
    }
  }

  function startDrawLoop() {
    const ctx = canvasEl?.getContext('2d');
    if (!ctx) return;

    const CONNECTIONS = [[0,1],[1,2],[2,3],[3,4],[0,5],[5,6],[6,7],[7,8],[5,9],[9,10],[10,11],[11,12],[9,13],[13,14],[14,15],[15,16],[13,17],[17,18],[18,19],[19,20],[0,17]];

    function draw() {
      // 1. Safety check
      if (!videoEl || videoEl.readyState < 2 || !canvasEl) { 
        animFrame = requestAnimationFrame(draw);
        return; 
      }

      // 2. Mirror and Draw Video
      ctx.save();
      ctx.translate(canvasEl.width, 0);
      ctx.scale(-1, 1);
      ctx.drawImage(videoEl, 0, 0, canvasEl.width, canvasEl.height);
      ctx.restore();

      // 3. Draw Hand Tracking
      if (hands && hands.length > 0) {
        for (const hand of hands) {
          // Draw Lines
          ctx.strokeStyle = '#c8ff00';
          ctx.lineWidth = 3;
          for (const [a, b] of CONNECTIONS) {
            const kpA = hand.keypoints[a];
            const kpB = hand.keypoints[b];
            if (kpA && kpB) {
              ctx.beginPath();
              ctx.moveTo(kpA.x, kpA.y);
              ctx.lineTo(kpB.x, kpB.y);
              ctx.stroke();
            }
          }
          // Draw Dots
          ctx.fillStyle = '#ffffff';
          for (const kp of hand.keypoints) {
            ctx.beginPath();
            ctx.arc(kp.x, kp.y, 4, 0, Math.PI * 2);
            ctx.fill();
          }
        }
      }

      // 4. Act on Gestures
      const activeHand = hands.find(h => h.confidence > 0.1);
      if (activeHand) {
        classifyAndAct(activeHand);
      } else {
        gestureLabel = '—';
        gestureEmoji = '';
      }

      animFrame = requestAnimationFrame(draw);
    }
    draw();
  }

  // ─── VOLUME CONTROL ─────────────────────────────────────────────
  async function spotifySetVol(v) {
    volume = Math.max(0, Math.min(100, Math.round(v)));
    try { 
      await api(`/me/player/volume?volume_percent=${volume}`, 'PUT'); 
    } catch (_) {
      addLog('Spotify', 'Volume control requires an active device');
    }
  }

  // ─── SPOTIFY API ────────────────────────────────────────────────
 
  // ─── SPOTIFY API (REPLACED & CLEANED) ───────────────────────────
  async function api(endpoint, method = 'GET', body = null) {
    if (!spotToken) {
      console.error("API Error: spotToken is empty!");
      return null;
    }

    const opts = {
      method,
      headers: {
        'Authorization': `Bearer ${spotToken}`,
        'Content-Type': 'application/json'
      }
    };
    if (body) opts.body = JSON.stringify(body);

    try {
      const res = await fetch(`https://api.spotify.com/v1${endpoint}`, opts);

      // 1. Handle "No Content" success (204/202) - prevents the 500 crash
      if (res.status === 204 || res.status === 202) return { success: true };

      // 2. Handle Errors
      if (!res.ok) {
        const errorDetail = await res.json().catch(() => ({}));
        console.error(`Spotify Error ${res.status}:`, errorDetail);
        return null;
      }

      // 3. Parse JSON only if content exists
      return await res.json().catch(() => ({}));
    } catch (err) {
      console.error("Fetch failed:", err);
      return null;
    }
    // Change the fetch URL to the direct Spotify API
      const res = await fetch(`https://api.spotify.com/v1${endpoint}`, opts);
  }

  async function initSpotify() {
    try {
      const me = await api('/me');
      spotStatus = 'active';
      addLog('Spotify', `Connected as ${me.display_name}`);
      
      // Get the list of available devices
      const devices = await api('/me/player/devices');
      if (devices?.devices?.length > 0) {
        // Find the first active device, or just take the first one available
        const active = devices.devices.find(d => d.is_active) || devices.devices[0];
        activeDeviceId = active.id;
        addLog('Spotify', `Targeting: ${active.name}`);
      }
      
      await fetchTopArtists(); 
      startPoll();
    } catch (e) {
      spotStatus = 'error';
    }
  }

  async function fetchTopArtists() {
    try {
      const d = await api('/me/top/artists?limit=5&time_range=short_term');
      topArtists = d.items || []; 
      addLog('Spotify', `Loaded ${topArtists.length} top artists`);
    } catch (e) { 
      addLog('Spotify', 'Failed to load artists'); 
      console.error(e);
    }
  }

  function startPoll() {
    if (pollTimer) clearInterval(pollTimer);
    pollTimer = setInterval(async () => {
      try {
        const s = await api('/me/player');
        if (s && s.item) {
          isPlaying = s.is_playing;
          currentTrack = s.item;
          trackProgress = (s.progress_ms / s.item.duration_ms) * 100;
        }
      } catch (e) { /* silent poll fail */ }
    }, 3000);
  }

  function msToTime(ms) {
    const s = Math.floor(ms / 1000);
    return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
  }

  // ─── PLAYBACK CONTROLS ──────────────────────────────────────────
  async function spotifyPlay(contextUri = null) {
    try {
      const body = contextUri ? { context_uri: contextUri } : {};
      await api('/me/player/play', 'PUT', body);
      isPlaying = true;
      addLog('Spotify', 'Playback started');
    } catch (e) {
      // This usually happens if no device is active
      addLog('Spotify', 'Error: Open Spotify on your phone/PC first');
      console.error("Spotify Playback Error:", e);
    }
  }

  async function spotifyPause() {
    try {
      await api('/me/player/pause', 'PUT');
      isPlaying = false;
      addLog('Spotify', 'Paused');
    } catch (e) { addLog('Spotify', 'Pause Error'); }
  }

async function spotifyPlayArtist(idx) {
  const artist = topArtists[idx];
  
  // 1. Refetch devices if activeDeviceId is missing
  if (!activeDeviceId) {
    const devices = await api('/me/player/devices');
    const active = devices?.devices?.find(d => d.is_active) || devices?.devices?.[0];
    if (active) activeDeviceId = active.id;
  }

  if (!artist || !activeDeviceId) {
    addLog('Spotify', 'Error: No active device found. Play a song manually first!');
    return;
  }

  try {
    const data = await api(`/artists/${artist.id}/top-tracks?market=from_token`);
    if (data?.tracks) {
      const uris = data.tracks.slice(0, 10).map(t => t.uri);
      
      // 2. Log the exact URL for debugging
      console.log(`Triggering play on device: ${activeDeviceId}`);
      
      await api(`/me/player/play?device_id=${activeDeviceId}`, 'PUT', { uris });
      addLog('Spotify', `🎤 Playing: ${artist.name}`);
    }
  } catch (e) {
    addLog('Spotify', 'Playback trigger failed');
  }
}
  
  async function spotifyNext() {
    try { await api('/me/player/next', 'POST'); addLog('Spotify', 'Next'); } catch (e) {}
  }

  async function spotifyPrev() {
    try { await api('/me/player/previous', 'POST'); addLog('Spotify', 'Previous'); } catch (e) {}
  }
  
  async function spotifyAdjVol(delta) {
    volume = Math.max(0, Math.min(100, volume + delta));
    await api(`/me/player/volume?volume_percent=${volume}`, 'PUT').catch(() => {});
  }
  
    function classifyGesture(kps) {
    if (!kps || kps.length < 21) return null;
    const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
    const palmSize = dist(kps[0], kps[9]);
    const isUp = (tip, pip) => dist(kps[tip], kps[0]) > dist(kps[pip], kps[0]) + (palmSize * 0.2);

    const f = [
      dist(kps[4], kps[0]) > dist(kps[2], kps[0]) + (palmSize * 0.1), // Thumb (f[0])
      isUp(8, 6),   // Index (f[1])
      isUp(12, 10), // Middle (f[2])
      isUp(16, 14), // Ring (f[3])
      isUp(20, 18)  // Pinky (f[4])
    ];

    const fingerCount = f.slice(1).filter(Boolean).length; // Only 4 fingers
    const totalCount = f.filter(Boolean).length;           // All 5 digits

    // --- CATEGORY 1: THUMB TUCKED (Artist Selection) ---
    if (!f[0]) {
      if (fingerCount >= 1 && fingerCount <= 4) {
        const names = ['one_finger', 'two_fingers', 'three_fingers', 'four_fingers'];
        return { name: names[fingerCount - 1], emoji: '☝️', label: `Artist #${fingerCount}` };
      }
      if (fingerCount === 0) {
        return { name: 'fist', emoji: '✊', label: 'Pause' };
      }
    }

    // --- CATEGORY 2: THUMB EXTENDED (Navigation & Play) ---
    if (f[0]) {
      // 5 digits up = Play
      if (totalCount === 5) return { name: 'open_hand', emoji: '✋', label: 'Play' };
      
      // Thumb only = Volume
      if (fingerCount === 0) {
        return kps[4].y < kps[2].y ? { name: 'vol_up', emoji: '👍', label: 'Vol +' } : { name: 'vol_down', emoji: '👎', label: 'Vol -' };
      }

      // Thumb + Index = Next/Prev (Ignore other fingers for stability)
      if (f[1]) {
        const horizontalDiff = kps[8].x - kps[5].x;
        if (horizontalDiff > 45) return { name: 'next', emoji: '👉', label: 'Next' };
        if (horizontalDiff < -45) return { name: 'prev', emoji: '👈', label: 'Prev' };
      }
    }

    return null;
  }

 function classifyAndAct(hand) {
    const g = classifyGesture(hand.keypoints);
    if (!g) { 
      gestureLabel = '—'; 
      gestureEmoji = ''; 
      return; 
    }

    gestureLabel = g.label;
    gestureEmoji = g.emoji;

    const now = Date.now();
    if (g.name === lastGesture && now - lastGestureTime < COOLDOWN) return;
    
    lastGesture = g.name;
    lastGestureTime = now;

    // This shows the yellow box on screen
    showFlash(`${g.emoji} ${g.label.toUpperCase()}`);
    addLog('Gesture', `Detected: ${g.name}`);

    // DIRECT ACTION TRIGGER
    if (g.name === 'fist') spotifyPause();
    else if (g.name === 'open_hand') spotifyPlay();
    else if (g.name === 'next') spotifyNext();
    else if (g.name === 'prev') spotifyPrev();
    else if (g.name === 'vol_up') spotifyAdjVol(10);
    else if (g.name === 'vol_down') spotifyAdjVol(-10);
    // Add these to your if/else if chain in classifyAndAct
    else if (g.name === 'one_finger') spotifyPlayArtist(0);
    else if (g.name === 'two_fingers') spotifyPlayArtist(1);
    else if (g.name === 'three_fingers') spotifyPlayArtist(2);
    else if (g.name === 'four_fingers') spotifyPlayArtist(3);
  }

  function showFlash(msg) {
    flashMsg = msg;
    clearTimeout(flashTimer);
    flashTimer = setTimeout(() => flashMsg = null, 900);
  }

  function reset() {
    if (!browser) return;
    location.reload();
  }

  onDestroy(() => {
    if (pollTimer) clearInterval(pollTimer);
    if (animFrame) cancelAnimationFrame(animFrame);
  });

  async function spotifyToggle() {
    if (isPlaying) {
      await spotifyPause();
    } else {
      await spotifyPlay();
    }
  }
  
</script>

<style>
  @keyframes pulse-dot  { 0%,100%{opacity:1} 50%{opacity:.2} }
  @keyframes flash-pop  {
    0%  {opacity:0;transform:translate(-50%,-50%) scale(.75)}
    18% {opacity:1;transform:translate(-50%,-50%) scale(1.06)}
    55% {opacity:1;transform:translate(-50%,-50%) scale(1)}
    100%{opacity:0;transform:translate(-50%,-50%) scale(.9)}
  }
  .anim-pulse { animation: pulse-dot 2s ease-in-out infinite; }
  .anim-flash { animation: flash-pop .85s ease forwards; }
  .font-display { font-family: 'Syne', sans-serif; }
</style>

<!-- FLASH OVERLAY -->
{#if flashMsg}
  <div class="anim-flash font-display fixed z-[8000] pointer-events-none font-black
              bg-[#c8ff00] text-[#08080b] px-8 py-3 tracking-tight whitespace-nowrap"
       style="top:50%;left:50%;transform:translate(-50%,-50%);font-size:clamp(1.8rem,5vw,3rem)">
    {flashMsg}
  </div>
{/if}

<!-- ═══════════════ SETUP / LOGIN SCREEN ═══════════════ -->
{#if phase === 'setup'}
<section class="min-h-screen bg-[#08080b] flex flex-col items-center justify-center px-6 py-16 gap-10">

  <div class="text-center">
    <h1 class="font-display font-black tracking-tighter leading-none text-[#c8ff00]"
        style="font-size:clamp(3.5rem,9vw,7rem);text-shadow:0 0 80px rgba(200,255,0,.3)">
      GEST<span class="text-white">URE</span>
    </h1>
    <p class="mt-3 text-[0.64rem] tracking-[0.25em] uppercase text-[#666680]">
      ml5.js HandPose · Spotify Web API · SvelteKit + Tailwind
    </p>
  </div>

  <!-- Login -->
  <div class="bg-[#111116] border border-[#222230] p-7 max-w-lg w-full flex flex-col gap-4 items-center text-center">
    <div class="flex items-baseline gap-3 border-b border-[#222230] pb-4 w-full">
      <span class="font-display font-black text-3xl text-[#c8ff00] opacity-40 leading-none">01</span>
      <h2 class="font-display font-bold text-[0.75rem] tracking-widest uppercase">Connect Spotify</h2>
    </div>
    <p class="text-[0.69rem] text-[#666680] leading-relaxed">
      Requires <strong class="text-white font-medium">Spotify Premium</strong>. 
      Click below to log in — you'll be redirected to Spotify and back automatically.
    </p>
    <button onclick={loginWithSpotify}
      class="bg-[#c8ff00] text-[#08080b] font-display font-extrabold text-[0.8rem] tracking-widest uppercase
             px-10 py-3.5 border-0 cursor-pointer transition-all mt-1 w-full
             hover:-translate-y-0.5 hover:shadow-[0_8px_24px_rgba(200,255,0,.3)] active:translate-y-0">
      🎵 Login with Spotify
    </button>
  </div>

</section>

<!-- ═══════════════ MAIN APP ═══════════════ -->
{:else}
<div class="min-h-screen bg-[#08080b] p-5 grid gap-5 items-start"
     style="grid-template-columns:1fr 380px;grid-template-rows:auto 1fr">

  <!-- HEADER -->
  <header class="col-span-2 flex items-center justify-between pb-5 border-b border-[#222230]">
    <div class="font-display font-black tracking-tighter text-[#c8ff00] leading-none" style="font-size:1.6rem">
      GEST<span class="text-white">URE</span>
    </div>
    <div class="flex items-center gap-5">
      {#each [
        { label:'Camera',       state:camStatus },
        { label:'ml5 HandPose', state:mlStatus  },
        { label:'Spotify',      state:spotStatus },
      ] as s}
        <div class="flex items-center gap-2 text-[0.59rem] tracking-[0.1em] uppercase text-[#666680]">
          <span class="w-2 h-2 rounded-full inline-block
            {s.state==='active'  ? 'bg-[#c8ff00] shadow-[0_0_6px_#c8ff00] anim-pulse' : ''}
            {s.state==='error'   ? 'bg-[#ff3b5c]' : ''}
            {s.state==='loading' ? 'bg-orange-400 anim-pulse' : ''}
            {s.state==='idle'    ? 'bg-[#4a4a60]' : ''}
          "></span>
          {s.label}
        </div>
      {/each}
      <button onclick={reset}
        class="border border-[#222230] text-[#666680] font-display font-bold text-[0.57rem] tracking-widest uppercase
               px-3 py-1.5 bg-transparent cursor-pointer transition-colors hover:border-[#c8ff00] hover:text-[#c8ff00]">
        ↩ Reset
      </button>
    </div>
  </header>

  <!-- LEFT COLUMN -->
  <div class="flex flex-col gap-5">

    <!-- Camera / Canvas -->
    <div class="bg-[#111116] border border-[#222230] p-5 flex flex-col gap-4">
      <div class="flex items-center gap-2 font-display font-bold text-[0.57rem] tracking-[0.2em] uppercase text-[#666680]">
        <span class="w-2 h-2 rounded-full bg-[#c8ff00] shadow-[0_0_6px_#c8ff00] anim-pulse"></span>
        Live Hand Tracking
      </div>

      <div class="relative bg-black overflow-hidden" style="aspect-ratio:4/3">
        <!-- svelte-ignore a11y_media_has_caption -->
        <video 
          bind:this={videoEl} 
          autoplay 
          playsinline 
          muted
          class="absolute opacity-0 pointer-events-none" 
          width="640" 
          height="480">
        </video>

        <canvas bind:this={canvasEl} width="640" height="480" class="w-full h-full block"></canvas>

        <span class="absolute top-2.5 left-2.5   w-4 h-4 border-t-2 border-l-2 border-[#c8ff00] opacity-60 pointer-events-none"></span>
        <span class="absolute top-2.5 right-2.5  w-4 h-4 border-t-2 border-r-2 border-[#c8ff00] opacity-60 pointer-events-none"></span>
        <span class="absolute bottom-2.5 left-2.5  w-4 h-4 border-b-2 border-l-2 border-[#c8ff00] opacity-60 pointer-events-none"></span>
        <span class="absolute bottom-2.5 right-2.5 w-4 h-4 border-b-2 border-r-2 border-[#c8ff00] opacity-60 pointer-events-none"></span>

        <div class="absolute bottom-2.5 left-1/2 -translate-x-1/2 px-4 py-1.5 font-display font-bold
                    text-[0.62rem] tracking-[0.1em] uppercase whitespace-nowrap pointer-events-none
                    {gestureLabel !== '—'
                      ? 'bg-[#08080b]/90 border border-[#c8ff00] text-[#c8ff00] shadow-[0_0_16px_rgba(200,255,0,.15)]'
                      : 'bg-[#08080b]/90 border border-[#222230] text-[#4a4a60]'}">
          {gestureEmoji} {gestureLabel}
        </div>
      </div>

      <div class="grid grid-cols-3 gap-1.5">
        {#each [
          ['✊','fist','Pause'],['✋','open_hand','Play'],
          ['👉','point_right','Next'],['👈','point_left','Prev'],
          ['👍','thumbs_up','Vol +'],['👎','thumbs_down','Vol −'],
        ] as [emoji, name, label]}
          <div class="border p-2.5 text-center transition-all
            {lastGesture === name ? 'border-[#c8ff00] bg-[#c8ff00]/10' : 'border-[#222230] bg-[#08080b]'}">
            <span class="block text-xl mb-1">{emoji}</span>
            <span class="block font-display font-bold text-[0.49rem] tracking-widest uppercase
              {lastGesture === name ? 'text-[#c8ff00]' : 'text-[#4a4a60]'}">{label}</span>
          </div>
        {/each}
      </div>
    </div>

    <!-- Top Artists -->
    <div class="bg-[#111116] border border-[#222230] p-5 flex flex-col gap-4">
      <div class="flex items-center font-display font-bold text-[0.57rem] tracking-[0.2em] uppercase text-[#666680]">
        🎤 Your Top 5 Artists
        <span class="ml-auto font-mono font-normal text-[0.56rem] tracking-normal text-[#4a4a60] normal-case">
          Show 1–5 fingers to play
        </span>
      </div>
      {#if topArtists.length === 0}
        <p class="text-[0.7rem] text-[#4a4a60] text-center py-3">
          {spotStatus === 'active' ? 'Loading artists…' : 'Connect Spotify to see artists'}
        </p>
      {:else}
        <div class="grid grid-cols-5 gap-2">
          {#each topArtists as artist, i}
            <button onclick={() => spotifyPlayArtist(i)}
              class="bg-[#08080b] border border-[#222230] p-2.5 flex flex-col items-center gap-1.5
                     cursor-pointer relative transition-all
                     hover:border-[#c8ff00] hover:-translate-y-0.5 hover:bg-[#c8ff00]/10">
              {#if artist.images?.[0]?.url}
                <img src={artist.images[0].url} alt={artist.name}
                     class="w-10 h-10 rounded-full object-cover border border-[#222230]" />
              {:else}
                <div class="w-10 h-10 rounded-full bg-[#18181f] flex items-center justify-center text-lg">🎵</div>
              {/if}
              <span class="absolute top-1.5 left-2 font-display font-black text-[0.7rem] text-[#c8ff00] leading-none">{i+1}</span>
              <span class="font-display font-bold text-[0.55rem] text-center text-white truncate w-full leading-tight">{artist.name}</span>
              <span class="text-[0.5rem] text-[#4a4a60] text-center truncate w-full capitalize">{artist.genres?.[0] ?? ''}</span>
            </button>
          {/each}
        </div>
      {/if}
    </div>

  </div>

  <!-- RIGHT COLUMN -->
  <div class="flex flex-col gap-5">

    {#if embedSrc}
      <div class="bg-[#111116] border border-[#222230] p-5 flex flex-col gap-3">
        <p class="font-display font-bold text-[0.57rem] tracking-[0.2em] uppercase text-[#666680]">🎵 Spotify Playlist</p>
        <iframe src={embedSrc} width="100%" height="152" frameborder="0"
          allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
          loading="lazy" title="Spotify playlist" class="block border-0"></iframe>
      </div>
    {/if}

    <!-- Now Playing -->
    <div class="bg-[#111116] border border-[#222230] p-5 flex flex-col gap-4">
      <p class="font-display font-bold text-[0.57rem] tracking-[0.2em] uppercase text-[#666680]">⚡ Now Playing</p>

      <div class="flex gap-4 items-start">
        {#if albumArt}
          <div class="relative flex-shrink-0 w-16 h-16">
            <img src={albumArt} alt="album art" class="w-16 h-16 object-cover block relative z-10" />
            <div class="absolute -inset-1 blur-xl opacity-35 z-0 bg-cover bg-center"
                 style="background-image:url({albumArt})"></div>
          </div>
        {:else}
          <div class="w-16 h-16 bg-[#18181f] border border-[#222230] flex items-center justify-center text-2xl text-[#4a4a60] flex-shrink-0">♪</div>
        {/if}
        <div class="flex-1 overflow-hidden">
          <div class="font-display font-extrabold text-[0.95rem] text-white truncate leading-snug mb-0.5">{currentTrack?.name ?? '—'}</div>
          <div class="text-[0.7rem] text-[#666680] truncate">{currentTrack?.artists?.map(a => a.name).join(', ') ?? 'No active playback'}</div>
          <div class="text-[0.62rem] text-[#4a4a60] truncate mt-0.5">{currentTrack?.album?.name ?? ''}</div>
        </div>
      </div>

      <div class="flex flex-col gap-1.5">
        <div class="h-px bg-[#222230] relative">
          <div class="absolute inset-y-0 left-0 bg-[#c8ff00] transition-[width] duration-1000 ease-linear" style="width:{trackProgress}%"></div>
          <div class="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-2.5 h-2.5 bg-[#c8ff00] transition-[left] duration-1000" style="left:{trackProgress}%"></div>
        </div>
        <div class="flex justify-between text-[0.6rem] text-[#666680]">
          <span>{elapsed}</span><span>{total}</span>
        </div>
      </div>

      <div class="flex items-center justify-center gap-3">
        <button onclick={spotifyPrev}
          class="w-10 h-10 flex items-center justify-center border border-[#222230] text-white bg-transparent cursor-pointer text-base transition-colors hover:border-[#c8ff00] hover:text-[#c8ff00]">⏮</button>
        <button onclick={() => spotifyToggle()}
          class="flex items-center justify-center border border-[#c8ff00] text-[#c8ff00] bg-transparent cursor-pointer text-xl transition-colors hover:bg-[#c8ff00]/10"
          style="width:52px;height:52px">
          {isPlaying ? '⏸' : '▶'}
        </button>
        <button onclick={spotifyNext}
          class="w-10 h-10 flex items-center justify-center border border-[#222230] text-white bg-transparent cursor-pointer text-base transition-colors hover:border-[#c8ff00] hover:text-[#c8ff00]">⏭</button>
      </div>

      <div class="flex items-center gap-3 text-base">
        <span>🔉</span>
        <input type="range" min="0" max="100" value={volume}
          oninput={e => spotifySetVol(+e.target.value)} class="flex-1" />
        <span>🔊</span>
        <span class="text-[0.65rem] text-[#666680] w-7 text-right tabular-nums">{volume}</span>
      </div>
    </div>

    <!-- Activity Log -->
    <div class="bg-[#111116] border border-[#222230] px-5 py-4 flex flex-col gap-2 max-h-36 overflow-y-auto">
      <p class="font-display font-bold text-[0.55rem] tracking-[0.2em] uppercase text-[#4a4a60] flex-shrink-0">Activity Log</p>
      {#each logs as entry (entry.id)}
        <div class="text-[0.61rem] leading-relaxed flex gap-1.5 flex-wrap">
          <span class="text-[#c8ff00] opacity-60">[{entry.ts}]</span>
          <span class="text-[#3baaff] opacity-75">[{entry.source}]</span>
          <span class="text-[#666680]">{entry.msg}</span>
        </div>
      {/each}
    </div>

  </div>
</div>
{/if}

import { useState, useEffect, useRef } from "react";

const GENRES = ["Pop", "Rock", "Hip Hop / Rap", "R&B / Soul", "Reggaeton / Latino", "Electrónica / Dance", "Country", "Jazz / Blues", "Metal", "Indie / Alternativo", "Funk / Disco", "Clásicos / Oldies", "Cumbia", "Trap", "Folklore Uruguayo", "Cumbia del Interior Uruguaya"];
const CONTINENTS = ["Norteamérica", "Latinoamérica", "Europa", "Asia", "África", "Oceanía"];
const LOADING_MSGS = ["Buscando hits de los 80s...", "Armando tu playlist...", "Mezclando géneros...", "Casi listo...", "Explorando vinilos...", "Consultando las listas de éxitos...", "Descubriendo clásicos...", "Preparando la fiesta..."];
const API_KEY = import.meta.env.VITE_OPENAI_API_KEY || "";
const SESSION_KEY = "st_session";
const SESSION_TS_KEY = "st_session_ts";
const SESSION_TTL = 7200000;

const shuffle = (a) => {
  const b = [...a];
  for (let i = b.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [b[i], b[j]] = [b[j], b[i]];
  }
  return b;
};

const formatScore = (sixths) => {
  const whole = Math.floor(sixths / 6);
  const rem = sixths % 6;
  if (rem === 0) return `${whole}`;
  const f = { 1: "\u2159", 2: "\u00B2\u2044\u2086", 3: "\u00B3\u2044\u2086", 4: "\u2074\u2044\u2086", 5: "\u2075\u2044\u2086" };
  if (whole === 0) return f[rem];
  return `${whole} ${f[rem]}`;
};

const validateSong = (s) =>
  s && typeof s.song === "string" && s.song.length > 0 &&
  typeof s.artist === "string" && s.artist.length > 0 &&
  typeof s.year === "number" && s.year >= 1950 && s.year <= 2025;

const fetchSongBatch = async (genres, continents, artists, count, exclude) => {
  const artistInstruction = artists.trim()
    ? `Aproximadamente el 20% de las canciones (unas ${Math.round(count * 0.2)}) DEBEN ser de estos artistas: ${artists}. El 80% restante deben ser de artistas variados y conocidos de los géneros y regiones indicadas.`
    : "Usar artistas variados y conocidos de cada género y región.";

  const excludeInstruction = exclude.length > 0
    ? `\nNO repitas estas canciones que ya fueron generadas:\n${exclude.map(s => `- "${s.song}" de ${s.artist}`).join("\n")}`
    : "";

  const prompt = `Generá una lista de exactamente ${count} canciones populares y conocidas que cumplan estos criterios:
- Géneros: ${genres.join(", ")}
- Regiones/continentes de origen del artista: ${continents.join(", ")}
${artistInstruction}
${excludeInstruction}

Requisitos:
- Canciones de distintas décadas (1950s a 2020s), buena variedad temporal
- Solo canciones MUY conocidas y populares que la gente pueda reconocer
- Distribuir equitativamente entre los géneros y continentes seleccionados
- No repetir artistas más de 3 veces

Responde SOLAMENTE con un JSON array válido, sin markdown, sin backticks, sin texto adicional. Cada objeto debe tener exactamente esta estructura:
[
  {
    "song": "Nombre de la canción",
    "artist": "Nombre del artista",
    "year": 1985,
    "genre": "Rock",
    "continent": "Norteamérica"
  }
]`;

  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${API_KEY}`,
    },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      max_tokens: 16000,
      temperature: 0.9,
      messages: [{ role: "user", content: prompt }],
    }),
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`API error ${response.status}: ${err}`);
  }

  const data = await response.json();
  const text = data.choices[0].message.content;
  const cleaned = text.replace(/```json|```/g, "").trim();
  const parsed = JSON.parse(cleaned);
  return parsed.filter(validateSong);
};

const G = "#1DB954", GL = "#1ed760", DARK = "#0a0a0f";

function ConfirmModal({ message, onConfirm, onCancel }) {
  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 1100, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }} onClick={onCancel}>
      <div style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,.75)", backdropFilter: "blur(8px)" }} />
      <div style={{ position: "relative", background: "#141418", border: "1px solid rgba(255,255,255,.1)", borderRadius: 20, padding: "28px 24px", maxWidth: 360, width: "100%", textAlign: "center" }} onClick={e => e.stopPropagation()}>
        <p style={{ margin: "0 0 24px", fontSize: 15, color: "#ccc", lineHeight: 1.5 }}>{message}</p>
        <div style={{ display: "flex", gap: 10 }}>
          <button onClick={onCancel} style={{ flex: 1, padding: "14px 16px", minHeight: 48, background: "rgba(255,255,255,.06)", border: "1px solid rgba(255,255,255,.12)", borderRadius: 12, color: "#aaa", fontSize: 14, fontWeight: 700, cursor: "pointer", WebkitAppearance: "none" }}>Cancelar</button>
          <button onClick={onConfirm} style={{ flex: 1, padding: "14px 16px", minHeight: 48, background: "#ff4757", border: "none", borderRadius: 12, color: "#fff", fontSize: 14, fontWeight: 700, cursor: "pointer", WebkitAppearance: "none" }}>Sí, reiniciar</button>
        </div>
      </div>
    </div>
  );
}

function ScoreboardModal({ players, onClose }) {
  const sorted = [...players].sort((a, b) => b.score - a.score);
  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }} onClick={onClose}>
      <div style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,.75)", backdropFilter: "blur(8px)" }} />
      <div style={{ position: "relative", background: "#141418", border: "1px solid rgba(255,255,255,.1)", borderRadius: 20, padding: "28px 24px", maxWidth: 400, width: "100%", maxHeight: "80vh", overflow: "auto" }} onClick={e => e.stopPropagation()}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
          <span style={{ fontSize: 14, color: G, fontWeight: 700, textTransform: "uppercase", letterSpacing: ".12em" }}>🏆 Tabla de posiciones</span>
          <button onClick={onClose} style={{ background: "none", border: "none", color: "#666", fontSize: 24, cursor: "pointer", padding: "8px 12px", minWidth: 44, minHeight: 44, lineHeight: 1, display: "flex", alignItems: "center", justifyContent: "center" }}>✕</button>
        </div>
        {sorted.map((p, i) => (
          <div key={i} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 16px", marginBottom: 6, background: i === 0 ? "rgba(29,185,84,.1)" : "rgba(255,255,255,.03)", border: i === 0 ? "1px solid rgba(29,185,84,.25)" : "1px solid rgba(255,255,255,.06)", borderRadius: 12 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <span style={{ fontSize: i < 3 ? 22 : 15, width: 30, textAlign: "center" }}>{i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : `${i + 1}.`}</span>
              <span style={{ fontWeight: 600, fontSize: 15, color: i === 0 ? "#fff" : "#ccc" }}>{p.name}</span>
            </div>
            <span style={{ fontWeight: 800, fontSize: 18, color: i === 0 ? GL : "#888" }}>{formatScore(p.score)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function loadSession() {
  try {
    const ts = parseInt(localStorage.getItem(SESSION_TS_KEY), 10);
    if (!ts || Date.now() - ts >= SESSION_TTL) { clearSession(); return null; }
    const raw = localStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch { clearSession(); return null; }
}

function saveSession(state) {
  try {
    localStorage.setItem(SESSION_KEY, JSON.stringify(state));
    if (!localStorage.getItem(SESSION_TS_KEY)) localStorage.setItem(SESSION_TS_KEY, String(Date.now()));
  } catch {}
}

function clearSession() {
  localStorage.removeItem(SESSION_KEY);
  localStorage.removeItem(SESSION_TS_KEY);
}

export default function App() {
  const saved = useRef(loadSession());

  const [screen, setScreen] = useState(saved.current ? saved.current.screen : "config");
  const [players, setPlayers] = useState(saved.current ? saved.current.players : []);
  const [playerInput, setPlayerInput] = useState("");
  const [numRounds, setNumRounds] = useState(saved.current ? saved.current.numRounds : 10);
  const [gameSongs, setGameSongs] = useState(saved.current ? saved.current.gameSongs : []);
  const [timeline, setTimeline] = useState(saved.current ? saved.current.timeline : []);
  const [currentRound, setCurrentRound] = useState(saved.current ? saved.current.currentRound : 0);
  const [currentPlayerIdx, setCurrentPlayerIdx] = useState(saved.current ? saved.current.currentPlayerIdx : 0);
  const [phase, setPhase] = useState(saved.current ? saved.current.phase : "listen");
  const [songCorrect, setSongCorrect] = useState(null);
  const [artistCorrect, setArtistCorrect] = useState(null);
  const [selectedSlot, setSelectedSlot] = useState(null);
  const [timelineCorrect, setTimelineCorrect] = useState(null);
  const [roundPts, setRoundPts] = useState(0);
  const [justPlaced, setJustPlaced] = useState(null);
  const [showScoreboard, setShowScoreboard] = useState(false);
  const [animPhase, setAnimPhase] = useState(0);

  const [selectedGenres, setSelectedGenres] = useState(saved.current ? saved.current.selectedGenres : []);
  const [selectedContinents, setSelectedContinents] = useState(saved.current ? saved.current.selectedContinents : []);
  const [artistFilter, setArtistFilter] = useState(saved.current ? saved.current.artistFilter : "");
  const [songPool, setSongPool] = useState(saved.current ? saved.current.songPool : []);
  const [nextPoolIdx, setNextPoolIdx] = useState(saved.current ? saved.current.nextPoolIdx : 0);
  const [loading, setLoading] = useState(false);
  const [loadingMsg, setLoadingMsg] = useState(LOADING_MSGS[0]);
  const [loadingProgress, setLoadingProgress] = useState(0);
  const [genError, setGenError] = useState(null);
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [bgLoading, setBgLoading] = useState(false);
  const bgAbort = useRef(false);

  useEffect(() => { const iv = setInterval(() => setAnimPhase(p => (p + 1) % 360), 60); return () => clearInterval(iv); }, []);
  useEffect(() => { if (!loading) return; let i = 0; const iv = setInterval(() => { i = (i + 1) % LOADING_MSGS.length; setLoadingMsg(LOADING_MSGS[i]); }, 2500); return () => clearInterval(iv); }, [loading]);

  useEffect(() => {
    if (screen === "config" || screen === "loading") return;
    saveSession({ screen, players, numRounds, gameSongs, timeline, currentRound, currentPlayerIdx, phase, songPool, nextPoolIdx, selectedGenres, selectedContinents, artistFilter });
  }, [screen, players, numRounds, gameSongs, timeline, currentRound, currentPlayerIdx, phase, songPool, nextPoolIdx]);

  const toggleGenre = (g) => setSelectedGenres(prev => prev.includes(g) ? prev.filter(x => x !== g) : [...prev, g]);
  const toggleContinent = (c) => setSelectedContinents(prev => prev.includes(c) ? prev.filter(x => x !== c) : [...prev, c]);

  const dedupeAndIndex = (songs) => {
    const seen = new Set();
    return songs.filter(s => {
      const key = `${s.song}|||${s.artist}`.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    }).map((s, i) => ({ ...s, id: `${i}-${s.song.replace(/\s/g, "")}` }));
  };

  const fetchMoreInBackground = async (initial, genres, continents, artists) => {
    bgAbort.current = false;
    setBgLoading(true);
    let accumulated = [...initial];
    const target = 150;
    for (let attempt = 0; attempt < 4 && accumulated.length < target; attempt++) {
      if (bgAbort.current) break;
      try {
        const need = target - accumulated.length;
        const batch = await fetchSongBatch(genres, continents, artists, need, accumulated);
        const existing = new Set(accumulated.map(s => `${s.song}|||${s.artist}`.toLowerCase()));
        const unique = batch.filter(s => {
          const key = `${s.song}|||${s.artist}`.toLowerCase();
          if (existing.has(key)) return false;
          existing.add(key);
          return true;
        });
        accumulated = [...accumulated, ...unique];
        const indexed = dedupeAndIndex(accumulated);
        const shuffled = shuffle(indexed);
        setSongPool(shuffled);
      } catch { break; }
    }
    setBgLoading(false);
  };

  const handleGenerate = async () => {
    if (selectedGenres.length < 1 || selectedContinents.length < 1) return;
    setLoading(true);
    setGenError(null);
    setLoadingProgress(0);
    setScreen("loading");
    try {
      const batch = await fetchSongBatch(selectedGenres, selectedContinents, artistFilter, 60, []);
      if (batch.length === 0) throw new Error("No se generaron canciones válidas.");
      const indexed = dedupeAndIndex(batch);
      const shuffled = shuffle(indexed);
      setSongPool(shuffled);
      setNextPoolIdx(0);
      setLoadingProgress(shuffled.length);
      setScreen("home");
      fetchMoreInBackground(batch, selectedGenres, selectedContinents, artistFilter);
    } catch (err) {
      setGenError(err.message || "Error desconocido");
      setScreen("config");
    } finally {
      setLoading(false);
    }
  };

  const totalTurns = numRounds * (players.length || 1);
  const startGame = () => {
    if (players.length < 1 || songPool.length < 1) return;
    const songs = songPool.slice(0, totalTurns);
    setGameSongs(songs);
    setNextPoolIdx(totalTurns);
    setTimeline([]);
    setCurrentRound(0);
    setCurrentPlayerIdx(0);
    setPhase("listen");
    setSongCorrect(null);
    setArtistCorrect(null);
    setSelectedSlot(null);
    setTimelineCorrect(null);
    setRoundPts(0);
    setJustPlaced(null);
    setScreen("game");
    localStorage.setItem(SESSION_TS_KEY, String(Date.now()));
  };

  const addPlayer = () => { const name = playerInput.trim(); if (name && players.length < 8 && !players.find(p => p.name === name)) { setPlayers([...players, { name, score: 0 }]); setPlayerInput(""); } };
  const removePlayer = (i) => setPlayers(players.filter((_, idx) => idx !== i));

  const turnIndex = currentRound * players.length + currentPlayerIdx;
  const currentSong = gameSongs[turnIndex] || {};
  const currentPlayer = players[currentPlayerIdx] || {};
  const spotifyQuery = encodeURIComponent((currentSong.song || "") + " " + (currentSong.artist || ""));
  const spotifyLink = `https://open.spotify.com/search/${spotifyQuery}`;
  const openSpotify = (e) => { e.preventDefault(); window.location.href = `spotify:search:${spotifyQuery}`; setTimeout(() => { window.open(spotifyLink, "_blank"); }, 800); };
  const isFirstSong = timeline.length === 0;
  const sortedTimeline = [...timeline].sort((a, b) => a.year - b.year);

  const canSkipSong = nextPoolIdx < songPool.length;
  const handleSkipSong = () => {
    if (!canSkipSong) return;
    const replacement = songPool[nextPoolIdx];
    const newGameSongs = [...gameSongs];
    newGameSongs[turnIndex] = replacement;
    setGameSongs(newGameSongs);
    setNextPoolIdx(nextPoolIdx + 1);
  };

  const checkSlotCorrect = (slotIndex) => { const year = currentSong.year; if (sortedTimeline.length === 0) return true; const leftYear = slotIndex > 0 ? sortedTimeline[slotIndex - 1].year : -Infinity; const rightYear = slotIndex < sortedTimeline.length ? sortedTimeline[slotIndex].year : Infinity; return year >= leftYear && year <= rightYear; };
  const calcPoints = (tlOk, sOk, aOk) => { if (!tlOk) return 0; return 6 + (sOk ? 1 : 0) + (aOk ? 1 : 0); };
  const canConfirmPlay = () => { if (songCorrect === null || artistCorrect === null) return false; if (!isFirstSong && selectedSlot === null) return false; return true; };

  const handleConfirmPlay = () => { if (!canConfirmPlay()) return; const tlOk = isFirstSong ? true : checkSlotCorrect(selectedSlot); setTimelineCorrect(tlOk); const pts = calcPoints(tlOk, songCorrect, artistCorrect); setRoundPts(pts); const up = [...players]; up[currentPlayerIdx].score += pts; setPlayers(up); setTimeline(prev => [...prev, { ...currentSong, justAdded: true }]); setJustPlaced(currentSong.id); setPhase("result"); };

  const nextTurn = () => { setTimeline(prev => prev.map(s => ({ ...s, justAdded: false }))); setJustPlaced(null); setSongCorrect(null); setArtistCorrect(null); setSelectedSlot(null); setTimelineCorrect(null); setRoundPts(0); let np = currentPlayerIdx + 1, nr = currentRound; if (np >= players.length) { np = 0; nr++; } if (nr >= numRounds) { setScreen("results"); } else { setCurrentRound(nr); setCurrentPlayerIdx(np); setPhase("listen"); } };

  const resetGame = () => { bgAbort.current = true; clearSession(); setPlayers(players.map(p => ({ ...p, score: 0 }))); setSongPool([]); setGameSongs([]); setTimeline([]); setCurrentRound(0); setCurrentPlayerIdx(0); setNextPoolIdx(0); setPhase("listen"); setShowResetConfirm(false); setBgLoading(false); setScreen("config"); };
  const handleResetClick = () => setShowResetConfirm(true);

  const h1 = animPhase % 360, h2 = (animPhase + 120) % 360;
  const css = `@keyframes fadeIn{from{opacity:0;transform:translateY(12px)}to{opacity:1;transform:translateY(0)}}@keyframes pulse{0%,100%{transform:scale(1)}50%{transform:scale(1.02)}}@keyframes glow{0%,100%{box-shadow:0 0 16px rgba(29,185,84,.3)}50%{box-shadow:0 0 32px rgba(29,185,84,.5)}}@keyframes popIn{from{opacity:0;transform:scale(.8)}to{opacity:1;transform:scale(1)}}@keyframes slideIn{from{opacity:0;transform:translateX(-20px)}to{opacity:1;transform:translateX(0)}}@keyframes highlightPulse{0%,100%{background:rgba(29,185,84,.15)}50%{background:rgba(29,185,84,.3)}}@keyframes spin{to{transform:rotate(360deg)}}@keyframes barBounce{0%,100%{transform:scaleY(.4)}50%{transform:scaleY(1)}}input:focus{border-color:${G}!important}button,a{-webkit-user-select:none;user-select:none}::selection{background:${G};color:#000}*{box-sizing:border-box;-webkit-tap-highlight-color:transparent}button,a{touch-action:manipulation;cursor:pointer}input{touch-action:manipulation}::-webkit-scrollbar{width:4px;height:4px}::-webkit-scrollbar-thumb{background:rgba(255,255,255,.1);border-radius:4px}`;

  const S = {
    app: { minHeight: "100vh", background: DARK, fontFamily: "'Segoe UI',system-ui,sans-serif", color: "#f0f0f0", position: "relative" },
    glow: { position: "fixed", inset: 0, background: `radial-gradient(ellipse at 20% 20%,hsla(${h1},80%,50%,.06) 0%,transparent 50%),radial-gradient(ellipse at 80% 80%,hsla(${h2},80%,50%,.06) 0%,transparent 50%)`, pointerEvents: "none", zIndex: 0 },
    wrap: { position: "relative", zIndex: 1, maxWidth: 720, margin: "0 auto", padding: "20px 16px", paddingBottom: 80 },
    card: { background: "rgba(255,255,255,.04)", border: "1px solid rgba(255,255,255,.08)", borderRadius: 16, padding: "24px 20px", marginBottom: 16, backdropFilter: "blur(20px)" },
    label: { fontSize: 12, color: G, fontWeight: 700, textTransform: "uppercase", letterSpacing: ".12em", marginBottom: 8, display: "block" },
    input: { width: "100%", padding: "14px 16px", minHeight: 48, background: "rgba(255,255,255,.06)", border: "1px solid rgba(255,255,255,.12)", borderRadius: 10, color: "#fff", fontSize: 16, outline: "none", boxSizing: "border-box", WebkitAppearance: "none" },
    btn: (bg, col) => ({ padding: "14px 28px", minHeight: 48, background: bg, color: col, border: "none", borderRadius: 50, fontSize: 15, fontWeight: 800, cursor: "pointer", letterSpacing: ".04em", textTransform: "uppercase", transition: "all .15s", WebkitAppearance: "none" }),
    btnO: (active, color) => ({ padding: "12px 20px", minHeight: 44, background: active ? `${color}22` : "rgba(255,255,255,.04)", color: active ? color : "#666", border: `2px solid ${active ? color : "rgba(255,255,255,.1)"}`, borderRadius: 12, fontSize: 14, fontWeight: 700, cursor: "pointer", transition: "all .15s", WebkitAppearance: "none" }),
    chip: { display: "inline-flex", alignItems: "center", gap: 8, padding: "10px 16px", minHeight: 40, background: "rgba(29,185,84,.1)", border: "1px solid rgba(29,185,84,.25)", borderRadius: 50, margin: 4, fontSize: 14, fontWeight: 600 },
    tag: (ok) => ({ display: "inline-flex", alignItems: "center", gap: 5, padding: "6px 12px", borderRadius: 50, fontSize: 12, fontWeight: 700, background: ok ? "rgba(29,185,84,.15)" : "rgba(255,71,87,.15)", color: ok ? GL : "#ff6b81", border: `1px solid ${ok ? "rgba(29,185,84,.3)" : "rgba(255,71,87,.3)"}` }),
    fab: { position: "fixed", bottom: 20, zIndex: 900, width: 56, height: 56, borderRadius: "50%", border: "none", fontSize: 22, fontWeight: 800, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", WebkitAppearance: "none" },
    toggle: (active) => ({ padding: "10px 16px", minHeight: 44, background: active ? "rgba(29,185,84,.18)" : "rgba(255,255,255,.04)", color: active ? GL : "#777", border: `1.5px solid ${active ? G : "rgba(255,255,255,.1)"}`, borderRadius: 50, fontSize: 13, fontWeight: 600, cursor: "pointer", transition: "all .15s", margin: 3, WebkitAppearance: "none" }),
  };

  const FloatingBtns = () => (
    <>
      {screen !== "home" && screen !== "config" && screen !== "loading" && (
        <>
          <button style={{ ...S.fab, right: 20, background: `linear-gradient(135deg,${G},${GL})`, color: "#000", boxShadow: "0 4px 20px rgba(29,185,84,.4)" }} onClick={() => setShowScoreboard(true)}>🏆</button>
          <button style={{ ...S.fab, right: 84, background: "rgba(255,255,255,.08)", color: "#aaa", boxShadow: "0 2px 12px rgba(0,0,0,.3)", border: "1px solid rgba(255,255,255,.1)" }} onClick={handleResetClick}>🔄</button>
        </>
      )}
      {showScoreboard && <ScoreboardModal players={players} onClose={() => setShowScoreboard(false)} />}
      {showResetConfirm && <ConfirmModal message="¿Reiniciar juego? Se perderán todos los puntajes y progreso." onConfirm={resetGame} onCancel={() => setShowResetConfirm(false)} />}
    </>
  );

  if (screen === "config") {
    const canGenerate = selectedGenres.length >= 1 && selectedContinents.length >= 1;
    return (
      <div style={S.app}><div style={S.glow} /><style>{css}</style>
        <div style={S.wrap}>
          <div style={{ textAlign: "center", marginBottom: 8 }}><span style={{ fontSize: 52 }}>🎵</span></div>
          <h1 style={{ textAlign: "center", fontSize: "clamp(1.8rem,5.5vw,3rem)", fontWeight: 900, letterSpacing: "-.02em", background: `linear-gradient(135deg,${G},${GL},#a3f7bf)`, WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", margin: "0 0 4px", lineHeight: 1.1 }}>Spotify Timeline</h1>
          <p style={{ textAlign: "center", fontSize: "clamp(.8rem,2.2vw,1rem)", color: "#777", marginBottom: 32, fontWeight: 400, letterSpacing: ".15em", textTransform: "uppercase" }}>Configurá tu playlist</p>

          {genError && (
            <div style={{ padding: "14px 18px", background: "rgba(255,71,87,.1)", border: "1px solid rgba(255,71,87,.25)", borderRadius: 12, marginBottom: 16, animation: "fadeIn .3s both" }}>
              <p style={{ margin: 0, fontSize: 13, color: "#ff6b81" }}>Error al generar canciones: {genError}</p>
              <button onClick={handleGenerate} style={{ ...S.btn(G, "#000"), marginTop: 10, padding: "8px 20px", fontSize: 13 }}>Reintentar</button>
            </div>
          )}

          <div style={S.card}>
            <span style={S.label}>Géneros (mínimo 1)</span>
            <div style={{ display: "flex", flexWrap: "wrap" }}>
              {GENRES.map(g => (
                <button key={g} onClick={() => toggleGenre(g)} style={S.toggle(selectedGenres.includes(g))}>
                  {selectedGenres.includes(g) ? "✓ " : ""}{g}
                </button>
              ))}
            </div>
          </div>

          <div style={S.card}>
            <span style={S.label}>Continentes (mínimo 1)</span>
            <div style={{ display: "flex", flexWrap: "wrap" }}>
              {CONTINENTS.map(c => (
                <button key={c} onClick={() => toggleContinent(c)} style={S.toggle(selectedContinents.includes(c))}>
                  {selectedContinents.includes(c) ? "✓ " : ""}{c}
                </button>
              ))}
            </div>
          </div>

          <div style={S.card}>
            <span style={S.label}>Priorizar artistas (opcional, separar con coma)</span>
            <input style={S.input} placeholder="Ej: Queen, Bad Bunny, ABBA..." value={artistFilter} onChange={e => setArtistFilter(e.target.value)} />
          </div>

          <div style={{ textAlign: "center", marginTop: 24 }}>
            <button style={{ ...S.btn(`linear-gradient(135deg,${G},${GL})`, "#000"), padding: "16px 48px", fontSize: 17, opacity: canGenerate ? 1 : .4, cursor: canGenerate ? "pointer" : "not-allowed" }} onClick={handleGenerate} disabled={!canGenerate}>
              Generar Playlist →
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (screen === "loading") {
    return (
      <div style={S.app}><div style={S.glow} /><style>{css}</style>
        <div style={{ ...S.wrap, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", minHeight: "80vh" }}>
          <div style={{ display: "flex", gap: 6, marginBottom: 32 }}>
            {[0, 1, 2, 3, 4].map(i => (
              <div key={i} style={{ width: 6, height: 32, background: G, borderRadius: 3, animation: `barBounce .8s ${i * .15}s ease-in-out infinite` }} />
            ))}
          </div>
          <p style={{ fontSize: 18, fontWeight: 700, color: GL, marginBottom: 8, animation: "fadeIn .4s both" }}>{loadingMsg}</p>
          <p style={{ fontSize: 13, color: "#666" }}>Generando playlist inicial...</p>
        </div>
      </div>
    );
  }

  if (screen === "home") {
    const playersCount = Math.max(players.length, 1);
    const maxRounds = Math.min(Math.floor(songPool.length / playersCount), 20);
    const roundOptions = [5, 10, 15, 20].filter(n => n <= maxRounds);
    if (roundOptions.length > 0 && !roundOptions.includes(numRounds)) {
      const closest = roundOptions.reduce((a, b) => Math.abs(b - numRounds) < Math.abs(a - numRounds) ? b : a);
      if (numRounds !== closest) setNumRounds(closest);
    }

    return (
      <div style={S.app}><div style={S.glow} /><style>{css}</style>
        <div style={S.wrap}>
          <div style={{ textAlign: "center", marginBottom: 8 }}><span style={{ fontSize: 52 }}>🎵</span></div>
          <h1 style={{ textAlign: "center", fontSize: "clamp(1.8rem,5.5vw,3rem)", fontWeight: 900, letterSpacing: "-.02em", background: `linear-gradient(135deg,${G},${GL},#a3f7bf)`, WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", margin: "0 0 4px", lineHeight: 1.1 }}>Spotify Timeline</h1>
          <p style={{ textAlign: "center", fontSize: "clamp(.8rem,2.2vw,1rem)", color: "#777", marginBottom: 16, fontWeight: 400, letterSpacing: ".15em", textTransform: "uppercase" }}>Escuchá · Adiviná · Ubicá en el tiempo</p>

          <div style={{ textAlign: "center", padding: "12px 18px", background: "rgba(29,185,84,.08)", border: "1px solid rgba(29,185,84,.2)", borderRadius: 12, marginBottom: 24, animation: "fadeIn .4s both" }}>
            <p style={{ margin: 0, fontSize: 14, color: GL, fontWeight: 600 }}>🎵 {songPool.length} canciones {bgLoading ? "y cargando más..." : "listas"}</p>
            <p style={{ margin: "4px 0 0", fontSize: 12, color: "#888" }}>{selectedGenres.join(", ")} · {selectedContinents.join(", ")}</p>
            {bgLoading && <div style={{ width: "100%", height: 3, background: "rgba(255,255,255,.06)", borderRadius: 2, marginTop: 8, overflow: "hidden" }}><div style={{ width: `${(songPool.length / 150) * 100}%`, height: "100%", background: `linear-gradient(90deg,${G},${GL})`, transition: "width .5s" }} /></div>}
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(140px,1fr))", gap: 10, marginBottom: 24 }}>
            {[{ i: "🎧", t: "Abrí la canción en Spotify y escuchá" }, { i: "🎤", t: "Adiviná el nombre y el artista" }, { i: "📅", t: "Ubicá la canción en la línea del tiempo" }, { i: "🏆", t: "Sumá puntos y ganá" }].map((x, i) => (
              <div key={i} style={{ textAlign: "center", padding: "16px 10px", background: "rgba(255,255,255,.025)", borderRadius: 12, border: "1px solid rgba(255,255,255,.05)", animation: `fadeIn .5s ${i * .1}s both` }}>
                <div style={{ fontSize: 26, marginBottom: 6 }}>{x.i}</div>
                <div style={{ fontSize: 12, color: "#999", lineHeight: 1.4 }}>{x.t}</div>
              </div>
            ))}
          </div>
          <div style={S.card}>
            <span style={S.label}>Jugadores (máx. 8)</span>
            <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
              <input style={{ ...S.input, flex: 1 }} placeholder="Nombre..." value={playerInput} onChange={e => setPlayerInput(e.target.value)} onKeyDown={e => e.key === "Enter" && addPlayer()} maxLength={16} />
              <button style={S.btn(`linear-gradient(135deg,${G},${GL})`, "#000")} onClick={addPlayer}>+</button>
            </div>
            <div style={{ display: "flex", flexWrap: "wrap" }}>
              {players.map((p, i) => (<div key={i} style={S.chip}>{p.name}<button style={{ background: "none", border: "none", color: "#ff4757", cursor: "pointer", fontSize: 18, padding: "4px 8px", minWidth: 32, minHeight: 32, lineHeight: 1, display: "flex", alignItems: "center", justifyContent: "center" }} onClick={() => removePlayer(i)}>×</button></div>))}
              {!players.length && <span style={{ fontSize: 12, color: "#555", padding: 6 }}>Agregá al menos un jugador</span>}
            </div>
          </div>
          <div style={S.card}>
            <span style={S.label}>Rondas</span>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              {roundOptions.map(n => (<button key={n} onClick={() => setNumRounds(n)} style={S.btnO(numRounds === n, G)}>{n}</button>))}
            </div>
          </div>
          <div style={{ textAlign: "center", marginTop: 24 }}>
            <button style={{ ...S.btn(`linear-gradient(135deg,${G},${GL})`, "#000"), padding: "16px 48px", fontSize: 17, opacity: players.length < 1 ? .4 : 1, cursor: players.length < 1 ? "not-allowed" : "pointer" }} onClick={startGame} disabled={players.length < 1}>Comenzar</button>
          </div>
          <div style={{ marginTop: 28, padding: 16, background: "rgba(255,255,255,.02)", borderRadius: 10, border: "1px solid rgba(255,255,255,.04)" }}>
            <p style={{ fontSize: 12, color: "#555", textAlign: "center", margin: 0, lineHeight: 1.7 }}>
              <strong style={{ color: "#777" }}>Puntuación:</strong><br/>Ubicación correcta en el timeline = <strong style={{ color: G }}>1 punto</strong><br/>Si acertó el timeline: canción = <strong style={{ color: G }}>⅙</strong> · artista = <strong style={{ color: G }}>⅙</strong><br/><span style={{ color: "#666" }}>Timeline incorrecto → 0 puntos</span><br/><strong style={{ color: G }}>Máx. 1 ²⁄₆ pts/ronda</strong>
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (screen === "results") {
    const sorted = [...players].sort((a, b) => b.score - a.score);
    const finalTimeline = [...timeline].sort((a, b) => a.year - b.year);
    return (
      <div style={S.app}><div style={S.glow} /><style>{css}</style><FloatingBtns />
        <div style={S.wrap}>
          <div style={{ textAlign: "center", fontSize: 56, marginBottom: 8 }}>🏆</div>
          <div style={{ textAlign: "center", fontSize: "clamp(1.4rem,5vw,2.2rem)", fontWeight: 900, background: "linear-gradient(135deg,#FFD700,#FFA500)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", marginBottom: 6 }}>{sorted[0].name}</div>
          <p style={{ textAlign: "center", color: "#888", fontSize: 13, marginBottom: 28, letterSpacing: ".1em", textTransform: "uppercase" }}>Ganador con {formatScore(sorted[0].score)} puntos</p>
          <div style={S.card}>
            <span style={S.label}>Ranking</span>
            {sorted.map((p, i) => (
              <div key={i} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 0", borderBottom: i < sorted.length - 1 ? "1px solid rgba(255,255,255,.05)" : "none", animation: `fadeIn .4s ${i * .08}s both` }}>
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}><span style={{ fontSize: i < 3 ? 24 : 16, width: 32, textAlign: "center" }}>{i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : `${i + 1}`}</span><span style={{ fontWeight: 600 }}>{p.name}</span></div>
                <span style={{ fontWeight: 800, fontSize: 18, color: i === 0 ? GL : "#888" }}>{formatScore(p.score)}</span>
              </div>
            ))}
          </div>
          <div style={S.card}>
            <span style={S.label}>Timeline completo</span>
            <div style={{ position: "relative", paddingLeft: 20 }}>
              <div style={{ position: "absolute", left: 8, top: 0, bottom: 0, width: 2, background: `linear-gradient(180deg,${G},rgba(29,185,84,.2))` }} />
              {finalTimeline.map((s, i) => (
                <div key={i} style={{ display: "flex", alignItems: "flex-start", gap: 8, padding: "10px 0", animation: `slideIn .4s ${i * .05}s both`, position: "relative", flexWrap: "wrap" }}>
                  <div style={{ position: "absolute", left: -16, top: 14, width: 10, height: 10, borderRadius: "50%", background: G, border: `2px solid ${DARK}` }} />
                  <span style={{ fontWeight: 800, fontSize: 14, color: GL, minWidth: 40, fontVariantNumeric: "tabular-nums", flexShrink: 0 }}>{s.year}</span>
                  <span style={{ fontSize: 13, color: "#ccc", flex: 1, minWidth: 0, wordBreak: "break-word" }}>{s.song} <span style={{ fontSize: 11, color: "#666" }}>– {s.artist}</span></span>
                </div>
              ))}
            </div>
          </div>
          <div style={{ textAlign: "center", marginTop: 20 }}><button style={S.btn(`linear-gradient(135deg,${G},${GL})`, "#000")} onClick={resetGame}>Jugar de Nuevo</button></div>
        </div>
      </div>
    );
  }

  const pct = ((turnIndex + 1) / (numRounds * players.length)) * 100;

  return (
    <div style={S.app}><div style={S.glow} /><style>{css}</style><FloatingBtns />
      <div style={S.wrap}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
          <span style={{ fontSize: 12, color: "#666", fontWeight: 600, textTransform: "uppercase", letterSpacing: ".12em" }}>Ronda {currentRound + 1}/{numRounds}</span>
          <span style={{ fontSize: 12, color: G, fontWeight: 700 }}>Turno: {currentPlayer.name}</span>
        </div>
        <div style={{ width: "100%", height: 3, background: "rgba(255,255,255,.06)", borderRadius: 2, marginBottom: 20, overflow: "hidden" }}><div style={{ width: `${pct}%`, height: "100%", background: `linear-gradient(90deg,${G},${GL})`, transition: "width .5s" }} /></div>

        {phase === "listen" && (
          <div style={{ ...S.card, textAlign: "center", animation: "fadeIn .4s both" }}>
            <div style={{ fontSize: 40, marginBottom: 12 }}>🎧</div>
            <p style={{ color: "#aaa", fontSize: 14, marginBottom: 20 }}>{currentPlayer.name}, abrí la canción en Spotify y escuchá</p>
            <a href={spotifyLink} onClick={openSpotify} style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 10, padding: "16px 32px", minHeight: 52, width: "100%", maxWidth: 320, background: G, color: "#000", borderRadius: 50, fontSize: 16, fontWeight: 800, textDecoration: "none", textTransform: "uppercase", letterSpacing: ".06em", animation: "glow 2s infinite" }}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="#000"><path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.299.421-1.02.599-1.559.3z"/></svg>
              Abrir en Spotify
            </a>
            <div style={{ marginTop: 16 }}>
              <button onClick={handleSkipSong} disabled={!canSkipSong} style={{ padding: "10px 20px", minHeight: 44, background: "rgba(255,255,255,.06)", border: "1px solid rgba(255,255,255,.12)", borderRadius: 50, color: canSkipSong ? "#aaa" : "#444", fontSize: 13, fontWeight: 600, cursor: canSkipSong ? "pointer" : "not-allowed", opacity: canSkipSong ? 1 : .4, WebkitAppearance: "none" }} title={canSkipSong ? "Cambiar a otra canción" : "No quedan canciones disponibles"}>
                🔀 Cambiar canción
              </button>
            </div>
            <div style={{ marginTop: 16 }}><button style={S.btn(`linear-gradient(135deg,${G},${GL})`, "#000")} onClick={() => setPhase("play")}>Ya escuché → Adivinar</button></div>
          </div>
        )}

        {phase === "play" && (
          <div style={{ animation: "fadeIn .4s both" }}>
            <div style={S.card}>
              <span style={S.label}>🎤 ¿Adivinó la canción y el artista?</span>
              <p style={{ fontSize: 12, color: "#666", marginTop: 0, marginBottom: 14 }}>Los demás jugadores validan</p>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                <div style={{ background: "rgba(255,255,255,.03)", borderRadius: 12, padding: 14 }}>
                  <div style={{ fontSize: 12, color: "#aaa", marginBottom: 8, fontWeight: 600, textAlign: "center" }}>Canción</div>
                  <div style={{ display: "flex", gap: 6 }}>
                    <button onClick={() => setSongCorrect(true)} style={{ ...S.btnO(songCorrect === true, GL), flex: 1, textAlign: "center", padding: "12px 6px", fontSize: 15, minHeight: 44 }}>✓</button>
                    <button onClick={() => setSongCorrect(false)} style={{ ...S.btnO(songCorrect === false, "#ff4757"), flex: 1, textAlign: "center", padding: "12px 6px", fontSize: 15, minHeight: 44 }}>✗</button>
                  </div>
                </div>
                <div style={{ background: "rgba(255,255,255,.03)", borderRadius: 12, padding: 14 }}>
                  <div style={{ fontSize: 12, color: "#aaa", marginBottom: 8, fontWeight: 600, textAlign: "center" }}>Artista</div>
                  <div style={{ display: "flex", gap: 6 }}>
                    <button onClick={() => setArtistCorrect(true)} style={{ ...S.btnO(artistCorrect === true, GL), flex: 1, textAlign: "center", padding: "12px 6px", fontSize: 15, minHeight: 44 }}>✓</button>
                    <button onClick={() => setArtistCorrect(false)} style={{ ...S.btnO(artistCorrect === false, "#ff4757"), flex: 1, textAlign: "center", padding: "12px 6px", fontSize: 15, minHeight: 44 }}>✗</button>
                  </div>
                </div>
              </div>
            </div>
            <div style={S.card}>
              <span style={S.label}>📅 Ubicá la canción en el tiempo</span>
              {isFirstSong ? (
                <div style={{ textAlign: "center", padding: "16px 0", color: "#888", fontSize: 13 }}><span style={{ fontSize: 28, display: "block", marginBottom: 8 }}>🎵</span>Primera canción: se ubica automáticamente en el timeline</div>
              ) : (
                <>
                  <p style={{ fontSize: 12, color: "#666", marginTop: 0, marginBottom: 14 }}>{currentPlayer.name}: elegí dónde ubicarla</p>
                  <div style={{ position: "relative", paddingLeft: 24 }}>
                    <div style={{ position: "absolute", left: 12, top: 0, bottom: 0, width: 2, background: "rgba(255,255,255,.08)" }} />
                    <button onClick={() => setSelectedSlot(0)} style={{ display: "flex", alignItems: "center", gap: 8, width: "100%", padding: "14px 14px", marginBottom: 4, minHeight: 48, background: selectedSlot === 0 ? "rgba(29,185,84,.15)" : "rgba(255,255,255,.02)", border: selectedSlot === 0 ? `2px solid ${G}` : "2px dashed rgba(255,255,255,.1)", borderRadius: 10, cursor: "pointer", color: selectedSlot === 0 ? GL : "#555", fontSize: 13, fontWeight: 600, position: "relative" }}>
                      <div style={{ position: "absolute", left: -18, width: 8, height: 8, borderRadius: "50%", background: selectedSlot === 0 ? G : "rgba(255,255,255,.15)" }} />
                      {selectedSlot === 0 ? "▶ Aquí (antes de todo)" : "↑ Antes de todo"}
                    </button>
                    {sortedTimeline.map((s, i) => (
                      <div key={s.id}>
                        <div style={{ display: "flex", alignItems: "flex-start", gap: 8, padding: "10px 14px", position: "relative" }}>
                          <div style={{ position: "absolute", left: -18, top: 14, width: 10, height: 10, borderRadius: "50%", background: G, border: `2px solid ${DARK}` }} />
                          <span style={{ fontWeight: 800, fontSize: 14, color: GL, minWidth: 40, fontVariantNumeric: "tabular-nums", flexShrink: 0 }}>{s.year}</span>
                          <span style={{ fontSize: 13, color: "#ccc", flex: 1, minWidth: 0, wordBreak: "break-word" }}>{s.song} <span style={{ fontSize: 11, color: "#666" }}>– {s.artist}</span></span>
                        </div>
                        <button onClick={() => setSelectedSlot(i + 1)} style={{ display: "flex", alignItems: "center", gap: 8, width: "100%", padding: "14px 14px", marginBottom: 4, minHeight: 48, background: selectedSlot === i + 1 ? "rgba(29,185,84,.15)" : "rgba(255,255,255,.02)", border: selectedSlot === i + 1 ? `2px solid ${G}` : "2px dashed rgba(255,255,255,.1)", borderRadius: 10, cursor: "pointer", color: selectedSlot === i + 1 ? GL : "#555", fontSize: 13, fontWeight: 600, position: "relative" }}>
                          <div style={{ position: "absolute", left: -18, width: 8, height: 8, borderRadius: "50%", background: selectedSlot === i + 1 ? G : "rgba(255,255,255,.15)" }} />
                          {selectedSlot === i + 1 ? "▶ Aquí" : i + 1 < sortedTimeline.length ? `↕ Entre ${s.year} y ${sortedTimeline[i + 1].year}` : `↓ Después de ${s.year}`}
                        </button>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>
            <div style={{ textAlign: "center", marginTop: 4, marginBottom: 16 }}>
              <button style={{ ...S.btn(`linear-gradient(135deg,${G},${GL})`, "#000"), padding: "14px 40px", fontSize: 16, opacity: canConfirmPlay() ? 1 : .35, cursor: canConfirmPlay() ? "pointer" : "not-allowed" }} onClick={handleConfirmPlay} disabled={!canConfirmPlay()}>Confirmar Ronda</button>
            </div>
          </div>
        )}

        {phase === "result" && (
          <div style={{ ...S.card, animation: "popIn .4s both" }}>
            <div style={{ textAlign: "center", marginBottom: 16 }}>
              <span style={{ fontSize: 44, display: "block", marginBottom: 6 }}>{roundPts >= 8 ? "🎉" : roundPts >= 6 ? "👏" : roundPts > 0 ? "🤔" : "😅"}</span>
              <span style={{ fontSize: 28, fontWeight: 900, color: roundPts > 0 ? GL : "#ff4757" }}>+{formatScore(roundPts)}</span>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 16, padding: "12px 16px", background: "rgba(255,255,255,.02)", borderRadius: 12 }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}><span style={S.tag(timelineCorrect)}>{timelineCorrect ? "✓" : "✗"} Timeline</span><span style={{ fontSize: 14, fontWeight: 800, color: timelineCorrect ? GL : "#ff6b81" }}>{timelineCorrect ? "+1" : "0"}</span></div>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}><span style={S.tag(songCorrect && timelineCorrect)}>{songCorrect ? "✓" : "✗"} Canción{songCorrect && !timelineCorrect && <span style={{ fontSize: 10, marginLeft: 4, opacity: .7 }}>(no suma)</span>}</span><span style={{ fontSize: 14, fontWeight: 800, color: (songCorrect && timelineCorrect) ? GL : "#ff6b81" }}>{songCorrect && timelineCorrect ? "+⅙" : "0"}</span></div>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}><span style={S.tag(artistCorrect && timelineCorrect)}>{artistCorrect ? "✓" : "✗"} Artista{artistCorrect && !timelineCorrect && <span style={{ fontSize: 10, marginLeft: 4, opacity: .7 }}>(no suma)</span>}</span><span style={{ fontSize: 14, fontWeight: 800, color: (artistCorrect && timelineCorrect) ? GL : "#ff6b81" }}>{artistCorrect && timelineCorrect ? "+⅙" : "0"}</span></div>
            </div>
            {!timelineCorrect && timelineCorrect !== null && (<div style={{ textAlign: "center", padding: "8px 12px", background: "rgba(255,71,87,.08)", borderRadius: 10, marginBottom: 12, border: "1px solid rgba(255,71,87,.15)" }}><p style={{ margin: 0, fontSize: 12, color: "#ff6b81" }}>✗ Timeline incorrecto → no se suman puntos por canción ni artista</p></div>)}
            <div style={{ background: "rgba(255,255,255,.05)", borderRadius: 14, padding: "18px 16px", textAlign: "center", marginBottom: 16, border: "1px solid rgba(255,255,255,.08)" }}>
              <p style={{ margin: 0, fontSize: 11, color: "#666", textTransform: "uppercase", letterSpacing: ".1em", marginBottom: 10 }}>La canción era</p>
              <p style={{ margin: 0, fontSize: 20, fontWeight: 800, color: "#fff" }}>🎵 {currentSong.song}</p>
              <p style={{ margin: "6px 0 0", fontSize: 16, color: G, fontWeight: 700 }}>🎤 {currentSong.artist}</p>
              <p style={{ margin: "4px 0 0", fontSize: 14, color: "#999", fontWeight: 600 }}>📅 {currentSong.year}</p>
              <a href={spotifyLink} onClick={openSpotify} style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 8, marginTop: 14, padding: "10px 24px", minHeight: 44, background: G, color: "#000", borderRadius: 50, fontSize: 13, fontWeight: 800, textDecoration: "none", textTransform: "uppercase", letterSpacing: ".04em" }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="#000"><path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.299.421-1.02.599-1.559.3z"/></svg>
                Escuchar en Spotify
              </a>
            </div>
            <div style={{ marginBottom: 16 }}>
              <span style={S.label}>Timeline actualizado</span>
              <div style={{ position: "relative", paddingLeft: 24 }}>
                <div style={{ position: "absolute", left: 12, top: 0, bottom: 0, width: 2, background: `linear-gradient(180deg,${G},rgba(29,185,84,.15))` }} />
                {[...timeline].sort((a, b) => a.year - b.year).map((s, i) => {
                  const isNew = s.id === justPlaced;
                  return (
                    <div key={s.id} style={{ display: "flex", alignItems: "flex-start", gap: 8, padding: "10px 12px", position: "relative", background: isNew ? "rgba(29,185,84,.1)" : "transparent", borderRadius: 8, animation: isNew ? "highlightPulse 1.5s ease 2" : `slideIn .3s ${i * .05}s both`, border: isNew ? "1px solid rgba(29,185,84,.25)" : "1px solid transparent", marginBottom: 2, flexWrap: "wrap" }}>
                      <div style={{ position: "absolute", left: -18, top: 14, width: 10, height: 10, borderRadius: "50%", background: isNew ? "#fff" : G, border: `2px solid ${DARK}`, boxShadow: isNew ? `0 0 8px ${G}` : "none" }} />
                      <span style={{ fontWeight: 800, fontSize: 13, color: isNew ? "#fff" : GL, minWidth: 36, fontVariantNumeric: "tabular-nums", flexShrink: 0 }}>{s.year}</span>
                      <span style={{ fontSize: 12, color: isNew ? "#fff" : "#ccc", fontWeight: isNew ? 700 : 400, wordBreak: "break-word", flex: 1, minWidth: 0 }}>{s.song} <span style={{ fontSize: 10, color: isNew ? "rgba(255,255,255,.7)" : "#666" }}>– {s.artist}</span></span>
                      {isNew && <span style={{ fontSize: 9, color: G, fontWeight: 800, textTransform: "uppercase", letterSpacing: ".08em", flexShrink: 0 }}>NUEVA</span>}
                    </div>
                  );
                })}
              </div>
            </div>
            <div style={{ textAlign: "center" }}><button style={S.btn(`linear-gradient(135deg,${G},${GL})`, "#000")} onClick={nextTurn}>{currentRound >= numRounds - 1 && currentPlayerIdx >= players.length - 1 ? "🏆 Ver Resultados" : "Siguiente Turno →"}</button></div>
          </div>
        )}
      </div>
    </div>
  );
}

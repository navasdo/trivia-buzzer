import React, { useState, useEffect, useRef } from 'react';
import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously, onAuthStateChanged } from 'firebase/auth';
import { 
  getFirestore, 
  collection, 
  addDoc, 
  deleteDoc, 
  onSnapshot, 
  getDocs,
  doc,
  setDoc,
  updateDoc,
  arrayUnion,
  arrayRemove,
  getDoc
} from 'firebase/firestore';

// --- 0. SETTINGS & BOONS ---
const HOST_PASSWORD = "20170621"; 

const BOONS = {
  EXEC_ORDER: { 
    id: 'EXEC_ORDER', 
    name: 'Executive Order', 
    desc: 'Force a Hint Vote to PASS, regardless of the majority.',
    icon: '⚖️',
    canActivate: true
  },
  SILENCER: { 
    id: 'SILENCER', 
    name: 'The Silencer', 
    desc: 'Disable a rival team\'s buzzer for the first 1.5 seconds of a round.',
    icon: '🔇',
    canActivate: true
  },
  FILIBUSTER: { 
    id: 'FILIBUSTER', 
    name: 'The Filibuster', 
    desc: 'Force a Hint Vote to FAIL.',
    icon: '🛑',
    canActivate: true
  },
  PRIORITY: { 
    id: 'PRIORITY', 
    name: 'Priority Pass', 
    desc: 'Swap places with the 1st Place team.',
    icon: '⏩',
    canActivate: true
  },
  SLINGSHOT: {
    id: 'SLINGSHOT',
    name: 'The Slingshot',
    desc: 'Jump from "Too Slow" (4th+) to 3rd Place.',
    icon: '🚀',
    canActivate: true
  },
  DOUBLE_JEOPARDY: {
    id: 'DOUBLE_JEOPARDY',
    name: 'Double Jeopardy',
    desc: 'Double or Nothing on the next round\'s opening question.',
    icon: '🎲',
    canActivate: false // Triggered by Host
  }
};

const BOON_KEYS = Object.keys(BOONS).filter(k => k !== 'DOUBLE_JEOPARDY');

// --- 1. CONFIGURATION ---
const firebaseConfig = {
  apiKey: "AIzaSyCDMkjW8F2TbzFJiSPStHaLk6TNkwzDNfg",
  authDomain: "trivia-buzzer-party.firebaseapp.com",
  projectId: "trivia-buzzer-party",
  storageBucket: "trivia-buzzer-party.firebasestorage.app",
  messagingSenderId: "1078272058046",
  appId: "1:1078272058046:web:971dc2f9d37f03437434ef"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// Helpers
const getBuzzCollection = () => collection(db, 'buzzes');
const getVoteCollection = () => collection(db, 'votes');
const getGameDoc = () => doc(db, 'game', 'state');
const getTeamDoc = (teamName) => doc(db, 'teams', teamName.toLowerCase().trim());

// --- ASSETS ---
const SOUND_POINT = "https://raw.githubusercontent.com/402-Code-Source/resource-hub/refs/heads/main/static/audio/sound-effects/positive-point.mp3";
const SOUND_HINT_ALERT = "https://raw.githubusercontent.com/navasdo/navacite/refs/heads/main/templates/static/audio/hint-alert.mp3";
const SOUND_FAIL = "https://www.myinstants.com/media/sounds/wrong-answer-sound-effect.mp3"; 
const SOUND_TADA = "https://www.myinstants.com/media/sounds/tada-fanfare-sound-effect.mp3";
const SOUND_SPINNER = "https://raw.githubusercontent.com/navasdo/trivia-buzzer/refs/heads/main/source/audio/spinner.mp3";
const SOUND_BOON_SELECTED = "https://raw.githubusercontent.com/navasdo/trivia-buzzer/refs/heads/main/source/audio/boon-selected.mp3";
const SOUND_BOON_USED = "https://raw.githubusercontent.com/navasdo/trivia-buzzer/refs/heads/main/source/audio/boon-used.mp3";
const SOUND_BOON_SPENT = "https://raw.githubusercontent.com/navasdo/trivia-buzzer/refs/heads/main/source/audio/boon-spent.mp3";

const ICON_1ST = "https://img.icons8.com/?size=400&id=fhHdSZSmx78s&format=png&color=000000";
const ICON_2ND = "https://img.icons8.com/?size=400&id=zBacThauoQFN&format=png&color=000000";
const ICON_3RD = "https://img.icons8.com/?size=400&id=HXPvlWjuDyzs&format=png&color=000000";
const ICON_SLOW = "https://img.icons8.com/?size=400&id=48261&format=png&color=000000";
const ICON_HINT = "https://img.icons8.com/?size=400&id=44818&format=png&color=000000";

// --- COMPONENTS ---

const Loading = () => (
  <div className="min-h-screen bg-gray-900 flex items-center justify-center">
    <div className="animate-spin rounded-full h-16 w-16 border-t-4 border-b-4 border-cyan-400"></div>
  </div>
);

const Landing = ({ onChooseRole }) => {
  const [showPassword, setShowPassword] = useState(false);
  const [passwordInput, setPasswordInput] = useState("");
  const [error, setError] = useState("");

  const handleHostLogin = (e) => {
    e.preventDefault();
    if (passwordInput === HOST_PASSWORD) {
      onChooseRole('host');
    } else {
      setError("Incorrect Password");
      setPasswordInput("");
    }
  };

  if (showPassword) {
    return (
      <div className="min-h-screen bg-gray-900 flex flex-col items-center justify-center p-6 text-center font-sans">
        <div className="w-full max-w-md bg-gray-800 p-8 rounded-2xl border border-pink-500 shadow-[0_0_20px_rgba(236,72,153,0.3)]">
          <h2 className="text-2xl font-black text-white mb-6 uppercase tracking-widest">Host Access</h2>
          <form onSubmit={handleHostLogin} className="space-y-4">
            <input 
              type="password" 
              value={passwordInput}
              onChange={(e) => setPasswordInput(e.target.value)}
              placeholder="Enter Password"
              className="w-full bg-gray-900 border-2 border-gray-700 rounded-lg p-4 text-white text-xl focus:border-pink-500 focus:outline-none text-center"
              autoFocus
            />
            {error && <p className="text-red-500 font-bold animate-pulse">{error}</p>}
            <div className="flex gap-4">
              <button 
                type="button"
                onClick={() => setShowPassword(false)}
                className="flex-1 bg-gray-700 hover:bg-gray-600 text-white font-bold py-4 rounded-lg"
              >
                BACK
              </button>
              <button 
                type="submit"
                className="flex-1 bg-pink-600 hover:bg-pink-500 text-white font-black py-4 rounded-lg uppercase tracking-wider"
              >
                LOGIN
              </button>
            </div>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-950 via-purple-950 to-indigo-950 flex flex-col items-center justify-center p-6 text-center font-sans">
      <h1 className="text-5xl font-black text-white italic mb-2 tracking-tighter" style={{ textShadow: '0 0 10px #ec4899' }}>
        TRIVIA <span className="text-cyan-400" style={{ textShadow: '0 0 10px #22d3ee' }}>BUZZER</span>
      </h1>
      <p className="text-gray-300 mb-12 text-lg">
  “Knowledge is power. Petty is fun.”
  <span className="block italic">— Daniel Navas</span>
</p>

      <div className="space-y-6 w-full max-w-md">
        <button 
          onClick={() => onChooseRole('player')}
          className="w-full bg-gray-800 border-2 border-cyan-400 hover:bg-cyan-900/30 text-cyan-300 font-bold text-2xl py-6 rounded-xl transition-all shadow-[0_0_15px_rgba(34,211,238,0.3)]"
        >
          I AM A PLAYER
        </button>
        <button 
          onClick={() => setShowPassword(true)}
          className="w-full bg-gray-800 border-2 border-pink-500 hover:bg-pink-900/30 text-pink-400 font-bold text-xl py-4 rounded-xl transition-all"
        >
          I AM THE HOST
        </button>
      </div>
    </div>
  );
};

// --- VISUAL COMPONENTS ---
const NotificationOverlay = ({ data }) => {
    if (!data) return null;
    const isGood = data.type === 'GOOD';
    return (
      <div className={`fixed top-4 right-4 z-[100] bg-gray-900 border-2 ${isGood ? 'border-green-400' : 'border-red-500'} p-4 rounded-xl shadow-2xl animate-in slide-in-from-right fade-in duration-300 max-w-sm`}>
          <div className="flex items-center gap-4">
              <div className="text-4xl">{data.icon}</div>
              <div>
                  <div className={`${isGood ? 'text-green-400' : 'text-red-500'} font-bold text-xs uppercase tracking-widest`}>{data.title}</div>
                  <div className="text-white font-black text-lg leading-tight">{data.message}</div>
                  {data.sub && <div className="text-gray-400 text-sm">{data.sub}</div>}
              </div>
          </div>
      </div>
    );
};

// --- HOST VIEW ---
const HostView = ({ buzzes, gameState, votes, onResetBuzzers, onSetMode, onClearVotes, onSelectBoon, onSpinBoon, onOpenBuzzers, onStartGauntlet, onGauntletDecision, onFactoryReset, onOfferDoubleJeopardy }) => {
  const [timer, setTimer] = useState(60);
  const [votingTimeLeft, setVotingTimeLeft] = useState(100); 
  const [notification, setNotification] = useState(null); 
  
  const prevBuzzCount = useRef(0);
  const hintProcessed = useRef(false);
  const hintAudioRef = useRef(null);
  const spinAudioRef = useRef(null);

  // Sound: Buzz
  useEffect(() => {
    if (gameState?.mode === 'LIGHTNING' && gameState?.boonRound?.phase === 'BUZZING' && buzzes.length > prevBuzzCount.current) {
      new Audio(SOUND_POINT).play().catch(e => console.log(e));
    }
    prevBuzzCount.current = buzzes.length;
  }, [buzzes, gameState?.mode, gameState?.boonRound?.phase]);

  // Sound: Spin Cycle & Reveal
  useEffect(() => {
    if (gameState?.boonRound?.phase === 'SPINNING') {
        const audio = new Audio(SOUND_SPINNER);
        audio.play().catch(e => console.log(e));
        spinAudioRef.current = audio;

        // Fade out in last 1 second (total 4s)
        let start = Date.now();
        const fadeInt = setInterval(() => {
            const elapsed = Date.now() - start;
            if (elapsed > 3000 && spinAudioRef.current) {
                // Fade from 1 to 0 over 1000ms
                const vol = Math.max(0, 1 - ((elapsed - 3000) / 1000));
                spinAudioRef.current.volume = vol;
            }
            if (elapsed >= 4000) clearInterval(fadeInt);
        }, 100);

        return () => { clearInterval(fadeInt); if(spinAudioRef.current) spinAudioRef.current.pause(); }
    }
    if (gameState?.boonRound?.phase === 'REVEAL') {
        if(spinAudioRef.current) spinAudioRef.current.pause();
        new Audio(SOUND_BOON_SELECTED).play().catch(e => console.log(e));
    }
  }, [gameState?.boonRound?.phase]);

  // Sound & Notify: Boon Used
  useEffect(() => {
      if (gameState?.activeBoonUsage) {
          const { boonId, teamName, timestamp } = gameState.activeBoonUsage;
          if (Date.now() - timestamp < 5000) {
              const boon = BOONS[boonId];
              setNotification({ type: 'GOOD', icon: boon.icon, title: 'BOON ACTIVATED', message: boon.name, sub: `By ${teamName}` });
              new Audio(SOUND_BOON_USED).play().catch(e => console.log(e));
              const t = setTimeout(() => setNotification(null), 4000);
              return () => clearTimeout(t);
          }
      }
  }, [gameState?.activeBoonUsage]);

  // Sound & Notify: Double Jeopardy Decision
  useEffect(() => {
      if (gameState?.djResult) {
          const { outcome, team, timestamp } = gameState.djResult;
          if (Date.now() - timestamp < 5000) {
              if (outcome === 'ACCEPTED') {
                  setNotification({ type: 'GOOD', icon: '🎲', title: 'DOUBLE JEOPARDY', message: 'ACCEPTED!', sub: `${team} is going for it!` });
                  new Audio(SOUND_BOON_SPENT).play().catch(e => console.log(e));
              } else {
                  setNotification({ type: 'BAD', icon: '🛑', title: 'DOUBLE JEOPARDY', message: 'REJECTED', sub: `${team} played it safe.` });
                  new Audio(SOUND_FAIL).play().catch(e => console.log(e));
              }
              const t = setTimeout(() => setNotification(null), 4000);
              return () => clearTimeout(t);
          }
      }
  }, [gameState?.djResult]);


  // Hint Logic (Same as before)
  useEffect(() => {
    if (gameState?.hintRequest && !hintProcessed.current) {
      hintProcessed.current = true;
      const audio = new Audio(SOUND_HINT_ALERT);
      audio.play().catch(e => console.log(e));
      hintAudioRef.current = audio;
      
      let start = Date.now();
      const dur = 10000;
      const int = setInterval(() => {
        const el = Date.now() - start;
        const pct = Math.max(0, 100 - (el / dur) * 100);
        setVotingTimeLeft(pct);
        if (hintAudioRef.current && pct <= 20) hintAudioRef.current.volume = pct / 20;
        if (el >= dur) clearInterval(int);
      }, 100);
      return () => { clearInterval(int); if(hintAudioRef.current) hintAudioRef.current.pause(); };
    }
    if (!gameState?.hintRequest) {
      hintProcessed.current = false;
      setVotingTimeLeft(100);
      if(hintAudioRef.current) hintAudioRef.current.pause();
    }
  }, [gameState?.hintRequest]);

  // Main 60s Timer Logic
  useEffect(() => {
    let interval;
    if (gameState?.mode === 'HINT' && !gameState?.hintRequest && timer > 0) {
      interval = setInterval(() => setTimer(t => t - 1), 1000);
    }
    return () => clearInterval(interval);
  }, [gameState?.mode, gameState?.hintRequest, timer]);

  const acceptCount = votes.filter(v => v.vote === 'accept').length;
  const rejectCount = votes.filter(v => v.vote === 'reject').length;
  const voteResult = votingTimeLeft === 0 ? (acceptCount > rejectCount ? 'PASSED' : 'REJECTED') : 'VOTING';

  // Result Sound
  const resultSoundPlayed = useRef(false);
  useEffect(() => {
    if (votingTimeLeft === 0 && !resultSoundPlayed.current && gameState?.hintRequest) {
      resultSoundPlayed.current = true;
      if (hintAudioRef.current) { hintAudioRef.current.pause(); hintAudioRef.current = null; }
      if (acceptCount > rejectCount) new Audio(SOUND_POINT).play();
      else new Audio(SOUND_FAIL).play();
    }
    if (votingTimeLeft > 0) resultSoundPlayed.current = false;
  }, [votingTimeLeft, acceptCount, rejectCount, gameState?.hintRequest]);


  // --- HOST RENDER ---
  
  // Double Jeopardy Overlay (Host View)
  const DJOverlay = () => gameState?.djOffer ? (
      <div className="fixed bottom-4 left-4 right-4 z-[90] bg-purple-900/90 border-t-4 border-purple-500 p-6 backdrop-blur-md animate-in slide-in-from-bottom">
          <div className="flex justify-between items-center max-w-4xl mx-auto">
              <div>
                  <h3 className="text-purple-300 font-bold uppercase tracking-widest mb-1">DOUBLE JEOPARDY OFFERED TO:</h3>
                  <div className="text-4xl font-black text-white">{gameState.djOffer.team}</div>
              </div>
              <div className="text-5xl animate-pulse">🎲</div>
          </div>
      </div>
  ) : null;

  // 1. Dashboard (No Mode)
  if (!gameState?.mode || gameState.mode === 'LOBBY') {
    return (
      <div className="min-h-screen bg-gray-900 text-white flex flex-col items-center justify-center p-6 space-y-8 relative">
        <NotificationOverlay data={notification} />
        <DJOverlay />
        <h2 className="text-4xl font-black italic mb-8">SELECT MODE</h2>
        <button onClick={() => onSetMode('LIGHTNING')} className="w-full max-w-md bg-cyan-600 hover:bg-cyan-500 text-white font-black text-3xl py-8 rounded-xl shadow-lg border-b-8 border-cyan-800 active:border-b-0 active:translate-y-2">⚡ LIGHTNING ROUND</button>
        <button onClick={() => { setTimer(60); onSetMode('HINT'); }} className="w-full max-w-md bg-pink-600 hover:bg-pink-500 text-white font-black text-3xl py-8 rounded-xl shadow-lg border-b-8 border-pink-800 active:border-b-0 active:translate-y-2">⏱️ START HINT CLOCK</button>
        
        {/* Double Jeopardy Trigger Section - AUTO DETECT */}
        {gameState?.lastWinner?.boonId === 'DOUBLE_JEOPARDY' && (
             <div className="w-full max-w-md bg-purple-900/50 p-6 rounded-xl border-2 border-purple-500 mt-8 animate-pulse text-center">
                 <h3 className="text-purple-200 font-bold uppercase mb-2">Double Jeopardy Winner</h3>
                 <div className="text-2xl font-black text-white mb-4">{gameState.lastWinner.team}</div>
                 <button 
                    onClick={() => onOfferDoubleJeopardy(gameState.lastWinner.team)}
                    className="w-full bg-purple-600 hover:bg-purple-500 text-white font-black text-xl py-4 rounded-lg shadow-lg border-b-4 border-purple-800 active:border-b-0 active:translate-y-1"
                 >
                    TRIGGER DECISION
                 </button>
             </div>
        )}

        {/* Manual Override Section */}
        <div className="w-full max-w-md bg-gray-800 p-4 rounded-xl border border-gray-700 mt-8">
            <h3 className="text-gray-400 text-sm font-bold uppercase mb-4">Manual DJ Override</h3>
            <div className="flex gap-2">
                <input id="djTeamInput" type="text" placeholder="Enter Team Name" className="flex-1 bg-gray-900 border border-gray-600 rounded px-4 text-white" />
                <button 
                    onClick={() => {
                        const team = document.getElementById('djTeamInput').value;
                        if(team) onOfferDoubleJeopardy(team);
                    }}
                    className="bg-gray-600 hover:bg-gray-500 text-white font-bold px-4 py-2 rounded"
                >
                    OFFER
                </button>
            </div>
        </div>

        <div className="mt-12 pt-8 border-t border-gray-800 w-full max-w-md text-center">
            <button 
                onClick={onFactoryReset}
                className="text-red-500 text-sm font-bold opacity-50 hover:opacity-100 uppercase tracking-widest border border-red-900 hover:border-red-500 px-4 py-2 rounded transition-all"
            >
                ⚠️ Factory Reset (New Party)
            </button>
        </div>
      </div>
    );
  }

  // 2. Lightning Round
  if (gameState.mode === 'LIGHTNING') {
    const topThree = buzzes.slice(0, 3);
    const boonRound = gameState.boonRound;

    // PHASE 2: SPINNING & REVEAL (Auto triggered on entry)
    if (boonRound?.phase === 'SPINNING' || boonRound?.phase === 'REVEAL') {
      const isSpinning = boonRound.phase === 'SPINNING';
      return (
        <div className="min-h-screen bg-gray-900 flex flex-col items-center justify-center p-6 text-center relative">
           <NotificationOverlay data={notification} />
           <h1 className="text-gray-400 font-bold uppercase tracking-widest mb-4">{isSpinning ? 'SELECTING PRIZE...' : 'PRIZE LOCKED:'}</h1>
           
           {/* Spin/Reveal Box */}
           <div className={`bg-gray-800 p-12 rounded-2xl border-4 ${isSpinning ? 'border-gray-600' : 'border-yellow-500 shadow-[0_0_40px_rgba(234,179,8,0.2)]'} mb-12 duration-300`}>
              <BoonSpinner active={isSpinning} targetBoon={BOONS[boonRound.boonId]} />
           </div>
           
           {!isSpinning && (
               <button 
                 onClick={onOpenBuzzers}
                 className="w-full max-w-xl bg-green-600 hover:bg-green-500 text-white font-black text-4xl py-8 rounded-xl shadow-lg border-b-8 border-green-800 active:border-b-0 active:translate-y-2 uppercase tracking-widest"
               >
                 OPEN BUZZERS
               </button>
           )}
        </div>
      );
    }

    // PHASE 3: BUZZING (Host sees list + Lock button)
    if (boonRound?.phase === 'BUZZING') {
      return (
        <div className="min-h-screen bg-gray-900 text-white p-6 font-sans relative">
          <NotificationOverlay data={notification} />
          <div className="max-w-3xl mx-auto">
            <header className="flex justify-between items-center mb-8 border-b border-gray-700 pb-4">
              <div className="text-yellow-400 font-bold">PRIZE: {BOONS[boonRound.boonId].name}</div>
              <h2 className="text-2xl font-bold text-cyan-400 uppercase tracking-widest">LIVE FEED</h2>
            </header>

            <div className="grid grid-cols-2 gap-4 mb-8">
               <button onClick={onResetBuzzers} className="bg-gray-700 hover:bg-gray-600 text-white font-bold text-xl py-4 rounded-lg border-b-4 border-gray-900 active:border-b-0 active:translate-y-1">ABORT</button>
               <button 
                  disabled={buzzes.length === 0}
                  onClick={onStartGauntlet} 
                  className={`text-white font-bold text-xl py-4 rounded-lg shadow-lg uppercase tracking-widest border-b-4 active:border-b-0 active:translate-y-1 ${buzzes.length > 0 ? 'bg-red-600 hover:bg-red-500 border-red-800' : 'bg-gray-700 border-gray-800 opacity-50 cursor-not-allowed'}`}
               >
                  LOCK & START GAUNTLET
               </button>
            </div>

            <div className="space-y-6">
              {topThree.length === 0 ? <div className="text-center text-gray-600 py-12 italic text-xl border-2 border-dashed border-gray-800 rounded-xl">Waiting for buzzers...</div> : 
                topThree.map((buzz, index) => (
                 <div key={buzz.id} className={`relative p-4 rounded-xl border flex items-center justify-between transition-all duration-500 ${index === 0 ? 'bg-cyan-900/40 border-cyan-400 shadow-[0_0_20px_rgba(34,211,238,0.4)] scale-105 my-6' : 'bg-gray-800 border-gray-700'}`}>
                    <div className="flex items-center gap-6">
                      <img src={index === 0 ? ICON_1ST : index === 1 ? ICON_2ND : ICON_3RD} className="w-16 h-16 object-contain filter invert" />
                      <span className={`font-bold text-3xl ${index === 0 ? 'text-white' : 'text-gray-300'}`}>{buzz.teamName}</span>
                    </div>
                    <span className="text-gray-500 font-mono text-xl opacity-50">#{index + 1}</span>
                 </div>
              ))}
            </div>
          </div>
        </div>
      );
    }

    // PHASE 4: GAUNTLET (Host controls strikes)
    if (boonRound?.phase === 'GAUNTLET') {
       const step = boonRound.step || 1;
       const currentTeam = buzzes[step - 1];
       const boon = BOONS[boonRound.boonId];

       return (
         <div className="min-h-screen bg-gray-900 flex flex-col items-center justify-center p-6 text-center relative">
            <NotificationOverlay data={notification} />
            <h1 className="text-4xl text-yellow-400 font-black mb-2 animate-pulse">FOR THE BOON:</h1>
            <div className="text-6xl mb-8">{boon.icon} {boon.name}</div>
            
            <div className="bg-gray-800 p-8 rounded-xl border-4 border-white mb-8 w-full max-w-2xl">
               <h3 className="text-gray-400 text-xl uppercase tracking-widest mb-2">Current Contender</h3>
               <h2 className="text-5xl font-black text-white mb-4">{currentTeam?.teamName || "NO ONE LEFT!"}</h2>
               <div className="text-sm font-mono text-gray-500">Attempt #{step} of {Math.min(3, buzzes.length)}</div>
            </div>

            {currentTeam && (
              <div className="flex gap-4 w-full max-w-2xl">
                <button onClick={() => onGauntletDecision(currentTeam.teamName, boon.id, true)} className="flex-1 bg-green-600 hover:bg-green-500 text-white py-6 rounded-xl font-black text-3xl border-b-8 border-green-800 active:border-b-0 active:translate-y-2">CORRECT!</button>
                <button onClick={() => onGauntletDecision(currentTeam.teamName, boon.id, false)} className="flex-1 bg-red-600 hover:bg-red-500 text-white py-6 rounded-xl font-black text-3xl border-b-8 border-red-800 active:border-b-0 active:translate-y-2">WRONG</button>
              </div>
            )}
            
            {!currentTeam && (
               <button onClick={onResetBuzzers} className="bg-gray-700 text-white px-8 py-4 rounded-lg font-bold">END ROUND</button>
            )}
         </div>
       );
    }
    
    // Fallback if state is just 'LIGHTNING' but no boon round phase
    return (
        <div className="min-h-screen bg-gray-900 text-white flex flex-col items-center justify-center p-6 text-center">
            <div className="text-2xl font-bold mb-4">Resuming Lightning Round...</div>
            <button onClick={() => onSetMode('LOBBY')} className="bg-red-600 hover:bg-red-500 text-white font-bold py-3 px-8 rounded-lg shadow-lg">CANCEL & GO TO LOBBY</button>
        </div>
    );
  }

  // 3. Hint Clock (RESTORED VISUALS)
  if (gameState.mode === 'HINT') {
     return (
        <div className="min-h-screen bg-gray-900 text-white p-6 flex flex-col items-center relative">
           <NotificationOverlay data={notification} />
           <header className="w-full max-w-4xl flex justify-between mb-8 pb-4 border-b border-gray-700"><button onClick={() => {onSetMode('LOBBY'); onClearVotes();}} className="text-gray-500 font-bold hover:text-white">← EXIT</button><h2 className="text-2xl font-bold text-pink-500 uppercase tracking-widest">HINT CLOCK</h2></header>
           <div className="text-[12rem] font-black text-white leading-none tracking-tighter mb-8 tabular-nums">{timer}</div>
           {!gameState.hintRequest && <div className="text-gray-500 text-xl font-bold uppercase tracking-widest">Waiting for requests...</div>}
           {gameState.hintRequest && (
              <div className="fixed inset-0 bg-black/90 z-50 flex flex-col items-center justify-center p-4 animate-in fade-in duration-300">
                 <h1 className="text-4xl md:text-6xl font-black text-yellow-400 mb-6 text-center animate-pulse">HINT REQUESTED!</h1>
                 <h2 className="text-2xl text-gray-300 mb-8 uppercase tracking-widest">By Team: <span className="text-white font-bold">{gameState.hintRequest.team}</span></h2>
                 <div className="w-full max-w-2xl bg-gray-800 rounded-xl p-8 border-2 border-gray-600 relative overflow-hidden">
                    <div className="flex justify-between items-start mb-8">
                       <div className="w-1/3">
                          <h3 className="text-green-400 font-bold uppercase mb-4 border-b border-green-400/30 pb-2">Accepted ({acceptCount})</h3>
                          <div className="space-y-2">{votes.filter(v => v.vote === 'accept').map(v => (<div key={v.id} className="text-sm font-bold truncate text-white">{v.teamName}</div>))}</div>
                       </div>
                       <div className="w-1/3 flex justify-center"><img src={ICON_HINT} className="w-24 h-24 object-contain filter invert" /></div>
                       <div className="w-1/3 text-right">
                          <h3 className="text-red-400 font-bold uppercase mb-4 border-b border-red-400/30 pb-2">Rejected ({rejectCount})</h3>
                          <div className="space-y-2">{votes.filter(v => v.vote === 'reject').map(v => (<div key={v.id} className="text-sm font-bold truncate text-white">{v.teamName}</div>))}</div>
                       </div>
                    </div>
                    {votingTimeLeft > 0 ? (
                       <div className="w-full h-4 bg-gray-700 rounded-full overflow-hidden"><div className="h-full bg-yellow-400 transition-all duration-100 ease-linear" style={{width: `${votingTimeLeft}%`}}></div></div>
                    ) : (
                       <div className={`text-center text-4xl font-black uppercase py-4 ${voteResult === 'PASSED' ? 'text-green-400':'text-red-500'}`}>VOTE {voteResult}!</div>
                    )}
                 </div>
                 <button onClick={onClearVotes} className="mt-12 px-8 py-3 bg-gray-800 hover:bg-gray-700 text-gray-400 font-bold rounded-lg border border-gray-600 uppercase tracking-widest">Clear & Resume</button>
              </div>
           )}
        </div>
     );
  }
};

// --- VISUAL COMPONENTS ---
const BoonSpinner = ({ active, targetBoon }) => {
    const [displayBoon, setDisplayBoon] = useState(targetBoon || Object.values(BOONS)[0]);
    useEffect(() => {
        if (active) {
            // Cycle through display only
            const boons = BOON_KEYS.map(k => BOONS[k]);
            const int = setInterval(() => {
                setDisplayBoon(boons[Math.floor(Math.random() * boons.length)]);
            }, 100);
            return () => clearInterval(int);
        } else {
            setDisplayBoon(targetBoon);
        }
    }, [active, targetBoon]);

    return (
        <div className="text-center">
            <div className="text-8xl mb-4">{displayBoon?.icon}</div>
            <h2 className="text-5xl font-black text-white mb-2">{displayBoon?.name}</h2>
            <p className="text-xl text-gray-300 max-w-lg">{displayBoon?.desc}</p>
        </div>
    );
};

const PlayerView = ({ buzzes, gameState, votes, onBuzz, onHintRequest, onVote, onUseBoon, onDjDecision, teamName, setTeamName, hasJoined, setHasJoined, inventory }) => {
  const [showInventory, setShowInventory] = useState(false);

  // DJ Offer Timer
  const [djTimer, setDjTimer] = useState(10);
  useEffect(() => {
      if (gameState?.djOffer && gameState.djOffer.team === teamName) {
          const int = setInterval(() => {
              const left = Math.max(0, Math.ceil((gameState.djOffer.expiresAt - Date.now()) / 1000));
              setDjTimer(left);
              if (left <= 0) {
                  clearInterval(int);
                  onDjDecision(false); // AUTO REJECT ON TIMEOUT
              }
          }, 1000);
          return () => clearInterval(int);
      }
  }, [gameState?.djOffer, teamName, onDjDecision]);

  // --- INVENTORY DRAWER ---
  const InventoryDrawer = () => (
     <div className="fixed inset-0 bg-black/95 z-50 flex flex-col p-6 animate-in slide-in-from-bottom duration-300">
        <div className="flex justify-between items-center mb-8">
           <h2 className="text-3xl font-black text-white italic">YOUR BOONS</h2>
           <button onClick={() => setShowInventory(false)} className="text-gray-400 text-xl font-bold">CLOSE</button>
        </div>
        {(!inventory || inventory.length === 0) ? (
           <div className="text-center text-gray-500 mt-20">No boons collected... yet.</div>
        ) : (
           <div className="grid gap-4 overflow-y-auto">
              {inventory.map((boonId, i) => {
                 const boon = BOONS[boonId];
                 return (
                    <div key={i} className="bg-gray-800 p-4 rounded-xl border border-gray-700 flex justify-between items-center">
                       <div className="flex items-center gap-4">
                           <div className="text-4xl">{boon?.icon}</div>
                           <div>
                              <div className="font-bold text-white">{boon?.name}</div>
                              <div className="text-xs text-gray-400 max-w-[200px]">{boon?.desc}</div>
                           </div>
                       </div>
                       {boon?.canActivate && (
                           <button 
                             onClick={() => { onUseBoon(boon.id); setShowInventory(false); }}
                             className="bg-yellow-500 text-black font-black text-sm px-4 py-2 rounded-lg hover:bg-yellow-400"
                           >
                               USE
                           </button>
                       )}
                    </div>
                 )
              })}
           </div>
        )}
     </div>
  );

  // --- JOIN SCREEN ---
  if (!hasJoined) {
    return (
      <div className="min-h-screen bg-gray-900 flex flex-col items-center justify-center p-6">
        <div className="w-full max-w-md bg-gray-800 p-8 rounded-2xl border border-gray-700 shadow-2xl">
          <h2 className="text-3xl font-black text-center text-white mb-6 uppercase italic">Identify Yourself</h2>
          <form onSubmit={(e) => { e.preventDefault(); if(teamName.trim()) setHasJoined(true); }} className="space-y-6">
            <input type="text" value={teamName} onChange={(e) => setTeamName(e.target.value)} className="w-full bg-gray-900 border-2 border-gray-600 rounded-lg p-4 text-white text-xl font-bold" placeholder="e.g. The Quizzards" maxLength={20} />
            <button type="submit" className="w-full bg-gradient-to-r from-pink-600 to-purple-600 text-white font-black text-xl py-4 rounded-lg uppercase tracking-widest shadow-lg">Enter Game</button>
          </form>
        </div>
      </div>
    );
  }

  // --- DJ OFFER OVERLAY ---
  if (gameState?.djOffer && gameState.djOffer.team === teamName) {
      return (
          <div className="min-h-screen bg-purple-900 flex flex-col items-center justify-center p-6 text-center animate-in zoom-in duration-300">
              <div className="text-6xl mb-6 animate-bounce">🎲</div>
              <h1 className="text-4xl font-black text-white mb-2">DOUBLE JEOPARDY!</h1>
              <p className="text-purple-200 mb-8 text-lg">Double points on the next question?</p>
              
              <div className="text-8xl font-black text-white mb-8">{djTimer}</div>

              <div className="space-y-4 w-full max-w-sm">
                  <button onClick={() => onDjDecision(true)} className="w-full bg-green-500 hover:bg-green-400 text-black font-black text-2xl py-6 rounded-xl shadow-lg transform active:scale-95">ACCEPT (SPEND BOON)</button>
                  <button onClick={() => onDjDecision(false)} className="w-full bg-gray-800 hover:bg-gray-700 text-gray-400 font-bold text-xl py-4 rounded-xl border border-gray-600">REJECT</button>
              </div>
          </div>
      );
  }

  // --- BOON PRIZE OVERLAY ---
  if (gameState?.boonRound && (gameState.boonRound.phase === 'SPINNING' || gameState.boonRound.phase === 'REVEAL')) {
     const isSpinning = gameState.boonRound.phase === 'SPINNING';
     // Use local spinner for smooth animation on client
     return (
        <div className="min-h-screen bg-indigo-900 flex flex-col items-center justify-center p-6 text-center animate-in fade-in duration-500">
           <div className="text-yellow-400 font-black text-2xl mb-4 uppercase tracking-widest">{isSpinning ? 'SPINNING...' : 'PRIZE ROUND!'}</div>
           <BoonSpinner active={isSpinning} targetBoon={BOONS[gameState.boonRound.boonId]} />
           <div className="mt-12 text-sm font-bold text-indigo-400 animate-pulse">GET READY...</div>
        </div>
     )
  }

  // --- LIGHTNING ROUND (REFACTORED for Safety) ---
  if (gameState?.mode === 'LIGHTNING') {
     const boonRound = gameState.boonRound;
     const phase = boonRound?.phase;

     // BUZZING PHASE
     if (phase === 'BUZZING') {
        const myBuzzIndex = buzzes.findIndex(b => b.teamName.toLowerCase() === teamName.toLowerCase());
        const isBuzzed = myBuzzIndex !== -1;
        const firstBuzzTime = buzzes.length > 0 ? buzzes[0].timestamp : null;
        const [timeLeft, setTimeLeft] = useState(0);

        useEffect(() => {
           if (firstBuzzTime && !isBuzzed) {
              const int = setInterval(() => {
                 const diff = 5000 - (Date.now() - firstBuzzTime);
                 if (diff <= 0) { setTimeLeft(0); clearInterval(int); } else setTimeLeft(diff);
              }, 30);
              return () => clearInterval(int);
           } else if (!firstBuzzTime) setTimeLeft(5000);
        }, [firstBuzzTime, isBuzzed]);

        const isWindowClosed = firstBuzzTime && (Date.now() - firstBuzzTime > 5000);
        const isLocked = !isBuzzed && isWindowClosed;
        const showCountdown = !isBuzzed && firstBuzzTime && !isWindowClosed;

        return (
           <div className={`min-h-screen flex flex-col items-center justify-center p-6 transition-colors duration-500 ${isBuzzed ? 'bg-green-900' : 'bg-gray-900'}`}>
              {showInventory && <InventoryDrawer />}
              <div className="absolute top-4 right-4"><button onClick={() => setShowInventory(true)} className="flex items-center gap-2 bg-gray-800 px-4 py-2 rounded-full border border-gray-600"><span className="text-xl">🎒</span><span className="font-bold text-white">{inventory.length}</span></button></div>
              <div className="absolute top-6 left-0 right-0 text-center"><span className="text-gray-500 text-sm font-bold uppercase tracking-widest">Playing as</span><h3 className="text-white text-2xl font-black italic">{teamName}</h3></div>
              
              <div className="mb-12 text-center h-20 flex items-center justify-center">
                 {isBuzzed ? <div className="animate-bounce"><h1 className="text-6xl font-black text-white drop-shadow-lg">BUZZED!</h1><p className="text-xl text-green-300 font-bold mt-2">Rank: #{myBuzzIndex+1}</p></div> : 
                  showCountdown ? <div><h1 className="text-6xl font-black text-red-500 animate-pulse tracking-tighter">{(timeLeft/1000).toFixed(2)}s</h1></div> :
                  isLocked ? <h1 className="text-4xl font-black text-gray-500">LOCKED OUT</h1> :
                  <h1 className="text-4xl font-black text-cyan-400 animate-pulse">READY!</h1>}
              </div>

              <button onClick={() => onBuzz(teamName)} disabled={isBuzzed || isLocked} className={`w-72 h-72 rounded-full border-8 shadow-[0_0_50px_rgba(0,0,0,0.5)] flex items-center justify-center transition-all duration-200 ${isBuzzed ? 'bg-green-500 border-green-300 scale-110' : isLocked ? 'bg-gray-800 border-gray-600 opacity-50 cursor-not-allowed scale-90' : 'bg-red-600 border-red-400 hover:bg-red-500 active:bg-red-700 shadow-[0_0_40px_#dc2626]'}`}>
                 <span className="text-4xl font-black text-white uppercase tracking-widest pointer-events-none select-none">{isBuzzed ? 'LOCKED' : 'BUZZ'}</span>
              </button>
           </div>
        );
     }

     // GAUNTLET PHASE
     if (phase === 'GAUNTLET') {
        const step = boonRound.step || 1;
        const currentTeam = buzzes[step-1]?.teamName || "Nobody";
        const boon = BOONS[boonRound.boonId];
        
        return (
           <div className="min-h-screen bg-indigo-900 flex flex-col items-center justify-center p-6 text-center animate-in fade-in duration-500">
              <div className="text-gray-400 font-bold uppercase tracking-widest mb-4">Current Contender</div>
              <h1 className="text-5xl font-black text-white mb-8">{currentTeam}</h1>
              <div className="bg-indigo-800 p-6 rounded-xl border border-indigo-600">
                 <div className="text-sm text-indigo-300 uppercase mb-1">Playing For</div>
                 <div className="text-2xl font-bold text-white">{boon?.icon} {boon?.name}</div>
              </div>
           </div>
        );
     }
     
     // Fallback for safety inside Lightning mode (Prevents Blank Screen)
     return (
        <div className="min-h-screen bg-gray-900 flex flex-col items-center justify-center p-6 text-center">
           <div className="animate-pulse text-xl text-cyan-400 font-bold">Get Ready...</div>
        </div>
     );
  }

  // --- LOBBY/HINT DEFAULT ---
  return (
     <div className="min-h-screen bg-gray-900 flex flex-col items-center justify-center p-6 text-center">
        {showInventory && <InventoryDrawer />}
        <div className="absolute top-4 right-4">
           <button onClick={() => setShowInventory(true)} className="flex items-center gap-2 bg-gray-800 px-4 py-2 rounded-full border border-gray-600">
              <span className="text-xl">🎒</span>
              <span className="font-bold text-white">{inventory.length}</span>
           </button>
        </div>
        
        {gameState?.mode === 'HINT' && !gameState.hintRequest && (
           <button onClick={() => onHintRequest(teamName)} className="w-64 h-64 rounded-xl bg-yellow-500 border-4 border-yellow-300 shadow-[0_0_40px_rgba(234,179,8,0.4)] flex flex-col items-center justify-center hover:bg-yellow-400 active:scale-95 transition-all">
              <img src={ICON_HINT} className="w-24 h-24 mb-4 filter invert opacity-80" />
              <span className="text-2xl font-black text-black uppercase tracking-widest">REQUEST HINT</span>
           </button>
        )}
        
        {gameState?.mode === 'HINT' && gameState.hintRequest && (
           <div className="bg-gray-800 p-8 rounded-xl border border-gray-700 max-w-sm w-full">
              <h3 className="text-yellow-400 font-bold mb-4">HINT REQUESTED BY {gameState.hintRequest.team}</h3>
              {gameState.hintRequest.team === teamName || votes.some(v => v.teamName === teamName) ? <div className="text-green-400 font-bold">Waiting for result...</div> : (
                 <div className="space-y-4">
                    <button onClick={() => onVote(teamName, 'accept')} className="w-full bg-green-600 text-white font-bold py-4 rounded">ACCEPT</button>
                    <button onClick={() => onVote(teamName, 'reject')} className="w-full bg-red-600 text-white font-bold py-4 rounded">REJECT</button>
                 </div>
              )}
           </div>
        )}

        {(!gameState?.mode || gameState.mode === 'LOBBY' || (gameState.mode === 'LIGHTNING' && !gameState.boonRound)) && (
           <div className="animate-pulse text-xl text-cyan-400 font-bold">Waiting for host...</div>
        )}
     </div>
  );
};

// --- MAIN APP ---
export default function App() {
  const [user, setUser] = useState(null);
  const [role, setRole] = useState(null);
  const [teamName, setTeamName] = useState('');
  const [hasJoined, setHasJoined] = useState(false);
  const [inventory, setInventory] = useState([]);
  
  const [buzzes, setBuzzes] = useState([]);
  const [votes, setVotes] = useState([]);
  const [gameState, setGameState] = useState({ mode: 'LOBBY' });

  // A. Auth
  useEffect(() => { signInAnonymously(auth); onAuthStateChanged(auth, setUser); }, []);

  // B. Subscriptions
  useEffect(() => {
    if (!user) return;
    const u1 = onSnapshot(getBuzzCollection(), (s) => setBuzzes(s.docs.map(d=>({id:d.id,...d.data()})).sort((a,b)=>a.timestamp-b.timestamp)));
    const u2 = onSnapshot(getGameDoc(), (d) => setGameState(d.exists() ? d.data() : {mode:'LOBBY'}));
    const u3 = onSnapshot(getVoteCollection(), (s) => setVotes(s.docs.map(d=>({id:d.id,...d.data()}))));
    return () => { u1(); u2(); u3(); };
  }, [user]);

  // C. Inventory Sync
  useEffect(() => {
    if (!user || !teamName || role === 'host') return;
    const docRef = getTeamDoc(teamName);
    const unsub = onSnapshot(docRef, (docSnap) => {
       if (docSnap.exists()) {
          setInventory(docSnap.data().inventory || []);
       } else {
          setDoc(docRef, { inventory: [] }, { merge: true });
       }
    });
    return () => unsub();
  }, [user, teamName, role]);

  // Actions
  const handleBuzz = (team) => addDoc(getBuzzCollection(), { teamName: team, timestamp: Date.now(), userId: user.uid });
  const handleResetBuzzers = async () => {
     updateDoc(getGameDoc(), { boonRound: null });
     const snap = await getDocs(getBuzzCollection());
     snap.docs.forEach(d => deleteDoc(d.ref));
  };
  
  // Updated Set Mode Logic for Auto-Spin
  const handleSetMode = async (mode) => {
     const data = { mode };
     if(mode==='HINT') data.hintRequest = null;
     
     if (mode === 'LIGHTNING') {
         // Auto-calculate next boon
         const currentState = gameState; // Local read safest for immediate action
         const usedBoons = currentState.usedBoons || [];
         let available = BOON_KEYS.filter(k => !usedBoons.includes(k));
         let newUsed = usedBoons;
         
         if (available.length === 0) {
             // Reset cycle
             available = BOON_KEYS;
             newUsed = [];
         }
         
         // Pick random
         const pickedId = available[Math.floor(Math.random() * available.length)];
         newUsed = [...newUsed, pickedId];
         
         data.usedBoons = newUsed;
         data.boonRound = {
             boonId: pickedId,
             phase: 'SPINNING',
             timestamp: Date.now()
         };
         
         // Auto-transition to Reveal after 4s
         setTimeout(() => {
             updateDoc(getGameDoc(), { 'boonRound.phase': 'REVEAL' });
         }, 4000);
     }
     
     setDoc(getGameDoc(), data, { merge: true });
  }
  
  const handleHintRequest = (team) => updateDoc(getGameDoc(), { hintRequest: { team, timestamp: Date.now() }});
  const handleVote = (team, vote) => addDoc(getVoteCollection(), { teamName: team, vote, userId: user.uid });
  const handleClearVotes = async () => {
     const snap = await getDocs(getVoteCollection());
     snap.docs.forEach(d => deleteDoc(d.ref));
     updateDoc(getGameDoc(), { hintRequest: null });
  };

  // Not used in new auto-flow, but kept for safety
  const handleSelectBoon = (boonId) => {
     updateDoc(getGameDoc(), { 
        boonRound: { selectedBoonId: boonId, phase: null } 
     });
  };

  const handleSpinBoon = () => {
     const boonId = gameState.boonRound.selectedBoonId;
     // Start spin
     updateDoc(getGameDoc(), { 'boonRound.phase': 'SPINNING', 'boonRound.boonId': boonId });
     // Auto reveal after 4s
     setTimeout(() => {
         updateDoc(getGameDoc(), { 'boonRound.phase': 'REVEAL' });
     }, 4000);
  };
  
  const handleOpenBuzzers = () => {
     updateDoc(getGameDoc(), { 
        'boonRound.phase': 'BUZZING' 
     });
  };

  const handleStartGauntlet = () => {
     updateDoc(getGameDoc(), { 
        'boonRound.phase': 'GAUNTLET',
        'boonRound.step': 1
     });
  };

  const handleGauntletDecision = (winningTeamName, boonId, success) => {
     if (success && winningTeamName && boonId) {
        new Audio(SOUND_POINT).play();
        const teamRef = getTeamDoc(winningTeamName);
        updateDoc(teamRef, { inventory: arrayUnion(boonId) });
        // --- NEW: Track winner for Lobby shortcut ---
        updateDoc(getGameDoc(), { lastWinner: { team: winningTeamName, boonId } });
        updateDoc(getGameDoc(), { boonRound: null }); // End round
        handleResetBuzzers();
     } else {
        // Wrong answer
        new Audio(SOUND_FAIL).play();
        const currentStep = gameState.boonRound.step || 1;
        if (currentStep >= 3 || currentStep >= buzzes.length) {
           // Round Failed completely
           updateDoc(getGameDoc(), { boonRound: null });
           handleResetBuzzers();
        } else {
           // Next team
           updateDoc(getGameDoc(), { 'boonRound.step': currentStep + 1 });
        }
     }
  };

  const handleUseBoon = (boonId) => {
      // Just update game state to notify host
      updateDoc(getGameDoc(), {
          activeBoonUsage: {
              boonId,
              teamName,
              timestamp: Date.now()
          }
      });
      // Logic for inventory removal or effect is manual for most, or could be automated.
      // For now, we assume simple usage notification. 
      // If single use, remove:
      const teamRef = getTeamDoc(teamName);
      updateDoc(teamRef, { inventory: arrayRemove(boonId) });
  };

  const handleOfferDoubleJeopardy = (teamName) => {
      updateDoc(getGameDoc(), {
          djOffer: { team: teamName, expiresAt: Date.now() + 10000 }
      });
  };

  const handleDjDecision = (accepted) => {
      const team = gameState.djOffer.team;
      if (accepted) {
          // Accepted
          const teamRef = getTeamDoc(team);
          updateDoc(teamRef, { inventory: arrayRemove('DOUBLE_JEOPARDY') });
          updateDoc(getGameDoc(), { 
              djOffer: null, 
              djResult: { outcome: 'ACCEPTED', team, timestamp: Date.now() },
              lastBoonSpent: { boonId: 'DOUBLE_JEOPARDY', timestamp: Date.now() } 
          });
      } else {
          // Rejected
          updateDoc(getGameDoc(), { 
              djOffer: null,
              djResult: { outcome: 'REJECTED', team, timestamp: Date.now() }
          });
      }
  };

  const handleFactoryReset = async () => {
     if (window.confirm("⚠️ DANGER: This will wipe ALL teams, inventories, and game history for a new party. This cannot be undone. Proceed?")) {
        const clearCol = async (colRef) => {
           const snap = await getDocs(colRef);
           const promises = snap.docs.map(d => deleteDoc(d.ref));
           await Promise.all(promises);
        };

        await clearCol(getBuzzCollection());
        await clearCol(getVoteCollection());
        await clearCol(collection(db, 'teams'));
        
        setDoc(getGameDoc(), { mode: 'LOBBY' });
     }
  };

  // Render Logic
  if (!user) return <Loading />;
  
  if (!role) {
     return <Landing onChooseRole={setRole} />;
  }

  if (role === 'host') {
    return (
      <HostView 
        buzzes={buzzes} 
        gameState={gameState} 
        votes={votes}
        onResetBuzzers={handleResetBuzzers} 
        onSetMode={handleSetMode}
        onClearVotes={handleClearVotes}
        onSelectBoon={handleSelectBoon}
        onSpinBoon={handleSpinBoon}
        onOpenBuzzers={handleOpenBuzzers}
        onStartGauntlet={handleStartGauntlet}
        onGauntletDecision={handleGauntletDecision}
        onFactoryReset={handleFactoryReset}
        onOfferDoubleJeopardy={handleOfferDoubleJeopardy}
      />
    );
  }

  return (
    <PlayerView 
      buzzes={buzzes} 
      gameState={gameState} 
      votes={votes}
      onBuzz={handleBuzz}
      onHintRequest={handleHintRequest}
      onVote={handleVote}
      onUseBoon={handleUseBoon}
      onDjDecision={handleDjDecision}
      teamName={teamName}
      setTeamName={setTeamName}
      hasJoined={hasJoined}
      setHasJoined={setHasJoined}
      inventory={inventory}
    />
  );
}
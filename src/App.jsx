import React, { useState, useEffect, useRef } from 'react';
import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously, onAuthStateChanged } from 'firebase/auth';
import { 
  getFirestore, 
  collection, 
  addDoc, 
  deleteDoc, 
  onSnapshot, 
  query, 
  getDocs,
  doc,
  setDoc,
  updateDoc
} from 'firebase/firestore';

// --- 0. SETTINGS ---
// CHANGE THIS PASSWORD!
const HOST_PASSWORD = "20170621"; 

// --- 1. CONFIGURATION & SETUP ---
// We are now using YOUR specific project configuration.
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

// --- ASSETS ---
const SOUND_POINT = "https://raw.githubusercontent.com/402-Code-Source/resource-hub/refs/heads/main/static/audio/sound-effects/positive-point.mp3";
const SOUND_HINT_ALERT = "https://raw.githubusercontent.com/navasdo/navacite/refs/heads/main/templates/static/audio/hint-alert.mp3";
const SOUND_FAIL = "https://www.myinstants.com/media/sounds/wrong-answer-sound-effect.mp3"; 

const ICON_1ST = "https://img.icons8.com/?size=400&id=fhHdSZSmx78s&format=png&color=000000";
const ICON_2ND = "https://img.icons8.com/?size=400&id=fhHdSZSmx78s&format=png&color=000000";
const ICON_3RD = "https://img.icons8.com/?size=400&id=HXPvlWjuDyzs&format=png&color=000000";
const ICON_SLOW = "https://img.icons8.com/?size=400&id=48261&format=png&color=000000";
const ICON_HINT = "https://img.icons8.com/?size=400&id=44818&format=png&color=000000";

// --- 2. COMPONENTS ---

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
  “Learn a bit. Gloat a lot.”
  <span className="block italic">— Daniel ‘Brown Bear’ Navas</span>
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

// --- HOST VIEW ---
const HostView = ({ buzzes, gameState, votes, onResetBuzzers, onSetMode, onClearVotes }) => {
  const [timer, setTimer] = useState(60);
  const [votingTimeLeft, setVotingTimeLeft] = useState(100); 
  const prevBuzzCount = useRef(0);
  const hintProcessed = useRef(false);

  // Sound Effect: Buzzer
  useEffect(() => {
    if (gameState?.mode === 'LIGHTNING' && buzzes.length > prevBuzzCount.current) {
      new Audio(SOUND_POINT).play().catch(e => console.log("Audio blocked", e));
    }
    prevBuzzCount.current = buzzes.length;
  }, [buzzes, gameState?.mode]);

  // Sound Effect & Logic: Hint Request
  useEffect(() => {
    if (gameState?.hintRequest && !hintProcessed.current) {
      hintProcessed.current = true;
      new Audio(SOUND_HINT_ALERT).play().catch(e => console.log("Audio blocked", e));
      
      let startTime = Date.now();
      const duration = 10000; 
      
      const interval = setInterval(() => {
        const elapsed = Date.now() - startTime;
        const pct = Math.max(0, 100 - (elapsed / duration) * 100);
        setVotingTimeLeft(pct);

        if (elapsed >= duration) {
          clearInterval(interval);
        }
      }, 100);
      
      return () => clearInterval(interval);
    }
    if (!gameState?.hintRequest) {
      hintProcessed.current = false;
      setVotingTimeLeft(100);
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

  // Calculate Vote Results
  const acceptCount = votes.filter(v => v.vote === 'accept').length;
  const rejectCount = votes.filter(v => v.vote === 'reject').length;
  const voteResult = votingTimeLeft === 0 ? (acceptCount > rejectCount ? 'PASSED' : 'REJECTED') : 'VOTING';

  // Play result sound once when voting ends
  const resultSoundPlayed = useRef(false);
  useEffect(() => {
    if (votingTimeLeft === 0 && !resultSoundPlayed.current && gameState?.hintRequest) {
      resultSoundPlayed.current = true;
      if (acceptCount > rejectCount) {
        new Audio(SOUND_POINT).play();
      } else {
        new Audio(SOUND_FAIL).play();
      }
    }
    if (votingTimeLeft > 0) resultSoundPlayed.current = false;
  }, [votingTimeLeft, acceptCount, rejectCount, gameState?.hintRequest]);


  // --- RENDER HOST ---
  
  if (!gameState?.mode || gameState.mode === 'LOBBY') {
    return (
      <div className="min-h-screen bg-gray-900 text-white flex flex-col items-center justify-center p-6 space-y-8">
        <h2 className="text-4xl font-black text-white italic mb-8">SELECT MODE</h2>
        <button 
          onClick={() => onSetMode('LIGHTNING')}
          className="w-full max-w-md bg-cyan-600 hover:bg-cyan-500 text-white font-black text-3xl py-8 rounded-xl shadow-lg uppercase tracking-widest border-b-8 border-cyan-800 transition-all active:translate-y-2 active:border-b-0"
        >
          ⚡ LIGHTNING ROUND
        </button>
        <button 
          onClick={() => { setTimer(60); onSetMode('HINT'); }}
          className="w-full max-w-md bg-pink-600 hover:bg-pink-500 text-white font-black text-3xl py-8 rounded-xl shadow-lg uppercase tracking-widest border-b-8 border-pink-800 transition-all active:translate-y-2 active:border-b-0"
        >
          ⏱️ START HINT CLOCK
        </button>
      </div>
    );
  }

  // 2. Lightning Round
  if (gameState.mode === 'LIGHTNING') {
    const topThree = buzzes.slice(0, 3);
    const tooSlow = buzzes.slice(3);
    return (
      <div className="min-h-screen bg-gray-900 text-white p-6 font-sans">
        <div className="max-w-3xl mx-auto">
          <header className="flex justify-between items-center mb-8 border-b border-gray-700 pb-4">
            <button onClick={() => onSetMode('LOBBY')} className="text-gray-500 hover:text-white font-bold">← BACK</button>
            <h2 className="text-2xl font-bold text-cyan-400 uppercase tracking-widest">Lightning Round</h2>
          </header>

          <button 
            onClick={onResetBuzzers}
            className="w-full mb-12 bg-red-600 hover:bg-red-500 text-white font-black text-3xl py-6 rounded-lg shadow-lg uppercase tracking-widest border-b-4 border-red-800 active:border-b-0 active:translate-y-1"
          >
            RESET BUZZERS
          </button>

          <div className="space-y-6">
            {topThree.length === 0 ? (
              <div className="text-center text-gray-600 py-12 italic text-xl border-2 border-dashed border-gray-800 rounded-xl">Waiting for players...</div>
            ) : (
              topThree.map((buzz, index) => (
                <div key={buzz.id} className={`relative p-4 rounded-xl border flex items-center justify-between transition-all duration-500 ${index === 0 ? 'bg-cyan-900/40 border-cyan-400 shadow-[0_0_20px_rgba(34,211,238,0.4)] scale-105 my-6' : 'bg-gray-800 border-gray-700'}`}>
                  <div className="flex items-center gap-6">
                    <img src={index === 0 ? ICON_1ST : index === 1 ? ICON_2ND : ICON_3RD} className="w-16 h-16 object-contain filter invert" />
                    <span className={`font-bold text-3xl ${index === 0 ? 'text-white' : 'text-gray-300'}`}>{buzz.teamName}</span>
                  </div>
                  <span className="text-gray-500 font-mono text-xl opacity-50">#{index + 1}</span>
                </div>
              ))
            )}
          </div>

          {tooSlow.length > 0 && (
            <div className="mt-16 border-t-2 border-gray-800 pt-8 opacity-75">
              <div className="flex flex-col items-center justify-center mb-6">
                <h3 className="text-2xl font-black text-gray-500 uppercase tracking-widest mb-2">Too Slow!</h3>
                <img src={ICON_SLOW} className="w-20 h-20 object-contain filter invert opacity-50" />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {tooSlow.map((buzz, i) => (
                  <div key={buzz.id} className="bg-gray-800/50 p-4 rounded-lg border border-gray-700 flex items-center justify-between text-gray-400">
                    <span className="font-bold text-lg">{buzz.teamName}</span>
                    <span className="text-xs bg-gray-700 px-2 py-1 rounded">#{i + 4}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  // 3. Hint Clock
  if (gameState.mode === 'HINT') {
    return (
      <div className="min-h-screen bg-gray-900 text-white p-6 flex flex-col items-center">
        <header className="w-full max-w-4xl flex justify-between items-center mb-8 border-b border-gray-700 pb-4">
          <button onClick={() => { onSetMode('LOBBY'); onClearVotes(); }} className="text-gray-500 hover:text-white font-bold">← EXIT</button>
          <h2 className="text-2xl font-bold text-pink-500 uppercase tracking-widest">Hint Clock</h2>
        </header>

        {/* The Timer */}
        <div className="text-[12rem] font-black text-white leading-none tracking-tighter mb-8 tabular-nums">
          {timer}
        </div>

        {/* HINT REQUEST OVERLAY */}
        {gameState.hintRequest && (
          <div className="fixed inset-0 bg-black/90 z-50 flex flex-col items-center justify-center p-4 animate-in fade-in duration-300">
             <h1 className="text-4xl md:text-6xl font-black text-yellow-400 mb-6 text-center animate-pulse">
               HINT REQUESTED!
             </h1>
             <h2 className="text-2xl text-gray-300 mb-8 uppercase tracking-widest">
               By Team: <span className="text-white font-bold">{gameState.hintRequest.team}</span>
             </h2>

             <div className="w-full max-w-2xl bg-gray-800 rounded-xl p-8 border-2 border-gray-600 relative overflow-hidden">
                <div className="flex justify-between items-start mb-8">
                  {/* Accepted Column */}
                  <div className="w-1/3">
                    <h3 className="text-green-400 font-bold uppercase mb-4 border-b border-green-400/30 pb-2">Accepted ({acceptCount})</h3>
                    <div className="space-y-2">
                      {votes.filter(v => v.vote === 'accept').map(v => (
                        <div key={v.id} className="text-sm font-bold truncate">{v.teamName}</div>
                      ))}
                    </div>
                  </div>

                  {/* Icon */}
                  <div className="w-1/3 flex justify-center">
                    <img src={ICON_HINT} className="w-24 h-24 object-contain filter invert" />
                  </div>

                  {/* Rejected Column */}
                  <div className="w-1/3 text-right">
                    <h3 className="text-red-400 font-bold uppercase mb-4 border-b border-red-400/30 pb-2">Rejected ({rejectCount})</h3>
                    <div className="space-y-2">
                      {votes.filter(v => v.vote === 'reject').map(v => (
                        <div key={v.id} className="text-sm font-bold truncate">{v.teamName}</div>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Progress Bar */}
                {votingTimeLeft > 0 ? (
                  <div className="w-full h-4 bg-gray-700 rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-yellow-400 transition-all duration-100 ease-linear"
                      style={{ width: `${votingTimeLeft}%` }}
                    />
                  </div>
                ) : (
                  <div className={`text-center text-4xl font-black uppercase py-4 ${voteResult === 'PASSED' ? 'text-green-400' : 'text-red-500'}`}>
                    VOTE {voteResult}!
                  </div>
                )}
             </div>

             <button 
               onClick={onClearVotes}
               className="mt-12 px-8 py-3 bg-gray-800 hover:bg-gray-700 text-gray-400 font-bold rounded-lg border border-gray-600"
             >
               Clear & Resume
             </button>
          </div>
        )}
      </div>
    );
  }
};


// --- PLAYER VIEW ---
const PlayerView = ({ buzzes, gameState, votes, onBuzz, onHintRequest, onVote, teamName, setTeamName, hasJoined, setHasJoined }) => {
  
  // --- JOIN SCREEN ---
  if (!hasJoined) {
    return (
      <div className="min-h-screen bg-gray-900 flex flex-col items-center justify-center p-6">
        <div className="w-full max-w-md bg-gray-800 p-8 rounded-2xl border border-gray-700 shadow-2xl">
          <h2 className="text-3xl font-black text-center text-white mb-6 uppercase italic">Identify Yourself</h2>
          <form onSubmit={(e) => { e.preventDefault(); if(teamName.trim()) setHasJoined(true); }} className="space-y-6">
            <div>
              <label className="block text-cyan-400 font-bold mb-2 uppercase text-sm tracking-wider">Team Name</label>
              <input type="text" value={teamName} onChange={(e) => setTeamName(e.target.value)} className="w-full bg-gray-900 border-2 border-gray-600 rounded-lg p-4 text-white text-xl font-bold" placeholder="e.g. The Quizzards" maxLength={20} />
            </div>
            <button type="submit" className="w-full bg-gradient-to-r from-pink-600 to-purple-600 text-white font-black text-xl py-4 rounded-lg uppercase tracking-widest shadow-lg">Enter Game</button>
          </form>
        </div>
      </div>
    );
  }

  // --- WAITING SCREEN (Lobby) ---
  if (!gameState?.mode || gameState.mode === 'LOBBY') {
    return (
      <div className="min-h-screen bg-gray-900 flex flex-col items-center justify-center p-6 text-center">
        <h2 className="text-3xl font-bold text-gray-500 mb-4">Playing as <span className="text-white">{teamName}</span></h2>
        <div className="animate-pulse text-xl text-cyan-400 font-bold">Waiting for host to start round...</div>
      </div>
    );
  }

  // --- LIGHTNING ROUND ---
  if (gameState.mode === 'LIGHTNING') {
    const myBuzzIndex = buzzes.findIndex(b => b.teamName.toLowerCase() === teamName.toLowerCase());
    const isBuzzed = myBuzzIndex !== -1;
    
    // Logic for 5s Window
    const firstBuzzTime = buzzes.length > 0 ? buzzes[0].timestamp : null;
    const [timeLeft, setTimeLeft] = useState(0);

    // Update countdown timer every 50ms
    useEffect(() => {
      if (firstBuzzTime && !isBuzzed) {
        const interval = setInterval(() => {
            const now = Date.now();
            const diff = 5000 - (now - firstBuzzTime);
            if (diff <= 0) {
                setTimeLeft(0);
                clearInterval(interval);
            } else {
                setTimeLeft(diff);
            }
        }, 30); // Fast update
        return () => clearInterval(interval);
      } else {
          // Reset if no buzzes
          if (!firstBuzzTime) setTimeLeft(5000);
      }
    }, [firstBuzzTime, isBuzzed]);

    // Locked if: Someone buzzed AND (I haven't buzzed) AND (Timer is effectively 0)
    // Note: We use a small buffer (e.g., 5000) for calculation logic, but relying on Date.now()
    const now = Date.now();
    const isWindowClosed = firstBuzzTime && (now - firstBuzzTime > 5000);
    const isLocked = !isBuzzed && isWindowClosed;
    const showCountdown = !isBuzzed && firstBuzzTime && !isWindowClosed;

    return (
      <div className={`min-h-screen flex flex-col items-center justify-center p-6 transition-colors duration-500 ${isBuzzed ? 'bg-green-900' : isLocked ? 'bg-gray-900' : 'bg-gray-900'}`}>
        <div className="absolute top-6 left-0 right-0 text-center"><span className="text-gray-500 text-sm font-bold uppercase tracking-widest">Playing as</span><h3 className="text-white text-2xl font-black italic">{teamName}</h3></div>
        
        <div className="mb-12 text-center h-20 flex items-center justify-center">
          {isBuzzed ? (
            <div className="animate-bounce"><h1 className="text-6xl font-black text-white drop-shadow-lg">BUZZED!</h1><p className="text-xl text-green-300 font-bold mt-2">Rank: #{myBuzzIndex + 1}</p></div>
          ) : isLocked ? (
            <div><h1 className="text-4xl font-black text-gray-500">LOCKED OUT</h1><p className="text-gray-400 mt-2">Someone else was faster...</p></div>
          ) : showCountdown ? (
            <div>
                 <h1 className="text-6xl font-black text-red-500 animate-pulse tracking-tighter">
                   {(timeLeft / 1000).toFixed(2)}s
                 </h1>
                 <p className="text-red-300 font-bold mt-2 uppercase">Hurry!</p>
            </div>
          ) : (
            <h1 className="text-4xl font-black text-cyan-400 animate-pulse">READY!</h1>
          )}
        </div>

        <button onClick={() => onBuzz(teamName)} disabled={isBuzzed || isLocked} className={`w-72 h-72 rounded-full border-8 shadow-[0_0_50px_rgba(0,0,0,0.5)] flex items-center justify-center transition-all duration-200 ${isBuzzed ? 'bg-green-500 border-green-300 scale-110' : isLocked ? 'bg-gray-800 border-gray-600 opacity-50 cursor-not-allowed scale-90' : 'bg-red-600 border-red-400 hover:bg-red-500 active:bg-red-700 shadow-[0_0_40px_#dc2626]'}`}>
          <span className="text-4xl font-black text-white uppercase tracking-widest pointer-events-none select-none">{isBuzzed ? 'LOCKED' : 'BUZZ'}</span>
        </button>
      </div>
    );
  }

  // --- HINT CLOCK ---
  if (gameState.mode === 'HINT') {
    // If NO hint requested yet
    if (!gameState.hintRequest) {
      return (
        <div className="min-h-screen bg-gray-900 flex flex-col items-center justify-center p-6">
          <div className="absolute top-6 left-0 right-0 text-center"><span className="text-gray-500 text-sm font-bold uppercase tracking-widest">Playing as</span><h3 className="text-white text-2xl font-black italic">{teamName}</h3></div>
          
          <div className="mb-12 text-center">
            <h2 className="text-2xl text-pink-500 font-bold mb-2">HINT CLOCK ACTIVE</h2>
            <p className="text-gray-400">Stuck? Ask for help!</p>
          </div>

          <button 
            onClick={() => onHintRequest(teamName)}
            className="w-64 h-64 rounded-xl bg-yellow-500 border-4 border-yellow-300 shadow-[0_0_40px_rgba(234,179,8,0.4)] flex flex-col items-center justify-center hover:bg-yellow-400 active:scale-95 transition-all"
          >
            <img src={ICON_HINT} className="w-24 h-24 mb-4 filter invert opacity-80" />
            <span className="text-2xl font-black text-black uppercase tracking-widest">REQUEST HINT</span>
          </button>
        </div>
      );
    }

    // If Hint REQUESTED
    const isRequester = gameState.hintRequest.team === teamName;
    const hasVoted = votes.some(v => v.teamName === teamName);

    return (
      <div className="min-h-screen bg-gray-900 flex flex-col items-center justify-center p-6 text-center">
        <h1 className="text-3xl font-black text-yellow-400 mb-2 animate-pulse">HINT REQUESTED!</h1>
        <p className="text-gray-400 mb-8">Majority of teams must accept.</p>
        
        {isRequester ? (
           <div className="bg-gray-800 p-8 rounded-xl border border-gray-700">
             <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-yellow-400 mx-auto mb-4"></div>
             <p className="text-xl font-bold text-white">Waiting for votes...</p>
           </div>
        ) : hasVoted ? (
           <div className="bg-gray-800 p-8 rounded-xl border border-gray-700">
             <p className="text-xl font-bold text-green-400">Vote Submitted</p>
           </div>
        ) : (
           <div className="space-y-4 w-full max-w-sm">
             <button onClick={() => onVote(teamName, 'accept')} className="w-full bg-green-600 hover:bg-green-500 text-white font-black text-2xl py-6 rounded-xl border-b-4 border-green-800 active:border-b-0 active:translate-y-1">
               ACCEPT
             </button>
             <button onClick={() => onVote(teamName, 'reject')} className="w-full bg-red-600 hover:bg-red-500 text-white font-black text-2xl py-6 rounded-xl border-b-4 border-red-800 active:border-b-0 active:translate-y-1">
               REJECT
             </button>
           </div>
        )}
      </div>
    );
  }
};


// --- 3. MAIN APP COMPONENT ---

export default function App() {
  const [user, setUser] = useState(null);
  const [role, setRole] = useState(null);
  const [teamName, setTeamName] = useState('');
  const [hasJoined, setHasJoined] = useState(false);
  
  const [buzzes, setBuzzes] = useState([]);
  const [votes, setVotes] = useState([]);
  const [gameState, setGameState] = useState({ mode: 'LOBBY' });

  // A. Auth
  useEffect(() => {
    const initAuth = async () => {
      await signInAnonymously(auth);
    };
    initAuth();
    onAuthStateChanged(auth, setUser);
  }, []);

  // B. Subscriptions
  useEffect(() => {
    if (!user) return;
    
    // Buzzes
    const unsubBuzz = onSnapshot(getBuzzCollection(), (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      data.sort((a, b) => a.timestamp - b.timestamp);
      setBuzzes(data);
    });

    // Game State
    const unsubGame = onSnapshot(getGameDoc(), (doc) => {
      if (doc.exists()) setGameState(doc.data());
      else setGameState({ mode: 'LOBBY' }); // Default
    });

    // Votes
    const unsubVotes = onSnapshot(getVoteCollection(), (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setVotes(data);
    });

    return () => { unsubBuzz(); unsubGame(); unsubVotes(); };
  }, [user]);

  // C. Actions
  const handleBuzz = async (team) => {
    if (!user) return;
    addDoc(getBuzzCollection(), { teamName: team, timestamp: Date.now(), userId: user.uid });
  };

  const handleResetBuzzers = async () => {
    if (!user) return;
    const snap = await getDocs(getBuzzCollection());
    snap.docs.forEach(doc => deleteDoc(doc.ref));
  };

  const handleSetMode = async (mode) => {
    if (!user) return;
    // When changing modes, we update the single GameState doc
    // If resetting to LOBBY, we might want to clear requests
    const updateData = { mode };
    if (mode === 'HINT') updateData.hintRequest = null; 
    setDoc(getGameDoc(), updateData, { merge: true });
  };

  const handleHintRequest = async (team) => {
    if (!user) return;
    updateDoc(getGameDoc(), { 
      hintRequest: { team, timestamp: Date.now() } 
    });
  };

  const handleVote = async (team, vote) => {
    if (!user) return;
    addDoc(getVoteCollection(), { teamName: team, vote, userId: user.uid });
  };

  const handleClearVotes = async () => {
    if (!user) return;
    // Clear votes collection
    const snap = await getDocs(getVoteCollection());
    snap.docs.forEach(doc => deleteDoc(doc.ref));
    // Clear hint request in state
    updateDoc(getGameDoc(), { hintRequest: null });
  };


  // --- RENDER ---
  if (!user) return <Loading />;
  
  // NOTE: Pass the role setter to Landing
  if (!role) return <Landing onChooseRole={setRole} />;

  if (role === 'host') {
    return (
      <HostView 
        buzzes={buzzes} 
        gameState={gameState} 
        votes={votes}
        onResetBuzzers={handleResetBuzzers} 
        onSetMode={handleSetMode}
        onClearVotes={handleClearVotes}
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
      teamName={teamName}
      setTeamName={setTeamName}
      hasJoined={hasJoined}
      setHasJoined={setHasJoined}
    />
  );
}
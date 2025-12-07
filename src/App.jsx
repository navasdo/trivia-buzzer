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
  arrayUnion
} from 'firebase/firestore';

// --- 0. SETTINGS & BOONS ---
const HOST_PASSWORD = "admin"; // Change this!

const BOONS = {
  EXEC_ORDER: { 
    id: 'EXEC_ORDER', 
    name: 'Executive Order', 
    desc: 'Force a Hint Vote to PASS, regardless of the majority.',
    icon: '⚖️' 
  },
  SILENCER: { 
    id: 'SILENCER', 
    name: 'The Silencer', 
    desc: 'Disable a rival team\'s buzzer for the first 3 seconds of a round.',
    icon: '🔇' 
  },
  FILIBUSTER: { 
    id: 'FILIBUSTER', 
    name: 'The Filibuster', 
    desc: 'Force a Hint Vote to FAIL.',
    icon: '🛑' 
  },
  PRIORITY: { 
    id: 'PRIORITY', 
    name: 'Priority Pass', 
    desc: 'Swap places with the 1st Place team (Playable only from 2nd or 3rd).',
    icon: '⏩' 
  },
  SLINGSHOT: {
    id: 'SLINGSHOT',
    name: 'The Slingshot',
    desc: 'Jump from "Too Slow" (4th+) to 3rd Place.',
    icon: '🚀'
  }
};

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
const getTeamDoc = (teamName) => doc(db, 'teams', teamName.toLowerCase().trim()); // Normalize IDs

// --- ASSETS ---
const SOUND_POINT = "https://raw.githubusercontent.com/402-Code-Source/resource-hub/refs/heads/main/static/audio/sound-effects/positive-point.mp3";
const SOUND_HINT_ALERT = "https://raw.githubusercontent.com/navasdo/navacite/refs/heads/main/templates/static/audio/hint-alert.mp3";
const SOUND_FAIL = "https://www.myinstants.com/media/sounds/wrong-answer-sound-effect.mp3"; 
const SOUND_TADA = "https://www.myinstants.com/media/sounds/tada-fanfare-sound-effect.mp3";

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

// DEFINED BEFORE APP USE TO PREVENT REFERENCE ERRORS
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

const HostView = ({ buzzes, gameState, votes, onResetBuzzers, onSetMode, onClearVotes, onStartGauntlet, onGauntletResult, onFactoryReset }) => {
  const [timer, setTimer] = useState(60);
  const [votingTimeLeft, setVotingTimeLeft] = useState(100); 
  const [selectedBoon, setSelectedBoon] = useState(null);
  const [gauntletStep, setGauntletStep] = useState(0); 
  
  const prevBuzzCount = useRef(0);
  const hintProcessed = useRef(false);
  const hintAudioRef = useRef(null);

  // Sound: Buzz
  useEffect(() => {
    if (gameState?.mode === 'LIGHTNING' && buzzes.length > prevBuzzCount.current) {
      new Audio(SOUND_POINT).play().catch(e => console.log(e));
    }
    prevBuzzCount.current = buzzes.length;
  }, [buzzes, gameState?.mode]);

  // Sound: Hint
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

  // Hint Logic
  const acceptCount = votes.filter(v => v.vote === 'accept').length;
  const rejectCount = votes.filter(v => v.vote === 'reject').length;
  const voteResult = votingTimeLeft === 0 ? (acceptCount > rejectCount ? 'PASSED' : 'REJECTED') : 'VOTING';

  // Play result sound once when voting ends
  const resultSoundPlayed = useRef(false);
  useEffect(() => {
    // Only trigger when time is UP and we have a request
    if (votingTimeLeft === 0 && !resultSoundPlayed.current && gameState?.hintRequest) {
      resultSoundPlayed.current = true;
      
      // Double check hint audio is paused/stopped to prevent overlap
      if (hintAudioRef.current) {
          hintAudioRef.current.pause();
          hintAudioRef.current = null;
      }

      if (acceptCount > rejectCount) {
        new Audio(SOUND_POINT).play();
      } else {
        new Audio(SOUND_FAIL).play();
      }
    }
    if (votingTimeLeft > 0) resultSoundPlayed.current = false;
  }, [votingTimeLeft, acceptCount, rejectCount, gameState?.hintRequest]);

  // --- GAUNTLET LOGIC ---
  const handleStartGauntlet = (boonId) => {
    setSelectedBoon(boonId);
    setGauntletStep(1); // Start with Team 1
    onStartGauntlet(boonId); 
    new Audio(SOUND_TADA).play();
  };

  const handleGauntletDecision = (isCorrect) => {
    const currentTeam = buzzes[gauntletStep - 1]; 
    if (!currentTeam) return;

    if (isCorrect) {
      new Audio(SOUND_POINT).play();
      onGauntletResult(currentTeam.teamName, selectedBoon, true);
      setGauntletStep(0); 
      setSelectedBoon(null);
    } else {
      new Audio(SOUND_FAIL).play();
      if (gauntletStep >= 3 || gauntletStep >= buzzes.length) {
        onGauntletResult(null, null, false); 
        setGauntletStep(0);
        setSelectedBoon(null);
      } else {
        setGauntletStep(s => s + 1);
      }
    }
  };

  // --- RENDER HOST ---
  if (!gameState?.mode || gameState.mode === 'LOBBY') {
    return (
      <div className="min-h-screen bg-gray-900 text-white flex flex-col items-center justify-center p-6 space-y-8">
        <h2 className="text-4xl font-black italic mb-8">SELECT MODE</h2>
        <button onClick={() => onSetMode('LIGHTNING')} className="w-full max-w-md bg-cyan-600 hover:bg-cyan-500 text-white font-black text-3xl py-8 rounded-xl shadow-lg border-b-8 border-cyan-800 active:border-b-0 active:translate-y-2">⚡ LIGHTNING ROUND</button>
        <button onClick={() => { setTimer(60); onSetMode('HINT'); }} className="w-full max-w-md bg-pink-600 hover:bg-pink-500 text-white font-black text-3xl py-8 rounded-xl shadow-lg border-b-8 border-pink-800 active:border-b-0 active:translate-y-2">⏱️ START HINT CLOCK</button>
        
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

  if (gameState.mode === 'LIGHTNING') {
    const topThree = buzzes.slice(0, 3);
    
    // GAUNTLET OVERLAY
    if (gauntletStep > 0 && selectedBoon) {
       const currentTeam = buzzes[gauntletStep - 1];
       return (
         <div className="min-h-screen bg-gray-900 flex flex-col items-center justify-center p-6 text-center">
            <h1 className="text-4xl text-yellow-400 font-black mb-2 animate-pulse">FOR THE BOON:</h1>
            <div className="text-6xl mb-8">{BOONS[selectedBoon].icon} {BOONS[selectedBoon].name}</div>
            
            <div className="bg-gray-800 p-8 rounded-xl border-4 border-white mb-8 w-full max-w-2xl">
               <h3 className="text-gray-400 text-xl uppercase tracking-widest mb-2">Current Contender</h3>
               <h2 className="text-5xl font-black text-white mb-4">{currentTeam?.teamName}</h2>
               <div className="text-sm font-mono text-gray-500">Attempt #{gauntletStep} of {Math.min(3, buzzes.length)}</div>
            </div>

            <div className="flex gap-4 w-full max-w-2xl">
              <button onClick={() => handleGauntletDecision(true)} className="flex-1 bg-green-600 hover:bg-green-500 text-white py-6 rounded-xl font-black text-3xl border-b-8 border-green-800 active:border-b-0 active:translate-y-2">CORRECT!</button>
              <button onClick={() => handleGauntletDecision(false)} className="flex-1 bg-red-600 hover:bg-red-500 text-white py-6 rounded-xl font-black text-3xl border-b-8 border-red-800 active:border-b-0 active:translate-y-2">WRONG</button>
            </div>
         </div>
       );
    }

    return (
      <div className="min-h-screen bg-gray-900 text-white p-6 font-sans">
        <div className="max-w-3xl mx-auto">
          <header className="flex justify-between items-center mb-8 border-b border-gray-700 pb-4">
            <button onClick={() => onSetMode('LOBBY')} className="text-gray-500 hover:text-white font-bold">← BACK</button>
            <h2 className="text-2xl font-bold text-cyan-400 uppercase tracking-widest">Lightning Round</h2>
          </header>

          <div className="grid grid-cols-2 gap-4 mb-8">
             <button onClick={onResetBuzzers} className="bg-red-600 hover:bg-red-500 text-white font-bold text-xl py-4 rounded-lg shadow-lg uppercase tracking-widest border-b-4 border-red-800 active:border-b-0 active:translate-y-1">RESET</button>
             {/* PRIZE BUTTON - Only active if we have buzzes */}
             <button 
                disabled={buzzes.length === 0}
                onClick={() => setGauntletStep(-1)} 
                className={`text-white font-bold text-xl py-4 rounded-lg shadow-lg uppercase tracking-widest border-b-4 active:border-b-0 active:translate-y-1 ${buzzes.length > 0 ? 'bg-yellow-500 hover:bg-yellow-400 border-yellow-700' : 'bg-gray-700 border-gray-800 opacity-50 cursor-not-allowed'}`}
             >
                LOCK & AWARD PRIZE
             </button>
          </div>

          {/* BOON SELECTION MODAL */}
          {gauntletStep === -1 && (
            <div className="fixed inset-0 bg-black/90 z-50 flex flex-col items-center justify-center p-6">
               <h2 className="text-3xl font-black text-white mb-6">SELECT BOON FOR THIS ROUND</h2>
               <div className="grid grid-cols-1 md:grid-cols-2 gap-4 w-full max-w-4xl overflow-y-auto max-h-[80vh]">
                  {Object.values(BOONS).map(boon => (
                     <button key={boon.id} onClick={() => handleStartGauntlet(boon.id)} className="bg-gray-800 hover:bg-gray-700 p-6 rounded-xl text-left border border-gray-600 group">
                        <div className="text-4xl mb-2">{boon.icon}</div>
                        <div className="text-xl font-bold text-white group-hover:text-yellow-400">{boon.name}</div>
                        <div className="text-sm text-gray-400">{boon.desc}</div>
                     </button>
                  ))}
               </div>
               <button onClick={() => setGauntletStep(0)} className="mt-8 text-gray-500 hover:text-white font-bold">CANCEL</button>
            </div>
          )}

          <div className="space-y-6">
            {topThree.map((buzz, index) => (
               <div key={buzz.id} className={`relative p-4 rounded-xl border flex items-center justify-between ${index === 0 ? 'bg-cyan-900/40 border-cyan-400 scale-105' : 'bg-gray-800 border-gray-700'}`}>
                  <div className="flex items-center gap-6">
                    <img src={index === 0 ? ICON_1ST : index === 1 ? ICON_2ND : ICON_3RD} className="w-16 h-16 object-contain filter invert" />
                    <span className={`font-bold text-3xl ${index === 0 ? 'text-white' : 'text-gray-300'}`}>{buzz.teamName}</span>
                  </div>
                  <span className="text-gray-500 font-mono text-xl opacity-50">#{index + 1}</span>
               </div>
            ))}
          </div>
          
          {/* Too Slow */}
          {buzzes.slice(3).length > 0 && (
             <div className="mt-12 border-t border-gray-700 pt-6">
                <div className="flex items-center justify-center gap-2 mb-4 opacity-50">
                   <img src={ICON_SLOW} className="w-8 h-8 filter invert" />
                   <h3 className="text-xl font-bold">TOO SLOW</h3>
                </div>
                <div className="grid grid-cols-2 gap-2">
                   {buzzes.slice(3).map((b,i) => (
                      <div key={b.id} className="bg-gray-800/50 p-2 rounded text-gray-400 text-sm flex justify-between">
                         <span>{b.teamName}</span>
                         <span>#{i+4}</span>
                      </div>
                   ))}
                </div>
             </div>
          )}
        </div>
      </div>
    );
  }

  // Hint Clock
  if (gameState.mode === 'HINT') {
     return (
        <div className="min-h-screen bg-gray-900 text-white p-6 flex flex-col items-center">
           <header className="w-full max-w-4xl flex justify-between mb-8 pb-4 border-b border-gray-700"><button onClick={() => {onSetMode('LOBBY'); onClearVotes();}} className="text-gray-500 font-bold">EXIT</button><h2 className="text-2xl font-bold text-pink-500">HINT CLOCK</h2></header>
           
           {!gameState.hintRequest && (
              <>
                 <div className="text-[12rem] font-black leading-none mb-8">{timer}</div>
                 <div className="text-gray-500">Waiting for requests...</div>
              </>
           )}

           {gameState.hintRequest && (
              <div className="fixed inset-0 bg-black/90 z-50 flex flex-col items-center justify-center p-4">
                 <h1 className="text-4xl text-yellow-400 font-black mb-4 animate-pulse">HINT REQUESTED!</h1>
                 <h2 className="text-2xl text-white mb-8">{gameState.hintRequest.team}</h2>
                 
                 <div className="w-full max-w-2xl bg-gray-800 rounded-xl p-8 border-2 border-gray-600">
                    <div className="flex justify-between mb-8">
                       <div className="text-green-400 font-bold">Accepted: {acceptCount}</div>
                       <div className="text-red-400 font-bold">Rejected: {rejectCount}</div>
                    </div>
                    {votingTimeLeft > 0 ? (
                       <div className="w-full h-4 bg-gray-700 rounded-full overflow-hidden"><div className="h-full bg-yellow-400" style={{width: `${votingTimeLeft}%`}}></div></div>
                    ) : (
                       <div className={`text-center text-4xl font-black ${voteResult === 'PASSED' ? 'text-green-400':'text-red-500'}`}>VOTE {voteResult}</div>
                    )}
                 </div>
                 <button onClick={onClearVotes} className="mt-12 px-8 py-3 bg-gray-800 text-gray-400 font-bold rounded border border-gray-600">Clear & Resume</button>
              </div>
           )}
        </div>
     );
  }
};

const PlayerView = ({ buzzes, gameState, votes, onBuzz, onHintRequest, onVote, teamName, setTeamName, hasJoined, setHasJoined, inventory }) => {
  const [showInventory, setShowInventory] = useState(false);

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
           <div className="grid gap-4">
              {inventory.map((boonId, i) => {
                 const boon = BOONS[boonId];
                 return (
                    <div key={i} className="bg-gray-800 p-4 rounded-xl border border-gray-700 flex gap-4 items-center">
                       <div className="text-4xl">{boon?.icon}</div>
                       <div>
                          <div className="font-bold text-white">{boon?.name}</div>
                          <div className="text-sm text-gray-400">{boon?.desc}</div>
                       </div>
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

  // --- BOON PRIZE OVERLAY ---
  if (gameState?.boonRound && gameState.boonRound.active) {
     const boon = BOONS[gameState.boonRound.boonId];
     return (
        <div className="min-h-screen bg-indigo-900 flex flex-col items-center justify-center p-6 text-center animate-pulse">
           <div className="text-yellow-400 font-black text-2xl mb-4">PRIZE ROUND!</div>
           <div className="text-8xl mb-6">{boon?.icon}</div>
           <h1 className="text-4xl text-white font-black mb-2">{boon?.name}</h1>
           <p className="text-indigo-200">{boon?.desc}</p>
           <div className="mt-12 text-sm font-bold text-indigo-400">GOOD LUCK!</div>
        </div>
     )
  }

  // --- LIGHTNING ROUND ---
  if (gameState?.mode === 'LIGHTNING') {
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
           
           <div className="absolute top-4 right-4">
              <button onClick={() => setShowInventory(true)} className="flex items-center gap-2 bg-gray-800 px-4 py-2 rounded-full border border-gray-600">
                 <span className="text-xl">🎒</span>
                 <span className="font-bold text-white">{inventory.length}</span>
              </button>
           </div>

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

        {(!gameState?.mode || gameState.mode === 'LOBBY') && (
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
  const handleSetMode = (mode) => {
     const data = { mode };
     if(mode==='HINT') data.hintRequest = null;
     setDoc(getGameDoc(), data, { merge: true });
  }
  const handleHintRequest = (team) => updateDoc(getGameDoc(), { hintRequest: { team, timestamp: Date.now() }});
  const handleVote = (team, vote) => addDoc(getVoteCollection(), { teamName: team, vote, userId: user.uid });
  const handleClearVotes = async () => {
     const snap = await getDocs(getVoteCollection());
     snap.docs.forEach(d => deleteDoc(d.ref));
     updateDoc(getGameDoc(), { hintRequest: null });
  };

  const handleStartGauntlet = (boonId) => {
     updateDoc(getGameDoc(), { 
        boonRound: { active: true, boonId: boonId } 
     });
  };
  const handleGauntletResult = (winningTeamName, boonId, success) => {
     updateDoc(getGameDoc(), { boonRound: null });
     if (success && winningTeamName && boonId) {
        const teamRef = getTeamDoc(winningTeamName);
        updateDoc(teamRef, {
           inventory: arrayUnion(boonId)
        });
     }
     handleResetBuzzers();
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
        onStartGauntlet={handleStartGauntlet}
        onGauntletResult={handleGauntletResult}
        onFactoryReset={handleFactoryReset}
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
      inventory={inventory}
    />
  );
}
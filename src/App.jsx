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
  arrayRemove
} from 'firebase/firestore';

// --- 0. SETTINGS & BOONS ---
const HOST_PASSWORD = "admin"; 
const LIGHTNING_TIMER_MS = 3500; // 3.5 Seconds

const BOONS = {
  EXEC_ORDER: { 
    id: 'EXEC_ORDER', 
    name: 'Executive Order', 
    desc: 'Force a Hint Vote to PASS, regardless of the majority.',
    icon: '⚖️',
    canActivate: true,
    requiresTarget: false
  },
  SILENCER: { 
    id: 'SILENCER', 
    name: 'The Silencer', 
    desc: 'Disable a rival team\'s buzzer for the first 1.5 seconds of a round.',
    icon: '🔇',
    canActivate: true,
    requiresTarget: true
  },
  FILIBUSTER: { 
    id: 'FILIBUSTER', 
    name: 'The Filibuster', 
    desc: 'Force a Hint Vote to FAIL.',
    icon: '🛑',
    canActivate: true,
    requiresTarget: false
  },
  PRIORITY: { 
    id: 'PRIORITY', 
    name: 'Priority Pass', 
    desc: 'Swap places with the 1st Place team.',
    icon: '⏩',
    canActivate: true,
    requiresTarget: false
  },
  SLINGSHOT: {
    id: 'SLINGSHOT',
    name: 'The Slingshot',
    desc: 'Jump from "Too Slow" (4th+) to 3rd Place.',
    icon: '🚀',
    canActivate: true,
    requiresTarget: false
  },
  DOUBLE_JEOPARDY: {
    id: 'DOUBLE_JEOPARDY',
    name: 'Double Jeopardy',
    desc: 'Double or Nothing on the next round\'s opening question.',
    icon: '🎲',
    canActivate: false
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
const getTeamsCollection = () => collection(db, 'teams');

// --- ASSETS ---
const SOUND_POINT = "https://raw.githubusercontent.com/402-Code-Source/resource-hub/refs/heads/main/static/audio/sound-effects/positive-point.mp3";
const SOUND_HINT_ALERT = "https://raw.githubusercontent.com/navasdo/navacite/refs/heads/main/templates/static/audio/hint-alert.mp3";
const SOUND_FAIL = "https://www.myinstants.com/media/sounds/wrong-answer-sound-effect.mp3"; 
const SOUND_TADA = "https://www.myinstants.com/media/sounds/tada-fanfare-sound-effect.mp3";
const SOUND_SPINNER = "https://raw.githubusercontent.com/navasdo/trivia-buzzer/refs/heads/main/source/audio/spinner.mp3";
const SOUND_BOON_SELECTED = "https://raw.githubusercontent.com/navasdo/trivia-buzzer/refs/heads/main/source/audio/boon-selected.mp3";
const SOUND_BOON_USED = "https://raw.githubusercontent.com/navasdo/trivia-buzzer/refs/heads/main/source/audio/boon-used.mp3";
const SOUND_BOON_SPENT = "https://raw.githubusercontent.com/navasdo/trivia-buzzer/refs/heads/main/source/audio/boon-spent.mp3";
const SOUND_HYPER_FOCUS = "https://raw.githubusercontent.com/navasdo/trivia-buzzer/refs/heads/main/source/audio/hyper-focus.mp3";

const ICON_1ST = "https://img.icons8.com/?size=400&id=fhHdSZSmx78s&format=png&color=000000";
const ICON_2ND = "https://img.icons8.com/?size=400&id=zBacThauoQFN&format=png&color=000000";
const ICON_3RD = "https://img.icons8.com/?size=400&id=HXPvlWjuDyzs&format=png&color=000000";
const ICON_SLOW = "https://img.icons8.com/?size=400&id=48261&format=png&color=000000";
const ICON_HINT = "https://img.icons8.com/?size=400&id=44818&format=png&color=000000";

// --- SUB-COMPONENTS ---

const Loading = () => (
  <div className="min-h-screen bg-gray-900 flex items-center justify-center">
    <div className="animate-spin rounded-full h-16 w-16 border-t-4 border-b-4 border-cyan-400"></div>
  </div>
);

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

const BoonSpinner = ({ active, targetBoon }) => {
    const [displayBoon, setDisplayBoon] = useState(targetBoon || Object.values(BOONS)[0]);
    useEffect(() => {
        if (active) {
            const boons = BOON_KEYS.map(k => BOONS[k]);
            const int = setInterval(() => {
                setDisplayBoon(boons[Math.floor(Math.random() * boons.length)]);
            }, 100);
            return () => clearInterval(int);
        } else {
            if (targetBoon && displayBoon?.id !== targetBoon?.id) {
                setDisplayBoon(targetBoon);
            }
        }
    }, [active, targetBoon, displayBoon]);

    return (
        <div className="text-center">
            <div className="text-8xl mb-4">{displayBoon?.icon}</div>
            <h2 className="text-5xl font-black text-white mb-2">{displayBoon?.name}</h2>
            <p className="text-xl text-gray-300 max-w-lg">{displayBoon?.desc}</p>
        </div>
    );
};

const HintVotingDashboard = ({ hintRequest, votes, votingTimeLeft, voteResult, acceptCount, rejectCount }) => (
    <div className="w-full max-w-2xl bg-gray-800 rounded-xl p-8 border-2 border-gray-600 relative overflow-hidden animate-in zoom-in duration-300">
        <h1 className="text-4xl md:text-5xl font-black text-yellow-400 mb-6 text-center animate-pulse">HINT REQUESTED!</h1>
        <h2 className="text-2xl text-gray-300 mb-8 uppercase tracking-widest text-center">By: <span className="text-white font-bold">{hintRequest.team}</span></h2>
        
        <div className="flex justify-between items-start mb-8">
            {/* Accepted Column */}
            <div className="w-1/3 text-center">
                <h3 className="text-green-400 font-bold uppercase mb-4 border-b border-green-400/30 pb-2">Accepted ({acceptCount})</h3>
                <div className="space-y-2">
                    {votes.filter(v => v.vote === 'accept').map(v => (
                        <div key={v.id} className="text-sm font-bold truncate text-white">{v.teamName}</div>
                    ))}
                </div>
            </div>

            {/* Icon */}
            <div className="w-1/3 flex justify-center">
                <img src={ICON_HINT} className="w-24 h-24 object-contain filter invert" />
            </div>

            {/* Rejected Column */}
            <div className="w-1/3 text-center">
                <h3 className="text-red-400 font-bold uppercase mb-4 border-b border-red-400/30 pb-2">Rejected ({rejectCount})</h3>
                <div className="space-y-2">
                    {votes.filter(v => v.vote === 'reject').map(v => (
                        <div key={v.id} className="text-sm font-bold truncate text-white">{v.teamName}</div>
                    ))}
                </div>
            </div>
        </div>

        {/* Progress Bar */}
        {votingTimeLeft > 0 ? (
            <div className="w-full h-4 bg-gray-700 rounded-full overflow-hidden">
                <div className="h-full bg-yellow-400 transition-all duration-100 ease-linear" style={{ width: `${votingTimeLeft}%` }}></div>
            </div>
        ) : (
            <div className={`text-center text-4xl font-black uppercase py-4 ${voteResult === 'PASSED' ? 'text-green-400' : 'text-red-500'}`}>
                VOTE {voteResult}!
            </div>
        )}
    </div>
);

const InventoryDrawer = ({ inventory = [], onClose, onUseBoon, allTeams = [], currentTeamName }) => {
    const [selectedBoon, setSelectedBoon] = useState(null);

    const handleUse = (boonId) => {
        const boon = BOONS[boonId];
        if (boon.requiresTarget) {
            setSelectedBoon(boonId); 
        } else {
            onUseBoon(boonId, null);
            onClose();
        }
    };

    const handleTargetSelection = (targetTeam) => {
        onUseBoon(selectedBoon, targetTeam);
        onClose();
    };

    if (selectedBoon) {
        // Filter out self
        const targets = allTeams.filter(t => t.name && t.name.toLowerCase() !== currentTeamName.toLowerCase());
        
        return (
            <div className="fixed inset-0 bg-black/95 z-[200] flex flex-col p-6 items-center justify-center text-center animate-in zoom-in duration-200">
                <h3 className="text-2xl font-bold text-white mb-6 uppercase tracking-widest">Select Target</h3>
                
                {targets.length === 0 ? (
                    <div className="text-gray-500 mb-6">No rival teams found.</div>
                ) : (
                    <div className="grid grid-cols-2 gap-4 w-full max-w-md overflow-y-auto max-h-[60vh] mb-6">
                        {targets.map(team => (
                            <button 
                                key={team.id}
                                onClick={() => handleTargetSelection(team.name)}
                                className="bg-gray-800 hover:bg-gray-700 border-2 border-gray-600 hover:border-red-500 text-white font-bold py-4 rounded-xl active:scale-95 transition-all"
                            >
                                {team.name}
                            </button>
                        ))}
                    </div>
                )}

                <button onClick={() => setSelectedBoon(null)} className="bg-gray-700 px-8 py-3 rounded-lg text-white font-bold">CANCEL</button>
            </div>
        );
    }

    return (
        <div className="fixed inset-0 bg-black/95 z-[200] flex flex-col p-6 animate-in slide-in-from-bottom duration-300">
            <div className="flex justify-between items-center mb-8">
            <h2 className="text-3xl font-black text-white italic">YOUR BOONS</h2>
            <button onClick={onClose} className="text-gray-400 text-xl font-bold">CLOSE</button>
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
                            <button onClick={() => handleUse(boon.id)} className="bg-yellow-500 text-black font-black text-sm px-4 py-2 rounded-lg hover:bg-yellow-400">USE</button>
                        )}
                        </div>
                    )
                })}
            </div>
            )}
        </div>
    );
};

// --- HYPER SPACE BACKGROUND EFFECT (CANVAS VERSION) ---
const HyperSpaceBg = () => {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    let width = window.innerWidth;
    let height = window.innerHeight;
    canvas.width = width;
    canvas.height = height;
    
    // Star properties
    const stars = [];
    const numStars = 200; 
    const speed = 15; 
    const cx = width / 2;
    const cy = height / 2;

    for (let i = 0; i < numStars; i++) {
      stars.push({
        x: (Math.random() - 0.5) * width * 2,
        y: (Math.random() - 0.5) * height * 2,
        z: Math.random() * width
      });
    }

    let animationFrameId;

    const render = () => {
      // Clear with trail effect for motion blur
      ctx.fillStyle = 'rgba(0, 0, 0, 0.3)'; 
      ctx.fillRect(0, 0, width, height);
      
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 2;

      stars.forEach(star => {
        star.z -= speed;

        if (star.z <= 0) {
          star.z = width;
          star.x = (Math.random() - 0.5) * width * 2;
          star.y = (Math.random() - 0.5) * height * 2;
        }

        const k = 128.0 / star.z;
        const px = star.x * k + cx;
        const py = star.y * k + cy;

        // Previous pos (trail)
        const prevZ = star.z + speed * 2;
        const prevK = 128.0 / prevZ;
        const prevPx = star.x * prevK + cx;
        const prevPy = star.y * prevK + cy;

        if (px >= 0 && px <= width && py >= 0 && py <= height) {
             const size = (1 - star.z / width) * 3;
             ctx.lineWidth = size;
             ctx.beginPath();
             ctx.moveTo(prevPx, prevPy);
             ctx.lineTo(px, py);
             ctx.stroke();
        }
      });

      animationFrameId = requestAnimationFrame(render);
    };

    render();

    const handleResize = () => {
      width = window.innerWidth;
      height = window.innerHeight;
      canvas.width = width;
      canvas.height = height;
    };
    
    window.addEventListener('resize', handleResize);

    return () => {
      cancelAnimationFrame(animationFrameId);
      window.removeEventListener('resize', handleResize);
    };
  }, []);

  return <canvas ref={canvasRef} className="absolute inset-0 z-0 bg-black pointer-events-none" />;
};

// Isolated Buzzer Component
const LightningBuzzer = ({ buzzes = [], teamName, onBuzz, inventory = [], showInventory, setShowInventory, onUseBoon, gameState, allTeams = [] }) => {
    const myBuzzIndex = buzzes.findIndex(b => b.teamName && b.teamName.toLowerCase() === teamName.toLowerCase());
    const isBuzzed = myBuzzIndex !== -1;
    const firstBuzzTime = buzzes.length > 0 ? buzzes[0].timestamp : null;
    const [timeLeft, setTimeLeft] = useState(LIGHTNING_TIMER_MS);

    // Silencer Logic
    const [silencedTime, setSilencedTime] = useState(0);
    const silencerInfo = gameState?.silenced?.find(s => s.target.toLowerCase() === teamName.toLowerCase());
    
    useEffect(() => {
        if (silencerInfo && !isBuzzed) {
            setSilencedTime(1500);
            const int = setInterval(() => {
                setSilencedTime(prev => Math.max(0, prev - 100));
            }, 100);
            return () => clearInterval(int);
        }
    }, [silencerInfo, isBuzzed]);

    useEffect(() => {
       if (firstBuzzTime && !isBuzzed) {
          const int = setInterval(() => {
             const diff = LIGHTNING_TIMER_MS - (Date.now() - firstBuzzTime);
             if (diff <= 0) { setTimeLeft(0); clearInterval(int); } else setTimeLeft(diff);
          }, 30);
          return () => clearInterval(int);
       } else if (!firstBuzzTime) {
           if(timeLeft !== LIGHTNING_TIMER_MS) setTimeLeft(LIGHTNING_TIMER_MS);
       }
    }, [firstBuzzTime, isBuzzed, timeLeft]);

    const isWindowClosed = firstBuzzTime && (Date.now() - firstBuzzTime > LIGHTNING_TIMER_MS);
    const isLocked = !isBuzzed && isWindowClosed;
    const isSilenced = silencedTime > 0;
    const showCountdown = !isBuzzed && firstBuzzTime && !isWindowClosed;

    // --- LIVE LEADERBOARD VIEW (If Buzzed) ---
    if (isBuzzed) {
        const topThree = buzzes.slice(0, 3);
        const tooSlow = buzzes.slice(3);
        const currentStep = gameState.boonRound?.step || 1;
        const isGauntlet = gameState.boonRound?.phase === 'GAUNTLET';

        return (
            <div className={`min-h-screen relative flex flex-col items-center p-6 bg-gray-900 overflow-y-auto`}>
                 {showInventory && <InventoryDrawer inventory={inventory} onClose={() => setShowInventory(false)} onUseBoon={onUseBoon} allTeams={allTeams} currentTeamName={teamName} />}
                 
                 <div className="absolute top-4 right-4 z-50">
                    <button onClick={() => setShowInventory(true)} className="flex items-center gap-2 bg-gray-800 px-4 py-2 rounded-full border border-gray-600 shadow-lg">
                        <span className="text-xl">🎒</span><span className="font-bold text-white">{inventory.length}</span>
                    </button>
                 </div>
                 
                 <h2 className="text-2xl font-black text-cyan-400 mb-6 mt-16 uppercase tracking-widest">LIVE BOARD</h2>

                 <div className="w-full max-w-lg space-y-4">
                     {topThree.map((buzz, index) => {
                         const isActive = isGauntlet && index === currentStep - 1;
                         const isPassed = isGauntlet && index < currentStep - 1;
                         const isMe = buzz.teamName === teamName;
                         
                         return (
                            <div key={buzz.id} className={`relative p-4 rounded-xl border-2 flex items-center justify-between transition-all duration-500 
                                ${isMe ? 'ring-2 ring-white shadow-lg' : ''}
                                ${isActive ? 'bg-yellow-500/20 border-yellow-500 scale-105' : isPassed ? 'bg-red-900/30 border-red-900 opacity-50' : 'bg-gray-800 border-gray-700'}`}>
                                <div className="flex items-center gap-4">
                                    <img src={index === 0 ? ICON_1ST : index === 1 ? ICON_2ND : ICON_3RD} className="w-12 h-12 object-contain filter invert" />
                                    <div>
                                        <div className={`font-bold text-xl ${index === 0 ? 'text-white' : 'text-gray-300'}`}>{buzz.teamName}</div>
                                        {isActive && <div className="text-xs text-yellow-400 font-bold uppercase animate-pulse">ANSWERING NOW...</div>}
                                        {isPassed && <div className="text-xs text-red-500 font-bold uppercase">ELIMINATED</div>}
                                    </div>
                                </div>
                                <span className="text-gray-500 font-mono text-xl opacity-50">#{index + 1}</span>
                            </div>
                         );
                     })}
                 </div>

                 {tooSlow.length > 0 && (
                     <div className="mt-8 border-t border-gray-700 pt-6 w-full max-w-lg">
                         <div className="flex items-center justify-center gap-2 mb-4 opacity-50">
                             <img src={ICON_SLOW} className="w-6 h-6 filter invert" />
                             <h3 className="text-lg font-bold text-gray-400">TOO SLOW</h3>
                         </div>
                         <div className="grid grid-cols-1 gap-2 opacity-60">
                             {tooSlow.map((buzz, i) => (
                                 <div key={buzz.id} className={`bg-gray-800/50 p-2 rounded text-gray-400 text-sm flex justify-between ${buzz.teamName === teamName ? 'border border-gray-500' : ''}`}>
                                     <span>{buzz.teamName}</span>
                                     <span>#{i+4}</span>
                                 </div>
                             ))}
                         </div>
                     </div>
                 )}
            </div>
        );
    }

    // --- DEFAULT BUZZER BUTTON VIEW ---
    return (
       <div className={`min-h-screen relative flex flex-col items-center justify-center p-6 transition-colors duration-500 ${isBuzzed ? 'bg-green-900' : 'bg-gray-900'}`}>
          {showInventory && <InventoryDrawer inventory={inventory} onClose={() => setShowInventory(false)} onUseBoon={onUseBoon} allTeams={allTeams} currentTeamName={teamName} />}
          
          <div className="absolute top-4 right-4 z-50">
              <button onClick={() => setShowInventory(true)} className="flex items-center gap-2 bg-gray-800 px-4 py-2 rounded-full border border-gray-600 shadow-lg">
                  <span className="text-xl">🎒</span><span className="font-bold text-white">{inventory.length}</span>
              </button>
          </div>
          <div className="absolute top-6 left-0 right-0 text-center"><span className="text-gray-500 text-sm font-bold uppercase tracking-widest">Playing as</span><h3 className="text-white text-2xl font-black italic">{teamName}</h3></div>
          
          {silencerInfo && isSilenced && (
              <div className="absolute top-20 bg-red-600 text-white px-4 py-2 rounded font-bold animate-pulse z-40">
                  LOCKED BY {silencerInfo.user}!
              </div>
          )}

          <div className="mb-12 text-center h-20 flex items-center justify-center">
             {showCountdown ? <div><h1 className="text-6xl font-black text-red-500 animate-pulse tracking-tighter">{(timeLeft/1000).toFixed(2)}s</h1></div> :
              isLocked ? <h1 className="text-4xl font-black text-gray-500">LOCKED OUT</h1> :
              <h1 className="text-4xl font-black text-cyan-400 animate-pulse">READY!</h1>}
          </div>

          <button 
            onClick={() => onBuzz(teamName)} 
            disabled={isBuzzed || isLocked || isSilenced} 
            className={`w-72 h-72 rounded-full border-8 shadow-[0_0_50px_rgba(0,0,0,0.5)] flex items-center justify-center transition-all duration-200 
                ${isBuzzed ? 'bg-green-500 border-green-300 scale-110' : 
                  (isLocked || isSilenced) ? 'bg-gray-800 border-gray-600 opacity-50 cursor-not-allowed scale-90' : 
                  'bg-red-600 border-red-400 hover:bg-red-500 active:bg-red-700 shadow-[0_0_40px_#dc2626]'}`}
          >
             <span className="text-4xl font-black text-white uppercase tracking-widest pointer-events-none select-none">
                 {isBuzzed ? 'LOCKED' : isSilenced ? 'SILENCED' : 'BUZZ'}
             </span>
          </button>
       </div>
    );
};

// Isolated DJ Overlay
const DjOfferOverlay = ({ offer, onDecision }) => {
    const [djTimer, setDjTimer] = useState(10);
    
    useEffect(() => {
        const int = setInterval(() => {
            const left = Math.max(0, Math.ceil((offer.expiresAt - Date.now()) / 1000));
            setDjTimer(left);
            if (left <= 0) {
                clearInterval(int);
                onDecision(false); // AUTO REJECT
            }
        }, 500);
        return () => clearInterval(int);
    }, [offer, onDecision]);

    return (
      <div className="fixed inset-0 z-[200] bg-purple-900 flex flex-col items-center justify-center p-6 text-center animate-in zoom-in duration-300">
          <div className="text-6xl mb-6 animate-bounce">🎲</div>
          <h1 className="text-4xl font-black text-white mb-2">DOUBLE JEOPARDY!</h1>
          <p className="text-purple-200 mb-8 text-lg">Double points on the next question?</p>
          
          <div className="text-8xl font-black text-white mb-8">{djTimer}</div>

          <div className="space-y-4 w-full max-w-sm">
              <button onClick={() => onDecision(true)} className="w-full bg-green-500 hover:bg-green-400 text-black font-black text-2xl py-6 rounded-xl shadow-lg transform active:scale-95">ACCEPT (SPEND BOON)</button>
              <button onClick={() => onDecision(false)} className="w-full bg-gray-800 hover:bg-gray-700 text-gray-400 font-bold text-xl py-4 rounded-xl border border-gray-600">REJECT</button>
          </div>
      </div>
    );
};

// --- LANDING ---
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
      <p className="text-gray-300 mb-12 text-lg">“Knowledge is power. Petty is fun.”</p>
      <div className="space-y-6 w-full max-w-md">
        <button onClick={() => onChooseRole('player')} className="w-full bg-gray-800 border-2 border-cyan-400 hover:bg-cyan-900/30 text-cyan-300 font-bold text-2xl py-6 rounded-xl transition-all shadow-[0_0_15px_rgba(34,211,238,0.3)]">I AM A PLAYER</button>
        <button onClick={() => setShowPassword(true)} className="w-full bg-gray-800 border-2 border-pink-500 hover:bg-pink-900/30 text-pink-400 font-bold text-xl py-4 rounded-xl transition-all">I AM THE HOST</button>
      </div>
    </div>
  );
};

// --- HOST VIEW ---
const HostView = ({ buzzes, gameState, votes, onResetBuzzers, onSetMode, onClearVotes, onSelectBoon, onSpinBoon, onOpenBuzzers, onStartGauntlet, onGauntletDecision, onFactoryReset, onOfferDoubleJeopardy, onResumeHint, onStartFocusTimer, allTeams }) => {
  const [hintTimer, setHintTimer] = useState(60); 
  const [votingTimeLeft, setVotingTimeLeft] = useState(100); 
  const [notification, setNotification] = useState(null); 
  const [hostLightningTimer, setHostLightningTimer] = useState(3500);
  const [focusTimer, setFocusTimer] = useState(60); // Hyper Focus Timer
  
  const prevBuzzCount = useRef(0);
  const hintProcessed = useRef(false);
  const hintAudioRef = useRef(null);
  const spinAudioRef = useRef(null);
  const hyperFocusRef = useRef(false);

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
        let start = Date.now();
        const fadeInt = setInterval(() => {
            const elapsed = Date.now() - start;
            if (elapsed > 3000 && spinAudioRef.current) {
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

  // Sound: Hyper Focus
  useEffect(() => {
      if (gameState?.mode === 'HYPER_FOCUS' && !hyperFocusRef.current) {
          hyperFocusRef.current = true;
          const audio = new Audio(SOUND_HYPER_FOCUS);
          audio.play().catch(e => console.log(e));
          
          let start = Date.now();
          const fadeInt = setInterval(() => {
             const elapsed = Date.now() - start;
             if (elapsed > 3000) {
                 const vol = Math.max(0, 1 - ((elapsed - 3000) / 1000));
                 audio.volume = vol;
             }
             if (elapsed >= 4000) clearInterval(fadeInt);
          }, 100);
      }
      if (gameState?.mode !== 'HYPER_FOCUS') {
          hyperFocusRef.current = false;
      }
  }, [gameState?.mode]);

  // Sound & Notify: Boon Used
  useEffect(() => {
      if (gameState?.activeBoonUsage) {
          const { boonId, teamName, timestamp } = gameState.activeBoonUsage;
          if (Date.now() - timestamp < 5000) {
              const boon = BOONS[boonId];
              setNotification({ type: 'GOOD', icon: boon.icon, title: 'BOON ACTIVATED', message: boon.name, sub: `By ${teamName}` });
              
              // Custom Fade for Boon Used
              const audio = new Audio(SOUND_BOON_USED);
              audio.play().catch(e => console.log(e));
              const start = Date.now();
              const dur = 2500;
              const fadeStart = 1500;
              const int = setInterval(() => {
                  const elapsed = Date.now() - start;
                  if (elapsed > fadeStart) {
                      const vol = Math.max(0, 1 - ((elapsed - fadeStart) / (dur - fadeStart)));
                      audio.volume = vol;
                  }
                  if (elapsed >= dur) {
                      audio.pause();
                      clearInterval(int);
                  }
              }, 50);

              const t = setTimeout(() => setNotification(null), 4000);
              return () => { clearTimeout(t); clearInterval(int); audio.pause(); };
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

  // Hint Logic - Start Vote Animation
  useEffect(() => {
    if (gameState?.hintRequest && !hintProcessed.current) {
      hintProcessed.current = true;
      const audio = new Audio(SOUND_HINT_ALERT);
      audio.play().catch(e => console.log(e));
      hintAudioRef.current = audio;
      let start = gameState.hintRequest.timestamp;
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

  // Synced Hint Timer Logic
  useEffect(() => {
    if (gameState?.mode === 'HINT') {
        if (gameState.hintTimerPaused) {
            setHintTimer(gameState.hintTimerPaused);
        } else if (gameState.hintTimerStart) {
            const interval = setInterval(() => {
                const elapsed = (Date.now() - gameState.hintTimerStart) / 1000;
                setHintTimer(Math.max(0, Math.ceil(60 - elapsed)));
            }, 100);
            return () => clearInterval(interval);
        }
    } else {
      setHintTimer(60);
    }
  }, [gameState?.mode, gameState?.hintTimerStart, gameState?.hintTimerPaused]);
  
  // Synced Hyper Focus Timer Logic
  useEffect(() => {
      if (gameState?.mode === 'HYPER_FOCUS' && gameState?.focusTimerStart) {
          const interval = setInterval(() => {
              const elapsed = (Date.now() - gameState.focusTimerStart) / 1000;
              setFocusTimer(Math.max(0, Math.ceil(60 - elapsed)));
          }, 100);
          return () => clearInterval(interval);
      } else {
          setFocusTimer(60);
      }
  }, [gameState?.mode, gameState?.focusTimerStart]);

  // Host Lightning Timer Loop
  useEffect(() => {
    if (gameState?.mode === 'LIGHTNING' && gameState?.boonRound?.phase === 'BUZZING' && buzzes.length > 0) {
        const firstBuzzTime = buzzes[0].timestamp;
        const interval = setInterval(() => {
            const remaining = 3500 - (Date.now() - firstBuzzTime);
            if (remaining <= 0) {
                setHostLightningTimer(0);
                clearInterval(interval);
            } else {
                setHostLightningTimer(remaining);
            }
        }, 16); 
        return () => clearInterval(interval);
    } else {
        setHostLightningTimer(3500);
    }
  }, [gameState?.mode, gameState?.boonRound?.phase, buzzes]);

  const acceptCount = votes.filter(v => v.vote === 'accept').length;
  const rejectCount = votes.filter(v => v.vote === 'reject').length;
  
  // NEW VOTE LOGIC: 0 Votes = PASSED
  const totalVotes = acceptCount + rejectCount;
  const passed = totalVotes === 0 || acceptCount > rejectCount;
  const voteResult = votingTimeLeft === 0 ? (passed ? 'PASSED' : 'REJECTED') : 'VOTING';

  // Result Sound
  const resultSoundPlayed = useRef(false);
  useEffect(() => {
    if (votingTimeLeft === 0 && !resultSoundPlayed.current && gameState?.hintRequest) {
      resultSoundPlayed.current = true;
      if (hintAudioRef.current) { hintAudioRef.current.pause(); hintAudioRef.current = null; }
      
      const acc = votes.filter(v => v.vote === 'accept').length;
      const rej = votes.filter(v => v.vote === 'reject').length;
      const tot = acc + rej;
      const isPass = tot === 0 || acc > rej;

      if (isPass) {
          new Audio(SOUND_POINT).play();
          const currentT = Math.max(0, Math.ceil(60 - (Date.now() - gameState.hintTimerStart) / 1000));
          updateDoc(getGameDoc(), { hintTimerPaused: currentT });
      } else {
          new Audio(SOUND_FAIL).play();
      }
    }
    if (votingTimeLeft > 0) resultSoundPlayed.current = false;
  }, [votingTimeLeft, acceptCount, rejectCount, gameState?.hintRequest, votes, gameState?.hintTimerStart]);

  // Double Jeopardy Overlay
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

  // 1. Dashboard
  if (!gameState?.mode || gameState.mode === 'LOBBY') {
    return (
      <div className="min-h-screen bg-gray-900 text-white flex flex-col items-center justify-center p-6 space-y-8 relative">
        <NotificationOverlay data={notification} />
        <DJOverlay />
        <h2 className="text-4xl font-black italic mb-8">SELECT MODE</h2>
        <button onClick={() => onSetMode('LIGHTNING')} className="w-full max-w-md bg-cyan-600 hover:bg-cyan-500 text-white font-black text-3xl py-8 rounded-xl shadow-lg border-b-8 border-cyan-800 active:border-b-0 active:translate-y-2">⚡ LIGHTNING ROUND</button>
        <button onClick={() => { setHintTimer(60); onSetMode('HINT'); }} className="w-full max-w-md bg-pink-600 hover:bg-pink-500 text-white font-black text-3xl py-8 rounded-xl shadow-lg border-b-8 border-pink-800 active:border-b-0 active:translate-y-2">⏱️ START HINT CLOCK</button>
        {/* NEW HYPER FOCUS BUTTON */}
        <button onClick={() => onSetMode('HYPER_FOCUS')} className="w-full max-w-md bg-purple-600 hover:bg-purple-500 text-white font-black text-3xl py-8 rounded-xl shadow-lg border-b-8 border-purple-800 active:border-b-0 active:translate-y-2">🔮 HYPER FOCUS</button>
        
        {gameState?.lastWinner?.boonId === 'DOUBLE_JEOPARDY' && (
             <div className="w-full max-w-md bg-purple-900/50 p-6 rounded-xl border-2 border-purple-500 mt-8 animate-pulse text-center">
                 <h3 className="text-purple-200 font-bold uppercase mb-2">Double Jeopardy Winner</h3>
                 <div className="text-2xl font-black text-white mb-4">{gameState.lastWinner.team}</div>
                 <button onClick={() => onOfferDoubleJeopardy(gameState.lastWinner.team)} className="w-full bg-purple-600 hover:bg-purple-500 text-white font-black text-xl py-4 rounded-lg shadow-lg border-b-4 border-purple-800 active:border-b-0 active:translate-y-1">TRIGGER DECISION</button>
             </div>
        )}

        <div className="w-full max-w-md bg-gray-800 p-4 rounded-xl border border-gray-700 mt-8">
            <h3 className="text-gray-400 text-sm font-bold uppercase mb-4">Manual DJ Override</h3>
            <div className="flex gap-2">
                <input id="djTeamInput" type="text" placeholder="Enter Team Name" className="flex-1 bg-gray-900 border border-gray-600 rounded px-4 text-white" />
                <button onClick={() => { const team = document.getElementById('djTeamInput').value; if(team) onOfferDoubleJeopardy(team); }} className="bg-gray-600 hover:bg-gray-500 text-white font-bold px-4 py-2 rounded">OFFER</button>
            </div>
        </div>

        <div className="mt-12 pt-8 border-t border-gray-800 w-full max-w-md text-center">
            <button onClick={onFactoryReset} className="text-red-500 text-sm font-bold opacity-50 hover:opacity-100 uppercase tracking-widest border border-red-900 hover:border-red-500 px-4 py-2 rounded transition-all">⚠️ Factory Reset (New Party)</button>
        </div>
      </div>
    );
  }

  // 4. Hyper Focus Mode (Host View)
  if (gameState.mode === 'HYPER_FOCUS') {
      const readyCount = votes.filter(v => v.vote === 'done').length;
      const totalTeams = allTeams.length; // Uses new prop

      return (
          <div className="min-h-screen bg-gray-900 flex flex-col items-center justify-center text-center p-6">
              <h1 className="text-5xl font-black text-purple-400 mb-8 animate-pulse">HYPER FOCUS ACTIVE</h1>
              
              {!gameState.focusTimerStart ? (
                  <button 
                      onClick={onStartFocusTimer}
                      className="bg-purple-600 hover:bg-purple-500 text-white font-black text-3xl py-8 px-12 rounded-xl shadow-lg border-b-8 border-purple-800 active:translate-y-2 active:border-b-0"
                  >
                      BEGIN FOCUS TIMER
                  </button>
              ) : (
                  <div className="space-y-8 animate-in zoom-in duration-300">
                      <div className="text-[10rem] font-black text-white leading-none tabular-nums">{focusTimer}s</div>
                      <div className="text-2xl text-purple-300 font-bold uppercase tracking-widest">
                          {readyCount} / {totalTeams} TEAMS READY
                      </div>
                  </div>
              )}
              
              <button onClick={() => onSetMode('LOBBY')} className="mt-12 bg-gray-700 hover:bg-gray-600 text-white font-bold text-xl py-4 px-8 rounded-lg">EXIT TO LOBBY</button>
          </div>
      )
  }

  // 2. Lightning Round
  if (gameState.mode === 'LIGHTNING') {
    const topThree = buzzes.slice(0, 3);
    const boonRound = gameState.boonRound;

    if (boonRound?.phase === 'SPINNING' || boonRound?.phase === 'REVEAL') {
      const isSpinning = boonRound.phase === 'SPINNING';
      return (
        <div className="min-h-screen bg-gray-900 flex flex-col items-center justify-center p-6 text-center relative">
           <NotificationOverlay data={notification} />
           <h1 className="text-gray-400 font-bold uppercase tracking-widest mb-4">{isSpinning ? 'SELECTING PRIZE...' : 'PRIZE LOCKED:'}</h1>
           <div className={`bg-gray-800 p-12 rounded-2xl border-4 ${isSpinning ? 'border-gray-600' : 'border-yellow-500 shadow-[0_0_40px_rgba(234,179,8,0.2)]'} mb-12 duration-300`}>
              <BoonSpinner active={isSpinning} targetBoon={BOONS[boonRound.boonId]} />
           </div>
           {!isSpinning && (
               <button onClick={onOpenBuzzers} className="w-full max-w-xl bg-green-600 hover:bg-green-500 text-white font-black text-4xl py-8 rounded-xl shadow-lg border-b-8 border-green-800 active:border-b-0 active:translate-y-2 uppercase tracking-widest">OPEN BUZZERS</button>
           )}
        </div>
      );
    }

    if (boonRound?.phase === 'BUZZING') {
      const showHostCountdown = buzzes.length > 0 && hostLightningTimer > 0;

      return (
        <div className="min-h-screen bg-gray-900 text-white p-6 font-sans relative">
          <NotificationOverlay data={notification} />
          
          {showHostCountdown && (
              <div className="absolute inset-0 bg-black/50 z-20 flex items-center justify-center pointer-events-none">
                  <div className="text-9xl font-black text-red-500 animate-pulse drop-shadow-[0_0_20px_rgba(239,68,68,0.8)]">
                      {(hostLightningTimer/1000).toFixed(2)}s
                  </div>
              </div>
          )}

          <div className="max-w-3xl mx-auto">
            <header className="flex justify-between items-center mb-8 border-b border-gray-700 pb-4">
              <div className="text-yellow-400 font-bold">PRIZE: {BOONS[boonRound.boonId].name}</div>
              <h2 className="text-2xl font-bold text-cyan-400 uppercase tracking-widest">LIVE FEED</h2>
            </header>
            <div className="grid grid-cols-2 gap-4 mb-8">
               <button onClick={onResetBuzzers} className="bg-gray-700 hover:bg-gray-600 text-white font-bold text-xl py-4 rounded-lg border-b-4 border-gray-900 active:border-b-0 active:translate-y-1">ABORT</button>
               <button disabled={buzzes.length === 0} onClick={onStartGauntlet} className={`text-white font-bold text-xl py-4 rounded-lg shadow-lg uppercase tracking-widest border-b-4 active:border-b-0 active:translate-y-1 ${buzzes.length > 0 ? 'bg-red-600 hover:bg-red-500 border-red-800' : 'bg-gray-700 border-gray-800 opacity-50 cursor-not-allowed'}`}>LOCK & START GAUNTLET</button>
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
    
    return (
        <div className="min-h-screen bg-gray-900 text-white flex flex-col items-center justify-center p-6 text-center">
            <div className="text-2xl font-bold mb-4">Resuming Lightning Round...</div>
            <button onClick={() => onSetMode('LOBBY')} className="bg-red-600 hover:bg-red-500 text-white font-bold py-3 px-8 rounded-lg shadow-lg">CANCEL & GO TO LOBBY</button>
        </div>
    );
  }

  // 3. Hint Clock
  if (gameState.mode === 'HINT') {
      const readyCount = votes.filter(v => v.vote === 'done').length;
      const totalTeams = allTeams.length; // Uses new prop

     return (
        <div className="min-h-screen bg-gray-900 text-white p-6 flex flex-col items-center relative">
           <NotificationOverlay data={notification} />
           <header className="w-full max-w-4xl flex justify-between mb-8 pb-4 border-b border-gray-700"><button onClick={() => {onSetMode('LOBBY'); onClearVotes();}} className="text-gray-500 font-bold hover:text-white">← EXIT</button><h2 className="text-2xl font-bold text-pink-500 uppercase tracking-widest">HINT CLOCK</h2></header>
           
           {/* Synced Timer */}
           <div className="text-[12rem] font-black text-white leading-none tracking-tighter mb-8 tabular-nums">{hintTimer}</div>

           {/* ADDED: READY COUNT DISPLAY */}
           <div className="text-2xl text-green-400 font-bold uppercase tracking-widest mb-8">
               {readyCount} / {totalTeams} TEAMS READY
           </div>

           {/* Pause/Resume for Host */}
           {gameState.hintTimerPaused && (
               <button 
                 onClick={() => onResumeHint(hintTimer)}
                 className="bg-green-600 hover:bg-green-500 text-white font-black text-3xl py-4 px-12 rounded-full shadow-[0_0_30px_rgba(34,197,94,0.6)] animate-bounce mb-8"
               >
                  RESUME CLOCK
               </button>
           )}

           {!gameState.hintRequest && <div className="text-gray-500 text-xl font-bold uppercase tracking-widest">Waiting for requests...</div>}
           {gameState.hintRequest && (
              <div className="fixed inset-0 bg-black/90 z-50 flex flex-col items-center justify-center p-4 animate-in fade-in duration-300">
                 {/* Shared Dashboard */}
                 <HintVotingDashboard 
                    hintRequest={gameState.hintRequest} 
                    votes={votes} 
                    votingTimeLeft={gameState.hintTimerPaused ? 0 : votingTimeLeft} 
                    voteResult={voteResult}
                    acceptCount={acceptCount} 
                    rejectCount={rejectCount} 
                 />
                 <button onClick={onClearVotes} className="mt-12 px-8 py-3 bg-gray-800 hover:bg-gray-700 text-gray-400 font-bold rounded-lg border border-gray-600 uppercase tracking-widest">Clear & Resume</button>
              </div>
           )}
        </div>
     );
  }
};

const PlayerView = ({ buzzes, gameState, votes, onBuzz, onHintRequest, onVote, onUseBoon, onDjDecision, onFocusDone, teamName, setTeamName, hasJoined, setHasJoined, inventory, allTeams }) => {
  const [showInventory, setShowInventory] = useState(false);
  const [hintTimer, setHintTimer] = useState(60); // Player Side Timer
  const [votingTimeLeft, setVotingTimeLeft] = useState(100); 
  const [focusTimer, setFocusTimer] = useState(60); // Player side Hyper Focus Timer

  // NEW EFFECT
  useEffect(() => {
    if (gameState?.hintRequest && !gameState.hintTimerPaused) {
      const start = gameState.hintRequest.timestamp;
      const int = setInterval(() => {
         const el = Date.now() - start;
         const pct = Math.max(0, 100 - (el / 10000) * 100);
         setVotingTimeLeft(pct);
         if (el >= 10000) clearInterval(int);
      }, 100);
      return () => clearInterval(int);
    } else if (gameState?.hintTimerPaused) {
      setVotingTimeLeft(0);
    } else {
      setVotingTimeLeft(100);
    }
  }, [gameState?.hintRequest, gameState?.hintTimerPaused]);

  // Synced Hint Timer Logic
  useEffect(() => {
    if (gameState?.mode === 'HINT') {
        if (gameState.hintTimerPaused) {
            setHintTimer(gameState.hintTimerPaused);
        } else if (gameState.hintTimerStart) {
            const interval = setInterval(() => {
                const elapsed = (Date.now() - gameState.hintTimerStart) / 1000;
                setHintTimer(Math.max(0, Math.ceil(60 - elapsed)));
            }, 100);
            return () => clearInterval(interval);
        }
    } else {
      setHintTimer(60);
    }
  }, [gameState?.mode, gameState?.hintTimerStart, gameState?.hintTimerPaused]);

  // Synced Hyper Focus Timer Logic (Player)
  useEffect(() => {
      if (gameState?.mode === 'HYPER_FOCUS' && gameState?.focusTimerStart) {
          const interval = setInterval(() => {
              const elapsed = (Date.now() - gameState.focusTimerStart) / 1000;
              setFocusTimer(Math.max(0, Math.ceil(60 - elapsed)));
          }, 100);
          return () => clearInterval(interval);
      } else {
          setFocusTimer(60);
      }
  }, [gameState?.mode, gameState?.focusTimerStart]);

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

  // --- OVERLAYS ---
  if (gameState?.djOffer && gameState.djOffer.team === teamName) return <DjOfferOverlay offer={gameState.djOffer} onDecision={onDjDecision} />;
  
  if (gameState?.boonRound && (gameState.boonRound.phase === 'SPINNING' || gameState.boonRound.phase === 'REVEAL')) {
     const isSpinning = gameState.boonRound.phase === 'SPINNING';
     return (
        <div className="min-h-screen bg-indigo-900 flex flex-col items-center justify-center p-6 text-center animate-in fade-in duration-500">
           <div className="text-yellow-400 font-black text-2xl mb-4 uppercase tracking-widest">{isSpinning ? 'SPINNING...' : 'PRIZE ROUND!'}</div>
           <BoonSpinner active={isSpinning} targetBoon={BOONS[gameState.boonRound.boonId]} />
           <div className="mt-12 text-sm font-bold text-indigo-400 animate-pulse">GET READY...</div>
        </div>
     )
  }

  // --- HYPER FOCUS MODE (Player View) ---
  if (gameState?.mode === 'HYPER_FOCUS') {
      const isTimerRunning = !!gameState.focusTimerStart;
      const isDone = votes.some(v => v.teamName === teamName && v.vote === 'done');

      return (
          <div className="min-h-screen bg-purple-900 flex flex-col items-center justify-center p-6 text-center overflow-hidden relative">
              <HyperSpaceBg /> {/* ADDED HERE */}
              <div className="relative z-10 animate-in zoom-in fade-in duration-1000 slide-in-from-top-10">
                  <h1 className="text-6xl md:text-8xl font-black text-transparent bg-clip-text bg-gradient-to-br from-white to-purple-400 drop-shadow-[0_0_30px_rgba(168,85,247,0.8)] mb-6 tracking-tighter">
                      HYPER FOCUS
                  </h1>
                  <h2 className="text-4xl md:text-6xl font-black text-white uppercase tracking-widest animate-pulse">
                      QUESTION
                  </h2>
              </div>
              
              <div className="relative z-10 mt-12 max-w-xl bg-purple-800/60 p-6 rounded-xl border border-purple-500/80 backdrop-blur-md animate-in slide-in-from-bottom fade-in duration-1000 delay-300 fill-mode-both shadow-2xl">
                  {isTimerRunning ? (
                      <div className="animate-in zoom-in duration-300">
                         <div className="text-white font-bold text-lg mb-2 uppercase tracking-widest">TIME REMAINING</div>
                         <div className="text-6xl font-black text-white tabular-nums mb-6">{focusTimer}s</div>
                         
                         {isDone ? (
                             <div className="bg-green-600/50 text-white font-bold py-4 rounded-xl border-2 border-green-400 animate-pulse">
                                 WAITING FOR OTHERS...
                             </div>
                         ) : (
                             <button 
                                onClick={() => onFocusDone(teamName)}
                                className="w-full bg-green-500 hover:bg-green-400 text-black font-black text-2xl py-4 rounded-xl shadow-lg transform active:scale-95"
                             >
                                MARK AS DONE
                             </button>
                         )}
                      </div>
                  ) : (
                      <>
                        <p className="text-purple-100 text-lg md:text-xl font-medium mb-4">
                            One of your fellow teammates or opponents submitted this subject area as a specialty of theirs.
                        </p>
                        <div className="flex flex-col gap-2">
                            <div className="text-white font-bold text-2xl uppercase tracking-widest">
                                STAKES RAISED
                            </div>
                            <div className="text-yellow-400 font-black text-4xl drop-shadow-md">
                                +2 POINTS
                            </div>
                            <div className="text-purple-300 text-sm font-bold uppercase tracking-wider">
                                (Standard Rounds: +1)
                            </div>
                        </div>
                      </>
                  )}
              </div>
          </div>
      );
  }

  // --- LIGHTNING ROUND ---
  if (gameState?.mode === 'LIGHTNING') {
     const boonRound = gameState.boonRound;
     const phase = boonRound?.phase;

     if (phase === 'BUZZING') return <LightningBuzzer buzzes={buzzes} teamName={teamName} onBuzz={onBuzz} inventory={inventory} showInventory={showInventory} setShowInventory={setShowInventory} onUseBoon={onUseBoon} gameState={gameState} allTeams={allTeams} />;
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
     return <div className="min-h-screen bg-gray-900 flex flex-col items-center justify-center p-6 text-center"><div className="animate-pulse text-xl text-cyan-400 font-bold">Get Ready...</div></div>;
  }

  // --- LOBBY/HINT DEFAULT ---
  const isRequester = gameState?.hintRequest?.team === teamName;
  const hasVoted = votes.some(v => v.teamName === teamName);
  const votingActive = gameState?.hintRequest && !gameState.hintTimerPaused; 
  
  // NEW VOTE LOGIC FOR PLAYER VIEW
  const acceptCount = votes.filter(v => v.vote === 'accept').length;
  const rejectCount = votes.filter(v => v.vote === 'reject').length;
  const totalVotes = acceptCount + rejectCount;
  const isPass = totalVotes === 0 || acceptCount > rejectCount;
  const voteResult = isPass ? 'PASSED' : 'REJECTED';

  // --- MARK AS DONE LOGIC ---
  const isDone = votes.some(v => v.teamName === teamName && v.vote === 'done');

  return (
     <div className="min-h-screen bg-gray-900 flex flex-col items-center justify-center p-6 text-center">
        {showInventory && <InventoryDrawer inventory={inventory} onClose={() => setShowInventory(false)} onUseBoon={onUseBoon} allTeams={allTeams} currentTeamName={teamName} />}
        <div className="absolute top-4 right-4">
           <button onClick={() => setShowInventory(true)} className="flex items-center gap-2 bg-gray-800 px-4 py-2 rounded-full border border-gray-600">
              <span className="text-xl">🎒</span>
              <span className="font-bold text-white">{inventory.length}</span>
           </button>
        </div>
        
        {/* ADDED: SYNCED TIMER DISPLAY */}
        {gameState?.mode === 'HINT' && (
           <div className="mb-8">
              <h3 className="text-pink-500 font-bold text-sm uppercase tracking-widest mb-1">HINT CLOCK</h3>
              <div className={`text-6xl font-black text-white tabular-nums leading-none ${gameState.hintTimerPaused ? 'animate-pulse text-yellow-400' : ''}`}>
                 {hintTimer}s
              </div>
              {gameState.hintTimerPaused && <div className="text-yellow-400 font-bold text-sm mt-2">PAUSED - HINTING</div>}
           </div>
        )}
        
        {gameState?.mode === 'HINT' && !gameState.hintRequest && (
           <div className="space-y-4 w-full max-w-sm">
                <button onClick={() => onHintRequest(teamName)} className="w-full rounded-xl bg-yellow-500 border-4 border-yellow-300 shadow-[0_0_40px_rgba(234,179,8,0.4)] flex flex-col items-center justify-center hover:bg-yellow-400 active:scale-95 transition-all py-8">
                    <img src={ICON_HINT} className="w-24 h-24 mb-4 filter invert opacity-80" />
                    <span className="text-2xl font-black text-black uppercase tracking-widest">REQUEST HINT</span>
                </button>
                
                {/* --- ADDED: MARK AS DONE BUTTON --- */}
                {isDone ? (
                    <div className="bg-green-600/50 text-white font-bold py-4 rounded-xl border-2 border-green-400 animate-pulse">
                         WAITING FOR OTHERS...
                    </div>
                ) : (
                    <button onClick={() => onFocusDone(teamName)} className="w-full bg-gray-800 hover:bg-gray-700 text-green-400 font-bold py-4 rounded-xl border-2 border-green-600 active:scale-95">
                        MARK AS DONE
                    </button>
                )}
           </div>
        )}
        
        {gameState?.mode === 'HINT' && gameState.hintRequest && (
           <div className="w-full max-w-md">
               {/* SHARED DASHBOARD */}
               <HintVotingDashboard 
                   hintRequest={gameState.hintRequest} 
                   votes={votes} 
                   votingTimeLeft={gameState.hintTimerPaused ? 0 : votingTimeLeft} 
                   voteResult={(votingTimeLeft === 0 || gameState.hintTimerPaused) ? voteResult : 'VOTING'} 
                   acceptCount={acceptCount} 
                   rejectCount={rejectCount} 
               />

               {/* ADDED: PLAYER ALERT */}
               {!gameState.hintTimerPaused && (
                   <div className="mt-4 mb-2 text-yellow-400 text-xs font-bold uppercase tracking-widest border border-yellow-400/30 p-2 rounded bg-yellow-400/10">
                       ⚠️ IF NO ONE VOTES, HINT PASSES AUTOMATICALLY
                   </div>
               )}

               {/* VOTING BUTTONS */}
               {/* Only show if: Not Requester, Haven't Voted, Vote is still active (not paused) */}
               {!isRequester && !hasVoted && !gameState.hintTimerPaused && (
                   <div className="grid grid-cols-2 gap-4 mt-2 animate-in slide-in-from-bottom">
                        <button onClick={() => onVote(teamName, 'accept')} className="bg-green-600 hover:bg-green-500 text-white font-black text-xl py-4 rounded-xl shadow-lg border-b-4 border-green-800 active:translate-y-1 active:border-b-0">ACCEPT</button>
                        <button onClick={() => onVote(teamName, 'reject')} className="bg-red-600 hover:bg-red-500 text-white font-black text-xl py-4 rounded-xl shadow-lg border-b-4 border-red-800 active:translate-y-1 active:border-b-0">REJECT</button>
                   </div>
               )}
               
               {hasVoted && !gameState.hintTimerPaused && <div className="mt-4 text-gray-500 italic">Vote submitted. Waiting for others...</div>}
               {isRequester && !gameState.hintTimerPaused && <div className="mt-4 text-yellow-400 font-bold animate-pulse">Requesting...</div>}
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
  const [allTeams, setAllTeams] = useState([]);
  
  const [buzzes, setBuzzes] = useState([]);
  const [votes, setVotes] = useState([]);
  const [gameState, setGameState] = useState({ mode: 'LOBBY' });

  useEffect(() => { signInAnonymously(auth); onAuthStateChanged(auth, setUser); }, []);

  useEffect(() => {
    if (!user) return;
    const u1 = onSnapshot(getBuzzCollection(), (s) => setBuzzes(s.docs.map(d=>({id:d.id,...d.data()})).sort((a,b)=>a.timestamp-b.timestamp)));
    const u2 = onSnapshot(getGameDoc(), (d) => setGameState(d.exists() ? d.data() : {mode:'LOBBY'}));
    const u3 = onSnapshot(getVoteCollection(), (s) => setVotes(s.docs.map(d=>({id:d.id,...d.data()}))));
    const u4 = onSnapshot(getTeamsCollection(), (s) => setAllTeams(s.docs.map(d => ({ id: d.id, ...d.data() }))));
    return () => { u1(); u2(); u3(); u4(); };
  }, [user]);

  useEffect(() => {
    // FIX: Added !hasJoined check to prevent DB sync on every keystroke while typing
    if (!user || !teamName || role === 'host' || !hasJoined) return;
    
    const docRef = getTeamDoc(teamName);
    const unsub = onSnapshot(docRef, (docSnap) => {
       if (docSnap.exists()) {
          setInventory(docSnap.data().inventory || []);
          if (!docSnap.data().name) setDoc(docRef, { name: teamName }, { merge: true });
       } else {
          setDoc(docRef, { inventory: [], name: teamName }, { merge: true });
       }
    });
    return () => unsub();
  }, [user, teamName, role, hasJoined]);

  const handleBuzz = (team) => addDoc(getBuzzCollection(), { teamName: team, timestamp: Date.now(), userId: user.uid });
  const handleResetBuzzers = async () => {
     updateDoc(getGameDoc(), { 
         boonRound: null, 
         silenced: [] 
     });
     const snap = await getDocs(getBuzzCollection());
     snap.docs.forEach(d => deleteDoc(d.ref));
  };
  
  const handleSetMode = async (mode) => {
     const data = { mode };
     if(mode==='HINT') {
         data.hintRequest = null;
         data.hintTimerStart = Date.now(); // ADDED
         data.hintTimerPaused = null;
         // Clear previous "Done" votes when starting new session
         const snap = await getDocs(getVoteCollection());
         snap.docs.forEach(d => deleteDoc(d.ref));
     }
     if(mode==='HYPER_FOCUS') {
         data.focusTimerStart = null;
         // Clear previous "Done" votes when starting new session
         const snap = await getDocs(getVoteCollection());
         snap.docs.forEach(d => deleteDoc(d.ref));
     }
     if (mode === 'LIGHTNING') {
         const currentState = gameState; 
         const usedBoons = currentState.usedBoons || [];
         let available = BOON_KEYS.filter(k => !usedBoons.includes(k));
         let newUsed = usedBoons;
         if (available.length === 0) {
             available = BOON_KEYS;
             newUsed = [];
         }
         const pickedId = available[Math.floor(Math.random() * available.length)];
         newUsed = [...newUsed, pickedId];
         data.usedBoons = newUsed;
         data.boonRound = {
             boonId: pickedId,
             phase: 'SPINNING',
             timestamp: Date.now()
         };
         setTimeout(() => {
             updateDoc(getGameDoc(), { 'boonRound.phase': 'REVEAL' });
         }, 4000);
         // --- FIX: CLEAR SILENCED LIST ON NEW ROUND ---
         data.silenced = [];
     }
     setDoc(getGameDoc(), data, { merge: true });
  }
  
  const handleHintRequest = (team) => updateDoc(getGameDoc(), { hintRequest: { team, timestamp: Date.now() }});
  const handleVote = (team, vote) => addDoc(getVoteCollection(), { teamName: team, vote, userId: user.uid });
  const handleClearVotes = async () => {
     const snap = await getDocs(getVoteCollection());
     snap.docs.forEach(d => deleteDoc(d.ref));
     updateDoc(getGameDoc(), { hintRequest: null, hintTimerPaused: null });
  };
  
  const handleResumeHint = (currentPausedTime) => {
      // Calculate new start time based on remaining paused time
      // remaining = 60 - elapsed
      // newStart = Date.now() - (60 - remaining) * 1000
      const newStart = Date.now() - ((60 - currentPausedTime) * 1000);
      updateDoc(getGameDoc(), { hintTimerStart: newStart, hintTimerPaused: null });
  };

  const handleStartFocusTimer = async () => {
      // Clear votes first just in case
      const snap = await getDocs(getVoteCollection());
      snap.docs.forEach(d => deleteDoc(d.ref));
      updateDoc(getGameDoc(), { focusTimerStart: Date.now() });
  };

  const handleFocusDone = (team) => {
      addDoc(getVoteCollection(), { teamName: team, vote: 'done', userId: user.uid });
  };

  const handleSelectBoon = (boonId) => {
     updateDoc(getGameDoc(), { boonRound: { selectedBoonId: boonId, phase: null } });
  };

  const handleSpinBoon = () => {
     const boonId = gameState.boonRound.selectedBoonId;
     updateDoc(getGameDoc(), { 'boonRound.phase': 'SPINNING', 'boonRound.boonId': boonId });
     setTimeout(() => {
         updateDoc(getGameDoc(), { 'boonRound.phase': 'REVEAL' });
     }, 4000);
  };
  
  const handleOpenBuzzers = () => {
     updateDoc(getGameDoc(), { 'boonRound.phase': 'BUZZING' });
  };

  const handleStartGauntlet = () => {
     updateDoc(getGameDoc(), { 'boonRound.phase': 'GAUNTLET', 'boonRound.step': 1 });
  };

  const handleGauntletDecision = (winningTeamName, boonId, success) => {
     if (success && winningTeamName && boonId) {
        new Audio(SOUND_POINT).play();
        const teamRef = getTeamDoc(winningTeamName);
        updateDoc(teamRef, { inventory: arrayUnion(boonId) });
        updateDoc(getGameDoc(), { lastWinner: { team: winningTeamName, boonId } });
        updateDoc(getGameDoc(), { boonRound: null });
        handleResetBuzzers();
     } else {
        new Audio(SOUND_FAIL).play();
        const currentStep = gameState.boonRound.step || 1;
        if (currentStep >= 3 || currentStep >= buzzes.length) {
           updateDoc(getGameDoc(), { boonRound: null });
           handleResetBuzzers();
        } else {
           updateDoc(getGameDoc(), { 'boonRound.step': currentStep + 1 });
        }
     }
  };

  const handleUseBoon = async (boonId, targetTeam = null) => {
      // 1. HARDCODED EFFECTS
      if (boonId === 'EXEC_ORDER') {
          updateDoc(getGameDoc(), { hintOverride: 'PASS' });
      }
      else if (boonId === 'FILIBUSTER') {
          updateDoc(getGameDoc(), { hintOverride: 'FAIL' });
      }
      else if (boonId === 'SILENCER' && targetTeam) {
          updateDoc(getGameDoc(), { 
              silenced: arrayUnion({ target: targetTeam, user: teamName, timestamp: Date.now() }) 
          });
      }
      else if (boonId === 'PRIORITY') {
          if (buzzes.length > 0) {
             const myBuzz = buzzes.find(b => b.teamName === teamName);
             const topBuzz = buzzes[0];
             if (myBuzz && topBuzz && myBuzz.id !== topBuzz.id) {
                 await updateDoc(doc(db, 'buzzes', myBuzz.id), { timestamp: topBuzz.timestamp - 1 });
             }
          }
      }
      else if (boonId === 'SLINGSHOT') {
          if (buzzes.length >= 3) {
             const myBuzz = buzzes.find(b => b.teamName === teamName);
             const targetBuzz = buzzes[2]; 
             if (myBuzz && targetBuzz && myBuzz.id !== targetBuzz.id) {
                 await updateDoc(doc(db, 'buzzes', myBuzz.id), { timestamp: targetBuzz.timestamp - 1 });
             }
          }
      }

      // 2. Notify Host (Sound/Overlay)
      updateDoc(getGameDoc(), {
          activeBoonUsage: {
              boonId,
              teamName,
              target: targetTeam,
              timestamp: Date.now()
          }
      });

      // 3. Remove from Inventory
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
          const teamRef = getTeamDoc(team);
          updateDoc(teamRef, { inventory: arrayRemove('DOUBLE_JEOPARDY') });
          updateDoc(getGameDoc(), { 
              djOffer: null, 
              djResult: { outcome: 'ACCEPTED', team, timestamp: Date.now() },
              lastBoonSpent: { boonId: 'DOUBLE_JEOPARDY', timestamp: Date.now() } 
          });
      } else {
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

  return (
    <>
      {!user && <Loading />}
      {user && !role && <Landing onChooseRole={setRole} />}
      {user && role === 'host' && (
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
          onResumeHint={handleResumeHint}
          onStartFocusTimer={handleStartFocusTimer}
          allTeams={allTeams}
        />
      )}
      {user && role === 'player' && (
        <PlayerView 
          buzzes={buzzes} 
          gameState={gameState} 
          votes={votes}
          onBuzz={handleBuzz}
          onHintRequest={handleHintRequest}
          onVote={handleVote}
          onUseBoon={handleUseBoon}
          onDjDecision={handleDjDecision}
          onFocusDone={handleFocusDone}
          teamName={teamName}
          setTeamName={setTeamName}
          hasJoined={hasJoined}
          setHasJoined={setHasJoined}
          inventory={inventory}
          allTeams={allTeams}
        />
      )}
    </>
  );
}
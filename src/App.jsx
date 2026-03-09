import { useState, useEffect, useRef } from "react";

// ─── GAME LOGIC ──────────────────────────────────────────────
const EXP_PER_LEVEL = (lvl) => Math.floor(100 * Math.pow(1.42, lvl - 1));
const getLevelFromExp = (totalExp) => {
  let level = 1,
    remaining = totalExp;
  while (remaining >= EXP_PER_LEVEL(level)) {
    remaining -= EXP_PER_LEVEL(level);
    level++;
  }
  return { level, currentExp: remaining, requiredExp: EXP_PER_LEVEL(level) };
};

const RANKS = [
  { min: 1, max: 9, rank: "E", color: "#9ca3af", bg: "rgba(156,163,175,0.12)", title: "Novice Hunter", glow: "rgba(156,163,175,0.15)" },
  { min: 10, max: 19, rank: "D", color: "#60a5fa", bg: "rgba(96,165,250,0.12)", title: "Iron Hunter", glow: "rgba(96,165,250,0.2)" },
  { min: 20, max: 34, rank: "C", color: "#34d399", bg: "rgba(52,211,153,0.12)", title: "Bronze Hunter", glow: "rgba(52,211,153,0.2)" },
  { min: 35, max: 49, rank: "B", color: "#a78bfa", bg: "rgba(167,139,250,0.12)", title: "Silver Hunter", glow: "rgba(167,139,250,0.2)" },
  { min: 50, max: 69, rank: "A", color: "#fbbf24", bg: "rgba(251,191,36,0.12)", title: "Gold Hunter", glow: "rgba(251,191,36,0.2)" },
  { min: 70, max: 89, rank: "AA", color: "#f97316", bg: "rgba(249,115,22,0.12)", title: "Elite Hunter", glow: "rgba(249,115,22,0.25)" },
  { min: 90, max: 109, rank: "S", color: "#ef4444", bg: "rgba(239,68,68,0.12)", title: "Shadow Hunter", glow: "rgba(239,68,68,0.25)" },
  { min: 110, max: 129, rank: "SS", color: "#ec4899", bg: "rgba(236,72,153,0.12)", title: "Monarch", glow: "rgba(236,72,153,0.3)" },
  { min: 130, max: Infinity, rank: "SSS", color: "#c084fc", bg: "rgba(192,132,252,0.15)", title: "Shadow Sovereign", glow: "rgba(192,132,252,0.35)" },
];
const getRank = (lvl) => RANKS.find((r) => lvl >= r.min && lvl <= r.max) || RANKS[0];

const MUSCLE_GROUPS = ["Chest", "Back", "Shoulders", "Arms", "Legs", "Core", "Full Body"];
const EXERCISE_DB = {
  Chest: ["Bench Press", "Incline Bench", "Decline Bench", "Dumbbell Fly", "Cable Fly", "Push-ups", "Chest Dip", "Cable Crossover", "Machine Chest Press"],
  Back: ["Deadlift", "Barbell Row", "Pull-up", "Lat Pulldown", "Cable Row", "T-Bar Row", "Face Pull", "Seated Row", "Single Arm Row"],
  Shoulders: ["Overhead Press", "Lateral Raise", "Front Raise", "Arnold Press", "Upright Row", "Shrugs", "Cable Lateral Raise", "Machine Shoulder Press"],
  Arms: ["Barbell Curl", "Dumbbell Curl", "Hammer Curl", "Tricep Pushdown", "Skull Crusher", "Dips", "Preacher Curl", "Cable Curl", "Concentration Curl"],
  Legs: ["Squat", "Leg Press", "Romanian Deadlift", "Leg Curl", "Leg Extension", "Calf Raise", "Lunges", "Bulgarian Split Squat", "Hip Thrust", "Hack Squat"],
  Core: ["Plank", "Crunches", "Russian Twist", "Leg Raise", "Ab Wheel", "Cable Crunch", "Hanging Leg Raise", "Decline Sit-up", "Mountain Climbers"],
  "Full Body": ["Clean & Press", "Burpees", "Kettlebell Swing", "Power Clean", "Thruster", "Farmer Walk", "Turkish Get-up", "Battle Ropes"],
};

const MISSIONS_POOL = [
  { id: "m1", title: "Complete Today's Workout", desc: "Log a full workout session", exp: 50, icon: "⚔️" },
  { id: "m2", title: "Defeat Your Shadow", desc: "Beat a previous lift on any exercise", exp: 35, icon: "👊" },
  { id: "m3", title: "Five Exercise Minimum", desc: "Complete at least 5 exercises", exp: 25, icon: "🔥" },
  { id: "m4", title: "Streak Guardian", desc: "Keep your daily streak alive", exp: 20, icon: "⚡" },
  { id: "m5", title: "Volume Domination", desc: "Log 15 or more total sets", exp: 35, icon: "🎯" },
  { id: "m6", title: "Push Day Warrior", desc: "Complete a chest/shoulder session", exp: 40, icon: "🛡️" },
  { id: "m7", title: "Pull Day Hunter", desc: "Complete a back/bicep session", exp: 40, icon: "🏹" },
  { id: "m8", title: "Leg Day Conqueror", desc: "Complete a leg session", exp: 45, icon: "🦵" },
  { id: "m9", title: "Iron Volume King", desc: "Lift 5000kg total in one session", exp: 60, icon: "👑" },
  { id: "m10", title: "Early Riser", desc: "Start your workout before 9 AM", exp: 30, icon: "🌅" },
  { id: "m11", title: "PR Seeker", desc: "Attempt a personal record today", exp: 40, icon: "🏆" },
  { id: "m12", title: "Consistency Protocol", desc: "3rd workout this week", exp: 55, icon: "📋" },
  { id: "m13", title: "Iron Mind", desc: "Log session notes for today", exp: 15, icon: "🧠" },
  { id: "m14", title: "Shadow Army", desc: "Defeat 3 shadows in one session", exp: 70, icon: "👻" },
];

const ACHIEVEMENTS_LIST = [
  { id: "a1", title: "First Blood", desc: "Complete your first workout", icon: "🩸", condition: (s) => s.totalWorkouts >= 1 },
  { id: "a4", title: "10x Grinder", desc: "Complete 10 workouts", icon: "💎", condition: (s) => s.totalWorkouts >= 10 },
  { id: "a5", title: "30x Veteran", desc: "Complete 30 workouts", icon: "⚔️", condition: (s) => s.totalWorkouts >= 30 },
  { id: "a12", title: "Century Club", desc: "Complete 100 workouts", icon: "👑", condition: (s) => s.totalWorkouts >= 100 },
  { id: "a2", title: "Week Warrior", desc: "Maintain a 7-day streak", icon: "🔥", condition: (s) => s.streak >= 7 },
  { id: "a9", title: "Iron Will", desc: "Maintain a 30-day streak", icon: "🛡️", condition: (s) => s.streak >= 30 },
  { id: "a3", title: "PR Hunter", desc: "Set your first personal record", icon: "🏆", condition: (s) => s.totalPRs >= 1 },
  { id: "a7", title: "Shadow Slayer", desc: "Defeat 10 shadows", icon: "👻", condition: (s) => s.shadowsDefeated >= 10 },
  { id: "a13", title: "Shadow Army", desc: "Defeat 50 shadows total", icon: "⚡", condition: (s) => s.shadowsDefeated >= 50 },
  { id: "a8", title: "Mission Master", desc: "Complete 20 daily missions", icon: "🎯", condition: (s) => s.missionsCompleted >= 20 },
  { id: "a14", title: "Perfect Day", desc: "Complete all missions in one day", icon: "🌙", condition: (s) => (s.perfectMissionDays || 0) >= 1 },
  { id: "r1", title: "E-Rank Awakening", desc: "You have awakened. The hunt begins.", icon: "⬜", condition: (s) => s.level >= 1, rankPromo: "E" },
  { id: "r2", title: "D-Rank Promotion", desc: "Iron will forged. Rank D achieved.", icon: "🔵", condition: (s) => s.level >= 10, rankPromo: "D" },
  { id: "r3", title: "C-Rank Promotion", desc: "Bronze strength. Rising fast, Hunter.", icon: "🟢", condition: (s) => s.level >= 20, rankPromo: "C" },
  { id: "r4", title: "B-Rank Promotion", desc: "Silver Hunter. The elite notice you.", icon: "🟣", condition: (s) => s.level >= 35, rankPromo: "B" },
  { id: "r5", title: "A-Rank Promotion", desc: "Gold Hunter. A force to reckon with.", icon: "🌟", condition: (s) => s.level >= 50, rankPromo: "A" },
  { id: "r6", title: "AA-Rank Promotion", desc: "Elite Hunter. Few reach this height.", icon: "🔶", condition: (s) => s.level >= 70, rankPromo: "AA" },
  { id: "r7", title: "S-Rank Ascension", desc: "Shadow Hunter. You are the danger now.", icon: "🔴", condition: (s) => s.level >= 90, rankPromo: "S" },
  { id: "r8", title: "SS-Rank Ascension", desc: "Monarch. Nations bow before your power.", icon: "💗", condition: (s) => s.level >= 110, rankPromo: "SS" },
  { id: "r9", title: "SSS-Rank Sovereign", desc: "Shadow Sovereign. Absolute dominion.", icon: "👾", condition: (s) => s.level >= 130, rankPromo: "SSS" },
];

const INITIAL_STATE = {
  hunterName: null,
  totalExp: 0,
  streak: 0,
  lastWorkoutDate: null,
  totalWorkouts: 0,
  totalPRs: 0,
  shadowsDefeated: 0,
  missionsCompleted: 0,
  perfectMissionDays: 0,
  workoutHistory: [],
  exercisePRs: {},
  achievements: [],
  todayMissions: [],
  missionDate: null,
  mode: "hunter",
  templates: [
    { id: "t1", name: "Push Day", muscle: "Chest", exercises: ["Bench Press", "Overhead Press", "Dumbbell Fly", "Tricep Pushdown", "Lateral Raise"] },
    { id: "t2", name: "Pull Day", muscle: "Back", exercises: ["Deadlift", "Barbell Row", "Pull-up", "Barbell Curl", "Face Pull"] },
    { id: "t3", name: "Leg Day", muscle: "Legs", exercises: ["Squat", "Leg Press", "Romanian Deadlift", "Leg Curl", "Calf Raise"] },
    { id: "t4", name: "Arms Day", muscle: "Arms", exercises: ["Barbell Curl", "Hammer Curl", "Tricep Pushdown", "Skull Crusher", "Dips"] },
    { id: "t5", name: "Core Day", muscle: "Core", exercises: ["Plank", "Hanging Leg Raise", "Cable Crunch", "Russian Twist", "Ab Wheel"] },
  ],
};

// ─── STORAGE ─────────────────────────────────────────────────
const STORAGE_KEY = "gym_lvl_v3";

const loadState = async () => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return { ...INITIAL_STATE, ...JSON.parse(raw) };
  } catch {}
  return { ...INITIAL_STATE };
};

const saveState = async (s) => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(s));
  } catch {}
};

// ─── STYLES ──────────────────────────────────────────────────
const CSS = `
@import url('https://fonts.googleapis.com/css2?family=Rajdhani:wght@400;500;600;700&family=Exo+2:wght@300;400;600;800&display=swap');
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0;}
:root{
  --bg:#07090f;--bg2:#0c1018;--bg3:#111827;--bg4:#1a2235;
  --border:#1e2d45;--border2:#2a3f60;
  --text:#e2e8f0;--text2:#94a3b8;--text3:#64748b;
  --accent:#3b82f6;--accent2:#60a5fa;
  --gold:#f59e0b;--gold2:#fbbf24;
  --green:#10b981;--red:#ef4444;--purple:#8b5cf6;--cyan:#06b6d4;--orange:#f97316;
}
html,body{background:var(--bg);min-height:100vh;}
body{color:var(--text);font-family:'Exo 2',sans-serif;-webkit-font-smoothing:antialiased;}
.app{min-height:100vh;max-width:430px;margin:0 auto;background:var(--bg);position:relative;}
.app::before{content:'';position:fixed;inset:0;max-width:430px;left:50%;transform:translateX(-50%);
  background:repeating-linear-gradient(0deg,transparent,transparent 2px,rgba(0,0,0,0.025) 2px,rgba(0,0,0,0.025) 4px);pointer-events:none;z-index:9000;}
.mode-toggle{display:flex;align-items:center;background:var(--bg3);border:1px solid var(--border);border-radius:12px;padding:4px;gap:4px;margin-bottom:16px;}
.mode-btn{flex:1;padding:9px 8px;border-radius:9px;border:none;cursor:pointer;font-family:'Rajdhani',sans-serif;font-size:13px;font-weight:700;letter-spacing:.5px;transition:all .25s;color:var(--text3);background:none;}
.mode-btn.active-hunter{background:linear-gradient(135deg,#1e3a5f,#1d4ed8);color:var(--accent2);box-shadow:0 2px 12px rgba(59,130,246,.3);}
.mode-btn.active-simple{background:linear-gradient(135deg,#064e3b,#059669);color:#34d399;box-shadow:0 2px 12px rgba(16,185,129,.3);}
.sys-msg{background:rgba(0,0,0,.5);border:1px solid rgba(59,130,246,.2);border-left:3px solid var(--accent);border-radius:10px;padding:10px 14px;margin-bottom:8px;font-size:12px;color:var(--text2);font-family:'Rajdhani',sans-serif;line-height:1.5;letter-spacing:.3px;}
.sys-msg.warning{border-left-color:var(--red);border-color:rgba(239,68,68,.2);}
.sys-msg.success{border-left-color:var(--green);border-color:rgba(16,185,129,.2);}
.shadow-card{background:linear-gradient(135deg,rgba(139,92,246,.07),rgba(0,0,0,.3));border:1px solid rgba(139,92,246,.25);border-radius:12px;padding:14px;margin-bottom:10px;position:relative;overflow:hidden;}
.shadow-card::before{content:'👻';position:absolute;right:12px;top:10px;font-size:26px;opacity:.2;}
.shadow-name{font-family:'Rajdhani',sans-serif;font-size:15px;font-weight:700;color:var(--purple);margin-bottom:6px;}
.shadow-compare{display:grid;grid-template-columns:1fr auto 1fr;align-items:center;gap:8px;margin-top:8px;}
.shadow-stat{background:var(--bg4);border-radius:8px;padding:8px;text-align:center;}
.shadow-stat-val{font-family:'Rajdhani',sans-serif;font-size:17px;font-weight:700;color:var(--text);}
.shadow-stat-lbl{font-size:10px;color:var(--text3);letter-spacing:1px;margin-top:2px;}
.shadow-vs{font-family:'Rajdhani',sans-serif;font-size:12px;font-weight:700;color:var(--text3);}
.shadow-defeated{border-color:rgba(16,185,129,.35);background:linear-gradient(135deg,rgba(16,185,129,.05),rgba(0,0,0,.3));}
.shadow-defeated .shadow-name{color:var(--green);}
.screen{padding:16px 16px 100px;}
.nav{position:fixed;bottom:0;left:50%;transform:translateX(-50%);width:100%;max-width:430px;background:rgba(7,9,15,.97);backdrop-filter:blur(20px);border-top:1px solid var(--border);display:flex;z-index:1000;padding:8px 0 12px;}
.nav-btn{flex:1;display:flex;flex-direction:column;align-items:center;gap:3px;cursor:pointer;padding:4px;background:none;border:none;color:var(--text3);transition:all .2s;}
.nav-btn.active{color:var(--accent2);}
.nav-btn.active .nav-icon{background:rgba(59,130,246,.12);}
.nav-icon{font-size:19px;width:38px;height:30px;display:flex;align-items:center;justify-content:center;border-radius:9px;transition:all .2s;position:relative;}
.nav-label{font-size:10px;font-weight:600;letter-spacing:.5px;font-family:'Rajdhani',sans-serif;}
.notif-dot{width:6px;height:6px;background:var(--red);border-radius:50%;position:absolute;top:1px;right:4px;}
.header{display:flex;align-items:center;justify-content:space-between;margin-bottom:16px;padding-top:8px;}
.header-title{font-family:'Rajdhani',sans-serif;font-size:21px;font-weight:700;color:var(--text);letter-spacing:1px;}
.header-sub{font-size:11px;color:var(--text3);font-family:'Rajdhani',sans-serif;letter-spacing:1px;}
.rank-badge{display:inline-flex;align-items:center;justify-content:center;border-radius:10px;font-family:'Rajdhani',sans-serif;font-weight:700;border:2px solid;position:relative;overflow:hidden;flex-shrink:0;}
.rank-badge::after{content:'';position:absolute;inset:0;background:linear-gradient(135deg,rgba(255,255,255,.1),transparent);}
.card{background:var(--bg2);border:1px solid var(--border);border-radius:14px;padding:16px;margin-bottom:12px;position:relative;overflow:hidden;}
.card::before{content:'';position:absolute;top:0;left:0;right:0;height:1px;background:linear-gradient(90deg,transparent,rgba(59,130,246,.15),transparent);}
.card-title{font-family:'Rajdhani',sans-serif;font-size:12px;font-weight:600;color:var(--text3);letter-spacing:1.5px;text-transform:uppercase;margin-bottom:10px;}
.exp-bar-wrap{background:var(--bg4);border-radius:100px;overflow:hidden;}
.exp-bar-fill{height:100%;border-radius:100px;background:linear-gradient(90deg,var(--accent),var(--cyan));transition:width .8s cubic-bezier(.4,0,.2,1);position:relative;}
.exp-bar-fill.gold{background:linear-gradient(90deg,var(--gold),var(--orange));}
.level-circle{width:80px;height:80px;border-radius:50%;display:flex;flex-direction:column;align-items:center;justify-content:center;position:relative;flex-shrink:0;}
.level-circle-inner{position:absolute;inset:4px;border-radius:50%;background:var(--bg2);display:flex;flex-direction:column;align-items:center;justify-content:center;z-index:1;}
.level-num{font-family:'Rajdhani',sans-serif;font-size:26px;font-weight:700;line-height:1;z-index:2;}
.level-label{font-family:'Rajdhani',sans-serif;font-size:9px;font-weight:600;letter-spacing:2px;color:var(--text3);z-index:2;}
.mission-card{background:var(--bg3);border:1px solid var(--border);border-radius:12px;padding:12px 14px;margin-bottom:8px;display:flex;align-items:center;gap:12px;cursor:pointer;transition:all .2s;position:relative;overflow:hidden;}
.mission-card:active{transform:scale(.98);}
.mission-card.completed{opacity:.5;border-color:var(--green);}
.mission-card.completed::before{content:'';position:absolute;inset:0;background:rgba(16,185,129,.04);}
.mission-icon{font-size:19px;width:40px;height:40px;background:var(--bg4);border-radius:10px;display:flex;align-items:center;justify-content:center;flex-shrink:0;}
.mission-title{font-family:'Rajdhani',sans-serif;font-weight:600;font-size:14px;color:var(--text);}
.mission-desc{font-size:11px;color:var(--text3);margin-top:1px;}
.mission-exp{font-family:'Rajdhani',sans-serif;font-size:12px;font-weight:700;color:var(--gold2);white-space:nowrap;}
.check-circle{width:22px;height:22px;border-radius:50%;border:2px solid var(--border2);display:flex;align-items:center;justify-content:center;flex-shrink:0;transition:all .2s;}
.check-circle.done{background:var(--green);border-color:var(--green);}
.stat-row{display:flex;gap:8px;margin-bottom:8px;}
.stat-box{flex:1;background:var(--bg3);border:1px solid var(--border);border-radius:10px;padding:10px 6px;text-align:center;}
.stat-val{font-family:'Rajdhani',sans-serif;font-size:19px;font-weight:700;color:var(--text);}
.stat-lbl{font-size:10px;color:var(--text3);font-family:'Rajdhani',sans-serif;letter-spacing:.5px;text-transform:uppercase;margin-top:2px;}
.btn{display:flex;align-items:center;justify-content:center;gap:8px;padding:13px 20px;border-radius:12px;border:none;cursor:pointer;font-family:'Rajdhani',sans-serif;font-size:15px;font-weight:700;letter-spacing:1px;transition:all .2s;width:100%;}
.btn:active{transform:scale(.97);}
.btn-primary{background:linear-gradient(135deg,#1d4ed8,#3b82f6);color:white;box-shadow:0 4px 18px rgba(59,130,246,.28);}
.btn-gold{background:linear-gradient(135deg,#b45309,#f59e0b);color:#000;box-shadow:0 4px 18px rgba(245,158,11,.28);}
.btn-ghost{background:var(--bg3);border:1px solid var(--border);color:var(--text2);}
.btn-green{background:linear-gradient(135deg,#065f46,#10b981);color:white;}
.btn-red{background:linear-gradient(135deg,#7f1d1d,#ef4444);color:white;}
.btn-sm{padding:8px 14px;font-size:12px;border-radius:8px;width:auto;}
.input{background:var(--bg3);border:1px solid var(--border);border-radius:10px;padding:11px 14px;color:var(--text);font-family:'Exo 2',sans-serif;font-size:14px;width:100%;outline:none;transition:border-color .2s;}
.input:focus{border-color:var(--accent);}
.input::placeholder{color:var(--text3);}
.select{appearance:none;background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12'%3E%3Cpath fill='%2364748b' d='M6 8L1 3h10z'/%3E%3C/svg%3E");background-repeat:no-repeat;background-position:right 12px center;padding-right:32px;cursor:pointer;}
.label{font-family:'Rajdhani',sans-serif;font-size:11px;font-weight:600;color:var(--text3);letter-spacing:1px;text-transform:uppercase;margin-bottom:5px;display:block;}
.form-group{margin-bottom:13px;}
.toggle-wrap{display:flex;align-items:center;justify-content:space-between;padding:10px 14px;background:var(--bg3);border:1px solid var(--border);border-radius:10px;margin-bottom:8px;}
.toggle{width:44px;height:24px;background:var(--bg4);border-radius:100px;position:relative;cursor:pointer;transition:background .2s;border:1px solid var(--border);}
.toggle.on{background:var(--accent);border-color:var(--accent);}
.toggle-thumb{position:absolute;top:2px;left:2px;width:18px;height:18px;background:white;border-radius:50%;transition:transform .2s;}
.toggle.on .toggle-thumb{transform:translateX(20px);}
.set-row{display:grid;grid-template-columns:26px 1fr 1fr 1fr 26px;gap:5px;align-items:center;margin-bottom:6px;}
.set-num{font-family:'Rajdhani',sans-serif;font-size:12px;color:var(--text3);text-align:center;font-weight:700;}
.set-input{background:var(--bg4);border:1px solid var(--border);border-radius:8px;padding:8px 4px;color:var(--text);font-family:'Rajdhani',sans-serif;font-size:14px;font-weight:600;text-align:center;width:100%;outline:none;}
.set-input:focus{border-color:var(--accent);}
.set-header{font-family:'Rajdhani',sans-serif;font-size:10px;color:var(--text3);text-align:center;letter-spacing:.5px;}
.simple-exercise-block{background:var(--bg2);border:1px solid var(--border);border-radius:14px;padding:14px;margin-bottom:10px;}
.simple-ex-name{font-family:'Rajdhani',sans-serif;font-size:18px;font-weight:700;color:var(--text);margin-bottom:4px;}
.simple-prev{font-size:11px;color:var(--text3);margin-bottom:10px;padding:6px 10px;background:var(--bg4);border-radius:6px;border-left:2px solid var(--border2);}
.simple-prev.beat{border-left-color:var(--green);color:var(--green);}
.exercise-block{background:var(--bg3);border:1px solid var(--border);border-radius:12px;padding:12px;margin-bottom:10px;}
.exercise-name{font-family:'Rajdhani',sans-serif;font-size:16px;font-weight:700;color:var(--text);margin-bottom:2px;}
.prev-stat{font-size:11px;color:var(--text3);margin-bottom:10px;}
.pr-badge{display:inline-flex;align-items:center;gap:4px;background:rgba(245,158,11,.1);border:1px solid rgba(245,158,11,.3);border-radius:6px;padding:2px 7px;font-family:'Rajdhani',sans-serif;font-size:11px;font-weight:700;color:var(--gold2);margin-left:8px;}
.achievement{display:flex;align-items:center;gap:12px;padding:12px;background:var(--bg3);border:1px solid var(--border);border-radius:12px;margin-bottom:8px;}
.achievement.unlocked{border-color:rgba(251,191,36,.3);background:rgba(245,158,11,.03);}
.achievement-icon{font-size:24px;width:46px;height:46px;background:var(--bg4);border-radius:12px;display:flex;align-items:center;justify-content:center;flex-shrink:0;filter:grayscale(1);}
.achievement.unlocked .achievement-icon{filter:none;}
.achievement-title{font-family:'Rajdhani',sans-serif;font-size:15px;font-weight:700;color:var(--text3);}
.achievement.unlocked .achievement-title{color:var(--gold2);}
.achievement-desc{font-size:11px;color:var(--text3);margin-top:2px;}
.history-item{background:var(--bg3);border:1px solid var(--border);border-radius:12px;padding:12px;margin-bottom:8px;cursor:pointer;transition:border-color .2s;}
.history-item:hover{border-color:var(--border2);}
.history-date{font-family:'Rajdhani',sans-serif;font-size:11px;color:var(--text3);letter-spacing:.5px;}
.history-name{font-family:'Rajdhani',sans-serif;font-size:16px;font-weight:700;color:var(--text);margin:2px 0;}
.tag{background:var(--bg4);border:1px solid var(--border);border-radius:6px;padding:3px 8px;font-family:'Rajdhani',sans-serif;font-size:11px;color:var(--text3);display:inline-block;margin:2px 3px 2px 0;}
.tag.exp{color:var(--gold2);border-color:rgba(245,158,11,.2);background:rgba(245,158,11,.05);}
.tag.pr{color:var(--gold2);}
.toast{position:fixed;top:20px;left:50%;transform:translateX(-50%) translateY(-90px);max-width:380px;width:calc(100% - 32px);background:var(--bg2);border:1px solid var(--border2);border-radius:14px;padding:14px 16px;display:flex;align-items:center;gap:12px;z-index:9999;transition:transform .4s cubic-bezier(.4,0,.2,1);box-shadow:0 8px 40px rgba(0,0,0,.7);}
.toast.show{transform:translateX(-50%) translateY(0);}
.toast-icon{font-size:22px;}
.toast-title{font-family:'Rajdhani',sans-serif;font-size:15px;font-weight:700;color:var(--text);}
.toast-sub{font-size:11px;color:var(--text3);}
.toast-exp{font-family:'Rajdhani',sans-serif;font-size:14px;font-weight:700;color:var(--gold2);margin-left:auto;white-space:nowrap;}
.modal-overlay{position:fixed;inset:0;background:rgba(0,0,0,.8);backdrop-filter:blur(6px);z-index:2000;display:flex;align-items:flex-end;}
.modal{background:var(--bg2);border:1px solid var(--border);border-radius:20px 20px 0 0;padding:20px;width:100%;max-width:430px;margin:0 auto;max-height:85vh;overflow-y:auto;}
.modal-handle{width:40px;height:4px;background:var(--border2);border-radius:100px;margin:0 auto 20px;}
.rank-promo{text-align:center;padding:20px 10px;}
.rank-promo-ring{width:110px;height:110px;border-radius:50%;margin:0 auto 16px;display:flex;align-items:center;justify-content:center;font-family:'Rajdhani',sans-serif;font-size:40px;font-weight:700;border:4px solid;}
.rank-promo-title{font-family:'Rajdhani',sans-serif;font-size:12px;letter-spacing:3px;color:var(--text3);margin-bottom:6px;}
.rank-promo-name{font-family:'Rajdhani',sans-serif;font-size:24px;font-weight:700;margin-bottom:4px;}
.rank-promo-sub{font-size:13px;color:var(--text3);margin-bottom:20px;line-height:1.6;}
.tabs{display:flex;gap:6px;margin-bottom:16px;background:var(--bg3);border-radius:12px;padding:4px;}
.tab{flex:1;text-align:center;padding:8px 4px;border-radius:8px;cursor:pointer;font-family:'Rajdhani',sans-serif;font-size:12px;font-weight:600;color:var(--text3);transition:all .2s;border:none;background:none;letter-spacing:.5px;}
.tab.active{background:var(--bg4);color:var(--accent2);}
.chart-bar-wrap{display:flex;align-items:flex-end;gap:4px;height:80px;}
.chart-bar{flex:1;border-radius:4px 4px 0 0;min-height:4px;transition:height .5s;}
.chart-label{font-family:'Rajdhani',sans-serif;font-size:10px;color:var(--text3);text-align:center;margin-top:4px;}
.timer{font-family:'Rajdhani',sans-serif;font-size:28px;font-weight:700;color:var(--accent2);letter-spacing:2px;}
.hero-banner{background:linear-gradient(135deg,#0a1628,#1e3a5f);border:1px solid rgba(59,130,246,.2);border-radius:16px;padding:18px;margin-bottom:12px;position:relative;overflow:hidden;}
.hero-banner::before{content:'';position:absolute;top:-40px;right:-40px;width:130px;height:130px;background:radial-gradient(circle,rgba(59,130,246,.12),transparent 70%);}
.hero-banner::after{content:'';position:absolute;bottom:-20px;left:-20px;width:70px;height:70px;background:radial-gradient(circle,rgba(6,182,212,.08),transparent 70%);}
.onboard{min-height:100vh;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:32px 20px;text-align:center;}
.onboard-logo{font-family:'Rajdhani',sans-serif;font-size:12px;font-weight:700;letter-spacing:4px;color:var(--accent);margin-bottom:24px;}
.onboard-title{font-family:'Rajdhani',sans-serif;font-size:34px;font-weight:700;color:var(--text);line-height:1.1;margin-bottom:8px;}
.onboard-title span{color:var(--accent2);}
.onboard-sub{font-size:14px;color:var(--text3);margin-bottom:32px;line-height:1.6;max-width:290px;}
.time-slot{display:flex;align-items:center;gap:10px;padding:10px 14px;background:var(--bg3);border:1px solid var(--border);border-radius:10px;margin-bottom:6px;}
.time-slot.best{border-color:rgba(16,185,129,.3);background:rgba(16,185,129,.03);}
.time-dot{width:8px;height:8px;border-radius:50%;background:var(--border2);flex-shrink:0;}
.time-slot.best .time-dot{background:var(--green);}
.time-text{font-family:'Rajdhani',sans-serif;font-size:15px;font-weight:600;color:var(--text);}
.time-note{font-size:11px;color:var(--text3);}
.section-title{font-family:'Rajdhani',sans-serif;font-size:17px;font-weight:700;color:var(--text);margin-bottom:4px;}
.section-sub{font-size:12px;color:var(--text3);margin-bottom:14px;}
.divider{height:1px;background:var(--border);margin:12px 0;}
.loading-screen{min-height:100vh;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:16px;}
.loading-spinner{width:40px;height:40px;border:3px solid var(--border);border-top-color:var(--accent);border-radius:50%;animation:spin .8s linear infinite;}
::-webkit-scrollbar{width:4px;}
::-webkit-scrollbar-track{background:transparent;}
::-webkit-scrollbar-thumb{background:var(--border2);border-radius:100px;}
.flex{display:flex;}.flex-center{display:flex;align-items:center;justify-content:center;}.flex-between{display:flex;align-items:center;justify-content:space-between;}
.gap-8{gap:8px;}.gap-12{gap:12px;}.mt-8{margin-top:8px;}.mt-12{margin-top:12px;}.mb-8{margin-bottom:8px;}.w-full{width:100%;}
.text-accent{color:var(--accent2);}.text-gold{color:var(--gold2);}.text-green{color:var(--green);}.text-muted{color:var(--text3);}
@keyframes spin{to{transform:rotate(360deg)}}
@keyframes pulse{0%,100%{opacity:1}50%{opacity:.5}}
@keyframes slideUp{from{transform:translateY(20px);opacity:0}to{transform:translateY(0);opacity:1}}
@keyframes glow{0%,100%{box-shadow:0 0 8px rgba(59,130,246,.2)}50%{box-shadow:0 0 24px rgba(59,130,246,.5)}}
@keyframes rankPulse{0%,100%{transform:scale(1)}50%{transform:scale(1.04)}}
@keyframes flicker{0%,100%{opacity:1}92%{opacity:.8}94%{opacity:1}96%{opacity:.85}}
.animate-pulse{animation:pulse 2s infinite;}
.animate-slideup{animation:slideUp .3s ease;}
.animate-glow{animation:glow 2.5s infinite;}
.animate-rank{animation:rankPulse 1.5s infinite;}
.animate-flicker{animation:flicker 4s infinite;}
`;

// ─── COMPONENTS ──────────────────────────────────────────────
const Toast = ({ toast }) => (
  <div className={`toast ${toast.show ? "show" : ""}`}>
    <span className="toast-icon">{toast.icon}</span>
    <div style={{ flex: 1 }}>
      <div className="toast-title">{toast.title}</div>
      {toast.sub && <div className="toast-sub">{toast.sub}</div>}
    </div>
    {toast.exp > 0 && <div className="toast-exp">+{toast.exp} EXP</div>}
  </div>
);

const RankBadge = ({ level, size = 42 }) => {
  const r = getRank(level);
  return (
    <div className="rank-badge" style={{ width: size, height: size, color: r.color, borderColor: r.color, background: r.bg, fontSize: size * 0.38 }}>
      {r.rank}
    </div>
  );
};

const ExpBar = ({ current, required, gold, height = 8 }) => (
  <div className="exp-bar-wrap" style={{ height }}>
    <div className={`exp-bar-fill ${gold ? "gold" : ""}`} style={{ width: `${Math.min(100, required ? (current / required) * 100 : 0)}%`, height }} />
  </div>
);

const LevelCircle = ({ level }) => {
  const rank = getRank(level);
  const r = 34,
    circ = 2 * Math.PI * r,
    pct = ((level - 1) % 10) / 10 || 0.05;

  return (
    <div className="level-circle">
      <svg style={{ position: "absolute", inset: 0, width: "100%", height: "100%", transform: "rotate(-90deg)" }}>
        <circle cx="40" cy="40" r={r} fill="none" stroke="var(--border)" strokeWidth="3" />
        <circle
          cx="40"
          cy="40"
          r={r}
          fill="none"
          stroke={rank.color}
          strokeWidth="3"
          strokeDasharray={circ}
          strokeDashoffset={circ * (1 - pct)}
          strokeLinecap="round"
          style={{ transition: "stroke-dashoffset 1s ease", filter: `drop-shadow(0 0 4px ${rank.color})` }}
        />
      </svg>
      <div className="level-circle-inner">
        <div className="level-num" style={{ color: rank.color }}>
          {level}
        </div>
        <div className="level-label">LEVEL</div>
      </div>
    </div>
  );
};

const SysMsg = ({ text, type = "info" }) => <div className={`sys-msg ${type} animate-flicker`}>{text}</div>;

const RANK_PROMO_FLAVOR = {
  E: { msg: "You have awakened, Hunter. Your journey begins now.", subtitle: "◈ AWAKENING ◈" },
  D: { msg: "Rank D confirmed. Iron will forged. You are no longer ordinary.", subtitle: "◈ RANK PROMOTION ◈" },
  C: { msg: "Rank C confirmed. Bronze strength recognized. The elite begin to notice.", subtitle: "◈ RANK PROMOTION ◈" },
  B: { msg: "Rank B confirmed. Silver Hunter. Only the strongest remain at this tier.", subtitle: "◈ RANK PROMOTION ◈" },
  A: { msg: "Rank A confirmed. Gold Hunter. You are a force this world must reckon with.", subtitle: "◈ RANK PROMOTION ◈" },
  AA: { msg: "Rank AA confirmed. Elite Hunter status achieved. Few ever reach this height.", subtitle: "◈ ELITE ASCENSION ◈" },
  S: { msg: "Rank S confirmed. Shadow Hunter. You are no longer the hunter — you are the danger.", subtitle: "◈ S-RANK ASCENSION ◈" },
  SS: { msg: "Rank SS confirmed. Monarch class achieved. Nations bow before your power.", subtitle: "◈ MONARCH ASCENSION ◈" },
  SSS: { msg: "Rank SSS confirmed. Shadow Sovereign. You stand above all. Absolute dominion.", subtitle: "◈ SOVEREIGN EMERGENCE ◈" },
};

const RankPromoModal = ({ rank, onClose }) => {
  const flavor = RANK_PROMO_FLAVOR[rank.rank] || RANK_PROMO_FLAVOR.D;
  const isLegendary = ["SS", "SSS"].includes(rank.rank);
  const isElite = ["S", "AA"].includes(rank.rank);

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()} style={{ background: rank.bg, borderColor: `${rank.color}44` }}>
        <div className="modal-handle" style={{ background: `${rank.color}66` }} />
        <div className="rank-promo">
          <div className="rank-promo-title" style={{ color: rank.color, letterSpacing: 3 }}>
            {flavor.subtitle}
          </div>
          <div
            className="rank-promo-ring animate-rank"
            style={{
              color: rank.color,
              borderColor: rank.color,
              background: "rgba(0,0,0,.6)",
              boxShadow: `0 0 ${isLegendary ? 40 : isElite ? 24 : 12}px ${rank.color}${isLegendary ? "88" : "44"}`,
              fontSize: isLegendary ? 32 : 40,
            }}
          >
            {rank.rank}
          </div>
          <div className="rank-promo-name" style={{ color: rank.color, fontSize: isLegendary ? 20 : 24 }}>
            {rank.rank}-RANK
          </div>
          <div
            style={{
              fontFamily: "Rajdhani",
              fontSize: 20,
              fontWeight: 700,
              color: "var(--text)",
              marginBottom: 10,
              textShadow: isLegendary ? `0 0 20px ${rank.color}` : "none",
            }}
          >
            {rank.title.toUpperCase()}
          </div>
          <div className="rank-promo-sub" style={{ fontFamily: "Rajdhani", fontSize: 13, lineHeight: 1.8 }}>
            {flavor.msg}
          </div>
          <button
            className="btn btn-primary"
            style={{
              background: `linear-gradient(135deg,${rank.color}88,${rank.color})`,
              boxShadow: `0 4px 18px ${rank.color}44`,
              color: "white",
            }}
            onClick={onClose}
          >
            ACKNOWLEDGE {isLegendary ? "👾" : isElite ? "⚡" : "⚔️"}
          </button>
        </div>
      </div>
    </div>
  );
};

const WorkoutDetailModal = ({ workout, onClose }) => {
  if (!workout) return null;
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-handle" />
        <div style={{ fontFamily: "Rajdhani", fontSize: 11, color: "var(--text3)", letterSpacing: 1, marginBottom: 4 }}>
          {new Date(workout.date).toLocaleDateString("en", { weekday: "long", month: "long", day: "numeric" })}
        </div>
        <div style={{ fontFamily: "Rajdhani", fontSize: 22, fontWeight: 700, color: "var(--text)", marginBottom: 4 }}>{workout.name}</div>
        <div style={{ display: "flex", gap: 6, marginBottom: 16, flexWrap: "wrap" }}>
          <span className="tag exp">+{workout.expGained} EXP</span>
          {workout.prs > 0 && <span className="tag pr">🏆 {workout.prs} PR{workout.prs > 1 ? "s" : ""}</span>}
          <span className="tag">{workout.muscle}</span>
          <span className="tag">⏱ {workout.duration}min</span>
        </div>
        {(workout.exercises || []).map((ex, i) => (
          <div key={i} style={{ background: "var(--bg3)", border: "1px solid var(--border)", borderRadius: 10, padding: 12, marginBottom: 8 }}>
            <div style={{ fontFamily: "Rajdhani", fontSize: 14, fontWeight: 700, color: "var(--text)", marginBottom: 8 }}>{ex.name}</div>
            {(ex.sets || []).map((s, si) => {
              const vol = (parseFloat(s.weight) || 0) * (parseInt(s.reps) || 0);
              return (
                <div key={si} style={{ display: "flex", gap: 8, fontSize: 12, color: "var(--text2)", marginBottom: 4 }}>
                  <span style={{ color: "var(--text3)", fontFamily: "Rajdhani", width: 40 }}>SET {si + 1}</span>
                  <span style={{ color: "var(--accent2)", fontFamily: "Rajdhani", fontWeight: 700 }}>{s.weight || 0}kg</span>
                  <span style={{ color: "var(--text3)" }}>×</span>
                  <span style={{ fontFamily: "Rajdhani", fontWeight: 700 }}>{s.reps || 0} reps</span>
                  <span style={{ color: "var(--text3)", marginLeft: "auto" }}>Vol: {vol}</span>
                </div>
              );
            })}
          </div>
        ))}
        {workout.notes && (
          <div style={{ background: "var(--bg4)", borderRadius: 10, padding: 12, fontSize: 13, color: "var(--text2)", marginBottom: 16 }}>📝 {workout.notes}</div>
        )}
        <button className="btn btn-ghost" onClick={onClose}>
          Close
        </button>
      </div>
    </div>
  );
};

// ─── SCREENS ─────────────────────────────────────────────────
const OnboardingScreen = ({ onComplete }) => {
  const [step, setStep] = useState(0);
  const [name, setName] = useState("");
  const steps = [
    {
      icon: "⚔️",
      title: (
        <>
          <span>GYM</span>
          <br />
          LEVELING
          <br />
          SYSTEM
        </>
      ),
      sub: "Transform your workouts into a Solo Leveling-style progression. Every rep. Every set. Every session counts.",
    },
    {
      icon: "👻",
      title: (
        <>
          DEFEAT YOUR
          <br />
          <span>SHADOW SELF.</span>
        </>
      ),
      sub: "Your past workouts become shadow enemies. Beat your previous performance and crush them for bonus EXP.",
    },
    {
      icon: "🗡️",
      title: (
        <>
          MISSIONS.
          <br />
          <span>RANKS.</span>
          <br />
          POWER.
        </>
      ),
      sub: "Complete daily missions, level up through E→SS ranks, and choose between full Hunter Mode or fast Simple Mode.",
    },
  ];
  const s = steps[step];

  return (
    <div className="app">
      <div className="onboard animate-slideup">
        <div className="onboard-logo">◈ SYSTEM INITIALIZING ◈</div>
        <div style={{ fontSize: 56, marginBottom: 20 }}>{s.icon}</div>
        <div className="onboard-title">{s.title}</div>
        <div className="onboard-sub">{s.sub}</div>

        {step === steps.length - 1 ? (
          <div style={{ width: "100%", maxWidth: 300 }}>
            <div className="form-group">
              <label className="label">HUNTER NAME</label>
              <input
                className="input"
                placeholder="Enter your name..."
                value={name}
                onChange={(e) => setName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && name.trim() && onComplete(name.trim())}
              />
            </div>
            <button className="btn btn-gold" onClick={() => name.trim() && onComplete(name.trim())}>
              ⚔️ AWAKEN AS A HUNTER
            </button>
          </div>
        ) : (
          <button className="btn btn-primary" style={{ maxWidth: 300 }} onClick={() => setStep(step + 1)}>
            CONTINUE →
          </button>
        )}

        <div style={{ display: "flex", gap: 6, marginTop: 24 }}>
          {steps.map((_, i) => (
            <div
              key={i}
              style={{
                width: i === step ? 20 : 6,
                height: 6,
                borderRadius: 100,
                background: i === step ? "var(--accent2)" : "var(--border)",
                transition: "all .3s",
              }}
            />
          ))}
        </div>
      </div>
    </div>
  );
};

const DashboardScreen = ({ state, onStartWorkout, onMissionComplete, onViewMissions, onModeChange }) => {
  const { level, currentExp, requiredExp } = getLevelFromExp(state.totalExp);
  const rank = getRank(level);
  const missions = state.todayMissions || [];
  const pending = missions.filter((m) => !m.completed).length;
  const lastWorkout = state.workoutHistory[0];
  const today = new Date().toDateString();
  const workedOutToday = state.lastWorkoutDate === today;
  const daysSince = lastWorkout ? Math.floor((Date.now() - new Date(lastWorkout.date)) / 86400000) : null;
  const isHunter = state.mode === "hunter";
  const sysMessages = [];

  if (daysSince !== null && daysSince >= 2) {
    sysMessages.push({ text: `[System Alert] You have not trained for ${daysSince} days. Muscle decay detected. Return immediately.`, type: "warning" });
  }
  if (workedOutToday) {
    sysMessages.push({ text: "[System] Session logged today. Shadow suppressed. Streak maintained.", type: "success" });
  } else if (state.streak > 0) {
    sysMessages.push({ text: `[System] Active streak detected: ${state.streak} days. Do not break the chain, Hunter.`, type: "info" });
  }

  return (
    <div className="screen animate-slideup">
      <div className="header">
        <div>
          <div className="header-title">{isHunter ? "HUNTER PROFILE" : "GYM TRACKER"}</div>
          <div className="header-sub">◈ {state.hunterName || "HUNTER"} ◈</div>
        </div>
        {isHunter && <RankBadge level={level} />}
      </div>

      <div style={{ display: "flex", gap: 4, marginBottom: 16 }}>
        <button
          className={`mode-btn ${state.mode === "hunter" ? "active-hunter" : ""}`}
          style={{ flex: 1, padding: "9px 8px", borderRadius: 9, border: "none", cursor: "pointer", fontFamily: "Rajdhani", fontSize: 13, fontWeight: 700, letterSpacing: 0.5, transition: "all .25s", color: "var(--text3)", background: "var(--bg3)" }}
          onClick={() => onModeChange("hunter")}
        >
          ⚔️ Hunter Mode
        </button>
        <button
          className={`mode-btn ${state.mode === "simple" ? "active-simple" : ""}`}
          style={{ flex: 1, padding: "9px 8px", borderRadius: 9, border: "none", cursor: "pointer", fontFamily: "Rajdhani", fontSize: 13, fontWeight: 700, letterSpacing: 0.5, transition: "all .25s", color: "var(--text3)", background: "var(--bg3)" }}
          onClick={() => onModeChange("simple")}
        >
          🏋️ Simple Mode
        </button>
      </div>

      {isHunter && sysMessages.map((m, i) => <SysMsg key={i} text={m.text} type={m.type} />)}

      {isHunter ? (
        <>
          <div className="hero-banner animate-glow" style={{ marginBottom: 12 }}>
            <div className="flex gap-12" style={{ alignItems: "center", marginBottom: 14, position: "relative", zIndex: 1 }}>
              <LevelCircle level={level} />
              <div style={{ flex: 1 }}>
                <div style={{ fontFamily: "Rajdhani", fontSize: 18, fontWeight: 700, color: rank.color, marginBottom: 4 }}>{rank.title.toUpperCase()}</div>
                <div style={{ fontFamily: "Rajdhani", fontSize: 11, color: "var(--text3)", marginBottom: 6 }}>
                  {currentExp.toLocaleString()} / {requiredExp.toLocaleString()} EXP
                </div>
                <ExpBar current={currentExp} required={requiredExp} />
                <div style={{ fontFamily: "Rajdhani", fontSize: 10, color: "var(--text3)", marginTop: 4 }}>
                  {(requiredExp - currentExp).toLocaleString()} EXP to Level {level + 1}
                </div>
              </div>
            </div>

            <div className="stat-row" style={{ margin: 0, position: "relative", zIndex: 1 }}>
              <div className="stat-box">
                <div className="stat-val text-accent">{state.streak}</div>
                <div className="stat-lbl">🔥 Streak</div>
              </div>
              <div className="stat-box">
                <div className="stat-val text-gold">{state.totalExp.toLocaleString()}</div>
                <div className="stat-lbl">EXP</div>
              </div>
              <div className="stat-box">
                <div className="stat-val">{state.totalWorkouts}</div>
                <div className="stat-lbl">Sessions</div>
              </div>
              <div className="stat-box">
                <div className="stat-val" style={{ color: "var(--purple)" }}>
                  {state.shadowsDefeated || 0}
                </div>
                <div className="stat-lbl">👻 Shadows</div>
              </div>
            </div>
          </div>

          <div className="card">
            <div className="flex-between mb-8">
              <div className="card-title">DAILY MISSIONS</div>
              <button className="btn btn-ghost btn-sm" onClick={onViewMissions}>
                View All
              </button>
            </div>

            {missions.slice(0, 3).map((m) => (
              <div key={m.id} className={`mission-card ${m.completed ? "completed" : ""}`} onClick={() => !m.completed && onMissionComplete(m.id)}>
                <div className="mission-icon">{m.icon}</div>
                <div style={{ flex: 1 }}>
                  <div className="mission-title">{m.title}</div>
                  <div className="mission-desc">{m.desc}</div>
                </div>
                <div className="flex" style={{ alignItems: "center", gap: 8 }}>
                  <div className="mission-exp">+{m.exp}</div>
                  <div className={`check-circle ${m.completed ? "done" : ""}`}>{m.completed && <span style={{ color: "white", fontSize: 11 }}>✓</span>}</div>
                </div>
              </div>
            ))}

            {pending > 0 && (
              <div style={{ fontFamily: "Rajdhani", fontSize: 12, color: "var(--text3)", textAlign: "center", marginTop: 4 }}>
                {pending} mission{pending > 1 ? "s" : ""} remaining
              </div>
            )}
          </div>

          <div className="stat-row">
            <div className="stat-box">
              <div className="stat-val" style={{ color: "var(--cyan)", fontSize: 15 }}>
                {state.totalPRs}
              </div>
              <div className="stat-lbl">PRs Set</div>
            </div>
            <div className="stat-box">
              <div className="stat-val" style={{ color: "var(--green)", fontSize: 15 }}>
                {state.missionsCompleted || 0}
              </div>
              <div className="stat-lbl">Missions</div>
            </div>
            <div className="stat-box">
              <div className="stat-val" style={{ color: "var(--text2)", fontSize: 15 }}>
                {(state.achievements || []).length}
              </div>
              <div className="stat-lbl">Awards</div>
            </div>
          </div>
        </>
      ) : (
        <>
          <div className="card" style={{ borderColor: "rgba(16,185,129,.15)" }}>
            <div style={{ fontFamily: "Rajdhani", fontSize: 12, color: "var(--green)", letterSpacing: 1, marginBottom: 6 }}>🏋️ SIMPLE MODE — FAST LOGGING</div>
            <div style={{ fontSize: 12, color: "var(--text3)", lineHeight: 1.6 }}>Gamification hidden. All logs still count toward EXP, levels, and missions in the background.</div>
          </div>
          <div className="stat-row">
            <div className="stat-box">
              <div className="stat-val">{state.totalWorkouts}</div>
              <div className="stat-lbl">Sessions</div>
            </div>
            <div className="stat-box">
              <div className="stat-val text-gold">{state.totalPRs}</div>
              <div className="stat-lbl">PRs Set</div>
            </div>
            <div className="stat-box">
              <div className="stat-val text-accent">{state.streak}</div>
              <div className="stat-lbl">🔥 Streak</div>
            </div>
          </div>
        </>
      )}

      {lastWorkout && (
        <div className="card">
          <div className="card-title">LAST SESSION</div>
          <div style={{ fontFamily: "Rajdhani", fontSize: 16, fontWeight: 700, color: "var(--text)", marginBottom: 4 }}>{lastWorkout.name}</div>
          <div style={{ fontSize: 11, color: "var(--text3)", marginBottom: 8 }}>
            {new Date(lastWorkout.date).toLocaleDateString()} · {lastWorkout.duration}min · {lastWorkout.exercises?.length || 0} exercises
          </div>
          <div>
            <span className="tag exp">+{lastWorkout.expGained} EXP</span>
            {lastWorkout.prs > 0 && <span className="tag pr">🏆 {lastWorkout.prs} PR{lastWorkout.prs > 1 ? "s" : ""}</span>}
            {lastWorkout.shadowsDefeated > 0 && (
              <span className="tag" style={{ color: "var(--purple)", borderColor: "rgba(139,92,246,.2)" }}>
                👻 {lastWorkout.shadowsDefeated} shadow{lastWorkout.shadowsDefeated > 1 ? "s" : ""}
              </span>
            )}
            <span className="tag">{lastWorkout.muscle}</span>
          </div>
        </div>
      )}

      <button className="btn btn-primary animate-glow" style={{ marginBottom: 8 }} onClick={onStartWorkout}>
        {isHunter ? "⚔️" : "🏋️"} {workedOutToday ? "LOG ANOTHER SESSION" : "START WORKOUT"}
      </button>

      {isHunter && !workedOutToday && state.streak > 0 && (
        <div style={{ textAlign: "center", fontFamily: "Rajdhani", fontSize: 12, color: "var(--text3)" }}>🔥 Protect your {state.streak}-day streak</div>
      )}
    </div>
  );
};

const WorkoutScreen = ({ state, onSaveWorkout, onCancel }) => {
  const [workoutName, setWorkoutName] = useState("My Workout");
  const [muscle, setMuscle] = useState("Chest");
  const [exercises, setExercises] = useState([]);
  const [showAddEx, setShowAddEx] = useState(false);
  const [selectedEx, setSelectedEx] = useState("");
  const [customEx, setCustomEx] = useState("");
  const [startTime] = useState(Date.now());
  const [elapsed, setElapsed] = useState(0);
  const [sameWeight, setSameWeight] = useState(false);
  const [notes, setNotes] = useState("");
  const [phase, setPhase] = useState("setup");
  const isSimple = state.mode === "simple";

  useEffect(() => {
    const t = setInterval(() => setElapsed(Math.floor((Date.now() - startTime) / 1000)), 1000);
    return () => clearInterval(t);
  }, [startTime]);

  const fmt = (s) => `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;

  const addExercise = () => {
    const name = selectedEx || customEx.trim();
    if (!name) return;
    const prev = state.exercisePRs[name];
    setExercises((ex) => [...ex, { id: Date.now(), name, sets: [{ reps: "", weight: "" }], prevBest: prev?.weight || null, prevReps: prev?.reps || null }]);
    setShowAddEx(false);
    setSelectedEx("");
    setCustomEx("");
  };

  const updateSet = (ei, si, field, val) => {
    setExercises((ex) =>
      ex.map((e, i) => {
        if (i !== ei) return e;
        let sets = e.sets.map((s, j) => (j === si ? { ...s, [field]: val } : s));
        if (sameWeight && field === "weight") sets = sets.map((s) => ({ ...s, weight: val }));
        return { ...e, sets };
      })
    );
  };

  const addSet = (ei) =>
    setExercises((ex) =>
      ex.map((e, i) => (i !== ei ? e : { ...e, sets: [...e.sets, { reps: e.sets[e.sets.length - 1]?.reps || "", weight: sameWeight ? e.sets[0]?.weight || "" : "" }] }))
    );

  const repeatSet = (ei) =>
    setExercises((ex) => ex.map((e, i) => (i !== ei ? e : { ...e, sets: [...e.sets, { ...e.sets[e.sets.length - 1] }] })));

  const removeSet = (ei, si) =>
    setExercises((ex) => ex.map((e, i) => (i !== ei ? e : { ...e, sets: e.sets.filter((_, j) => j !== si) })));

  const removeEx = (ei) => setExercises((ex) => ex.filter((_, i) => i !== ei));

  const handleSave = () => {
    if (!exercises.length) return;
    const duration = Math.floor(elapsed / 60) || 1;
    const prs = [],
      shadows = [],
      newPRs = { ...state.exercisePRs };

    exercises.forEach((ex) => {
      let bw = 0,
        br = 0;
      ex.sets.forEach((s) => {
        const w = parseFloat(s.weight) || 0,
          r = parseInt(s.reps) || 0;
        if (w > bw) {
          bw = w;
          br = r;
        }
      });
      if (bw > 0) {
        const prev = newPRs[ex.name];
        if (!prev || bw > prev.weight) {
          prs.push(ex.name);
          newPRs[ex.name] = { weight: bw, reps: br, date: new Date().toISOString() };
        }
        if (prev && bw > prev.weight) shadows.push(ex.name);
      }
    });

    let exp = 50;
    if (duration >= 30) exp += 20;
    if (exercises.length >= 5) exp += 25;
    exp += prs.length * 30;
    exp += shadows.length * 15;
    if (notes.trim()) exp += 10;

    onSaveWorkout(
      {
        id: Date.now(),
        name: workoutName,
        muscle,
        date: new Date().toISOString(),
        duration,
        exercises,
        notes,
        expGained: exp,
        prs: prs.length,
        shadowsDefeated: shadows.length,
      },
      exp,
      newPRs,
      shadows
    );
  };

  if (phase === "setup") {
    return (
      <div className="screen animate-slideup">
        <div className="header">
          <div>
            <div className="header-title">NEW SESSION</div>
            <div className="header-sub">Setup your workout</div>
          </div>
          <button className="btn btn-ghost btn-sm" onClick={onCancel}>
            ✕ Cancel
          </button>
        </div>

        <div className="form-group">
          <label className="label">Session Name</label>
          <input className="input" value={workoutName} onChange={(e) => setWorkoutName(e.target.value)} />
        </div>

        <div className="form-group">
          <label className="label">Muscle Group</label>
          <select className="input select" value={muscle} onChange={(e) => setMuscle(e.target.value)}>
            {MUSCLE_GROUPS.map((g) => (
              <option key={g}>{g}</option>
            ))}
          </select>
        </div>

        <div className="card">
          <div className="card-title">QUICK TEMPLATES</div>
          {(state.templates || []).map((t) => (
            <button
              key={t.id}
              className="btn btn-ghost"
              style={{ marginBottom: 8, justifyContent: "flex-start" }}
              onClick={() => {
                setWorkoutName(t.name);
                setMuscle(t.muscle);
                setExercises(
                  t.exercises.map((name, i) => ({
                    id: i,
                    name,
                    sets: [{ reps: "", weight: "" }],
                    prevBest: state.exercisePRs[name]?.weight || null,
                    prevReps: state.exercisePRs[name]?.reps || null,
                  }))
                );
                setPhase("logging");
              }}
            >
              <span style={{ fontSize: 15 }}>📋</span> {t.name}
              <span style={{ color: "var(--text3)", fontSize: 11, marginLeft: "auto" }}>{t.exercises.length} ex</span>
            </button>
          ))}
        </div>

        <button className="btn btn-primary" onClick={() => setPhase("logging")}>
          START LOGGING →
        </button>
      </div>
    );
  }

  return (
    <div className="screen animate-slideup">
      <div className="header">
        <div>
          <div className="header-title">{workoutName}</div>
          <div className="header-sub">{muscle}</div>
        </div>
        <div style={{ textAlign: "right" }}>
          <div className="timer">{fmt(elapsed)}</div>
          <div style={{ fontSize: 10, color: "var(--text3)", fontFamily: "Rajdhani" }}>ELAPSED</div>
        </div>
      </div>

      {!isSimple && (
        <div className="toggle-wrap">
          <div>
            <div style={{ fontFamily: "Rajdhani", fontWeight: 600, fontSize: 14 }}>Same Weight All Sets</div>
            <div style={{ fontSize: 11, color: "var(--text3)" }}>Auto-fill weight</div>
          </div>
          <div className={`toggle ${sameWeight ? "on" : ""}`} onClick={() => setSameWeight(!sameWeight)}>
            <div className="toggle-thumb" />
          </div>
        </div>
      )}

      {exercises.map((ex, ei) => {
        const best = Math.max(...ex.sets.map((s) => parseFloat(s.weight) || 0));
        const isPR = best > 0 && ex.prevBest !== null && best > ex.prevBest;

        if (isSimple) {
          return (
            <div key={ex.id} className="simple-exercise-block">
              <div className="flex-between">
                <div className="simple-ex-name">{ex.name}</div>
                <button style={{ background: "none", border: "none", color: "var(--text3)", cursor: "pointer", fontSize: 15 }} onClick={() => removeEx(ei)}>
                  ✕
                </button>
              </div>
              {ex.prevBest !== null ? (
                <div className={`simple-prev ${isPR ? "beat" : ""}`}>{isPR ? "✓ Shadow defeated! " : ""}Prev: {ex.prevBest}kg × {ex.prevReps} reps</div>
              ) : (
                <div className="simple-prev">First time — no previous data</div>
              )}

              <div className="set-row">
                <div className="set-header">SET</div>
                <div className="set-header">KG</div>
                <div className="set-header">REPS</div>
                <div className="set-header">VOL</div>
                <div />
              </div>

              {ex.sets.map((s, si) => {
                const vol = (parseFloat(s.weight) || 0) * (parseInt(s.reps) || 0);
                return (
                  <div key={si} className="set-row">
                    <div className="set-num">{si + 1}</div>
                    <input className="set-input" type="number" inputMode="decimal" placeholder="kg" value={s.weight} onChange={(e) => updateSet(ei, si, "weight", e.target.value)} />
                    <input className="set-input" type="number" inputMode="numeric" placeholder="reps" value={s.reps} onChange={(e) => updateSet(ei, si, "reps", e.target.value)} />
                    <div style={{ background: "var(--bg4)", border: "1px solid var(--border)", borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, color: vol > 0 ? "var(--text2)" : "var(--text3)" }}>
                      {vol > 0 ? vol : "—"}
                    </div>
                    <button style={{ background: "none", border: "none", color: "var(--text3)", cursor: "pointer", fontSize: 12 }} onClick={() => removeSet(ei, si)}>
                      ✕
                    </button>
                  </div>
                );
              })}

              <div className="flex gap-8 mt-8">
                <button className="btn btn-ghost btn-sm" onClick={() => addSet(ei)}>
                  + Set
                </button>
                <button className="btn btn-ghost btn-sm" onClick={() => repeatSet(ei)}>
                  ⟳ Repeat
                </button>
              </div>
            </div>
          );
        }

        return (
          <div key={ex.id} className="exercise-block">
            {isPR && (
              <div className="shadow-card shadow-defeated" style={{ marginBottom: 10 }}>
                <div className="shadow-name">👻 Shadow Defeated — {ex.name}</div>
                <div style={{ fontSize: 12, color: "var(--green)" }}>[System] You surpassed your previous self. Bonus EXP awarded.</div>
              </div>
            )}

            <div className="flex-between">
              <div>
                <span className="exercise-name">{ex.name}</span>
                {isPR && <span className="pr-badge">🏆 NEW PR!</span>}
              </div>
              <button style={{ background: "none", border: "none", color: "var(--text3)", cursor: "pointer", fontSize: 15 }} onClick={() => removeEx(ei)}>
                ✕
              </button>
            </div>

            {ex.prevBest !== null ? <div className="prev-stat">👻 Shadow: {ex.prevBest}kg × {ex.prevReps} reps — defeat it!</div> : <div className="prev-stat">No shadow yet — first encounter</div>}

            <div className="set-row">
              <div className="set-header">SET</div>
              <div className="set-header">KG</div>
              <div className="set-header">REPS</div>
              <div className="set-header">VOL</div>
              <div />
            </div>

            {ex.sets.map((s, si) => {
              const vol = (parseFloat(s.weight) || 0) * (parseInt(s.reps) || 0);
              return (
                <div key={si} className="set-row">
                  <div className="set-num">{si + 1}</div>
                  <input className="set-input" type="number" inputMode="decimal" placeholder="0" value={s.weight} onChange={(e) => updateSet(ei, si, "weight", e.target.value)} />
                  <input className="set-input" type="number" inputMode="numeric" placeholder="0" value={s.reps} onChange={(e) => updateSet(ei, si, "reps", e.target.value)} />
                  <div style={{ background: "var(--bg4)", border: "1px solid var(--border)", borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, color: "var(--text3)" }}>{vol > 0 ? vol : "—"}</div>
                  <button style={{ background: "none", border: "none", color: "var(--text3)", cursor: "pointer", fontSize: 12 }} onClick={() => removeSet(ei, si)}>
                    ✕
                  </button>
                </div>
              );
            })}

            <div className="flex gap-8 mt-8">
              <button className="btn btn-ghost btn-sm" onClick={() => addSet(ei)}>
                + Set
              </button>
              <button className="btn btn-ghost btn-sm" onClick={() => repeatSet(ei)}>
                ⟳ Repeat
              </button>
            </div>
          </div>
        );
      })}

      {showAddEx ? (
        <div className="card">
          <div className="card-title">ADD EXERCISE</div>
          <div className="form-group">
            <label className="label">Muscle Group</label>
            <select className="input select" value={muscle} onChange={(e) => setMuscle(e.target.value)}>
              {MUSCLE_GROUPS.map((g) => (
                <option key={g}>{g}</option>
              ))}
            </select>
          </div>

          <div className="form-group">
            <label className="label">Choose Exercise</label>
            <select className="input select" value={selectedEx} onChange={(e) => setSelectedEx(e.target.value)}>
              <option value="">Select...</option>
              {(EXERCISE_DB[muscle] || []).map((e) => (
                <option key={e}>{e}</option>
              ))}
            </select>
          </div>

          <div style={{ textAlign: "center", fontSize: 11, color: "var(--text3)", margin: "6px 0" }}>— or type custom —</div>

          <div className="form-group">
            <input className="input" placeholder="Custom exercise name..." value={customEx} onChange={(e) => setCustomEx(e.target.value)} />
          </div>

          <div className="flex gap-8">
            <button className="btn btn-primary" onClick={addExercise}>
              Add
            </button>
            <button className="btn btn-ghost" onClick={() => setShowAddEx(false)}>
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <button className="btn btn-ghost" style={{ marginBottom: 12 }} onClick={() => setShowAddEx(true)}>
          + Add Exercise
        </button>
      )}

      {!isSimple && (
        <div className="form-group">
          <label className="label">Session Notes (+10 EXP)</label>
          <textarea className="input" rows={2} placeholder="How did it feel? Energy level? Notes..." value={notes} onChange={(e) => setNotes(e.target.value)} style={{ resize: "none" }} />
        </div>
      )}

      {exercises.length > 0 && (
        <button className="btn btn-gold" onClick={handleSave}>
          ✓ FINISH WORKOUT
        </button>
      )}
    </div>
  );
};

const MissionsScreen = ({ state, onMissionComplete }) => {
  const missions = state.todayMissions || [];
  const done = missions.filter((m) => m.completed).length;

  return (
    <div className="screen animate-slideup">
      <div className="header">
        <div>
          <div className="header-title">DAILY MISSIONS</div>
          <div className="header-sub">◈ EXP REWARDS AWAIT ◈</div>
        </div>
        <div style={{ textAlign: "right", fontFamily: "Rajdhani" }}>
          <div style={{ fontSize: 22, fontWeight: 700, color: "var(--gold2)" }}>
            {done}/{missions.length}
          </div>
          <div style={{ fontSize: 10, color: "var(--text3)" }}>DONE</div>
        </div>
      </div>

      <div className="card" style={{ marginBottom: 16 }}>
        <div className="card-title">TODAY'S PROGRESS</div>
        <ExpBar current={done} required={missions.length || 1} gold />
        <div style={{ fontFamily: "Rajdhani", fontSize: 12, color: "var(--text3)", marginTop: 6 }}>
          {done === missions.length && missions.length > 0 ? "🎉 All missions complete! Perfect Day achieved!!" : `${missions.length - done} remaining`}
        </div>
      </div>

      <div className="section-title">ACTIVE</div>
      <div className="section-sub">Tap to mark complete</div>

      {missions
        .filter((m) => !m.completed)
        .map((m) => (
          <div key={m.id} className="mission-card" onClick={() => onMissionComplete(m.id)}>
            <div className="mission-icon">{m.icon}</div>
            <div style={{ flex: 1 }}>
              <div className="mission-title">{m.title}</div>
              <div className="mission-desc">{m.desc}</div>
            </div>
            <div className="flex" style={{ alignItems: "center", gap: 8 }}>
              <div className="mission-exp">+{m.exp}</div>
              <div className="check-circle" />
            </div>
          </div>
        ))}

      {missions.filter((m) => m.completed).length > 0 && (
        <>
          <div className="divider" />
          <div className="card-title" style={{ marginBottom: 10 }}>
            COMPLETED
          </div>
          {missions
            .filter((m) => m.completed)
            .map((m) => (
              <div key={m.id} className="mission-card completed">
                <div className="mission-icon">{m.icon}</div>
                <div style={{ flex: 1 }}>
                  <div className="mission-title">{m.title}</div>
                  <div className="mission-desc">{m.desc}</div>
                </div>
                <div className="flex" style={{ alignItems: "center", gap: 8 }}>
                  <div className="mission-exp">+{m.exp}</div>
                  <div className="check-circle done">
                    <span style={{ color: "white", fontSize: 11 }}>✓</span>
                  </div>
                </div>
              </div>
            ))}
        </>
      )}
    </div>
  );
};

const ProgressScreen = ({ state }) => {
  const [tab, setTab] = useState("stats");
  const [selectedWorkout, setSelectedWorkout] = useState(null);
  const { level } = getLevelFromExp(state.totalExp);
  const history = state.workoutHistory || [];
  const last7 = history.slice(0, 7).reverse();
  const maxExp = Math.max(...last7.map((w) => w.expGained || 0), 1);
  const prList = Object.entries(state.exercisePRs || {})
    .map(([name, data]) => ({ name, ...data }))
    .sort((a, b) => new Date(b.date) - new Date(a.date));

  const muscleFreq = {};
  history.forEach((w) => {
    muscleFreq[w.muscle] = (muscleFreq[w.muscle] || 0) + 1;
  });
  const muscleList = Object.entries(muscleFreq).sort((a, b) => b[1] - a[1]);
  const maxFreq = Math.max(...Object.values(muscleFreq), 1);

  return (
    <div className="screen animate-slideup">
      {selectedWorkout && <WorkoutDetailModal workout={selectedWorkout} onClose={() => setSelectedWorkout(null)} />}

      <div className="header">
        <div>
          <div className="header-title">PROGRESS</div>
          <div className="header-sub">◈ YOUR GROWTH ◈</div>
        </div>
        <RankBadge level={level} />
      </div>

      <div className="tabs">
        {["stats", "history", "prs", "shadows"].map((t) => (
          <button key={t} className={`tab ${tab === t ? "active" : ""}`} onClick={() => setTab(t)}>
            {t === "shadows" ? "👻 Shadows" : t.toUpperCase()}
          </button>
        ))}
      </div>

      {tab === "stats" && (
        <>
          <div className="stat-row">
            <div className="stat-box">
              <div className="stat-val text-accent">{state.totalWorkouts}</div>
              <div className="stat-lbl">Sessions</div>
            </div>
            <div className="stat-box">
              <div className="stat-val text-gold">{state.totalExp.toLocaleString()}</div>
              <div className="stat-lbl">Total EXP</div>
            </div>
          </div>

          <div className="stat-row">
            <div className="stat-box">
              <div className="stat-val" style={{ color: "var(--orange)" }}>
                {state.streak}
              </div>
              <div className="stat-lbl">🔥 Streak</div>
            </div>
            <div className="stat-box">
              <div className="stat-val text-green">{state.totalPRs}</div>
              <div className="stat-lbl">PRs</div>
            </div>
            <div className="stat-box">
              <div className="stat-val" style={{ color: "var(--purple)" }}>
                {state.shadowsDefeated || 0}
              </div>
              <div className="stat-lbl">👻 Shadows</div>
            </div>
          </div>

          {last7.length > 0 && (
            <div className="card">
              <div className="card-title">EXP LAST SESSIONS</div>
              <div className="chart-bar-wrap">
                {last7.map((w, i) => (
                  <div key={i} style={{ flex: 1 }}>
                    <div className="chart-bar" style={{ height: `${((w.expGained || 0) / maxExp) * 72}px`, background: "linear-gradient(to top,var(--accent),var(--cyan))" }} />
                    <div className="chart-label">{new Date(w.date).toLocaleDateString("en", { weekday: "short" }).charAt(0)}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {muscleList.length > 0 && (
            <div className="card">
              <div className="card-title">MUSCLE GROUP FREQUENCY</div>
              {muscleList.map(([muscle, count]) => (
                <div key={muscle} style={{ marginBottom: 8 }}>
                  <div className="flex-between" style={{ marginBottom: 4 }}>
                    <span style={{ fontFamily: "Rajdhani", fontSize: 13, color: "var(--text2)" }}>{muscle}</span>
                    <span style={{ fontFamily: "Rajdhani", fontSize: 12, color: "var(--text3)" }}>{count}x</span>
                  </div>
                  <div className="exp-bar-wrap" style={{ height: 6 }}>
                    <div className="exp-bar-fill" style={{ width: `${(count / maxFreq) * 100}%`, height: 6 }} />
                  </div>
                </div>
              ))}
            </div>
          )}

          <div className="card">
            <div className="card-title">RANK PROGRESSION</div>
            {RANKS.map((r) => {
              const isCur = level >= r.min && level <= r.max;
              const isPast = level > r.max;
              return (
                <div
                  key={r.rank}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                    padding: "8px 0",
                    borderBottom: "1px solid var(--border)",
                    opacity: isPast ? 0.5 : 1,
                  }}
                >
                  <div style={{ width: 32, height: 32, borderRadius: 8, background: r.bg, border: `2px solid ${r.color}`, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "Rajdhani", fontWeight: 700, color: r.color, fontSize: 13, flexShrink: 0 }}>{r.rank}</div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontFamily: "Rajdhani", fontSize: 13, fontWeight: 600, color: isCur ? r.color : "var(--text2)" }}>
                      {r.title} {isCur && "(Current)"}
                    </div>
                    <div style={{ fontSize: 10, color: "var(--text3)" }}>Lv {r.min}{r.max < Infinity ? `–${r.max}` : "+"}</div>
                  </div>
                  {isPast && <span style={{ color: "var(--green)" }}>✓</span>}
                  {isCur && <span className="animate-pulse" style={{ color: r.color }}>◈</span>}
                </div>
              );
            })}
          </div>
        </>
      )}

      {tab === "history" &&
        (history.length === 0 ? (
          <div style={{ textAlign: "center", padding: 40, color: "var(--text3)" }}>
            <div style={{ fontSize: 40, marginBottom: 12 }}>🗡️</div>
            <div style={{ fontFamily: "Rajdhani", fontSize: 17, fontWeight: 700 }}>No workouts yet</div>
          </div>
        ) : (
          history.map((w) => (
            <div key={w.id} className="history-item" onClick={() => setSelectedWorkout(w)}>
              <div className="history-date">{new Date(w.date).toLocaleDateString("en", { weekday: "long", month: "short", day: "numeric" })} · {w.duration}min</div>
              <div className="history-name">{w.name}</div>
              <div>
                <span className="tag exp">+{w.expGained} EXP</span>
                {w.prs > 0 && <span className="tag pr">🏆 {w.prs} PR{w.prs > 1 ? "s" : ""}</span>}
                {w.shadowsDefeated > 0 && <span className="tag" style={{ color: "var(--purple)" }}>👻 {w.shadowsDefeated}</span>}
                <span className="tag">{w.muscle}</span>
                <span className="tag">{w.exercises?.length || 0} ex</span>
              </div>
            </div>
          ))
        ))}

      {tab === "prs" &&
        (prList.length === 0 ? (
          <div style={{ textAlign: "center", padding: 40, color: "var(--text3)" }}>
            <div style={{ fontSize: 40, marginBottom: 12 }}>🏆</div>
            <div style={{ fontFamily: "Rajdhani", fontSize: 17, fontWeight: 700 }}>No PRs yet</div>
          </div>
        ) : (
          prList.map((pr) => (
            <div key={pr.name} className="card" style={{ marginBottom: 8 }}>
              <div className="flex-between">
                <div>
                  <div style={{ fontFamily: "Rajdhani", fontSize: 15, fontWeight: 700, color: "var(--text)" }}>{pr.name}</div>
                  <div style={{ fontSize: 11, color: "var(--text3)", marginTop: 2 }}>{new Date(pr.date).toLocaleDateString()}</div>
                </div>
                <div style={{ textAlign: "right" }}>
                  <div style={{ fontFamily: "Rajdhani", fontSize: 22, fontWeight: 700, color: "var(--gold2)" }}>{pr.weight}kg</div>
                  <div style={{ fontSize: 11, color: "var(--text3)" }}>{pr.reps} reps</div>
                </div>
              </div>
            </div>
          ))
        ))}

      {tab === "shadows" && (
        <div>
          <SysMsg text="[System] Shadow enemies are generated from your best performance. Surpass them to earn bonus EXP." />
          <div className="stat-box" style={{ marginBottom: 12, padding: 16, textAlign: "center" }}>
            <div className="stat-val" style={{ color: "var(--purple)", fontSize: 32 }}>{state.shadowsDefeated || 0}</div>
            <div className="stat-lbl">Total Shadows Defeated</div>
          </div>

          {prList.length === 0 ? (
            <div style={{ textAlign: "center", padding: 40, color: "var(--text3)" }}>
              <div style={{ fontSize: 40, marginBottom: 12 }}>👻</div>
              <div style={{ fontFamily: "Rajdhani", fontSize: 17, fontWeight: 700 }}>Log a workout to spawn shadows</div>
            </div>
          ) : (
            prList.map((pr) => (
              <div key={pr.name} className="shadow-card">
                <div className="shadow-name">👻 {pr.name}</div>
                <div style={{ fontSize: 11, color: "var(--text3)", marginBottom: 8 }}>Beat {pr.weight}kg × {pr.reps} reps to defeat this shadow</div>
                <div className="shadow-compare">
                  <div className="shadow-stat">
                    <div className="shadow-stat-val" style={{ color: "var(--purple)" }}>{pr.weight}kg</div>
                    <div className="shadow-stat-lbl">SHADOW</div>
                  </div>
                  <div className="shadow-vs">VS</div>
                  <div className="shadow-stat">
                    <div className="shadow-stat-val" style={{ color: "var(--text3)" }}>?</div>
                    <div className="shadow-stat-lbl">YOU</div>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
};

const AchievementsScreen = ({ state }) => {
  const { level } = getLevelFromExp(state.totalExp);
  const unlocked = state.achievements || [];
  const rankAchs = ACHIEVEMENTS_LIST.filter((a) => a.rankPromo);
  const regularAchs = ACHIEVEMENTS_LIST.filter((a) => !a.rankPromo);

  const RankAchCard = ({ a }) => {
    const isUnlocked = unlocked.includes(a.id);
    const rank = getRank(level);
    const isCurrent = rank.rank === a.rankPromo && isUnlocked;
    const r = RANKS.find((rk) => rk.rank === a.rankPromo) || RANKS[0];

    return (
      <div
        key={a.id}
        style={{
          display: "flex",
          alignItems: "center",
          gap: 12,
          padding: 12,
          background: isUnlocked ? r.bg : "var(--bg3)",
          border: `1px solid ${isUnlocked ? `${r.color}44` : "var(--border)"}`,
          borderRadius: 12,
          marginBottom: 8,
          transition: "all .2s",
        }}
      >
        <div
          style={{
            width: 44,
            height: 44,
            borderRadius: 10,
            background: isUnlocked ? r.bg : "var(--bg4)",
            border: `2px solid ${isUnlocked ? r.color : "var(--border)"}`,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontFamily: "Rajdhani",
            fontWeight: 700,
            fontSize: 16,
            color: isUnlocked ? r.color : "var(--text3)",
            flexShrink: 0,
            filter: isUnlocked ? "none" : "grayscale(1)",
          }}
        >
          {a.rankPromo}
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontFamily: "Rajdhani", fontSize: 15, fontWeight: 700, color: isUnlocked ? r.color : "var(--text3)" }}>{a.title}</div>
          <div style={{ fontSize: 11, color: "var(--text3)", marginTop: 2 }}>{a.desc}</div>
          {isUnlocked && (
            <div style={{ fontFamily: "Rajdhani", fontSize: 11, color: r.color, marginTop: 3 }}>
              ✓ PROMOTED · Lv {a.rankPromo === "E" ? 1 : a.rankPromo === "D" ? 10 : a.rankPromo === "C" ? 20 : a.rankPromo === "B" ? 35 : a.rankPromo === "A" ? 50 : a.rankPromo === "AA" ? 70 : a.rankPromo === "S" ? 90 : a.rankPromo === "SS" ? 110 : 130}+
            </div>
          )}
        </div>
        {isCurrent && <span style={{ color: r.color, fontSize: 12, fontFamily: "Rajdhani", fontWeight: 700 }} className="animate-pulse">CURRENT</span>}
        {isUnlocked && !isCurrent && <span style={{ color: r.color, fontSize: 18 }}>✓</span>}
      </div>
    );
  };

  return (
    <div className="screen animate-slideup">
      <div className="header">
        <div>
          <div className="header-title">ACHIEVEMENTS</div>
          <div className="header-sub">◈ {unlocked.length}/{ACHIEVEMENTS_LIST.length} UNLOCKED ◈</div>
        </div>
        <div style={{ fontFamily: "Rajdhani", fontSize: 22, fontWeight: 700, color: "var(--gold2)" }}>
          {unlocked.length}/{ACHIEVEMENTS_LIST.length}
        </div>
      </div>

      <div className="card" style={{ marginBottom: 16 }}>
        <div className="card-title">UNLOCK PROGRESS</div>
        <ExpBar current={unlocked.length} required={ACHIEVEMENTS_LIST.length} gold />
        <div style={{ fontFamily: "Rajdhani", fontSize: 12, color: "var(--text3)", marginTop: 6 }}>{ACHIEVEMENTS_LIST.length - unlocked.length} achievements remaining</div>
      </div>

      <div style={{ fontFamily: "Rajdhani", fontSize: 12, fontWeight: 700, color: "var(--text3)", letterSpacing: 1.5, marginBottom: 10, textTransform: "uppercase" }}>◈ Rank Progression Road</div>

      <div style={{ display: "flex", alignItems: "center", gap: 4, marginBottom: 12, padding: "10px 12px", background: "var(--bg2)", border: "1px solid var(--border)", borderRadius: 12, overflowX: "auto" }}>
        {RANKS.map((r, i) => {
          const isReached = level >= r.min;
          const isCur = level >= r.min && level <= r.max;
          return (
            <div key={r.rank} style={{ display: "flex", alignItems: "center", gap: 4, flexShrink: 0 }}>
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 3 }}>
                <div
                  style={{
                    width: 36,
                    height: 36,
                    borderRadius: 8,
                    background: isReached ? r.bg : "var(--bg4)",
                    border: `2px solid ${isReached ? r.color : "var(--border)"}`,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontFamily: "Rajdhani",
                    fontWeight: 700,
                    fontSize: 13,
                    color: isReached ? r.color : "var(--text3)",
                    boxShadow: isCur ? `0 0 10px ${r.color}44` : "none",
                  }}
                  className={isCur ? "animate-pulse" : ""}
                >
                  {r.rank}
                </div>
                <div style={{ fontFamily: "Rajdhani", fontSize: 8, color: isReached ? r.color : "var(--text3)", letterSpacing: 0.5, textAlign: "center" }}>Lv{r.min}</div>
              </div>
              {i < RANKS.length - 1 && <div style={{ width: 12, height: 1, background: level > r.max ? "var(--accent2)" : "var(--border)", flexShrink: 0 }} />}
            </div>
          );
        })}
      </div>

      <div style={{ marginBottom: 16 }}>{rankAchs.map((a) => <RankAchCard key={a.id} a={a} />)}</div>

      <div style={{ fontFamily: "Rajdhani", fontSize: 12, fontWeight: 700, color: "var(--text3)", letterSpacing: 1.5, marginBottom: 10, textTransform: "uppercase" }}>◈ Combat Achievements</div>

      {regularAchs.map((a) => {
        const isUnlocked = unlocked.includes(a.id);
        return (
          <div key={a.id} className={`achievement ${isUnlocked ? "unlocked" : ""}`}>
            <div className="achievement-icon">{a.icon}</div>
            <div>
              <div className="achievement-title">{a.title}</div>
              <div className="achievement-desc">{a.desc}</div>
              {isUnlocked && <div style={{ fontFamily: "Rajdhani", fontSize: 11, color: "var(--green)", marginTop: 2 }}>✓ UNLOCKED</div>}
            </div>
            {isUnlocked && <span style={{ marginLeft: "auto", color: "var(--gold2)", fontSize: 18 }}>🏆</span>}
          </div>
        );
      })}
    </div>
  );
};

const ScheduleScreen = () => {
  const [wakeTime, setWakeTime] = useState("07:00");
  const [sleepTime, setSleepTime] = useState("23:00");
  const [classes, setClasses] = useState([{ day: "Monday", start: "09:00", end: "11:00" }]);
  const [workStart, setWorkStart] = useState("14:00");
  const [workEnd, setWorkEnd] = useState("18:00");
  const [commuteUni, setCommuteUni] = useState("30");
  const [commuteWork, setCommuteWork] = useState("20");
  const [studyHours, setStudyHours] = useState("2");
  const [prefLength, setPrefLength] = useState("60");
  const [examDates, setExamDates] = useState("");
  const [slots, setSlots] = useState([]);
  const [generated, setGenerated] = useState(false);

  const addClass = () => setClasses((c) => [...c, { day: "Tuesday", start: "13:00", end: "15:00" }]);
  const updateClass = (i, f, v) => setClasses((c) => c.map((cl, j) => (j === i ? { ...cl, [f]: v } : cl)));
  const removeClass = (i) => setClasses((c) => c.filter((_, j) => j !== i));

  const generate = () => {
    const wake = parseInt(wakeTime.split(":")[0]);
    const sleep = parseInt(sleepTime.split(":")[0]);
    const ws = parseInt(workStart.split(":")[0]);
    const we = parseInt(workEnd.split(":")[0]);
    const comU = parseInt(commuteUni) || 0;
    const comW = parseInt(commuteWork) || 0;
    const study = parseInt(studyHours) || 0;
    const len = parseInt(prefLength) || 60;
    const windows = [];

    const firstCommit = Math.min(ws, ...classes.map((c) => parseInt(c.start.split(":")[0])));
    const morningFree = (firstCommit - wake - comU / 60) * 60 - 30;
    if (morningFree >= len) {
      windows.push({ time: `${String(wake + 1).padStart(2, "0")}:00`, label: "Morning Session", note: `Before classes/work · ${Math.floor(morningFree)} min free 🌅`, score: 92 });
    }

    const postWork = we + Math.ceil(comW / 60);
    const eveningFree = (sleep - postWork - study - 1) * 60;
    if (eveningFree >= len) {
      windows.push({ time: `${String(postWork).padStart(2, "0")}:${comW % 60 === 0 ? "00" : "30"}`, label: "Post-Work Window", note: `After commute home · ${Math.floor(eveningFree)} min free 🌆`, score: 80 });
    }

    if (classes.length > 0) {
      const mid = parseInt(classes[0].end.split(":")[0]) + 1;
      if (mid < ws) {
        windows.push({ time: `${String(mid).padStart(2, "0")}:00`, label: "Midday Break", note: `Between classes and work · ~60 min ☀️`, score: 65 });
      }
    }

    setSlots(windows.sort((a, b) => b.score - a.score));
    setGenerated(true);
  };

  return (
    <div className="screen animate-slideup">
      <div className="header">
        <div>
          <div className="header-title">SMART SCHEDULE</div>
          <div className="header-sub">◈ FIND YOUR OPTIMAL WINDOW ◈</div>
        </div>
        <span style={{ fontSize: 24 }}>📅</span>
      </div>

      <SysMsg text="[System] Input your full schedule. The system will calculate optimal training windows automatically." />

      <div className="card">
        <div className="card-title">SLEEP SCHEDULE</div>
        <div className="flex gap-8">
          <div style={{ flex: 1 }}>
            <label className="label">Wake Up</label>
            <input className="input" type="time" value={wakeTime} onChange={(e) => setWakeTime(e.target.value)} />
          </div>
          <div style={{ flex: 1 }}>
            <label className="label">Sleep Time</label>
            <input className="input" type="time" value={sleepTime} onChange={(e) => setSleepTime(e.target.value)} />
          </div>
        </div>
      </div>

      <div className="card">
        <div className="flex-between mb-8">
          <div className="card-title" style={{ margin: 0 }}>UNIVERSITY CLASSES</div>
          <button className="btn btn-ghost btn-sm" onClick={addClass}>+ Add</button>
        </div>

        {classes.map((cl, i) => (
          <div key={i} style={{ background: "var(--bg4)", border: "1px solid var(--border)", borderRadius: 10, padding: 10, marginBottom: 8 }}>
            <div className="flex gap-8" style={{ alignItems: "center" }}>
              <div style={{ flex: 2 }}>
                <label className="label">Day</label>
                <select className="input select" style={{ padding: "8px 10px" }} value={cl.day} onChange={(e) => updateClass(i, "day", e.target.value)}>
                  {["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"].map((d) => <option key={d}>{d}</option>)}
                </select>
              </div>
              <div style={{ flex: 1 }}>
                <label className="label">Start</label>
                <input className="input" type="time" value={cl.start} onChange={(e) => updateClass(i, "start", e.target.value)} />
              </div>
              <div style={{ flex: 1 }}>
                <label className="label">End</label>
                <input className="input" type="time" value={cl.end} onChange={(e) => updateClass(i, "end", e.target.value)} />
              </div>
              <button style={{ background: "none", border: "none", color: "var(--text3)", cursor: "pointer", fontSize: 16, marginTop: 16, flexShrink: 0 }} onClick={() => removeClass(i)}>✕</button>
            </div>
          </div>
        ))}
      </div>

      <div className="card">
        <div className="card-title">WORK SHIFT</div>
        <div className="flex gap-8">
          <div style={{ flex: 1 }}>
            <label className="label">Start</label>
            <input className="input" type="time" value={workStart} onChange={(e) => setWorkStart(e.target.value)} />
          </div>
          <div style={{ flex: 1 }}>
            <label className="label">End</label>
            <input className="input" type="time" value={workEnd} onChange={(e) => setWorkEnd(e.target.value)} />
          </div>
        </div>
      </div>

      <div className="card">
        <div className="card-title">COMMUTE, STUDY & EXAMS</div>
        <div className="flex gap-8" style={{ marginBottom: 8 }}>
          <div style={{ flex: 1 }}>
            <label className="label">To Uni (min)</label>
            <input className="input" type="number" value={commuteUni} onChange={(e) => setCommuteUni(e.target.value)} placeholder="30" />
          </div>
          <div style={{ flex: 1 }}>
            <label className="label">To Work (min)</label>
            <input className="input" type="number" value={commuteWork} onChange={(e) => setCommuteWork(e.target.value)} placeholder="20" />
          </div>
        </div>

        <div className="flex gap-8">
          <div style={{ flex: 1 }}>
            <label className="label">Study Hours/Day</label>
            <select className="input select" value={studyHours} onChange={(e) => setStudyHours(e.target.value)}>
              {["1", "2", "3", "4", "5", "6"].map((h) => <option key={h} value={h}>{h}h</option>)}
            </select>
          </div>
          <div style={{ flex: 1 }}>
            <label className="label">Workout Length</label>
            <select className="input select" value={prefLength} onChange={(e) => setPrefLength(e.target.value)}>
              {["30", "45", "60", "75", "90"].map((l) => <option key={l} value={l}>{l} min</option>)}
            </select>
          </div>
        </div>

        <div className="form-group" style={{ marginTop: 8 }}>
          <label className="label">Exam Dates (optional)</label>
          <input className="input" placeholder="e.g. Mar 20, Apr 5 — rest days" value={examDates} onChange={(e) => setExamDates(e.target.value)} />
        </div>
      </div>

      <button className="btn btn-primary" style={{ marginBottom: 16 }} onClick={generate}>⚡ CALCULATE OPTIMAL WINDOWS</button>

      {generated && (
        <div className="card animate-slideup">
          <div className="card-title">RECOMMENDED WINDOWS</div>
          <SysMsg type="success" text={`[System] Analysis complete. ${slots.length} optimal window${slots.length !== 1 ? "s" : ""} found.`} />
          {slots.length === 0 && <div style={{ textAlign: "center", color: "var(--text3)", fontFamily: "Rajdhani", padding: 16 }}>No free windows found. Try adjusting your schedule.</div>}

          {slots.map((slot, i) => (
            <div key={i} className={`time-slot ${i === 0 ? "best" : ""}`}>
              <div className="time-dot" />
              <div style={{ flex: 1 }}>
                <div className="time-text">{slot.time} — {slot.label}</div>
                <div className="time-note">{slot.note}</div>
              </div>
              <div style={{ fontFamily: "Rajdhani", fontSize: 13, fontWeight: 700, color: i === 0 ? "var(--green)" : "var(--text3)" }}>{slot.score}%</div>
            </div>
          ))}

          {slots[0] && <SysMsg type="success" text={`[System] Optimal window: ${slots[0].time} — ${slots[0].label}. Prepare your gear, Hunter.`} />}
          {examDates && <SysMsg type="warning" text={`[System] Exam dates detected: ${examDates}. Reduced intensity recommended.`} />}
        </div>
      )}
    </div>
  );
};

const ProfileScreen = ({ state, onReset }) => {
  const { level, currentExp, requiredExp } = getLevelFromExp(state.totalExp);
  const rank = getRank(level);
  const [showConfirm, setShowConfirm] = useState(false);

  const avgDuration = state.totalWorkouts > 0 ? Math.round((state.workoutHistory || []).reduce((a, w) => a + (w.duration || 0), 0) / state.totalWorkouts) : 0;
  const totalVolume = (state.workoutHistory || []).reduce(
    (acc, w) =>
      acc +
      (w.exercises || []).reduce(
        (ea, ex) =>
          ea + (ex.sets || []).reduce((sa, s) => sa + (parseFloat(s.weight) || 0) * (parseInt(s.reps) || 0), 0),
        0
      ),
    0
  );

  return (
    <div className="screen animate-slideup">
      <div className="header">
        <div>
          <div className="header-title">PROFILE</div>
          <div className="header-sub">◈ HUNTER STATS ◈</div>
        </div>
        <RankBadge level={level} size={48} />
      </div>

      <div style={{ background: "linear-gradient(135deg,#0a1628,#1a1a3e)", border: "1px solid rgba(139,92,246,.2)", borderRadius: 16, padding: 20, marginBottom: 12, textAlign: "center", position: "relative", overflow: "hidden" }}>
        <div style={{ position: "absolute", top: -30, left: "50%", transform: "translateX(-50%)", width: 200, height: 200, background: "radial-gradient(circle,rgba(139,92,246,.08),transparent 70%)" }} />
        <div style={{ position: "relative", zIndex: 1 }}>
          <div style={{ fontSize: 48, marginBottom: 8 }}>⚔️</div>
          <div style={{ fontFamily: "Rajdhani", fontSize: 26, fontWeight: 700, color: rank.color, marginBottom: 4 }}>{state.hunterName}</div>
          <div style={{ fontFamily: "Rajdhani", fontSize: 14, color: "var(--text3)", marginBottom: 12 }}>{rank.title} · Level {level}</div>
          <ExpBar current={currentExp} required={requiredExp} height={10} />
          <div style={{ fontFamily: "Rajdhani", fontSize: 11, color: "var(--text3)", marginTop: 6 }}>
            {currentExp.toLocaleString()} / {requiredExp.toLocaleString()} EXP to Level {level + 1}
          </div>
        </div>
      </div>

      <div className="stat-row">
        <div className="stat-box">
          <div className="stat-val text-accent">{state.totalWorkouts}</div>
          <div className="stat-lbl">Sessions</div>
        </div>
        <div className="stat-box">
          <div className="stat-val text-gold">{state.streak}</div>
          <div className="stat-lbl">🔥 Streak</div>
        </div>
        <div className="stat-box">
          <div className="stat-val text-green">{state.totalPRs}</div>
          <div className="stat-lbl">PRs</div>
        </div>
      </div>

      <div className="stat-row">
        <div className="stat-box">
          <div className="stat-val" style={{ color: "var(--purple)" }}>{state.shadowsDefeated || 0}</div>
          <div className="stat-lbl">👻 Shadows</div>
        </div>
        <div className="stat-box">
          <div className="stat-val" style={{ fontSize: 14, color: "var(--cyan)" }}>{(totalVolume / 1000).toFixed(1)}t</div>
          <div className="stat-lbl">Volume</div>
        </div>
        <div className="stat-box">
          <div className="stat-val" style={{ color: "var(--text2)" }}>{avgDuration}m</div>
          <div className="stat-lbl">Avg Session</div>
        </div>
      </div>

      <div className="card">
        <div className="card-title">ALL-TIME STATS</div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
          {[
            { label: "Total EXP", val: state.totalExp.toLocaleString(), color: "var(--gold2)" },
            { label: "Missions Done", val: state.missionsCompleted || 0, color: "var(--green)" },
            { label: "Achievements", val: `${(state.achievements || []).length}/${ACHIEVEMENTS_LIST.length}`, color: "var(--gold2)" },
            { label: "Rank", val: rank.rank, color: rank.color },
          ].map((s) => (
            <div key={s.label} style={{ background: "var(--bg4)", border: "1px solid var(--border)", borderRadius: 10, padding: 10, textAlign: "center" }}>
              <div style={{ fontFamily: "Rajdhani", fontSize: 18, fontWeight: 700, color: s.color }}>{s.val}</div>
              <div style={{ fontSize: 10, color: "var(--text3)", marginTop: 2, fontFamily: "Rajdhani", letterSpacing: 0.5 }}>{s.label}</div>
            </div>
          ))}
        </div>
      </div>

      <div className="card" style={{ borderColor: "rgba(239,68,68,.15)" }}>
        <div className="card-title" style={{ color: "var(--red)" }}>DANGER ZONE</div>
        <div style={{ fontSize: 12, color: "var(--text3)", marginBottom: 12, lineHeight: 1.6 }}>
          Resetting will permanently delete all your workout history, EXP, levels, and progress. This cannot be undone.
        </div>

        {!showConfirm ? (
          <button className="btn btn-ghost" style={{ borderColor: "rgba(239,68,68,.3)", color: "var(--red)" }} onClick={() => setShowConfirm(true)}>
            Reset All Data
          </button>
        ) : (
          <div>
            <div style={{ fontFamily: "Rajdhani", fontSize: 14, color: "var(--red)", marginBottom: 8, textAlign: "center" }}>Are you sure? This is permanent.</div>
            <div className="flex gap-8">
              <button className="btn btn-red" onClick={onReset}>Confirm Reset</button>
              <button className="btn btn-ghost" onClick={() => setShowConfirm(false)}>Cancel</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

// ─── MAIN ─────────────────────────────────────────────────────
export default function App() {
  const [state, setState] = useState(null);
  const [screen, setScreen] = useState("dashboard");
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [toast, setToast] = useState({ show: false, icon: "", title: "", sub: "", exp: 0 });
  const [rankPromo, setRankPromo] = useState(null);
  const toastTimer = useRef(null);

  useEffect(() => {
    loadState().then((s) => {
      setState(s);
      setShowOnboarding(!s.hunterName);
    });
  }, []);

  useEffect(() => {
    if (state) saveState(state);
  }, [state]);

  useEffect(() => {
    if (!state) return;
    const today = new Date().toDateString();
    if (state.missionDate !== today) {
      const shuffled = [...MISSIONS_POOL].sort(() => Math.random() - 0.5).slice(0, 4);
      setState((s) => ({
        ...s,
        todayMissions: shuffled.map((m) => ({ ...m, completed: false })),
        missionDate: today,
      }));
    }
  }, [state?.missionDate]);

  const showToast = (icon, title, sub, exp) => {
    setToast({ show: true, icon, title, sub, exp });
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast((t) => ({ ...t, show: false })), 3500);
  };

  const handleOnboard = (name) => {
    setState((s) => ({ ...s, hunterName: name }));
    setShowOnboarding(false);
    showToast("⚔️", "System Online", `Welcome, Hunter ${name}.`, 0);
  };

  const handleSaveWorkout = (workout, expGained, newPRs, shadows) => {
    const today = new Date().toDateString();
    const wasYesterday = state.lastWorkoutDate === new Date(Date.now() - 86400000).toDateString();
    const newStreak = state.lastWorkoutDate === today ? state.streak : wasYesterday ? state.streak + 1 : 1;
    const streakBonus = newStreak > 1 ? Math.min(newStreak * 5, 50) : 0;
    const totalExp = expGained + streakBonus;
    const newPRCount = Object.keys(newPRs).filter((k) => !state.exercisePRs[k] || newPRs[k].weight > (state.exercisePRs[k]?.weight || 0)).length;
    const prevLevel = getLevelFromExp(state.totalExp).level;

    const ns = {
      ...state,
      totalExp: state.totalExp + totalExp,
      streak: newStreak,
      lastWorkoutDate: today,
      totalWorkouts: state.totalWorkouts + 1,
      totalPRs: state.totalPRs + newPRCount,
      shadowsDefeated: (state.shadowsDefeated || 0) + (shadows?.length || 0),
      workoutHistory: [workout, ...state.workoutHistory].slice(0, 60),
      exercisePRs: { ...state.exercisePRs, ...newPRs },
    };

    const { level: newLevel } = getLevelFromExp(ns.totalExp);
    ns.level = newLevel;

    const newAch = [...(ns.achievements || [])];
    ACHIEVEMENTS_LIST.forEach((a) => {
      if (!newAch.includes(a.id) && a.condition(ns)) {
        newAch.push(a.id);
        if (a.rankPromo) {
          const r = getRank(newLevel);
          if (r.rank === a.rankPromo) setTimeout(() => setRankPromo(r), 800);
        } else {
          setTimeout(() => showToast("🏆", "Achievement Unlocked!", a.title, 0), 2500);
        }
      }
    });
    ns.achievements = newAch;

    setState(ns);
    setScreen("dashboard");

    if (shadows?.length > 0) {
      showToast("👻", `${shadows.length} Shadow${shadows.length > 1 ? "s" : ""} Defeated!`, workout.name, totalExp);
    } else if (newPRCount > 0) {
      showToast("🏆", `${newPRCount} New PR${newPRCount > 1 ? "s" : ""}!`, workout.name, totalExp);
    } else {
      showToast("⚔️", "Workout Complete!", `${workout.exercises.length} exercises · +${streakBonus} streak bonus`, totalExp);
    }
  };

  const handleMissionComplete = (id) => {
    const m = (state.todayMissions || []).find((m) => m.id === id);
    if (!m || m.completed) return;

    const newMissions = state.todayMissions.map((ms) => (ms.id === id ? { ...ms, completed: true } : ms));
    const allDone = newMissions.every((m) => m.completed);

    setState((s) => ({
      ...s,
      totalExp: s.totalExp + m.exp,
      missionsCompleted: (s.missionsCompleted || 0) + 1,
      perfectMissionDays: allDone ? (s.perfectMissionDays || 0) + 1 : s.perfectMissionDays || 0,
      todayMissions: newMissions,
    }));

    showToast("🎯", "Mission Complete!", m.title, m.exp);
  };

  const handleModeChange = (mode) => {
    setState((s) => ({ ...s, mode }));
    showToast(mode === "hunter" ? "⚔️" : "🏋️", mode === "hunter" ? "Hunter Mode Active" : "Simple Mode Active", mode === "hunter" ? "Full RPG experience enabled" : "Fast logging mode enabled", 0);
  };

  const handleReset = async () => {
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {}
    setState({ ...INITIAL_STATE });
    setShowOnboarding(true);
    setScreen("dashboard");
  };

  if (!state) {
    return (
      <>
        <style>{CSS}</style>
        <div className="app">
          <div className="loading-screen">
            <div className="loading-spinner" />
            <div style={{ fontFamily: "Rajdhani", fontSize: 14, color: "var(--text3)", letterSpacing: 2 }}>SYSTEM LOADING...</div>
          </div>
        </div>
      </>
    );
  }

  if (showOnboarding) {
    return (
      <>
        <style>{CSS}</style>
        <OnboardingScreen onComplete={handleOnboard} />
      </>
    );
  }

  const pending = (state.todayMissions || []).filter((m) => !m.completed).length;

  return (
    <>
      <style>{CSS}</style>
      <div className="app">
        <Toast toast={toast} />
        {rankPromo && <RankPromoModal rank={rankPromo} onClose={() => setRankPromo(null)} />}

        {screen === "dashboard" && <DashboardScreen state={state} onStartWorkout={() => setScreen("workout")} onMissionComplete={handleMissionComplete} onViewMissions={() => setScreen("missions")} onModeChange={handleModeChange} />}
        {screen === "workout" && <WorkoutScreen state={state} onSaveWorkout={handleSaveWorkout} onCancel={() => setScreen("dashboard")} />}
        {screen === "missions" && <MissionsScreen state={state} onMissionComplete={handleMissionComplete} />}
        {screen === "progress" && <ProgressScreen state={state} />}
        {screen === "achievements" && <AchievementsScreen state={state} />}
        {screen === "schedule" && <ScheduleScreen />}
        {screen === "profile" && <ProfileScreen state={state} onReset={handleReset} />}

        {screen !== "workout" && (
          <nav className="nav">
            {[
              { id: "dashboard", icon: "⚡", label: "Home" },
              { id: "missions", icon: "🗡️", label: "Missions", badge: pending },
              { id: "workout", icon: "💪", label: "Train" },
              { id: "progress", icon: "📊", label: "Progress" },
              { id: "achievements", icon: "🏆", label: "Awards" },
              { id: "schedule", icon: "📅", label: "Schedule" },
              { id: "profile", icon: "👤", label: "Profile" },
            ].map((n) => (
              <button key={n.id} className={`nav-btn ${screen === n.id ? "active" : ""}`} onClick={() => setScreen(n.id)}>
                <div className="nav-icon">
                  {n.icon}
                  {n.badge > 0 && <div className="notif-dot" />}
                </div>
                <span className="nav-label">{n.label}</span>
              </button>
            ))}
          </nav>
        )}
      </div>
    </>
  );
}
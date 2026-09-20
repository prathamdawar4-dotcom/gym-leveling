import { useEffect, useRef, useState } from "react";

// ─────────────────────────────────────────────────────────────
// STORAGE
// ─────────────────────────────────────────────────────────────
const APP_KEY = "gym_lvl_v4";
const LEGACY_APP_KEY = "gym_lvl_v3";
const ACTIVE_WORKOUT_KEY = "gym_lvl_active_workout_v1";
const JOURNAL_KEY = "gym_lvl_journal_v1";
const MIGRATION_BACKUP_KEY = "gym_lvl_pre_migration_backup_v1";

const safeParse = (raw, fallback) => {
  try {
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
};

const saveJSON = (key, value) => {
  try {
    localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
};

const loadJSON = (key, fallback) => safeParse(localStorage.getItem(key), fallback);

const removeStorage = (key) => {
  try {
    localStorage.removeItem(key);
  } catch {}
};

// ─────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────
const KG_PER_LB = 0.45359237;
const lbToKg = (lb) => (parseFloat(lb) || 0) * KG_PER_LB;
const kgToLb = (kg) => (parseFloat(kg) || 0) / KG_PER_LB;
const round = (n, digits = 2) => Number((Number(n) || 0).toFixed(digits));
const formatNum = (n, digits = 2) => {
  const x = round(n, digits);
  return Number.isInteger(x) ? String(x) : String(x);
};
const todayKey = () => new Date().toISOString().slice(0, 10);
const formatDateLong = (iso) => {
  const d = new Date(iso);
  return `${d.getDate()} ${d.toLocaleDateString("en", { month: "long" })} ${d.getFullYear()}`;
};

const weightToKg = (value, unit) => (unit === "lb" ? lbToKg(value) : parseFloat(value) || 0);
const kgToDisplay = (kg, unit) => (unit === "lb" ? round(kgToLb(kg), 1) : round(kg, 2));

const calculateSetIntensity = (weightKg, reps) => {
  const w = parseFloat(weightKg) || 0;
  const r = parseInt(reps) || 0;
  if (!w || !r) return 0;
  return w * (1 + r / 30); // Epley estimated 1RM
};

const calculateExerciseStats = (sets = []) => {
  let bestIntensity = 0;
  let bestWeightKg = 0;
  let bestReps = 0;
  let totalVolumeKg = 0;
  let totalReps = 0;
  let validSets = 0;

  sets.forEach((set) => {
    const weightKg = parseFloat(set.weightKg) || 0;
    const reps = parseInt(set.reps) || 0;
    if (!weightKg || !reps) return;
    const intensity = calculateSetIntensity(weightKg, reps);
    const volume = weightKg * reps;
    totalVolumeKg += volume;
    totalReps += reps;
    validSets += 1;
    if (intensity > bestIntensity) {
      bestIntensity = intensity;
      bestWeightKg = weightKg;
      bestReps = reps;
    }
  });

  return { bestIntensity, bestWeightKg, bestReps, totalVolumeKg, totalReps, validSets };
};

const calculateSessionVolumeKg = (exercises = []) =>
  exercises.reduce((sum, ex) => sum + calculateExerciseStats(ex.sets).totalVolumeKg, 0);

const calculateSessionSets = (exercises = []) =>
  exercises.reduce((sum, ex) => sum + calculateExerciseStats(ex.sets).validSets, 0);

const buildJournalText = (draft) => {
  if (!draft) return "";
  const dateText = formatDateLong(draft.createdAt || new Date().toISOString());
  const bw = draft.bodyWeightKg ? ` (${formatNum(draft.bodyWeightKg, 2)} kg)` : "";
  const lines = [`${dateText}${bw}`, "", String(draft.muscle || "Workout").toUpperCase(), "─────", ""];

  (draft.exercises || []).forEach((ex) => {
    lines.push(ex.name);
    const validSets = (ex.sets || []).filter((s) => (parseFloat(s.weightKg) || 0) > 0 && (parseInt(s.reps) || 0) > 0);
    if (!validSets.length) {
      lines.push("No completed sets yet");
      lines.push("");
      return;
    }

    const groups = [];
    validSets.forEach((s) => {
      const kg = round(s.weightKg, 2);
      const prev = groups[groups.length - 1];
      if (prev && Math.abs(prev.kg - kg) < 0.005) prev.reps.push(parseInt(s.reps));
      else groups.push({ kg, reps: [parseInt(s.reps)] });
    });

    const parts = groups.map((g) => {
      if (g.reps.length === 1) return `${formatNum(g.kg, 2)} kg × ${g.reps[0]} reps`;
      return `${formatNum(g.kg, 2)} kg × ${g.reps.join(", ")} reps`;
    });
    lines.push(parts.join(", "));
    lines.push("");
  });

  if (draft.notes?.trim()) {
    lines.push("Notes");
    lines.push(draft.notes.trim());
  }

  return lines.join("\n").trim();
};

const upsertJournalFromDraft = (draft, status = "active") => {
  const current = loadJSON(JOURNAL_KEY, []);
  const text = buildJournalText(draft);
  const entry = {
    id: draft.id,
    status,
    updatedAt: new Date().toISOString(),
    createdAt: draft.createdAt,
    muscle: draft.muscle,
    workoutName: draft.workoutName,
    bodyWeightKg: draft.bodyWeightKg || null,
    text,
  };
  const idx = current.findIndex((j) => j.id === draft.id);
  const next = idx >= 0 ? current.map((j, i) => (i === idx ? entry : j)) : [entry, ...current];
  saveJSON(JOURNAL_KEY, next.slice(0, 250));
  return { entry, list: next.slice(0, 250) };
};

const createEmptyDraft = ({ state, unit = "lb" }) => ({
  id: `w_${Date.now()}`,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  startTime: Date.now(),
  workoutName: "My Workout",
  muscle: "Chest",
  unit,
  bodyWeightKg: state.bodyWeights?.[todayKey()] || null,
  bodyWeightInput: state.bodyWeights?.[todayKey()] ? String(state.bodyWeights[todayKey()]) : "",
  notes: "",
  phase: "setup",
  sameWeight: false,
  exercises: [],
});

const persistActiveDraft = (draft) => {
  const next = { ...draft, updatedAt: new Date().toISOString() };
  saveJSON(ACTIVE_WORKOUT_KEY, next);
  const journal = upsertJournalFromDraft(next, "active");
  return { draft: next, journal };
};

const loadActiveDraft = () => loadJSON(ACTIVE_WORKOUT_KEY, null);

const removeActiveJournalDraft = (draftId) => {
  const current = loadJSON(JOURNAL_KEY, []);
  const next = current.filter((entry) => !(entry.id === draftId && entry.status === "active"));
  saveJSON(JOURNAL_KEY, next);
  return next;
};

// ─────────────────────────────────────────────────────────────
// GAME LOGIC
// ─────────────────────────────────────────────────────────────
const EXP_PER_LEVEL = (lvl) => Math.floor(100 * Math.pow(1.42, lvl - 1));
const getLevelFromExp = (totalExp) => {
  let level = 1;
  let remaining = totalExp || 0;
  while (remaining >= EXP_PER_LEVEL(level)) {
    remaining -= EXP_PER_LEVEL(level);
    level++;
  }
  return { level, currentExp: remaining, requiredExp: EXP_PER_LEVEL(level) };
};

const RANKS = [
  { min: 1, max: 9, rank: "E", color: "#9ca3af", bg: "rgba(156,163,175,0.12)", title: "Novice Hunter" },
  { min: 10, max: 19, rank: "D", color: "#60a5fa", bg: "rgba(96,165,250,0.12)", title: "Iron Hunter" },
  { min: 20, max: 34, rank: "C", color: "#34d399", bg: "rgba(52,211,153,0.12)", title: "Bronze Hunter" },
  { min: 35, max: 49, rank: "B", color: "#a78bfa", bg: "rgba(167,139,250,0.12)", title: "Silver Hunter" },
  { min: 50, max: 69, rank: "A", color: "#fbbf24", bg: "rgba(251,191,36,0.12)", title: "Gold Hunter" },
  { min: 70, max: 89, rank: "AA", color: "#f97316", bg: "rgba(249,115,22,0.12)", title: "Elite Hunter" },
  { min: 90, max: 109, rank: "S", color: "#ef4444", bg: "rgba(239,68,68,0.12)", title: "Shadow Hunter" },
  { min: 110, max: 129, rank: "SS", color: "#ec4899", bg: "rgba(236,72,153,0.12)", title: "Monarch" },
  { min: 130, max: Infinity, rank: "SSS", color: "#c084fc", bg: "rgba(192,132,252,0.15)", title: "Shadow Sovereign" },
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

const uniqueExerciseNames = (names = []) => {
  const seen = new Set();
  return names.reduce((out, raw) => {
    const name = String(raw || "").trim();
    if (!name) return out;
    const key = name.toLowerCase();
    if (seen.has(key)) return out;
    seen.add(key);
    out.push(name);
    return out;
  }, []);
};

const getExerciseOptions = (state, muscle, activeExercises = []) => {
  const builtIn = EXERCISE_DB[muscle] || [];
  const savedCustom = state?.customExercisesByMuscle?.[muscle] || [];
  const fromHistory = (state?.workoutHistory || [])
    .filter((w) => w?.muscle === muscle)
    .flatMap((w) => (w.exercises || []).map((ex) => ex?.name));
  const fromActiveWorkout = (activeExercises || []).map((ex) => ex?.name);
  return uniqueExerciseNames([...builtIn, ...savedCustom, ...fromHistory, ...fromActiveWorkout]);
};

const MISSIONS_POOL = [
  { id: "m1", title: "Complete Today's Workout", desc: "Log a full workout session", exp: 50, icon: "⚔️" },
  { id: "m2", title: "Defeat Your Shadow", desc: "Beat a previous exercise shadow", exp: 35, icon: "👊" },
  { id: "m3", title: "Five Exercise Minimum", desc: "Complete at least 5 exercises", exp: 25, icon: "🔥" },
  { id: "m4", title: "Streak Guardian", desc: "Keep your daily streak alive", exp: 20, icon: "⚡" },
  { id: "m5", title: "Volume Domination", desc: "Log 15 or more total sets", exp: 35, icon: "🎯" },
  { id: "m6", title: "Push Day Warrior", desc: "Complete a chest/shoulder session", exp: 40, icon: "🛡️" },
  { id: "m7", title: "Pull Day Hunter", desc: "Complete a back/bicep session", exp: 40, icon: "🏹" },
  { id: "m8", title: "Leg Day Conqueror", desc: "Complete a leg session", exp: 45, icon: "🦵" },
  { id: "m9", title: "Iron Volume King", desc: "Lift 5000kg total in one session", exp: 60, icon: "👑" },
  { id: "m10", title: "Early Riser", desc: "Start your workout before 9 AM", exp: 30, icon: "🌅" },
  { id: "m11", title: "PR Seeker", desc: "Set a new exercise PR", exp: 40, icon: "🏆" },
  { id: "m12", title: "Consistency Protocol", desc: "3rd workout this week", exp: 55, icon: "📋" },
  { id: "m13", title: "Iron Mind", desc: "Log session notes", exp: 15, icon: "🧠" },
  { id: "m14", title: "Shadow Army", desc: "Defeat 3 exercise shadows in one session", exp: 70, icon: "👻" },
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
  sessionShadows: {},
  bodyWeights: {},
  customExercisesByMuscle: {},
  achievements: [],
  todayMissions: [],
  missionDate: null,
  mode: "hunter",
  preferredUnit: "lb",
  templates: [
    { id: "t1", name: "Push Day", muscle: "Chest", exercises: ["Bench Press", "Overhead Press", "Dumbbell Fly", "Tricep Pushdown", "Lateral Raise"] },
    { id: "t2", name: "Pull Day", muscle: "Back", exercises: ["Deadlift", "Barbell Row", "Pull-up", "Barbell Curl", "Face Pull"] },
    { id: "t3", name: "Leg Day", muscle: "Legs", exercises: ["Squat", "Leg Press", "Romanian Deadlift", "Leg Curl", "Calf Raise"] },
    { id: "t4", name: "Arms Day", muscle: "Arms", exercises: ["Barbell Curl", "Hammer Curl", "Tricep Pushdown", "Skull Crusher", "Dips"] },
    { id: "t5", name: "Core Day", muscle: "Core", exercises: ["Plank", "Hanging Leg Raise", "Cable Crunch", "Russian Twist", "Ab Wheel"] },
  ],
};

const normalizeStoredSet = (set = {}) => {
  const currentKg = parseFloat(set.weightKg) || 0;
  const legacyKg = parseFloat(set.weight) || parseFloat(set.kg) || 0;
  const weightKg = currentKg || legacyKg;
  return {
    ...set,
    weightKg,
    displayWeight: set.displayWeight ?? (weightKg ? String(round(weightKg, 2)) : ""),
    reps: set.reps ?? "",
  };
};

const normalizeStoredWorkout = (workout = {}) => {
  const exercises = (workout.exercises || []).map((ex) => ({
    ...ex,
    sets: (ex.sets || []).map(normalizeStoredSet),
  }));
  const calculatedVolume = calculateSessionVolumeKg(exercises);
  return {
    ...workout,
    exercises,
    totalVolumeKg: parseFloat(workout.totalVolumeKg) || parseFloat(workout.totalVolume) || calculatedVolume,
  };
};

const mergeWorkoutHistories = (...histories) => {
  const out = [];
  const seen = new Set();
  histories.forEach((history) => {
    (history || []).forEach((workout) => {
      const key = workout?.id || `${workout?.date || ""}|${workout?.muscle || ""}|${workout?.name || ""}`;
      if (seen.has(key)) return;
      seen.add(key);
      out.push(normalizeStoredWorkout(workout));
    });
  });
  return out.sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0));
};

const rebuildExercisePRsFromHistory = (history = [], existing = {}) => {
  const rebuilt = {};

  Object.entries(existing || {}).forEach(([name, pr]) => {
    const legacyWeightKg = parseFloat(pr?.bestWeightKg) || parseFloat(pr?.weight) || 0;
    const legacyReps = parseInt(pr?.bestReps ?? pr?.reps) || 0;
    const legacyIntensity = parseFloat(pr?.bestIntensity) || calculateSetIntensity(legacyWeightKg, legacyReps);
    const legacyVolume = parseFloat(pr?.bestVolumeKg) || parseFloat(pr?.totalVolumeKg) || (legacyWeightKg * legacyReps) || 0;
    rebuilt[name] = {
      ...pr,
      weight: legacyWeightKg,
      reps: legacyReps,
      bestWeightKg: legacyWeightKg,
      bestReps: legacyReps,
      bestIntensity: legacyIntensity,
      bestVolumeKg: legacyVolume,
    };
  });

  history.forEach((workout) => {
    (workout.exercises || []).forEach((ex) => {
      const stats = calculateExerciseStats(ex.sets || []);
      if (!stats.validSets) return;
      const prev = rebuilt[ex.name] || {};
      const prevIntensity = parseFloat(prev.bestIntensity) || calculateSetIntensity(prev.bestWeightKg || prev.weight || 0, prev.bestReps || prev.reps || 0);
      const prevVolume = parseFloat(prev.bestVolumeKg) || parseFloat(prev.totalVolumeKg) || ((prev.weight || 0) * (prev.reps || 0)) || 0;
      const betterIntensity = stats.bestIntensity > prevIntensity;
      rebuilt[ex.name] = {
        ...prev,
        weight: betterIntensity ? stats.bestWeightKg : (prev.weight || prev.bestWeightKg || stats.bestWeightKg),
        reps: betterIntensity ? stats.bestReps : (prev.reps || prev.bestReps || stats.bestReps),
        bestWeightKg: betterIntensity ? stats.bestWeightKg : (prev.bestWeightKg || prev.weight || stats.bestWeightKg),
        bestReps: betterIntensity ? stats.bestReps : (prev.bestReps || prev.reps || stats.bestReps),
        bestIntensity: Math.max(prevIntensity, stats.bestIntensity),
        bestVolumeKg: Math.max(prevVolume, stats.totalVolumeKg),
        date: betterIntensity ? workout.date : (prev.date || workout.date),
      };
    });
  });

  return rebuilt;
};

const rebuildSessionShadowsFromHistory = (history = [], existing = {}) => {
  const shadows = { ...(existing || {}) };
  history.forEach((workout) => {
    if (!workout?.muscle || shadows[workout.muscle]) return;
    const totalVolumeKg = parseFloat(workout.totalVolumeKg) || calculateSessionVolumeKg(workout.exercises || []);
    if (!totalVolumeKg) return;
    shadows[workout.muscle] = {
      totalVolumeKg,
      date: workout.date,
      workoutId: workout.id,
    };
  });
  return shadows;
};

const normalizeStoredState = (current = null, legacy = null) => {
  const base = { ...INITIAL_STATE, ...(legacy || {}), ...(current || {}) };
  // IMPORTANT: legacy v3 comes first so duplicated historical workouts keep their
  // original set.weight values instead of an already-migrated v4 copy that may
  // contain weightKg: 0. Any workouts that exist only in v4 are still appended.
  const workoutHistory = mergeWorkoutHistories(legacy?.workoutHistory, current?.workoutHistory);
  const exercisePRs = rebuildExercisePRsFromHistory(workoutHistory, {
    ...(legacy?.exercisePRs || {}),
    ...(current?.exercisePRs || {}),
  });
  const sessionShadows = rebuildSessionShadowsFromHistory(workoutHistory, {
    ...(legacy?.sessionShadows || {}),
    ...(current?.sessionShadows || {}),
  });

  return {
    ...base,
    workoutHistory,
    exercisePRs,
    sessionShadows,
  };
};

const loadAppState = () => {
  const v4 = loadJSON(APP_KEY, null);
  const legacy = loadJSON(LEGACY_APP_KEY, null);

  // Keep an untouched emergency snapshot before converting old workout fields.
  try {
    if (!localStorage.getItem(MIGRATION_BACKUP_KEY) && (v4 || legacy)) {
      localStorage.setItem(MIGRATION_BACKUP_KEY, JSON.stringify({
        createdAt: new Date().toISOString(),
        v4,
        legacy,
      }));
    }
  } catch {}

  if (v4 || legacy) return normalizeStoredState(v4, legacy);
  return { ...INITIAL_STATE };
};

// ─────────────────────────────────────────────────────────────
// STYLES
// ─────────────────────────────────────────────────────────────
const CSS = `
@import url('https://fonts.googleapis.com/css2?family=Rajdhani:wght@400;500;600;700&family=Exo+2:wght@300;400;600;800&display=swap');
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
:root{--bg:#07090f;--bg2:#0c1018;--bg3:#111827;--bg4:#1a2235;--border:#1e2d45;--border2:#2a3f60;--text:#e2e8f0;--text2:#94a3b8;--text3:#64748b;--accent:#3b82f6;--accent2:#60a5fa;--gold:#f59e0b;--gold2:#fbbf24;--green:#10b981;--red:#ef4444;--purple:#8b5cf6;--cyan:#06b6d4;--orange:#f97316}
html,body,#root{background:var(--bg);min-height:100%}body{color:var(--text);font-family:'Exo 2',sans-serif;-webkit-font-smoothing:antialiased}.app{min-height:100vh;max-width:430px;margin:0 auto;background:var(--bg);position:relative}.screen{padding:16px 16px 108px}.header{display:flex;align-items:center;justify-content:space-between;margin-bottom:16px;padding-top:8px}.header-title{font-family:'Rajdhani';font-size:21px;font-weight:700;letter-spacing:1px}.header-sub{font-size:11px;color:var(--text3);font-family:'Rajdhani';letter-spacing:1px}.card{background:var(--bg2);border:1px solid var(--border);border-radius:14px;padding:16px;margin-bottom:12px}.card-title{font-family:'Rajdhani';font-size:12px;font-weight:600;color:var(--text3);letter-spacing:1.5px;text-transform:uppercase;margin-bottom:10px}.btn{display:flex;align-items:center;justify-content:center;gap:8px;padding:13px 20px;border-radius:12px;border:none;cursor:pointer;font-family:'Rajdhani';font-size:15px;font-weight:700;letter-spacing:1px;width:100%}.btn-primary{background:linear-gradient(135deg,#1d4ed8,#3b82f6);color:white}.btn-gold{background:linear-gradient(135deg,#b45309,#f59e0b);color:#000}.btn-ghost{background:var(--bg3);border:1px solid var(--border);color:var(--text2)}.btn-red{background:linear-gradient(135deg,#7f1d1d,#ef4444);color:white}.btn-sm{padding:8px 12px;font-size:12px;border-radius:8px;width:auto}.input{background:var(--bg3);border:1px solid var(--border);border-radius:10px;padding:11px 14px;color:var(--text);font-family:'Exo 2';font-size:14px;width:100%;outline:none}.input:focus{border-color:var(--accent)}.label{font-family:'Rajdhani';font-size:11px;font-weight:600;color:var(--text3);letter-spacing:1px;text-transform:uppercase;margin-bottom:5px;display:block}.form-group{margin-bottom:13px}.flex{display:flex}.flex-between{display:flex;align-items:center;justify-content:space-between}.gap-8{gap:8px}.gap-12{gap:12px}.mt-8{margin-top:8px}.mb-8{margin-bottom:8px}.stat-row{display:flex;gap:8px;margin-bottom:8px}.stat-box{flex:1;background:var(--bg3);border:1px solid var(--border);border-radius:10px;padding:10px 6px;text-align:center}.stat-val{font-family:'Rajdhani';font-size:19px;font-weight:700}.stat-lbl{font-size:10px;color:var(--text3);font-family:'Rajdhani';letter-spacing:.5px;text-transform:uppercase;margin-top:2px}.text-accent{color:var(--accent2)}.text-gold{color:var(--gold2)}.text-green{color:var(--green)}.nav{position:fixed;bottom:0;left:50%;transform:translateX(-50%);width:100%;max-width:430px;background:rgba(7,9,15,.98);border-top:1px solid var(--border);display:flex;z-index:1000;padding:8px 0 12px}.nav-btn{flex:1;display:flex;flex-direction:column;align-items:center;gap:3px;cursor:pointer;padding:4px;background:none;border:none;color:var(--text3)}.nav-btn.active{color:var(--accent2)}.nav-icon{font-size:18px;width:34px;height:28px;display:flex;align-items:center;justify-content:center;border-radius:8px;position:relative}.nav-label{font-size:9px;font-weight:600;font-family:'Rajdhani'}.notif-dot{width:6px;height:6px;background:var(--red);border-radius:50%;position:absolute;top:0;right:2px}.mode-toggle{display:flex;background:var(--bg3);border:1px solid var(--border);border-radius:12px;padding:4px;gap:4px;margin-bottom:16px}.mode-btn{flex:1;padding:9px 8px;border-radius:9px;border:none;background:none;color:var(--text3);font-family:'Rajdhani';font-size:13px;font-weight:700}.mode-btn.active-hunter{background:linear-gradient(135deg,#1e3a5f,#1d4ed8);color:var(--accent2)}.mode-btn.active-simple{background:linear-gradient(135deg,#064e3b,#059669);color:#34d399}.hero-banner{background:linear-gradient(135deg,#0a1628,#1e3a5f);border:1px solid rgba(59,130,246,.2);border-radius:16px;padding:18px;margin-bottom:12px}.rank-badge{display:inline-flex;align-items:center;justify-content:center;border-radius:10px;font-family:'Rajdhani';font-weight:700;border:2px solid}.exp-bar-wrap{background:var(--bg4);border-radius:100px;overflow:hidden}.exp-bar-fill{height:100%;border-radius:100px;background:linear-gradient(90deg,var(--accent),var(--cyan))}.exp-bar-fill.gold{background:linear-gradient(90deg,var(--gold),var(--orange))}.level-circle{width:80px;height:80px;border-radius:50%;display:flex;align-items:center;justify-content:center;position:relative}.level-circle-inner{position:absolute;inset:4px;border-radius:50%;background:var(--bg2);display:flex;flex-direction:column;align-items:center;justify-content:center}.level-num{font-family:'Rajdhani';font-size:26px;font-weight:700}.level-label{font-family:'Rajdhani';font-size:9px;letter-spacing:2px;color:var(--text3)}.sys-msg{background:rgba(0,0,0,.5);border:1px solid rgba(59,130,246,.2);border-left:3px solid var(--accent);border-radius:10px;padding:10px 14px;margin-bottom:8px;font-size:12px;color:var(--text2);font-family:'Rajdhani';line-height:1.5}.sys-msg.warning{border-left-color:var(--red)}.sys-msg.success{border-left-color:var(--green)}.mission-card{background:var(--bg3);border:1px solid var(--border);border-radius:12px;padding:12px 14px;margin-bottom:8px;display:flex;align-items:center;gap:12px}.mission-card.completed{opacity:.5;border-color:var(--green)}.mission-icon{font-size:19px;width:40px;height:40px;background:var(--bg4);border-radius:10px;display:flex;align-items:center;justify-content:center}.mission-title{font-family:'Rajdhani';font-weight:600;font-size:14px}.mission-desc{font-size:11px;color:var(--text3)}.mission-exp{font-family:'Rajdhani';font-size:12px;font-weight:700;color:var(--gold2)}.set-row{display:grid;grid-template-columns:26px 1fr 1fr 1fr 26px;gap:5px;align-items:center;margin-bottom:6px}.set-num{font-family:'Rajdhani';font-size:12px;color:var(--text3);text-align:center;font-weight:700}.set-input{background:var(--bg4);border:1px solid var(--border);border-radius:8px;padding:8px 4px;color:var(--text);font-family:'Rajdhani';font-size:14px;font-weight:600;text-align:center;width:100%;outline:none}.set-header{font-family:'Rajdhani';font-size:10px;color:var(--text3);text-align:center}.exercise-block,.simple-exercise-block{background:var(--bg3);border:1px solid var(--border);border-radius:12px;padding:12px;margin-bottom:10px}.simple-exercise-block{background:var(--bg2);border-radius:14px;padding:14px}.exercise-name,.simple-ex-name{font-family:'Rajdhani';font-size:17px;font-weight:700}.prev-stat,.simple-prev{font-size:11px;color:var(--text3);margin:6px 0 10px}.shadow-card{background:linear-gradient(135deg,rgba(139,92,246,.07),rgba(0,0,0,.3));border:1px solid rgba(139,92,246,.25);border-radius:12px;padding:12px;margin:8px 0}.shadow-win{border-color:rgba(16,185,129,.4);background:rgba(16,185,129,.05)}.shadow-name{font-family:'Rajdhani';font-size:14px;font-weight:700;color:var(--purple)}.shadow-win .shadow-name{color:var(--green)}.save-pill{display:inline-flex;align-items:center;gap:5px;font-family:'Rajdhani';font-size:11px;color:var(--green);background:rgba(16,185,129,.08);border:1px solid rgba(16,185,129,.2);padding:4px 8px;border-radius:999px}.timer{font-family:'Rajdhani';font-size:28px;font-weight:700;color:var(--accent2);letter-spacing:2px}.unit-toggle{display:flex;background:var(--bg4);border:1px solid var(--border);border-radius:10px;padding:3px;gap:3px}.unit-btn{border:none;background:none;color:var(--text3);font-family:'Rajdhani';font-weight:700;padding:7px 12px;border-radius:7px}.unit-btn.active{background:var(--accent);color:#fff}.active-workout{border:1px solid rgba(239,68,68,.35);background:linear-gradient(135deg,rgba(239,68,68,.06),rgba(59,130,246,.04))}.journal-entry{background:var(--bg2);border:1px solid var(--border);border-radius:14px;padding:14px;margin-bottom:10px}.journal-entry.active{border-color:rgba(245,158,11,.35)}.journal-text{white-space:pre-wrap;font-family:'Rajdhani';font-size:14px;line-height:1.55;color:var(--text2);background:var(--bg3);border-radius:10px;padding:12px;margin-top:10px}.tag{background:var(--bg4);border:1px solid var(--border);border-radius:6px;padding:3px 8px;font-family:'Rajdhani';font-size:11px;color:var(--text3);display:inline-block;margin:2px 3px 2px 0}.tag.exp{color:var(--gold2)}.history-item{background:var(--bg3);border:1px solid var(--border);border-radius:12px;padding:12px;margin-bottom:8px}.tabs{display:flex;gap:6px;margin-bottom:16px;background:var(--bg3);border-radius:12px;padding:4px}.tab{flex:1;text-align:center;padding:8px 4px;border-radius:8px;border:none;background:none;color:var(--text3);font-family:'Rajdhani';font-size:12px;font-weight:600}.tab.active{background:var(--bg4);color:var(--accent2)}.toast{position:fixed;top:20px;left:50%;transform:translateX(-50%) translateY(-90px);max-width:380px;width:calc(100% - 32px);background:var(--bg2);border:1px solid var(--border2);border-radius:14px;padding:14px 16px;display:flex;align-items:center;gap:12px;z-index:9999;transition:transform .35s;box-shadow:0 8px 40px rgba(0,0,0,.7)}.toast.show{transform:translateX(-50%) translateY(0)}.toast-title{font-family:'Rajdhani';font-size:15px;font-weight:700}.toast-sub{font-size:11px;color:var(--text3)}.toast-exp{font-family:'Rajdhani';font-size:14px;font-weight:700;color:var(--gold2);margin-left:auto}.modal-overlay{position:fixed;inset:0;background:rgba(0,0,0,.8);z-index:2000;display:flex;align-items:flex-end}.modal{background:var(--bg2);border:1px solid var(--border);border-radius:20px 20px 0 0;padding:20px;width:100%;max-width:430px;margin:0 auto;max-height:85vh;overflow-y:auto}.modal-handle{width:40px;height:4px;background:var(--border2);border-radius:100px;margin:0 auto 20px}.onboard{min-height:100vh;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:32px 20px;text-align:center}.onboard-logo{font-family:'Rajdhani';font-size:12px;font-weight:700;letter-spacing:4px;color:var(--accent);margin-bottom:24px}.onboard-title{font-family:'Rajdhani';font-size:34px;font-weight:700;line-height:1.1;margin-bottom:8px}.onboard-title span{color:var(--accent2)}.onboard-sub{font-size:14px;color:var(--text3);margin-bottom:32px;line-height:1.6;max-width:300px}.loading-screen{min-height:100vh;display:flex;align-items:center;justify-content:center;font-family:'Rajdhani';color:var(--text3)}
`;

// ─────────────────────────────────────────────────────────────
// SMALL COMPONENTS
// ─────────────────────────────────────────────────────────────
const Toast = ({ toast }) => (
  <div className={`toast ${toast.show ? "show" : ""}`}>
    <span style={{ fontSize: 22 }}>{toast.icon}</span>
    <div style={{ flex: 1 }}>
      <div className="toast-title">{toast.title}</div>
      {toast.sub && <div className="toast-sub">{toast.sub}</div>}
    </div>
    {toast.exp > 0 && <div className="toast-exp">+{toast.exp} EXP</div>}
  </div>
);

const RankBadge = ({ level, size = 42 }) => {
  const r = getRank(level);
  return <div className="rank-badge" style={{ width: size, height: size, color: r.color, borderColor: r.color, background: r.bg, fontSize: size * 0.35 }}>{r.rank}</div>;
};

const ExpBar = ({ current, required, gold, height = 8 }) => (
  <div className="exp-bar-wrap" style={{ height }}>
    <div className={`exp-bar-fill ${gold ? "gold" : ""}`} style={{ width: `${Math.min(100, required ? (current / required) * 100 : 0)}%`, height }} />
  </div>
);

const LevelCircle = ({ level }) => {
  const rank = getRank(level);
  return (
    <div className="level-circle" style={{ border: `3px solid ${rank.color}`, boxShadow: `0 0 18px ${rank.color}33` }}>
      <div className="level-circle-inner">
        <div className="level-num" style={{ color: rank.color }}>{level}</div>
        <div className="level-label">LEVEL</div>
      </div>
    </div>
  );
};

const SysMsg = ({ text, type = "info" }) => <div className={`sys-msg ${type}`}>{text}</div>;

const UnitToggle = ({ unit, onChange }) => (
  <div className="unit-toggle">
    <button className={`unit-btn ${unit === "lb" ? "active" : ""}`} onClick={() => onChange("lb")}>LB</button>
    <button className={`unit-btn ${unit === "kg" ? "active" : ""}`} onClick={() => onChange("kg")}>KG</button>
  </div>
);

const WorkoutDetailModal = ({ workout, onClose }) => {
  if (!workout) return null;
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-handle" />
        <div className="header-title">{workout.name}</div>
        <div className="header-sub" style={{ marginBottom: 12 }}>{new Date(workout.date).toLocaleString()}</div>
        <div style={{ marginBottom: 12 }}>
          <span className="tag exp">+{workout.expGained} EXP</span>
          <span className="tag">{workout.muscle}</span>
          <span className="tag">{workout.duration} min</span>
          <span className="tag">{formatNum(workout.totalVolumeKg || 0, 1)} kg volume</span>
        </div>
        {(workout.exercises || []).map((ex, i) => (
          <div className="card" key={`${ex.name}_${i}`}>
            <div style={{ fontFamily: "Rajdhani", fontWeight: 700, marginBottom: 8 }}>{ex.name}</div>
            {(ex.sets || []).map((s, si) => (
              <div key={si} style={{ fontSize: 12, color: "var(--text2)", marginBottom: 4 }}>
                Set {si + 1}: {formatNum(s.weightKg || 0, 2)} kg × {s.reps || 0}
              </div>
            ))}
          </div>
        ))}
        <button className="btn btn-ghost" onClick={onClose}>Close</button>
      </div>
    </div>
  );
};

// ─────────────────────────────────────────────────────────────
// ONBOARDING
// ─────────────────────────────────────────────────────────────
const OnboardingScreen = ({ onComplete }) => {
  const [name, setName] = useState("");
  return (
    <div className="app">
      <div className="onboard">
        <div className="onboard-logo">◈ SYSTEM INITIALIZING ◈</div>
        <div style={{ fontSize: 58, marginBottom: 18 }}>⚔️</div>
        <div className="onboard-title"><span>GYM</span><br />LEVELING<br />SYSTEM</div>
        <div className="onboard-sub">Track every set, defeat your shadows, and keep a crash-safe workout journal automatically.</div>
        <div style={{ width: "100%", maxWidth: 300 }}>
          <div className="form-group">
            <label className="label">Hunter Name</label>
            <input className="input" value={name} placeholder="Enter your name..." onChange={(e) => setName(e.target.value)} />
          </div>
          <button className="btn btn-gold" onClick={() => name.trim() && onComplete(name.trim())}>⚔️ AWAKEN</button>
        </div>
      </div>
    </div>
  );
};

// ─────────────────────────────────────────────────────────────
// DASHBOARD
// ─────────────────────────────────────────────────────────────
const DashboardScreen = ({ state, activeDraft, onStartWorkout, onResumeWorkout, onModeChange, onMissionComplete, onJournal }) => {
  const { level, currentExp, requiredExp } = getLevelFromExp(state.totalExp);
  const rank = getRank(level);
  const isHunter = state.mode === "hunter";
  const missions = state.todayMissions || [];
  const lastWorkout = state.workoutHistory?.[0];
  const todayWeight = state.bodyWeights?.[todayKey()];

  return (
    <div className="screen">
      <div className="header">
        <div>
          <div className="header-title">{isHunter ? "HUNTER PROFILE" : "GYM TRACKER"}</div>
          <div className="header-sub">◈ {state.hunterName} ◈</div>
        </div>
        {isHunter && <RankBadge level={level} />}
      </div>

      <div className="mode-toggle">
        <button className={`mode-btn ${state.mode === "hunter" ? "active-hunter" : ""}`} onClick={() => onModeChange("hunter")}>⚔️ Hunter Mode</button>
        <button className={`mode-btn ${state.mode === "simple" ? "active-simple" : ""}`} onClick={() => onModeChange("simple")}>🏋️ Simple Mode</button>
      </div>

      {activeDraft && (
        <div className="card active-workout">
          <div className="flex-between mb-8">
            <div>
              <div className="card-title" style={{ color: "var(--red)", marginBottom: 3 }}>🔴 ACTIVE WORKOUT</div>
              <div style={{ fontFamily: "Rajdhani", fontSize: 19, fontWeight: 700 }}>{activeDraft.workoutName || activeDraft.muscle}</div>
            </div>
            <span className="save-pill">✓ Autosaved</span>
          </div>
          <div style={{ fontSize: 12, color: "var(--text3)", marginBottom: 12 }}>
            {activeDraft.muscle} · {activeDraft.exercises?.length || 0} exercises · {calculateSessionSets(activeDraft.exercises)} completed sets
          </div>
          <button className="btn btn-primary" onClick={onResumeWorkout}>RESUME WORKOUT →</button>
        </div>
      )}

      {isHunter && (
        <div className="hero-banner">
          <div className="flex gap-12" style={{ alignItems: "center", marginBottom: 14 }}>
            <LevelCircle level={level} />
            <div style={{ flex: 1 }}>
              <div style={{ fontFamily: "Rajdhani", fontSize: 18, fontWeight: 700, color: rank.color }}>{rank.title.toUpperCase()}</div>
              <div style={{ fontFamily: "Rajdhani", fontSize: 11, color: "var(--text3)", margin: "5px 0" }}>{currentExp} / {requiredExp} EXP</div>
              <ExpBar current={currentExp} required={requiredExp} />
            </div>
          </div>
          <div className="stat-row" style={{ marginBottom: 0 }}>
            <div className="stat-box"><div className="stat-val text-accent">{state.streak}</div><div className="stat-lbl">🔥 Streak</div></div>
            <div className="stat-box"><div className="stat-val text-gold">{state.totalExp}</div><div className="stat-lbl">EXP</div></div>
            <div className="stat-box"><div className="stat-val">{state.totalWorkouts}</div><div className="stat-lbl">Sessions</div></div>
            <div className="stat-box"><div className="stat-val" style={{ color: "var(--purple)" }}>{state.shadowsDefeated || 0}</div><div className="stat-lbl">Shadows</div></div>
          </div>
        </div>
      )}

      <div className="card">
        <div className="flex-between">
          <div>
            <div className="card-title">TODAY</div>
            <div style={{ fontFamily: "Rajdhani", fontSize: 16, fontWeight: 700 }}>{todayWeight ? `${formatNum(todayWeight, 2)} kg bodyweight` : "No bodyweight logged yet"}</div>
          </div>
          <button className="btn btn-ghost btn-sm" onClick={onJournal}>Journal</button>
        </div>
      </div>

      {isHunter && (
        <div className="card">
          <div className="card-title">DAILY MISSIONS</div>
          {missions.slice(0, 3).map((m) => (
            <div key={m.id} className={`mission-card ${m.completed ? "completed" : ""}`} onClick={() => !m.completed && onMissionComplete(m.id)}>
              <div className="mission-icon">{m.icon}</div>
              <div style={{ flex: 1 }}><div className="mission-title">{m.title}</div><div className="mission-desc">{m.desc}</div></div>
              <div className="mission-exp">+{m.exp}</div>
            </div>
          ))}
        </div>
      )}

      {lastWorkout && (
        <div className="card">
          <div className="card-title">LAST SESSION</div>
          <div style={{ fontFamily: "Rajdhani", fontSize: 16, fontWeight: 700 }}>{lastWorkout.name}</div>
          <div style={{ fontSize: 11, color: "var(--text3)", marginTop: 4 }}>{lastWorkout.muscle} · {formatNum(lastWorkout.totalVolumeKg || 0, 1)} kg volume · {lastWorkout.duration} min</div>
        </div>
      )}

      <button className="btn btn-primary" onClick={activeDraft ? onResumeWorkout : onStartWorkout}>
        {activeDraft ? "🔴 RESUME ACTIVE WORKOUT" : "⚔️ START WORKOUT"}
      </button>
    </div>
  );
};

// ─────────────────────────────────────────────────────────────
// WORKOUT
// ─────────────────────────────────────────────────────────────
const WorkoutScreen = ({ state, initialDraft, onDraftSaved, onSaveCustomExercise, onFinish, onExit, onCancel }) => {
  const [draft, setDraft] = useState(() => initialDraft || createEmptyDraft({ state, unit: state.preferredUnit || "lb" }));
  const [elapsed, setElapsed] = useState(() => Math.floor((Date.now() - (initialDraft?.startTime || Date.now())) / 1000));
  const [showAddExercise, setShowAddExercise] = useState(false);
  const [selectedEx, setSelectedEx] = useState("");
  const [customEx, setCustomEx] = useState("");

  useEffect(() => {
    if (!initialDraft) {
      const { draft: saved, journal } = persistActiveDraft(draft);
      setDraft(saved);
      onDraftSaved(saved, journal.list);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const t = setInterval(() => setElapsed(Math.floor((Date.now() - draft.startTime) / 1000)), 1000);
    return () => clearInterval(t);
  }, [draft.startTime]);

  // Extra iOS/PWA protection: write the latest draft when the app is backgrounded.
  useEffect(() => {
    const persistNow = () => persistActiveDraft(draft);
    const onVisibility = () => { if (document.visibilityState === "hidden") persistNow(); };
    window.addEventListener("pagehide", persistNow);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      window.removeEventListener("pagehide", persistNow);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [draft]);

  const mutate = (updater) => {
    setDraft((prev) => {
      const rawNext = typeof updater === "function" ? updater(prev) : { ...prev, ...updater };
      const { draft: saved, journal } = persistActiveDraft(rawNext);
      onDraftSaved(saved, journal.list);
      return saved;
    });
  };

  const fmtTime = (s) => `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;

  const requestCancel = () => {
    const hasLoggedData = (draft.exercises || []).some((ex) =>
      (ex.sets || []).some((set) => (parseFloat(set.weightKg) || 0) > 0 || (parseInt(set.reps, 10) || 0) > 0)
    );
    const message = hasLoggedData
      ? "Cancel this workout and permanently delete this unfinished draft? Your completed workout history, PRs, EXP, and achievements will not be affected."
      : "Cancel this workout and remove the empty draft from your Journal? Your completed workout history will not be affected.";
    if (window.confirm(message)) onCancel(draft);
  };

  const setUnit = (newUnit) => {
    if (newUnit === draft.unit) return;
    mutate((prev) => ({
      ...prev,
      unit: newUnit,
      exercises: (prev.exercises || []).map((ex) => ({
        ...ex,
        sets: (ex.sets || []).map((s) => ({ ...s, displayWeight: s.weightKg ? String(kgToDisplay(s.weightKg, newUnit)) : "" })),
      })),
    }));
  };

  const updateSet = (ei, si, field, value) => {
    mutate((prev) => ({
      ...prev,
      exercises: prev.exercises.map((ex, i) => {
        if (i !== ei) return ex;
        let sets = ex.sets.map((set, j) => {
          if (j !== si) return set;
          if (field === "weight") {
            const weightKg = weightToKg(value, prev.unit);
            return { ...set, displayWeight: value, weightKg };
          }
          return { ...set, reps: value };
        });
        if (prev.sameWeight && field === "weight") {
          const weightKg = weightToKg(value, prev.unit);
          sets = sets.map((set) => ({ ...set, displayWeight: value, weightKg }));
        }
        return { ...ex, sets };
      }),
    }));
  };

  const addSet = (ei) => mutate((prev) => ({
    ...prev,
    exercises: prev.exercises.map((ex, i) => {
      if (i !== ei) return ex;
      const last = ex.sets[ex.sets.length - 1] || {};
      return { ...ex, sets: [...ex.sets, { displayWeight: prev.sameWeight ? last.displayWeight || "" : "", weightKg: prev.sameWeight ? last.weightKg || 0 : 0, reps: "" }] };
    }),
  }));

  const repeatSet = (ei) => mutate((prev) => ({
    ...prev,
    exercises: prev.exercises.map((ex, i) => i === ei ? { ...ex, sets: [...ex.sets, { ...(ex.sets[ex.sets.length - 1] || { displayWeight: "", weightKg: 0, reps: "" }) }] } : ex),
  }));

  const removeSet = (ei, si) => mutate((prev) => ({ ...prev, exercises: prev.exercises.map((ex, i) => i === ei ? { ...ex, sets: ex.sets.filter((_, j) => j !== si) } : ex) }));
  const removeExercise = (ei) => mutate((prev) => ({ ...prev, exercises: prev.exercises.filter((_, i) => i !== ei) }));

  const addExercise = () => {
    const typedCustom = customEx.trim();
    const name = selectedEx || typedCustom;
    if (!name) return;

    if (!selectedEx && typedCustom) {
      onSaveCustomExercise?.(draft.muscle, typedCustom);
    }

    mutate((prev) => ({
      ...prev,
      exercises: [...prev.exercises, { id: `${Date.now()}_${Math.random()}`, name, sets: [{ displayWeight: "", weightKg: 0, reps: "" }] }],
    }));
    setSelectedEx("");
    setCustomEx("");
    setShowAddExercise(false);
  };

  const applyTemplate = (t) => {
    mutate((prev) => ({
      ...prev,
      workoutName: t.name,
      muscle: t.muscle,
      phase: "logging",
      exercises: t.exercises.map((name, idx) => ({ id: `${Date.now()}_${idx}`, name, sets: [{ displayWeight: "", weightKg: 0, reps: "" }] })),
    }));
  };

  const overallVolume = calculateSessionVolumeKg(draft.exercises);
  const previousSessionShadow = state.sessionShadows?.[draft.muscle];
  const overallShadowWin = previousSessionShadow && overallVolume > (previousSessionShadow.totalVolumeKg || 0);
  const exerciseOptions = getExerciseOptions(state, draft.muscle, draft.exercises);

  if (draft.phase === "setup") {
    return (
      <div className="screen">
        <div className="header">
          <div><div className="header-title">NEW SESSION</div><div className="header-sub">Autosave is ON</div></div>
          <span className="save-pill">✓ Saved</span>
        </div>

        <div className="card">
          <div className="flex-between mb-8">
            <div className="card-title" style={{ marginBottom: 0 }}>WEIGHT UNIT</div>
            <UnitToggle unit={draft.unit} onChange={setUnit} />
          </div>
          <div style={{ fontSize: 12, color: "var(--text3)" }}>Enter the number printed on the dumbbell, plate, or machine. Journal output is stored in kg.</div>
        </div>

        <div className="form-group">
          <label className="label">Today's Empty Body Weight (kg)</label>
          <input className="input" type="number" inputMode="decimal" placeholder="83.20" value={draft.bodyWeightInput ?? (draft.bodyWeightKg ? String(draft.bodyWeightKg) : "")} onChange={(e) => { const raw = e.target.value; mutate((prev) => ({ ...prev, bodyWeightInput: raw, bodyWeightKg: parseFloat(raw) || null })); }} />
        </div>

        <div className="form-group">
          <label className="label">Session Name</label>
          <input className="input" value={draft.workoutName} onChange={(e) => mutate((prev) => ({ ...prev, workoutName: e.target.value }))} />
        </div>

        <div className="form-group">
          <label className="label">Muscle Group</label>
          <select className="input" value={draft.muscle} onChange={(e) => mutate((prev) => ({ ...prev, muscle: e.target.value }))}>
            {MUSCLE_GROUPS.map((g) => <option key={g}>{g}</option>)}
          </select>
        </div>

        <div className="card">
          <div className="card-title">QUICK TEMPLATES</div>
          {(state.templates || []).map((t) => <button key={t.id} className="btn btn-ghost" style={{ marginBottom: 8 }} onClick={() => applyTemplate(t)}>{t.name}</button>)}
        </div>

        <button className="btn btn-primary" onClick={() => mutate((prev) => ({ ...prev, phase: "logging" }))}>START LOGGING →</button>
        <button className="btn btn-ghost" style={{ marginTop: 8 }} onClick={onExit}>← Back Home (draft stays saved)</button>
        <button className="btn btn-red" style={{ marginTop: 8 }} onClick={requestCancel}>✕ CANCEL WORKOUT / DELETE DRAFT</button>
      </div>
    );
  }

  return (
    <div className="screen">
      <div className="header">
        <div>
          <div className="header-title">{draft.workoutName}</div>
          <div className="header-sub">{draft.muscle} · {draft.unit.toUpperCase()}</div>
        </div>
        <div style={{ textAlign: "right" }}>
          <div className="timer">{fmtTime(elapsed)}</div>
          <span className="save-pill">✓ Saved</span>
        </div>
      </div>

      <div className="card">
        <div className="flex-between">
          <div>
            <div className="card-title" style={{ marginBottom: 2 }}>INPUT UNIT</div>
            <div style={{ fontSize: 11, color: "var(--text3)" }}>{draft.unit === "lb" ? "40 lb shows as ≈ 18.14 kg" : "Switch to lb for gym plates/dumbbells"}</div>
          </div>
          <UnitToggle unit={draft.unit} onChange={setUnit} />
        </div>
      </div>

      <div className="card">
        <div className="flex-between">
          <div>
            <div className="card-title" style={{ marginBottom: 2 }}>SAME WEIGHT ALL SETS</div>
            <div style={{ fontSize: 11, color: "var(--text3)" }}>When on, changing one set's weight fills every set for that exercise.</div>
          </div>
          <button className={`btn btn-sm ${draft.sameWeight ? "btn-primary" : "btn-ghost"}`} onClick={() => mutate((prev) => ({ ...prev, sameWeight: !prev.sameWeight }))}>{draft.sameWeight ? "ON" : "OFF"}</button>
        </div>
      </div>

      {previousSessionShadow && (
        <div className={`shadow-card ${overallShadowWin ? "shadow-win" : ""}`}>
          <div className="shadow-name">👻 {draft.muscle.toUpperCase()} SESSION SHADOW {overallShadowWin ? "DEFEATED" : "ACTIVE"}</div>
          <div style={{ fontSize: 12, color: "var(--text3)", marginTop: 5 }}>
            Previous: {formatNum(previousSessionShadow.totalVolumeKg, 1)} kg · Today: {formatNum(overallVolume, 1)} kg
          </div>
        </div>
      )}

      <div className="card">
        <div className="flex-between">
          <div>
            <div className="card-title" style={{ marginBottom: 2 }}>BODY WEIGHT</div>
            <div style={{ fontFamily: "Rajdhani", fontSize: 16, fontWeight: 700 }}>{draft.bodyWeightKg ? `${formatNum(draft.bodyWeightKg, 2)} kg` : "Not entered"}</div>
          </div>
          <button className="btn btn-ghost btn-sm" onClick={() => mutate((prev) => ({ ...prev, phase: "setup" }))}>Edit setup</button>
        </div>
      </div>

      {draft.exercises.map((ex, ei) => {
        const stats = calculateExerciseStats(ex.sets);
        const prev = state.exercisePRs?.[ex.name];
        const beatIntensity = !!prev && stats.bestIntensity > (prev.bestIntensity || calculateSetIntensity(prev.weight || 0, prev.reps || 0));
        const beatVolume = !!prev && stats.totalVolumeKg > (prev.bestVolumeKg || prev.totalVolumeKg || ((prev.weight || 0) * (prev.reps || 0)) || 0);
        const shadowWin = beatIntensity || beatVolume;
        return (
          <div key={ex.id} className={state.mode === "simple" ? "simple-exercise-block" : "exercise-block"}>
            <div className="flex-between">
              <div className={state.mode === "simple" ? "simple-ex-name" : "exercise-name"}>{ex.name}</div>
              <button style={{ background: "none", border: "none", color: "var(--text3)" }} onClick={() => removeExercise(ei)}>✕</button>
            </div>

            {prev ? (
              <div className="prev-stat">
                Shadow: e1RM {formatNum(prev.bestIntensity || calculateSetIntensity(prev.weight || 0, prev.reps || 0), 1)} kg · Volume {formatNum(prev.bestVolumeKg || prev.totalVolumeKg || ((prev.weight || 0) * (prev.reps || 0)) || 0, 1)} kg
              </div>
            ) : <div className="prev-stat">First encounter — no shadow yet</div>}

            {shadowWin && (
              <div className="shadow-card shadow-win">
                <div className="shadow-name">👻 Shadow Defeated</div>
                <div style={{ fontSize: 12, color: "var(--green)", marginTop: 4 }}>
                  {beatIntensity && `Intensity ↑ to ${formatNum(stats.bestIntensity, 1)} kg e1RM`}{beatIntensity && beatVolume ? " · " : ""}{beatVolume && `Volume ↑ to ${formatNum(stats.totalVolumeKg, 1)} kg`}
                </div>
              </div>
            )}

            <div className="set-row">
              <div className="set-header">SET</div><div className="set-header">{draft.unit.toUpperCase()}</div><div className="set-header">REPS</div><div className="set-header">KG EQ.</div><div />
            </div>

            {ex.sets.map((s, si) => (
              <div className="set-row" key={si}>
                <div className="set-num">{si + 1}</div>
                <input className="set-input" type="number" inputMode="decimal" value={s.displayWeight || ""} placeholder="0" onChange={(e) => updateSet(ei, si, "weight", e.target.value)} />
                <input className="set-input" type="number" inputMode="numeric" value={s.reps || ""} placeholder="0" onChange={(e) => updateSet(ei, si, "reps", e.target.value)} />
                <div style={{ background: "var(--bg4)", border: "1px solid var(--border)", borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, color: "var(--text2)" }}>{s.weightKg ? formatNum(s.weightKg, 2) : "—"}</div>
                <button style={{ background: "none", border: "none", color: "var(--text3)" }} onClick={() => removeSet(ei, si)}>✕</button>
              </div>
            ))}

            <div className="flex gap-8 mt-8">
              <button className="btn btn-ghost btn-sm" onClick={() => addSet(ei)}>+ Set</button>
              <button className="btn btn-ghost btn-sm" onClick={() => repeatSet(ei)}>⟳ Repeat</button>
            </div>
          </div>
        );
      })}

      {showAddExercise ? (
        <div className="card">
          <div className="card-title">ADD EXERCISE</div>
          <div className="form-group">
            <select className="input" value={selectedEx} onChange={(e) => setSelectedEx(e.target.value)}>
              <option value="">Select...</option>
              {exerciseOptions.map((e) => <option key={e} value={e}>{e}</option>)}
            </select>
          </div>
          <div className="form-group">
            <input className="input" placeholder="Or type custom exercise..." value={customEx} onChange={(e) => setCustomEx(e.target.value)} />
            <div style={{ fontSize: 10, color: "var(--text3)", marginTop: 6 }}>Custom exercises are remembered under {draft.muscle} after you add them once.</div>
          </div>
          <div className="flex gap-8"><button className="btn btn-primary" onClick={addExercise}>Add</button><button className="btn btn-ghost" onClick={() => setShowAddExercise(false)}>Cancel</button></div>
        </div>
      ) : <button className="btn btn-ghost" style={{ marginBottom: 12 }} onClick={() => setShowAddExercise(true)}>+ Add Exercise</button>}

      {state.mode !== "simple" && (
        <div className="form-group">
          <label className="label">Session Notes</label>
          <textarea className="input" rows={3} value={draft.notes || ""} placeholder="Energy, form, pain, comments..." onChange={(e) => mutate((prev) => ({ ...prev, notes: e.target.value }))} />
        </div>
      )}

      <div className="card">
        <div className="card-title">LIVE SESSION TOTAL</div>
        <div className="stat-row" style={{ marginBottom: 0 }}>
          <div className="stat-box"><div className="stat-val">{calculateSessionSets(draft.exercises)}</div><div className="stat-lbl">Sets</div></div>
          <div className="stat-box"><div className="stat-val text-accent">{formatNum(overallVolume, 1)}</div><div className="stat-lbl">kg Volume</div></div>
          <div className="stat-box"><div className="stat-val text-green">{draft.exercises.length}</div><div className="stat-lbl">Exercises</div></div>
        </div>
      </div>

      {draft.exercises.length > 0 && <button className="btn btn-gold" onClick={() => onFinish(draft)}>✓ FINISH WORKOUT</button>}
      <button className="btn btn-ghost" style={{ marginTop: 8 }} onClick={onExit}>← Home (keep workout active)</button>
      <button className="btn btn-red" style={{ marginTop: 8 }} onClick={requestCancel}>✕ CANCEL WORKOUT / DELETE DRAFT</button>
    </div>
  );
};

// ─────────────────────────────────────────────────────────────
// JOURNAL
// ─────────────────────────────────────────────────────────────
const JournalScreen = ({ entries }) => {
  const [expanded, setExpanded] = useState(entries?.[0]?.id || null);
  const shareEntry = async (entry) => {
    try {
      if (navigator.share) await navigator.share({ title: entry.workoutName || "Workout Journal", text: entry.text });
      else await navigator.clipboard.writeText(entry.text);
    } catch {}
  };
  const copyEntry = async (entry) => {
    try { await navigator.clipboard.writeText(entry.text); } catch {}
  };

  return (
    <div className="screen">
      <div className="header"><div><div className="header-title">WORKOUT JOURNAL</div><div className="header-sub">◈ AUTOMATIC BACKUP LOG ◈</div></div><span style={{ fontSize: 24 }}>📝</span></div>
      <SysMsg type="success" text="Every set is written here automatically while you train. Active drafts survive normal iOS app reloads." />
      {!entries.length && <div className="card" style={{ textAlign: "center", color: "var(--text3)" }}>No journal entries yet.</div>}
      {entries.map((entry) => (
        <div key={entry.id} className={`journal-entry ${entry.status === "active" ? "active" : ""}`}>
          <div className="flex-between">
            <div>
              <div style={{ fontFamily: "Rajdhani", fontSize: 16, fontWeight: 700 }}>{entry.workoutName || entry.muscle}</div>
              <div style={{ fontSize: 11, color: "var(--text3)", marginTop: 2 }}>{formatDateLong(entry.createdAt)} · {entry.status === "active" ? "🔴 Active autosave" : "✓ Completed"}</div>
            </div>
            <button className="btn btn-ghost btn-sm" onClick={() => setExpanded(expanded === entry.id ? null : entry.id)}>{expanded === entry.id ? "Hide" : "Open"}</button>
          </div>
          {expanded === entry.id && (
            <>
              <div className="journal-text">{entry.text}</div>
              <div className="flex gap-8 mt-8"><button className="btn btn-ghost btn-sm" onClick={() => copyEntry(entry)}>Copy</button><button className="btn btn-primary btn-sm" onClick={() => shareEntry(entry)}>Share</button></div>
            </>
          )}
        </div>
      ))}
    </div>
  );
};

// ─────────────────────────────────────────────────────────────
// MISSIONS
// ─────────────────────────────────────────────────────────────
const MissionsScreen = ({ state, onMissionComplete }) => {
  const missions = state.todayMissions || [];
  const done = missions.filter((m) => m.completed).length;
  return (
    <div className="screen">
      <div className="header"><div><div className="header-title">DAILY MISSIONS</div><div className="header-sub">◈ {done}/{missions.length} COMPLETE ◈</div></div></div>
      {missions.map((m) => (
        <div key={m.id} className={`mission-card ${m.completed ? "completed" : ""}`} onClick={() => !m.completed && onMissionComplete(m.id)}>
          <div className="mission-icon">{m.icon}</div><div style={{ flex: 1 }}><div className="mission-title">{m.title}</div><div className="mission-desc">{m.desc}</div></div><div className="mission-exp">+{m.exp}</div>
        </div>
      ))}
    </div>
  );
};

// ─────────────────────────────────────────────────────────────
// PROGRESS
// ─────────────────────────────────────────────────────────────
const ProgressScreen = ({ state }) => {
  const [tab, setTab] = useState("stats");
  const [selectedWorkout, setSelectedWorkout] = useState(null);
  const { level } = getLevelFromExp(state.totalExp);
  const history = state.workoutHistory || [];
  const prs = Object.entries(state.exercisePRs || {}).map(([name, data]) => ({ name, ...data }));

  return (
    <div className="screen">
      {selectedWorkout && <WorkoutDetailModal workout={selectedWorkout} onClose={() => setSelectedWorkout(null)} />}
      <div className="header"><div><div className="header-title">PROGRESS</div><div className="header-sub">◈ YOUR GROWTH ◈</div></div><RankBadge level={level} /></div>
      <div className="tabs">{["stats", "history", "prs", "shadows"].map((t) => <button key={t} className={`tab ${tab === t ? "active" : ""}`} onClick={() => setTab(t)}>{t.toUpperCase()}</button>)}</div>

      {tab === "stats" && <>
        <div className="stat-row"><div className="stat-box"><div className="stat-val text-accent">{state.totalWorkouts}</div><div className="stat-lbl">Sessions</div></div><div className="stat-box"><div className="stat-val text-gold">{state.totalExp}</div><div className="stat-lbl">EXP</div></div></div>
        <div className="stat-row"><div className="stat-box"><div className="stat-val text-green">{state.totalPRs}</div><div className="stat-lbl">PRs</div></div><div className="stat-box"><div className="stat-val" style={{ color: "var(--purple)" }}>{state.shadowsDefeated}</div><div className="stat-lbl">Shadows</div></div></div>
        <div className="card"><div className="card-title">RANK ROAD</div>{RANKS.map((r) => { const cur = level >= r.min && level <= r.max; const past = level > r.max; return <div key={r.rank} style={{ display: "flex", gap: 10, alignItems: "center", padding: "8px 0", opacity: past ? .5 : 1, borderBottom: "1px solid var(--border)" }}><RankBadge level={r.min} size={34} /><div style={{ flex: 1, fontFamily: "Rajdhani", color: cur ? r.color : "var(--text2)" }}>{r.title} · Lv {r.min}{r.max < Infinity ? `–${r.max}` : "+"}</div>{cur && <span style={{ color: r.color }}>CURRENT</span>}</div>; })}</div>
      </>}

      {tab === "history" && history.map((w) => <div key={w.id} className="history-item" onClick={() => setSelectedWorkout(w)}><div style={{ fontFamily: "Rajdhani", fontWeight: 700 }}>{w.name}</div><div style={{ fontSize: 11, color: "var(--text3)", marginTop: 3 }}>{new Date(w.date).toLocaleString()} · {w.muscle} · {formatNum(w.totalVolumeKg || 0, 1)} kg</div></div>)}

      {tab === "prs" && prs.map((pr) => <div key={pr.name} className="card"><div className="flex-between"><div><div style={{ fontFamily: "Rajdhani", fontWeight: 700 }}>{pr.name}</div><div style={{ fontSize: 11, color: "var(--text3)" }}>Best intensity & volume shadow</div></div><div style={{ textAlign: "right" }}><div style={{ color: "var(--gold2)", fontFamily: "Rajdhani", fontWeight: 700 }}>e1RM {formatNum(pr.bestIntensity || calculateSetIntensity(pr.weight, pr.reps), 1)} kg</div><div style={{ fontSize: 11, color: "var(--text3)" }}>{formatNum(pr.bestVolumeKg || pr.totalVolumeKg || ((pr.weight || 0) * (pr.reps || 0)) || 0, 1)} kg volume</div></div></div></div>)}

      {tab === "shadows" && <>
        <SysMsg text="Exercise shadows are defeated by higher estimated strength or higher exercise volume. Session shadows compare today's muscle-group volume with your previous session." />
        {Object.entries(state.sessionShadows || {}).map(([muscle, sh]) => <div key={muscle} className="shadow-card"><div className="shadow-name">👻 {muscle} Session Shadow</div><div style={{ fontSize: 12, color: "var(--text3)", marginTop: 5 }}>{formatNum(sh.totalVolumeKg, 1)} kg · {new Date(sh.date).toLocaleDateString()}</div></div>)}
      </>}
    </div>
  );
};

// ─────────────────────────────────────────────────────────────
// ACHIEVEMENTS
// ─────────────────────────────────────────────────────────────
const AchievementsScreen = ({ state }) => {
  const unlocked = state.achievements || [];
  return (
    <div className="screen">
      <div className="header"><div><div className="header-title">ACHIEVEMENTS</div><div className="header-sub">◈ {unlocked.length}/{ACHIEVEMENTS_LIST.length} ◈</div></div></div>
      {ACHIEVEMENTS_LIST.map((a) => <div className="card" key={a.id} style={{ opacity: unlocked.includes(a.id) ? 1 : .45 }}><div className="flex" style={{ gap: 12, alignItems: "center" }}><div style={{ fontSize: 24 }}>{a.icon}</div><div><div style={{ fontFamily: "Rajdhani", fontWeight: 700, color: unlocked.includes(a.id) ? "var(--gold2)" : "var(--text2)" }}>{a.title}</div><div style={{ fontSize: 11, color: "var(--text3)" }}>{a.desc}</div></div></div></div>)}
    </div>
  );
};


// ─────────────────────────────────────────────────────────────
// SCHEDULE
// ─────────────────────────────────────────────────────────────
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
  const [slots, setSlots] = useState([]);
  const [generated, setGenerated] = useState(false);

  const addClass = () => setClasses((c) => [...c, { day: "Tuesday", start: "13:00", end: "15:00" }]);
  const updateClass = (i, field, value) => setClasses((c) => c.map((cl, j) => (j === i ? { ...cl, [field]: value } : cl)));
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
    const classHours = classes.map((c) => parseInt(c.start.split(":")[0])).filter(Number.isFinite);
    const firstCommit = Math.min(ws, ...(classHours.length ? classHours : [24]));
    const morningFree = (firstCommit - wake - comU / 60) * 60 - 30;
    if (morningFree >= len) windows.push({ time: `${String(wake + 1).padStart(2, "0")}:00`, label: "Morning Session", note: `${Math.floor(morningFree)} min available`, score: 92 });
    const postWork = we + Math.ceil(comW / 60);
    const eveningFree = (sleep - postWork - study - 1) * 60;
    if (eveningFree >= len) windows.push({ time: `${String(postWork).padStart(2, "0")}:00`, label: "Post-Work Window", note: `${Math.floor(eveningFree)} min available`, score: 80 });
    if (classes.length) {
      const mid = parseInt(classes[0].end.split(":")[0]) + 1;
      if (mid < ws) windows.push({ time: `${String(mid).padStart(2, "0")}:00`, label: "Midday Break", note: "Between class and work", score: 65 });
    }
    setSlots(windows.sort((a, b) => b.score - a.score));
    setGenerated(true);
  };

  return (
    <div className="screen">
      <div className="header"><div><div className="header-title">SMART SCHEDULE</div><div className="header-sub">◈ FIND YOUR TRAINING WINDOW ◈</div></div><span style={{ fontSize: 24 }}>📅</span></div>
      <div className="card">
        <div className="card-title">SLEEP</div>
        <div className="flex gap-8"><div style={{ flex: 1 }}><label className="label">Wake</label><input className="input" type="time" value={wakeTime} onChange={(e) => setWakeTime(e.target.value)} /></div><div style={{ flex: 1 }}><label className="label">Sleep</label><input className="input" type="time" value={sleepTime} onChange={(e) => setSleepTime(e.target.value)} /></div></div>
      </div>
      <div className="card">
        <div className="flex-between mb-8"><div className="card-title" style={{ marginBottom: 0 }}>UNIVERSITY CLASSES</div><button className="btn btn-ghost btn-sm" onClick={addClass}>+ Add</button></div>
        {classes.map((cl, i) => <div key={i} style={{ marginBottom: 8, padding: 8, background: "var(--bg4)", borderRadius: 10 }}><div className="flex gap-8"><select className="input" value={cl.day} onChange={(e) => updateClass(i, "day", e.target.value)}>{["Monday","Tuesday","Wednesday","Thursday","Friday","Saturday","Sunday"].map((d) => <option key={d}>{d}</option>)}</select><input className="input" type="time" value={cl.start} onChange={(e) => updateClass(i, "start", e.target.value)} /><input className="input" type="time" value={cl.end} onChange={(e) => updateClass(i, "end", e.target.value)} /><button style={{ background: "none", border: "none", color: "var(--text3)" }} onClick={() => removeClass(i)}>✕</button></div></div>)}
      </div>
      <div className="card">
        <div className="card-title">WORK + COMMUTE</div>
        <div className="flex gap-8" style={{ marginBottom: 8 }}><div style={{ flex: 1 }}><label className="label">Work Start</label><input className="input" type="time" value={workStart} onChange={(e) => setWorkStart(e.target.value)} /></div><div style={{ flex: 1 }}><label className="label">Work End</label><input className="input" type="time" value={workEnd} onChange={(e) => setWorkEnd(e.target.value)} /></div></div>
        <div className="flex gap-8"><div style={{ flex: 1 }}><label className="label">To Uni min</label><input className="input" type="number" value={commuteUni} onChange={(e) => setCommuteUni(e.target.value)} /></div><div style={{ flex: 1 }}><label className="label">To Work min</label><input className="input" type="number" value={commuteWork} onChange={(e) => setCommuteWork(e.target.value)} /></div></div>
      </div>
      <div className="card">
        <div className="flex gap-8"><div style={{ flex: 1 }}><label className="label">Study h/day</label><input className="input" type="number" value={studyHours} onChange={(e) => setStudyHours(e.target.value)} /></div><div style={{ flex: 1 }}><label className="label">Workout min</label><input className="input" type="number" value={prefLength} onChange={(e) => setPrefLength(e.target.value)} /></div></div>
      </div>
      <button className="btn btn-primary" onClick={generate}>⚡ CALCULATE WINDOWS</button>
      {generated && <div className="card" style={{ marginTop: 12 }}><div className="card-title">RECOMMENDED</div>{slots.length ? slots.map((slot, i) => <div key={i} style={{ padding: 10, marginBottom: 6, background: "var(--bg3)", borderRadius: 10, border: i === 0 ? "1px solid rgba(16,185,129,.35)" : "1px solid var(--border)" }}><div className="flex-between"><div><div style={{ fontFamily: "Rajdhani", fontWeight: 700 }}>{slot.time} — {slot.label}</div><div style={{ fontSize: 11, color: "var(--text3)" }}>{slot.note}</div></div><div style={{ color: i === 0 ? "var(--green)" : "var(--text3)", fontFamily: "Rajdhani", fontWeight: 700 }}>{slot.score}%</div></div></div>) : <div style={{ color: "var(--text3)" }}>No suitable window found.</div>}</div>}
    </div>
  );
};

// ─────────────────────────────────────────────────────────────
// PROFILE
// ─────────────────────────────────────────────────────────────
const ProfileScreen = ({ state, onReset }) => {
  const { level, currentExp, requiredExp } = getLevelFromExp(state.totalExp);
  const rank = getRank(level);
  const [confirm, setConfirm] = useState(false);
  const weights = Object.entries(state.bodyWeights || {}).sort((a, b) => b[0].localeCompare(a[0]));
  return (
    <div className="screen">
      <div className="header"><div><div className="header-title">PROFILE</div><div className="header-sub">◈ HUNTER STATS ◈</div></div><RankBadge level={level} size={48} /></div>
      <div className="hero-banner" style={{ textAlign: "center" }}><div style={{ fontFamily: "Rajdhani", fontSize: 26, fontWeight: 700, color: rank.color }}>{state.hunterName}</div><div style={{ color: "var(--text3)", fontSize: 12 }}>{rank.title} · Level {level}</div><div style={{ marginTop: 12 }}><ExpBar current={currentExp} required={requiredExp} /></div></div>
      <div className="card"><div className="card-title">RECENT BODY WEIGHT</div>{weights.length ? weights.slice(0, 7).map(([date, kg]) => <div key={date} className="flex-between" style={{ padding: "6px 0", borderBottom: "1px solid var(--border)" }}><span style={{ color: "var(--text3)", fontSize: 12 }}>{date}</span><span style={{ fontFamily: "Rajdhani", fontWeight: 700 }}>{formatNum(kg, 2)} kg</span></div>) : <div style={{ color: "var(--text3)", fontSize: 12 }}>No bodyweight entries yet.</div>}</div>
      <div className="card" style={{ borderColor: "rgba(239,68,68,.25)" }}><div className="card-title" style={{ color: "var(--red)" }}>DANGER ZONE</div>{!confirm ? <button className="btn btn-ghost" onClick={() => setConfirm(true)}>Reset All Data</button> : <div className="flex gap-8"><button className="btn btn-red" onClick={onReset}>Confirm Reset</button><button className="btn btn-ghost" onClick={() => setConfirm(false)}>Cancel</button></div>}</div>
    </div>
  );
};

// ─────────────────────────────────────────────────────────────
// MAIN
// ─────────────────────────────────────────────────────────────
export default function App() {
  const [state, setState] = useState(null);
  const [screen, setScreen] = useState("dashboard");
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [activeDraft, setActiveDraft] = useState(null);
  const [journalEntries, setJournalEntries] = useState([]);
  const [toast, setToast] = useState({ show: false, icon: "", title: "", sub: "", exp: 0 });
  const toastTimer = useRef(null);

  useEffect(() => {
    const s = loadAppState();
    setState(s);
    setShowOnboarding(!s.hunterName);
    setActiveDraft(loadActiveDraft());
    setJournalEntries(loadJSON(JOURNAL_KEY, []));
    try { navigator.storage?.persist?.(); } catch {}
  }, []);

  useEffect(() => { if (state) saveJSON(APP_KEY, state); }, [state]);

  useEffect(() => {
    if (!state) return;
    const today = new Date().toDateString();
    if (state.missionDate !== today) {
      const shuffled = [...MISSIONS_POOL].sort(() => Math.random() - 0.5).slice(0, 4);
      setState((s) => ({ ...s, missionDate: today, todayMissions: shuffled.map((m) => ({ ...m, completed: false })) }));
    }
  }, [state?.missionDate]);

  const showToast = (icon, title, sub = "", exp = 0) => {
    setToast({ show: true, icon, title, sub, exp });
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast((t) => ({ ...t, show: false })), 3200);
  };

  const handleOnboard = (name) => {
    setState((s) => ({ ...s, hunterName: name }));
    setShowOnboarding(false);
  };

  const handleDraftSaved = (draft, journalList) => {
    setActiveDraft(draft);
    if (journalList) setJournalEntries(journalList);
    setState((s) => {
      if (!s) return s;
      const nextWeight = draft.bodyWeightKg || null;
      const currentWeight = s.bodyWeights?.[todayKey()] || null;
      const unitChanged = draft.unit && draft.unit !== s.preferredUnit;
      const weightChanged = nextWeight && nextWeight !== currentWeight;
      if (!unitChanged && !weightChanged) return s;
      return {
        ...s,
        preferredUnit: draft.unit || s.preferredUnit,
        bodyWeights: weightChanged ? { ...(s.bodyWeights || {}), [todayKey()]: nextWeight } : s.bodyWeights,
      };
    });
  };

  const handleSaveCustomExercise = (muscle, rawName) => {
    const name = String(rawName || "").trim();
    if (!muscle || !name) return;

    setState((s) => {
      if (!s) return s;
      const existing = s.customExercisesByMuscle?.[muscle] || [];
      const builtIn = EXERCISE_DB[muscle] || [];
      const duplicate = [...builtIn, ...existing].some((e) => e.toLowerCase() === name.toLowerCase());
      if (duplicate) return s;
      return {
        ...s,
        customExercisesByMuscle: {
          ...(s.customExercisesByMuscle || {}),
          [muscle]: [...existing, name],
        },
      };
    });
  };

  const startWorkout = () => {
    setActiveDraft(null);
    removeStorage(ACTIVE_WORKOUT_KEY);
    setScreen("workout");
  };

  const resumeWorkout = () => setScreen("workout");

  const cancelWorkout = (draft) => {
    if (!draft?.id) return;
    removeStorage(ACTIVE_WORKOUT_KEY);
    const nextJournal = removeActiveJournalDraft(draft.id);
    setActiveDraft(null);
    setJournalEntries(nextJournal);
    setScreen("dashboard");
    showToast("🗑️", "Workout cancelled", "Unfinished draft removed. Completed progress is untouched.");
  };

  const finishWorkout = (draft) => {
    const today = new Date().toDateString();
    const wasYesterday = state.lastWorkoutDate === new Date(Date.now() - 86400000).toDateString();
    const newStreak = state.lastWorkoutDate === today ? state.streak : wasYesterday ? state.streak + 1 : 1;

    const previousExercisePRs = state.exercisePRs || {};
    const updatedExercisePRs = { ...previousExercisePRs };
    const shadowWins = [];
    let prCount = 0;

    (draft.exercises || []).forEach((ex) => {
      const stats = calculateExerciseStats(ex.sets);
      if (!stats.validSets) return;
      const prev = previousExercisePRs[ex.name];
      const prevIntensity = prev?.bestIntensity || calculateSetIntensity(prev?.weight || 0, prev?.reps || 0);
      const prevVolume = prev?.bestVolumeKg || prev?.totalVolumeKg || ((prev?.weight || 0) * (prev?.reps || 0)) || 0;
      const beatIntensity = !!prev && stats.bestIntensity > prevIntensity;
      const beatVolume = !!prev && stats.totalVolumeKg > prevVolume;

      if (!prev || beatIntensity || beatVolume) {
        prCount += 1;
        updatedExercisePRs[ex.name] = {
          weight: (!prev || beatIntensity) ? stats.bestWeightKg : prev.weight,
          reps: (!prev || beatIntensity) ? stats.bestReps : prev.reps,
          bestIntensity: Math.max(stats.bestIntensity, prevIntensity || 0),
          bestVolumeKg: Math.max(stats.totalVolumeKg, prevVolume || 0),
          date: new Date().toISOString(),
        };
      }

      if (prev && (beatIntensity || beatVolume)) {
        shadowWins.push({ name: ex.name, beatIntensity, beatVolume });
      }
    });

    const totalVolumeKg = calculateSessionVolumeKg(draft.exercises);
    const previousSession = state.sessionShadows?.[draft.muscle];
    const sessionShadowWin = !!previousSession && totalVolumeKg > (previousSession.totalVolumeKg || 0);
    const updatedSessionShadows = {
      ...(state.sessionShadows || {}),
      [draft.muscle]: {
        totalVolumeKg,
        date: new Date().toISOString(),
        workoutName: draft.workoutName,
      },
    };

    let exp = 50;
    if ((Date.now() - draft.startTime) / 60000 >= 30) exp += 20;
    if ((draft.exercises || []).length >= 5) exp += 25;
    exp += shadowWins.length * 20;
    if (sessionShadowWin) exp += 40;
    if (draft.notes?.trim()) exp += 10;
    const streakBonus = newStreak > 1 ? Math.min(newStreak * 5, 50) : 0;
    const totalExpGained = exp + streakBonus;

    const workout = {
      id: draft.id,
      name: draft.workoutName,
      muscle: draft.muscle,
      date: new Date().toISOString(),
      duration: Math.max(1, Math.floor((Date.now() - draft.startTime) / 60000)),
      exercises: draft.exercises,
      notes: draft.notes,
      bodyWeightKg: draft.bodyWeightKg || null,
      totalVolumeKg,
      expGained: totalExpGained,
      prs: prCount,
      exerciseShadowsDefeated: shadowWins.length,
      sessionShadowDefeated: sessionShadowWin,
      shadowsDefeated: shadowWins.length + (sessionShadowWin ? 1 : 0),
    };

    const { level: newLevel } = getLevelFromExp(state.totalExp + totalExpGained);
    const ns = {
      ...state,
      totalExp: state.totalExp + totalExpGained,
      streak: newStreak,
      lastWorkoutDate: today,
      totalWorkouts: state.totalWorkouts + 1,
      totalPRs: state.totalPRs + prCount,
      shadowsDefeated: (state.shadowsDefeated || 0) + shadowWins.length + (sessionShadowWin ? 1 : 0),
      exercisePRs: updatedExercisePRs,
      sessionShadows: updatedSessionShadows,
      bodyWeights: draft.bodyWeightKg ? { ...(state.bodyWeights || {}), [todayKey()]: draft.bodyWeightKg } : state.bodyWeights,
      preferredUnit: draft.unit,
      workoutHistory: [workout, ...(state.workoutHistory || [])].slice(0, 200),
      level: newLevel,
    };

    const achievements = [...(ns.achievements || [])];
    ACHIEVEMENTS_LIST.forEach((a) => { if (!achievements.includes(a.id) && a.condition(ns)) achievements.push(a.id); });
    ns.achievements = achievements;

    setState(ns);
    removeStorage(ACTIVE_WORKOUT_KEY);
    setActiveDraft(null);
    const completedJournal = upsertJournalFromDraft(draft, "completed");
    setJournalEntries(completedJournal.list);
    setScreen("dashboard");

    if (sessionShadowWin) showToast("👻", `${draft.muscle} Session Shadow Defeated!`, `${formatNum(previousSession.totalVolumeKg, 1)} → ${formatNum(totalVolumeKg, 1)} kg volume`, totalExpGained);
    else if (shadowWins.length) showToast("👻", `${shadowWins.length} Exercise Shadow${shadowWins.length > 1 ? "s" : ""} Defeated!`, draft.workoutName, totalExpGained);
    else showToast("⚔️", "Workout Complete", `${formatNum(totalVolumeKg, 1)} kg total volume`, totalExpGained);
  };

  const handleMissionComplete = (id) => {
    const mission = state.todayMissions?.find((m) => m.id === id);
    if (!mission || mission.completed) return;
    const nextMissions = state.todayMissions.map((m) => m.id === id ? { ...m, completed: true } : m);
    const allDone = nextMissions.every((m) => m.completed);
    setState((s) => ({ ...s, totalExp: s.totalExp + mission.exp, missionsCompleted: (s.missionsCompleted || 0) + 1, perfectMissionDays: allDone ? (s.perfectMissionDays || 0) + 1 : s.perfectMissionDays || 0, todayMissions: nextMissions }));
    showToast("🎯", "Mission Complete", mission.title, mission.exp);
  };

  const resetAll = () => {
    removeStorage(APP_KEY);
    removeStorage(LEGACY_APP_KEY);
    removeStorage(ACTIVE_WORKOUT_KEY);
    removeStorage(JOURNAL_KEY);
    setState({ ...INITIAL_STATE });
    setActiveDraft(null);
    setJournalEntries([]);
    setShowOnboarding(true);
    setScreen("dashboard");
  };

  if (!state) return <><style>{CSS}</style><div className="app"><div className="loading-screen">SYSTEM LOADING...</div></div></>;
  if (showOnboarding) return <><style>{CSS}</style><OnboardingScreen onComplete={handleOnboard} /></>;

  const pending = (state.todayMissions || []).filter((m) => !m.completed).length;
  const nav = [
    { id: "dashboard", icon: "⚡", label: "Home" },
    { id: "missions", icon: "🗡️", label: "Missions", badge: pending },
    { id: "workout", icon: "💪", label: activeDraft ? "Resume" : "Train" },
    { id: "journal", icon: "📝", label: "Journal" },
    { id: "progress", icon: "📊", label: "Progress" },
    { id: "achievements", icon: "🏆", label: "Awards" },
    { id: "schedule", icon: "📅", label: "Schedule" },
    { id: "profile", icon: "👤", label: "Profile" },
  ];

  return (
    <>
      <style>{CSS}</style>
      <div className="app">
        <Toast toast={toast} />
        {screen === "dashboard" && <DashboardScreen state={state} activeDraft={activeDraft} onStartWorkout={startWorkout} onResumeWorkout={resumeWorkout} onModeChange={(mode) => setState((s) => ({ ...s, mode }))} onMissionComplete={handleMissionComplete} onJournal={() => setScreen("journal")} />}
        {screen === "workout" && <WorkoutScreen key={activeDraft?.id || "new_workout"} state={state} initialDraft={activeDraft} onDraftSaved={handleDraftSaved} onSaveCustomExercise={handleSaveCustomExercise} onFinish={finishWorkout} onExit={() => setScreen("dashboard")} onCancel={cancelWorkout} />}
        {screen === "journal" && <JournalScreen entries={journalEntries} />}
        {screen === "missions" && <MissionsScreen state={state} onMissionComplete={handleMissionComplete} />}
        {screen === "progress" && <ProgressScreen state={state} />}
        {screen === "achievements" && <AchievementsScreen state={state} />}
        {screen === "schedule" && <ScheduleScreen />}
        {screen === "profile" && <ProfileScreen state={state} onReset={resetAll} />}

        {screen !== "workout" && (
          <nav className="nav">
            {nav.map((n) => <button key={n.id} className={`nav-btn ${screen === n.id ? "active" : ""}`} onClick={() => n.id === "workout" ? (activeDraft ? resumeWorkout() : startWorkout()) : setScreen(n.id)}><div className="nav-icon">{n.icon}{n.badge > 0 && <div className="notif-dot" />}</div><span className="nav-label">{n.label}</span></button>)}
          </nav>
        )}
      </div>
    </>
  );
}

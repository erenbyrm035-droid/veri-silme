import type { ProgramLevel } from "@/lib/database.types";

export interface TemplateExercise {
  name: string;
  sets: number;
  reps: string;
  rest_sec?: number;
}
export interface TemplateDay {
  title: string;
  focus: string;
  is_rest?: boolean;
  exercises: TemplateExercise[];
}
export interface ProgramTemplate {
  slug: string;
  name: string;
  category: string;
  level: ProgramLevel;
  weeks: number;
  days: TemplateDay[]; // bir haftanın gün deseni; haftalar boyunca tekrarlanır
}

const S = (name: string, sets: number, reps: string, rest = 90): TemplateExercise => ({ name, sets, reps, rest_sec: rest });

/** Hazır program şablonları — tek hafta deseni, applyTemplate ile haftalara yayılır. */
export const PROGRAM_TEMPLATES: ProgramTemplate[] = [
  {
    slug: "push-pull-legs", name: "Push Pull Legs", category: "bodybuilding", level: "intermediate", weeks: 6,
    days: [
      { title: "Push", focus: "Göğüs / Omuz / Triceps", exercises: [S("Bench Press", 4, "8-10"), S("Overhead Press", 3, "8-10"), S("Incline Dumbbell Press", 3, "10-12"), S("Triceps Pushdown", 3, "12-15", 60)] },
      { title: "Pull", focus: "Sırt / Biceps", exercises: [S("Deadlift", 4, "5"), S("Pull Up", 3, "8-10"), S("Barbell Row", 3, "8-10"), S("Barbell Curl", 3, "12", 60)] },
      { title: "Legs", focus: "Bacak", exercises: [S("Squat", 4, "6-8"), S("Romanian Deadlift", 3, "8-10"), S("Leg Press", 3, "12"), S("Calf Raise", 4, "15", 45)] },
      { title: "Dinlenme", focus: "Toparlanma", is_rest: true, exercises: [] },
    ],
  },
  {
    slug: "upper-lower", name: "Upper Lower", category: "muscle_gain", level: "intermediate", weeks: 4,
    days: [
      { title: "Upper", focus: "Üst Vücut", exercises: [S("Bench Press", 4, "6-8"), S("Barbell Row", 4, "6-8"), S("Overhead Press", 3, "8-10"), S("Lat Pulldown", 3, "10-12")] },
      { title: "Lower", focus: "Alt Vücut", exercises: [S("Squat", 4, "6-8"), S("Romanian Deadlift", 3, "8-10"), S("Leg Curl", 3, "12"), S("Calf Raise", 4, "15", 45)] },
      { title: "Dinlenme", focus: "Toparlanma", is_rest: true, exercises: [] },
    ],
  },
  {
    slug: "full-body", name: "Full Body", category: "muscle_gain", level: "beginner", weeks: 4,
    days: [
      { title: "Full Body A", focus: "Tüm Vücut", exercises: [S("Squat", 3, "8-10"), S("Bench Press", 3, "8-10"), S("Barbell Row", 3, "8-10"), S("Plank", 3, "45sn", 45)] },
      { title: "Dinlenme", focus: "Toparlanma", is_rest: true, exercises: [] },
      { title: "Full Body B", focus: "Tüm Vücut", exercises: [S("Deadlift", 3, "5"), S("Overhead Press", 3, "8-10"), S("Pull Up", 3, "6-8"), S("Lunge", 3, "12")] },
    ],
  },
  {
    slug: "bro-split", name: "Bro Split", category: "bodybuilding", level: "advanced", weeks: 6,
    days: [
      { title: "Göğüs", focus: "Göğüs", exercises: [S("Bench Press", 4, "8-10"), S("Incline Dumbbell Press", 3, "10-12"), S("Cable Fly", 3, "15", 60)] },
      { title: "Sırt", focus: "Sırt", exercises: [S("Deadlift", 4, "5"), S("Pull Up", 3, "8-10"), S("Barbell Row", 3, "8-10")] },
      { title: "Bacak", focus: "Bacak", exercises: [S("Squat", 4, "8-10"), S("Leg Press", 3, "12"), S("Leg Curl", 3, "12")] },
      { title: "Omuz", focus: "Omuz", exercises: [S("Overhead Press", 4, "8-10"), S("Lateral Raise", 4, "15", 45)] },
      { title: "Kol", focus: "Biceps / Triceps", exercises: [S("Barbell Curl", 4, "12", 60), S("Triceps Pushdown", 4, "12", 60)] },
    ],
  },
  {
    slug: "phul", name: "PHUL", category: "strength", level: "intermediate", weeks: 6,
    days: [
      { title: "Upper Power", focus: "Üst Güç", exercises: [S("Bench Press", 4, "3-5", 150), S("Barbell Row", 4, "3-5", 150), S("Overhead Press", 3, "5-8")] },
      { title: "Lower Power", focus: "Alt Güç", exercises: [S("Squat", 4, "3-5", 180), S("Deadlift", 3, "3-5", 180)] },
      { title: "Upper Hypertrophy", focus: "Üst Hacim", exercises: [S("Incline Dumbbell Press", 4, "10-12"), S("Lat Pulldown", 4, "12"), S("Lateral Raise", 3, "15", 45)] },
      { title: "Lower Hypertrophy", focus: "Alt Hacim", exercises: [S("Leg Press", 4, "12"), S("Leg Curl", 4, "12"), S("Calf Raise", 4, "15", 45)] },
    ],
  },
  {
    slug: "phat", name: "PHAT", category: "bodybuilding", level: "advanced", weeks: 6,
    days: [
      { title: "Upper Power", focus: "Üst Güç", exercises: [S("Bench Press", 4, "3-5", 150), S("Barbell Row", 4, "5")] },
      { title: "Lower Power", focus: "Alt Güç", exercises: [S("Squat", 4, "3-5", 180), S("Deadlift", 3, "5", 180)] },
      { title: "Back & Shoulders", focus: "Sırt / Omuz", exercises: [S("Pull Up", 4, "10"), S("Overhead Press", 4, "10")] },
      { title: "Legs", focus: "Bacak", exercises: [S("Front Squat", 4, "10"), S("Leg Curl", 4, "12")] },
      { title: "Chest & Arms", focus: "Göğüs / Kol", exercises: [S("Incline Dumbbell Press", 4, "12"), S("Barbell Curl", 4, "12", 60)] },
    ],
  },
  {
    slug: "5x5", name: "5x5 Strength", category: "strength", level: "beginner", weeks: 8,
    days: [
      { title: "Workout A", focus: "Squat / Bench / Row", exercises: [S("Squat", 5, "5", 180), S("Bench Press", 5, "5", 150), S("Barbell Row", 5, "5", 150)] },
      { title: "Dinlenme", focus: "Toparlanma", is_rest: true, exercises: [] },
      { title: "Workout B", focus: "Squat / OHP / Deadlift", exercises: [S("Squat", 5, "5", 180), S("Overhead Press", 5, "5", 150), S("Deadlift", 1, "5", 180)] },
    ],
  },
  {
    slug: "powerlifting", name: "Powerlifting", category: "powerlifting", level: "advanced", weeks: 8,
    days: [
      { title: "Squat Day", focus: "Squat", exercises: [S("Squat", 5, "3-5", 210), S("Front Squat", 3, "6")] },
      { title: "Bench Day", focus: "Bench", exercises: [S("Bench Press", 5, "3-5", 180), S("Close Grip Bench", 3, "6")] },
      { title: "Deadlift Day", focus: "Deadlift", exercises: [S("Deadlift", 5, "3-5", 210), S("Barbell Row", 3, "6")] },
    ],
  },
  {
    slug: "bodybuilding", name: "Bodybuilding", category: "bodybuilding", level: "intermediate", weeks: 8,
    days: [
      { title: "Göğüs & Triceps", focus: "İtiş", exercises: [S("Bench Press", 4, "10"), S("Cable Fly", 3, "15", 60), S("Triceps Pushdown", 3, "15", 60)] },
      { title: "Sırt & Biceps", focus: "Çekiş", exercises: [S("Lat Pulldown", 4, "12"), S("Barbell Row", 4, "10"), S("Barbell Curl", 3, "12", 60)] },
      { title: "Bacak", focus: "Bacak", exercises: [S("Squat", 4, "10"), S("Leg Press", 3, "15"), S("Calf Raise", 4, "20", 45)] },
      { title: "Omuz", focus: "Omuz", exercises: [S("Overhead Press", 4, "10"), S("Lateral Raise", 4, "15", 45)] },
    ],
  },
  {
    slug: "crossfit", name: "CrossFit WOD", category: "crossfit", level: "advanced", weeks: 4,
    days: [
      { title: "WOD 1", focus: "AMRAP", exercises: [S("Burpee", 1, "AMRAP 20dk", 0), S("Pull Up", 1, "10", 0), S("Air Squat", 1, "15", 0)] },
      { title: "WOD 2", focus: "EMOM", exercises: [S("Kettlebell Swing", 1, "EMOM 15dk", 0), S("Box Jump", 1, "10", 0)] },
    ],
  },
  {
    slug: "hiit", name: "HIIT", category: "hiit", level: "intermediate", weeks: 4,
    days: [
      { title: "HIIT Circuit", focus: "Kardiyo / Yağ Yakımı", exercises: [S("Jumping Jack", 4, "40sn", 20), S("Mountain Climber", 4, "40sn", 20), S("Burpee", 4, "40sn", 20)] },
      { title: "Dinlenme", focus: "Toparlanma", is_rest: true, exercises: [] },
    ],
  },
  {
    slug: "home-program", name: "Ev Programı", category: "calisthenics", level: "beginner", weeks: 4,
    days: [
      { title: "Ev Full Body", focus: "Vücut Ağırlığı", exercises: [S("Push Up", 3, "12"), S("Bodyweight Squat", 3, "15"), S("Plank", 3, "45sn", 45), S("Lunge", 3, "12")] },
      { title: "Dinlenme", focus: "Toparlanma", is_rest: true, exercises: [] },
    ],
  },
  {
    slug: "office-program", name: "Ofis Programı", category: "functional", level: "beginner", weeks: 4,
    days: [
      { title: "Ofis Mobilite", focus: "Duruş / Mobilite", exercises: [S("Neck Stretch", 2, "30sn", 20), S("Shoulder Roll", 2, "15", 20), S("Chair Squat", 3, "12"), S("Wall Sit", 3, "30sn", 30)] },
    ],
  },
];

export const TEMPLATE_BY_SLUG = new Map(PROGRAM_TEMPLATES.map((t) => [t.slug, t]));

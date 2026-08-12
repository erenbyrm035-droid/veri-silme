// ============================================================================
// Supabase veritabanı tipleri (şema ile senkron).
// Not: Üretimde `supabase gen types typescript` ile otomatik üretilebilir.
// ============================================================================

export type Gender = "male" | "female" | "other";
export type Goal =
  | "lose_weight"
  | "gain_muscle"
  | "get_fit"
  | "improve_endurance"
  | "gain_strength";
export type Experience = "beginner" | "intermediate" | "advanced" | "professional";
export type TrainingEnvironment = "home" | "gym" | "both" | "outdoor";
export type Difficulty = "beginner" | "intermediate" | "advanced";
export type WorkoutStatus = "planned" | "in_progress" | "completed";
export type MealType = "breakfast" | "lunch" | "dinner" | "snack";
export type ChatRole = "user" | "assistant" | "system";
export type ExerciseCategory =
  | "isolation"
  | "compound"
  | "functional"
  | "mobility"
  | "stretch"
  | "rehab"
  | "activation"
  | "warmup"
  | "cooldown"
  | "cardio"
  | "plyometric"
  | "core"
  | "balance"
  | "stabilization";
export type AltRelation = "alternative" | "similar" | "home" | "gym";
export type BodyRegion = "front" | "back";
export type MediaType = "gif" | "animation" | "video";

export interface Profile {
  id: string;
  full_name: string | null;
  avatar_url: string | null;
  age: number | null;
  gender: Gender | null;
  height_cm: number | null;
  weight_kg: number | null;
  starting_weight_kg: number | null;
  body_fat_pct: number | null;
  sleep_hours: number | null;
  injuries: string[];
  available_equipment: string[];
  goal: Goal | null;
  experience: Experience | null;
  weekly_training_days: number | null;
  training_environment: TrainingEnvironment | null;
  daily_calorie_goal: number;
  daily_protein_goal: number;
  daily_water_goal_ml: number;
  daily_step_goal: number;
  muscle_mass_kg: number | null;
  activity_level: ActivityLevel | null;
  daily_step_count: number | null;
  dietary_preferences: string[];
  allergies: string[];
  health_conditions: string[];
  medications: string[];
  nutrition_goal: NutritionGoal | null;
  daily_carb_goal: number | null;
  daily_fat_goal: number | null;
  daily_fiber_goal: number | null;
  is_admin: boolean;
  admin_role: AdminRole | null;
  is_premium: boolean;
  premium_until: string | null;
  membership_type: MembershipType;
  is_banned: boolean;
  banned_at: string | null;
  ban_reason: string | null;
  is_active: boolean;
  phone: string | null;
  /** Liderlik tablosu bölge filtreleri (migration 0021). */
  country: string | null;
  city: string | null;
  disliked_foods: string[];
  favorite_foods: string[];
  meals_per_day: number | null;
  target_weight_kg: number | null;
  goals: string[];
  birth_date: string | null;
  occupation: string | null;
  daily_sitting_hours: number | null;
  preferred_workout_duration: number | null;
  water_intake_ml: number | null;
  smoking_status: string | null;
  health_notes: string | null;
  bio: string | null;
  ai_consent: boolean;
  onboarding_completed: boolean;
  created_at: string;
  updated_at: string;
}

export type AdminRole = "super_admin" | "admin" | "editor";
export type MembershipType = "free" | "premium" | "trial" | "lifetime";

// ============================================================================
// KULLANICI YÖNETİM SİSTEMİ (Sprint 15)
// ============================================================================

/** Admin kullanıcı listesi satırı (admin_users görünümünden). */
export interface AdminUserRow {
  id: string;
  full_name: string | null;
  avatar_url: string | null;
  phone: string | null;
  email: string | null;
  is_premium: boolean;
  premium_until: string | null;
  membership_type: MembershipType;
  admin_role: AdminRole | null;
  is_admin: boolean;
  is_banned: boolean;
  banned_at: string | null;
  ban_reason: string | null;
  is_active: boolean;
  onboarding_completed: boolean;
  created_at: string;
  registered_at: string;
  last_sign_in_at: string | null;
}

export interface AdminUserNote {
  id: string;
  user_id: string;
  author_id: string | null;
  author_name: string | null;
  note: string;
  created_at: string;
}

export interface UserLoginEvent {
  id: string;
  user_id: string;
  provider: string | null;
  created_at: string;
}

/** Kullanıcı detay sayfası istatistikleri. */
export interface AdminUserStats {
  totalLogins: number;
  totalWorkouts: number;
  completedWorkouts: number;
  totalPrograms: number;
  favoriteExercises: number;
  aiConversations: number;
  postureAnalyses: number;
  mealPlans: number;
}

/** Aktivite geçmişi tek kaydı (birleşik zaman çizelgesi). */
export interface AdminUserActivityItem {
  kind:
    | "login"
    | "program"
    | "ai_chat"
    | "posture"
    | "meal_plan"
    | "workout";
  title: string;
  created_at: string;
}

export type ActivityLevel =
  | "sedentary"
  | "light"
  | "moderate"
  | "active"
  | "athlete";

export type NutritionGoal =
  | "gain_muscle"
  | "lose_fat"
  | "maintain"
  | "performance"
  | "strength"
  | "endurance"
  | "healthy";

export interface Exercise {
  id: string;
  name: string;
  muscle_group: string;
  description: string | null;
  media_type: MediaType;
  difficulty: Difficulty;
  equipment: string | null;
  category: ExerciseCategory;
  secondary_muscles: string[];
  tempo: string | null;
  rec_sets: number | null;
  rec_reps: string | null;
  rec_rest_sec: number | null;
  common_mistakes: string[];
  correct_form: string | null;
  tips: string[];
  ai_notes: string | null;
  gif_url: string | null;
  image_url: string | null;
  video_url: string | null;
  is_home: boolean;
  is_gym: boolean;
  slug: string | null;
  /** Standart isme göre türetilen video dosya adı (romanian-deadlift). */
  video_slug: string | null;
  /** Aynı hareketin diğer yaygın adları — arama bunlarla da eşleşir (RDL). */
  aliases: string[];
  movement_type: string | null;
  thumbnail_url: string | null;
  primary_muscles: string[];
  calories: number | null;
  english_name: string | null;
  body_region: string | null;
  stabilizer_muscles: string[];
  mobility_focus: string[];
  rehabilitation_focus: string[];
  exercise_goal: string[];
  environment: TrainingEnvironment;
  instructions: string[];
  breathing: string | null;
  range_of_motion: string | null;
  regressions: string[];
  progressions: string[];
  average_duration_sec: number | null;
  status: ExerciseStatus;
  subcategory: string | null;
  tags: string[];
  seo_title: string | null;
  seo_description: string | null;
  og_image_url: string | null;
  start_position: string | null;
  end_position: string | null;
  updated_by: string | null;
  updated_at: string;
  created_at: string;
}

export type ExerciseStatus = "published" | "draft";

// ============================================================================
// EXERCISE CMS (Sprint 16)
// ============================================================================
export type MuscleRole = "primary" | "secondary";
export type ExerciseRelationType =
  | "alternative"
  | "easier"
  | "harder"
  | "same_muscle"
  | "same_pattern"
  | "same_equipment";

export interface ExerciseCategoryRow {
  id: string;
  slug: string;
  name: string;
  parent_slug: string | null;
  sort_order: number;
  created_at: string;
}

export interface ExerciseTag {
  id: string;
  slug: string;
  name: string;
  created_at: string;
}

export interface ExerciseMuscleLink {
  id: string;
  exercise_id: string;
  muscle_id: string | null;
  muscle_name: string | null;
  role: MuscleRole;
  sort_order: number;
  created_at: string;
}

export interface ExerciseMediaRow {
  id: string;
  exercise_id: string;
  media_type: MediaType;
  url: string;
  storage_path: string | null;
  is_primary: boolean;
  sort_order: number;
  created_at: string;
}

export interface ExerciseRelationRow {
  id: string;
  exercise_id: string;
  related_id: string;
  relation: ExerciseRelationType;
  created_at: string;
}

export interface ExerciseVersion {
  id: string;
  exercise_id: string;
  version: number;
  snapshot: Record<string, unknown>;
  changed_by: string | null;
  changed_by_name: string | null;
  change_note: string | null;
  created_at: string;
}

/** Admin liste satırı (hafif alanlar). */
export interface AdminExerciseRow {
  id: string;
  name: string;
  slug: string | null;
  category: ExerciseCategory;
  subcategory: string | null;
  muscle_group: string;
  secondary_muscles: string[];
  difficulty: Difficulty;
  equipment: string | null;
  status: ExerciseStatus;
  gif_url: string | null;
  media_type: MediaType;
  tags: string[];
  movement_type: string | null;
  updated_at: string;
}

/** Duplicate tespiti kümesi. */
export interface DuplicateGroup {
  key: string;
  exercises: { id: string; name: string; slug: string | null; status: ExerciseStatus }[];
}

export interface ExerciseAlternative {
  id: string;
  exercise_id: string;
  alt_exercise_id: string;
  relation: AltRelation;
}

export interface Workout {
  id: string;
  user_id: string;
  title: string;
  workout_date: string;
  status: WorkoutStatus;
  notes: string | null;
  duration_min: number | null;
  created_at: string;
  completed_at: string | null;
}

export interface WorkoutSet {
  id: string;
  workout_id: string;
  exercise_id: string | null;
  exercise_name: string;
  set_order: number;
  reps: number | null;
  weight_kg: number | null;
  completed: boolean;
  created_at: string;
  /** Planlanan tekrar — gerçekleşenle (reps) karşılaştırılır. */
  target_reps: number | null;
  /** Reps In Reserve: sette kaç tekrar daha yapılabilirdi (0-10). */
  rir: number | null;
  /** Rate of Perceived Exertion: algılanan zorluk (1-10). */
  rpe: number | null;
  /** Bu setten sonra dinlenilen süre (sn). */
  rest_sec: number | null;
  notes: string | null;
}

export interface PersonalRecord {
  id: string;
  user_id: string;
  exercise_id: string | null;
  exercise_name: string;
  best_weight: number;
  best_reps: number | null;
  est_1rm: number;
  achieved_on: string;
  updated_at: string;
}

export interface Food {
  id: string;
  name: string;
  calories: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  serving_desc: string | null;
  is_turkish: boolean;
  fiber_g: number;
  sugar_g: number;
  sodium_mg: number;
  potassium_mg: number;
  category: string | null;
  brand: string | null;
  barcode: string | null;
  serving_grams: number | null;
  is_verified: boolean;
  source: string | null;
  subcategory: string | null;
  image_url: string | null;
  external_id: string | null;
  external_source: string | null;
  glycemic_index: number | null;
  allergens: string[];
  cholesterol_mg: number;
  calcium_mg: number;
  iron_mg: number;
  magnesium_mg: number;
  phosphorus_mg: number;
  zinc_mg: number;
  vitamin_a_mcg: number;
  vitamin_b_mg: number;
  vitamin_c_mg: number;
  vitamin_d_mcg: number;
  vitamin_e_mg: number;
  vitamin_k_mcg: number;
  omega3_g: number;
  omega6_g: number;
  water_g: number;
  updated_at: string;
  created_at: string;
}

// ============================================================================
// NUTRITION CMS (Sprint 18)
// ============================================================================
export type ContentStatus = "published" | "draft";
export type NutritionMealType =
  | "breakfast"
  | "snack"
  | "lunch"
  | "pre_workout"
  | "post_workout"
  | "dinner"
  | "supper";
export type NutritionFavoriteKind = "food" | "recipe" | "diet";

export interface FoodCategoryRow {
  id: string;
  slug: string;
  name: string;
  parent_slug: string | null;
  sort_order: number;
  created_at: string;
}

export interface Recipe {
  id: string;
  slug: string;
  name: string;
  cover_url: string | null;
  video_url: string | null;
  description: string | null;
  instructions: string[];
  servings: number;
  prep_minutes: number | null;
  cook_minutes: number | null;
  calories: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  category: string | null;
  tags: string[];
  status: ContentStatus;
  favorite_count: number;
  created_by: string | null;
  updated_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface RecipeIngredient {
  id: string;
  recipe_id: string;
  food_id: string | null;
  name: string;
  grams: number;
  note: string | null;
  sort_order: number;
  created_at: string;
}

export interface DietPlan {
  id: string;
  slug: string;
  name: string;
  cover_url: string | null;
  description: string | null;
  goal: string | null;
  category: string | null;
  total_calories: number | null;
  protein_g: number | null;
  carbs_g: number | null;
  fat_g: number | null;
  days: number;
  tags: string[];
  status: ContentStatus;
  favorite_count: number;
  use_count: number;
  created_by: string | null;
  updated_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface DietDay {
  id: string;
  plan_id: string;
  day: number;
  title: string | null;
  notes: string | null;
  sort_order: number;
  created_at: string;
}

export interface MealRow {
  id: string;
  day_id: string;
  meal_type: NutritionMealType;
  title: string | null;
  meal_time: string | null;
  sort_order: number;
  created_at: string;
}

export interface MealFood {
  id: string;
  meal_id: string;
  food_id: string | null;
  recipe_id: string | null;
  name: string;
  grams: number;
  servings: number | null;
  calories: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  sort_order: number;
  created_at: string;
}

export interface NutritionFavorite {
  id: string;
  user_id: string;
  kind: NutritionFavoriteKind;
  ref_id: string;
  created_at: string;
}

/** Admin liste satırları (hafif). */
export interface AdminFoodRow {
  id: string;
  name: string;
  brand: string | null;
  category: string | null;
  subcategory: string | null;
  image_url: string | null;
  barcode: string | null;
  serving_grams: number | null;
  calories: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  is_verified: boolean;
  external_source: string | null;
  updated_at: string;
}

export interface MealWithFoods extends MealRow {
  foods: MealFood[];
}
export interface DietDayWithMeals extends DietDay {
  meals: MealWithFoods[];
}

export interface NutritionLog {
  id: string;
  user_id: string;
  food_id: string | null;
  food_name: string;
  meal: MealType;
  log_date: string;
  grams: number;
  calories: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  created_at: string;
}

export interface WaterLog {
  id: string;
  user_id: string;
  log_date: string;
  amount_ml: number;
  created_at: string;
}

export interface BodyMeasurement {
  id: string;
  user_id: string;
  measured_on: string;
  weight_kg: number | null;
  waist_cm: number | null;
  arm_cm: number | null;
  chest_cm: number | null;
  shoulder_cm: number | null;
  leg_cm: number | null;
  photo_url: string | null;
  notes: string | null;
  created_at: string;
}

export type PhotoAngle = "front" | "side" | "back";

export interface BodyPhoto {
  id: string;
  user_id: string;
  taken_on: string;
  storage_path: string;
  angle: PhotoAngle;
  created_at: string;
}

export interface Muscle {
  id: string;
  slug: string;
  name_tr: string;
  latin_name: string | null;
  muscle_group: string;
  region: BodyRegion;
  svg_region_id: string | null;
  overview: string | null;
  functions: string[];
  origin: string | null;
  insertion: string | null;
  innervation: string | null;
  common_injuries: string[];
  rehab_notes: string | null;
  joints: string[];
  daily_life: string | null;
  growth_tips: string[];
  color: string | null;
  model_region: string | null;
  sort_order: number;
  created_at: string;
}

export interface Favorite {
  id: string;
  user_id: string;
  exercise_id: string;
  created_at: string;
}

export interface MuscleAnalysis {
  id: string;
  user_id: string;
  lagging: { muscle: string; reason: string }[];
  summary: string | null;
  created_at: string;
}

export interface ProgramDayExercise {
  name: string;
  sets: number;
  reps: string;
}
export interface ProgramDay {
  day: string;
  focus: string;
  exercises: ProgramDayExercise[];
}
export interface ProgramWeek {
  week: number;
  focus: string;
  days: ProgramDay[];
}
export interface ProgramPlan {
  weeks: ProgramWeek[];
}
export interface Program {
  id: string;
  user_id: string;
  title: string;
  goal: string | null;
  weeks: number;
  plan: ProgramPlan;
  created_at: string;
}

// ============================================================================
// PROGRAM BUILDER + WORKOUT CMS (Sprint 17)
// ============================================================================
export type ProgramLevel = "beginner" | "intermediate" | "advanced";
export type ProgramGender = "male" | "female" | "both";
export type ProgramEnvironment = "home" | "gym" | "both";
export type ProgramStatus = "published" | "draft";
export type ProgramBlockType =
  | "normal"
  | "superset"
  | "dropset"
  | "circuit"
  | "emom"
  | "amrap"
  | "tabata";
export type ProgramRelationType = "similar" | "alternative" | "next" | "previous";
export type ProgramProgressStatus = "active" | "completed" | "abandoned";

export interface WorkoutProgram {
  id: string;
  slug: string;
  name: string;
  cover_url: string | null;
  short_description: string | null;
  description: string | null;
  category: string | null;
  level: ProgramLevel;
  goal: string | null;
  gender: ProgramGender;
  environment: ProgramEnvironment;
  weeks: number;
  days_per_week: number;
  est_minutes: number | null;
  calories: number | null;
  tags: string[];
  status: ProgramStatus;
  sort_order: number;
  rating_avg: number;
  rating_count: number;
  favorite_count: number;
  use_count: number;
  completion_rate: number;
  created_by: string | null;
  updated_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface WorkoutProgramDay {
  id: string;
  program_id: string;
  week: number;
  day: number;
  title: string | null;
  focus: string | null;
  notes: string | null;
  is_rest: boolean;
  sort_order: number;
  created_at: string;
}

export interface WorkoutProgramExercise {
  id: string;
  day_id: string;
  exercise_id: string | null;
  exercise_name: string;
  block_type: ProgramBlockType;
  block_group: number;
  sets: number | null;
  reps: string | null;
  duration_sec: number | null;
  rest_sec: number | null;
  tempo: string | null;
  rpe: number | null;
  rir: number | null;
  note: string | null;
  sort_order: number;
  created_at: string;
}

export interface ProgramCategoryRow {
  id: string;
  slug: string;
  name: string;
  sort_order: number;
  created_at: string;
}
export interface ProgramTag {
  id: string;
  slug: string;
  name: string;
  created_at: string;
}
export interface ProgramFavorite {
  id: string;
  user_id: string;
  program_id: string;
  created_at: string;
}
export interface ProgramRating {
  id: string;
  user_id: string;
  program_id: string;
  rating: number;
  comment: string | null;
  created_at: string;
  updated_at: string;
}
export interface ProgramProgress {
  id: string;
  user_id: string;
  program_id: string;
  status: ProgramProgressStatus;
  progress_pct: number;
  started_at: string;
  completed_at: string | null;
  updated_at: string;
}
export interface ProgramRelationRow {
  id: string;
  program_id: string;
  related_id: string;
  relation: ProgramRelationType;
  created_at: string;
}
export interface ProgramVersion {
  id: string;
  program_id: string;
  version: number;
  snapshot: Record<string, unknown>;
  changed_by: string | null;
  changed_by_name: string | null;
  change_note: string | null;
  created_at: string;
}

/** Admin liste satırı (türetilmiş toplam gün/egzersiz). */
export interface AdminProgramRow extends WorkoutProgram {
  total_days: number;
  total_exercises: number;
}

/** Builder ağacı: gün + egzersizleri. */
export interface ProgramDayWithExercises extends WorkoutProgramDay {
  exercises: WorkoutProgramExercise[];
}

export type NotificationType =
  | "info"
  | "workout"
  | "nutrition"
  | "achievement"
  | "coach";

export interface AppNotification {
  id: string;
  user_id: string;
  type: NotificationType;
  title: string;
  body: string | null;
  href: string | null;
  read: boolean;
  created_at: string;
}

export interface AiConversation {
  id: string;
  user_id: string;
  title: string;
  archived: boolean;
  pinned: boolean;
  model: string | null;
  last_message_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface AiMessage {
  id: string;
  conversation_id: string;
  user_id: string;
  role: ChatRole;
  content: string;
  edited: boolean;
  tokens: number | null;
  model: string | null;
  updated_at: string;
  created_at: string;
}

// ============================================================================
// AI FITNESS COACH (Sprint 20)
// ============================================================================
export interface AiMemory {
  id: string;
  user_id: string;
  summary: string | null;
  facts: string[];
  updated_at: string;
  created_at: string;
}

export interface AiPromptVersion {
  id: string;
  key: string;
  version: number;
  content: string;
  is_active: boolean;
  notes: string | null;
  created_by: string | null;
  created_at: string;
}

export interface AiUsageRow {
  id: string;
  user_id: string | null;
  conversation_id: string | null;
  model: string | null;
  prompt_tokens: number;
  completion_tokens: number;
  total_tokens: number;
  created_at: string;
}

export interface AiLogRow {
  id: string;
  user_id: string | null;
  conversation_id: string | null;
  level: "info" | "warn" | "error";
  event: string;
  detail: Record<string, unknown>;
  created_at: string;
}

/** Kullanıcının AI'ya (izinle) açtığı bağlam paketi. */
export interface AiUserContext {
  profile: Partial<Profile> | null;
  favorites: string[];
  completedWorkouts: number;
  recentWorkouts: { title: string; date: string; status: string }[];
  latestWeight: number | null;
  dietPlan: string | null;
  posture: { score: number; risk: string | null; problems: string[] } | null;
  waterToday: number;
  sleepHours: number | null;
  injuries: string[];
}

/** Akıllı öneri (kural tabanlı). */
export interface SmartRecommendation {
  kind: "workout" | "rest" | "nutrition" | "water" | "posture" | "motivation";
  title: string;
  detail: string;
}

// ============================================================================
// AI NUTRITION COACH (Sprint 10)
// ============================================================================
export type MealSlot =
  | "breakfast"
  | "snack1"
  | "lunch"
  | "snack2"
  | "dinner"
  | "supper";

export interface MacroTargets {
  calories: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  fiber_g: number;
  sugar_g: number;
  sodium_mg: number;
  potassium_mg: number;
  water_ml: number;
}

export interface MealPlanItem {
  slot: MealSlot;
  title: string;
  recipe: string;
  calories: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  fiber_g: number;
  prep_minutes: number;
  cost_tl: number;
}

export interface MealPlanData {
  meals: MealPlanItem[];
  total: { calories: number; protein_g: number; carbs_g: number; fat_g: number };
}

export interface MealPlan {
  id: string;
  user_id: string;
  title: string;
  goal: string | null;
  target_calories: number | null;
  target_protein: number | null;
  target_carbs: number | null;
  target_fat: number | null;
  plan: MealPlanData;
  created_at: string;
}

export interface ShoppingCategoryGroup {
  category: string;
  items: string[];
}

export interface ShoppingList {
  id: string;
  user_id: string;
  plan_id: string | null;
  title: string;
  items: ShoppingCategoryGroup[];
  created_at: string;
}

export interface NutritionReportScores {
  nutrition: number;
  protein: number;
  calorie: number;
  water: number;
  macro: number;
  training: number;
}

export interface NutritionReport {
  id: string;
  user_id: string;
  week_start: string;
  scores: NutritionReportScores;
  weight_change: number | null;
  advice: string | null;
  data: Record<string, unknown>;
  created_at: string;
}

export interface MealPhoto {
  id: string;
  user_id: string;
  storage_path: string;
  recognized: Record<string, unknown>;
  logged: boolean;
  created_at: string;
}

// ============================================================================
// EXERCISE ANIMATION ENGINE (Sprint 12)
// ============================================================================
export type GenderSupport = "male" | "female" | "both";

export interface CameraPosition {
  x: number;
  y: number;
  z: number;
}

export interface Animation {
  id: string;
  animation_key: string;
  name: string;
  url: string | null;
  duration_sec: number | null;
  loop: boolean;
  thumbnail_url: string | null;
  camera_position: CameraPosition;
  gender_support: GenderSupport;
  created_at: string;
  updated_at: string;
}

export interface AnimationMapping {
  id: string;
  exercise_id: string;
  animation_id: string;
  gender: GenderSupport;
  priority: number;
  created_at: string;
}

// ============================================================================
// POSTURE ANALYSIS + CORRECTIVE (Sprint 8)
// ============================================================================
export type PostureProblem =
  | "forward_head"
  | "rounded_shoulders"
  | "upper_cross"
  | "lower_cross"
  | "kyphosis"
  | "lordosis"
  | "scoliosis"
  | "pelvic_tilt"
  | "anterior_pelvic_tilt"
  | "posterior_pelvic_tilt"
  | "knee_valgus"
  | "knee_varus"
  | "foot_pronation"
  | "flat_feet"
  | "winged_scapula"
  | "shoulder_asymmetry"
  | "hip_asymmetry";

export type RiskLevel = "low" | "moderate" | "high";
export type PostureView = "front" | "side" | "back";
export type CorrectiveSectionType =
  | "mobilization"
  | "activation"
  | "strengthening"
  | "stretching"
  | "cooldown";

/** Tek bir postür bulgusu (analiz sonucu). */
export interface PostureFinding {
  problem: PostureProblem;
  label: string;
  confidence: number; // 0-100
  risk: RiskLevel;
  description: string;
  affected_muscles: string[];
  weak_muscles: string[];
  tight_muscles: string[];
  explanation: {
    meaning: string;
    daily_life: string;
    sport_performance: string;
    recovery_time: string;
    cautions: string;
  };
}

/** Düzeltici program içindeki tek egzersiz (ortama göre çözülmüş). */
export interface CorrectiveExercise {
  key: string;
  name: string;
  english_name: string;
  section: CorrectiveSectionType;
  equipment: string;
  category: ExerciseCategory;
  difficulty: Difficulty;
  description: string;
  sets: number | null;
  reps: string | null;
  rest_sec: number | null;
  duration_sec: number | null;
  breathing: string | null;
  gif_url: string | null;
}

export interface CorrectiveSection {
  type: CorrectiveSectionType;
  label: string;
  exercises: CorrectiveExercise[];
}

export interface CorrectiveProgram {
  environment: TrainingEnvironment;
  sections: CorrectiveSection[];
  total_minutes: number;
  problems: PostureProblem[];
}

export interface PostureScores {
  posture: number;
  mobility: number;
  symmetry: number;
  recovery: number;
}

export interface PostureAnalysis {
  id: string;
  user_id: string;
  environment: TrainingEnvironment;
  source: "ai_vision" | "self_assessment";
  photo_front_path: string | null;
  photo_side_path: string | null;
  photo_back_path: string | null;
  posture_score: number;
  mobility_score: number;
  symmetry_score: number;
  recovery_score: number;
  findings: PostureFinding[];
  corrective_program: CorrectiveProgram | Record<string, never>;
  summary: string | null;
  risk_level: RiskLevel | null;
  region_scores: Record<string, RegionScore>;
  muscle_analysis: PostureMuscleAnalysis | Record<string, never>;
  keypoints: PoseKeypoint[] | null;
  improvement_pct: number | null;
  program_days: number | null;
  country: string | null;
  analysis_type: "photo" | "video" | "live";
  created_at: string;
}

// ---- Postür bölgeleri + akıllı öneri motoru (Sprint 19) --------------------
export type PostureRegion =
  | "head" | "neck" | "shoulders" | "scapula" | "chest" | "thoracic"
  | "lower_back" | "pelvis" | "hip" | "knee" | "foot" | "ankle";

export type RegionStatus = "normal" | "attention" | "high_risk";

export interface RegionScore {
  status: RegionStatus;
  score: number; // 0-100
}

/** Akıllı öneri motoru: kas dengesizliği kategorileri. */
export interface PostureMuscleAnalysis {
  short: string[];       // kısa/gergin
  weak: string[];        // zayıf
  overactive: string[];  // aşırı aktif
  inhibited: string[];   // inhibe (baskılanmış)
}

export interface PoseKeypoint {
  name: string;
  x: number;
  y: number;
  score: number;
}

export interface PostureImage {
  id: string;
  analysis_id: string;
  user_id: string;
  view: "front" | "back" | "left" | "right";
  storage_path: string;
  width: number | null;
  height: number | null;
  created_at: string;
}

export interface PostureResultRow {
  id: string;
  analysis_id: string;
  problem: PostureProblem;
  label: string;
  risk: RiskLevel;
  confidence: number;
  description: string | null;
  short_muscles: string[];
  weak_muscles: string[];
  overactive_muscles: string[];
  inhibited_muscles: string[];
  created_at: string;
}

export interface PostureScoreRow {
  id: string;
  analysis_id: string;
  region: PostureRegion;
  status: RegionStatus;
  score: number;
  created_at: string;
}

export interface CorrectiveProgramRow {
  id: string;
  analysis_id: string | null;
  user_id: string;
  environment: TrainingEnvironment;
  days: number;
  total_minutes: number;
  plan: Record<string, unknown>;
  created_at: string;
}

export interface CorrectiveExerciseRow {
  id: string;
  program_id: string;
  exercise_id: string | null;
  day: number;
  section: CorrectiveSectionType;
  name: string;
  english_name: string | null;
  equipment: string | null;
  sets: number | null;
  reps: string | null;
  rest_sec: number | null;
  duration_sec: number | null;
  gif_url: string | null;
  sort_order: number;
  created_at: string;
}

export interface AnalysisHistoryRow {
  id: string;
  user_id: string;
  analysis_id: string;
  posture_score: number;
  risk_level: RiskLevel | null;
  program_days: number | null;
  improvement_pct: number | null;
  created_at: string;
}

/** Admin liste satırı (kullanıcı bilgisiyle). */
export interface AdminPostureRow {
  id: string;
  user_id: string;
  user_name: string | null;
  email: string | null;
  posture_score: number;
  risk_level: RiskLevel | null;
  environment: TrainingEnvironment;
  analysis_type: string;
  country: string | null;
  top_problems: string[];
  created_at: string;
}

// ============================================================================
// Gamification (Sprint 9) — XP / Level / Fitness / Streak / Achievement /
// Badge / Leaderboard / Challenge / Season / Team / Reward.
// ============================================================================
export type BadgeTier = "bronze" | "silver" | "gold" | "platinum" | "diamond" | "legend";
export type XpCooldown = "none" | "daily" | "once";
export type LeaderboardPeriod = "weekly" | "monthly" | "yearly" | "all_time";
export type LeaderboardScope = "global" | "country" | "city" | "team" | "friends";
export type RewardType =
  | "premium_days" | "profile_frame" | "theme" | "ai_avatar" | "badge"
  | "exercise_pack" | "program" | "diet_pack";

export interface XpRule {
  event_key: string;
  label: string;
  xp: number;
  category: string;
  cooldown: XpCooldown;
  enabled: boolean;
  sort_order: number;
  updated_at: string;
}

export interface XpLog {
  id: string;
  user_id: string;
  event_key: string;
  xp: number;
  ref_type: string | null;
  ref_id: string | null;
  meta: Record<string, unknown>;
  created_at: string;
}

export interface Level {
  level: number;
  title: string;
  min_xp: number;
  color: string;
  icon: string | null;
  perks: unknown[];
  sort_order: number;
}

export interface UserGamification {
  user_id: string;
  total_xp: number;
  level: number;
  fitness_score: number;
  coins: number;
  current_streak: number;
  longest_streak: number;
  last_active_on: string | null;
  season_xp: number;
  updated_at: string;
}

export interface Badge {
  id: string;
  key: string;
  name: string;
  tier: BadgeTier;
  description: string | null;
  icon: string | null;
  color: string | null;
  sort_order: number;
  enabled: boolean;
  created_at: string;
}

export interface Achievement {
  id: string;
  key: string;
  name: string;
  description: string | null;
  category: string;
  metric: string;
  target: number;
  icon: string | null;
  badge_id: string | null;
  xp_reward: number;
  enabled: boolean;
  sort_order: number;
  created_at: string;
}

export interface AchievementProgress {
  id: string;
  user_id: string;
  achievement_id: string;
  progress: number;
  target: number;
  completed: boolean;
  completed_at: string | null;
  updated_at: string;
}

export interface Streak {
  id: string;
  user_id: string;
  kind: string;
  current: number;
  longest: number;
  last_date: string | null;
  updated_at: string;
}

export interface Leaderboard {
  id: string;
  key: string;
  name: string;
  period: LeaderboardPeriod;
  scope: LeaderboardScope;
  metric: string;
  enabled: boolean;
  sort_order: number;
}

export interface LeaderboardEntry {
  id: string;
  leaderboard_id: string;
  user_id: string;
  period_key: string;
  scope_value: string;
  score: number;
  rank: number;
  updated_at: string;
}

export interface WeeklyChallenge {
  id: string;
  week_start: string;
  key: string;
  title: string;
  description: string | null;
  metric: string;
  target: number;
  xp_reward: number;
  icon: string | null;
  active: boolean;
  created_at: string;
}

export interface ChallengeProgress {
  id: string;
  challenge_id: string;
  user_id: string;
  progress: number;
  target: number;
  completed: boolean;
  completed_at: string | null;
  updated_at: string;
}

export interface Team {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  badge: string | null;
  color: string | null;
  owner_id: string | null;
  points: number;
  created_at: string;
}

export interface TeamMember {
  id: string;
  team_id: string;
  user_id: string;
  role: "owner" | "admin" | "member";
  joined_at: string;
}

export interface Season {
  id: string;
  number: number;
  name: string;
  theme: string | null;
  starts_on: string;
  ends_on: string;
  active: boolean;
  created_at: string;
}

export interface SeasonReward {
  id: string;
  season_id: string;
  rank_min: number;
  rank_max: number;
  title: string;
  reward_type: string;
  reward_value: Record<string, unknown>;
  sort_order: number;
}

export interface FitnessScore {
  id: string;
  user_id: string;
  score_date: string;
  score: number;
  breakdown: Record<string, unknown>;
  created_at: string;
}

export interface RewardCatalogItem {
  id: string;
  key: string;
  name: string;
  description: string | null;
  type: RewardType;
  value: Record<string, unknown>;
  cost_coins: number;
  icon: string | null;
  enabled: boolean;
  sort_order: number;
  created_at: string;

  // Ödül Merkezi (migration 0043)
  image_url: string | null;
  long_description: string | null;
  category: string | null;
  fulfillment_type: RewardFulfillment;
  req_xp: number;
  req_level: number;
  req_badge_id: string | null;
  req_achievement_id: string | null;
  req_challenge_id: string | null;
  req_team_level: number;
  stock: number | null;          // null = sınırsız
  expires_at: string | null;
  terms: string | null;
  coupon_code: string | null;
  external_url: string | null;
  sponsor_name: string | null;
  sponsor_logo_url: string | null;
  featured: boolean;
  updated_at: string;
}

export type RewardFulfillment = "digital" | "coupon" | "physical";

/** Ödül talep durumları. Eski 'active'/'consumed' satırları da desteklenir. */
export type RewardClaimStatus =
  | "pending" | "approved" | "rejected" | "delivered" | "cancelled" | "shipped"
  | "active" | "consumed";

/** Kullanıcının bir ödüle uygunluğu; uygun değilse net sebepler. */
export interface RewardEligibility {
  eligible: boolean;
  reasons: string[];
}

export interface RewardClaim {
  id: string;
  user_id: string;
  reward_id: string;
  status: RewardClaimStatus;
  meta: Record<string, unknown>;
  claimed_at: string;

  // Ödül Merkezi (migration 0043)
  spent_coins: number;
  spent_xp: number;
  admin_note: string | null;
  decided_by: string | null;
  decided_at: string | null;
  delivered_at: string | null;
  coupon_issued: string | null;
}

/** sync_gamification RPC dönüşü. */
export interface SyncGamificationResult {
  total_xp: number;
  level: number;
  prev_level: number;
  leveled_up: boolean;
  fitness_score: number;
  current_streak: number;
  longest_streak: number;
}

/** Liderlik satırı (kullanıcı bilgisiyle zenginleştirilmiş). */
export interface LeaderboardRow {
  user_id: string;
  full_name: string | null;
  avatar_url: string | null;
  country: string | null;
  city: string | null;
  score: number;
  level: number;
  rank: number;
  /** Güncel gün serisi (streak). */
  streak: number;
  /** Önceki döneme göre sıra değişimi: + yükseldi, − düştü, 0 aynı, null yeni. */
  delta: number | null;
}

// ============================================================================
// Production hardening (Sprint 10) — settings / push / logs / billing / GDPR
// ============================================================================
export interface UserSettings {
  user_id: string;
  theme: "system" | "light" | "dark";
  locale: "tr" | "en";
  units: "metric" | "imperial";
  notif_prefs: Record<string, boolean>;
  privacy: Record<string, boolean>;
  updated_at: string;
}

export interface PushToken {
  id: string;
  user_id: string;
  token: string;
  platform: "web" | "ios" | "android";
  active: boolean;
  created_at: string;
}

export interface ErrorLog {
  id: string;
  message: string;
  stack: string | null;
  where_at: string | null;
  severity: "info" | "warning" | "error" | "fatal";
  user_id: string | null;
  extra: Record<string, unknown>;
  created_at: string;
}

export interface BillingEvent {
  id: string;
  event_id: string;
  provider: string;
  type: string;
  user_id: string | null;
  payload: Record<string, unknown>;
  created_at: string;
}

export interface AccountDeletionRequest {
  id: string;
  user_id: string;
  reason: string | null;
  status: "pending" | "processed" | "canceled";
  requested_at: string;
  processed_at: string | null;
}

// ============================================================================
// AI Dietitian (Sprint 11) — score / preferences / memory / analysis / recipes
// ============================================================================
export interface NutritionScoreRow {
  id: string;
  user_id: string;
  score_date: string;
  score: number;
  breakdown: Record<string, number>;
  ai_comment: string | null;
  created_at: string;
}

export interface NutritionPreferences {
  user_id: string;
  activity_level: string | null;
  weekly_training: number | null;
  daily_steps: number | null;
  sleep_hours: number | null;
  meals_per_day: number | null;
  dietary_preference: string | null;
  allergies: string[];
  disliked_foods: string[];
  favorite_foods: string[];
  supplements: string[];
  digestion_issues: string[];
  health_notes: string | null;
  budget_weekly: number | null;
  cooks_at_home: boolean | null;
  work_hours: string | null;
  target_weight_kg: number | null;
  updated_at: string;
}

export interface NutritionMemory {
  id: string;
  user_id: string;
  fact: string;
  source: "ai" | "user";
  created_at: string;
}

export interface MealAnalysisItem { name: string; grams?: number; calories?: number; protein_g?: number; carbs_g?: number; fat_g?: number; fiber_g?: number; }
export interface MealAnalysis {
  id: string;
  user_id: string;
  input_text: string;
  items: MealAnalysisItem[];
  calories: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  fiber_g: number;
  score: number;
  assessment: string | null;
  alternatives: string[];
  source: "ai" | "rule";
  created_at: string;
}

export interface RecipeHistory {
  id: string;
  user_id: string;
  recipe_id: string | null;
  title: string;
  source: "cms" | "pantry" | "ai";
  meta: Record<string, unknown>;
  created_at: string;
}

// ============================================================================
// Exercise Media Set (Sprint 12) — per-egzersiz konsolide medya kaydı
// ============================================================================
export type ExerciseMediaStatus = "complete" | "partial" | "none";
export interface ExerciseMediaSet {
  id: string;
  exercise_id: string;
  thumbnail_url: string | null;
  gif_url: string | null;
  video_url: string | null;
  male_gif: string | null;
  female_gif: string | null;
  male_video: string | null;
  female_video: string | null;
  status: ExerciseMediaStatus;
  updated_at: string;
}

/** Admin medya listesi satırı (egzersiz + medya seti). */
export interface ExerciseMediaListRow {
  exercise_id: string;
  name: string;
  category: string;
  muscle_group: string;
  thumbnail_url: string | null;
  gif_url: string | null;
  video_url: string | null;
  male_gif: string | null;
  female_gif: string | null;
  male_video: string | null;
  female_video: string | null;
  status: ExerciseMediaStatus;
}

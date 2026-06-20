import React, { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  LayoutAnimation,
  Platform,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  UIManager,
  View,
} from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';
import { C } from '../../../styles/GlobalStyles';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

const MEALS = [
  { key: 'breakfast', label: 'Breakfast', short: 'B', weight: 0.25, color: C.amber },
  { key: 'morning_snack', label: 'Morning Snack', short: 'MS', weight: 0.1, color: '#6E8F78' },
  { key: 'lunch', label: 'Lunch', short: 'L', weight: 0.3, color: '#426F85' },
  { key: 'evening_snack', label: 'Evening Snack', short: 'ES', weight: 0.1, color: '#9B6F7A' },
  { key: 'dinner', label: 'Dinner', short: 'D', weight: 0.25, color: C.sage },
];

// Get current meal type based on hour (matches backend logic)
function getCurrentMealType(): string {
  const hour = new Date().getHours();
  if (hour >= 6 && hour < 9) return 'breakfast';
  if (hour >= 9 && hour < 11) return 'morning_snack';
  if (hour >= 11 && hour < 14) return 'lunch';
  if (hour >= 14 && hour < 18) return 'evening_snack';
  return 'dinner';
}

const MACROS = [
  { key: 'protein', label: 'Protein', unit: 'g', color: C.sage },
  { key: 'carbs', label: 'Carbs', unit: 'g', color: C.amber },
  { key: 'fat', label: 'Fat', unit: 'g', color: '#8F6B9B' },
  { key: 'fibre', label: 'Fibre', unit: 'g', color: '#4D7D92' },
];

function pct(value: number, target: number) {
  return target > 0 ? Math.min(value / target, 1) : 0;
}

function CalorieRing({ value, goal, over }: { value: number; goal: number; over: boolean }) {
  const size = 140;
  const stroke = 10;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const progress = Math.min(value / Math.max(goal, 1), 1);
  const displayPct = Math.round((value / Math.max(goal, 1)) * 100);

  const fillColor = over ? C.error : '#6BAE8E'; // muted sage green when on-track, red when over

  return (
    <View style={styles.ringContainer}>
      <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        {/* Grey background track */}
        <Circle cx={size / 2} cy={size / 2} r={r} stroke="#D8D8E0" strokeWidth={stroke} fill="none" />
        {/* Green/red filled arc */}
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke={fillColor}
          strokeWidth={stroke}
          fill="none"
          strokeLinecap="round"
          strokeDasharray={`${progress * c} ${c}`}
          strokeDashoffset={-c / 4}
          transform={`rotate(-90, ${size / 2}, ${size / 2})`}
        />
      </Svg>
      <View style={styles.ringCenter}>
        <Text style={[styles.ringPercentage, { color: fillColor }]}>{displayPct}%</Text>
        <Text style={styles.ringLabel}>of daily goal</Text>
      </View>
    </View>
  );
}

function StatCard({ label, value, subtext, accent }: { label: string; value: string; subtext: string; accent?: boolean }) {
  return (
    <View style={[styles.statCard, accent && styles.statCardAccent]}>
      <Text style={styles.statCardLabel}>{label}</Text>
      <Text style={[styles.statCardValue, accent && styles.statCardValueAccent]}>{value}</Text>
      <Text style={styles.statCardSub}>{subtext}</Text>
    </View>
  );
}

function MacroBar({ label, value, target, unit, color }: { label: string; value: number; target: number; unit: string; color: string }) {
  const percentage = pct(value, target);
  const isOver = value > target;

  return (
    <View style={styles.macroItem}>
      <View style={styles.macroHeader}>
        <Text style={styles.macroLabel}>{label}</Text>
        <Text style={[styles.macroValue, { color: isOver ? C.error : color }]}>
          {value}<Text style={styles.macroUnit}>/{target}{unit}</Text>
        </Text>
      </View>
      <View style={styles.macroTrack}>
        <View style={[styles.macroFill, { width: `${percentage * 100}%`, backgroundColor: isOver ? C.error : color }]} />
      </View>
    </View>
  );
}

function ChevronIcon({ open }: { open: boolean }) {
  return (
    <Svg width={20} height={20} viewBox="0 0 24 24">
      <Path
        d={open ? 'M18 15l-6-6-6 6' : 'M6 9l6 6 6-6'}
        fill="none"
        stroke={C.ink3}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

export default function DailyTab({
  userData,
  todayData,
  status,
  isListening,
}: any) {
  const [openMeal, setOpenMeal] = useState<string | null>(null);

  if (!todayData) {
    return <View style={styles.center}><ActivityIndicator color={C.sage} /></View>;
  }

  const today = todayData.today ?? {};
  const apiUser = todayData.user ?? {};
  const consumed = today.calories_consumed ?? 0;
  const goal = today.calories_goal ?? 1800;
  const remaining = goal - consumed;
  const over = consumed > goal;
  const macroTargets = today.macro_targets ?? {};
  const macrosConsumed = today.macros_consumed ?? {};
  const breakdown = today.meal_breakdown ?? {};
  const userName = apiUser.name || userData?.name || 'there';

  const mealRows = useMemo(() => MEALS.map(meal => {
    const raw = breakdown[meal.key] ?? {};
    const calories = raw.calories ?? 0;
    const target = Math.round(goal * meal.weight);
    return { ...meal, calories, target, items: raw.items ?? [] };
  }), [breakdown, goal]);

  const currentMealKey = getCurrentMealType();
  const currentMeal = MEALS.find(m => m.key === currentMealKey);
  const nextMeal = currentMeal?.label ?? 'All meals logged';
  const mealsLogged = mealRows.filter(m => m.calories > 0).length;

  return (
    <ScrollView style={styles.root} showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 100 }}>
      <StatusBar barStyle="dark-content" backgroundColor={C.cream} />

      {/* Header Section */}
      <View style={styles.header}>
        <View>
          <Text style={styles.greeting}>Good day,</Text>
          <Text style={styles.userName}>{userName}</Text>
        </View>
        <View style={[styles.statusBadge, isListening && styles.statusBadgeActive]}>
          <View style={[styles.statusDot, isListening && styles.statusDotActive]} />
          <Text style={styles.statusText}>{isListening ? status : nextMeal}</Text>
        </View>
      </View>

      {/* Main Calorie Card */}
      <View style={styles.mainCard}>
        <View style={styles.mainCardContent}>
          <View style={styles.calorieInfo}>
            <Text style={styles.calorieLabel}>{over ? 'Over Budget' : 'Remaining'}</Text>
            <Text style={[styles.calorieValue, { color: over ? C.error : C.ink }]}>
              {Math.abs(remaining).toLocaleString()}
            </Text>
            <Text style={styles.calorieUnit}>calories</Text>
          </View>
          <CalorieRing value={consumed} goal={goal} over={over} />
        </View>

        <View style={styles.statsRow}>
          <StatCard label="Consumed" value={consumed.toLocaleString()} subtext={`/${goal.toLocaleString()}`} />
          <StatCard label="Meals Logged" value={`${mealsLogged}/5`} subtext="today" accent />
          <StatCard label="Burned" value="0" subtext="calories" />
        </View>
      </View>

      {/* Macros Section */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Macronutrients</Text>
        </View>
        <View style={styles.macrosCard}>
          {MACROS.map(m => (
            <MacroBar
              key={m.key}
              label={m.label}
              value={macrosConsumed[m.key] ?? 0}
              target={macroTargets[m.key] ?? 0}
              unit={m.unit}
              color={m.color}
            />
          ))}
        </View>
      </View>

      {/* Meals Section */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Today's Meals</Text>
         
        </View>
        <View style={styles.mealsCard}>
          {mealRows.map((meal, index) => {
            const open = openMeal === meal.key;
            const mealPct = pct(meal.calories, meal.target);
            const isOver = meal.calories > meal.target;
            const hasItems = meal.items.length > 0;

            return (
              <View key={meal.key}>
                <TouchableOpacity
                  activeOpacity={0.8}
                  style={[styles.mealRow, index === mealRows.length - 1 && styles.mealRowLast]}
                  onPress={() => {
                    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
                    setOpenMeal(open ? null : meal.key);
                  }}
                >
                  <View style={[styles.mealIcon, { backgroundColor: meal.calories > 0 ? meal.color : C.surface3 }]}>
                    <Text style={[styles.mealIconText, { color: meal.calories > 0 ? '#fff' : C.ink3 }]}>{meal.short}</Text>
                  </View>
                  <View style={styles.mealContent}>
                    <View style={styles.mealTop}>
                      <Text style={styles.mealName}>{meal.label}</Text>
                      <View style={styles.mealRight}>
                        <Text style={[styles.mealCalories, { color: isOver ? C.error : meal.calories > 0 ? C.ink : C.ink3 }]}>
                          {meal.calories > 0 ? `${meal.calories.toLocaleString()}` : '—'}
                        </Text>
                        <ChevronIcon open={open} />
                      </View>
                    </View>
                    <View style={styles.mealBarTrack}>
                      <View style={[styles.mealBarFill, {
                        width: `${mealPct * 100}%`,
                        backgroundColor: isOver ? C.error : meal.calories > 0 ? meal.color : C.surface3
                      }]} />
                    </View>
                    <Text style={styles.mealTarget}>Target: {meal.target.toLocaleString()} cal</Text>
                  </View>
                </TouchableOpacity>

                {open && (
                  <View style={styles.foodPanel}>
                    {hasItems ? (
                      meal.items.map((item: any, i: number) => (
                        <View key={`${item.food}-${i}`} style={styles.foodItem}>
                          <View style={styles.foodDot} />
                          <Text style={styles.foodName}>{item.food}</Text>
                          <Text style={styles.foodCalories}>{item.calories ?? 0} cal</Text>
                        </View>
                      ))
                    ) : (
                      <Text style={styles.emptyText}>No food logged yet</Text>
                    )}
                  </View>
                )}
              </View>
            );
          })}
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.cream },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: C.cream },

  // Header
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingHorizontal: 24,
    paddingTop: 60,
    paddingBottom: 20,
  },
  greeting: { color: C.ink3, fontSize: 14, fontWeight: '500' },
  userName: { color: C.ink, fontSize: 28, fontWeight: '700', marginTop: 4 },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: C.surface,
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: C.border,
  },
  statusBadgeActive: { borderColor: C.sage, backgroundColor: C.sageL },
  statusDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: C.ink4 },
  statusDotActive: { backgroundColor: C.sage },
  statusText: { color: C.ink2, fontSize: 12, fontWeight: '600' },

  // Main Card
  mainCard: {
    marginHorizontal: 20,
    backgroundColor: C.surface,
    borderRadius: 24,
    padding: 24,
    shadowColor: C.ink,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 12,
    elevation: 4,
  },
  mainCardContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 24,
  },
  calorieInfo: { flex: 1 },
  calorieLabel: { color: C.ink3, fontSize: 13, fontWeight: '500', marginBottom: 8 },
  calorieValue: { fontSize: 48, fontWeight: '700', letterSpacing: -1 },
  calorieUnit: { color: C.ink3, fontSize: 15, fontWeight: '500', marginTop: 4 },

  // Ring
  ringContainer: { position: 'relative', alignItems: 'center', justifyContent: 'center' },
  ringCenter: { position: 'absolute', alignItems: 'center' },
  ringPercentage: { fontSize: 24, fontWeight: '700' },
  ringLabel: { color: C.ink3, fontSize: 11, fontWeight: '500', marginTop: 2 },

  // Stats Row
  statsRow: { flexDirection: 'row', gap: 12 },
  statCard: {
    flex: 1,
    backgroundColor: C.surface2,
    borderRadius: 16,
    padding: 16,
    alignItems: 'center',
  },
  statCardAccent: { backgroundColor: C.sageL },
  statCardLabel: { color: C.ink3, fontSize: 11, fontWeight: '500', marginBottom: 6 },
  statCardValue: { fontSize: 20, fontWeight: '700', color: C.ink },
  statCardValueAccent: { color: C.sage },
  statCardSub: { color: C.ink3, fontSize: 11, fontWeight: '500', marginTop: 2 },

  // Section
  section: { marginTop: 28, paddingHorizontal: 20 },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  sectionTitle: { fontSize: 18, fontWeight: '700', color: C.ink },
  sectionSubtitle: { fontSize: 13, color: C.ink3, fontWeight: '500' },

  // Macros
  macrosCard: {
    backgroundColor: C.surface,
    borderRadius: 20,
    padding: 20,
    shadowColor: C.ink,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 12,
    elevation: 4,
  },
  macroItem: { marginBottom: 16 },
  macroHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  macroLabel: { fontSize: 14, fontWeight: '600', color: C.ink2 },
  macroValue: { fontSize: 16, fontWeight: '700' },
  macroUnit: { fontSize: 12, fontWeight: '500', color: C.ink3 },
  macroTrack: {
    height: 8,
    backgroundColor: C.surface3,
    borderRadius: 4,
    overflow: 'hidden',
  },
  macroFill: { height: '100%', borderRadius: 4 },

  // Meals
  mealsCard: {
    backgroundColor: C.surface,
    borderRadius: 20,
    padding: 16,
    shadowColor: C.ink,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 12,
    elevation: 4,
  },
  mealRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: C.border,
  },
  mealRowLast: { borderBottomWidth: 0 },
  mealIcon: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  mealIconText: { fontSize: 13, fontWeight: '700' },
  mealContent: { flex: 1 },
  mealTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  mealName: { fontSize: 15, fontWeight: '600', color: C.ink },
  mealRight: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  mealCalories: { fontSize: 14, fontWeight: '700' },
  mealBarTrack: {
    height: 6,
    backgroundColor: C.surface3,
    borderRadius: 3,
    overflow: 'hidden',
  },
  mealBarFill: { height: '100%', borderRadius: 3 },
  mealTarget: { fontSize: 11, color: C.ink3, marginTop: 6, fontWeight: '500' },

  // Food Panel
  foodPanel: {
    backgroundColor: C.surface2,
    borderRadius: 3,
    padding: 12,
    marginLeft: 0,
    marginBottom: 8,
  },
  foodItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
  },
  foodDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: C.sage,
    marginRight: 10,
  },
  foodName: { flex: 1, fontSize: 14, color: C.ink2, fontWeight: '500' },
  foodCalories: { fontSize: 13, fontWeight: '600', color: C.ink },
  emptyText: {
    color: C.ink3,
    fontSize: 13,
    textAlign: 'center',
    paddingVertical: 16,
    fontStyle: 'italic',
  },
});

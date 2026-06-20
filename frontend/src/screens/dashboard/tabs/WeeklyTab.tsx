import React from 'react';
import {
  ActivityIndicator,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import Svg, { Circle, Polyline, Line } from 'react-native-svg';
import { C } from '../../../styles/GlobalStyles';

const GREEN = C.sage;
const RED = C.error;
const AMBER = C.amber;

function clampPct(value: number) {
  return `${Math.min(Math.max(value, 0), 1) * 100}%`;
}

function SparklineChart({ values, goal }: { values: number[]; goal: number }) {
  const width = 320;
  const height = 100;
  const max = Math.max(goal * 1.2, ...values, 1);
  const points = values.map((v, i) => {
    const x = values.length <= 1 ? width / 2 : (i / (values.length - 1)) * width;
    const y = height - (v / max) * (height - 20) - 10;
    return `${x},${y}`;
  }).join(' ');

  const goalY = height - (goal / max) * (height - 20) - 10;

  return (
    <View style={styles.chartContainer}>
      <Svg width="100%" height={height} viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none">
        {/* Goal line */}
        <Line x1="0" y1={goalY} x2={width} y2={goalY} stroke={C.border2} strokeWidth="1.5" strokeDasharray="4 4" />
        {/* Chart line */}
        <Polyline points={points} fill="none" stroke={GREEN} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
        {/* Data points */}
        {values.map((v, i) => {
          const x = values.length <= 1 ? width / 2 : (i / (values.length - 1)) * width;
          const y = height - (v / max) * (height - 20) - 10;
          return <Circle key={i} cx={x} cy={y} r="4" fill={v > goal ? RED : GREEN} />;
        })}
      </Svg>
    </View>
  );
}

function SummaryCard({ label, value, sub, color = C.ink }: { label: string; value: string; sub: string; color?: string }) {
  return (
    <View style={styles.summaryCard}>
      <Text style={styles.summaryLabel}>{label}</Text>
      <Text style={[styles.summaryValue, { color }]} numberOfLines={1} adjustsFontSizeToFit>{value}</Text>
      <Text style={styles.summarySub}>{sub}</Text>
    </View>
  );
}

function DayBar({ day, calories, goal, maxCalories }: { day: string; calories: number; goal: number; maxCalories: number }) {
  const isOver = calories > goal;
  const hasData = calories > 0;
  const barHeight = maxCalories > 0 ? (calories / maxCalories) * 100 : 0;
  const goalPosition = maxCalories > 0 ? (goal / maxCalories) * 100 : 0;

  return (
    <View style={styles.dayBarContainer}>
      <View style={styles.dayBarTrack}>
        {hasData && (
          <View style={[
            styles.dayBarFill,
            { height: `${Math.min(barHeight, 100)}%` },
            { backgroundColor: isOver ? RED : GREEN }
          ]} />
        )}
        {/* Goal marker */}
        <View style={[styles.goalMarker, { bottom: `${goalPosition}%` }]} />
      </View>
      <Text style={[styles.dayLabel, hasData ? styles.dayLabelActive : {}]}>{day}</Text>
      <Text style={[styles.dayValue, isOver && styles.dayValueOver]}>{hasData ? calories.toLocaleString() : '—'}</Text>
    </View>
  );
}

export default function WeeklyTab({ weeklyData, userData }: any) {
  if (!weeklyData?.week) {
    return <View style={styles.center}><ActivityIndicator color={GREEN} /></View>;
  }

  const week = weeklyData.week;
  const calories: number[] = week.calories ?? [];
  const days: string[] = week.days ?? ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  const dailyGoal = week.calorie_goal ?? userData?.goals?.target_calories ?? 1800;
  const weeklyGoal = week.weekly_goal ?? dailyGoal * 7;
  const total = week.total_calories ?? calories.reduce((sum, val) => sum + val, 0);
  const available = week.calories_available ?? Math.max(weeklyGoal - total, 0);
  const over = total > weeklyGoal;
  const progress = total / Math.max(weeklyGoal, 1);
  const avg = calories.length ? Math.round(total / calories.length) : 0;
  const loggedDays = calories.filter(v => v > 0).length;
  const projected = week.projected_weight_change ?? 0;
  const prediction = week.monthly_weight_prediction;
  const maxCalories = Math.max(...calories, dailyGoal * 1.2, 1);

  const avgVsGoal = avg - dailyGoal;

  return (
    <ScrollView style={styles.root} showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 100 }}>
      <StatusBar barStyle="dark-content" backgroundColor={C.cream} />

      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Weekly Overview</Text>
        <Text style={styles.headerSubtitle}>Track your progress over time</Text>
      </View>

      {/* Progress Card */}
      <View style={styles.progressCard}>
        <View style={styles.progressHeader}>
          <View>
            <Text style={styles.progressLabel}>{over ? 'Over Budget' : 'Remaining'}</Text>
            <Text style={[styles.progressValue, { color: over ? RED : GREEN }]}>
              {Math.abs(available).toLocaleString()}
            </Text>
            <Text style={styles.progressUnit}>calories this week</Text>
          </View>
          <View style={[styles.progressRing, { borderColor: over ? RED : GREEN }]}>
            <Text style={[styles.progressPercent, { color: over ? RED : GREEN }]}>{Math.round(progress * 100)}%</Text>
            <Text style={styles.progressRingLabel}>used</Text>
          </View>
        </View>

        {/* Progress bar */}
        <View style={styles.progressTrack}>
          <View style={[styles.progressFill, { width: clampPct(progress) as any, backgroundColor: over ? RED : GREEN }]} />
        </View>

        <View style={styles.progressMeta}>
          <Text style={styles.progressMetaText}><Text style={styles.progressMetaBold}>{total.toLocaleString()}</Text> eaten</Text>
          <Text style={styles.progressMetaText}><Text style={styles.progressMetaBold}>{weeklyGoal.toLocaleString()}</Text> weekly target</Text>
        </View>
      </View>

      {/* Summary Cards */}
      <View style={styles.summaryRow}>
        <SummaryCard label="Daily Average" value={avg.toLocaleString()} sub="calories" color={avgVsGoal > 0 ? AMBER : GREEN} />
        <SummaryCard label="Days Logged" value={`${loggedDays}/7`} sub="this week" color={GREEN} />
        <SummaryCard
          label="Projected"
          value={`${Math.abs(projected).toFixed(1)}`}
          sub={projected < 0 ? 'kg loss/week' : 'kg gain/week'}
          color={projected < 0 ? GREEN : AMBER}
        />
      </View>

      {/* Chart Section */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Calorie Trend</Text>
          <Text style={styles.sectionSubtitle}>Daily goal: {dailyGoal.toLocaleString()} cal</Text>
        </View>
        <View style={styles.chartCard}>
          <SparklineChart values={calories} goal={dailyGoal} />
        </View>
      </View>

      {/* Daily Bars Section */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Daily Breakdown</Text>
        </View>
        <View style={styles.barsCard}>
          <View style={styles.dayBarsRow}>
            {calories.map((cal, index) => (
              <DayBar
                key={index}
                day={days[index]?.charAt(0) ?? '-'}
                calories={cal}
                goal={dailyGoal}
                maxCalories={maxCalories}
              />
            ))}
          </View>
          <View style={styles.legend}>
            <View style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: GREEN }]} />
              <Text style={styles.legendText}>Under goal</Text>
            </View>
            <View style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: RED }]} />
              <Text style={styles.legendText}>Over goal</Text>
            </View>
            <View style={styles.legendItem}>
              <View style={styles.legendLine} />
              <Text style={styles.legendText}>Goal line</Text>
            </View>
          </View>
        </View>
      </View>

      {/* Weight Prediction */}
      {prediction?.available && prediction.points?.length > 0 && (
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Weight Projection</Text>
            
          </View>
          <View style={styles.weightCard}>
            <View style={styles.weightPoints}>
              {prediction.points.map((point: any) => (
                <View key={point.label} style={styles.weightPoint}>
                  <Text style={styles.weightValue}>{point.weight.toFixed(1)}</Text>
                  <View style={[
                    styles.weightStem,
                    { height: point.type === 'actual' ? 80 : 60 },
                    { backgroundColor: point.type === 'actual' ? GREEN : C.border2 }
                  ]} />
                  <Text style={styles.weightLabel}>{point.label}</Text>
                </View>
              ))}
            </View>
          </View>
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.cream },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: C.cream },

  // Header
  header: { paddingHorizontal: 24, paddingTop: 60, paddingBottom: 20 },
  headerTitle: { fontSize: 28, fontWeight: '700', color: C.ink },
  headerSubtitle: { fontSize: 14, color: C.ink3, marginTop: 4 },

  // Progress Card
  progressCard: {
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
  progressHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 20,
  },
  progressLabel: { color: C.ink3, fontSize: 13, fontWeight: '500', marginBottom: 8 },
  progressValue: { fontSize: 40, fontWeight: '700' },
  progressUnit: { color: C.ink3, fontSize: 14, fontWeight: '500', marginTop: 4 },
  progressRing: {
    width: 80,
    height: 80,
    borderRadius: 40,
    borderWidth: 3,
    alignItems: 'center',
    justifyContent: 'center',
  },
  progressPercent: { fontSize: 22, fontWeight: '700' },
  progressRingLabel: { color: C.ink3, fontSize: 10, fontWeight: '600', marginTop: 2 },
  progressTrack: {
    height: 10,
    backgroundColor: C.surface3,
    borderRadius: 5,
    overflow: 'hidden',
  },
  progressFill: { height: '100%', borderRadius: 5 },
  progressMeta: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 12,
  },
  progressMetaText: { color: C.ink3, fontSize: 13 },
  progressMetaBold: { color: C.ink, fontWeight: '700' },

  // Summary Row
  summaryRow: {
    flexDirection: 'row',
    gap: 12,
    marginHorizontal: 20,
    marginTop: 16,
  },
  summaryCard: {
    flex: 1,
    backgroundColor: C.surface,
    borderRadius: 16,
    padding: 16,
    alignItems: 'center',
    shadowColor: C.ink,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 12,
    elevation: 4,
  },
  summaryLabel: { color: C.ink3, fontSize: 11, fontWeight: '500', marginBottom: 6 },
  summaryValue: { fontSize: 20, fontWeight: '700' },
  summarySub: { color: C.ink3, fontSize: 11, fontWeight: '500', marginTop: 2 },

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

  // Chart
  chartCard: {
    backgroundColor: C.surface,
    borderRadius: 20,
    padding: 16,
    shadowColor: C.ink,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 12,
    elevation: 4,
  },
  chartContainer: { height: 100 },

  // Day Bars
  barsCard: {
    backgroundColor: C.surface,
    borderRadius: 20,
    padding: 20,
    shadowColor: C.ink,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 12,
    elevation: 4,
  },
  dayBarsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'flex-end',
    height: 140,
  },
  dayBarContainer: { alignItems: 'center', flex: 1 },
  dayBarTrack: {
    width: 24,
    height: 100,
    backgroundColor: C.surface3,
    borderRadius: 12,
    overflow: 'hidden',
    position: 'relative',
  },
  dayBarFill: {
    width: '100%',
    borderRadius: 12,
    position: 'absolute',
    bottom: 0,
  },
  goalMarker: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: 2,
    backgroundColor: C.amber,
  },
  dayLabel: {
    fontSize: 12,
    color: C.ink3,
    marginTop: 8,
    fontWeight: '500',
  },
  dayLabelActive: { color: C.ink, fontWeight: '700' },
  dayValue: { fontSize: 10, color: C.ink3, marginTop: 2 },
  dayValueOver: { color: RED },

  // Legend
  legend: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 20,
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: C.border,
  },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  legendDot: { width: 8, height: 8, borderRadius: 4 },
  legendLine: { width: 12, height: 2, backgroundColor: C.amber },
  legendText: { fontSize: 11, color: C.ink3 },

  // Weight
  weightCard: {
    backgroundColor: C.surface,
    borderRadius: 20,
    padding: 20,
    shadowColor: C.ink,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 12,
    elevation: 4,
  },
  weightPoints: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'flex-end',
    height: 120,
  },
  weightPoint: { alignItems: 'center', flex: 1 },
  weightValue: { fontSize: 14, fontWeight: '700', color: C.ink, marginBottom: 8 },
  weightStem: {
    width: 24,
    borderRadius: 12,
  },
  weightLabel: { fontSize: 12, color: C.ink3, marginTop: 8, fontWeight: '500' },
});

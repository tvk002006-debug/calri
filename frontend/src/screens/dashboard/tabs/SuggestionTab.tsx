import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  Animated,
} from 'react-native';
import { BASE_URL } from '../../../config/api';
import { C } from '../../../styles/GlobalStyles';

const GREEN = C.sage;
const RED = C.error;
const AMBER = C.amber;

function getTypeColor(type?: string) {
  switch (type) {
    case 'warn': return RED;
    case 'good': return GREEN;
    case 'info':
    default: return AMBER;
  }
}

function getTypeIcon(type?: string) {
  switch (type) {
    case 'warn': return '!';
    case 'good': return '✓';
    case 'info':
    default: return 'i';
  }
}

function StatusBadge({ type, text }: { type: string; text: string }) {
  const color = getTypeColor(type);
  return (
    <View style={[styles.statusBadge, { backgroundColor: `${color}15`, borderColor: `${color}40` }]}>
      <Text style={[styles.statusBadgeIcon, { color }]}>{getTypeIcon(type)}</Text>
      <Text style={[styles.statusBadgeText, { color }]}>{text}</Text>
    </View>
  );
}

function FoodSuggestionCard({ item }: { item: any; index: number }) {
  return (
    <View style={styles.foodCard}>
      <View style={styles.foodCardHeader}>
        <View style={styles.foodIcon}>
          <Text style={styles.foodEmoji}>🍽️</Text>
        </View>
        <View style={styles.foodInfo}>
          <Text style={styles.foodName}>{item.food}</Text>
          <View style={styles.foodMeta}>
            <Text style={styles.foodMeal}>{item.meal}</Text>
            <Text style={styles.foodDivider}>•</Text>
            <Text style={styles.foodCalories}>{item.calories} cal</Text>
          </View>
        </View>
      </View>
      <Text style={styles.foodReason}>{item.reason}</Text>
    </View>
  );
}

function InsightCard({ item }: { item: any }) {
  const color = getTypeColor(item.type);
  return (
    <View style={styles.insightCard}>
      <View style={[styles.insightIcon, { backgroundColor: `${color}15` }]}>
        <Text style={[styles.insightIconText, { color }]}>{getTypeIcon(item.type)}</Text>
      </View>
      <View style={styles.insightContent}>
        <Text style={[styles.insightType, { color }]}>{(item.type || 'info').toUpperCase()}</Text>
        <Text style={styles.insightText}>{item.text}</Text>
      </View>
    </View>
  );
}

function TipCard({ tip, index }: { tip: any; index: number }) {
  return (
    <View style={styles.tipCard}>
      <View style={styles.tipNumber}>
        <Text style={styles.tipNumberText}>{index + 1}</Text>
      </View>
      <View style={styles.tipContent}>
        <Text style={styles.tipTitle}>{tip.title}</Text>
        <Text style={styles.tipBody}>{tip.body}</Text>
      </View>
    </View>
  );
}

function ProgressBar({ consumed, target }: { consumed: number; target: number }) {
  const percentage = Math.min((consumed / Math.max(target, 1)) * 100, 100);
  const over = consumed > target;
  const color = over ? RED : GREEN;

  return (
    <View style={styles.progressContainer}>
      <View style={styles.progressTrack}>
        <View style={[styles.progressFill, { width: `${percentage}%`, backgroundColor: color }]} />
      </View>
      <View style={styles.progressLabels}>
        <Text style={styles.progressLabel}>{consumed.toLocaleString()} eaten</Text>
        <Text style={styles.progressLabel}>{target.toLocaleString()} goal</Text>
      </View>
    </View>
  );
}

// Expandable Section Component
function ExpandableSection({
  title,
  subtitle,
  children,
  defaultExpanded = false,
}: {
  title: string;
  subtitle: string;
  children: React.ReactNode;
  defaultExpanded?: boolean;
}) {
  const [expanded, setExpanded] = useState(defaultExpanded);
  const rotateAnim = useState(new Animated.Value(expanded ? 1 : 0))[0];

  const toggle = () => {
    setExpanded(!expanded);
    Animated.spring(rotateAnim, {
      toValue: expanded ? 0 : 1,
      useNativeDriver: true,
      friction: 8,
    }).start();
  };

  const rotate = rotateAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '180deg'],
  });

  return (
    <View style={styles.section}>
      <TouchableOpacity style={styles.sectionHeader} onPress={toggle} activeOpacity={0.7}>
        <View>
          <Text style={styles.sectionTitle}>{title}</Text>
          <Text style={styles.sectionSubtitle}>{subtitle}</Text>
        </View>
        <Animated.View style={[styles.chevron, { transform: [{ rotate }] }]}>
          <Text style={styles.chevronText}>▼</Text>
        </Animated.View>
      </TouchableOpacity>
      {expanded && <View style={styles.sectionContent}>{children}</View>}
    </View>
  );
}

function Skeleton({ width, height, borderRadius, style }: any) {
  const anim = useState(new Animated.Value(0.3))[0];

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(anim, { toValue: 0.7, duration: 800, useNativeDriver: true }),
        Animated.timing(anim, { toValue: 0.3, duration: 800, useNativeDriver: true }),
      ])
    ).start();
  }, []);

  return (
    <Animated.View
      style={[
        {
          width,
          height,
          borderRadius: borderRadius || 8,
          backgroundColor: C.surface3,
          opacity: anim,
        },
        style,
      ]}
    />
  );
}

function SuggestionSkeleton() {
  return (
    <View style={styles.root}>
      <StatusBar barStyle="dark-content" backgroundColor={C.cream} />
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Coach</Text>
        <Text style={styles.headerSubtitle}>Preparing your recommendations...</Text>
      </View>
      
      <View style={styles.statusCard}>
        <Skeleton width="50%" height={24} style={{ marginBottom: 16 }} />
        <Skeleton width="80%" height={36} style={{ marginBottom: 24 }} />
        <Skeleton width="100%" height={8} borderRadius={4} style={{ marginBottom: 12 }} />
        <Skeleton width="30%" height={12} />
      </View>

      <View style={styles.section}>
        <Skeleton width="40%" height={20} style={{ marginBottom: 16 }} />
        <View style={styles.foodsContainer}>
          {[1, 2, 3].map(i => (
            <View key={i} style={styles.foodCard}>
              <View style={styles.foodCardHeader}>
                <Skeleton width={44} height={44} borderRadius={12} style={{ marginRight: 12 }} />
                <View style={{ flex: 1, gap: 8 }}>
                  <Skeleton width="70%" height={16} />
                  <Skeleton width="40%" height={12} />
                </View>
              </View>
              <Skeleton width="90%" height={12} style={{ marginTop: 8 }} />
            </View>
          ))}
        </View>
      </View>
    </View>
  );
}

export default function SuggestionTab({ phone }: any) {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [profile, setProfile] = useState<any>(null);
  const [insights, setInsights] = useState<any[]>([]);
  const [foodSuggestions, setFoodSuggestions] = useState<any[]>([]);
  const [healthyTips, setHealthyTips] = useState<any[]>([]);
  const [error, setError] = useState('');

  const loadSuggestions = useCallback(async () => {
    if (!phone) return;
    try {
      setError('');
      const res = await fetch(`${BASE_URL}/user/${phone}/ai-suggestions`);
      const data = await res.json();
      setProfile(data.profile ?? null);
      setInsights(data.insights ?? []);
      setFoodSuggestions(data.food_suggestions ?? []);
      setHealthyTips(data.healthy_tips ?? []);
      if (data.error) setError(data.error);
    } catch {
      setError('Could not load suggestions.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [phone]);

  useEffect(() => { loadSuggestions(); }, [loadSuggestions]);

  const onRefresh = () => {
    setRefreshing(true);
    loadSuggestions();
  };

  if (loading) {
    return <SuggestionSkeleton />;
  }

  const consumed = profile?.today_calories ?? 0;
  const target = profile?.target_calories ?? 0;
  const remaining = profile?.remaining_calories ?? 0;
  const over = remaining < 0;

  const statusType = over ? 'warn' : consumed > target * 0.8 ? 'info' : 'good';
  const statusText = over ? 'Over limit' : consumed > target * 0.8 ? 'Getting close' : 'On track';

  return (
    <ScrollView
      style={styles.root}
      showsVerticalScrollIndicator={false}
      contentContainerStyle={{ paddingBottom: 120 }}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={GREEN} />}
    >
      <StatusBar barStyle="dark-content" backgroundColor={C.cream} />

      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Coach</Text>
        <Text style={styles.headerSubtitle}>Personalized recommendations</Text>
      </View>

      {/* Error */}
      {!!error && (
        <View style={styles.errorPanel}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      )}

      {/* Today's Status Card - Always Visible */}
      {profile && (
        <View style={styles.statusCard}>
          <View style={styles.statusHeader}>
            <View>
              <Text style={styles.statusLabel}>Today's Progress</Text>
              <Text style={styles.statusTitle}>{over ? 'Slow Down' : 'Room to Plan'}</Text>
            </View>
            <StatusBadge type={statusType} text={statusText} />
          </View>

          <View style={styles.calorieDisplay}>
            <Text style={[styles.calorieValue, { color: over ? RED : GREEN }]}>
              {Math.abs(remaining).toLocaleString()}
            </Text>
            <Text style={styles.calorieUnit}>calories {over ? 'over' : 'remaining'}</Text>
          </View>

          <ProgressBar consumed={consumed} target={target} />
        </View>
      )}

      {/* Food Suggestions - Always Visible */}
      {foodSuggestions.length > 0 && (
        <View style={styles.section}>
          <View style={styles.sectionHeaderStatic}>
            <Text style={styles.sectionTitle}>Recommended Foods</Text>
            <Text style={styles.sectionSubtitle}>{foodSuggestions.length} suggestions</Text>
          </View>
          <View style={styles.foodsContainer}>
            {foodSuggestions.map((item, index) => (
              <FoodSuggestionCard key={`${item.food}-${index}`} item={item} index={index} />
            ))}
          </View>
        </View>
      )}

      {/* Insights - Collapsible */}
      {insights.length > 0 && (
        <ExpandableSection
          title="Insights"
          subtitle={`${insights.length} signals`}
        >
          <View style={styles.insightsContainer}>
            {insights.map((item, index) => (
              <InsightCard key={`${item.type}-${index}`} item={item} />
            ))}
          </View>
        </ExpandableSection>
      )}

      {/* Healthy Tips - Collapsible */}
      {healthyTips.length > 0 && (
        <ExpandableSection
          title="Daily Habits"
          subtitle={`${healthyTips.length} tips`}
        >
          <View style={styles.tipsContainer}>
            {healthyTips.map((tip, index) => (
              <TipCard key={`${tip.title}-${index}`} tip={tip} index={index} />
            ))}
          </View>
        </ExpandableSection>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.cream },
  center: { flex: 1, backgroundColor: C.cream, alignItems: 'center', justifyContent: 'center' },
  loadingText: { color: C.ink3, marginTop: 14, fontSize: 14, fontWeight: '500' },

  // Header
  header: { paddingHorizontal: 24, paddingTop: 60, paddingBottom: 20 },
  headerTitle: { fontSize: 28, fontWeight: '700', color: C.ink },
  headerSubtitle: { fontSize: 14, color: C.ink3, marginTop: 4 },

  // Error
  errorPanel: {
    marginHorizontal: 20,
    marginBottom: 16,
    backgroundColor: C.errorL,
    borderWidth: 1,
    borderColor: C.error,
    borderRadius: 12,
    padding: 16,
  },
  errorText: { color: C.error, fontSize: 13, fontWeight: '500', textAlign: 'center' },

  // Status Card
  statusCard: {
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
  statusHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  statusLabel: { color: C.ink3, fontSize: 13, fontWeight: '500' },
  statusTitle: { fontSize: 24, fontWeight: '700', color: C.ink, marginTop: 4 },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: 20,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  statusBadgeIcon: { fontSize: 12, fontWeight: '700' },
  statusBadgeText: { fontSize: 12, fontWeight: '600' },

  // Calorie Display
  calorieDisplay: { marginBottom: 16 },
  calorieValue: { fontSize: 36, fontWeight: '700' },
  calorieUnit: { fontSize: 14, color: C.ink3, fontWeight: '500', marginTop: 4 },

  // Progress
  progressContainer: { marginTop: 8 },
  progressTrack: {
    height: 8,
    backgroundColor: C.surface3,
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressFill: { height: '100%', borderRadius: 4 },
  progressLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 8,
  },
  progressLabel: { fontSize: 12, color: C.ink3, fontWeight: '500' },

  // Section (Collapsible)
  section: { marginTop: 16, marginHorizontal: 20 },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: C.surface,
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 14,
    shadowColor: C.ink,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 3,
  },
  sectionHeaderStatic: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: C.ink },
  sectionSubtitle: { fontSize: 13, color: C.ink3, fontWeight: '500', marginTop: 2 },
  chevron: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: C.surface2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chevronText: { fontSize: 12, color: C.ink3, fontWeight: '700' },
  sectionContent: { marginTop: 12 },

  // Foods
  foodsContainer: { gap: 12 },
  foodCard: {
    backgroundColor: C.surface,
    borderRadius: 16,
    padding: 16,
    shadowColor: C.ink,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 3,
  },
  foodCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  foodIcon: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: C.sageL,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  foodEmoji: { fontSize: 20 },
  foodInfo: { flex: 1 },
  foodName: { fontSize: 15, fontWeight: '600', color: C.ink },
  foodMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 4,
  },
  foodMeal: { fontSize: 12, color: C.sage, fontWeight: '600' },
  foodDivider: { fontSize: 12, color: C.ink3 },
  foodCalories: { fontSize: 12, color: C.ink3, fontWeight: '500' },
  foodReason: { fontSize: 13, color: C.ink2, lineHeight: 18 },

  // Insights
  insightsContainer: { gap: 10 },
  insightCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    backgroundColor: C.surface,
    borderRadius: 16,
    padding: 16,
    shadowColor: C.ink,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 3,
  },
  insightIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  insightIconText: { fontSize: 14, fontWeight: '700' },
  insightContent: { flex: 1 },
  insightType: { fontSize: 10, fontWeight: '700', letterSpacing: 0.5, marginBottom: 4 },
  insightText: { fontSize: 13, color: C.ink2, lineHeight: 18 },

  // Tips
  tipsContainer: { gap: 10 },
  tipCard: {
    flexDirection: 'row',
    gap: 12,
    backgroundColor: C.surface,
    borderRadius: 16,
    padding: 16,
    shadowColor: C.ink,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 3,
  },
  tipNumber: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: C.sageL,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tipNumberText: { fontSize: 14, fontWeight: '700', color: C.sage },
  tipContent: { flex: 1 },
  tipTitle: { fontSize: 14, fontWeight: '600', color: C.ink, marginBottom: 4 },
  tipBody: { fontSize: 13, color: C.ink2, lineHeight: 18 },
});

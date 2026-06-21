import React, { useState, useRef, useEffect } from 'react';
import { NotificationManager } from '../../utils/NotificationManager';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Platform,
  StyleSheet,
  Animated,
  StatusBar,
  useWindowDimensions,
  KeyboardAvoidingView,
  ScrollView,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BASE_URL } from '../../config/api';
import { C } from '../../styles/GlobalStyles';

interface FoodItem {
  food: string;
  calories: number;
  protein?: number;
  carbs?: number;
  fat?: number;
  fibre?: number;
  isCalculating?: boolean;
  error?: string;
}

interface Props {
  items: FoodItem[];
  total: number;
  meal_type: string;
  onConfirm: (editedItems: FoodItem[], editedTotal: number, mealType: string) => void;
  onCancel: () => void;
  onSpeak?: (text: string) => void;
  userName?: string;
  visible: boolean;
}

const MEAL_OPTIONS = [
  { key: 'breakfast', label: 'Breakfast', short: 'B' },
  { key: 'morning_snack', label: 'Morning Snack', short: 'MS' },
  { key: 'lunch', label: 'Lunch', short: 'L' },
  { key: 'evening_snack', label: 'Evening Snack', short: 'ES' },
  { key: 'dinner', label: 'Dinner', short: 'D' },
];

const MEAL_COLORS: Record<string, string> = {
  breakfast: '#C8820A',
  morning_snack: '#6E8F78',
  lunch: '#426F85',
  evening_snack: '#9B6F7A',
  dinner: '#3D6B4F',
};

// Estimate calories and macros from AI
async function estimateCalories(foodText: string): Promise<{ calories: number | null; protein?: number; carbs?: number; fat?: number; fibre?: number; error?: string }> {
  try {
    const res = await fetch(`${BASE_URL}/estimate-nutrition`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ food_text: foodText }),
    });
    if (!res.ok) return { calories: null, error: 'Failed to estimate' };
    const data = await res.json();
    const calories = data?.calories;
    if (!calories || calories === 0) {
      return { calories: null, error: 'Could not recognize food. Please check spelling or enter calories manually.' };
    }
    return {
      calories,
      protein: data?.protein ?? 0,
      carbs: data?.carbs ?? 0,
      fat: data?.fat ?? 0,
      fibre: data?.fibre ?? 0,
    };
  } catch {
    return { calories: null, error: 'Network error. Please try again.' };
  }
}

function buildSpeechPrompt(items: FoodItem[], total: number, mealType: string, userName?: string): string {
  const meal = MEAL_OPTIONS.find(m => m.key === mealType)?.label ?? mealType;
  const foods = items.map(i => i.food).join(', ');
  const name = userName ? ` ${userName}` : '';
  return (
    `User${name} just confirmed logging their ${meal}: ${foods} — ${total} kcal. ` +
    `In Tamil/Tanglish, acknowledge the log in one short sentence, then give 1–2 quick ` +
    `personalised diet or activity suggestions based on the meal. ` +
    `Keep it casual and under 3 sentences. No emojis.`
  );
}

// Loading dots animation
function LoadingDots() {
  const [dots, setDots] = useState('.');
  useEffect(() => {
    const interval = setInterval(() => {
      setDots(prev => (prev.length >= 3 ? '.' : prev + '.'));
    }, 400);
    return () => clearInterval(interval);
  }, []);
  return <Text style={styles.loadingText}>Calculating{dots}</Text>;
}

export default function ConfirmLogScreen({
  items,
  meal_type,
  onConfirm,
  onCancel,
  onSpeak,
  userName,
  visible,
}: Props) {
  const { height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const sheetMaxHeight = height * 0.92;
  const footerBottomPad = Math.max(insets.bottom, Platform.OS === 'android' ? 20 : 16);
  const [editedItems, setEditedItems] = useState<FoodItem[]>([]);
  const [mealType, setMealType] = useState(meal_type);
  const [hasSpoken, setHasSpoken] = useState(false);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [editValue, setEditValue] = useState('');
  const scrollViewRef = useRef<any>(null);
  const editInputRef = useRef<TextInput>(null);

  const slideAnim = useRef(new Animated.Value(height)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;

  const isAnyCalculating = editedItems.some(i => i.isCalculating);
  const hasErrors = editedItems.some(i => i.error);
  const allValid = editedItems.every(i => i.food.trim() && i.calories > 0 && !i.error);

  // Debounce timer ref
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const triggerCalculate = (index: number, foodText: string) => {
    if (debounceTimer.current) clearTimeout(debounceTimer.current);

    // Clear previous error
    setEditedItems(prev => {
      const next = [...prev];
      next[index] = { ...next[index], error: undefined };
      return next;
    });

    if (!foodText.trim()) return;

    // Show calculating state
    setEditedItems(prev => {
      const next = [...prev];
      next[index] = { ...next[index], isCalculating: true };
      return next;
    });

    debounceTimer.current = setTimeout(async () => {
      const result = await estimateCalories(foodText);
      setEditedItems(prev => {
        const next = [...prev];
        next[index] = {
          ...next[index],
          isCalculating: false,
          calories: result.calories ?? next[index].calories,
          protein: result.protein ?? next[index].protein ?? 0,
          carbs: result.carbs ?? next[index].carbs ?? 0,
          fat: result.fat ?? next[index].fat ?? 0,
          fibre: result.fibre ?? next[index].fibre ?? 0,
          error: result.error,
        };
        return next;
      });
    }, 800);
  };

  // Initialize items when visible changes
  useEffect(() => {
    if (visible) {
      setEditedItems(items.map(i => ({ ...i, isCalculating: false, error: undefined })));
      setMealType(meal_type);
      setHasSpoken(false);
      Animated.parallel([
        Animated.spring(slideAnim, { toValue: 0, useNativeDriver: true, friction: 8 }),
        Animated.timing(fadeAnim, { toValue: 1, duration: 200, useNativeDriver: true }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(slideAnim, { toValue: height, duration: 250, useNativeDriver: true }),
        Animated.timing(fadeAnim, { toValue: 0, duration: 200, useNativeDriver: true }),
      ]).start();
    }
  }, [visible, height, items, meal_type]);

  const updateFood = (idx: number, value: string) => {
    setEditedItems(prev => {
      const n = [...prev];
      n[idx] = { ...n[idx], food: value };
      return n;
    });
    triggerCalculate(idx, value);
  };

  const updateCalories = (idx: number, value: string) => {
    const num = parseInt(value, 10);
    setEditedItems(prev => {
      const n = [...prev];
      n[idx] = { ...n[idx], calories: isNaN(num) ? 0 : num, error: undefined };
      return n;
    });
  };

  const removeItem = (idx: number) => {
    setEditedItems(prev => prev.filter((_, i) => i !== idx));
  };

  const startEditing = (idx: number) => {
    setEditingIndex(idx);
    setEditValue(editedItems[idx]?.food || '');
    setTimeout(() => editInputRef.current?.focus(), 100);
  };

  const cancelEditing = () => {
    setEditingIndex(null);
    setEditValue('');
  };

  const confirmEdit = () => {
    if (editingIndex === null) return;
    const originalValue = editedItems[editingIndex]?.food || '';
    // Only call API if value actually changed
    if (editValue.trim() !== originalValue.trim()) {
      updateFood(editingIndex, editValue);
    }
    setEditingIndex(null);
    setEditValue('');
  };

  const addNewItem = () => {
    setEditedItems(prev => [...prev, { food: '', calories: 0 }]);
    // Scroll to bottom
    setTimeout(() => scrollViewRef.current?.scrollToEnd({ animated: true }), 100);
  };

  const editedTotal = editedItems.reduce((s, i) => s + (i.calories || 0), 0);
  const mealColor = MEAL_COLORS[mealType] || C.sage;
  const handleConfirm = () => {
    const valid = editedItems.filter(i => i.food.trim() && i.calories > 0 && !i.error);
    if (!valid.length) return;

    onConfirm(valid, editedTotal, mealType);

    // Cancel matching notification reminder since the user has logged the meal
    if (mealType === 'lunch') {
      NotificationManager.cancelReminder('lunch-reminder');
    } else if (mealType === 'dinner') {
      NotificationManager.cancelReminder('dinner-reminder');
    }

    if (onSpeak && !hasSpoken) {
      setHasSpoken(true);
      onSpeak(buildSpeechPrompt(valid, editedTotal, mealType, userName));
    }
  };

  if (!visible) return null;

  return (
    <View style={styles.overlay} pointerEvents={visible ? 'auto' : 'none'}>
      <StatusBar barStyle="dark-content" backgroundColor="rgba(20,18,14,0.4)" />

      {/* Backdrop */}
      <Animated.View style={[styles.backdrop, { opacity: fadeAnim }]}>
        <TouchableOpacity style={styles.backdropTouch} onPress={onCancel} activeOpacity={1} />
      </Animated.View>

      {/* Sheet */}
      <Animated.View style={[styles.sheet, { maxHeight: sheetMaxHeight, transform: [{ translateY: slideAnim }] }]}>
        {/* Handle bar */}
        <View style={styles.handleBar}>
          <View style={styles.handle} />
        </View>

        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <Text style={styles.headerTitle}>Confirm Food Log</Text>
            <Text style={styles.headerSubtitle}>Review and edit before saving</Text>
          </View>
          <TouchableOpacity style={styles.closeBtn} onPress={onCancel} activeOpacity={0.7}>
            <Text style={styles.closeText}>✕</Text>
          </TouchableOpacity>
        </View>

        {/* Scrollable content — meal type, items, add button */}
        <ScrollView
          ref={scrollViewRef}
          style={styles.scrollArea}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.mealSection}>
            <Text style={styles.sectionLabel}>Meal Type</Text>
            <View style={styles.mealGrid}>
              {MEAL_OPTIONS.map(opt => (
                <TouchableOpacity
                  key={opt.key}
                  style={[
                    styles.mealChip,
                    mealType === opt.key && { backgroundColor: MEAL_COLORS[opt.key] + '15', borderColor: MEAL_COLORS[opt.key] }
                  ]}
                  onPress={() => setMealType(opt.key)}
                  activeOpacity={0.8}
                >
                  <View style={[styles.mealChipIcon, { backgroundColor: MEAL_COLORS[opt.key] + '20' }]}>
                    <Text style={[styles.mealChipLetter, { color: MEAL_COLORS[opt.key] }]}>{opt.short}</Text>
                  </View>
                  <Text style={[
                    styles.mealChipText,
                    mealType === opt.key && { color: MEAL_COLORS[opt.key], fontWeight: '700' }
                  ]}>{opt.label}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {editedItems.map((item, idx) => (
            <View key={idx} style={styles.itemCardCompact}>
              {editingIndex === idx ? (
                <View style={styles.itemRow}>
                  <View style={styles.foodInputWrapper}>
                    <TextInput
                      ref={editInputRef}
                      style={[styles.foodInputCompact, item.error && styles.inputError]}
                      value={editValue}
                      onChangeText={setEditValue}
                      placeholder="Food name..."
                      placeholderTextColor={C.ink4}
                      returnKeyType="done"
                      onSubmitEditing={confirmEdit}
                    />
                  </View>
                  <TouchableOpacity style={styles.okBtn} onPress={confirmEdit} activeOpacity={0.8}>
                    <Text style={styles.okText}>OK</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.cancelEditBtn} onPress={cancelEditing} activeOpacity={0.8}>
                    <Text style={styles.cancelEditText}>✕</Text>
                  </TouchableOpacity>
                </View>
              ) : (
                <View style={styles.itemRow}>
                  <View style={styles.foodInputWrapper}>
                    <Text
                      numberOfLines={1}
                      ellipsizeMode="tail"
                      style={[styles.foodInputCompact, styles.readOnlyInput, { flex: 1 }]}
                    >
                      {item.food || 'Food name...'}
                    </Text>
                  </View>

                  <TextInput
                    style={[styles.calInputCompact, !item.calories && styles.inputEmpty]}
                    value={item.calories > 0 ? String(item.calories) : ''}
                    onChangeText={v => updateCalories(idx, v)}
                    keyboardType="numeric"
                    placeholder="0"
                    placeholderTextColor={C.ink4}
                    editable={!item.isCalculating}
                  />

                  <TouchableOpacity style={styles.editBtnCompact} onPress={() => startEditing(idx)} activeOpacity={0.8}>
                    <Text style={styles.editTextCompact}>✎</Text>
                  </TouchableOpacity>

                  <TouchableOpacity style={styles.removeBtnCompact} onPress={() => removeItem(idx)}>
                    <Text style={styles.removeTextCompact}>×</Text>
                  </TouchableOpacity>
                </View>
              )}

              {item.isCalculating && (
                <View style={styles.statusRow}>
                  <View style={styles.loadingDot} />
                  <LoadingDots />
                </View>
              )}
              {item.error && !item.isCalculating && (
                <Text style={styles.errorTextCompact}>{item.error}</Text>
              )}
            </View>
          ))}

          <TouchableOpacity style={styles.addBtn} onPress={addNewItem} activeOpacity={0.7}>
            <Text style={styles.addBtnIcon}>+</Text>
            <Text style={styles.addBtnText}>Add another food</Text>
          </TouchableOpacity>
        </ScrollView>

        {/* Footer — always pinned above system nav */}
        <View style={[styles.footer, { paddingBottom: footerBottomPad }]}>
          {/* Loading indicator */}
          {isAnyCalculating && (
            <View style={styles.footerLoading}>
              <View style={styles.loadingDotSmall} />
              <Text style={styles.footerLoadingText}>AI is calculating calories...</Text>
            </View>
          )}

          {/* Total */}
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>Total Calories</Text>
            <Text style={[styles.totalValue, { color: mealColor }]}>
              {editedTotal.toLocaleString()} <Text style={styles.kcalText}>kcal</Text>
            </Text>
          </View>

          {/* Actions */}
          <View style={styles.actions}>
            <TouchableOpacity style={styles.cancelBtn} onPress={onCancel} activeOpacity={0.8}>
              <Text style={styles.cancelText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.confirmBtn,
                { backgroundColor: mealColor },
                (!allValid || isAnyCalculating || hasErrors) && styles.confirmDisabled
              ]}
              onPress={handleConfirm}
              disabled={!allValid || isAnyCalculating || hasErrors}
              activeOpacity={0.9}
            >
              <Text style={styles.confirmText}>
                {isAnyCalculating ? 'Calculating...' : hasErrors ? 'Fix errors' : 'Confirm Log'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 9999,
    elevation: 9999,
  },
  backdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(20,18,14,0.5)',
  },
  backdropTouch: {
    flex: 1,
  },
  sheet: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: C.surface,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    shadowColor: C.ink,
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.2,
    shadowRadius: 24,
    elevation: 20,
    flexDirection: 'column',
  },
  scrollArea: {
    flexShrink: 1,
    minHeight: 0,
  },
  scrollContent: {
    paddingHorizontal: 24,
    paddingTop: 8,
    paddingBottom: 12,
  },
  handleBar: {
    alignItems: 'center',
    paddingVertical: 12,
  },
  handle: {
    width: 40,
    height: 4,
    backgroundColor: C.border2,
    borderRadius: 2,
  },

  // Header
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingHorizontal: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: C.border,
  },
  headerLeft: { flex: 1 },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: C.ink,
  },
  headerSubtitle: {
    fontSize: 13,
    color: C.ink3,
    marginTop: 4,
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: C.surface2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeText: {
    fontSize: 16,
    color: C.ink3,
    fontWeight: '600',
  },

  // Scroll & Content
  scroll: {
    flex: 1,
  },
  content: {
    paddingHorizontal: 24,
    paddingTop: 16,
  },
  bottomPadding: {
    height: 20,
  },

  // Meal Section
  mealSection: {
    marginBottom: 16,
  },
  sectionLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: C.ink3,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 12,
  },
  mealGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  mealChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: C.border,
    backgroundColor: C.surface2,
  },
  mealChipIcon: {
    width: 28,
    height: 28,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  mealChipLetter: {
    fontSize: 12,
    fontWeight: '700',
  },
  mealChipText: {
    fontSize: 13,
    fontWeight: '500',
    color: C.ink2,
  },

  // Item Card - Compact Row Layout
  itemCardCompact: {
    backgroundColor: C.surface2,
    borderRadius: 12,
    padding: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: C.border,
  },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  foodInputWrapper: {
    flex: 1,
  },
  foodInputCompact: {
    backgroundColor: C.surface,
    color: C.ink,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    fontWeight: '500',
    borderWidth: 1.5,
    borderColor: C.border,
  },
  calInputCompact: {
    backgroundColor: C.surface,
    color: C.ink,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 10,
    fontSize: 14,
    fontWeight: '700',
    width: 70,
    borderWidth: 1.5,
    borderColor: C.border,
    textAlign: 'center',
  },
  removeBtnCompact: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: C.errorL,
    alignItems: 'center',
    justifyContent: 'center',
  },
  removeTextCompact: {
    color: C.error,
    fontSize: 18,
    fontWeight: '700',
    lineHeight: 22,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 8,
  },
  errorTextCompact: {
    fontSize: 12,
    color: C.error,
    marginTop: 8,
    fontWeight: '500',
  },
  inputWrapper: {
    marginBottom: 12,
  },
  inputLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: C.ink3,
    marginBottom: 6,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  foodInput: {
    backgroundColor: C.surface,
    color: C.ink,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 14,
    fontSize: 16,
    fontWeight: '500',
    borderWidth: 1.5,
    borderColor: C.border,
  },
  inputEmpty: {
    borderColor: C.amber,
    backgroundColor: C.amberL + '40',
  },
  inputError: {
    borderColor: C.error,
    backgroundColor: C.errorL + '40',
  },

  // Loading
  loadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  loadingDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: C.sage,
  },
  loadingText: {
    fontSize: 14,
    color: C.sage,
    fontWeight: '600',
  },

  // Error
  errorText: {
    fontSize: 13,
    color: C.error,
    marginBottom: 12,
    fontWeight: '500',
  },

  // Calories row
  calRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 12,
  },
  calInput: {
    backgroundColor: C.surface,
    color: C.ink,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 14,
    fontSize: 16,
    fontWeight: '700',
    width: 100,
    borderWidth: 1.5,
    borderColor: C.border,
  },
  removeBtn: {
    marginLeft: 'auto',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: C.errorL,
  },
  removeText: {
    color: C.error,
    fontSize: 13,
    fontWeight: '600',
  },

  // Add button
  addBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: C.sageL,
    marginTop: 4,
    borderWidth: 1,
    borderColor: C.sageM,
  },
  addBtnIcon: {
    fontSize: 20,
    color: C.sage,
    fontWeight: '700',
  },
  addBtnText: {
    fontSize: 14,
    color: C.sage,
    fontWeight: '600',
  },

  // Footer
  footer: {
    paddingHorizontal: 20,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: C.border,
    backgroundColor: C.surface,
  },
  footerLoading: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginBottom: 12,
  },
  loadingDotSmall: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: C.sage,
  },
  footerLoadingText: {
    fontSize: 13,
    color: C.sage,
    fontWeight: '500',
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  totalLabel: {
    fontSize: 15,
    fontWeight: '600',
    color: C.ink2,
  },
  totalValue: {
    fontSize: 24,
    fontWeight: '700',
  },
  kcalText: {
    fontSize: 14,
    fontWeight: '500',
    color: C.ink3,
  },
  actions: {
    flexDirection: 'row',
    gap: 12,
  },
  cancelBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 14,
    backgroundColor: C.surface2,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: C.border,
  },
  cancelText: {
    color: C.ink2,
    fontWeight: '600',
    fontSize: 15,
  },
  confirmBtn: {
    flex: 2,
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: 'center',
  },
  confirmDisabled: {
    backgroundColor: C.border2,
    opacity: 0.7,
  },
  confirmText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 15,
  },

  // Edit Button Styles
  editBtnCompact: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: C.sageL,
    alignItems: 'center',
    justifyContent: 'center',
  },
  editTextCompact: {
    color: C.sage,
    fontSize: 14,
    fontWeight: '700',
  },
  okBtn: {
    width: 44,
    height: 32,
    borderRadius: 8,
    backgroundColor: C.sage,
    alignItems: 'center',
    justifyContent: 'center',
  },
  okText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '700',
  },
  cancelEditBtn: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: C.surface,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: C.border,
  },
  cancelEditText: {
    color: C.ink3,
    fontSize: 14,
    fontWeight: '700',
  },
  readOnlyInput: {
    backgroundColor: C.surface,
  },
});

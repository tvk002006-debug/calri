import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View, Text, ScrollView, StyleSheet,
  TouchableOpacity, ActivityIndicator,
  Animated, useWindowDimensions, TextInput,
  Modal, StatusBar, KeyboardAvoidingView, Platform, Image,
  DeviceEventEmitter,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { launchImageLibrary } from 'react-native-image-picker';
import Svg, { Circle, Defs, LinearGradient, Path, Rect, Stop } from 'react-native-svg';
import { BASE_URL } from '../../../config/api';
import { C } from '../../../styles/GlobalStyles';

// ─────────────────────────────────────────────
// CONSTANTS
// ─────────────────────────────────────────────
const ACTIVITY_LABELS: Record<string, { icon: string; label: string; color: string }> = {
  sedentary:   { icon: 'S',  label: 'Sedentary',         color: C.ink3 },
  light:       { icon: 'L',  label: 'Lightly Active',     color: C.sage },
  moderate:    { icon: 'M',  label: 'Moderately Active',  color: C.amber },
  active:      { icon: 'A',  label: 'Very Active',        color: C.amber800 },
  very_active: { icon: 'VA', label: 'Athlete',            color: C.error },
};

const GOAL_OPTIONS = [
  { key: 'lose_weight', label: 'Weight Loss',     icon: 'WL' },
  { key: 'maintain',    label: 'Maintain Health', icon: 'MT' },
  { key: 'gain_weight', label: 'Weight Gain',     icon: 'WG' },
];

const ACTIVITY_OPTIONS = [
  { key: 'sedentary',   icon: 'S',  label: 'Sedentary',         desc: 'Desk job, little exercise' },
  { key: 'light',       icon: 'L',  label: 'Lightly Active',    desc: 'Light exercise 1-3 days/week' },
  { key: 'moderate',    icon: 'M',  label: 'Moderately Active', desc: 'Exercise 3-5 days/week' },
  { key: 'active',      icon: 'A',  label: 'Very Active',       desc: 'Hard exercise 6-7 days/week' },
  { key: 'very_active', icon: 'VA', label: 'Athlete',           desc: 'Physical job or 2x/day training' },
];

const GENDER_OPTIONS = [
  { key: 'male',   label: 'Male'   },
  { key: 'female', label: 'Female' },
];

const ACTIVITY_MULTIPLIERS: Record<string, number> = {
  sedentary: 1.2, light: 1.375, moderate: 1.55, active: 1.725, very_active: 1.9,
};

// ─────────────────────────────────────────────
// CALORIE CALCULATOR
// ─────────────────────────────────────────────
function recalcCalories(g: any): number {
  if (!g.current_weight_kg || !g.height_cm || !g.age || !g.gender) return g.target_calories || 1800;
  const bmr = g.gender === 'female'
    ? 10 * g.current_weight_kg + 6.25 * g.height_cm - 5 * g.age - 161
    : 10 * g.current_weight_kg + 6.25 * g.height_cm - 5 * g.age + 5;
  const tdee = Math.round(bmr * (ACTIVITY_MULTIPLIERS[g.activity_level] ?? 1.375));
  if (g.goal_type === 'maintain' || !g.target_weight_kg) return tdee;
  const diff  = Math.abs(g.current_weight_kg - g.target_weight_kg);
  const delta = Math.min(Math.round((diff * 7700) / (12 * 7)), 500);
  return g.goal_type === 'lose_weight' ? tdee - delta : tdee + delta;
}

// ─────────────────────────────────────────────
// ARC PROGRESS — fixed alignment
// ─────────────────────────────────────────────
function ArcProgress({
  pct, size, stroke, color,
}: { pct: number; size: number; stroke: number; color: string }) {
  const r      = (size - stroke) / 2;
  const cx     = size / 2;
  const cy     = size / 2;
  const circum = 2 * Math.PI * r;
  const clamp  = Math.min(Math.max(pct, 0), 1.05);
  const dash   = clamp * circum;
  const isOver = pct > 1;

  return (
    <Svg width={size} height={size} style={{ position: 'absolute', top: 0, left: 0 }}>
      <Defs>
        <LinearGradient id="ag" x1="0%" y1="0%" x2="100%" y2="100%">
          <Stop offset="0%" stopColor={isOver ? C.error : color} />
          <Stop offset="100%" stopColor={isOver ? C.error : C.sageM} />
        </LinearGradient>
      </Defs>
      {/* Track */}
      <Circle
        cx={cx} cy={cy} r={r}
        fill="none"
        stroke={C.border}
        strokeWidth={stroke}
      />
      {/* Progress */}
      <Circle
        cx={cx} cy={cy} r={r}
        fill="none"
        stroke={isOver ? C.error : 'url(#ag)'}
        strokeWidth={stroke}
        strokeDasharray={`${dash} ${circum}`}
        strokeDashoffset={circum / 4}
        strokeLinecap="round"
      />
    </Svg>
  );
}

function OptionGlyph({ type, active = false }: { type: string; active?: boolean }) {
  const color = active ? C.sage : C.ink3;
  const bg    = active ? C.sageL : C.surface2;
  return (
    <View style={[p.optionGlyph, { backgroundColor: bg, borderColor: active ? C.sageM : C.border }]}>
      <Svg width={24} height={24} viewBox="0 0 24 24">
        {type === 'lose_weight' && <Path d="M7 17c5 0 9-4 10-10-6 0-10 4-10 10Zm0 0 6-6" fill="none" stroke={color} strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round" />}
        {type === 'maintain'    && <Path d="M6 12h12M8 8l-2 4 2 4M16 8l2 4-2 4" fill="none" stroke={color} strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round" />}
        {type === 'gain_weight' && <Path d="M12 5v14M5 12h14" fill="none" stroke={color} strokeWidth="2.4" strokeLinecap="round" />}
        {type === 'sedentary'   && <Rect x="6" y="9" width="12" height="7" rx="2" fill="none" stroke={color} strokeWidth="2.1" />}
        {type === 'light'       && <Path d="M8 18 11 6l2 7 3-2" fill="none" stroke={color} strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round" />}
        {type === 'moderate'    && <Path d="M6 17h3l2-8 3 5h4" fill="none" stroke={color} strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round" />}
        {type === 'active'      && <Path d="M12 4 7 13h4l-1 7 7-11h-4l1-5Z" fill="none" stroke={color} strokeWidth="2.1" strokeLinejoin="round" />}
        {type === 'very_active' && <Path d="M5 12h14M7 9v6M17 9v6M10 7v10M14 7v10" fill="none" stroke={color} strokeWidth="2.1" strokeLinecap="round" />}
      </Svg>
    </View>
  );
}

// ─────────────────────────────────────────────
// ANIMATED BAR
// ─────────────────────────────────────────────
function AnimatedBar({ pct, color }: { pct: number; color: string }) {
  const anim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.spring(anim, { toValue: Math.min(pct, 1), useNativeDriver: false, tension: 40, friction: 8 }).start();
  }, [anim, pct]);
  const width = anim.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] });
  return (
    <View style={p.barTrack}>
      <Animated.View style={[p.barFill, { width, backgroundColor: color }]} />
    </View>
  );
}

// ─────────────────────────────────────────────
// CONFIRM MODAL
// ─────────────────────────────────────────────
function ConfirmModal({ visible, onConfirm, onCancel }: { visible: boolean; onConfirm: () => void; onCancel: () => void }) {
  const scale = useRef(new Animated.Value(0.85)).current;
  const opac  = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.spring(scale, { toValue: 1, useNativeDriver: true, tension: 100, friction: 8 }),
        Animated.timing(opac,  { toValue: 1, duration: 180, useNativeDriver: true }),
      ]).start();
    } else {
      scale.setValue(0.85); opac.setValue(0);
    }
  }, [opac, scale, visible]);
  return (
    <Modal transparent visible={visible} animationType="none" statusBarTranslucent>
      <View style={p.modalOverlay}>
        <Animated.View style={[p.modalBox, { transform: [{ scale }], opacity: opac }]}>
          <Text style={p.modalTitle}>Sign out?</Text>
          <Text style={p.modalMsg}>You'll need to verify your phone number again to log back in.</Text>
          <TouchableOpacity style={p.modalConfirmBtn} onPress={onConfirm} activeOpacity={0.85}>
            <Text style={p.modalConfirmText}>Sign out</Text>
          </TouchableOpacity>
          <TouchableOpacity style={p.modalCancelBtn} onPress={onCancel} activeOpacity={0.7}>
            <Text style={p.modalCancelText}>Cancel</Text>
          </TouchableOpacity>
        </Animated.View>
      </View>
    </Modal>
  );
}

// ─────────────────────────────────────────────
// FIELD ROW
// ─────────────────────────────────────────────
function FieldRow({ label, value, onChangeText, keyboardType = 'default', unit, error }: {
  label: string; value: string; onChangeText: (t: string) => void;
  keyboardType?: any; unit?: string; error?: string;
}) {
  const [focused, setFocused] = useState(false);
  return (
    <View style={{ marginBottom: 4 }}>
      <Text style={p.editFieldLabel}>{label}</Text>
      <View style={[p.editInputRow, focused && p.editInputFocused, error ? p.editInputError : null]}>
        <TextInput
          style={p.editInput} value={value} onChangeText={onChangeText}
          keyboardType={keyboardType} selectionColor={C.sage} cursorColor={C.sage}
          placeholderTextColor={C.ink4}
          onFocus={() => setFocused(true)} onBlur={() => setFocused(false)}
        />
        {unit && <Text style={p.editUnit}>{unit}</Text>}
      </View>
      {error ? <Text style={p.editError}>{error}</Text> : <View style={{ height: 14 }} />}
    </View>
  );
}

// ─────────────────────────────────────────────
// MAIN
// ─────────────────────────────────────────────
export default function ProfileTab({ phone, onLogout }: { phone?: string; onLogout?: () => void }) {
  const { width }  = useWindowDimensions();
  const CARD_PAD   = width >= 768 ? 32 : 20;

  const [profile,       setProfile]       = useState<any>(null);
  const [estimate,      setEstimate]      = useState<any>(null);
  const [todayCalories, setTodayCalories] = useState(0);
  const [loading,       setLoading]       = useState(true);
  const [saving,        setSaving]        = useState(false);
  const [editing,       setEditing]       = useState(false);
  const [showLogout,    setShowLogout]    = useState(false);
  const [errors,        setErrors]        = useState<Record<string, string>>({});

  const [editName,          setEditName]          = useState('');
  const [editAge,           setEditAge]           = useState('');
  const [editWeight,        setEditWeight]        = useState('');
  const [editHeight,        setEditHeight]        = useState('');
  const [editTargetWeight,  setEditTargetWeight]  = useState('');
  const [editGender,        setEditGender]        = useState('male');
  const [editGoalType,      setEditGoalType]      = useState('lose_weight');
  const [editActivityLevel, setEditActivityLevel] = useState('light');

  const [photoUri, setPhotoUri] = useState<string | null>(null);

  const editSlide = useRef(new Animated.Value(0)).current;
  const editFade  = useRef(new Animated.Value(0)).current;

  // Load saved photo on mount
  useEffect(() => {
    AsyncStorage.getItem('profile_photo').then(uri => { if (uri) setPhotoUri(uri); });
  }, []);

  const pickPhoto = async () => {
    const result = await launchImageLibrary({ mediaType: 'photo', quality: 0.8 });
    if (result.assets && result.assets[0]?.uri) {
      const uri = result.assets[0].uri;
      setPhotoUri(uri);
      await AsyncStorage.setItem('profile_photo', uri);
    }
  };

  const fetchAll = useCallback(() => {
    if (!phone) return;
    setLoading(true);
    Promise.all([
      fetch(`${BASE_URL}/user/${phone}`).then(r => r.json()),
      fetch(`${BASE_URL}/user/${phone}/goal-estimate`).then(r => r.json()),
      fetch(`${BASE_URL}/dashboard/daily/${phone}`).then(r => r.json()),
    ])
      .then(([profileData, estimateData, dailyData]) => {
        setProfile(profileData);
        setEstimate(estimateData);
        setTodayCalories(dailyData?.today?.calories_consumed ?? 0);
      })
      .catch(console.log)
      .finally(() => setLoading(false));
  }, [phone]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const openEdit = () => {
    const g = profile?.goals || {};
    setEditName(profile?.name || '');
    setEditAge(g.age ? String(g.age) : '');
    setEditWeight(g.current_weight_kg ? String(g.current_weight_kg) : '');
    setEditHeight(g.height_cm ? String(g.height_cm) : '');
    setEditTargetWeight(g.target_weight_kg ? String(g.target_weight_kg) : '');
    setEditGender(g.gender || 'male');
    setEditGoalType(g.goal_type || 'lose_weight');
    setEditActivityLevel(g.activity_level || 'light');
    setErrors({});
    setEditing(true);
    Animated.parallel([
      Animated.spring(editSlide, { toValue: 1, useNativeDriver: true, tension: 60, friction: 10 }),
      Animated.timing(editFade,  { toValue: 1, duration: 220, useNativeDriver: true }),
    ]).start();
  };

  const closeEdit = () => {
    Animated.parallel([
      Animated.timing(editSlide, { toValue: 0, duration: 180, useNativeDriver: true }),
      Animated.timing(editFade,  { toValue: 0, duration: 160, useNativeDriver: true }),
    ]).start(() => setEditing(false));
  };

  const validateEdit = () => {
    const errs: Record<string, string> = {};
    if (!editName.trim() || editName.trim().length < 2) errs.name = 'Name must be at least 2 characters';
    const a = parseInt(editAge, 10);
    if (!editAge || isNaN(a) || a < 13 || a > 100) errs.age = 'Age must be 13–100';
    const w = parseFloat(editWeight);
    if (!editWeight || isNaN(w) || w < 30 || w > 300) errs.weight = 'Weight must be 30–300 kg';
    const h = parseFloat(editHeight);
    if (!editHeight || isNaN(h) || h < 100 || h > 250) errs.height = 'Height must be 100–250 cm';
    if (editGoalType !== 'maintain') {
      const tw = parseFloat(editTargetWeight);
      if (!editTargetWeight || isNaN(tw)) errs.targetWeight = 'Enter a target weight';
      else if (editGoalType === 'lose_weight' && tw >= w) errs.targetWeight = 'Must be less than current weight';
      else if (editGoalType === 'gain_weight' && tw <= w) errs.targetWeight = 'Must be more than current weight';
    }
    return errs;
  };

  const saveEdit = async () => {
    const errs = validateEdit();
    if (Object.keys(errs).length > 0) { setErrors(errs); return; }
    setErrors({});
    try {
      setSaving(true);
      const w  = parseFloat(editWeight);
      const h  = parseFloat(editHeight);
      const a  = parseInt(editAge, 10);
      const tw = editTargetWeight ? parseFloat(editTargetWeight) : null;

      const payload = {
        name:              editName.trim(),
        goal_type:         editGoalType,
        current_weight_kg: w,
        height_cm:         h,
        target_weight_kg:  tw,
        age:               a,
        gender:            editGender,
        activity_level:    editActivityLevel,
        target_calories:   recalcCalories({
          current_weight_kg: w, height_cm: h, age: a,
          gender: editGender, goal_type: editGoalType,
          target_weight_kg: tw, activity_level: editActivityLevel,
        }),
      };

      const res  = await fetch(`${BASE_URL}/user/${phone}/goals`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (data.ok) { closeEdit(); fetchAll(); }
      else console.log('Save failed:', data);
    } catch (err) {
      console.log('Edit save error:', err);
    } finally {
      setSaving(false);
    }
  };

  const doLogout = async () => {
    try {
      await AsyncStorage.clear();
      if (onLogout) onLogout();
      DeviceEventEmitter.emit('logout');
    } catch (err) {
      console.log('Logout error:', err);
    }
  };

function SkeletonPulse({ style }: { style: any }) {
  const opacity = useRef(new Animated.Value(0.35)).current;
  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, { toValue: 0.65, duration: 800, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 0.35, duration: 800, useNativeDriver: true }),
      ])
    ).start();
  }, [opacity]);
  return <Animated.View style={[{ backgroundColor: C.border }, style, { opacity }]} />;
}

function ProfileSkeleton() {
  return (
    <ScrollView style={p.root} showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 48 }}>
      <StatusBar barStyle="dark-content" backgroundColor={C.cream} />
      
      {/* Skeleton Hero */}
      <View style={p.hero}>
        <View style={p.identityRow}>
          <SkeletonPulse style={{ width: 68, height: 68, borderRadius: 34 }} />
          <View style={[p.identityText, { gap: 8 }]}>
            <SkeletonPulse style={{ width: 60, height: 12, borderRadius: 4 }} />
            <SkeletonPulse style={{ width: 140, height: 22, borderRadius: 6 }} />
            <View style={{ flexDirection: 'row', gap: 8, marginTop: 4 }}>
              <SkeletonPulse style={{ width: 80, height: 22, borderRadius: 999 }} />
              <SkeletonPulse style={{ width: 100, height: 22, borderRadius: 999 }} />
            </View>
          </View>
        </View>
        <SkeletonPulse style={{ marginTop: 16, height: 40, borderRadius: 8 }} />
      </View>

      <View style={{ paddingHorizontal: 18 }}>
        {/* Skeleton Today Card */}
        <View style={p.todayCard}>
          <View style={{ width: 120, height: 120, alignItems: 'center', justifyContent: 'center' }}>
            <SkeletonPulse style={{ width: 100, height: 100, borderRadius: 50 }} />
          </View>
          <View style={[p.todayRight, { gap: 10 }]}>
            <SkeletonPulse style={{ width: 50, height: 12, borderRadius: 4, marginBottom: 4 }} />
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <SkeletonPulse style={{ width: 7, height: 7, borderRadius: 4 }} />
              <SkeletonPulse style={{ width: 80, height: 16, borderRadius: 4 }} />
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <SkeletonPulse style={{ width: 7, height: 7, borderRadius: 4 }} />
              <SkeletonPulse style={{ width: 60, height: 16, borderRadius: 4 }} />
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <SkeletonPulse style={{ width: 7, height: 7, borderRadius: 4 }} />
              <SkeletonPulse style={{ width: 70, height: 16, borderRadius: 4 }} />
            </View>
          </View>
        </View>

        <SkeletonPulse style={{ height: 7, borderRadius: 99, marginBottom: 8 }} />
        <View style={{ alignItems: 'flex-end', marginBottom: 24 }}>
          <SkeletonPulse style={{ width: 100, height: 10, borderRadius: 4 }} />
        </View>

        {/* Skeleton Goal ETA */}
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 10 }}>
          <SkeletonPulse style={{ width: 100, height: 16, borderRadius: 4 }} />
          <SkeletonPulse style={{ width: 80, height: 12, borderRadius: 4 }} />
        </View>
        <View style={[p.etaSummaryCard, { height: 70, justifyContent: 'center' }]}>
          <SkeletonPulse style={{ width: '90%', height: 14, borderRadius: 4, marginBottom: 6 }} />
          <SkeletonPulse style={{ width: '60%', height: 14, borderRadius: 4 }} />
        </View>

        <View style={{ flexDirection: 'row', gap: 8, marginBottom: 24 }}>
          {[1, 2, 3].map(i => (
            <View key={i} style={[p.metricTile, { height: 90, justifyContent: 'space-between', alignItems: 'center' }]}>
              <SkeletonPulse style={{ width: 50, height: 10, borderRadius: 4 }} />
              <SkeletonPulse style={{ width: 40, height: 18, borderRadius: 4 }} />
              <SkeletonPulse style={{ width: 30, height: 10, borderRadius: 4 }} />
            </View>
          ))}
        </View>
      </View>
    </ScrollView>
  );
}

  if (loading) {
    return <ProfileSkeleton />;
  }

  const goals     = profile?.goals || {};
  const username  = profile?.name?.trim() || 'User';
  const initial   = username.charAt(0).toUpperCase();
  const activity  = ACTIVITY_LABELS[goals.activity_level] || ACTIVITY_LABELS.light;
  const targetCal = goals.target_calories || 1800;
  const calPct    = targetCal ? todayCalories / targetCal : 0;
  const over      = todayCalories > targetCal;
  const calColor  = over ? C.error : C.sage;
  const deficit   = estimate?.tdee ? Math.abs(estimate.tdee - targetCal) : null;
  const isSurplus = estimate?.tdee ? targetCal > estimate.tdee : false;

  const editTranslateY = editSlide.interpolate({ inputRange: [0, 1], outputRange: [60, 0] });

  // ── EDIT SHEET ──
  if (editing) {
    return (
      <KeyboardAvoidingView style={p.root} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <StatusBar barStyle="dark-content" backgroundColor={C.cream} />
        <Animated.View style={{ flex: 1, opacity: editFade, transform: [{ translateY: editTranslateY }] }}>

          <View style={[p.editHeader, { paddingHorizontal: CARD_PAD }]}>
            <TouchableOpacity onPress={closeEdit} activeOpacity={0.7} style={p.editBackBtn}>
              <Text style={p.editBackText}>← Cancel</Text>
            </TouchableOpacity>
            <Text style={p.editHeaderTitle}>Edit Profile</Text>
            <TouchableOpacity
              onPress={saveEdit} disabled={saving} activeOpacity={0.85}
              style={[p.editSaveBtn, saving && { opacity: 0.5 }]}
            >
              <Text style={p.editSaveText}>{saving ? 'Saving...' : 'Save'}</Text>
            </TouchableOpacity>
          </View>

          <ScrollView
            contentContainerStyle={{ paddingHorizontal: CARD_PAD, paddingTop: 8, paddingBottom: 60 }}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            <FieldRow label="NAME" value={editName} onChangeText={setEditName} error={errors.name} />

            <Text style={p.editFieldLabel}>GENDER</Text>
            <View style={p.editToggleRow}>
              {GENDER_OPTIONS.map(g => (
                <TouchableOpacity
                  key={g.key}
                  style={[p.editToggleBtn, editGender === g.key && p.editToggleBtnActive]}
                  onPress={() => setEditGender(g.key)} activeOpacity={0.8}
                >
                  <Text style={[p.editToggleText, editGender === g.key && p.editToggleTextActive]}>
                    {g.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
            <View style={{ height: 18 }} />

            <FieldRow label="AGE"            value={editAge}          onChangeText={setEditAge}          keyboardType="numeric"      unit="yrs" error={errors.age} />
            <FieldRow label="CURRENT WEIGHT" value={editWeight}       onChangeText={t => { setEditWeight(t); setEditTargetWeight(''); }} keyboardType="decimal-pad" unit="kg"  error={errors.weight} />
            <FieldRow label="HEIGHT"         value={editHeight}       onChangeText={setEditHeight}       keyboardType="decimal-pad"  unit="cm"  error={errors.height} />

            <Text style={p.editFieldLabel}>GOAL</Text>
            <View style={p.editOptionList}>
              {GOAL_OPTIONS.map(opt => (
                <TouchableOpacity
                  key={opt.key}
                  style={[p.editOptionCard, editGoalType === opt.key && p.editOptionCardActive]}
                  onPress={() => { setEditGoalType(opt.key); setEditTargetWeight(''); setErrors(e => ({ ...e, targetWeight: '' })); }}
                  activeOpacity={0.8}
                >
                  <OptionGlyph type={opt.key} active={editGoalType === opt.key} />
                  <Text style={[p.editOptionLabel, editGoalType === opt.key && p.editOptionLabelActive]}>
                    {opt.label}
                  </Text>
                  <View style={[p.radio, editGoalType === opt.key && p.radioActive]}>
                    {editGoalType === opt.key && <View style={p.radioDot} />}
                  </View>
                </TouchableOpacity>
              ))}
            </View>
            <View style={{ height: 18 }} />

            {editGoalType !== 'maintain' && (
              <FieldRow
                label={editGoalType === 'lose_weight' ? 'TARGET WEIGHT' : 'EXPECTED WEIGHT'}
                value={editTargetWeight}
                onChangeText={t => { setEditTargetWeight(t); setErrors(e => ({ ...e, targetWeight: '' })); }}
                keyboardType="decimal-pad" unit="kg" error={errors.targetWeight}
              />
            )}

            <Text style={p.editFieldLabel}>ACTIVITY LEVEL</Text>
            <View style={p.editOptionList}>
              {ACTIVITY_OPTIONS.map(opt => (
                <TouchableOpacity
                  key={opt.key}
                  style={[p.editOptionCard, editActivityLevel === opt.key && p.editOptionCardActive]}
                  onPress={() => setEditActivityLevel(opt.key)}
                  activeOpacity={0.8}
                >
                  <OptionGlyph type={opt.key} active={editActivityLevel === opt.key} />
                  <View style={{ flex: 1 }}>
                    <Text style={[p.editOptionLabel, editActivityLevel === opt.key && p.editOptionLabelActive]}>
                      {opt.label}
                    </Text>
                    <Text style={p.editOptionDesc}>{opt.desc}</Text>
                  </View>
                  <View style={[p.radio, editActivityLevel === opt.key && p.radioActive]}>
                    {editActivityLevel === opt.key && <View style={p.radioDot} />}
                  </View>
                </TouchableOpacity>
              ))}
            </View>
            <View style={{ height: 8 }} />
          </ScrollView>
        </Animated.View>
      </KeyboardAvoidingView>
    );
  }

  // ── PROFILE VIEW ──
  return (
    <ScrollView
      style={p.root}
      showsVerticalScrollIndicator={false}
      contentContainerStyle={{ paddingBottom: 48 }}
    >
      <StatusBar barStyle="dark-content" backgroundColor={C.cream} />

      {/* ── HERO ── */}
      <View style={p.hero}>
        <View style={p.identityRow}>
          {/* Tappable avatar — shows photo or initial */}
          <TouchableOpacity onPress={pickPhoto} activeOpacity={0.85} style={p.avatarRing}>
            {photoUri ? (
              <Image source={{ uri: photoUri }} style={p.avatarPhoto} />
            ) : (
              <View style={p.avatar}>
                <Text style={p.avatarText}>{initial}</Text>
              </View>
            )}
            {/* Camera badge */}
            <View style={p.cameraBadge}>
              <Text style={{ fontSize: 10 }}>📷</Text>
            </View>
          </TouchableOpacity>
          <View style={p.identityText}>
            <Text style={p.heroEyebrow}>Profile</Text>
            <Text style={p.heroName}>{username}</Text>
            <View style={p.chipRow}>
          <View style={[p.chip, { borderColor: C.sageM, backgroundColor: C.sageL }]}>
            <Text style={[p.chipText, { color: C.sage }]}>
              {(goals.goal_type || 'No Goal').replace(/_/g, ' ')}
            </Text>
          </View>
          <View style={[p.chip, { borderColor: activity.color, backgroundColor: C.surface2 }]}>
            <Text style={[p.chipText, { color: activity.color }]}>
              {activity.icon}  {activity.label}
            </Text>
          </View>
            </View>
          </View>
        </View>
        <TouchableOpacity style={p.editProfileBtn} onPress={openEdit} activeOpacity={0.8}>
          <Text style={p.editProfileText}>Edit Profile</Text>
        </TouchableOpacity>
      </View>

      <View style={{ paddingHorizontal: CARD_PAD }}>

        {/* ── TODAY CALORIE CARD ── */}
        <View style={p.todayCard}>
          {/* Ring — fixed: container is sized, SVG is absolute inside it, text is centered over it */}
          <View style={p.ringWrap}>
            <ArcProgress pct={calPct} size={120} stroke={11} color={calColor} />
            <View style={p.ringLabel} pointerEvents="none">
              <Text style={[p.arcNum, { color: calColor }]} adjustsFontSizeToFit numberOfLines={1}>
                {todayCalories.toLocaleString()}
              </Text>
              <Text style={p.arcSub}>kcal</Text>
            </View>
          </View>

          <View style={p.todayRight}>
            <Text style={p.todayTitle}>Today</Text>
            <View style={p.todayStat}>
              <View style={[p.todayDot, { backgroundColor: calColor }]} />
              <View>
                <Text style={p.todayStatVal}>{todayCalories.toLocaleString()}</Text>
                <Text style={p.todayStatLbl}>consumed</Text>
              </View>
            </View>
            <View style={p.todayStat}>
              <View style={[p.todayDot, { backgroundColor: over ? C.error : C.sage }]} />
              <View>
                <Text style={[p.todayStatVal, { color: over ? C.error : C.sage }]}>
                  {Math.abs(targetCal - todayCalories).toLocaleString()}
                </Text>
                <Text style={p.todayStatLbl}>{over ? 'over budget' : 'remaining'}</Text>
              </View>
            </View>
            <View style={p.todayStat}>
              <View style={[p.todayDot, { backgroundColor: C.border2 }]} />
              <View>
                <Text style={p.todayStatVal}>{targetCal.toLocaleString()}</Text>
                <Text style={p.todayStatLbl}>daily goal</Text>
              </View>
            </View>
          </View>
        </View>

        <AnimatedBar pct={calPct} color={calColor} />
        <Text style={p.barPct}>{Math.round(calPct * 100)}% of daily goal</Text>

        {/* ── GOAL ETA ── */}
        {estimate && (
          <>
            <View style={p.sectionHeader}>
              <Text style={p.sectionTitle}>Goal Progress</Text>
              <Text style={p.sectionNote}>based on your TDEE</Text>
            </View>

            <View style={p.etaSummaryCard}>
              <Text style={p.etaSummaryText}>{estimate.goal_summary}</Text>
            </View>

            <View style={p.metricsRow}>
              {[
                { label: 'Weekly change', value: estimate.weekly_weight_change_kg ? `${Math.abs(estimate.weekly_weight_change_kg)} kg` : '–', sub: estimate.weekly_weight_change_kg < 0 ? 'loss' : 'gain', color: C.sage, accent: true },
                { label: 'To goal',       value: estimate.estimated_weeks_to_goal  ? `${estimate.estimated_weeks_to_goal}w`  : '–', sub: 'weeks',   color: C.ink,    accent: false },
                { label: 'Months',        value: estimate.estimated_months_to_goal ? `${estimate.estimated_months_to_goal}` : '–', sub: 'to goal', color: C.amber, accent: false },
              ].map(m => (
                <View key={m.label} style={[p.metricTile, m.accent && p.metricTileAccent]}>
                  <Text style={p.metricLabel}>{m.label}</Text>
                  <Text style={[p.metricValue, { color: m.color }]} numberOfLines={1} adjustsFontSizeToFit>{m.value}</Text>
                  <Text style={p.metricSub}>{m.sub}</Text>
                </View>
              ))}
            </View>

            {estimate.tdee && (
              <View style={p.tdeeStrip}>
                {[
                  { label: 'TDEE',                             val: estimate.tdee.toLocaleString(),   color: C.ink },
                  { label: 'Target',                           val: targetCal.toLocaleString(),        color: C.ink },
                  { label: isSurplus ? 'Surplus' : 'Deficit',  val: deficit?.toLocaleString() ?? '–', color: isSurplus ? C.amber : C.sage },
                ].map((cell, i) => (
                  <React.Fragment key={cell.label}>
                    {i > 0 && <View style={p.tdeeSep} />}
                    <View style={p.tdeeCell}>
                      <Text style={p.tdeeCellLabel}>{cell.label}</Text>
                      <Text style={[p.tdeeCellVal, { color: cell.color }]}>{cell.val}</Text>
                      <Text style={p.tdeeCellUnit}>kcal/day</Text>
                    </View>
                  </React.Fragment>
                ))}
              </View>
            )}
          </>
        )}

        {/* ── BODY STATS ── */}
        <View style={p.sectionHeader}>
          <Text style={p.sectionTitle}>Body Stats</Text>
        </View>
        <View style={p.card}>
          {[
            { label: 'Current Weight', value: goals.current_weight_kg ? `${goals.current_weight_kg} kg` : null },
            { label: 'Target Weight',  value: goals.target_weight_kg  ? `${goals.target_weight_kg} kg`  : null },
            { label: 'Height',         value: goals.height_cm         ? `${goals.height_cm} cm`         : null },
            { label: 'Age',            value: goals.age               ? `${goals.age} yrs`              : null },
            { label: 'Gender',         value: goals.gender            ?? null },
            { label: 'Activity',       value: `${activity.icon}  ${activity.label}` },
          ].map((row, i, arr) => (
            <View key={row.label} style={[p.dataRow, i === arr.length - 1 && { borderBottomWidth: 0 }]}>
              <Text style={p.dataLabel}>{row.label}</Text>
              <Text style={p.dataValue}>{row.value ?? '–'}</Text>
            </View>
          ))}
        </View>

        {/* ── DAILY TARGET ── */}
        <View style={p.sectionHeader}>
          <Text style={p.sectionTitle}>Daily Target</Text>
        </View>
        <View style={p.targetCard}>
          <Text style={p.targetCardLabel}>Calories</Text>
          <Text style={[p.targetCardValue, { color: C.sage }]} adjustsFontSizeToFit numberOfLines={1}>
            {targetCal.toLocaleString()}
          </Text>
          <Text style={p.targetCardUnit}>kcal / day</Text>
          <View style={[p.targetBarTrack, { marginTop: 10 }]}>
            <View style={[p.targetBarFill, { width: `${Math.min(calPct * 100, 100)}%`, backgroundColor: C.sage }]} />
          </View>
        </View>

        {/* ── SIGN OUT ── */}
        <TouchableOpacity style={p.logoutBtn} activeOpacity={0.8} onPress={() => setShowLogout(true)}>
          <Text style={p.logoutText}>Sign out</Text>
        </TouchableOpacity>

      </View>

      <ConfirmModal
        visible={showLogout}
        onConfirm={doLogout}
        onCancel={() => setShowLogout(false)}
      />
    </ScrollView>
  );
}

// ─────────────────────────────────────────────
// STYLES
// ─────────────────────────────────────────────
const p = StyleSheet.create({
  root:   { flex: 1, backgroundColor: C.cream },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: C.cream },

  // Hero
  hero:       { marginHorizontal: 18, marginTop: 54, marginBottom: 16, padding: 18, borderRadius: 8, backgroundColor: C.surface, borderWidth: 1, borderColor: C.border },
  identityRow:{ flexDirection: 'row', alignItems: 'center', gap: 14 },
  identityText:{ flex: 1 },
  heroEyebrow:{ color: C.sage, fontSize: 11, fontWeight: '900', letterSpacing: 1.1, textTransform: 'uppercase', marginBottom: 4 },
  avatarRing: { width: 68, height: 68, borderRadius: 34, borderWidth: 2, borderColor: C.sageM, padding: 2, backgroundColor: C.sageL, position: 'relative' },
  avatar:     { flex: 1, borderRadius: 32, backgroundColor: C.sage, justifyContent: 'center', alignItems: 'center' },
  avatarPhoto:{ width: '100%', height: '100%', borderRadius: 32 },
  cameraBadge:{ position: 'absolute', bottom: -2, right: -2, width: 22, height: 22, borderRadius: 11, backgroundColor: C.surface, borderWidth: 1.5, borderColor: C.border2, alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: C.surface, fontSize: 24, fontWeight: '800' },
  heroName:   { color: C.ink, fontSize: 27, fontWeight: '900' },
  chipRow:    { flexDirection: 'row', gap: 8, marginTop: 10, flexWrap: 'wrap' },
  chip:       { borderRadius: 999, borderWidth: 1, paddingHorizontal: 10, paddingVertical: 5 },
  chipText:   { fontSize: 12, fontWeight: '700', textTransform: 'capitalize' },

  editProfileBtn:  { marginTop: 16, borderWidth: 1, borderColor: C.sageM, borderRadius: 8, paddingHorizontal: 18, paddingVertical: 12, backgroundColor: C.sageL, alignItems: 'center' },
  editProfileText: { color: C.sage, fontSize: 13, fontWeight: '900', letterSpacing: 0.3 },

  // Today card
  todayCard: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: C.surface, borderRadius: 8, borderWidth: 1,
    borderColor: C.border, padding: 20, gap: 16, marginBottom: 10,
  },

  // ── Ring fix: sized wrapper, SVG absolute, label centered ──
  ringWrap: {
    width: 120,
    height: 120,
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
  },
  ringLabel: {
    position: 'absolute',
    top: 0, left: 0, right: 0, bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  arcNum:  { fontSize: 22, fontWeight: '900', letterSpacing: -1, textAlign: 'center' },
  arcSub:  { color: C.ink3, fontSize: 10, marginTop: 1, textAlign: 'center' },

  todayRight:   { flex: 1, gap: 12 },
  todayTitle:   { color: C.sage, fontSize: 11, fontWeight: '700', letterSpacing: 1, textTransform: 'uppercase', marginBottom: 2 },
  todayStat:    { flexDirection: 'row', alignItems: 'center', gap: 10 },
  todayDot:     { width: 7, height: 7, borderRadius: 4 },
  todayStatVal: { color: C.ink, fontSize: 16, fontWeight: '800' },
  todayStatLbl: { color: C.ink3, fontSize: 10, marginTop: 1 },

  // Bar
  barTrack: { height: 7, backgroundColor: C.border, borderRadius: 99, overflow: 'hidden', marginBottom: 8 },
  barFill:  { height: '100%', borderRadius: 99 },
  barPct:   { color: C.ink3, fontSize: 10, textAlign: 'right', marginBottom: 24 },

  // Section header
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 10, marginTop: 4 },
  sectionTitle:  { color: C.ink, fontSize: 15, fontWeight: '900' },
  sectionNote:   { color: C.ink3, fontSize: 11 },

  // ETA
  etaSummaryCard: { backgroundColor: C.sageL, borderRadius: 8, borderWidth: 1, borderColor: C.sageM, padding: 18, marginBottom: 10 },
  etaSummaryText: { color: C.ink2, fontSize: 13, lineHeight: 20, fontWeight: '500' },

  // Metrics
  metricsRow:       { flexDirection: 'row', gap: 8, marginBottom: 10 },
  metricTile:       { flex: 1, backgroundColor: C.surface, borderRadius: 8, borderWidth: 1, borderColor: C.border, padding: 14, alignItems: 'center' },
  metricTileAccent: { borderColor: C.sageM, backgroundColor: C.sageL },
  metricLabel:      { color: C.ink3, fontSize: 9, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6, textAlign: 'center' },
  metricValue:      { fontSize: 22, fontWeight: '800', textAlign: 'center' },
  metricSub:        { color: C.ink3, fontSize: 9, marginTop: 3, textAlign: 'center' },

  // TDEE strip
  tdeeStrip:     { flexDirection: 'row', backgroundColor: C.surface2, borderRadius: 8, borderWidth: 1, borderColor: C.border, overflow: 'hidden', marginBottom: 24 },
  tdeeCell:      { flex: 1, alignItems: 'center', paddingVertical: 14, paddingHorizontal: 8 },
  tdeeCellLabel: { color: C.ink3, fontSize: 9, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4 },
  tdeeCellVal:   { color: C.ink, fontSize: 17, fontWeight: '800' },
  tdeeCellUnit:  { color: C.ink3, fontSize: 9, marginTop: 2 },
  tdeeSep:       { width: 1, backgroundColor: C.border, marginVertical: 12 },

  // Data rows
  card:      { backgroundColor: C.surface, borderRadius: 8, borderWidth: 1, borderColor: C.border, overflow: 'hidden', marginBottom: 24 },
  dataRow:   { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 18, paddingVertical: 13, borderBottomWidth: 1, borderColor: C.border },
  dataLabel: { color: C.ink2, fontSize: 13 },
  dataValue: { color: C.ink, fontSize: 13, fontWeight: '700' },

  // Target card
  targetCard:      { backgroundColor: C.sageL, borderRadius: 8, borderWidth: 1, borderColor: C.sageM, padding: 18, alignItems: 'center', marginBottom: 24 },
  targetCardLabel: { color: C.sage, fontSize: 9, fontWeight: '900', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6 },
  targetCardValue: { fontSize: 36, fontWeight: '800' },
  targetCardUnit:  { color: C.ink3, fontSize: 11, marginTop: 4 },
  targetBarTrack:  { height: 7, width: '100%', backgroundColor: C.surface, borderRadius: 99, overflow: 'hidden' },
  targetBarFill:   { height: '100%', borderRadius: 99 },

  // Logout
  logoutBtn:  { marginTop: 4, marginBottom: 8, backgroundColor: C.surface2, borderWidth: 1, borderColor: C.border, borderRadius: 8, paddingVertical: 15, alignItems: 'center' },
  logoutText: { color: C.ink3, fontSize: 13, fontWeight: '700', letterSpacing: 0.5 },

  // Modal
  modalOverlay:     { flex: 1, backgroundColor: 'rgba(20,18,14,0.55)', justifyContent: 'center', alignItems: 'center', paddingHorizontal: 32 },
  modalBox:         { backgroundColor: C.surface, borderRadius: 20, padding: 28, width: '100%', alignItems: 'center', borderWidth: 1, borderColor: C.border },
  modalTitle:       { color: C.ink, fontSize: 18, fontWeight: '800', marginBottom: 8 },
  modalMsg:         { color: C.ink2, fontSize: 14, textAlign: 'center', lineHeight: 20, marginBottom: 24 },
  modalConfirmBtn:  { width: '100%', backgroundColor: C.error, paddingVertical: 14, borderRadius: 12, alignItems: 'center', marginBottom: 10 },
  modalConfirmText: { color: C.surface, fontSize: 15, fontWeight: '800' },
  modalCancelBtn:   { width: '100%', paddingVertical: 12, alignItems: 'center' },
  modalCancelText:  { color: C.ink3, fontSize: 14, fontWeight: '600' },

  // Edit sheet
  editHeader:      { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingTop: 60, paddingBottom: 16, borderBottomWidth: 1, borderColor: C.border, backgroundColor: C.cream },
  editBackBtn:     { paddingVertical: 6, paddingRight: 12 },
  editBackText:    { color: C.ink3, fontSize: 13, fontWeight: '600' },
  editHeaderTitle: { color: C.ink, fontSize: 16, fontWeight: '800' },
  editSaveBtn:     { backgroundColor: C.sage, paddingHorizontal: 18, paddingVertical: 8, borderRadius: 10 },
  editSaveText:    { color: C.surface, fontSize: 13, fontWeight: '800' },

  editFieldLabel:   { color: C.ink3, fontSize: 10, fontWeight: '700', letterSpacing: 1.2, textTransform: 'uppercase', marginBottom: 8 },
  editInputRow:     { flexDirection: 'row', alignItems: 'center', backgroundColor: C.surface2, borderRadius: 12, borderWidth: 1.5, borderColor: C.border, paddingHorizontal: 16 },
  editInputFocused: { borderColor: C.sage, backgroundColor: C.surface },
  editInputError:   { borderColor: C.error },
  editInput:        { flex: 1, color: C.ink, fontSize: 16, fontWeight: '600', paddingVertical: 14 },
  editUnit:         { color: C.ink3, fontSize: 13, fontWeight: '600' },
  editError:        { color: C.error, fontSize: 11, fontWeight: '600', marginTop: 4, marginBottom: 10, paddingLeft: 4 },

  editToggleRow:        { flexDirection: 'row', gap: 10 },
  editToggleBtn:        { flex: 1, paddingVertical: 13, borderRadius: 12, borderWidth: 1.5, borderColor: C.border, alignItems: 'center', backgroundColor: C.surface2 },
  editToggleBtnActive:  { borderColor: C.sageM, backgroundColor: C.sageL },
  editToggleText:       { color: C.ink3, fontSize: 14, fontWeight: '700' },
  editToggleTextActive: { color: C.sage },

  editOptionList:        { gap: 10 },
  editOptionCard:        { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: C.surface2, borderRadius: 14, padding: 14, borderWidth: 1.5, borderColor: C.border },
  editOptionCardActive:  { borderColor: C.sageM, backgroundColor: C.sageL },
  optionGlyph:           { width: 38, height: 38, borderRadius: 12, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  editOptionLabel:       { color: C.ink2, fontSize: 14, fontWeight: '700' },
  editOptionLabelActive: { color: C.sage },
  editOptionDesc:        { color: C.ink3, fontSize: 11, lineHeight: 16, marginTop: 2 },

  radio:      { width: 20, height: 20, borderRadius: 10, borderWidth: 2, borderColor: C.border2, alignItems: 'center', justifyContent: 'center' },
  radioActive:{ borderColor: C.sage },
  radioDot:   { width: 10, height: 10, borderRadius: 5, backgroundColor: C.sage },
});

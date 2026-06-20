import React, { useRef, useState } from 'react';
import {
  Animated,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { BASE_URL } from '../../config/api';
import { C, g } from '../../styles/GlobalStyles';
import { saveSession } from '../../utils/session';

const GOAL_OPTIONS = [
  { key: 'lose_weight', label: 'Lose weight', desc: 'Steady deficit' },
  { key: 'maintain', label: 'Stay healthy', desc: 'Hold current weight' },
  { key: 'gain_weight', label: 'Gain weight', desc: 'Smart surplus' },
];

const GENDER_OPTIONS = [
  { key: 'male', label: 'Male' },
  { key: 'female', label: 'Female' },
];

const ACTIVITY_OPTIONS = [
  { key: 'sedentary', label: 'Sedentary', desc: 'Mostly sitting' },
  { key: 'light', label: 'Light', desc: '1-3 days/week' },
  { key: 'moderate', label: 'Moderate', desc: '3-5 days/week' },
  { key: 'active', label: 'Active', desc: '6-7 days/week' },
  { key: 'very_active', label: 'Athlete', desc: 'Hard daily work' },
];

const HEALTH_CONDITIONS = [
  { key: 'diabetes', label: 'Diabetes' },
  { key: 'hypertension', label: 'Hypertension' },
  { key: 'thyroid', label: 'Thyroid' },
  { key: 'pcos', label: 'PCOS' },
  { key: 'cholesterol', label: 'High Cholesterol' },
  { key: 'heart_disease', label: 'Heart Disease' },
  { key: 'acid_reflux', label: 'Acid Reflux' },
  { key: 'kidney', label: 'Kidney Support' },
  { key: 'anemia', label: 'Anemia' },
  { key: 'none', label: 'None' },
];

const ACTIVITY_MULTIPLIERS: Record<string, number> = {
  sedentary: 1.2,
  light: 1.375,
  moderate: 1.55,
  active: 1.725,
  very_active: 1.9,
};

const LIMITS = {
  nameMin: 2,
  nameMax: 40,
  ageMin: 13,
  ageMax: 100,
  weightMin: 30,
  weightMax: 300,
  heightMin: 100,
  heightMax: 250,
};

function calculateCalories({
  gender,
  weight,
  height,
  age,
  goalType,
  targetWeight,
  weeksToGoal,
  activityLevel,
}: {
  gender: string;
  weight: number;
  height: number;
  age: number;
  goalType: string;
  targetWeight: number | null;
  weeksToGoal: number | null;
  activityLevel: string;
}) {
  const bmr = gender === 'female'
    ? 10 * weight + 6.25 * height - 5 * age - 161
    : 10 * weight + 6.25 * height - 5 * age + 5;
  const tdee = Math.round(bmr * (ACTIVITY_MULTIPLIERS[activityLevel] ?? 1.375));

  if (goalType === 'maintain' || !targetWeight || !weeksToGoal) {
    return { targetCalories: tdee, weeklyWeightChange: 0, etaWeeks: null };
  }

  const weightDiff = Math.abs(weight - targetWeight);
  const rawDelta = (weightDiff * 7700) / (weeksToGoal * 7);
  const dailyDelta = Math.min(Math.round(rawDelta), 500);
  const targetCalories = goalType === 'lose_weight' ? tdee - dailyDelta : tdee + dailyDelta;
  const weeklyWeightChange = Math.round(((dailyDelta * 7) / 7700) * 100) / 100;
  const etaWeeks = weeklyWeightChange > 0 ? Math.round(weightDiff / weeklyWeightChange) : null;

  return { targetCalories: Math.round(targetCalories), weeklyWeightChange, etaWeeks };
}

function validateName(name: string) {
  const errors: Record<string, string> = {};
  const trimmed = name.trim();
  if (trimmed.length < LIMITS.nameMin) errors.name = 'Name must be at least 2 characters';
  if (trimmed.length > LIMITS.nameMax) errors.name = 'Name is too long';
  return errors;
}

function validateBody(age: string, weight: string, height: string, targetWeight: string, goalType: string) {
  const errors: Record<string, string> = {};
  const a = parseInt(age, 10);
  const w = parseFloat(weight);
  const h = parseFloat(height);

  if (!age || Number.isNaN(a) || a < LIMITS.ageMin || a > LIMITS.ageMax) {
    errors.age = 'Enter a valid age';
  }
  if (!weight || Number.isNaN(w) || w < LIMITS.weightMin || w > LIMITS.weightMax) {
    errors.weight = 'Enter weight in kg';
  }
  if (!height || Number.isNaN(h) || h < LIMITS.heightMin || h > LIMITS.heightMax) {
    errors.height = 'Enter height in cm';
  }

  if (goalType !== 'maintain') {
    const tw = parseFloat(targetWeight);
    if (!targetWeight || Number.isNaN(tw)) {
      errors.targetWeight = 'Enter target weight';
    } else if (!Number.isNaN(w)) {
      if (goalType === 'lose_weight' && tw >= w) errors.targetWeight = 'Target must be lower';
      if (goalType === 'gain_weight' && tw <= w) errors.targetWeight = 'Target must be higher';
    }
  }

  return errors;
}

export default function OnboardingScreen({ route, navigation }: any) {
  const { phone } = route.params;

  const [step, setStep] = useState(0);
  const [goalType, setGoalType] = useState('lose_weight');
  const [gender, setGender] = useState('male');
  const [activityLevel, setActivityLevel] = useState('light');
  const [name, setName] = useState('');
  const [age, setAge] = useState('');
  const [weight, setWeight] = useState('');
  const [height, setHeight] = useState('');
  const [targetWeight, setTargetWeight] = useState('');
  const [weeksToGoal, setWeeksToGoal] = useState('12');
  const [healthConditions, setHealthConditions] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const slideAnim = useRef(new Animated.Value(0)).current;
  const fadeAnim = useRef(new Animated.Value(1)).current;

  const parsedWeight = parseFloat(weight);
  const parsedHeight = parseFloat(height);
  const parsedAge = parseInt(age, 10);
  const parsedTarget = parseFloat(targetWeight);
  const parsedWeeks = parseInt(weeksToGoal, 10);

  const caloriePreview = !Number.isNaN(parsedWeight) && !Number.isNaN(parsedHeight) && !Number.isNaN(parsedAge)
    ? calculateCalories({
      gender,
      weight: parsedWeight,
      height: parsedHeight,
      age: parsedAge,
      goalType,
      targetWeight: Number.isNaN(parsedTarget) ? null : parsedTarget,
      weeksToGoal: Number.isNaN(parsedWeeks) ? null : parsedWeeks,
      activityLevel,
    })
    : null;

  const animateStep = (dir: 'forward' | 'back') => {
    const outX = dir === 'forward' ? -30 : 30;
    Animated.sequence([
      Animated.parallel([
        Animated.timing(fadeAnim, { toValue: 0, duration: 100, useNativeDriver: true }),
        Animated.timing(slideAnim, { toValue: outX, duration: 100, useNativeDriver: true }),
      ]),
      Animated.parallel([
        Animated.timing(fadeAnim, { toValue: 1, duration: 150, useNativeDriver: true }),
        Animated.timing(slideAnim, { toValue: 0, duration: 150, useNativeDriver: true }),
      ]),
    ]).start();
  };

  const goNext = () => {
    const nextErrors = step === 0
      ? validateName(name)
      : step === 1
        ? validateBody(age, weight, height, targetWeight, goalType)
        : {};
    if (Object.keys(nextErrors).length) {
      setErrors(nextErrors);
      return;
    }
    setErrors({});
    animateStep('forward');
    setStep(current => Math.min(current + 1, 2));
  };

  const goBack = () => {
    setErrors({});
    animateStep('back');
    setStep(current => Math.max(current - 1, 0));
  };

  const toggleCondition = (key: string) => {
    setHealthConditions(prev => {
      if (key === 'none') return ['none'];
      if (prev.includes(key)) return prev.filter(item => item !== key);
      return [...prev.filter(item => item !== 'none'), key];
    });
  };

  const save = async () => {
    const nextErrors = { ...validateName(name), ...validateBody(age, weight, height, targetWeight, goalType) };
    if (Object.keys(nextErrors).length || !caloriePreview) {
      setErrors(nextErrors);
      return;
    }

    try {
      setSaving(true);
      const cleanedConditions = healthConditions.includes('none') ? [] : healthConditions;
      const body = {
        name: name.trim(),
        goal_type: goalType,
        target_calories: caloriePreview.targetCalories,
        current_weight_kg: parsedWeight,
        height_cm: parsedHeight,
        target_weight_kg: Number.isNaN(parsedTarget) ? null : parsedTarget,
        age: parsedAge,
        gender,
        activity_level: activityLevel,
        health_conditions: cleanedConditions,
        weekly_weight_change_kg: caloriePreview.weeklyWeightChange,
        estimated_weeks_to_goal: caloriePreview.etaWeeks,
      };

      const res = await fetch(`${BASE_URL}/user/${phone}/goals`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json();

      if (data.ok) {
        await saveSession({ phone, loggedIn: true });
        navigation.replace('Dashboard', { phone });
      } else {
        console.log(data);
      }
    } catch (err) {
      console.log('Save onboarding error:', err);
    } finally {
      setSaving(false);
    }
  };

  const StepIdentity = (
    <View>
      <Text style={s.stepEyebrow}>Step 1</Text>
      <Text style={s.stepHeadline}>Your basic{'\n'}profile.</Text>
      <Text style={s.stepSub}>A name and goal is enough to begin.</Text>

      <Text style={g.fieldLabel}>Your name</Text>
      <View style={[g.inputWrap, errors.name ? g.inputError : name ? g.inputValid : null]}>
        <TextInput
          style={g.inputField}
          value={name}
          onChangeText={text => {
            setName(text);
            if (errors.name) setErrors(prev => ({ ...prev, name: '' }));
          }}
          placeholder="e.g. Priya"
          placeholderTextColor={C.ink4}
          selectionColor={C.sage}
          maxLength={LIMITS.nameMax}
          autoFocus
        />
        {name.trim().length >= LIMITS.nameMin && <Text style={g.inputCheck}>OK</Text>}
      </View>
      {errors.name ? <Text style={g.errorText}>{errors.name}</Text> : <View style={g.errorSpacer} />}

      <Text style={[g.fieldLabel, { marginTop: 8 }]}>Your goal</Text>
      <View style={s.goalList}>
        {GOAL_OPTIONS.map(option => (
          <TouchableOpacity
            key={option.key}
            style={[s.optionRow, goalType === option.key && s.optionRowActive]}
            onPress={() => {
              setGoalType(option.key);
              setTargetWeight('');
              setErrors(prev => ({ ...prev, targetWeight: '' }));
            }}
            activeOpacity={0.78}
          >
            <View style={[s.optionMark, goalType === option.key && s.optionMarkActive]} />
            <View style={{ flex: 1 }}>
              <Text style={[s.optionTitle, goalType === option.key && s.optionTitleActive]}>{option.label}</Text>
              <Text style={s.optionDesc}>{option.desc}</Text>
            </View>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );

  const StepBody = (
    <View>
      <Text style={s.stepEyebrow}>Step 2</Text>
      <Text style={s.stepHeadline}>Body and{'\n'}target.</Text>
      <Text style={s.stepSub}>These numbers power your calorie target.</Text>

      <Text style={g.fieldLabel}>Gender</Text>
      <View style={s.segment}>
        {GENDER_OPTIONS.map(option => (
          <TouchableOpacity
            key={option.key}
            style={[s.segmentBtn, gender === option.key && s.segmentBtnActive]}
            onPress={() => setGender(option.key)}
            activeOpacity={0.78}
          >
            <Text style={[s.segmentText, gender === option.key && s.segmentTextActive]}>{option.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <Text style={g.fieldLabel}>Measurements</Text>
      <View style={s.statsGrid}>
        <StatInput label="Age" value={age} unit="yrs" error={errors.age} onChange={setAge} placeholder="25" />
        <StatInput label="Height" value={height} unit="cm" error={errors.height} onChange={setHeight} placeholder="170" />
        <StatInput label="Current weight" value={weight} unit="kg" error={errors.weight} onChange={(value) => {
          setWeight(value);
          setTargetWeight('');
        }} placeholder="70" />
        {goalType !== 'maintain' ? (
          <StatInput
            label={goalType === 'lose_weight' ? 'Target weight' : 'Expected weight'}
            value={targetWeight}
            unit="kg"
            error={errors.targetWeight}
            onChange={setTargetWeight}
            placeholder={Number.isNaN(parsedWeight) ? '65' : goalType === 'lose_weight' ? `${Math.round(parsedWeight * 0.9)}` : `${Math.round(parsedWeight * 1.07)}`}
          />
        ) : (
          <View style={s.statCard}>
            <Text style={s.statLabel}>Goal type</Text>
            <Text style={s.maintainText}>Maintaining</Text>
          </View>
        )}
      </View>

      {goalType !== 'maintain' && (
        <>
          <Text style={[g.fieldLabel, { marginTop: 10 }]}>Goal timeline</Text>
          <View style={s.timelineRow}>
            {['8', '12', '16', '24'].map(item => (
              <TouchableOpacity
                key={item}
                style={[s.timelineChip, weeksToGoal === item && s.timelineChipActive]}
                onPress={() => setWeeksToGoal(item)}
                activeOpacity={0.78}
              >
                <Text style={[s.timelineText, weeksToGoal === item && s.timelineTextActive]}>{item} wks</Text>
              </TouchableOpacity>
            ))}
          </View>
        </>
      )}
    </View>
  );

  const StepLifestyle = (
    <View>
      <Text style={s.stepEyebrow}>Step 3</Text>
      <Text style={s.stepHeadline}>Lifestyle and{'\n'}activity.</Text>
      <Text style={s.stepSub}>Choose the closest match. Short and simple.</Text>

      <Text style={g.fieldLabel}>Activity level</Text>
      <View style={s.activityList}>
        {ACTIVITY_OPTIONS.map(option => (
          <TouchableOpacity
            key={option.key}
            style={[s.activityCard, activityLevel === option.key && s.activityCardActive]}
            onPress={() => setActivityLevel(option.key)}
            activeOpacity={0.78}
          >
            <View style={[s.activityDot, activityLevel === option.key && s.activityDotActive]} />
            <View style={{ flex: 1 }}>
              <Text style={[s.activityName, activityLevel === option.key && s.activityNameActive]}>{option.label}</Text>
              <Text style={s.activityDesc}>{option.desc}</Text>
            </View>
          </TouchableOpacity>
        ))}
      </View>

      <Text style={[g.fieldLabel, { marginTop: 12 }]}>Health conditions</Text>
      <Text style={s.shortHint}>Optional. Used to tailor suggestions.</Text>
      <View style={g.chipsRow}>
        {HEALTH_CONDITIONS.map(option => {
          const active = healthConditions.includes(option.key);
          return (
            <TouchableOpacity
              key={option.key}
              style={[g.chip, active && g.chipActive]}
              onPress={() => toggleCondition(option.key)}
              activeOpacity={0.78}
            >
              <Text style={[g.chipText, active && g.chipTextActive]}>{option.label}</Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {caloriePreview && (
        <View style={s.calorieBanner}>
          <View style={s.calorieIcon}>
            <Text style={s.calorieIconText}>kcal</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={s.calorieLabel}>Your daily target</Text>
            <Text style={s.calorieVal}>{caloriePreview.targetCalories.toLocaleString()} kcal / day</Text>
          </View>
          {caloriePreview.weeklyWeightChange > 0 && (
            <View style={s.calorieBadge}>
              <Text style={s.calorieBadgeText}>
                {goalType === 'lose_weight' ? '-' : '+'}{caloriePreview.weeklyWeightChange} kg/wk
              </Text>
            </View>
          )}
        </View>
      )}
    </View>
  );

  const steps = [StepIdentity, StepBody, StepLifestyle];
  const progress = (step + 1) / steps.length;
  const stepNames = ['Name & goal', 'Body target', 'Activity'];
  const isLast = step === steps.length - 1;

  return (
    <View style={g.root}>
      <StatusBar barStyle="dark-content" backgroundColor={C.cream} />

      <View style={s.topSpace} />
      <View style={g.progressTrack}>
        <Animated.View style={[g.progressFill, { width: `${progress * 100}%` }]} />
      </View>

      <View style={g.stepHeader}>
        <View style={g.stepPill}>
          <Text style={g.stepPillText}>{stepNames[step]}</Text>
        </View>
        <Text style={g.stepCount}>{step + 1} of {steps.length}</Text>
      </View>

      <ScrollView
        contentContainerStyle={s.scroll}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <Animated.View style={{ opacity: fadeAnim, transform: [{ translateX: slideAnim }] }}>
          {steps[step]}
        </Animated.View>
      </ScrollView>

      <View style={g.footer}>
        <TouchableOpacity
          style={[g.ctaBtn, saving && g.ctaDim]}
          onPress={isLast ? save : goNext}
          disabled={saving}
          activeOpacity={0.85}
        >
          <Text style={g.ctaText}>{saving ? 'Setting up...' : isLast ? 'Start tracking' : 'Continue'}</Text>
        </TouchableOpacity>

        {step > 0 && (
          <TouchableOpacity style={g.backBtn} onPress={goBack} activeOpacity={0.7}>
            <Text style={g.backText}>Back</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

function StatInput({
  label,
  value,
  unit,
  error,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  unit: string;
  error?: string;
  onChange: (value: string) => void;
  placeholder: string;
}) {
  return (
    <View style={[s.statCard, error ? s.statCardError : null]}>
      <Text style={s.statLabel}>{label}</Text>
      <View style={s.statValRow}>
        <TextInput
          style={s.statInput}
          value={value}
          onChangeText={onChange}
          keyboardType="numeric"
          placeholder={placeholder}
          placeholderTextColor={C.ink4}
          selectionColor={C.sage}
          maxLength={5}
        />
        <Text style={s.statUnit}>{unit}</Text>
      </View>
      {error ? <Text style={s.statError}>{error}</Text> : null}
    </View>
  );
}

const s = StyleSheet.create({
  topSpace: { height: 38, backgroundColor: C.cream },
  scroll: { paddingHorizontal: 24, paddingTop: 18, paddingBottom: 18 },
  stepEyebrow: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    color: C.sage,
    marginBottom: 8,
  },
  stepHeadline: {
    fontSize: 28,
    fontWeight: '800',
    color: C.ink,
    lineHeight: 34,
    marginBottom: 8,
  },
  stepSub: { fontSize: 13, color: C.ink2, lineHeight: 20, marginBottom: 24 },
  shortHint: { fontSize: 12, color: C.ink3, lineHeight: 18, marginBottom: 10 },
  goalList: { gap: 9, marginBottom: 20 },
  optionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: C.surface2,
    borderWidth: 1.5,
    borderColor: C.border,
    borderRadius: 12,
    padding: 14,
  },
  optionRowActive: { backgroundColor: C.sageL, borderColor: C.sageM },
  optionMark: { width: 18, height: 18, borderRadius: 9, borderWidth: 2, borderColor: C.border2 },
  optionMarkActive: { borderColor: C.sage, backgroundColor: C.sage },
  optionTitle: { color: C.ink2, fontSize: 14, fontWeight: '800' },
  optionTitleActive: { color: C.sage },
  optionDesc: { color: C.ink3, fontSize: 11, lineHeight: 16, marginTop: 2 },
  segment: {
    flexDirection: 'row',
    gap: 6,
    backgroundColor: C.surface2,
    borderWidth: 1.5,
    borderColor: C.border,
    borderRadius: 12,
    padding: 4,
    marginBottom: 18,
  },
  segmentBtn: { flex: 1, height: 38, borderRadius: 9, alignItems: 'center', justifyContent: 'center' },
  segmentBtnActive: { backgroundColor: C.surface },
  segmentText: { color: C.ink3, fontSize: 13, fontWeight: '800' },
  segmentTextActive: { color: C.ink },
  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 10 },
  statCard: {
    width: '48%',
    backgroundColor: C.surface2,
    borderRadius: 13,
    borderWidth: 1.5,
    borderColor: C.border,
    padding: 12,
    minHeight: 86,
  },
  statCardError: { borderColor: C.error },
  statLabel: { fontSize: 9.5, fontWeight: '800', letterSpacing: 0.5, textTransform: 'uppercase', color: C.ink3, marginBottom: 5 },
  statValRow: { flexDirection: 'row', alignItems: 'baseline', gap: 4 },
  statInput: { fontSize: 20, fontWeight: '800', color: C.ink, flex: 1, padding: 0 },
  statUnit: { fontSize: 12, fontWeight: '700', color: C.ink3 },
  statError: { fontSize: 10, color: C.error, marginTop: 4 },
  maintainText: { color: C.sage, fontSize: 14, fontWeight: '800', marginTop: 10 },
  timelineRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12 },
  timelineChip: {
    paddingHorizontal: 13,
    paddingVertical: 8,
    borderRadius: 99,
    backgroundColor: C.surface2,
    borderWidth: 1.5,
    borderColor: C.border,
  },
  timelineChipActive: { backgroundColor: C.sageL, borderColor: C.sageM },
  timelineText: { color: C.ink3, fontSize: 12, fontWeight: '800' },
  timelineTextActive: { color: C.sage },
  activityList: { gap: 9, marginBottom: 16 },
  activityCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: C.surface,
    borderWidth: 1.5,
    borderColor: C.border,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  activityCardActive: { backgroundColor: C.sageL, borderColor: C.sageM },
  activityDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: C.border2 },
  activityDotActive: { backgroundColor: C.sage },
  activityName: { color: C.ink2, fontSize: 14, fontWeight: '800' },
  activityNameActive: { color: C.sage },
  activityDesc: { color: C.ink3, fontSize: 11, marginTop: 2 },
  calorieBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: C.amberL,
    borderWidth: 1.5,
    borderColor: C.amberM,
    borderRadius: 14,
    padding: 14,
    marginTop: 6,
  },
  calorieIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: C.amberM,
    alignItems: 'center',
    justifyContent: 'center',
  },
  calorieIconText: { color: C.amber800, fontSize: 10, fontWeight: '900' },
  calorieLabel: { fontSize: 10, fontWeight: '800', letterSpacing: 0.5, textTransform: 'uppercase', color: C.amber, marginBottom: 2 },
  calorieVal: { fontSize: 15, fontWeight: '900', color: C.amber800 },
  calorieBadge: { backgroundColor: C.amberM, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 99 },
  calorieBadgeText: { fontSize: 10, fontWeight: '900', color: C.amber800 },
});

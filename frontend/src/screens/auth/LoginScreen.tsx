import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Animated,
  Modal,
  StatusBar,
  KeyboardAvoidingView,
  Platform,
  Image,
} from 'react-native';
import { BASE_URL } from '../../config/api';
import { C, g } from '../../styles/GlobalStyles';

// ─── Custom Alert ─────────────────────────────────────────────────────────────
function CustomAlert({
  visible, title, message, type = 'error', onClose,
}: {
  visible: boolean; title: string; message: string;
  type?: 'error' | 'success' | 'info'; onClose: () => void;
}) {
  const scaleAnim   = useRef(new Animated.Value(0.9)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.spring(scaleAnim,   { toValue: 1, useNativeDriver: true, tension: 120, friction: 8 }),
        Animated.timing(opacityAnim, { toValue: 1, duration: 180, useNativeDriver: true }),
      ]).start();
    } else {
      scaleAnim.setValue(0.9);
      opacityAnim.setValue(0);
    }
  }, [opacityAnim, scaleAnim, visible]);

  const accentColor = type === 'error' ? C.amber : C.sage;

  return (
    <Modal transparent visible={visible} animationType="none" statusBarTranslucent>
      <View style={al.overlay}>
        <Animated.View style={[al.box, { transform: [{ scale: scaleAnim }], opacity: opacityAnim }]}>
          <View style={[al.iconCircle, { borderColor: accentColor }]}>
            <Text style={[al.iconText, { color: accentColor }]}>
              {type === 'success' ? '✓' : type === 'info' ? 'i' : '!'}
            </Text>
          </View>
          <Text style={al.title}>{title}</Text>
          <Text style={al.message}>{message}</Text>
          <TouchableOpacity
            style={[al.btn, { backgroundColor: accentColor }]}
            onPress={onClose}
            activeOpacity={0.85}
          >
            <Text style={al.btnText}>Got it</Text>
          </TouchableOpacity>
        </Animated.View>
      </View>
    </Modal>
  );
}

// ─── Login Screen ─────────────────────────────────────────────────────────────
export default function LoginScreen({ navigation }: any) {
  const [phone,   setPhone]   = useState('');
  const [loading, setLoading] = useState(false);
  const [focused, setFocused] = useState(false);
  const [alert, setAlert] = useState<{
    visible: boolean; title: string; message: string; type: 'error' | 'success' | 'info';
  }>({ visible: false, title: '', message: '', type: 'error' });

  const buttonScale = useRef(new Animated.Value(1)).current;
  const fadeIn      = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(fadeIn, { toValue: 1, duration: 500, delay: 80, useNativeDriver: true }).start();
  }, [fadeIn]);

  const showAlert = (title: string, message: string, type: 'error' | 'success' | 'info' = 'error') =>
    setAlert({ visible: true, title, message, type });

  const formatPhone = (text: string) => {
    const digits = text.replace(/\D/g, '');
    if (digits.length <= 5) return digits;
    return `${digits.slice(0, 5)} ${digits.slice(5, 10)}`;
  };

  const handlePhoneChange = (text: string) => {
    const digits = text.replace(/\D/g, '');
    if (digits.length <= 10) setPhone(formatPhone(text));
  };

  const pressIn  = () => Animated.spring(buttonScale, { toValue: 0.97, useNativeDriver: true, tension: 200 }).start();
  const pressOut = () => Animated.spring(buttonScale, { toValue: 1,    useNativeDriver: true, tension: 200 }).start();

  const rawDigits = phone.replace(/\D/g, '');
  const isReady   = rawDigits.length === 10;

  const hintDotColor = rawDigits.length === 0 ? C.ink4 : isReady ? C.sage : C.amber;

  const sendOtp = async () => {
    if (!phone)    { showAlert('No number',  'Please enter your phone number to continue.'); return; }
    if (!isReady)  { showAlert('Incomplete', `Phone numbers must be 10 digits. You've entered ${rawDigits.length}.`); return; }

    // Instant navigation to prevent any UI delay for the user
    navigation.navigate('Otp', { phone: rawDigits });

    // Send the OTP request to the server in the background
    fetch(`${BASE_URL}/auth/send-otp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone: rawDigits }),
    }).catch(err => {
      console.log('Background send-otp error:', err);
    });
  };

  return (
    <KeyboardAvoidingView style={g.root} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <StatusBar barStyle="dark-content" backgroundColor={C.cream} />

      <Animated.ScrollView
        style={{ opacity: fadeIn }}
        contentContainerStyle={s.scroll}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Brand */}
        <View style={g.brand}>
          <Image 
            source={require('../../assets/logo.png')} 
            style={{ width: 48, height: 48, marginRight: 10 }} 
            resizeMode="contain" 
          />
          <View>
            <Text style={g.brandName}>caLos</Text>
            <Text style={g.brandTag}>AI-powered nutrition</Text>
          </View>
        </View>

        {/* Headline */}
        <Text style={g.eyebrow}>Welcome back</Text>
        <Text style={g.headline}>Your journey{'\n'}continues here.</Text>
        <Text style={g.subtitle}>Enter your mobile number and we'll send a quick verification code.</Text>

        {/* Phone input */}
        <Text style={g.fieldLabel}>Mobile number</Text>
        <View style={[s.phoneBox, focused && s.phoneBoxFocused]}>
          {/* Country prefix */}
          <View style={s.ccPill}>
            <Text style={s.ccFlag}>🇮🇳</Text>
            <Text style={s.ccCode}>+91</Text>
            <Text style={s.ccDivider}>|</Text>
          </View>

          <TextInput
            value={phone}
            onChangeText={handlePhoneChange}
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
            keyboardType="numeric"
            maxLength={11}
            style={s.phoneInput}
            selectionColor={C.sage}
            cursorColor={C.sage}
            placeholder="Phone number"
            placeholderTextColor={C.ink4}
          />
          {/* Digit count badge */}
          {rawDigits.length > 0 && (
            <View style={[s.badge, isReady && s.badgeReady]}>
              <Text style={[s.badgeText, isReady && s.badgeTextReady]}>
                {rawDigits.length}/10
              </Text>
            </View>
          )}
        </View>

        {/* 10-dot progress indicator */}
        <View style={s.dotsRow}>
          {Array.from({ length: 10 }).map((_, i) => (
            <View
              key={i}
              style={[
                s.dot,
                i < rawDigits.length && s.dotFilled,
                i === rawDigits.length - 1 && s.dotActive,
              ]}
            />
          ))}
        </View>

        {/* CTA */}
        <Animated.View style={{ transform: [{ scale: buttonScale }] }}>
          <TouchableOpacity
            style={[g.ctaBtn, (!isReady || loading) && g.ctaDim]}
            onPress={sendOtp}
            onPressIn={pressIn}
            onPressOut={pressOut}
            activeOpacity={1}
            disabled={loading}
          >
            <Text style={g.ctaText}>
              {loading ? 'Sending code…' : 'Send verification code  →'}
            </Text>
          </TouchableOpacity>
        </Animated.View>

        {/* Terms */}
        <Text style={[g.terms, { marginTop: 8 }]}>
          By continuing you agree to our{' '}
          <Text style={g.termsLink}>Terms of Service</Text>
          {' '}and{' '}
          <Text style={g.termsLink}>Privacy Policy</Text>
        </Text>
      </Animated.ScrollView>

      <CustomAlert
        visible={alert.visible}
        title={alert.title}
        message={alert.message}
        type={alert.type}
        onClose={() => setAlert(a => ({ ...a, visible: false }))}
      />
    </KeyboardAvoidingView>
  );
}

// ─── Screen-specific Styles ───────────────────────────────────────────────────
const s = StyleSheet.create({
  scroll: {
    paddingHorizontal: 28,
    paddingTop: 80,   // ← extra top breathing room
    paddingBottom: 48,
  },

  phoneBox: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: C.surface2, borderWidth: 1.5,
    borderColor: C.border, borderRadius: 14,
    overflow: 'visible', height: 54, position: 'relative',
  },
  phoneBoxFocused: { borderColor: C.sage, backgroundColor: C.surface },

  ccPill: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 12, gap: 5,
    borderRightWidth: 1.5, borderRightColor: C.border,
    height: '100%',
  },
  ccFlag:    { fontSize: 16 },
  ccCode:    { color: C.ink2, fontSize: 13, fontWeight: '700' },
  ccDivider: { color: C.border2, fontSize: 18, marginLeft: 6 },

  phoneInput: {
    flex: 1, color: C.ink, fontSize: 16,
    fontWeight: '600', letterSpacing: 1.2,
    paddingHorizontal: 12, height: '100%',
  },

  // 10-dot progress
  dotsRow: { flexDirection: 'row', gap: 6, marginTop: 10, marginBottom: 28 },
  dot: {
    flex: 1, height: 4, borderRadius: 2,
    backgroundColor: C.border,
  },
  dotFilled: { backgroundColor: '#6BAE8E' },
  dotActive: {
    backgroundColor: '#6BAE8E',
    shadowColor: '#6BAE8E', shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.5, shadowRadius: 4,
  },

  // Digit badge
  badge: {
    marginRight: 12,
    paddingHorizontal: 8, paddingVertical: 3,
    borderRadius: 8,
    backgroundColor: C.surface3,
  },
  badgeReady: { backgroundColor: '#E2F2EB' },
  badgeText: { fontSize: 11, fontWeight: '700', color: C.ink3 },
  badgeTextReady: { color: '#4A8A6A' },

  hintRow:  { flexDirection: 'row', alignItems: 'center', gap: 7, marginTop: 8, marginBottom: 24 },
  hintDot:  { width: 6, height: 6, borderRadius: 3 },
  hintText: { fontSize: 12, color: C.ink3, fontWeight: '500' },
});

// ─── Alert Styles ─────────────────────────────────────────────────────────────
const al = StyleSheet.create({
  overlay: {
    flex: 1, backgroundColor: 'rgba(20,18,14,0.55)',
    justifyContent: 'center', alignItems: 'center', paddingHorizontal: 32,
  },
  box: {
    backgroundColor: C.surface, borderRadius: 22, padding: 28,
    width: '100%', alignItems: 'center',
    borderWidth: 1, borderColor: C.border,
  },
  iconCircle: {
    width: 52, height: 52, borderRadius: 26,
    borderWidth: 2, alignItems: 'center',
    justifyContent: 'center', marginBottom: 16,
  },
  iconText: { fontSize: 20, fontWeight: '800' },
  title:    { color: C.ink, fontSize: 18, fontWeight: '700', marginBottom: 8, textAlign: 'center' },
  message:  { color: C.ink2, fontSize: 13.5, textAlign: 'center', lineHeight: 20, marginBottom: 24 },
  btn:      { width: '100%', paddingVertical: 14, borderRadius: 12, alignItems: 'center' },
  btnText:  { color: '#fff', fontSize: 14, fontWeight: '700' },
});

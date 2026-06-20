import React, { useState, useRef, useEffect } from 'react';
import { saveSession } from '../../utils/session';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Animated,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  StatusBar,
  Modal,
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
  }, [visible]);

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

// ─── OTP Screen ───────────────────────────────────────────────────────────────
export default function OtpScreen({ route, navigation }: any) {
  const { phone } = route.params;

  const [otp,     setOtp]     = useState('');
  const [loading, setLoading] = useState(false);
  const [alert,   setAlert]   = useState({
    visible: false, title: '', message: '', type: 'error' as 'error' | 'success' | 'info',
  });

  const buttonScale = useRef(new Animated.Value(1)).current;
  const fadeIn      = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(fadeIn, { toValue: 1, duration: 500, delay: 80, useNativeDriver: true }).start();
  }, []);

  const showAlert = (title: string, message: string, type: 'error' | 'success' | 'info' = 'error') =>
    setAlert({ visible: true, title, message, type });

  const pressIn  = () => Animated.spring(buttonScale, { toValue: 0.97, useNativeDriver: true, tension: 200 }).start();
  const pressOut = () => Animated.spring(buttonScale, { toValue: 1,    useNativeDriver: true, tension: 200 }).start();

  const isReady = otp.length === 6;

 


  const verifyOtp = async () => {
    if (!isReady) {
      showAlert('Invalid Code', 'Please enter the 6-digit code sent to your phone.');
      return;
    }
    try {
      setLoading(true);
      const res  = await fetch(`${BASE_URL}/auth/verify-otp`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ phone, otp }),
      });
      const data = await res.json();

      if (data.error) { showAlert('Verification Failed', data.error); return; }

      if (data.next === 'dashboard') {
        await saveSession({ phone, loggedIn: true });
        showAlert('Welcome back!', 'Verification successful.', 'success');
        setTimeout(() => navigation.replace('Dashboard', { phone }), 500);
      } else {
        showAlert('Verified', "Let's set up your profile.", 'success');
        setTimeout(() => navigation.replace('Onboarding', { phone }), 500);
      }
    } catch {
      showAlert('Network Error', 'Could not reach the server. Check your connection.');
    } finally {
      setLoading(false);
    }
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
          <View style={g.brandMark}>
            <Text style={g.brandGlyph}>N</Text>
          </View>
          <View>
            <Text style={g.brandName}>Nourish</Text>
            <Text style={g.brandTag}>AI-powered nutrition</Text>
          </View>
        </View>

        {/* Headline */}
        <Text style={g.eyebrow}>Verification</Text>
        <Text style={g.headline}>Check your{'\n'}messages.</Text>
        <Text style={g.subtitle}>
          We sent a 6-digit code to{'\n'}
          <Text style={s.phoneHighlight}>+91 {phone}</Text>
        </Text>

       

        {/* OTP input */}
        <Text style={g.fieldLabel}>Verification code</Text>
        <View style={[s.inputBox, isReady && s.inputBoxReady]}>
          <TextInput
            value={otp}
            onChangeText={t => setOtp(t.replace(/\D/g, ''))}
            keyboardType="numeric"
            maxLength={6}
            style={s.otpInput}
            placeholder="· · · · · ·"
            placeholderTextColor={C.ink4}
            selectionColor={C.sage}
            cursorColor={C.sage}
            autoFocus
          />
        </View>

        {/* Hint */}
        <View style={s.hintRow}>
        
        </View>

        {/* CTA */}
        <Animated.View style={{ transform: [{ scale: buttonScale }] }}>
          <TouchableOpacity
            style={[g.ctaBtn, (!isReady || loading) && g.ctaDim]}
            onPress={verifyOtp}
            onPressIn={pressIn}
            onPressOut={pressOut}
            activeOpacity={1}
            disabled={loading}
          >
            <Text style={g.ctaText}>
              {loading ? 'Verifying…' : 'Verify code  →'}
            </Text>
          </TouchableOpacity>
        </Animated.View>

        {/* Back */}
        <TouchableOpacity
          style={s.backRow}
          onPress={() => navigation.goBack()}
          activeOpacity={0.7}
        >
          <Text style={s.backText}>← Change number</Text>
        </TouchableOpacity>
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
    paddingTop: 80,
    paddingBottom: 48,
  },

  phoneHighlight: {
    color: C.sage,
    fontWeight: '700',
  },

  // OTP dot tracker
  dotRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 28,
  },
  otpDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: C.border,
    borderWidth: 1.5,
    borderColor: C.border2,
  },
  otpDotFilled: {
    backgroundColor: C.sage,
    borderColor: C.sage,
  },
  otpDotActive: {
    borderColor: C.sage,
    backgroundColor: C.sageL,
  },

  inputBox: {
    backgroundColor: C.surface2,
    borderWidth: 1.5,
    borderColor: C.border,
    borderRadius: 14,
    height: 60,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
  },
  inputBoxReady: {
    borderColor: C.sage,
    backgroundColor: C.surface,
  },

  otpInput: {
    width: '100%',
    textAlign: 'center',
    letterSpacing: 14,
    fontSize: 26,
    fontWeight: '700',
    color: C.ink,
    padding: 0,
  },

  hintRow:  { flexDirection: 'row', alignItems: 'center', gap: 7, marginTop: 8, marginBottom: 24 },
  hintDot:  { width: 6, height: 6, borderRadius: 3 },
  hintText: { fontSize: 12, color: C.ink3, fontWeight: '500' },

  backRow: { alignItems: 'center', marginTop: 8, paddingVertical: 8 },
  backText: { color: C.ink3, fontSize: 13, fontWeight: '600' },
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

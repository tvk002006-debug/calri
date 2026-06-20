import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  Image,
  StyleSheet,
  TouchableOpacity,
  Animated,
  StatusBar,
  Dimensions,
  ImageBackground,
} from 'react-native';

const { width, height } = Dimensions.get('window');

const P = {
  pink:     '#E8497A',   
  pinkDark: '#C73060',
  text:     '#101828',
  textSub:  '#475467',
  white:    '#FFFFFF',
};

export default function WelcomeScreen({ navigation }: any) {
  const fadeAnim    = useRef(new Animated.Value(0)).current;
  const textSlide   = useRef(new Animated.Value(-30)).current;
  const btnScale    = useRef(new Animated.Value(0.85)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim,  { toValue: 1, duration: 700, useNativeDriver: true }),
      Animated.timing(textSlide, { toValue: 0, duration: 650, delay: 100, useNativeDriver: true }),
      Animated.spring(btnScale,  { toValue: 1, friction: 7, tension: 60, delay: 500, useNativeDriver: true } as any),
    ]).start();
  }, []);

  return (
    <View style={s.root}>
      <StatusBar barStyle="dark-content" backgroundColor="transparent" translucent={true} />

      <ImageBackground
        source={require('../../assets/splash_v2.png')}
        style={s.background}
        resizeMode="cover"
      >
        <View style={s.overlay}>
          {/* ── Top nav bar ───────────────────────────────────────────── */}
          <Animated.View style={[s.topBar, { opacity: fadeAnim }]}>
            <View style={s.brandRow}>
              <View style={s.brandIconWrap}>
                 <Image 
                   source={require('../../assets/logo.png')} 
                   style={{ width: 48, height: 48 }} 
                   resizeMode="contain" 
                 />
              </View>
              <View>
                <Text style={s.brandName}>caLos</Text>
                <Text style={s.brandTagline}>
                  <Text style={{ color: '#F43F5E' }}>Track. </Text>
                  <Text style={{ color: '#D946EF' }}>Balance. </Text>
                  <Text style={{ color: '#F43F5E' }}>You.</Text>
                </Text>
              </View>
            </View>
            
          </Animated.View>

          {/* ── Left side text block ───────────────────────────────────── */}
          <Animated.View
            style={[
              s.textBlock,
              {
                opacity: fadeAnim,
                transform: [{ translateX: textSlide }],
              },
            ]}
          >
            <Text style={s.headlineBlack}>Track Calories.</Text>
            <Text style={s.headlineBlack}>Balance Life.</Text>
            <Text style={s.headlinePink}>Be You.</Text>

            <Text style={s.subtitle}>
              Simple tools to eat better,{'\n'}stay active and reach{'\n'}your goals.
            </Text>

            {/* CTA button */}
            <Animated.View style={{ transform: [{ scale: btnScale }] }}>
              <TouchableOpacity
                style={s.ctaBtn}
                onPress={() => navigation.navigate('Login')}
                activeOpacity={0.85}
              >
                <Text style={s.ctaText}>Get Started</Text>
                <Text style={s.ctaArrow}>→</Text>
              </TouchableOpacity>
            </Animated.View>
          </Animated.View>

        </View>
      </ImageBackground>
    </View>
  );
}

const s = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#fff',
  },
  background: {
    flex: 1,
    width: '100%',
    height: '100%',
  },
  overlay: {
    flex: 1,
    paddingTop: height * 0.06, 
  },

  // top nav
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 24,
    zIndex: 10,
  },
  brandRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  brandIconWrap: {
    width: 48, height: 48,
    alignItems: 'center', justifyContent: 'center',
  },
  brandName:    { color: P.text, fontSize: 26, fontWeight: '900', letterSpacing: -0.5 },
  brandTagline: { fontSize: 11, fontWeight: '900', letterSpacing: 0.2 },

  hamburger: { 
    width: 44, height: 44, 
    backgroundColor: '#fff', 
    borderRadius: 14, 
    alignItems: 'center', justifyContent: 'center', 
    gap: 4,
    shadowColor: P.pink, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.1, shadowRadius: 8, elevation: 3,
  },
  hLine: { width: 16, height: 2, backgroundColor: P.pink, borderRadius: 2 },

  // text block (left)
  textBlock: {
    marginTop: height * 0.05, // Moved up a little based on your request
    paddingHorizontal: 24,
    zIndex: 10,
  },
  headlineBlack: {
    color: P.text,
    fontSize: 34,
    fontWeight: '800',
    letterSpacing: -0.5,
    lineHeight: 40,
  },
  headlinePink: {
    color: P.pink,
    fontSize: 34,
    fontWeight: '800',
    letterSpacing: -0.5,
    lineHeight: 40,
    marginBottom: 12, // Slightly tighter
  },
  subtitle: {
    color: P.textSub,
    fontSize: 14,
    lineHeight: 22,
    fontWeight: '500',
    marginBottom: 20, // Moved button up closer to text
  },

  // CTA
  ctaBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: P.pink,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 12,
    alignSelf: 'flex-start',
    shadowColor: P.pink,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 10,
    elevation: 6,
  },
  ctaText:  { color: P.white, fontSize: 13, fontWeight: '700' },
  ctaArrow: { color: P.white, fontSize: 14, fontWeight: '700', marginLeft: 6 },

  // scroll hint
  scrollHint: {
    position: 'absolute',
    bottom: height * 0.05,
    alignSelf: 'center',
    alignItems: 'center',
    gap: 6,
    zIndex: 20,
  },
  scrollPill: {
    width: 22,
    height: 34,
    borderRadius: 11,
    borderWidth: 1.5,
    borderColor: P.pink,
    alignItems: 'center',
    paddingTop: 6,
  },
  scrollDot: {
    width: 4,
    height: 6,
    borderRadius: 2,
    backgroundColor: P.pink,
  },
  scrollText: {
    color: P.textSub,
    fontSize: 11,
    fontWeight: '600',
  },
});

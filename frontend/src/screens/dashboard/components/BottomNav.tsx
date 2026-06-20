import React, { useCallback, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Animated,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Circle, Path } from 'react-native-svg';
import { C } from '../../../styles/GlobalStyles';

const TABS = [
  { key: 'suggestions', label: 'Coach', icon: 'sparkles' },
  { key: 'daily', label: 'Today', icon: 'sun' },
  { key: 'weekly', label: 'Week', icon: 'calendar' },
  { key: 'profile', label: 'Profile', icon: 'user' },
];

// Camera icon component
function CameraNavIcon({ size = 20, color = C.sage }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Circle cx="12" cy="13" r="4" stroke={color} strokeWidth="2" />
    </Svg>
  );
}

export default function BottomNav({
  tab,
  onTab,
  onVoiceToggle,
  onCameraPress,
  isListening,
  isThinking,
}: any) {
  const insets = useSafeAreaInsets();
  const voiceScale = useRef(new Animated.Value(1)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const pulseLoop = useRef<any>(null);

  // Pulse animation when listening
  const startPulse = useCallback(() => {
    pulseLoop.current?.stop();
    pulseLoop.current = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.4, duration: 600, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1, duration: 600, useNativeDriver: true }),
      ])
    );
    pulseLoop.current.start();
  }, [pulseAnim]);

  const stopPulse = useCallback(() => {
    pulseLoop.current?.stop();
    Animated.spring(pulseAnim, { toValue: 1, useNativeDriver: true, tension: 200 }).start();
  }, [pulseAnim]);

  useEffect(() => {
    if (isListening) startPulse();
    else stopPulse();
    return () => { pulseLoop.current?.stop(); };
  }, [isListening, startPulse, stopPulse]);

  const handleVoicePress = () => {
    if (isThinking) return;
    Animated.sequence([
      Animated.spring(voiceScale, { toValue: 0.92, useNativeDriver: true, tension: 200 }),
      Animated.spring(voiceScale, { toValue: 1, useNativeDriver: true, tension: 200 }),
    ]).start();
    onVoiceToggle?.();
  };

  const getStatusText = () => {
    if (isListening) return 'Tap to stop';
    if (isThinking) return 'Thinking...';
    return 'Tap to speak';
  };

  return (
    <View style={[styles.wrapper, { paddingBottom: Math.max(insets.bottom, 12) }]}>
      {/* Floating Camera Button - Above navbar on right */}
      <TouchableOpacity
        style={styles.floatingCameraButton}
        onPress={onCameraPress}
        activeOpacity={0.85}
      >
        <CameraNavIcon size={22} color="#fff" />
      </TouchableOpacity>

      <View style={styles.container}>
        {/* Tab buttons */}
        <View style={styles.tabsRow}>
          {TABS.slice(0, 2).map(t => (
            <TabButton
              key={t.key}
              tab={t}
              isActive={tab === t.key}
              onPress={() => onTab(t.key)}
            />
          ))}

          {/* Voice Button */}
          <View style={styles.voiceContainer}>
            {isListening && (
              <Animated.View
                pointerEvents="none"
                style={[styles.pulseRing, { transform: [{ scale: pulseAnim }] }]}
              />
            )}
            <Animated.View style={{ transform: [{ scale: voiceScale }] }}>
              <TouchableOpacity
                style={[styles.voiceButton, (isListening || isThinking) && styles.voiceButtonActive]}
                onPress={handleVoicePress}
                activeOpacity={0.9}
                disabled={isThinking}
              >
                <MicIcon active={isListening || isThinking} />
              </TouchableOpacity>
            </Animated.View>
            <Text style={[styles.voiceText, (isListening || isThinking) && styles.voiceTextActive]}>
              {getStatusText()}
            </Text>
          </View>

          {TABS.slice(2).map(t => (
            <TabButton
              key={t.key}
              tab={t}
              isActive={tab === t.key}
              onPress={() => onTab(t.key)}
            />
          ))}
        </View>
      </View>
    </View>
  );
}

function TabButton({ tab, isActive, onPress }: { tab: any; isActive: boolean; onPress: () => void }) {
  return (
    <TouchableOpacity style={styles.tabButton} onPress={onPress} activeOpacity={0.7}>
      <TabIcon name={tab.icon} isActive={isActive} />
      <Text style={[styles.tabLabel, isActive && styles.tabLabelActive]}>{tab.label}</Text>
      {isActive && <View style={styles.activeIndicator} />}
    </TouchableOpacity>
  );
}

function TabIcon({ name, isActive }: { name: string; isActive: boolean }) {
  const color = isActive ? C.sage : C.ink3;
  const size = 24;

  return (
    <View style={styles.iconContainer}>
      <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
        {name === 'sparkles' && (
          <>
            <Path d="M12 3L13.5 8.5L19 9L14.5 12L16 17.5L12 14.5L8 17.5L9.5 12L5 9L10.5 8.5L12 3Z" stroke={color} strokeWidth={isActive ? 2 : 1.5} strokeLinecap="round" strokeLinejoin="round" />
          </>
        )}
        {name === 'sun' && (
          <>
            <Circle cx="12" cy="12" r="4" stroke={color} strokeWidth={isActive ? 2 : 1.5} />
            <Path d="M12 2V4M12 20V22M4.93 4.93L6.34 6.34M17.66 17.66L19.07 19.07M2 12H4M20 12H22M4.93 19.07L6.34 17.66M17.66 6.34L19.07 4.93" stroke={color} strokeWidth={isActive ? 2 : 1.5} strokeLinecap="round" />
          </>
        )}
        {name === 'calendar' && (
          <>
            <Path d="M8 2V6M16 2V6M3 10H21M5 6H19C20.1046 6 21 6.89543 21 8V19C21 20.1046 20.1046 21 19 21H5C3.89543 21 3 20.1046 3 19V8C3 6.89543 3.89543 6 5 6Z" stroke={color} strokeWidth={isActive ? 2 : 1.5} strokeLinecap="round" strokeLinejoin="round" />
          </>
        )}
        {name === 'user' && (
          <>
            <Path d="M20 21V19C20 17.9391 19.5786 16.9217 18.8284 16.1716C18.0783 15.4214 17.0609 15 16 15H8C6.93913 15 5.92172 15.4214 5.17157 16.1716C4.42143 16.9217 4 17.9391 4 19V21" stroke={color} strokeWidth={isActive ? 2 : 1.5} strokeLinecap="round" strokeLinejoin="round" />
            <Circle cx="12" cy="8" r="4" stroke={color} strokeWidth={isActive ? 2 : 1.5} strokeLinecap="round" strokeLinejoin="round" />
          </>
        )}
      </Svg>
    </View>
  );
}

function MicIcon({ active }: { active: boolean }) {
  const color = active ? '#fff' : C.sage;
  return (
    <Svg width={28} height={28} viewBox="0 0 24 24" fill="none">
      <Path
        d="M12 18C14.2091 18 16 16.2091 16 14V6C16 3.79086 14.2091 2 12 2C9.79086 2 8 3.79086 8 6V14C8 16.2091 9.79086 18 12 18Z"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path
        d="M4.5 12C4.5 15.0376 6.96243 17.5 10 17.5H14C17.0376 17.5 19.5 15.0376 19.5 12"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path
        d="M12 21V19"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    backgroundColor: C.cream,
  },
  container: {
    marginHorizontal: 16,
    marginBottom: 8,
  },
  tabsRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    backgroundColor: C.surface,
    borderRadius: 24,
    paddingHorizontal: 8,
    paddingTop: 8,
    paddingBottom: 12,
    shadowColor: C.ink,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 8,
  },
  tabButton: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    position: 'relative',
  },
  iconContainer: {
    width: 28,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  tabLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: C.ink3,
    letterSpacing: 0.3,
  },
  tabLabelActive: {
    color: C.sage,
  },
  activeIndicator: {
    position: 'absolute',
    bottom: -4,
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: C.sage,
  },
  floatingCameraButton: {
    position: 'absolute',
    right: 36,
    top: -84,
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: C.sage,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: C.ink,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.15,
    shadowRadius: 6,
    elevation: 4,
    zIndex: 100,
  },
  voiceContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    width: 100,
    marginTop: -20,
  },
  pulseRing: {
    position: 'absolute',
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: `${C.sage}30`,
    top: -4,
  },
  voiceButton: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: C.surface,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: C.ink,
    shadowOffset: { width: 0, height: 6 },
    shadowRadius: 16,
    shadowOpacity: 0.15,
    elevation: 10,
  },
  voiceButtonActive: {
    backgroundColor: C.sage,
    shadowOpacity: 0.6,
  },
  voiceText: {
    marginTop: 8,
    fontSize: 10,
    fontWeight: '600',
    color: C.ink3,
    letterSpacing: 0.3,
  },
  voiceTextActive: {
    color: C.sage,
  },
});

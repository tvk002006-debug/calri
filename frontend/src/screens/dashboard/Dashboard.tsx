import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Animated,
  StyleSheet,
  StatusBar,
  NativeModules,
  PermissionsAndroid,
  ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Path } from 'react-native-svg';

import LiveAudioStream from 'react-native-live-audio-stream';
import InCallManager from 'react-native-incall-manager';
import { BASE_URL } from '../../config/api';
import BottomNav from './components/BottomNav';
import ConfirmLogScreen from './ConfirmLogScreen';
import CameraScreen from './CameraScreen';
import DailyTab from './tabs/DailyTab';
import WeeklyTab from './tabs/WeeklyTab';
import ProfileTab from './tabs/ProfileTab';
import SuggestionTab from './tabs/SuggestionTab';
import { BACKEND_WS } from '../../config/voice';
import { C } from '../../styles/GlobalStyles';
const { PCMPlayer } = NativeModules;


const BAR_CONFIGS = [
  { init: 6,  min: 4,  max: 20, dur: 350 },
  { init: 14, min: 7,  max: 28, dur: 470 },
  { init: 22, min: 10, max: 32, dur: 590 },
  { init: 12, min: 5,  max: 24, dur: 430 },
  { init: 18, min: 8,  max: 30, dur: 510 },
  { init: 8,  min: 4,  max: 18, dur: 380 },
];

function VoiceWaveform() {
  const a0 = useRef(new Animated.Value(BAR_CONFIGS[0].init)).current;
  const a1 = useRef(new Animated.Value(BAR_CONFIGS[1].init)).current;
  const a2 = useRef(new Animated.Value(BAR_CONFIGS[2].init)).current;
  const a3 = useRef(new Animated.Value(BAR_CONFIGS[3].init)).current;
  const a4 = useRef(new Animated.Value(BAR_CONFIGS[4].init)).current;
  const a5 = useRef(new Animated.Value(BAR_CONFIGS[5].init)).current;
  const anims = [a0, a1, a2, a3, a4, a5];

  useEffect(() => {
    const loops = anims.map((anim, idx) => {
      const { min, max, dur } = BAR_CONFIGS[idx];
      return Animated.loop(
        Animated.sequence([
          Animated.timing(anim, { toValue: max, duration: dur, useNativeDriver: false }),
          Animated.timing(anim, { toValue: min, duration: dur, useNativeDriver: false }),
        ])
      );
    });
    loops.forEach(l => l.start());
    return () => loops.forEach(l => l.stop());
  }, []);

  return (
    <View style={s.waveContainer}>
      {anims.map((anim, idx) => (
        <Animated.View key={idx} style={[s.waveBar, { height: anim }]} />
      ))}
    </View>
  );
}

// Mirrors models.py MEAL_SLOTS order
const MEAL_SLOT_KEYS = [
  'breakfast', 'morning_snack', 'lunch',
  'evening_snack', 'dinner',
];

export default function DashboardScreen({ route }: any) {
  const phone = route?.params?.phone;
  const insets = useSafeAreaInsets();

  const [tab,         setTab]         = useState<'daily' | 'weekly' | 'profile' | 'suggestions'>('daily');
  const [isListening, setIsListening] = useState(false);
  const [isThinking,  setIsThinking]  = useState(false);
  const [status,      setStatus]      = useState('Ready');
  const [loading,     setLoading]     = useState(true);
  const [voiceOverlayVisible, setVoiceOverlayVisible] = useState(false);
  const [transcript,          setTranscript]          = useState('');
  const [audioChunks,         setAudioChunks]         = useState(0);

  const [userData,   setUserData]   = useState<any>(null);
  const [todayData,  setTodayData]  = useState<any>(null);
  const [weeklyData, setWeeklyData] = useState<any>(null);

  const [confirmPage, setConfirmPage] = useState<{
    visible: boolean;
    items: any[];
    total: number;
    meal_type: string;
    source: 'voice' | 'photo';
  }>({
    visible: false, items: [], total: 0, meal_type: '', source: 'voice',
  });

  const [cameraVisible, setCameraVisible] = useState(false);

  const ws = useRef<WebSocket | null>(null);
  const recordingRef = useRef(false);
  const startingRef = useRef(false);
  const cancelStartRef = useRef(false);
  const audioChunksRef = useRef(0);
  const audioReadyRef = useRef(false);

  // ─────────────────────────────────────────────
  // DATA FETCH
  // ─────────────────────────────────────────────
  const loadAll = async (showLoading = true) => {
    try {
      if (showLoading) setLoading(true);
      const [profileRes, dailyRes, weeklyRes] = await Promise.all([
        fetch(`${BASE_URL}/user/${phone}`),
        fetch(`${BASE_URL}/dashboard/daily/${phone}`),
        fetch(`${BASE_URL}/dashboard/weekly/${phone}`),
      ]);
      const [profile, daily, weekly] = await Promise.all([
        profileRes.json(),
        dailyRes.json(),
        weeklyRes.json(),
      ]);
      setUserData(profile);
      setTodayData(daily);
      setWeeklyData(weekly);
    } catch (e) {
      console.log('loadAll error:', e);
    } finally {
      if (showLoading) setLoading(false);
    }
  };

  const refreshData = async () => {
    try {
      const [dailyRes, weeklyRes] = await Promise.all([
        fetch(`${BASE_URL}/dashboard/daily/${phone}`),
        fetch(`${BASE_URL}/dashboard/weekly/${phone}`),
      ]);
      const [daily, weekly] = await Promise.all([
        dailyRes.json(),
        weeklyRes.json(),
      ]);
      setTodayData(daily);
      setWeeklyData(weekly);
    } catch (e) {
      console.log('refreshData error:', e);
    }
  };

  // ─────────────────────────────────────────────
  // WEBSOCKET
  // ─────────────────────────────────────────────
  const waitForSocket = () =>
    new Promise<boolean>(resolve => {
      if (ws.current?.readyState === WebSocket.OPEN) {
        resolve(true);
        return;
      }
      const started = Date.now();
      const timer = setInterval(() => {
        if (ws.current?.readyState === WebSocket.OPEN) {
          clearInterval(timer);
          resolve(true);
        } else if (Date.now() - started > 4000) {
          clearInterval(timer);
          resolve(false);
        }
      }, 100);
    });

  const connect = () => {
    if (ws.current?.readyState === WebSocket.OPEN) return;

    ws.current = new WebSocket(BACKEND_WS);

    ws.current.onopen = () => {
      PCMPlayer?.init?.(24000, 1);
      ws.current?.send(JSON.stringify({ type: 'init', phone }));
    };

    ws.current.onerror = () => {
      console.log('ws error');
    };

    ws.current.onclose = () => {
      console.log('ws closed, reconnecting...');
      setTimeout(connect, 1500);
    };

    ws.current.onmessage = e => {
      try {
        const msg = JSON.parse(e.data);

        // ── UI state updates from backend ──
        if (msg.type === 'ui') {
          if (msg.state === 'thinking') {
            setIsThinking(true);
            setIsListening(false);
            setStatus('Thinking...');
          } else if (msg.state === 'speaking') {
            setIsThinking(false);
            setIsListening(false);
            setStatus('Speaking...');
          } else if (msg.state === 'ready') {
            setIsThinking(false);
            setIsListening(false);
            setStatus('Ready');
            setVoiceOverlayVisible(false);
          }
        }

        // ── Real-time transcript from backend ──
        if (msg.type === 'transcript') {
          setTranscript(msg.text);
          if (!msg.interim) {
            setVoiceOverlayVisible(true);
          }
        }

        if (msg.type === 'error') {
          setStatus(msg.message || 'Voice error');
          setIsListening(false);
          setIsThinking(false);
        }

        // ── Audio playback ──
        if (msg.type === 'audio') {
          // Ensure speaker is on for voice playback
          InCallManager.setForceSpeakerphoneOn(true);
          PCMPlayer?.playBase64?.(msg.data);
        }

        // ── Food detected — show confirmation page ──
        if (msg.type === 'food_detected') {
          setVoiceOverlayVisible(currentVisible => {
            if (currentVisible) {
              setConfirmPage({
                visible: true,
                items: msg.items,
                total: msg.total,
                meal_type: msg.meal_type,
                source: 'voice',
              });
            }
            return false;
          });
        }

        // ── Calorie logged — update breakdown + consumed total ──
        if (msg.type === 'calories') {
          setTodayData((prev: any) => {
            if (!prev) return prev;

            const prevToday    = prev.today ?? {};
            const prevBreakdown: Record<string, any> = prevToday.meal_breakdown ?? {};

            // Ensure all slots exist
            const nextBreakdown: Record<string, any> = {};
            MEAL_SLOT_KEYS.forEach(k => {
              nextBreakdown[k] = {
                calories: prevBreakdown[k]?.calories ?? 0,
                items:    [...(prevBreakdown[k]?.items ?? [])],
              };
            });

            // Add new items into the correct slot
            let slotKey = msg.meal_type;
            if (!MEAL_SLOT_KEYS.includes(slotKey)) {
              slotKey = 'dinner';
            }
            if (!nextBreakdown[slotKey]) {
              nextBreakdown[slotKey] = { calories: 0, items: [] };
            }
            nextBreakdown[slotKey].calories += msg.total_calories;
            nextBreakdown[slotKey].items = [
              ...nextBreakdown[slotKey].items,
              ...msg.items.map((x: any) => ({
                food:      x.food,
                calories:  x.calories,
                protein:   x.protein ?? 0,
                carbs:     x.carbs ?? 0,
                fat:       x.fat ?? 0,
                fibre:     x.fibre ?? 0,
                time:      new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                meal_type: slotKey,
              })),
            ];

            // Update macros consumed from backend message
            const updatedMacros = msg.macros_consumed ?? {};

            return {
              ...prev,
              today: {
                ...prevToday,
                calories_consumed:
                  msg.day_total ?? (prevToday.calories_consumed ?? 0) + msg.total_calories,
                meal_breakdown: nextBreakdown,
                macros_consumed: {
                  protein: updatedMacros.protein ?? (prevToday.macros_consumed?.protein ?? 0),
                  carbs:   updatedMacros.carbs ?? (prevToday.macros_consumed?.carbs ?? 0),
                  fat:     updatedMacros.fat ?? (prevToday.macros_consumed?.fat ?? 0),
                  fibre:   updatedMacros.fibre ?? (prevToday.macros_consumed?.fibre ?? 0),
                },
                meals: [
                  ...(prevToday.meals ?? []),
                  ...msg.items.map((x: any) => ({
                    food:      x.food,
                    calories:  x.calories,
                    protein:   x.protein ?? 0,
                    carbs:     x.carbs ?? 0,
                    fat:       x.fat ?? 0,
                    fibre:     x.fibre ?? 0,
                    time:      new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                    meal_type: slotKey,
                  })),
                ],
              },
            };
          });

          setWeeklyData((prev: any) => {
            const week = prev?.week;
            if (!week?.calories?.length) return prev;
            const calories  = [...week.calories];
            const lastIndex = calories.length - 1;
            calories[lastIndex] = (calories[lastIndex] ?? 0) + msg.total_calories;
            const totalCalories = calories.reduce((sum: number, val: number) => sum + val, 0);
            const weeklyGoal    = week.weekly_goal ?? (week.calorie_goal ?? 0) * 7;
            return {
              ...prev,
              week: {
                ...week,
                calories,
                total_calories:     totalCalories,
                calories_available: Math.max(weeklyGoal - totalCalories, 0),
              },
            };
          });

          setIsThinking(false);
          setStatus('Logged');
          refreshData();
        }

        // ── Control commands from backend ──
        if (msg.type === 'control') {
          if (msg.action === 'open_camera') {
            setCameraVisible(true);
            setVoiceOverlayVisible(false);
          } else if (msg.action === 'open_gallery') {
            // For gallery, we'll open the camera screen which has gallery option
            setCameraVisible(true);
            setVoiceOverlayVisible(false);
            // Could add a separate state to auto-trigger gallery if needed
          } else if (msg.action === 'gemini_done') {
            // Session ended
            setVoiceOverlayVisible(false);
          }
        }
      } catch (err) {
        console.log('ws msg error:', err);
      }
    };
  };

  useEffect(() => {
    LiveAudioStream.init({
      sampleRate:    16000,
      channels:      1,
      bitsPerSample: 16,
      audioSource:   1,
      bufferSize:    4096,
      wavFile:       'voice.wav',
    });

    LiveAudioStream.on('data', (data: string) => {
      if (!recordingRef.current) return;
      audioChunksRef.current += 1;
      setAudioChunks(audioChunksRef.current);
      if (ws.current?.readyState === WebSocket.OPEN) {
        ws.current.send(JSON.stringify({ type: 'audio', data }));
      }
    });

    connect();
    loadAll();

    return () => {
      try { LiveAudioStream.stop(); } catch (_) {}
      InCallManager.setForceSpeakerphoneOn(false);
      InCallManager.stop();
      ws.current?.close();
    };
  }, []);

  // ─────────────────────────────────────────────
  // SPEAK — injects text into active Gemini session
  // ─────────────────────────────────────────────
  const handleSpeak = (text: string) => {
    ws.current?.send(JSON.stringify({ type: 'speak', text }));
  };

  // ─────────────────────────────────────────────
  // PHOTO HANDLERS
  // ─────────────────────────────────────────────
  const handleOpenCamera = () => {
    setCameraVisible(true);
  };

  const handleCloseCamera = () => {
    setCameraVisible(false);
  };

  const handlePhotoAnalyzed = (data: any) => {
    // Photo analysis successful - show confirmation screen
    setConfirmPage({
      visible: true,
      items: data.items,
      total: data.total,
      meal_type: data.meal_type,
      source: 'photo',
    });
  };

  const handleConfirmPhotoLog = async (editedItems: any, editedTotal: number, editedMealType: string) => {
    // Send to backend to confirm and log
    try {
      const res = await fetch(`${BASE_URL}/photos/confirm-photo-log`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phone,
          items: editedItems,
          total: editedTotal,
          meal_type: editedMealType,
        }),
      });
      const data = await res.json();

      if (data.success) {
        // Update local state same as voice flow
        setTodayData((prev: any) => {
          if (!prev) return prev;

          const prevToday = prev.today ?? {};
          const prevBreakdown: Record<string, any> = prevToday.meal_breakdown ?? {};

          const nextBreakdown: Record<string, any> = {};
          MEAL_SLOT_KEYS.forEach(k => {
            nextBreakdown[k] = {
              calories: prevBreakdown[k]?.calories ?? 0,
              items: [...(prevBreakdown[k]?.items ?? [])],
            };
          });

          let slotKey = editedMealType;
          if (!MEAL_SLOT_KEYS.includes(slotKey)) {
            slotKey = 'dinner';
          }
          if (!nextBreakdown[slotKey]) {
            nextBreakdown[slotKey] = { calories: 0, items: [] };
          }
          nextBreakdown[slotKey].calories += editedTotal;
          nextBreakdown[slotKey].items = [
            ...nextBreakdown[slotKey].items,
            ...editedItems.map((x: any) => ({
              food: x.food,
              calories: x.calories,
              protein: x.protein ?? 0,
              carbs: x.carbs ?? 0,
              fat: x.fat ?? 0,
              fibre: x.fibre ?? 0,
              time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
              meal_type: slotKey,
            })),
          ];

          const updatedMacros = data.macros_consumed ?? {};

          return {
            ...prev,
            today: {
              ...prevToday,
              calories_consumed: data.day_total ?? (prevToday.calories_consumed ?? 0) + editedTotal,
              meal_breakdown: nextBreakdown,
              macros_consumed: {
                protein: updatedMacros.protein ?? (prevToday.macros_consumed?.protein ?? 0),
                carbs: updatedMacros.carbs ?? (prevToday.macros_consumed?.carbs ?? 0),
                fat: updatedMacros.fat ?? (prevToday.macros_consumed?.fat ?? 0),
                fibre: updatedMacros.fibre ?? (prevToday.macros_consumed?.fibre ?? 0),
              },
              meals: [
                ...(prevToday.meals ?? []),
                ...editedItems.map((x: any) => ({
                  food: x.food,
                  calories: x.calories,
                  protein: x.protein ?? 0,
                  carbs: x.carbs ?? 0,
                  fat: x.fat ?? 0,
                  fibre: x.fibre ?? 0,
                  time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                  meal_type: slotKey,
                })),
              ],
            },
          };
        });

        setWeeklyData((prev: any) => {
          const week = prev?.week;
          if (!week?.calories?.length) return prev;
          const calories = [...week.calories];
          const lastIndex = calories.length - 1;
          calories[lastIndex] = (calories[lastIndex] ?? 0) + editedTotal;
          const totalCalories = calories.reduce((sum: number, val: number) => sum + val, 0);
          const weeklyGoal = week.weekly_goal ?? (week.calorie_goal ?? 0) * 7;
          return {
            ...prev,
            week: {
              ...week,
              calories,
              total_calories: totalCalories,
              calories_available: Math.max(weeklyGoal - totalCalories, 0),
            },
          };
        });

        setStatus('Logged from photo');
        refreshData();
      }
    } catch (e) {
      console.log('confirm photo log error:', e);
    }
    setConfirmPage({ visible: false, items: [], total: 0, meal_type: '', source: 'voice' });
  };

  // ─────────────────────────────────────────────
  // CONFIRM LOG HANDLERS
  // ─────────────────────────────────────────────
  const handleConfirmLog = (editedItems: any, editedTotal: number, editedMealType: string) => {
    // Route to appropriate handler based on source
    if (confirmPage.source === 'photo') {
      handleConfirmPhotoLog(editedItems, editedTotal, editedMealType);
      return;
    }
    // Voice flow - send via WebSocket
    ws.current?.send(JSON.stringify({
      type:      'confirm_log',
      items:     editedItems,
      total:     editedTotal,
      meal_type: editedMealType,
    }));
    setConfirmPage({ visible: false, items: [], total: 0, meal_type: '', source: 'voice' });
  };

  const handleCancelLog = () => {
    setConfirmPage({ visible: false, items: [], total: 0, meal_type: '', source: 'voice' });
  };

  // ─────────────────────────────────────────────
  // MIC — tap once to start, tap again to stop
  // ─────────────────────────────────────────────
  const startRecording = async () => {
    if (startingRef.current || recordingRef.current) return;
    startingRef.current = true;
    cancelStartRef.current = false;

    try {
      const granted = await PermissionsAndroid.request(
        PermissionsAndroid.PERMISSIONS.RECORD_AUDIO
      );
      if (granted !== PermissionsAndroid.RESULTS.GRANTED) {
        setStatus('Mic permission denied');
        return;
      }
      if (cancelStartRef.current) return;

      if (!ws.current || ws.current.readyState !== WebSocket.OPEN) {
        connect();
      }
      const socketReady = await waitForSocket();
      if (!socketReady) {
        setStatus('Server not connected');
        return;
      }
      if (cancelStartRef.current) return;

      audioChunksRef.current = 0;
      setAudioChunks(0);
      audioReadyRef.current = false;
      setTranscript('');
      setVoiceOverlayVisible(true);
      setIsListening(true);
      setIsThinking(false);
      setStatus('Speak now...');

      ws.current?.send(JSON.stringify({ type: 'control', action: 'mic_start' }));
      await new Promise<void>(resolve => setTimeout(resolve, 150));
      if (cancelStartRef.current) return;

      LiveAudioStream.start();
      recordingRef.current = true;
      audioReadyRef.current = true;
      setStatus('Listening — tap mic to stop');
    } catch (e) {
      console.log('startRecording error:', e);
      setStatus('Mic failed to start');
      setIsListening(false);
      setVoiceOverlayVisible(false);
    } finally {
      startingRef.current = false;
    }
  };

  const stopRecording = () => {
    if (!recordingRef.current && !startingRef.current) return;

    cancelStartRef.current = true;
    startingRef.current = false;
    recordingRef.current = false;
    audioReadyRef.current = false;

    try { LiveAudioStream.stop(); } catch (_) {}

    if (ws.current?.readyState === WebSocket.OPEN) {
      ws.current.send(JSON.stringify({ type: 'control', action: 'mic_stop' }));
    }

    setIsListening(false);

    if (audioChunksRef.current === 0) {
      setStatus('No audio captured — check mic permission');
    } else {
      setIsThinking(true);
      setStatus('Thinking...');
    }
  };

  const toggleVoiceRecording = () => {
    if (isThinking) return;
    if (isListening || startingRef.current) {
      stopRecording();
    } else {
      startRecording();
    }
  };

  const handleCloseVoiceOverlay = () => {
    cancelStartRef.current = true;
    startingRef.current = false;
    recordingRef.current = false;
    audioReadyRef.current = false;
    try { LiveAudioStream.stop(); } catch (_) {}
    if (ws.current?.readyState === WebSocket.OPEN) {
      ws.current.send(JSON.stringify({ type: 'control', action: 'mic_stop' }));
    }
    setVoiceOverlayVisible(false);
    setIsListening(false);
    setIsThinking(false);
    setStatus('Ready');
    setTranscript('');
    setAudioChunks(0);
    audioChunksRef.current = 0;
  };

  // ─────────────────────────────────────────────
  // RENDER
  // ─────────────────────────────────────────────
  if (loading) {
    return (
      <View style={s.loader}>
        <ActivityIndicator size="large" color={C.sage} />
      </View>
    );
  }

  const tabProps = {
    userData,
    todayData,
    weeklyData,
    phone,
    status,
    isListening,
    isThinking,
    reload: loadAll,
  };

  return (
    <View style={s.root}>
      <StatusBar backgroundColor={voiceOverlayVisible ? 'rgba(28, 30, 28, 0.94)' : C.cream} barStyle={voiceOverlayVisible ? 'light-content' : 'dark-content'} />

      {/* Voice Overlay HUD */}
      {voiceOverlayVisible && (
        <View style={[s.voiceOverlay, { paddingTop: Math.max(insets.top, 16) }]}>
          <View style={s.voiceOverlayHeader}>
            <VoiceWaveform />
            <TouchableOpacity
              style={s.voiceOverlayCloseBtn}
              onPress={handleCloseVoiceOverlay}
              activeOpacity={0.8}
            >
              <Svg width={18} height={18} viewBox="0 0 24 24" fill="none">
                <Path
                  d="M18 6L6 18M6 6l12 12"
                  stroke="#FFF"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </Svg>
            </TouchableOpacity>
          </View>
          <Text style={s.voiceOverlayTranscript} numberOfLines={6}>
            {transcript || (isListening ? 'Speak now...' : '...')}
          </Text>
          <Text style={s.voiceOverlayStatus}>
            {status}
          </Text>
        </View>
      )}

      <View style={s.content}>
        {tab === 'daily'       && <DailyTab       {...tabProps} />}
        {tab === 'weekly'      && <WeeklyTab       {...tabProps} />}
        {tab === 'suggestions' && <SuggestionTab   {...tabProps} />}
        {tab === 'profile'     && <ProfileTab      phone={phone} />}
      </View>

      <BottomNav
        tab={tab}
        onTab={setTab}
        onVoiceToggle={toggleVoiceRecording}
        onCameraPress={handleOpenCamera}
        isListening={isListening}
        isThinking={isThinking}
      />

      {/* Camera Screen Modal */}
      <CameraScreen
        visible={cameraVisible}
        phone={phone}
        userName={userData?.name}
        onClose={handleCloseCamera}
        onPhotoAnalyzed={handlePhotoAnalyzed}
      />

      {/* Confirm Log Screen - Full screen overlay above all tabs */}
      {confirmPage.visible && (
        <ConfirmLogScreen
          visible={confirmPage.visible}
          items={confirmPage.items}
          total={confirmPage.total}
          meal_type={confirmPage.meal_type}
          userName={userData?.name}
          onConfirm={handleConfirmLog}
          onCancel={handleCancelLog}
          onSpeak={handleSpeak}
        />
      )}
    </View>
  );
}

const s = StyleSheet.create({
  root:    { flex: 1, backgroundColor: C.cream },
  loader:  { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: C.cream },
  content: { flex: 1 },
  voiceOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(28, 30, 28, 0.94)',
    borderBottomLeftRadius: 180,
    borderBottomRightRadius: 180,
    alignItems: 'center',
    paddingHorizontal: 28,
    paddingBottom: 45,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.35,
    shadowRadius: 16,
    elevation: 10,
    zIndex: 9999,
  },
  voiceOverlayHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
    marginBottom: 20,
    paddingHorizontal: 8,
  },
  voiceOverlayCloseBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  voiceOverlayTranscript: {
    fontSize: 22,
    fontWeight: '700',
    color: '#FFFFFF',
    textAlign: 'center',
    lineHeight: 30,
    marginBottom: 8,
    minHeight: 30,
  },
  voiceOverlayStatus: {
    fontSize: 14,
    color: '#9A9690',
    fontWeight: '500',
    textAlign: 'center',
  },
  waveContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    height: 30,
  },
  waveBar: {
    width: 3,
    borderRadius: 1.5,
    backgroundColor: '#3D6B4F', // C.sage
  },
});

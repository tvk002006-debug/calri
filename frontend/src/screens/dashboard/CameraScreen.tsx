import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Animated,
  ActivityIndicator,
  Image,
  Modal,
  StatusBar,
} from 'react-native';
import Svg, { Path, Circle } from 'react-native-svg';
import { launchCamera, launchImageLibrary, CameraOptions, ImagePickerResponse } from 'react-native-image-picker';
import { C, g } from '../../styles/GlobalStyles';
import { BASE_URL } from '../../config/api';

// ─── Camera Icon ───────────────────────────────────────────────────────────────
function CameraIcon({ size = 28, color = C.ink }: { size?: number; color?: string }) {
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

// ─── Gallery Icon ──────────────────────────────────────────────────────────────
function GalleryIcon({ size = 28, color = C.ink }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M21 19V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2z"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path
        d="M3 16l5-5 3 3 4-4 5 5"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Circle cx="8.5" cy="8.5" r="1.5" fill={color} />
    </Svg>
  );
}

// ─── Close Icon ────────────────────────────────────────────────────────────────
function CloseIcon({ size = 24, color = C.ink }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M18 6L6 18M6 6l12 12"
        stroke={color}
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

// ─── Check Icon ────────────────────────────────────────────────────────────────
function CheckIcon({ size = 24, color = '#fff' }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M20 6L9 17l-5-5"
        stroke={color}
        strokeWidth="3"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

// ─── Retry Icon ────────────────────────────────────────────────────────────────
function RetryIcon({ size = 24, color = C.ink }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 12"
        stroke={color}
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path
        d="M3 3v9h9"
        stroke={color}
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

// ─── Camera Screen ─────────────────────────────────────────────────────────────
interface CameraScreenProps {
  visible: boolean;
  phone: string;
  userName?: string;
  onClose: () => void;
  onPhotoAnalyzed: (data: any) => void;
}

export default function CameraScreen({
  visible,
  phone,
  userName = 'there',
  onClose,
  onPhotoAnalyzed,
}: CameraScreenProps) {
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [photoSize, setPhotoSize] = useState<{ width: number; height: number } | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const abortControllerRef = useRef<AbortController | null>(null);

  useEffect(() => {
    if (visible) {
      setPhotoUri(null);
      setPhotoSize(null);
      setError(null);
      setIsAnalyzing(false);
      Animated.timing(fadeAnim, { toValue: 1, duration: 200, useNativeDriver: true }).start();
    } else {
      Animated.timing(fadeAnim, { toValue: 0, duration: 150, useNativeDriver: true }).start();
    }
  }, [visible]);

  const handleTakePhoto = async () => {
    const options: CameraOptions = {
      mediaType: 'photo',
      quality: 0.9,
      includeBase64: false,
      saveToPhotos: false,
    };

    try {
      const result: ImagePickerResponse = await launchCamera(options);
      if (result.assets && result.assets[0]) {
        const asset = result.assets[0];
        setPhotoUri(asset.uri || null);
        setPhotoSize({
          width: asset.width || 0,
          height: asset.height || 0,
        });
        setError(null);
      }
    } catch (err) {
      setError('Could not access camera. Please check permissions.');
    }
  };

  const handleChooseFromGallery = async () => {
    // Clear previous state first
    setPhotoUri(null);
    setPhotoSize(null);
    setError(null);
    setIsAnalyzing(false);

    const options: CameraOptions = {
      mediaType: 'photo',
      quality: 0.9,
      includeBase64: false,
    };

    try {
      const result: ImagePickerResponse = await launchImageLibrary(options);
      if (result.assets && result.assets[0]) {
        const asset = result.assets[0];
        setPhotoUri(asset.uri || null);
        setPhotoSize({
          width: asset.width || 0,
          height: asset.height || 0,
        });
      }
    } catch (err) {
      setError('Could not access gallery. Please check permissions.');
    }
  };

  const handleAnalyze = async () => {
    if (!photoUri) return;

    // Clean up any existing abort controller
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }

    setIsAnalyzing(true);
    setError(null);

    const abortController = new AbortController();
    abortControllerRef.current = abortController;

    try {
      // Create form data
      const formData = new FormData();
      formData.append('phone', phone);
      formData.append('file', {
        uri: photoUri,
        type: 'image/jpeg',
        name: 'photo.jpg',
      } as any);

      const response = await fetch(`${BASE_URL}/photos/analyze-photo`, {
        method: 'POST',
        headers: {
          'Content-Type': 'multipart/form-data',
        },
        body: formData,
        signal: abortController.signal,
      });

      // Only process if not aborted
      if (abortController.signal.aborted) {
        return;
      }

      const data = await response.json();

      if (data.success) {
        onPhotoAnalyzed(data);
        onClose();
      } else {
        setError(data.message || 'Could not analyze photo. Please try again.');
      }
    } catch (err: any) {
      // Don't show error if request was intentionally aborted
      if (err.name === 'AbortError' || abortController.signal.aborted) {
        console.log('[ANALYZE] Request was aborted');
        return;
      }
      console.error('Photo analysis error:', err);
      setError('Network error. Please check your connection.');
    } finally {
      setIsAnalyzing(false);
      if (abortControllerRef.current === abortController) {
        abortControllerRef.current = null;
      }
    }
  };

  const handleStopAnalysis = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
  };

  const handleRetry = () => {
    setPhotoUri(null);
    setPhotoSize(null);
    setError(null);
  };

  return (
    <Modal
      visible={visible}
      transparent={false}
      animationType="slide"
      statusBarTranslucent
    >
      <StatusBar barStyle="dark-content" backgroundColor={C.cream} />
      <View style={s.container}>
        {/* Header */}
        <View style={s.header}>
          <TouchableOpacity style={s.closeBtn} onPress={onClose} activeOpacity={0.7}>
            <CloseIcon size={24} color={C.ink2} />
          </TouchableOpacity>
          <Text style={s.title}>Photo Log</Text>
          <View style={s.placeholder} />
        </View>

        {/* Content */}
        <Animated.View style={[s.content, { opacity: fadeAnim }]}>
          {!photoUri ? (
            // Initial state - choose source
            <View style={s.chooseContainer}>
              <View style={s.brandBlock}>
                <View style={s.brandMark}>
                  <CameraIcon size={20} color="#fff" />
                </View>
                <Text style={s.greeting}>Hi {userName}!</Text>
                <Text style={s.subtitle}>Take a photo of your meal and I'll identify the calories</Text>
              </View>

              <View style={s.buttonGroup}>
                <TouchableOpacity
                  style={s.mainButton}
                  onPress={handleTakePhoto}
                  activeOpacity={0.85}
                >
                  <CameraIcon size={24} color="#fff" />
                  <Text style={s.mainButtonText}>Take Photo</Text>
                </TouchableOpacity>

                <View style={g.orRow}>
                  <View style={g.orLine} />
                  <Text style={g.orText}>or</Text>
                  <View style={g.orLine} />
                </View>

                <TouchableOpacity
                  style={s.secondaryButton}
                  onPress={handleChooseFromGallery}
                  activeOpacity={0.85}
                >
                  <GalleryIcon size={24} color={C.sage} />
                  <Text style={s.secondaryButtonText}>Choose from Gallery</Text>
                </TouchableOpacity>
              </View>
            </View>
          ) : (
            // Photo preview state
            <View style={s.previewContainer}>
              <View style={s.imageWrapper}>
                <Image source={{ uri: photoUri }} style={s.previewImage} resizeMode="contain" />
              </View>
              {photoSize && photoSize.width > 0 && (
                <View style={s.imageInfoContainer}>
                  <Text style={s.imageInfoText}>
                    {photoSize.width} × {photoSize.height}
                  </Text>
                </View>
              )}

              {isAnalyzing ? (
                <View style={s.analyzingContainer}>
                  <ActivityIndicator size="large" color={C.sage} />
                  <Text style={s.analyzingText}>Analyzing your meal...</Text>
                  <Text style={s.analyzingSubtext}>Calculating Calories</Text>
                  <TouchableOpacity
                    style={s.stopButton}
                    onPress={handleStopAnalysis}
                    activeOpacity={0.85}
                  >
                    <Text style={s.stopButtonText}>Stop</Text>
                  </TouchableOpacity>
                </View>
              ) : error ? (
                <View style={s.errorContainer}>
                  <Text style={s.errorText}>{error}</Text>
                  <TouchableOpacity style={s.retryButton} onPress={handleRetry} activeOpacity={0.85}>
                    <RetryIcon size={20} color={C.sage} />
                    <Text style={s.retryButtonText}>Try Again</Text>
                  </TouchableOpacity>
                </View>
              ) : (
                <View style={s.actionContainer}>
                  <TouchableOpacity
                    style={s.retakeButton}
                    onPress={handleRetry}
                    activeOpacity={0.85}
                  >
                    <Text style={s.retakeButtonText}>Retake</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={s.confirmButton}
                    onPress={handleAnalyze}
                    activeOpacity={0.85}
                  >
                    <CheckIcon size={20} />
                    <Text style={s.confirmButtonText}>Analyze</Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>
          )}
        </Animated.View>
      </View>
    </Modal>
  );
}

// ─── Styles ────────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: C.cream,
  },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 60,
    paddingBottom: 12,
    backgroundColor: C.cream,
    borderBottomWidth: 1,
    borderBottomColor: C.border,
  },
  closeBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: C.surface2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: 16,
    fontWeight: '700',
    color: C.ink,
    letterSpacing: -0.3,
  },
  placeholder: {
    width: 40,
  },

  // Content
  content: {
    flex: 1,
  },

  // Choose state
  chooseContainer: {
    flex: 1,
    paddingHorizontal: 28,
    paddingTop: 40,
  },
  brandBlock: {
    alignItems: 'center',
    marginBottom: 48,
  },
  brandMark: {
    width: 56,
    height: 56,
    borderRadius: 16,
    backgroundColor: C.sage,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  greeting: {
    fontSize: 22,
    fontWeight: '700',
    color: C.ink,
    marginBottom: 8,
    letterSpacing: -0.4,
  },
  subtitle: {
    fontSize: 14,
    color: C.ink2,
    textAlign: 'center',
    lineHeight: 20,
  },
  buttonGroup: {
    gap: 16,
  },
  mainButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    height: 58,
    backgroundColor: C.sage,
    borderRadius: 16,
    shadowColor: C.sage,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 6,
  },
  mainButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  secondaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    height: 58,
    backgroundColor: C.surface,
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: C.border,
  },
  secondaryButtonText: {
    color: C.sage,
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 0.2,
  },

  // Preview state
  previewContainer: {
    flex: 1,
    // verticalAlign: '',
    //  alignItems: 'center',
  },
  imageWrapper: {
    height: 700,
    margin: 16,
    borderRadius: 24,
    overflow: 'hidden',
    backgroundColor: C.surface2,
    justifyContent: 'center',
    alignItems: 'center',
  },
  previewImage: {
    flex: 1,
    width: '100%',
  },
  imageInfoContainer: {
    position: 'absolute',
    top: 28,
    right: 28,
    backgroundColor: 'rgba(20, 18, 14, 0.7)',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  imageInfoText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#fff',
    letterSpacing: 0.3,
  },

  // Analyzing state
  analyzingContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: C.surface,
    paddingHorizontal: 24,
    paddingVertical: 28,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    alignItems: 'center',
    shadowColor: C.ink,
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 8,
  },
  analyzingText: {
    fontSize: 16,
    fontWeight: '700',
    color: C.ink,
    marginTop: 16,
    letterSpacing: -0.2,
  },
  analyzingSubtext: {
    fontSize: 13,
    color: C.ink3,
    marginTop: 4,
  },
  stopButton: {
    marginTop: 20,
    paddingHorizontal: 32,
    paddingVertical: 12,
    backgroundColor: C.surface,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: C.sage,
  },
  stopButtonText: {
    fontSize: 14,
    fontWeight: '700',
    color: C.sage,
  },

  // Error state
  errorContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: C.surface,
    paddingHorizontal: 24,
    paddingVertical: 28,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    alignItems: 'center',
    shadowColor: C.ink,
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 8,
  },
  errorText: {
    fontSize: 14,
    color: C.error,
    textAlign: 'center',
    marginBottom: 16,
    lineHeight: 20,
  },
  retryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 20,
    paddingVertical: 12,
    backgroundColor: C.surface2,
    borderRadius: 12,
  },
  retryButtonText: {
    fontSize: 14,
    fontWeight: '700',
    color: C.sage,
  },

  // Action buttons
  actionContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    gap: 12,
    paddingHorizontal: 20,
    paddingVertical: 24,
    backgroundColor: C.cream,
    borderTopWidth: 1,
    borderTopColor: C.border,
  },
  retakeButton: {
    flex: 1,
    height: 54,
    backgroundColor: C.surface2,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  retakeButtonText: {
    fontSize: 15,
    fontWeight: '700',
    color: C.ink2,
  },
  confirmButton: {
    flex: 1.5,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    height: 54,
    backgroundColor: C.sage,
    borderRadius: 14,
    shadowColor: C.sage,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 6,
  },
  confirmButtonText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#fff',
  },
});

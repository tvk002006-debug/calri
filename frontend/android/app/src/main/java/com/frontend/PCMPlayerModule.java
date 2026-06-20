package com.frontend; // <--- UPDATED THIS

import android.content.Context;
import android.media.AudioAttributes;
import android.media.AudioFormat;
import android.media.AudioManager;
import android.media.AudioTrack;
import android.util.Base64;

import com.facebook.react.bridge.ReactApplicationContext;
import com.facebook.react.bridge.ReactContextBaseJavaModule;
import com.facebook.react.bridge.ReactMethod;

import java.util.concurrent.BlockingQueue;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.LinkedBlockingQueue;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicBoolean;

public class PCMPlayerModule extends ReactContextBaseJavaModule {
    private AudioTrack audioTrack;
    private final ExecutorService executor = Executors.newSingleThreadExecutor();
    private final AtomicBoolean isPlaying = new AtomicBoolean(false);
    private final AtomicBoolean running = new AtomicBoolean(false);
    private final BlockingQueue<byte[]> queue = new LinkedBlockingQueue<>(120);

    public PCMPlayerModule(ReactApplicationContext reactContext) {
        super(reactContext);
    }

    @Override
    public String getName() {
        return "PCMPlayer";
    }

    @ReactMethod
    public void init(int sampleRate, int channels) {
        executor.execute(() -> stopInternal());

        int channelConfig = channels == 1 ? AudioFormat.CHANNEL_OUT_MONO : AudioFormat.CHANNEL_OUT_STEREO;
        int minBufferSize = AudioTrack.getMinBufferSize(
            sampleRate,
            channelConfig,
            AudioFormat.ENCODING_PCM_16BIT
        );
        int bufferSize = Math.max(minBufferSize * 4, 32768);

        audioTrack = new AudioTrack.Builder()
            .setAudioAttributes(
                new AudioAttributes.Builder()
                    .setUsage(AudioAttributes.USAGE_VOICE_COMMUNICATION)
                    .setContentType(AudioAttributes.CONTENT_TYPE_SPEECH)
                    .build()
            )
            .setAudioFormat(
                new AudioFormat.Builder()
                    .setEncoding(AudioFormat.ENCODING_PCM_16BIT)
                    .setSampleRate(sampleRate)
                    .setChannelMask(channelConfig)
                    .build()
            )
            .setBufferSizeInBytes(bufferSize)
            .setTransferMode(AudioTrack.MODE_STREAM)
            .build();

        isPlaying.set(false);
        running.set(true);
        queue.clear();

        executor.execute(() -> {
            while (running.get()) {
                try {
                    byte[] pcm = queue.poll(100, TimeUnit.MILLISECONDS);
                    if (pcm == null) continue;

                    if (!isPlaying.get()) {
                        audioTrack.play();
                        isPlaying.set(true);
                    }

                    audioTrack.write(pcm, 0, pcm.length);
                } catch (InterruptedException e) {
                    Thread.currentThread().interrupt();
                    break;
                } catch (Exception e) {
                    e.printStackTrace();
                }
            }
        });
    }

    @ReactMethod
    public void playBase64(String base64Data) {
        if (audioTrack == null || !running.get()) return;
        byte[] pcm = Base64.decode(base64Data, Base64.DEFAULT);
        if (!queue.offer(pcm)) {
            queue.poll();
            queue.offer(pcm);
        }
    }

    @ReactMethod
    public void stop() {
        stopInternal();
    }

    private void stopInternal() {
        running.set(false);
        queue.clear();
        if (audioTrack != null) {
            try {
                if (isPlaying.get()) {
                    audioTrack.stop();
                }
                audioTrack.release();
            } catch (Exception e) {
                e.printStackTrace();
            }
            audioTrack = null;
            isPlaying.set(false);
        }
    }
} 

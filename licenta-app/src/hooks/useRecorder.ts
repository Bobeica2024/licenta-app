import { useState, useRef, useEffect } from 'react';

interface UseRecorderProps {
    onStop?: (filePath: string) => void;
}

export const useRecorder = ({ onStop }: UseRecorderProps = {}) => {
    const [isRecording, setIsRecording] = useState(false);
    const [isPaused, setIsPaused] = useState(false);
    const [recordingTime, setRecordingTime] = useState(0);
    const [filePath, setFilePath] = useState<string | null>(null);

    const mediaRecorderRef = useRef<MediaRecorder | null>(null);
    const timerRef = useRef<NodeJS.Timeout | null>(null);

    useEffect(() => {
        return () => {
            if (timerRef.current) clearInterval(timerRef.current);
        };
    }, []);

    const startRecording = async () => {
        try {
            // 1. Get Sources (For now, just pick the first screen/window or ask user)
            // Ideally, show a modal. For simplicity, we'll ask user permissions via standard API
            // But in Electron, we need desktopCapturer sourceId.

            const sources = await window.api.recorder.getSources();
            // Select the first source (usually entire screen) or find the app window
            // For this demo, let's grab the first source. 
            // TODO: Add source selection UI
            const sourceId = sources[0].id;

            const stream = await navigator.mediaDevices.getUserMedia({
                audio: {
                    mandatory: {
                        chromeMediaSource: 'desktop' // This captures system audio on Windows with Electron
                    }
                } as any, // Type cast for custom constraint
                video: {
                    mandatory: {
                        chromeMediaSource: 'desktop',
                        chromeMediaSourceId: sourceId
                    }
                } as any
            });

            // 2. Select Save Path
            const path = await window.api.recorder.selectPath();
            if (!path) return; // User cancelled
            setFilePath(path);

            // 3. Initialize Recorder
            const recorder = new MediaRecorder(stream, { mimeType: 'video/webm; codecs=vp9' });
            mediaRecorderRef.current = recorder;

            // 4. Setup Event Handlers
            recorder.ondataavailable = async (e) => {
                if (e.data.size > 0) {
                    const buffer = await e.data.arrayBuffer();
                    await window.api.recorder.writeChunk(path, buffer);
                }
            };

            recorder.onstop = () => {
                stream.getTracks().forEach(track => track.stop());
                setIsRecording(false);
                setIsPaused(false);
                if (timerRef.current) clearInterval(timerRef.current);
                onStop?.(path);
            };

            // 5. Start
            await window.api.recorder.startSave(path);
            recorder.start(1000); // 1s chunks
            setIsRecording(true);

            // Timer
            setRecordingTime(0);
            timerRef.current = setInterval(() => {
                setRecordingTime(prev => prev + 1);
            }, 1000);

        } catch (err) {
            console.error('Failed to start recording:', err);
            alert('Failed to start recording: ' + err);
        }
    };

    const stopRecording = () => {
        if (mediaRecorderRef.current && isRecording) {
            mediaRecorderRef.current.stop();
            // Logic to finalize file is called in onstop
            // We also need to notify backend to close stream
            if (filePath) {
                window.api.recorder.stopSave({
                    filePath,
                    // User ID and meta data should be passed here, handled by Dashboard
                });
            }
        }
    };

    const pauseRecording = () => {
        if (mediaRecorderRef.current && isRecording && !isPaused) {
            mediaRecorderRef.current.pause();
            setIsPaused(true);
            if (timerRef.current) clearInterval(timerRef.current);
        }
    };

    const resumeRecording = () => {
        if (mediaRecorderRef.current && isRecording && isPaused) {
            mediaRecorderRef.current.resume();
            setIsPaused(false);
            timerRef.current = setInterval(() => {
                setRecordingTime(prev => prev + 1);
            }, 1000);
        }
    };

    const formatTime = (seconds: number) => {
        const h = Math.floor(seconds / 3600);
        const m = Math.floor((seconds % 3600) / 60);
        const s = seconds % 60;
        return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
    };

    return {
        isRecording,
        isPaused,
        recordingTime: formatTime(recordingTime),
        startRecording,
        stopRecording,
        pauseRecording,
        resumeRecording
    };
};

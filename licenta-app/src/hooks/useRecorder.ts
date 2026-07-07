import { useState, useRef, useEffect } from 'react';

interface UseRecorderProps {
    onStop?: (filePath: string) => void;
}

export const useRecorder = ({ onStop }: UseRecorderProps = {}) => {
    const [isRecording, setIsRecording] = useState(false);
    const [isPaused, setIsPaused] = useState(false);
    const [recordingTime, setRecordingTime] = useState(0);
    
    const [filePath, setFilePath] = useState<string | null>(() => {
        return sessionStorage.getItem('recorder_filePath');
    });

    const mediaRecorderRef = useRef<MediaRecorder | null>(null);
    const timerRef = useRef<NodeJS.Timeout | null>(null);

    useEffect(() => {
        if (filePath) {
            sessionStorage.setItem('recorder_filePath', filePath);
        } else {
            sessionStorage.removeItem('recorder_filePath');
        }
    }, [filePath]);

    useEffect(() => {
        return () => {
            if (timerRef.current) clearInterval(timerRef.current);
        };
    }, []);

    const startRecording = async () => {
        try {
            setIsRecording(true); 
            try {
                const sources = await window.api.recorder.getSources();
                const sourceId = sources[0].id; // TODO: Better source selection if needed

                const stream = await navigator.mediaDevices.getUserMedia({
                    audio: {
                        mandatory: {
                            chromeMediaSource: 'desktop'
                        }
                    } as any,
                    video: {
                        mandatory: {
                            chromeMediaSource: 'desktop',
                            chromeMediaSourceId: sourceId
                        },
                        cursor: 'never' 
                    } as any
                });

                const tempPath = await window.api.recorder.getTempPath();
                if (!tempPath) throw new Error("Could not generate temp path");
                setFilePath(tempPath);

                const recorder = new MediaRecorder(stream, { mimeType: 'video/webm; codecs=vp9' });
                mediaRecorderRef.current = recorder;

                recorder.ondataavailable = async (e) => {
                    if (e.data.size > 0) {
                        const buffer = await e.data.arrayBuffer();
                        await window.api.recorder.writeChunk(tempPath, buffer);
                    }
                };

                recorder.onstop = () => {
                    stream.getTracks().forEach(track => track.stop());
                    setIsRecording(false);
                    setIsPaused(false);
                    if (timerRef.current) clearInterval(timerRef.current);

                    window.api.recorder.stopSave({ filePath: tempPath }).then(() => {
                        onStop?.(tempPath);
                    });
                };

                await window.api.recorder.startSave(tempPath);
                recorder.start(1000); 
               
                setRecordingTime(0);
                timerRef.current = setInterval(() => {
                    setRecordingTime(prev => prev + 1);
                }, 1000);

            } catch (err: any) {
                console.error('Failed to get sources or start stream:', err);
                alert('Recording Error: ' + err.message);
                setIsRecording(false); // Reset on internal error
                setFilePath(null);
            }

        } catch (err) {
            console.error('Failed to start recording:', err);
            alert('Failed to start recording: ' + err);
            setIsRecording(false); // Reset on outer error
            setFilePath(null);
        }
    };

    const stopRecording = () => {
        if (mediaRecorderRef.current && isRecording) {
            mediaRecorderRef.current.stop();
        }
    };

    const discardRecording = async () => {
        if (filePath) {
            await window.api.recorder.deleteTempFile(filePath);
            setFilePath(null);
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
        discardRecording,
        pauseRecording,
        resumeRecording,
        currentFilePath: filePath
    };
};

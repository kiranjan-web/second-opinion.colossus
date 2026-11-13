import numpy as np
import logging

logger = logging.getLogger(__name__)

class AudioProcessor:
    """Extracts spectral features and MFCC representations from raw audio frames."""

    def __init__(self, sample_rate: int = 16000):
        self.sample_rate = sample_rate

    def extract_spectrogram(self, audio_bytes: bytes) -> np.ndarray:
        """Converts raw PCM 16-bit audio bytes into normalized spectral tensor."""
        try:
            audio_array = np.frombuffer(audio_bytes, dtype=np.int16).astype(np.float32) / 32768.0
            if len(audio_array) == 0:
                return np.zeros((128, 128), dtype=np.float32)

            # Compute short-time Fourier transform (STFT) magnitude spectrogram
            fft_size = 512
            hop_length = 256
            frames = [
                np.abs(np.fft.rfft(audio_array[i : i + fft_size] * np.hanning(fft_size)))
                for i in range(0, max(1, len(audio_array) - fft_size), hop_length)
            ]
            if not frames:
                return np.zeros((128, 128), dtype=np.float32)

            spec = np.array(frames).T
            log_spec = np.log1p(spec)
            return log_spec
        except Exception as e:
            logger.error(f"Spectrogram extraction failed: {e}")
            return np.zeros((128, 128), dtype=np.float32)
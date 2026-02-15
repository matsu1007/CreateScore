export type RecorderEvents = {
  onDuration: (sec: number) => void;
  onStop: (blob: Blob) => void;
  onError: (error: Error) => void;
};

export class RecorderController {
  private mediaRecorder?: MediaRecorder;
  private stream?: MediaStream;
  private chunks: Blob[] = [];
  private durationTimer?: number;
  private hardStopTimer?: number;
  private startedAt = 0;

  async start(events: RecorderEvents, maxSec = 60): Promise<void> {
    try {
      this.stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: false,
          noiseSuppression: false,
          autoGainControl: false
        }
      });
      this.chunks = [];
      this.mediaRecorder = new MediaRecorder(this.stream);
      this.mediaRecorder.ondataavailable = (evt) => {
        if (evt.data.size > 0) {
          this.chunks.push(evt.data);
        }
      };
      this.mediaRecorder.onerror = (evt) => {
        events.onError(new Error(evt.error?.message ?? "録音中にエラーが発生しました"));
      };
      this.mediaRecorder.onstop = () => {
        this.clearTimers();
        const blob = new Blob(this.chunks, { type: this.mediaRecorder?.mimeType || "audio/webm" });
        events.onStop(blob);
        this.disposeStream();
      };
      this.mediaRecorder.start();
      this.startedAt = Date.now();
      this.durationTimer = window.setInterval(() => {
        const sec = (Date.now() - this.startedAt) / 1000;
        events.onDuration(sec);
      }, 100);
      this.hardStopTimer = window.setTimeout(() => {
        this.stop();
      }, maxSec * 1000);
    } catch (error) {
      events.onError(error instanceof Error ? error : new Error("マイク権限の取得に失敗しました"));
    }
  }

  stop(): void {
    if (this.mediaRecorder && this.mediaRecorder.state !== "inactive") {
      this.mediaRecorder.stop();
    }
  }

  clear(): void {
    this.stop();
    this.chunks = [];
    this.clearTimers();
    this.disposeStream();
  }

  private clearTimers(): void {
    if (this.durationTimer) {
      window.clearInterval(this.durationTimer);
      this.durationTimer = undefined;
    }
    if (this.hardStopTimer) {
      window.clearTimeout(this.hardStopTimer);
      this.hardStopTimer = undefined;
    }
  }

  private disposeStream(): void {
    if (!this.stream) {
      return;
    }
    this.stream.getTracks().forEach((track) => track.stop());
    this.stream = undefined;
  }
}

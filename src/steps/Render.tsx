import React, { useState } from 'react';
import clsx from 'clsx';
import { observer } from 'mobx-react-lite';
import { BsDownload, BsMusicNote } from 'react-icons/bs';
import { runInAction } from 'mobx';

import styles from './Render.module.scss';
import { mainStore } from '../stores/main';
import { Slider } from '../components/Slider';

export const Render: React.FC = observer(() => {
  const [outputUrl, setOutputUrl] = useState<string>();
  const [logVisible, setLogVisible] = useState(false);

  const { ffmpeg, video } = mainStore;

  if (!ffmpeg.loaded) {
    return (
      <div className={styles.loading}>
        <span>FFmpeg is loading... please wait!</span>
        <progress value={ffmpeg.loadProgress} max={1} />
      </div>
    );
  }

  if (!video) {
    return (
      <div>
        <span>No video selected.</span>
      </div>
    );
  }

  const { area, scale = 1 } = mainStore.transform;
  const x = Math.trunc((scale * (area ? area[0] : 0)) / 2) * 2;
  const y = Math.trunc((scale * (area ? area[1] : 0)) / 2) * 2;
  const width =
    Math.trunc((scale * (area ? area[2] : video.videoWidth)) / 2) * 2;
  const height =
    Math.trunc((scale * (area ? area[3] : video.videoHeight)) / 2) * 2;

  const crop = async () => {
    setOutputUrl(undefined);

    const args: string[] = [];
    const filters: string[] = [];

    const { flipH, flipV, area, time, mute } = mainStore.transform;

    if (flipH) {
      filters.push('hflip');
    }

    if (flipV) {
      filters.push('vflip');
    }

    if (scale !== 1) {
      filters.push(
        `scale=${Math.trunc((video.videoWidth * scale) / 2) * 2}:${
          Math.trunc((video.videoHeight * scale) / 2) * 2
        }`,
      );
    }

    if (
      area &&
      (area[0] !== 0 || area[1] !== 0 || area[2] !== 1 || area[3] !== 1)
    ) {
      filters.push(`crop=${width}:${height}:${x}:${y}`);
    }

    // Add filters
    if (filters.length > 0) {
      args.push('-vf', filters.join(', '));
    }

    if (time) {
      let start = 0;
      if (time[0] > 0) {
        start = time[0];
        args.push('-ss', `${start}`);
      }

      if (time[1] < video.duration) {
        args.push('-t', `${time[1] - start}`);
      }
    }

    args.push('-c:v', 'libx264');
    args.push('-preset', 'veryfast');

    if (mute) {
      args.push('-an');
    } else {
      args.push('-c:a', 'copy');
    }

    const newFile = await ffmpeg.exec(mainStore.file!, args);
    setOutputUrl(URL.createObjectURL(newFile));
  };

  const extractAudio = async () => {
    const args: string[] = [];

    const { time } = mainStore.transform;

    if (time) {
      let start = 0;
      if (time[0] > 0) {
        start = time[0];
        args.push('-ss', `${start}`);
      }

      if (time[1] < video.duration) {
        args.push('-t', `${time[1] - start}`);
      }
    }

    // Extract audio only
    args.push('-vn'); // No video
    args.push('-c:a', 'mp3'); // Convert to MP3
    args.push('-q:a', '2'); // High quality audio

    try {
      const audioFile = await ffmpeg.exec(mainStore.file!, args);
      const audioUrl = URL.createObjectURL(audioFile);
      
      // Create download link
      const link = document.createElement('a');
      link.href = audioUrl;
      link.download = 'extracted_audio.mp3';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      // Clean up the URL
      URL.revokeObjectURL(audioUrl);
    } catch (error) {
      console.error('Error extracting audio:', error);
      alert('Failed to extract audio. Please try again.');
    }
  };

  return (
    <div className={styles.step}>
      {ffmpeg.running ? (
        <>
          <div className={styles.actions}>
            <button onClick={() => ffmpeg.cancel()}>
              <span>Cancel</span>
            </button>
          </div>
          <div className={styles.info}>
            <span>Running</span>
            <progress value={ffmpeg.execProgress} max={1} />
            <pre>{ffmpeg.output}</pre>
          </div>
        </>
      ) : (
        <>
          <div className={styles.settings}>
            <div>
              Resolution: {width}px x {height}px
            </div>
            <div>
              Scale: {Math.round(scale * 100) / 100}
              <Slider
                min={0.1}
                max={1}
                value={scale}
                onChange={value => {
                  runInAction(() => {
                    mainStore.transform.scale = value;
                  });
                }}
              />
            </div>
          </div>
          <div className={styles.actions}>
            <button onClick={crop} disabled={ffmpeg.running}>
              <span>Render MP4</span>
            </button>
            <button onClick={extractAudio} disabled={ffmpeg.running}>
              <BsMusicNote />
              <span>Save Audio to File</span>
            </button>
            {outputUrl && (
              <a
                href={outputUrl}
                download="cropped.mp4"
                className={clsx('button', styles.download)}
              >
                <BsDownload />
                <span>Download</span>
              </a>
            )}
          </div>
        </>
      )}
      {outputUrl && !ffmpeg.running && (
        <div>
          <video src={outputUrl} controls />
        </div>
      )}
      {!!ffmpeg.log && (
        <div className={styles.info}>
          <button onClick={() => setLogVisible(value => !value)}>
            {logVisible ? 'Hide log' : 'Show log'}
          </button>
          {logVisible && <pre>{ffmpeg.log}</pre>}
        </div>
      )}
    </div>
  );
});

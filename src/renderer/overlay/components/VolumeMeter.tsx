interface VolumeMeterProps {
  dB: number;
}

function getBarColor(dB: number): string {
  if (dB < -40) return 'var(--text-muted)';
  if (dB < -20) return '#f0ad4e';
  return '#4caf50';
}

export function VolumeMeter({ dB }: VolumeMeterProps) {
  const widthPercent = Math.max(0, Math.min(100, ((dB + 60) / 60) * 100));

  return (
    <div className="volume-meter">
      <div
        className="volume-meter-fill"
        style={{
          width: `${widthPercent}%`,
          backgroundColor: getBarColor(dB),
        }}
      />
    </div>
  );
}

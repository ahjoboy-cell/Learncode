import { STAGES, getStageColor } from '../utils/constants';

export default function StageBar({ currentStage }) {
  const currentIndex = STAGES.findIndex((s) => s.key === currentStage);

  return (
    <div className="flex gap-1 items-center">
      {STAGES.filter((s) => s.key !== 'lost').map((stage, i) => (
        <div
          key={stage.key}
          className="h-2 flex-1 rounded-full transition-all"
          style={{
            backgroundColor: i <= currentIndex ? getStageColor(stage.key) : '#e2e8f0',
          }}
          title={stage.label}
        />
      ))}
    </div>
  );
}

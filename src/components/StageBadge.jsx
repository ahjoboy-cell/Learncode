import { getStageColor, getStageLabel } from '../utils/constants';

export default function StageBadge({ stage }) {
  return (
    <span
      className="inline-block px-2.5 py-0.5 rounded-full text-xs font-semibold text-white"
      style={{ backgroundColor: getStageColor(stage) }}
    >
      {getStageLabel(stage)}
    </span>
  );
}

'use client';

import type { DiffOp } from '@/types';
import InlineDiffEditor from './InlineDiffEditor';

interface TextCompareViewProps {
  ops: DiffOp[];
  leftText: string;
  rightText: string;
  leftPath?: string;
  rightPath?: string;
  onLeftChange: (text: string) => void;
  onRightChange: (text: string) => void;
  onSaveLeft: () => void;
  onSaveRight: () => void;
  onLoadLeft: () => void;
  onLoadRight: () => void;
  fsApiSupported: boolean;
  /** Unused — kept for API compatibility */
  defaultShowEditors?: boolean;
}

export default function TextCompareView({
  ops,
  leftText, rightText,
  leftPath, rightPath,
  onLeftChange, onRightChange,
  onSaveLeft, onSaveRight,
  onLoadLeft, onLoadRight,
  fsApiSupported,
}: TextCompareViewProps) {
  return (
    <InlineDiffEditor
      ops={ops}
      leftText={leftText}
      rightText={rightText}
      leftPath={leftPath}
      rightPath={rightPath}
      onLeftChange={onLeftChange}
      onRightChange={onRightChange}
      onSaveLeft={onSaveLeft}
      onSaveRight={onSaveRight}
      onLoadLeft={onLoadLeft}
      onLoadRight={onLoadRight}
      fsApiSupported={fsApiSupported}
    />
  );
}

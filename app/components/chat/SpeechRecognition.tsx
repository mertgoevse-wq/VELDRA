import { IconButton } from '~/components/ui/IconButton';
import { classNames } from '~/utils/classNames';
import React from 'react';

export const SpeechRecognitionButton = ({
  isListening,
  onStart,
  onStop,
  disabled,
  unsupported = false,
}: {
  isListening: boolean;
  onStart: () => void;
  onStop: () => void;
  disabled: boolean;

  /**
   * True when the browser has no SpeechRecognition/webkitSpeechRecognition API at all
   * (BaseChat.tsx's feature detection). Previously the button stayed enabled regardless --
   * clicking it called a start handler that silently no-ops when there's no recognition
   * instance, a real dead button on browsers/WebViews without the API (older Firefox,
   * some Android WebViews). Disabled with an honest reason instead.
   */
  unsupported?: boolean;
}) => {
  return (
    <IconButton
      title={
        unsupported
          ? 'Speech recognition is not supported in this browser'
          : isListening
            ? 'Stop listening'
            : 'Start speech recognition'
      }
      disabled={disabled}
      className={classNames('transition-all', {
        'text-bolt-elements-item-contentAccent': isListening,
      })}
      onClick={isListening ? onStop : onStart}
    >
      {isListening ? <div className="i-ph:microphone-slash text-xl" /> : <div className="i-ph:microphone text-xl" />}
    </IconButton>
  );
};

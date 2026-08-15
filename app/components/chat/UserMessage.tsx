import { MODEL_REGEX, PROVIDER_REGEX } from '~/utils/constants';
import { Markdown } from './Markdown';
import type {
  TextUIPart,
  ReasoningUIPart,
  ToolInvocationUIPart,
  SourceUIPart,
  FileUIPart,
  StepStartUIPart,
} from '@ai-sdk/ui-utils';

interface UserMessageProps {
  content: string | Array<{ type: string; text?: string; image?: string }>;
  parts:
    | (TextUIPart | ReasoningUIPart | ToolInvocationUIPart | SourceUIPart | FileUIPart | StepStartUIPart)[]
    | undefined;
}

export function UserMessage({ content, parts }: UserMessageProps) {
  // Extract images from parts - look for file parts with image mime types
  const images =
    parts?.filter(
      (part): part is FileUIPart => part.type === 'file' && 'mimeType' in part && part.mimeType.startsWith('image/'),
    ) || [];

  const rawText = Array.isArray(content) ? (content.find((item) => item.type === 'text')?.text ?? '') : content;
  const textContent = stripMetadata(rawText);

  return (
    <div className="flex flex-col bg-accent-500/10 backdrop-blur-sm px-5 p-3.5 w-auto rounded-lg ml-auto">
      {images.length > 0 && (
        <div className="flex gap-3.5 mb-4">
          {images.map((item, index) => (
            <div
              key={index}
              className="relative flex rounded-lg border border-bolt-elements-borderColor overflow-hidden"
            >
              <div className="h-16 w-16 bg-transparent outline-none">
                <img
                  src={`data:${item.mimeType};base64,${item.data}`}
                  alt={`Image ${index + 1}`}
                  className="h-full w-full rounded-lg"
                  style={{ objectFit: 'fill' }}
                />
              </div>
            </div>
          ))}
        </div>
      )}
      {textContent && <Markdown html>{textContent}</Markdown>}
    </div>
  );
}

function stripMetadata(content: string) {
  const artifactRegex = /<boltArtifact\s+[^>]*>[\s\S]*?<\/boltArtifact>/gm;
  return content.replace(MODEL_REGEX, '').replace(PROVIDER_REGEX, '').replace(artifactRegex, '');
}

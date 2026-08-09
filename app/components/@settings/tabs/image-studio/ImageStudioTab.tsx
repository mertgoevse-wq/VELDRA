import { useEffect, useMemo, useState } from 'react';
import { Image, Loader2, Sparkles, UploadCloud, WandSparkles } from 'lucide-react';
import { toast } from 'react-toastify';
import { Badge } from '~/components/ui/Badge';
import { Button } from '~/components/ui/Button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '~/components/ui/Card';
import { Input } from '~/components/ui/Input';
import { Progress } from '~/components/ui/Progress';
import { workbenchStore } from '~/lib/stores/workbench';
import { WORK_DIR } from '~/utils/constants';
import { base64ToBytes } from '~/lib/modules/image/assets';
import {
  isValidGeneratedImage,
  type GeneratedImage,
  type ImageGenerationOptions,
  type ImageModelInfo,
} from '~/lib/modules/image/types';

interface ImageCatalogResponse {
  models?: ImageModelInfo[];
}

interface ImageResponse {
  images?: GeneratedImage[];
  provider?: string;
  modelId?: string;
  error?: string;
  code?: string;
}

function safeAssetName(index: number, mimeType: string): string {
  const extension = mimeType.split('/')[1]?.split(';')[0] || 'bin';
  return `generated-${Date.now()}-${index + 1}.${extension.replace(/[^a-z0-9]/gi, '')}`;
}

function capabilityOptions(model: ImageModelInfo | undefined) {
  return {
    aspectRatios: model?.capabilities.supportedAspectRatios ?? [],
    resolutions: model?.capabilities.supportedResolutions ?? [],
    supportsVariants: model?.capabilities.supportsVariants ?? false,
    maxVariants: model?.capabilities.maxVariants ?? 1,
  };
}

export default function ImageStudioTab() {
  const [models, setModels] = useState<ImageModelInfo[]>([]);
  const [isLoadingCatalog, setIsLoadingCatalog] = useState(true);
  const [modelId, setModelId] = useState('');
  const [prompt, setPrompt] = useState(
    'Create a futuristic VELDRA logo for an AI development workbench, dark, minimal, with neon accents.',
  );
  const [aspectRatio, setAspectRatio] = useState('');
  const [resolution, setResolution] = useState('');
  const [variants, setVariants] = useState('1');
  const [jobStatus, setJobStatus] = useState<'idle' | 'queued' | 'running' | 'completed' | 'failed'>('idle');
  const [images, setImages] = useState<GeneratedImage[]>([]);
  const [savedAssets, setSavedAssets] = useState<string[]>([]);

  useEffect(() => {
    let active = true;

    fetch('/api/image')
      .then(async (response) => {
        if (!response.ok) {
          throw new Error(`Image catalog request failed (${response.status})`);
        }

        return (await response.json()) as ImageCatalogResponse;
      })
      .then((data) => {
        if (!active) {
          return;
        }

        const availableModels = (data.models ?? []).filter(
          (model) => model.availability === 'available' && model.status === 'active',
        );
        setModels(availableModels);
        setModelId((current) => current || availableModels[0]?.id || '');
      })
      .catch((error) => {
        if (active) {
          toast.error(error instanceof Error ? error.message : 'Unable to load image catalog');
        }
      })
      .finally(() => {
        if (active) {
          setIsLoadingCatalog(false);
        }
      });

    return () => {
      active = false;
    };
  }, []);

  const selectedModel = useMemo(() => models.find((model) => model.id === modelId), [models, modelId]);
  const options = capabilityOptions(selectedModel);

  const handleGenerate = async () => {
    if (!selectedModel || !prompt.trim()) {
      return;
    }

    setJobStatus('queued');
    setImages([]);
    setSavedAssets([]);

    try {
      const request: ImageGenerationOptions = {
        modelId: selectedModel.id,
        prompt: prompt.trim(),
        ...(aspectRatio && { aspectRatio }),
        ...(resolution && { resolution }),
        ...(options.supportsVariants && { variants: Number(variants) }),
      };
      setJobStatus('running');

      const response = await fetch('/api/image', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(request),
      });
      const data = (await response.json()) as ImageResponse;

      if (
        !response.ok ||
        !data.images ||
        data.images.length === 0 ||
        data.images.some((image) => !isValidGeneratedImage(image))
      ) {
        throw new Error(data.error || 'Image generation returned an invalid image result');
      }

      setJobStatus('completed');
      setImages(data.images);
      toast.success(`${data.images.length} image variant${data.images.length === 1 ? '' : 's'} generated`);
    } catch (error) {
      setJobStatus('failed');
      toast.error(error instanceof Error ? error.message : 'Image generation failed');
    }
  };

  const handleSaveAsset = async (image: GeneratedImage, index: number) => {
    try {
      const filePath = `${WORK_DIR}/assets/generated/${safeAssetName(index, image.mimeType)}`;
      await workbenchStore.createFile(filePath, base64ToBytes(image.dataBase64));
      setSavedAssets((current) => [...current, filePath]);
      toast.success(`Saved ${filePath.replace(`${WORK_DIR}/`, '')} to the workspace`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Unable to save image asset');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 rounded-2xl border border-purple-500/20 bg-gradient-to-br from-purple-500/10 via-bolt-elements-background-depth-1 to-blue-500/10 p-6">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-4">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-purple-500/15 text-purple-500 ring-1 ring-purple-500/30">
              <WandSparkles className="h-6 w-6" />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-2xl font-semibold text-bolt-elements-textPrimary">VELDRA Image Studio</h2>
                <Badge variant="primary" size="sm">
                  Preview
                </Badge>
              </div>
              <p className="mt-1 max-w-2xl text-sm leading-relaxed text-bolt-elements-textSecondary">
                Generate, compare, and bring image results into the current workspace as project assets. Provider
                options are shown only when a verified image model is available.
              </p>
            </div>
          </div>
          <Image className="hidden h-8 w-8 text-blue-400/60 sm:block" />
        </div>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-purple-500" />
            <CardTitle>Generation workspace</CardTitle>
          </div>
          <CardDescription>Configure a supported model and generation parameters.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          {isLoadingCatalog ? (
            <div className="flex items-center gap-2 rounded-xl border border-bolt-elements-borderColor bg-bolt-elements-background-depth-2 p-4 text-sm text-bolt-elements-textSecondary">
              <Loader2 className="h-4 w-4 animate-spin" /> Loading verified image capabilities…
            </div>
          ) : models.length === 0 ? (
            <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-4">
              <div className="flex items-start gap-3">
                <div className="i-ph:warning-circle-fill mt-0.5 h-5 w-5 shrink-0 text-amber-500" />
                <div>
                  <h3 className="text-sm font-semibold text-bolt-elements-textPrimary">
                    No verified image provider configured
                  </h3>
                  <p className="mt-1 text-sm leading-relaxed text-bolt-elements-textSecondary">
                    Image generation is not available in this deployment yet. VELDRA will not make an unverified or
                    credential-less request. Once a provider is integrated, its real capabilities will unlock these
                    controls automatically.
                  </p>
                  <div className="mt-3 flex flex-wrap gap-2 text-xs text-bolt-elements-textTertiary">
                    <span className="rounded-full bg-bolt-elements-background-depth-2 px-2.5 py-1">
                      No fake previews
                    </span>
                    <span className="rounded-full bg-bolt-elements-background-depth-2 px-2.5 py-1">
                      Secrets stay server-side
                    </span>
                    <span className="rounded-full bg-bolt-elements-background-depth-2 px-2.5 py-1">
                      Capability-gated UI
                    </span>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <>
              <label className="block space-y-2">
                <span className="text-sm font-medium text-bolt-elements-textPrimary">Model</span>
                <select
                  value={modelId}
                  onChange={(event) => setModelId(event.target.value)}
                  className="flex h-10 w-full rounded-md border border-bolt-elements-border bg-bolt-elements-background px-3 py-2 text-sm text-bolt-elements-textPrimary focus:outline-none focus:ring-2 focus:ring-bolt-elements-ring"
                >
                  {models.map((model) => (
                    <option key={model.id} value={model.id}>
                      {model.displayName}
                    </option>
                  ))}
                </select>
              </label>

              <label className="block space-y-2">
                <span className="text-sm font-medium text-bolt-elements-textPrimary">Prompt</span>
                <textarea
                  value={prompt}
                  onChange={(event) => setPrompt(event.target.value)}
                  rows={5}
                  className="w-full resize-y rounded-md border border-bolt-elements-border bg-bolt-elements-background px-3 py-2 text-sm text-bolt-elements-textPrimary placeholder:text-bolt-elements-textSecondary focus:outline-none focus:ring-2 focus:ring-bolt-elements-ring"
                  placeholder="Describe the image you want to create..."
                />
              </label>

              <div className="grid gap-4 sm:grid-cols-3">
                {options.aspectRatios.length > 0 && (
                  <label className="space-y-2">
                    <span className="text-sm font-medium text-bolt-elements-textPrimary">Aspect ratio</span>
                    <select
                      value={aspectRatio}
                      onChange={(event) => setAspectRatio(event.target.value)}
                      className="h-10 w-full rounded-md border border-bolt-elements-border bg-bolt-elements-background px-3 text-sm text-bolt-elements-textPrimary"
                    >
                      <option value="">Provider default</option>
                      {options.aspectRatios.map((value) => (
                        <option key={value} value={value}>
                          {value}
                        </option>
                      ))}
                    </select>
                  </label>
                )}
                {options.resolutions.length > 0 && (
                  <label className="space-y-2">
                    <span className="text-sm font-medium text-bolt-elements-textPrimary">Resolution</span>
                    <select
                      value={resolution}
                      onChange={(event) => setResolution(event.target.value)}
                      className="h-10 w-full rounded-md border border-bolt-elements-border bg-bolt-elements-background px-3 text-sm text-bolt-elements-textPrimary"
                    >
                      <option value="">Provider default</option>
                      {options.resolutions.map((value) => (
                        <option key={value} value={value}>
                          {value}
                        </option>
                      ))}
                    </select>
                  </label>
                )}
                {options.supportsVariants && (
                  <label className="space-y-2">
                    <span className="text-sm font-medium text-bolt-elements-textPrimary">Variants</span>
                    <Input
                      type="number"
                      min={1}
                      max={options.maxVariants}
                      value={variants}
                      onChange={(event) => setVariants(event.target.value)}
                    />
                  </label>
                )}
              </div>

              <Button
                onClick={handleGenerate}
                disabled={jobStatus === 'queued' || jobStatus === 'running' || !prompt.trim()}
                size="lg"
                className="w-full gap-2 sm:w-auto"
              >
                {jobStatus === 'queued' || jobStatus === 'running' ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Sparkles className="h-4 w-4" />
                )}
                {jobStatus === 'queued' || jobStatus === 'running' ? 'Generating…' : 'Generate images'}
              </Button>
            </>
          )}

          {(jobStatus === 'queued' || jobStatus === 'running') && (
            <div className="space-y-2 rounded-lg bg-bolt-elements-background-depth-2 p-3">
              <div className="flex items-center justify-between text-xs text-bolt-elements-textSecondary">
                <span>Image job {jobStatus}</span>
                <span className="i-ph:spinner-gap animate-spin" aria-label="Image job in progress" />
              </div>
              <Progress className="animate-pulse" />
            </div>
          )}
        </CardContent>
      </Card>

      {images.length > 0 && (
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Image className="h-5 w-5 text-blue-500" />
              <CardTitle>Results</CardTitle>
            </div>
            <CardDescription>Compare variants and save the ones you want to use in your project.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            {images.map((image, index) => {
              const assetPath = savedAssets.find((path) => path.includes(`-${index + 1}.`));

              return (
                <div
                  key={`${image.dataBase64.slice(0, 16)}-${index}`}
                  className="overflow-hidden rounded-xl border border-bolt-elements-borderColor bg-bolt-elements-background-depth-2"
                >
                  {isValidGeneratedImage(image) && (
                    <img
                      src={`data:${image.mimeType};base64,${image.dataBase64}`}
                      alt={`Generated variant ${index + 1}`}
                      className="aspect-square w-full object-cover"
                    />
                  )}
                  <div className="flex items-center justify-between gap-3 p-3">
                    <span className="text-xs text-bolt-elements-textSecondary">Variant {index + 1}</span>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleSaveAsset(image, index)}
                      disabled={Boolean(assetPath)}
                      className="gap-2"
                    >
                      {assetPath ? (
                        <>
                          <UploadCloud className="h-3.5 w-3.5" /> Saved
                        </>
                      ) : (
                        <>
                          <UploadCloud className="h-3.5 w-3.5" /> Save asset
                        </>
                      )}
                    </Button>
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

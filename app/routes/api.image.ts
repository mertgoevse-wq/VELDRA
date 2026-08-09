import { json, type ActionFunctionArgs } from '@remix-run/cloudflare';
import { withSecurity } from '~/lib/security';
import { imageProviderRegistry } from '~/lib/modules/image/registry';
import { runImageJob } from '~/lib/modules/image/jobs';
import { ImageGenerationUnavailableError, isValidGeneratedImage } from '~/lib/modules/image/types';
import { parseImageGenerationRequest } from '~/lib/modules/image/request';
import { readRequestBody } from '~/lib/modules/image/request-body';
import { validateImageGenerationOptions } from '~/lib/modules/image/validation';
import type { ImageGenerationOptions } from '~/lib/modules/image/types';

const MAX_IMAGE_REQUEST_BYTES = 2 * 1024 * 1024;
const MAX_RESULT_IMAGES = 16;
const MAX_RESULT_BASE64_BYTES = 48 * 1024 * 1024;

async function imageLoader() {
  return json({
    models: imageProviderRegistry.getModels(),
    providers: imageProviderRegistry.getProviders().map((provider) => provider.name),
  });
}

async function imageAction({ request }: ActionFunctionArgs) {
  const contentLength = Number(request.headers.get('content-length') ?? 0);

  if (contentLength > MAX_IMAGE_REQUEST_BYTES) {
    return json({ error: 'Image request is too large', code: 'request_too_large' }, { status: 413 });
  }

  let payload: unknown;

  try {
    const body = await readRequestBody(request, MAX_IMAGE_REQUEST_BYTES);
    payload = JSON.parse(body) as unknown;
  } catch (error) {
    if (error instanceof Error && error.message === 'request_too_large') {
      return json({ error: 'Image request is too large', code: 'request_too_large' }, { status: 413 });
    }

    return json({ error: 'Invalid image generation request', code: 'invalid_request' }, { status: 400 });
  }

  if (JSON.stringify(payload).length > MAX_IMAGE_REQUEST_BYTES) {
    return json({ error: 'Image request is too large', code: 'request_too_large' }, { status: 413 });
  }

  const parsedRequest = parseImageGenerationRequest(payload);

  if (!parsedRequest.ok) {
    return json({ error: parsedRequest.error, code: 'invalid_request' }, { status: 400 });
  }

  const options: ImageGenerationOptions = parsedRequest.options;

  const model = imageProviderRegistry.getModels().find((candidate) => candidate.id === options.modelId);
  const provider = imageProviderRegistry.getProviderForModel(options.modelId);

  if (!model || !provider || model.status !== 'active' || model.availability !== 'available' || !model.apiAvailable) {
    return json({ error: 'The selected image model is not configured', code: 'model_not_configured' }, { status: 503 });
  }

  const validationErrors = validateImageGenerationOptions(model, options);

  if (validationErrors.length > 0) {
    return json(
      { error: 'Unsupported image generation options', code: 'unsupported_options', details: validationErrors },
      { status: 400 },
    );
  }

  try {
    const execution = await runImageJob(provider, options);

    if (execution.job.status === 'failed') {
      console.error('Image provider job failed:', execution.job.metadata.error);
      return json({ error: 'Image generation failed', code: 'generation_failed' }, { status: 502 });
    }

    if (execution.job.status === 'cancelled' || !execution.result) {
      return json({ error: 'Image generation was cancelled', code: 'generation_cancelled' }, { status: 499 });
    }

    const totalResultBytes = execution.result.images.reduce((total, image) => total + image.dataBase64.length, 0);

    if (
      execution.result.provider !== provider.name ||
      execution.result.modelId !== options.modelId ||
      execution.result.images.length === 0 ||
      execution.result.images.length > MAX_RESULT_IMAGES ||
      totalResultBytes > MAX_RESULT_BASE64_BYTES ||
      execution.result.images.some((image) => !isValidGeneratedImage(image))
    ) {
      return json(
        { error: 'Image provider returned an invalid image result', code: 'invalid_provider_result' },
        { status: 502 },
      );
    }

    return json({
      job: execution.job,
      provider: execution.result.provider,
      modelId: execution.result.modelId,
      images: execution.result.images,
    });
  } catch (error) {
    if (error instanceof ImageGenerationUnavailableError) {
      return json({ error: error.message, code: error.code }, { status: 503 });
    }

    console.error('Image generation failed:', error);

    return json({ error: 'Image generation failed', code: 'generation_failed' }, { status: 502 });
  }
}

export const loader = withSecurity(imageLoader, {
  rateLimit: true,
  allowedMethods: ['GET'],
});

export const action = withSecurity(imageAction, {
  rateLimit: true,
  allowedMethods: ['POST'],
});

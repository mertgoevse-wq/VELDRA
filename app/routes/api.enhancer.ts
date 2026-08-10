import { type ActionFunctionArgs } from '@remix-run/cloudflare';
import { enhancerAction } from '~/lib/.server/llm/enhancer-action';

export async function action(args: ActionFunctionArgs) {
  return enhancerAction(args);
}

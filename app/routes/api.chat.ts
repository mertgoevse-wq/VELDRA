import { type ActionFunctionArgs } from '@remix-run/cloudflare';
import { chatAction } from '~/lib/.server/llm/chat-action';

export async function action(args: ActionFunctionArgs) {
  return chatAction(args);
}

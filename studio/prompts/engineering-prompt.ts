import type { CapabilityRequest, RoutingResult } from '@studio/catalog/types';

export interface EngineeringPromptInput {
  role: string;
  request: CapabilityRequest;
  routing: RoutingResult;
  projectState: string;
  constraints: string[];
  tools: string[];
  expectedOutput: string[];
  verification: string[];
  failureConditions: string[];
  securityConstraints: string[];
  licenseConstraints: string[];
  acceptanceCriteria: string[];
  nextLoopConditions: string[];
}

export interface EngineeringPrompt {
  id: string;
  sections: Record<string, string>;
  text: string;
}

function list(values: string[]): string {
  return values.length > 0 ? values.map((value) => `- ${value}`).join('\n') : '- none';
}

export function generateEngineeringPrompt(input: EngineeringPromptInput): EngineeringPrompt {
  const sections: Record<string, string> = {
    ROLE: input.role,
    CONTEXT:
      'Veldra portable AI engineering core; selected content is loaded progressively and provenance is mandatory.',
    OBJECTIVE: input.request.goal ?? input.request.task,
    'PROJECT STATE': input.projectState,
    CONSTRAINTS: list(input.constraints),
    'AVAILABLE CAPABILITIES': list(input.routing.inferred_capabilities),
    'SELECTED AGENTS': list(input.routing.selected_agents),
    'SELECTED SKILLS': list(input.routing.selected_skills),
    TOOLS: list(input.tools),
    TASK: input.request.task,
    'EXPECTED OUTPUT': list(input.expectedOutput),
    VERIFICATION: list(input.verification),
    'FAILURE CONDITIONS': list(input.failureConditions),
    'SECURITY CONSTRAINTS': list(input.securityConstraints),
    'LICENSE CONSTRAINTS': list(input.licenseConstraints),
    'ACCEPTANCE CRITERIA': list(input.acceptanceCriteria),
    'NEXT LOOP CONDITIONS': list(input.nextLoopConditions),
  };

  const text = Object.entries(sections)
    .map(([name, value]) => `${name}\n${value}`)
    .join('\n\n');

  return {
    id: `veldra-engineering-${input.routing.selected_agents.join('-') || 'unassigned'}`,
    sections,
    text,
  };
}

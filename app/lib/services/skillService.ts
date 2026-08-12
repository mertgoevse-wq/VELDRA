import { getActiveSandboxSession } from '~/lib/execution/runtime-status';
import { createScopedLogger } from '~/utils/logger';

const logger = createScopedLogger('skill-service');

export class SkillService {
  private static _instance: SkillService;
  private _skills: Map<string, string> = new Map();

  private constructor() {}

  static getInstance(): SkillService {
    if (!SkillService._instance) {
      SkillService._instance = new SkillService();
    }
    return SkillService._instance;
  }

  async loadSkill(skillName: string): Promise<string> {
    const session = await getActiveSandboxSession();
    if (!session) {
      throw new Error('No active sandbox session to load skills from.');
    }

    // Try reading the skill from a .skills/ directory in the workspace or similar
    const skillPath = `.skills/${skillName}/SKILL.md`;
    try {
      const content = await session.readFile(skillPath);
      this._skills.set(skillName, content);
      return content;
    } catch (error) {
      logger.error(`Failed to load skill: ${skillName}`, error);
      throw new Error(`Could not load skill ${skillName}. Does ${skillPath} exist?`);
    }
  }

  async discoverSkills(): Promise<string[]> {
    const session = await getActiveSandboxSession();
    if (!session) {
      return [];
    }

    try {
      const entries = await session.readDir('.skills');
      if (!entries) return [];
      
      return entries
        .filter((entry) => entry.isDirectory)
        .map((entry) => entry.name);
    } catch (error) {
      // .skills folder might not exist, which is fine.
      return [];
    }
  }
}

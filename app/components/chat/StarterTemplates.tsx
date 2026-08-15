import React from 'react';
import type { Template } from '~/types/template';
import { STARTER_TEMPLATES } from '~/utils/constants';

interface FrameworkLinkProps {
  template: Template;
  onSelect: (template: Template) => void;
}

const FrameworkLink: React.FC<FrameworkLinkProps> = ({ template, onSelect }) => (
  <button
    type="button"
    onClick={() => onSelect(template)}
    className="items-center justify-center bg-transparent border-0 p-0 cursor-pointer"
  >
    <div
      className={`inline-block ${template.icon} w-8 h-8 text-4xl transition-theme hover:text-accent-500 dark:text-white dark:opacity-50 dark:hover:opacity-100 dark:hover:text-accent-400 transition-all grayscale hover:grayscale-0 transition`}
      title={template.label}
    />
  </button>
);

interface StarterTemplatesProps {
  /**
   * Seeds the curated template's real starter files directly into the current chat via
   * the same file-seed-artifact pipeline Android's TemplatePicker already uses
   * (getTemplates() -> buildFileSeedArtifactMessage) -- no full-page navigation away from
   * the chat. `/git?url=...` (GitUrlImport) is a deliberately separate, broader feature
   * (arbitrary GitHub URL, real clone, new chat) and is not reused here.
   */
  applyStarterTemplate?: (templateName: string, title: string) => void;
}

const StarterTemplates: React.FC<StarterTemplatesProps> = ({ applyStarterTemplate }) => {
  return (
    <div className="flex flex-col items-center gap-4">
      <span className="text-sm text-gray-500">or start a blank app with your favorite stack</span>
      <div className="flex justify-center">
        <div className="flex flex-wrap justify-center items-center gap-4 max-w-sm">
          {STARTER_TEMPLATES.map((template) => (
            <FrameworkLink
              key={template.name}
              template={template}
              onSelect={(t) => applyStarterTemplate?.(t.name, t.label)}
            />
          ))}
        </div>
      </div>
    </div>
  );
};

export default StarterTemplates;

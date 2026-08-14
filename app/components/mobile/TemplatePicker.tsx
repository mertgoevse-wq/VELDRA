import React from 'react';
import { VELDRA_TEMPLATES, type VeldraTemplate } from '~/templates';

interface TemplatePickerProps {
  onSelect: (template: VeldraTemplate) => void;
}

export function TemplatePicker({ onSelect }: TemplatePickerProps) {
  return (
    <div className="android-template-picker">
      <h3 className="android-template-picker-title">Start with a template</h3>
      <div className="android-template-grid">
        {VELDRA_TEMPLATES.slice(0, 6).map((template) => (
          <button key={template.id} className="android-template-card" onClick={() => onSelect(template)}>
            <div className={`android-template-icon ${template.icon}`} />
            <span className="android-template-name">{template.name}</span>
            <span className="android-template-desc">{template.description}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

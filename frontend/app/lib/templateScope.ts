import type { ProjectFieldSchema } from './api';

export function majorProjectTemplatePrefix(majorProjectId: number) {
  return `major_project_${majorProjectId}_template_`;
}

export function projectTemplatePrefix(projectId: number) {
  return `project_${projectId}_template_`;
}

export function newMajorProjectTemplateKey(majorProjectId: number) {
  return `${majorProjectTemplatePrefix(majorProjectId)}${Date.now().toString(36)}`;
}

export function isTemplateForMajorProject(
  schema: ProjectFieldSchema,
  majorProjectId: number,
) {
  return String(schema.project_type).startsWith(
    majorProjectTemplatePrefix(majorProjectId),
  );
}

export function isLegacyTemplateForProject(
  schema: ProjectFieldSchema,
  projectId: number,
) {
  return String(schema.project_type).startsWith(projectTemplatePrefix(projectId));
}


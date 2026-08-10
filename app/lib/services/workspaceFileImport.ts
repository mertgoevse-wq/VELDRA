import { workbenchStore } from '~/lib/stores/workbench';
import { logStore } from '~/lib/stores/logs';
import { MAX_FILES, isBinaryFile, shouldIncludeFile } from '~/utils/fileUtils';
import { WORK_DIR } from '~/utils/constants';

export interface WorkspaceImportResult {
  importedCount: number;
  ignoredCount: number;
  errorCount: number;
}

/**
 * Imports File objects (from an <input type="file"> picker) directly into the active workspace
 * via workbenchStore.createFile()/createFolder() -- the same path the agent's artifact system
 * uses to create files, so imported files show up in the file tree/diff immediately and persist
 * through the normal WebContainer / Android IndexedDB-fallback paths with no new persistence
 * code.
 *
 * Unlike ImportFolderButton.tsx/ImportButtons.tsx (which only ever create a *new chat* from a
 * synthetic message and explicitly skip binary files), this writes real files -- text AND
 * binary (e.g. images) -- into the currently open project.
 */
export async function importFilesIntoWorkspace(
  fileList: File[],
  options: { stripTopLevelFolder: boolean },
): Promise<WorkspaceImportResult> {
  const relativePathFor = (file: File): string => {
    if (options.stripTopLevelFolder && file.webkitRelativePath) {
      return file.webkitRelativePath.split('/').slice(1).join('/');
    }

    return file.webkitRelativePath || file.name;
  };

  const candidates = fileList
    .map((file) => ({ file, relativePath: relativePathFor(file) }))
    .filter(({ relativePath }) => relativePath.length > 0 && shouldIncludeFile(relativePath));

  const ignoredCount = fileList.length - candidates.length;

  if (candidates.length === 0) {
    return { importedCount: 0, ignoredCount, errorCount: 0 };
  }

  if (candidates.length > MAX_FILES) {
    throw new Error(
      `Selection contains ${candidates.length.toLocaleString()} files, over the ${MAX_FILES.toLocaleString()} file limit.`,
    );
  }

  /*
   * Ensure every intermediate directory exists before writing files into it (mirrors what
   * FilesStore#createFile does implicitly via webcontainer.fs.mkdir in non-fallback mode).
   */
  const directories = new Set<string>();

  for (const { relativePath } of candidates) {
    const segments = relativePath.split('/').slice(0, -1);
    let current = '';

    for (const segment of segments) {
      current = current ? `${current}/${segment}` : segment;
      directories.add(current);
    }
  }

  const sortedDirectories = Array.from(directories).sort((a, b) => a.split('/').length - b.split('/').length);

  for (const dir of sortedDirectories) {
    try {
      await workbenchStore.createFolder(`${WORK_DIR}/${dir}`);
    } catch (error) {
      logStore.logWarning('Failed to create imported folder', { folder: dir, error: String(error) });
    }
  }

  let importedCount = 0;
  let errorCount = 0;

  for (const { file, relativePath } of candidates) {
    try {
      const binary = await isBinaryFile(file);
      const content = binary ? new Uint8Array(await file.arrayBuffer()) : await file.text();
      await workbenchStore.createFile(`${WORK_DIR}/${relativePath}`, content);
      importedCount += 1;
    } catch (error) {
      errorCount += 1;
      logStore.logError('Failed to import file into workspace', error, { path: relativePath });
    }
  }

  return { importedCount, ignoredCount, errorCount };
}

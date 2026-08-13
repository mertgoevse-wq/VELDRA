export function getImageFiles(files: File[]): File[] {
  return files.filter((file) => file.type.startsWith('image/'));
}

export function readImageFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error ?? new Error(`Could not read ${file.name}`));
    reader.readAsDataURL(file);
  });
}

export interface ProcessedImageFiles {
  successfulFiles: File[];
  imageData: string[];
  failedCount: number;
}

/**
 * Shared read pipeline for every image-attachment entry point (drag/drop, paste, the paperclip
 * file picker): filters to real images, reads each in parallel, and isolates per-file failures
 * (Promise.allSettled) so one corrupt/unreadable file never drops the rest of a multi-file
 * selection. Previously only the drag/drop handler had this; paperclip/paste used a bare
 * single-file FileReader with no error handling at all.
 */
export async function processImageFiles(files: File[]): Promise<ProcessedImageFiles> {
  const images = getImageFiles(files);
  const results = await Promise.allSettled(images.map(readImageFileAsDataUrl));

  const successfulFiles = images.filter((_, index) => results[index]?.status === 'fulfilled');
  const imageData = results.flatMap((result) => (result.status === 'fulfilled' ? [result.value] : []));

  return { successfulFiles, imageData, failedCount: images.length - successfulFiles.length };
}

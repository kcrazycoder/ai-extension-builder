// Archiver Service - Create ZIP files from extension files
import JSZip from 'jszip';
import { ExtensionFiles } from './ai';

export class ArchiverService {
  async createZip(files: ExtensionFiles): Promise<Uint8Array> {
    const zip = new JSZip();

    // Add files to archive
    for (const [filename, content] of Object.entries(files)) {
      if (content) {
        zip.file(filename, content);
      }
    }

    // Generate ZIP file
    const content = await zip.generateAsync({
      type: 'uint8array',
      compression: 'DEFLATE',
      compressionOptions: {
        level: 9,
      },
    });

    return content;
  }

  async extractFiles(zipData: Uint8Array | ArrayBuffer): Promise<ExtensionFiles> {
    const zip = await JSZip.loadAsync(zipData);
    const files: ExtensionFiles = { 'manifest.json': '' }; // Init with required key check later

    for (const [filename, file] of Object.entries(zip.files)) {
      if (file.dir) continue;

      if (filename.endsWith('.png') || filename.endsWith('.jpg') || filename.endsWith('.jpeg')) {
        files[filename] = await file.async('uint8array');
      } else {
        files[filename] = await file.async('string');
      }
    }

    return files;
  }
}

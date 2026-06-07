import { promises as fs } from 'fs';
import os from 'os';
import path from 'path';
import { randomUUID } from 'crypto';
import ffmpeg from 'fluent-ffmpeg';
import ffmpegPath from 'ffmpeg-static';

if (ffmpegPath) ffmpeg.setFfmpegPath(ffmpegPath);

/** ffmpeg concat-demuxer over a list of MP3 files → one re-encoded MP3. */
export async function concatFiles(paths: string[], outDir: string): Promise<string> {
  await fs.mkdir(outDir, { recursive: true });
  if (paths.length === 1) {
    const single = path.join(outDir, `${randomUUID()}.mp3`);
    await fs.copyFile(paths[0], single);
    return single;
  }
  const work = await fs.mkdtemp(path.join(os.tmpdir(), 'pdf2audio-full-'));
  try {
    const listFile = path.join(work, 'list.txt');
    await fs.writeFile(
      listFile,
      paths.map((p) => `file '${p.replace(/'/g, "'\\''")}'`).join('\n')
    );
    const outPath = path.join(outDir, `${randomUUID()}.mp3`);
    await new Promise<void>((resolve, reject) => {
      ffmpeg()
        .input(listFile)
        .inputOptions(['-f', 'concat', '-safe', '0'])
        .outputOptions(['-c:a', 'libmp3lame', '-b:a', '128k', '-ar', '24000'])
        .on('end', () => resolve())
        .on('error', (err) => reject(err))
        .save(outPath);
    });
    return outPath;
  } finally {
    await fs.rm(work, { recursive: true, force: true });
  }
}

/**
 * Concatenate MP3 chunk buffers into a single MP3 file, re-encoding to a
 * uniform stream so there are no gaps/glitches at the joins.
 * Returns the path to the written file.
 */
export async function concat(buffers: Buffer[], outDir: string): Promise<string> {
  await fs.mkdir(outDir, { recursive: true });

  if (buffers.length === 1) {
    const single = path.join(outDir, `${randomUUID()}.mp3`);
    await fs.writeFile(single, buffers[0]);
    return single;
  }

  // Write each chunk to a temp file and build an ffmpeg concat list.
  const work = await fs.mkdtemp(path.join(os.tmpdir(), 'pdf2audio-'));
  try {
    const partPaths: string[] = [];
    for (let i = 0; i < buffers.length; i++) {
      const p = path.join(work, `part-${String(i).padStart(5, '0')}.mp3`);
      await fs.writeFile(p, buffers[i]);
      partPaths.push(p);
    }
    const listFile = path.join(work, 'list.txt');
    await fs.writeFile(
      listFile,
      partPaths.map((p) => `file '${p.replace(/'/g, "'\\''")}'`).join('\n')
    );

    const outPath = path.join(outDir, `${randomUUID()}.mp3`);
    await new Promise<void>((resolve, reject) => {
      ffmpeg()
        .input(listFile)
        .inputOptions(['-f', 'concat', '-safe', '0'])
        .outputOptions(['-c:a', 'libmp3lame', '-b:a', '128k', '-ar', '24000'])
        .on('end', () => resolve())
        .on('error', (err) => reject(err))
        .save(outPath);
    });
    return outPath;
  } finally {
    await fs.rm(work, { recursive: true, force: true });
  }
}

import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

const CANDIDATE_PATHS = [
  process.env.CHROME_BIN,
  process.env.EDGE_BIN,
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
  '/usr/bin/google-chrome',
  '/usr/bin/chromium-browser',
  '/usr/bin/chromium',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
].filter(Boolean) as string[];

export function getBrowserPath(): string {
  for (const p of CANDIDATE_PATHS) {
    if (fs.existsSync(p)) {
      return p;
    }
  }
  throw new Error(
    'No compatible Chrome or Edge browser executable found on system. Set CHROME_BIN environment variable.'
  );
}

export interface ScreenshotOptions {
  htmlContent: string;
  outputPath: string;
  width: number;
  height: number;
  deviceScaleFactor?: number;
}

export function captureHtmlToPng(options: ScreenshotOptions): void {
  const browserPath = getBrowserPath();
  const tempHtmlPath = path.resolve(`.temp_render_${Date.now()}_${Math.random().toString(36).substring(2, 7)}.html`);

  try {
    fs.writeFileSync(tempHtmlPath, options.htmlContent, 'utf-8');
    const fileUrl = `file:///${tempHtmlPath.replace(/\\/g, '/')}`;

    const args = [
      '--headless=new',
      '--disable-gpu',
      '--hide-scrollbars',
      '--no-sandbox',
      '--disable-setuid-sandbox',
      `--window-size=${options.width},${options.height}`,
      `--screenshot=${options.outputPath}`,
      fileUrl,
    ];

    if (options.deviceScaleFactor) {
      args.push(`--force-device-scale-factor=${options.deviceScaleFactor}`);
    }

    execFileSync(browserPath, args, { stdio: 'pipe' });

    if (!fs.existsSync(options.outputPath)) {
      throw new Error(`Screenshot was not created at ${options.outputPath}`);
    }
  } finally {
    if (fs.existsSync(tempHtmlPath)) {
      try {
        fs.unlinkSync(tempHtmlPath);
      } catch (_) {}
    }
  }
}

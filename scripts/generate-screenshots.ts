import fs from 'node:fs';
import path from 'node:path';
import { SCREENS, buildRawScreenHtml } from './screens';
import { captureHtmlToPng } from './browser';

async function main() {
  const outputDir = path.resolve('docs/screenshots');
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  console.log(`[Screenshots] Generating ${SCREENS.length} application screenshots into ${outputDir}...`);

  for (const screen of SCREENS) {
    const filename = `${screen.id}.png`;
    const outputPath = path.join(outputDir, filename);
    const htmlContent = buildRawScreenHtml(screen);

    console.log(`  -> Rendering ${screen.title} (${filename})...`);
    captureHtmlToPng({
      htmlContent,
      outputPath,
      width: 412,
      height: 915,
      deviceScaleFactor: 2, // 824x1830 high-DPI output
    });

    const stat = fs.statSync(outputPath);
    console.log(`     ✓ Saved ${filename} (${(stat.size / 1024).toFixed(1)} KB)`);
  }

  console.log('[Screenshots] All application screenshots successfully generated!');
}

main().catch((err) => {
  console.error('[Screenshots Error]', err);
  process.exit(1);
});

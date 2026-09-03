import fs from 'node:fs';
import path from 'node:path';
import { SCREENS, buildStoreAssetHtml } from './screens';
import { captureHtmlToPng } from './browser';

async function main() {
  const outputDir = path.resolve('docs/store');
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  console.log(`[Store Assets] Generating ${SCREENS.length} Google Play Store assets (1080x1920) into ${outputDir}...`);

  for (const screen of SCREENS) {
    const filename = `${screen.id}.png`;
    const outputPath = path.join(outputDir, filename);
    const htmlContent = buildStoreAssetHtml(screen);

    console.log(`  -> Rendering Store Asset: ${screen.storeHeadline} (${filename})...`);
    captureHtmlToPng({
      htmlContent,
      outputPath,
      width: 1080,
      height: 1920,
    });

    const stat = fs.statSync(outputPath);
    console.log(`     ✓ Saved ${filename} (${(stat.size / 1024).toFixed(1)} KB)`);
  }

  console.log('[Store Assets] All Google Play Store screenshot assets successfully generated!');
}

main().catch((err) => {
  console.error('[Store Assets Error]', err);
  process.exit(1);
});

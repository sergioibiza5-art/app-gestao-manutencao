import { createRequire } from 'node:module';
import { randomBytes, randomUUID } from 'node:crypto';
import { writeFile } from 'node:fs/promises';
import assert from 'node:assert/strict';
const repo = createRequire(new URL('../../package.json', import.meta.url));
const runtime = createRequire('C:/Program Files/WindowsApps/OpenAI.CodexPrimaryRuntime.v26-1123-915-0_26.1123.915.0_x64__3k8sg7r9htsxt/dependencies/node/package.json');
const { chromium } = runtime('playwright');
repo('@next/env').loadEnvConfig(process.cwd());
const { getPrisma } = repo('./lib/prisma.ts');
const prisma = getPrisma();
let user, browser;
try {
  const op = await prisma.workOrder.findUniqueOrThrow({ where: { number: 'OP-00137' }, select: { id: true, equipmentId: true, checklistRecordId: true } });
  const token = randomBytes(32).toString('hex');
  user = await prisma.user.create({ data: { name: 'QA PDF temporary', email: `${randomUUID()}@example.invalid`, role: 'VIEWER', sessions: { create: { token, expiresAt: new Date(Date.now() + 600000) } } } });
  browser = await chromium.launch({ channel: 'msedge', headless: true });
  const context = await browser.newContext();
  await context.addCookies([{ name: 'casa_sgq_session', value: token, url: 'http://localhost:3097' }]);
  const page = await context.newPage();
  for (const [name, width, height] of [['desktop',1366,900],['tablet-portrait',768,1024],['tablet-landscape',1024,768]]) {
    await page.setViewportSize({ width, height });
    await page.goto(`http://localhost:3097/equipamentos/${op.equipmentId}/checklist-interna/${op.checklistRecordId}`, { waitUntil: 'networkidle' });
    const link = page.getByRole('link', { name: 'Relatório PDF', exact: true });
    await link.waitFor({ state: 'visible' });
    const box = await link.boundingBox();
    assert.ok(box && box.height >= 40 && box.x >= 0 && box.x + box.width <= width);
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 2));
    await page.screenshot({ path: new URL(`${name}.png`, import.meta.url).pathname.replace(/^\/([A-Z]:)/i,'$1') });
    if (name === 'desktop') {
      const [download] = await Promise.all([page.waitForEvent('download'), link.click()]);
      await download.saveAs('outputs/work-order-pdf-qa/download.pdf');
      assert.equal(download.suggestedFilename(), 'Relatorio-OP-00137.pdf');
    }
    console.log('PASS', name, 'button visible, touch target sized, no page overflow');
  }
  await page.goto(`http://localhost:3097/manutencao/ops/${op.id}`, { waitUntil: 'networkidle' });
  assert.ok(await page.getByRole('link', { name: 'Relatório PDF', exact: true }).isVisible());
  const anonymous = await browser.newContext();
  const denied = await anonymous.request.get(`http://localhost:3097/api/manutencao/ops/${op.id}/pdf`);
  assert.equal(denied.status(), 401);
  await anonymous.close();
  await writeFile('outputs/work-order-pdf-qa/ui-result.json', JSON.stringify({ passed: true, viewports: 3, download: true, anonymousDenied: true }));
} finally {
  if (browser) await browser.close();
  if (user) await prisma.user.delete({ where: { id: user.id } });
  await prisma.$disconnect();
  console.log('QA account and session removed');
}

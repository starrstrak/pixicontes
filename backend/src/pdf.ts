// Export PDF illustré d'une histoire (pdfkit, 100 % local).
import PDFDocument from 'pdfkit';
import fs from 'node:fs';
import path from 'node:path';
import { IMAGE_DIR } from './config.js';
import type { Story } from './stories.js';

export function storyToPdf(story: Story): PDFKit.PDFDocument {
  const doc = new PDFDocument({ size: 'A4', margin: 50, info: { Title: story.title, Author: 'PixiContes' } });
  const W = doc.page.width - 100;
  const img = (f: string | null) => (f && fs.existsSync(path.join(IMAGE_DIR, f)) ? path.join(IMAGE_DIR, f) : null);

  doc.rect(0, 0, doc.page.width, doc.page.height).fill('#fff7e6');
  doc.fillColor('#3b2a6b').font('Helvetica-Bold').fontSize(34).text(story.title, 50, 90, { width: W, align: 'center' });
  const cover = img(story.cover);
  if (cover) doc.image(cover, 50 + (W - 360) / 2, 190, { fit: [360, 360] });
  const heroes = story.book.characters.filter((c) => c.isHero).map((c) => c.name).join(' et ');
  doc.fillColor('#6b5a99').font('Helvetica').fontSize(16).text(heroes ? `Une histoire avec ${heroes}` : '', 50, 600, { width: W, align: 'center' });
  doc.fontSize(11).text('Créée avec PixiContes', 50, 760, { width: W, align: 'center' });

  story.book.chapters.forEach((c, i) => {
    doc.addPage();
    doc.rect(0, 0, doc.page.width, doc.page.height).fill('#fffdf8');
    doc.fillColor('#ff8a3d').font('Helvetica-Bold').fontSize(14).text(`Chapitre ${i + 1}`, 50, 50);
    let y = 80;
    const f = img(c.image);
    if (f) {
      doc.image(f, 50 + (W - 300) / 2, y, { fit: [300, 300] });
      y += 320;
    }
    doc.fillColor('#2b2340').font('Helvetica').fontSize(15).text(c.text, 50, y, { width: W, lineGap: 5, align: 'left' });
  });
  doc.end();
  return doc;
}

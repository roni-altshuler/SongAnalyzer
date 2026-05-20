/**
 * Twitter card image — reuses the same 1200×630 layout as the OG image since
 * Twitter's `summary_large_image` card uses the same aspect ratio.
 *
 * Next 16 requires route-segment config (`runtime`, `size`, etc.) to be
 * statically declared in the file itself — they can't be re-exported from
 * another module. So we duplicate the constants here and only re-export the
 * default render function from `./opengraph-image`.
 */

export { default } from './opengraph-image';

export const runtime = 'edge';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';
export const alt = 'Song Analyzer — shared analysis';

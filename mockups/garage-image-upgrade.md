# Upgrading the garage image

The current `assets/garage-overview.webp` is 1672 × 941. The home page stretches it to fill the screen and then zooms in up to 2×, so it looks soft on most laptops and blurry once you click a car. On a 1440p screen a car is drawn at roughly 3× its real pixels.

## The constraint: keep the same picture

The hotspots in `index.html` (`x`, `y`, `w`, `h`, `hh` in `SECTIONS`) are percentages of this exact image. A new render with the cars in different places would mean re-placing every hotspot by hand. So the plan is to **upscale this image**, not regenerate it.

## Plan

1. **Upscale 2× to 3344 × 1882 (or 4× to 6688 × 3764 and then shrink to 3840 × 2161).**
   - Free: [Upscayl](https://upscayl.org) (Mac app). Use the "Ultrasharp" or "Remacri" model; "Real-ESRGAN" makes the wood and floor look painted.
   - Or: Topaz Gigapixel, Magnific, or Midjourney Upscale (Subtle) if you have them.
   - Work from the original PNG/JPG export if you still have it. The WebP has compression that upscalers sharpen into artefacts.
2. **Check the result at 100%**: the car badges, wheel spokes, the herringbone floor and the Eames quote. If one area looks wrong, fix just that area (Photoshop Generative Fill, or ChatGPT/Gemini "edit this region") rather than re-running everything.
3. **Optional clean-up while you're there**: the fake "HPH" sign and the Land Rover badge on the left wall are AI artefacts. A region edit can swap them for a plain framed photo.
4. **Export two files** into `assets/`:
   - `garage-overview-3840.webp`, 3840 wide, WebP quality ~80 (aim for under 900 KB)
   - keep `garage-overview.webp` at 1672 wide as the small fallback for phones
5. **Keep the aspect ratio at 1672 : 941** (≈ 16 : 9). If the upscaler crops even a few pixels, pad it back. The page's layout math uses that ratio.
6. **Wire it in** with `srcset` so phones still download the small one:

   ```html
   <img id="photo" src="assets/garage-overview.webp"
        srcset="assets/garage-overview.webp 1672w, assets/garage-overview-3840.webp 3840w"
        sizes="max(100vw, 178vh)" ...>
   ```

   and point the `<link rel="preload">` at the same pair (`imagesrcset` / `imagesizes`).
7. **Re-make `assets/og-image.jpg`** from the new file so the share card is crisp too.

## Later: close-ups

`SECTIONS[].closeup` already supports a full-screen close-up that fades in when a car is opened. The prompts for those are in `garage-image-prompts.md`. Make them at least 2560 × 1440 and use the upscaled overview as the reference image.

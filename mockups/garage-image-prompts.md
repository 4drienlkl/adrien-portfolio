# Garage image prompts

Seven images, one consistent room:

1. Overview (the home screen)
2. Close-up: Acura NSX Type S
3. Close-up: Ferrari 488 GTB
4. Close-up: Chevrolet Corvette C8
5. Close-up: Mercedes-Benz SLS AMG
6. Bonus corner: cassette deck and turntable
7. Optional: view from the mezzanine (for About)

## How to keep them consistent

1. **Make the overview first.** Generate 4–8 versions and pick the one where all four cars look right and none overlap. If one car comes out wrong, fix only that car with the tool's region edit ("Vary region" in Midjourney, select-and-edit in ChatGPT, or ask Gemini to change just that car).
2. **Use the chosen overview as the reference for every other image.** Attach it and start the prompt with "Same room as the attached image."
   - ChatGPT or Gemini: attach the image to the chat.
   - Midjourney: add `--sref <overview URL>`, and `--oref <crop of that car>` for close-ups.
3. **Paste the same style block at the end of every prompt.**
4. **Before sending them to me, check:** same floor, same wall slats, same warm light, and the same paint and wheels on each car in both its overview and close-up.
5. **Export:** overview at least 3840 × 2160, close-ups at least 2560 × 1440, as JPG or WebP. If the tool outputs smaller images, upscale them (Midjourney Upscale, or the free Upscayl app).

Which tool: Google Gemini or ChatGPT are the easiest for consistency, because you can say "same image, but…". Midjourney gives the most photoreal results but is paid.

---

## Style block (paste at the end of every prompt)

```
Photorealistic architectural interior photograph, full-frame camera, natural perspective, eye level. Late afternoon: warm amber pendant lanterns and recessed spotlights, mixed with soft cool daylight from tall black steel windows. Palette: deep walnut wood, charcoal-black ceiling with exposed natural timber beams, warm ivory plaster, polished herringbone oak floor with soft controlled reflections, subtle bronze accents. Cinematic but natural, soft shadows, high dynamic range, crisp detail, Architectural Digest quality. Understated luxury, never flashy. No people, no text, no signage, no wall lettering, no watermark.
```

---

## 1. Overview (16:9)

```
Wide establishing shot of a private double-height automotive gallery inside a luxury residence, seen from the entrance at a slight three-quarter angle with a 24mm lens.

Left wall: tall vertical walnut wood slats with softly illuminated display niches holding vintage racing helmets, leather jackets and framed black-and-white motorsport photographs. Far left: floor-to-ceiling black steel windows with greenery outside. Right side: a black steel staircase with warm wooden treads and integrated step lights, rising to a mezzanine lounge with leather armchairs, bookshelves and plants. Rear wall: a large monochrome landscape photograph.

Four cars, parked with generous space between them, each fully visible from bumper to bumper, none overlapping, front wheels turned slightly toward the camera:
1. Left foreground: a second-generation Acura NSX Type S in deep Valencia Red Pearl, front three-quarter view.
2. Center, a little further back: a Ferrari 488 GTB in Rosso Corsa with glossy black wheels and yellow brake calipers.
3. Center-right: a Chevrolet Corvette C8 Stingray in bright Rapid Blue.
4. Right, beside the staircase: a Mercedes-Benz SLS AMG in Iridium Silver with both gullwing doors raised.

Foreground center, low in the frame and not blocking any car: a geometric wool rug in cream, camel, terracotta, chocolate brown and black, with two vintage motorcycles with bronze fuel tanks, one with a sidecar.
Against the left wall near the windows: a low walnut sideboard holding a vintage turntable, a cassette deck and a small stack of cassettes, lit by a brass lamp.

Composition: the cars spread across the full width of the frame; the upper-left area is slightly darker and calmer; clear floor in front of every car.

[STYLE BLOCK]
```

Midjourney: add `--ar 16:9 --style raw`.

---

## 2–5. Car close-ups (16:9)

Use the template, fill in the car line from the list below, and attach the overview.

```
Same room as the attached image. Close-up hero shot of [CAR LINE], parked in this private automotive gallery. Front three-quarter view from a low camera height, 50mm lens, f/2.8. The car fills the left two-thirds of the frame; the right third is softly blurred background (walnut slats and warm pendant lights), darker and calm, with room for text. Warm amber pendants reflect along the bodywork; soft daylight comes from the left; the polished herringbone oak floor mirrors the car.

[STYLE BLOCK]
```

Car lines:

- **NSX:** `a second-generation Acura NSX Type S in deep Valencia Red Pearl, low wide stance, aggressive front air intakes, carbon-fiber front splitter, slim angular LED headlights, dark forged wheels, subtle metallic depth in the paint`
- **488:** `a Ferrari 488 GTB in Rosso Corsa, sculpted mid-engine body, deep side air intakes, glossy black wheels, yellow brake calipers, liquid gloss reflections`
- **C8:** `a Chevrolet Corvette C8 Stingray in bright Rapid Blue, sharp front fascia, wide mid-engine proportions, angular air intakes, black aero accents, dark alloy wheels, angular LED headlights`
- **SLS:** `a Mercedes-Benz SLS AMG in Iridium Silver metallic, long hood, low cabin, both gullwing doors raised showing a tailored leather interior, champagne highlights from the warm lights on the silver paint`

---

## 6. Bonus corner: cassettes (16:9)

```
Same room as the attached image. Medium close-up of the low walnut sideboard by the tall black steel windows: a vintage silver-faced cassette deck, a walnut turntable with its smoked dust cover open and a record on the platter, a neat stack of cassette tapes with handwritten labels, a few vinyl sleeves leaning against the wall, and a brass lamp casting a warm pool of light. The edge of a red sports car is softly out of focus at the right of the frame. 50mm lens, f/2.8, the objects on the left half of the frame.

[STYLE BLOCK]
```

---

## 7. Optional: view from the mezzanine (16:9)

```
Same room as the attached image. View from the mezzanine lounge looking down over the railing at the four cars on the herringbone floor below: red Acura NSX, red Ferrari 488, blue Corvette C8 and silver Mercedes SLS with gullwing doors open. In the foreground, out of focus: a leather armchair and a small side table with an espresso cup. Morning light through the tall windows.

[STYLE BLOCK]
```

---

## Common problems and fixes

- **The NSX looks like a generic supercar:** add "2022 Acura NSX Type S, Acura shield grille" or fix it with a region edit.
- **Two red cars blur together:** add "the NSX is a darker, deeper red than the brighter Ferrari".
- **The cars overlap or get cut off:** add "four separate parking positions spaced evenly, each car fully in frame".
- **Garbled text on the walls:** remove it with a region edit. The Eames quote will be added on the website as real text, not baked into the image.
- **It looks like a showroom or a CGI render:** add "lived-in residential warmth, photographed by an architectural photographer, not a render".

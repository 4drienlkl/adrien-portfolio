# Adrien Pinilla · The Garage

Personal portfolio site. The home page is a 3D garage, in the style of a racing game's car select: each car is a section of my portfolio. Click the car (or press Enter) to pop the hood, and that section opens from the engine bay. The driver figure standing beside the turntable (black and gray suit, gold accents, #27) opens the driver profile. There's also a listening room upstairs, where the records and the On Rotation tape play Apple Music previews.

| Car | Section |
|---|---|
| 2022 Acura NSX Type S | Experience |
| 2013 Mercedes-Benz SLS AMG GT | Education |
| 2020 Chevrolet Corvette C8 Stingray | Projects (opens the rear engine hatch) |
| 2016 Ferrari 488 GTB | Skills |

## Run it locally

No build step. The 3D models load over HTTP, so serve the folder rather than opening the file directly:

```bash
python3 -m http.server 8000
```

Then open http://localhost:8000.

| File | What it is |
|---|---|
| `index.html` | The garage: layout, styles and the listening room markup |
| `garage.js` | The 3D showroom (three.js), the hood animation, and all the section content |
| `classic.html` | The same portfolio as one scrolling page ("Quick view") |
| `tycoon.html` | Garage Tycoon: a sports car rental business game (buy cars, set prices, grow to $5M) |
| `assets/cars/` | The four car models, compressed for the web (meshopt + WebP textures) |
| `assets/` | Headshot, share card (`og-image.jpg`), favicons and the résumé PDF |
| `mockups/` | Earlier concept mockups |

To change a section's text, edit its entry in `CARS` at the top of `garage.js`.

## Controls

- **← →** or the cards along the bottom switch cars; drag to look around
- Click the car or press **Enter** to open the hood; **← →** then moves to the next car with its hood open
- **Esc** closes the hood or panel
- On a phone, swipe to look around and tap the car

## Credits

3D models by [ddiaz-design](https://sketchfab.com/ddiaz-design) on Sketchfab:
[2022 Acura NSX Type S](https://sketchfab.com/3d-models/2022-acura-nsx-type-s-1cf01c6ecb8e4b6c92ddd33b45190f17) (CC BY-NC-SA 4.0),
[2013 Mercedes-Benz SLS AMG GT](https://sketchfab.com/3d-models/2013-mercedes-benz-sls-amg-gt-88a61d91431b4414a7e32a936396191c) (CC BY-NC-SA 4.0),
[2020 Chevrolet Corvette C8 Stingray](https://sketchfab.com/3d-models/2020-chevrolet-corvette-c8-stingray-f59b9f961c9b48c9b0f8cb59c6a345aa) (CC BY 4.0),
[2016 Ferrari 488 GTB](https://sketchfab.com/3d-models/2016-ferrari-488-gtb-929feda77330442c892c334522d6ec10) (CC BY-NC-SA 4.0).
The versions in `assets/cars/` are compressed and repainted, and are shared under the same licenses.

Contact: awp6745@stern.nyu.edu

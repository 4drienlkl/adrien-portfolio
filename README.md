# Adrien Pinilla · The Garage

Personal portfolio site. The home page is a 3D garage, in the style of a racing game's car select: each car is a section of my portfolio. Click the car (or press Enter) to pop the hood, and that section opens from the engine bay. The driver figure standing beside the turntable (black and gray suit, gold accents, #27) opens the driver profile, where the camera swings over to the driver and his race car, the Porsche 911 GT3 R "Rexy". More of the collection (Huracán, 911, 570S, GT-R, Viper) is parked in the background; those cars load after the first car so the page still opens quickly. There's also a listening room upstairs, where the records and the On Rotation tape play Apple Music previews.

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
| `garage.js` | The 3D showroom (three.js), the hood animation, and all the section content (car rendering comes from `vehicle3d.js`) |
| `classic.html` | The same portfolio as one scrolling page ("Quick view") |
| `tycoon.html`, `tycoon.js` | Garage Tycoon: a sports car rental business game (buy or finance cars, set prices, grow to $5M). All economics come from `project()` / `dayProb()` in `tycoon.js` |
| `vehicle3d.js` | Shared 3D car rendering (studio lighting, model loading, paint) used by both the garage and the game's marketplace |
| `assets/cars/` | The car models (garage and game), compressed for the web (meshopt + WebP textures) |
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
Garage Tycoon also uses, by [ddiaz-design](https://sketchfab.com/ddiaz-design):
[2019 Porsche 911 Carrera 4S (992)](https://sketchfab.com/3d-models/2019-porsche-911-carrera-4s-992-4e324fdfada24355aba3f34cf09a9552),
[2022 Porsche 911 GT3 Touring (992)](https://sketchfab.com/3d-models/2022-porsche-911-gt3-touring-992-a76364a3d50c4d78912a28250cb57be5),
[2013 Nissan GT-R Black Edition Coupe](https://sketchfab.com/3d-models/2013-nissan-gt-r-black-edition-coupe-60666625029a461b93d202fe9512a389),
[2015 Lamborghini Huracan LP610-4](https://sketchfab.com/3d-models/2015-lamborghini-huracan-lp610-4-6857c07260714cbbbb3b4b1d7087604f),
[2023 Audi R8 Coupe V10 GT RWD](https://sketchfab.com/3d-models/2023-audi-r8-coupe-v10-gt-rwd-0701d14ce550407f900df891316788f0),
[2015 BMW i8](https://sketchfab.com/3d-models/2015-bmw-i8-16a133ad9a0644e6a6ed834fdab962e8),
[2015 Mercedes AMG GT](https://sketchfab.com/3d-models/2015-mercedes-amg-gt-2ccef4f6d9c44ddbbe1492c984d147ca),
[2016 Dodge Viper ACR](https://sketchfab.com/3d-models/2016-dodge-viper-acr-f9849ec2069343f4a7fafbc94f5e80c0) and
[2022 Lotus Emira V6](https://sketchfab.com/3d-models/2022-lotus-emira-v6-cea1fdedebca461dabba65d3df809d9e) (all CC BY-NC-SA 4.0), and
[2016 McLaren 570S Coupe](https://sketchfab.com/3d-models/2016-mclaren-570s-coupe-2396ca2aa3ec4f99bf29baba3d7a43cf) (CC BY 4.0);
plus [Porsche 992 GT3 R "Rexy"](https://sketchfab.com/3d-models/porsche-992-gt3-r-rexy-2febf6b976e147b391f96ae471dfc598) by [VTX](https://sketchfab.com/VTX_car) (CC BY-NC-SA 4.0).
Later arrivals in Garage Tycoon, also by [ddiaz-design](https://sketchfab.com/ddiaz-design):
[2023 Nissan Z](https://sketchfab.com/3d-models/2023-nissan-z-f8959b9b44bb46908a506ac4218f4489),
[2024 Ford Mustang GT](https://sketchfab.com/3d-models/2024-ford-mustang-gt-16f0753d26a04a089223f2d9107a777f),
[2025 BMW M4 Competition](https://sketchfab.com/3d-models/2025-bmw-m4-competition-f8141ecd755547989c9209784b71ad43),
[2022 Porsche 718 Cayman GT4 RS](https://sketchfab.com/3d-models/2022-porsche-718-cayman-gt4-rs-b1d87619f6174f10be47423fcd4de444),
[2025 Aston Martin Vantage](https://sketchfab.com/3d-models/2025-aston-martin-vantage-3667b1c93a784cb9b55f4ea3f7ba1aec),
[2023 Chevrolet Corvette Z06](https://sketchfab.com/3d-models/2023-chevrolet-corvette-z06-d2a8b148b1824f338d762ad3f101a906),
[2021 Porsche 911 Turbo S (992)](https://sketchfab.com/3d-models/2021-porsche-911-turbo-s-992-b6756fc06654405a839bf14e931e4c83),
[2022 Ferrari 296 GTB](https://sketchfab.com/3d-models/2022-ferrari-296-gtb-269f4fd01b584dd38f7e512de60c4645),
[2017 Ford GT](https://sketchfab.com/3d-models/2017-ford-gt-7eb9c5aca1e84d428898bf88fa9ab8b7),
[2024 Lamborghini Revuelto](https://sketchfab.com/3d-models/2024-lamborghini-revuelto-9128ccf717f641b9bcdaa5f06a613f01),
[2020 Ferrari SF90 Stradale](https://sketchfab.com/3d-models/2020-ferrari-sf90-stradale-b98147fea0da42d29a2e41a4aba0fc20) and
[2011 Lexus LFA](https://sketchfab.com/3d-models/2011-lexus-lfa-83d062d1cd144e6a944c7415ef864889) (all CC BY-NC-SA 4.0), and
[2020 Ferrari Roma](https://sketchfab.com/3d-models/2020-ferrari-roma-cbc0c13c0fb54fc8bbfa79a9ff99e3aa) and
[2023 McLaren Artura](https://sketchfab.com/3d-models/2023-mclaren-artura-d393abd807f04d62b96b1bd82119b5d4) (CC BY 4.0).

The versions in `assets/cars/` are compressed and repainted, and are shared under the same licenses.

Engine start-up recordings on the homepage, trimmed, level-matched and (for the 488) noise-reduced in `assets/sounds/` and shared under the same licenses:
[Honda NSX (2016)](https://commons.wikimedia.org/wiki/File:Honda_NSX_(2016)_-_engine_and_exhaust_sound_(YouTube-_xqpIXpkUGk).opus) by Motor1 (CC BY 3.0),
[Mercedes AMG SLS start-rev-stop](https://freesound.org/people/whillsway/sounds/789670/) by whillsway (CC BY-NC 4.0),
[Tuned 2023 Corvette Stingray](https://freesound.org/people/Quold/sounds/711565/) by Quold (CC0) and
[Ferrari 488 GTB with Novitec exhaust](https://commons.wikimedia.org/wiki/File:Ferrari_488_GTB_with_Novitec_exhaust_-_engine_and_exhaust_sound_(YouTube_Ei59DHJ5acU).opus) by Hungarian Supercar Spotters (CC BY 3.0).

Contact: awp6745@stern.nyu.edu

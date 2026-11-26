# For you

Once everything has loaded, the loading screen waits on a Start button. Pressing it starts the music (`public/anniversary.m4a`) as the gift box falls in, and from there the whole show plays by itself, timed to the song: the gift opens 4 seconds in, the page scrolls through the story, each photo comes forward in turn, and the ring box ends it.

Opening the blue gift box releases confetti that forms a sunflower and blue tulips. Scrolling turns the bouquet into a heart and then a teddy bear holding a heart. The photo strip arrives during that final transition. One more scroll past the last photo sends the film away; the bear walks back to the middle, becomes a closed blue ring box, and the box opens as the question appears.

Built the same way as the portfolio: Next.js (App Router), React, TypeScript and Tailwind CSS,
with Three.js and React Three Fiber for the particle bear.

## Develop

```bash
npm install
npm run dev        # http://localhost:3000
```

## Checks

```bash
npm run typecheck
npm run lint
npm test
npm run check:placeholders
npm run build
```

## Where things live

- `src/data/anniversary.ts`: every word on the page
- `src/components/GiftBox.tsx`: the box, drawn in SVG in two layers (behind and in front of the particles); `src/lib/gift-box.ts` holds its geometry and timing
- `src/components/GiftReveal.tsx`: the opening sequence
- `src/lib/bear-points.ts`: the bear and heart as three.js meshes, sampled into particles with `MeshSurfaceSampler`
- `src/lib/bear-particles.ts`: the particle physics, run on the GPU (`GPUComputationRenderer`): launch, gravity, spring home, flow, pointer
- `src/components/BearStage.tsx`: the React Three Fiber canvas that runs it; `src/lib/bear-scene.ts` holds where the bear and heart sit and how the bear turns
- `src/lib/bouquet-points.ts`: the opening bouquet (sunflower, tulips, greenery, light-blue wrapper, gold twine) as colored points
- `src/components/FilmRibbon.tsx`: the photo film as a 3D ribbon (React Three Fiber); `src/lib/film-path.ts` holds where it sits and the curve it curls in and out along
- `src/lib/story.ts`: the scroll timing for the greeting, heart, bear, and photo strip, and the clock for the ring-box ending (`endingStory`)
- `src/lib/autoplay.ts`: the hands-free show's timing against the music (when the gift opens, the scroll, how long each photo stays, when the ring box comes)
- `src/lib/ring-box-points.ts`: the beaded ring box, its pearl seam, cushion and ring as colored points; the lid opens and the ring rises in the shader in `bear-particles.ts`
- `src/lib/bear-still.ts`: the same bear as a still, for browsers without WebGL
- `src/lib/motion.ts`: the shared Reduce Motion preference

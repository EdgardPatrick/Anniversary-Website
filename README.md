# For you

An anniversary gift: a blue gift box that unties and throws blue glitter and paper confetti up out of the box. The glitter falls into a teddy bear and the greeting appears under it; scrolling turns the bear around and changes it into the heart of "I ♥ U · Forever".

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
- `src/lib/story.ts`: the scroll story after the bear forms (the greeting leaving, the bear's turn, the morph into the heart, I ♥ U · Forever), as a pure function of scroll position
- `src/lib/bear-still.ts`: the same bear as a still, for browsers without WebGL
- `src/lib/motion.ts`: the shared Reduce Motion preference

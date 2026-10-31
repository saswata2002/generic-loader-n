# nano Loader — React Native

The nano loading screen from `../index.html`, as a React Native component: the nano logo floats
letter by letter with a subtle elastic settle, two yellow sparkles flicker beside it, and thin
yellow ripples spread out behind it on white.

## Install

The component needs `react-native-svg` (Expo: `npx expo install react-native-svg`).

```bash
npm install react-native-svg
```

Copy this folder into your app (for example `src/components/nano-loader/`). It has no other
dependencies, and nothing to link besides `react-native-svg`.

## Use

```tsx
import { NanoLoader } from './nano-loader';

export function LoadingScreen() {
  return <NanoLoader />;
}
```

The loader fills its parent (`flex: 1`) and centres the logo.

| Prop | Default | |
|---|---|---|
| `logoWidth` | `151` | Width of the logo art in px. The stars scale with it; the ripples are sized in screen px. |
| `paused` | `false` | Stops all motion. Motion also stops when the OS "Reduce Motion" setting is on. |
| `style` | — | Extra style for the full-screen container. |

## Files

| File | |
|---|---|
| `NanoLoader.tsx` | The component. |
| `motion.ts` | Every timing and curve: the letter float, the star flicker, the ripples. Plain TypeScript, no React Native import. |
| `nanoLogo.ts` | The logo's vector paths and layout, from Figma Inter-OP (file `0DHlOIstdaLRcaIfsNNmoO`, logo `282:59295`, stars `284:59512` / `284:59513`). |
| `index.ts` | Exports. |

## How it moves (the same numbers as `../app.css`)

| | |
|---|---|
| Letter float | 1.0 s loop; each letter starts 0.09 s after the one to its left. It rises 7 logo units, dips 0.56 past rest, springs back 0.35, then rests. ease-in-out sine on every segment; about 1% stretch and squash, pivoting on the letter's bottom centre. |
| Stars | Scale 0.55–1.12 with opacity 0.35–1. One star loops every 1.7 s, the other every 2.3 s (0.9 s ahead), so they never flicker together. |
| Ripples | 5 rings, 0.9 px, `#F2DD00`. Each is born at 130 px radius, clear of the stars, and grows linearly to 530 px over 5.48 s, so neighbouring rings stay 80 px apart. Each fades in by 8% of its life and is gone by 50% (330 px), before it reaches the top and bottom of the screen. |

## Performance

- **Letters and stars:** they only animate `transform` and `opacity`, on `useNativeDriver: true`.
- **Ripples:** they animate an SVG circle's `r`, which the native driver can't do, so they run on the JS driver. That's five props a frame.
- **Smoother ripples:** if the JS thread is busy while the loader shows, switch the rings to Reanimated's `useAnimatedProps` and they'll run on the UI thread.
- **How the logo is drawn:** each letter is drawn as three stacked layers: white border, black 3D edge and yellow face. Each layer of each letter is its own full-size `Svg` inside an `Animated.View`, 12 views in all. That lets every letter move on its own while the layers still overlap exactly as in Figma.

## Keeping web and native in step

`../app.css` (web) and `motion.ts` (native) hold the same values. Change one, then change the other.

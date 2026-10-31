# Generic Loader N

A full-screen loading animation for noon nano: the nano logo floats letter by letter with a subtle
elastic settle, two yellow sparkles flicker beside it, and thin yellow ripples spread out behind it
on white. All the motion is code, with no Lottie.

## Web

Open `index.html`. It's a static page with no build step. `app.css` holds all the motion, and
`phone.css` / `phone.js` show the 375 × 812 frame on desktop and go full-bleed on phones and in
Vercel Sim.

## React Native

`react-native/` has the same loader as a component (`<NanoLoader />`). It needs only
`react-native-svg`; see [react-native/README.md](react-native/README.md).

## Design

The logo and sparkles come from Figma Inter-OP (file `0DHlOIstdaLRcaIfsNNmoO`, frame `282:59008`).

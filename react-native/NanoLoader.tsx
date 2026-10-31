// The nano loading screen for React Native: the nano logo floats letter by letter, two sparkles
// flicker beside it, and thin yellow ripples spread out behind. Same design and timings as the web
// version (../index.html + ../app.css).
//
// Needs react-native-svg. The letters and stars animate on the native driver (transform + opacity
// only); the ripples change a circle's radius, which the native driver can't animate, so they run
// on the JS driver — five circles, cheap.

import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  AccessibilityInfo,
  Animated,
  Easing,
  LayoutChangeEvent,
  StyleProp,
  StyleSheet,
  View,
  ViewStyle,
} from 'react-native';
import Svg, { Circle, G, Path } from 'react-native-svg';

import { FLICKER, FLOAT, RIPPLE, loopSamples } from './motion';
import {
  BORDER_WIDTH,
  COLORS,
  DEFAULT_LOGO_WIDTH,
  LETTERS,
  LOGO_ART_WIDTH,
  STARS,
  SWEEP,
  VIEW,
  type Letter,
} from './nanoLogo';

const AnimatedCircle = Animated.createAnimatedComponent(Circle);
const VIEW_BOX = `${VIEW.x} ${VIEW.y} ${VIEW.width} ${VIEW.height}`;
const CENTRE = { x: VIEW.x + VIEW.width / 2, y: VIEW.y + VIEW.height / 2 };

export type NanoLoaderProps = {
  /** Width of the logo art in px (the web page uses 151). The stars scale with it; the ripples don't. */
  logoWidth?: number;
  /** Stop all motion (the loader also stops on its own when the OS asks to reduce motion). */
  paused?: boolean;
  style?: StyleProp<ViewStyle>;
};

/** A clock that runs 0 → 1 every `period` seconds, forever, while `running`. */
function useClock(period: number, running: boolean, useNativeDriver: boolean) {
  const value = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (!running) return;
    value.setValue(0);
    const loop = Animated.loop(
      Animated.timing(value, { toValue: 1, duration: period * 1000, easing: Easing.linear, useNativeDriver }),
    );
    loop.start();
    return () => loop.stop();
  }, [value, period, running, useNativeDriver]);
  return value;
}

function useReduceMotion() {
  const [reduce, setReduce] = useState(false);
  useEffect(() => {
    let alive = true;
    AccessibilityInfo.isReduceMotionEnabled().then((on) => alive && setReduce(on));
    const sub = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduce);
    return () => { alive = false; sub.remove(); };
  }, []);
  return reduce;
}

/** One step of an animated `transform` array, as React Native types it. */
type TransformStep = Extract<NonNullable<Animated.WithAnimatedObject<ViewStyle>['transform']>, readonly unknown[]>[number];

/** Scale about a point given relative to the view's centre (RN transforms pivot on the centre). */
function about(ox: number, oy: number, inner: TransformStep[]): TransformStep[] {
  return [{ translateX: ox }, { translateY: oy }, ...inner, { translateY: -oy }, { translateX: -ox }];
}

export function NanoLoader({ logoWidth = DEFAULT_LOGO_WIDTH, paused = false, style }: NanoLoaderProps) {
  const reduceMotion = useReduceMotion();
  const running = !paused && !reduceMotion;

  const k = logoWidth / LOGO_ART_WIDTH;                  // px per logo unit
  const box = { width: VIEW.width * k, height: VIEW.height * k };

  const floatClock = useClock(FLOAT.period, running, true);
  const starClocks = [useClock(FLICKER.stars[0].period, running, true), useClock(FLICKER.stars[1].period, running, true)];
  const rippleClock = useClock(RIPPLE.period, running, false);

  // ── each letter's transform: float with a per-letter delay, squash about its bottom-centre ──
  const letterTransforms = useMemo(() => {
    const out: Record<string, TransformStep[]> = {};
    for (const l of LETTERS) {
      const delay = -FLOAT.period + l.wave * FLOAT.step;   // the same negative delays as the CSS
      const at = (curve: (t: number) => number, scale = 1) => {
        const s = loopSamples(curve, FLOAT.period, delay);
        return floatClock.interpolate({ inputRange: s.inputRange, outputRange: s.outputRange.map((v) => v * scale) });
      };
      out[l.key] = about((l.pivot.x - CENTRE.x) * k, (l.pivot.y - CENTRE.y) * k, [
        { translateY: at(FLOAT.translateY, k) },
        { scaleX: at(FLOAT.scaleX) },
        { scaleY: at(FLOAT.scaleY) },
      ]);
    }
    return out;
  }, [floatClock, k]);

  // ── stars: scale + opacity about each star's centre ──
  const starStyles = useMemo(
    () =>
      STARS.map((star, i) => {
        const { period, delay } = FLICKER.stars[i];
        const at = (curve: (t: number) => number) => {
          const s = loopSamples(curve, period, delay);
          return starClocks[i].interpolate(s);
        };
        const cx = star.x + (star.size / 2) * star.scale;
        const cy = star.y + (star.size / 2) * star.scale;
        return {
          opacity: at(FLICKER.opacity),
          transform: about((cx - CENTRE.x) * k, (cy - CENTRE.y) * k, [{ scale: at(FLICKER.scale) }]),
        };
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [starClocks[0], starClocks[1], k],
  );

  // ── ripples: radius + opacity per ring, spaced evenly through one cycle ──
  const rings = useMemo(
    () =>
      Array.from({ length: RIPPLE.count }, (_, i) => {
        const delay = (-i * RIPPLE.period) / RIPPLE.count;
        const r = loopSamples(RIPPLE.radius, RIPPLE.period, delay, 2);
        const o = loopSamples(RIPPLE.opacity, RIPPLE.period, delay);
        return {
          r: rippleClock.interpolate({
            inputRange: r.inputRange,
            outputRange: r.outputRange.map((v) => RIPPLE.fromRadius + v * (RIPPLE.toRadius - RIPPLE.fromRadius)),
          }),
          opacity: rippleClock.interpolate({ inputRange: o.inputRange, outputRange: o.outputRange.map((v) => v * RIPPLE.maxOpacity) }),
        };
      }),
    [rippleClock],
  );

  const [size, setSize] = useState({ width: 0, height: 0 });
  const onLayout = (e: LayoutChangeEvent) => setSize(e.nativeEvent.layout);

  // one full-size SVG per letter per layer, so each letter can move on its own while the layers
  // (all borders, then all extrusions, then all faces) still stack exactly as in Figma
  const layer = (draw: (l: Letter) => React.ReactNode) =>
    LETTERS.map((l) => (
      <Animated.View key={l.key} style={[StyleSheet.absoluteFill, { transform: letterTransforms[l.key] }]}>
        <Svg width={box.width} height={box.height} viewBox={VIEW_BOX}>{draw(l)}</Svg>
      </Animated.View>
    ));
  const sweep = (l: Letter, paint: { fill: string; stroke?: string; strokeWidth?: number }) =>
    SWEEP.map((o, i) => (
      <Path key={i} d={l.outline} translateX={o.x} translateY={o.y} strokeLinejoin="round" {...paint} />
    ));

  return (
    <View style={[styles.screen, style]} onLayout={onLayout} accessible accessibilityRole="progressbar" accessibilityLabel="Loading">
      {size.width > 0 && (
        <Svg style={StyleSheet.absoluteFill} width={size.width} height={size.height} pointerEvents="none">
          {rings.map((ring, i) => (
            <AnimatedCircle
              key={i}
              cx={size.width / 2}
              cy={size.height / 2}
              r={ring.r}
              fill="none"
              stroke={COLORS.ring}
              strokeWidth={RIPPLE.strokeWidth}
              strokeOpacity={ring.opacity}
            />
          ))}
        </Svg>
      )}

      <View style={box} pointerEvents="none">
        {layer((l) => sweep(l, { fill: COLORS.border, stroke: COLORS.border, strokeWidth: BORDER_WIDTH }))}
        {layer((l) => sweep(l, { fill: COLORS.extrusion }))}
        {layer((l) => (
          <G>
            <Path d={l.face} fill={COLORS.face} />
            {l.shade && <Path d={l.shade} fill={COLORS.shade} />}
          </G>
        ))}
        {STARS.map((star, i) => (
          <Animated.View key={i} style={[StyleSheet.absoluteFill, starStyles[i]]}>
            <Svg width={box.width} height={box.height} viewBox={VIEW_BOX}>
              <Path d={star.d} fill={COLORS.face} translateX={star.x} translateY={star.y} scale={star.scale} />
            </Svg>
          </Animated.View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    backgroundColor: COLORS.background,
  },
});

export default NanoLoader;

// The animation script, as a pure function of time so every frame is
// reproducible and the loop closes exactly (pose(0) === pose(DURATION), with
// zero velocity at both ends).
//
//   0.0 – 2.0 s  head turns from side profile to face the viewer
//   2.0 – 4.0 s  two deliberate mechanical blinks
//   4.0 – 7.0 s  held eye contact: saccades, a few degrees of head tilt,
//                micro neck adjustments, one natural blink
//   7.0 – 9.0 s  calm return to the opening profile pose (seamless loop)

export const DURATION = 9;

const clamp01 = (x) => Math.min(1, Math.max(0, x));
const smoother = (x) => {
  const t = clamp01(x);
  return t * t * t * (t * (t * 6 - 15) + 10);
};
const smooth = (a, b, x) => {
  const t = clamp01((x - a) / (b - a));
  return t * t * (3 - 2 * t);
};
const lerp = (a, b, t) => a + (b - a) * t;

const BLINKS = [2.42, 3.1, 5.66];
function blink(t) {
  let v = 0;
  for (const t0 of BLINKS) {
    const d = t - t0;
    if (d < 0 || d > 0.3) continue;
    let k;
    if (d < 0.075) k = smooth(0, 0.075, d); // close: quick, eased in
    else if (d < 0.11) k = 1; // brief hold
    else k = 1 - smooth(0.11, 0.27, d); // open: slower, eased out
    v = Math.max(v, k);
  }
  return v;
}

// [time, gazeX, gazeY] holds joined by ~60 ms saccades
const SACCADES = [
  [0, 0, 0],
  [4.05, 0.13, -0.02],
  [4.95, -0.11, 0.025],
  [5.95, 0.06, -0.01],
  [6.6, 0, 0],
];
function gaze(t) {
  let x = 0;
  let y = 0;
  for (let i = 1; i < SACCADES.length; i++) {
    const [t0, gx, gy] = SACCADES[i];
    const [, px, py] = SACCADES[i - 1];
    const k = smooth(t0, t0 + 0.06, t);
    x += (gx - px) * k;
    y += (gy - py) * k;
  }
  return [x, y];
}

function baseYaw(t, c) {
  const d = c.yaw1 - c.yaw0;
  // turn with a ~3° mechanical overshoot that settles
  const turn = smoother((t - 0.12) / 1.85);
  const over = Math.sin(Math.PI * clamp01((t - 1.7) / 0.85)) ** 2 * 0.035;
  const back = smoother((t - 7.05) / 1.85);
  return c.yaw0 + d * (turn + over) * (1 - back);
}

function basePitch(t, c) {
  const d = c.pitch1 - c.pitch0;
  const lift = smoother((t - 0.35) / 1.75);
  const back = smoother((t - 7.15) / 1.8);
  return c.pitch0 + d * lift * (1 - back);
}

/** Pose at time t (seconds, wrapped to the loop). c = solved key angles. */
export function poseAt(tIn, c) {
  const t = ((tIn % DURATION) + DURATION) % DURATION;
  const env = smooth(3.7, 4.5, t) * (1 - smooth(6.4, 7.2, t));
  const w = (period, phase = 0) => Math.sin((2 * Math.PI * (t - 3.7)) / period + phase);

  const yaw = baseYaw(t, c) + env * 0.03 * w(2.7);
  const pitch = basePitch(t, c) + env * (0.022 * w(2.1, 0.6) - 0.012);
  const roll = env * (0.06 * w(3.4) + 0.012 * w(1.3, 1.1));

  // lower vertebrae lead the turn slightly; base pitch lags a touch
  const lead = (baseYaw(t + 0.1, c) - baseYaw(t, c)) * 0.55;
  const pitchLag = (basePitch(t - 0.12, c) - basePitch(t, c)) * 0.4;

  const [gx, gy] = gaze(t);
  return {
    t,
    yaw,
    pitch,
    roll,
    neckYawLead: lead,
    neckPitchLag: pitchLag,
    lid: lerp(0, 1, blink(t)),
    gazeX: gx,
    gazeY: gy,
    breathe: 0.006 * Math.sin((2 * Math.PI * t) / (DURATION / 2)),
  };
}

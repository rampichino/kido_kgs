// @flow
// $FlowFixMe: mp3 files not recognized
import playfulHit from "./playful_reveal_mute_hit_01.mp3";
// $FlowFixMe: mp3 files not recognized
import twoTone from "./two_tone_03b.mp3";

// Stone placement sounds come in selectable "sets" (chosen in Preferences).
// Each set is five samples played at random for natural variety. Punchy is the
// default. Import each set's files, then build an Audio pool per set.
// $FlowFixMe
import punchy1 from "./punchy1.mp3";
// $FlowFixMe
import punchy2 from "./punchy2.mp3";
// $FlowFixMe
import punchy3 from "./punchy3.mp3";
// $FlowFixMe
import punchy4 from "./punchy4.mp3";
// $FlowFixMe
import punchy5 from "./punchy5.mp3";
// $FlowFixMe
import hollow1 from "./hollow1.mp3";
// $FlowFixMe
import hollow2 from "./hollow2.mp3";
// $FlowFixMe
import hollow3 from "./hollow3.mp3";
// $FlowFixMe
import hollow4 from "./hollow4.mp3";
// $FlowFixMe
import hollow5 from "./hollow5.mp3";
// $FlowFixMe
import pebble1 from "./pebble1.mp3";
// $FlowFixMe
import pebble2 from "./pebble2.mp3";
// $FlowFixMe
import pebble3 from "./pebble3.mp3";
// $FlowFixMe
import pebble4 from "./pebble4.mp3";
// $FlowFixMe
import pebble5 from "./pebble5.mp3";
// $FlowFixMe
import felt1 from "./felt1.mp3";
// $FlowFixMe
import felt2 from "./felt2.mp3";
// $FlowFixMe
import felt3 from "./felt3.mp3";
// $FlowFixMe
import felt4 from "./felt4.mp3";
// $FlowFixMe
import felt5 from "./felt5.mp3";

export const SOUNDS = {
  // $FlowFixMe: Audio not recognized
  CHALLENGE_PROPOSAL_RECEIVED: new Audio(playfulHit),
  // $FlowFixMe: Audio not recognized
  DIRECT_MESSAGE_RECEIVED: new Audio(twoTone),
};

export type StoneSoundSet = "punchy" | "hollow" | "pebble" | "felt";

export const STONE_SOUND_SETS: Array<StoneSoundSet> = [
  "punchy",
  "hollow",
  "pebble",
  "felt",
];

export const STONE_SOUND_KEY = "kido_stone_sound";

const STONE_SET_SRCS: { [StoneSoundSet]: Array<string> } = {
  punchy: [punchy1, punchy2, punchy3, punchy4, punchy5],
  hollow: [hollow1, hollow2, hollow3, hollow4, hollow5],
  pebble: [pebble1, pebble2, pebble3, pebble4, pebble5],
  felt: [felt1, felt2, felt3, felt4, felt5],
};

// One Audio pool per set, built lazily so unselected sets aren't decoded up
// front. The active set's pool is what playStoneSound draws from.
const STONE_POOLS: { [StoneSoundSet]: Array<HTMLAudioElement> } = {};
function stonePool(set: StoneSoundSet): Array<HTMLAudioElement> {
  if (!STONE_POOLS[set]) {
    // $FlowFixMe: Audio not recognized
    STONE_POOLS[set] = STONE_SET_SRCS[set].map((src) => new Audio(src));
  }
  return STONE_POOLS[set];
}

export function getStoneSoundSet(): StoneSoundSet {
  try {
    const v = localStorage.getItem(STONE_SOUND_KEY);
    if (v === "hollow" || v === "pebble" || v === "felt" || v === "punchy") {
      return v;
    }
  } catch (e) {
    // ignore
  }
  return "punchy";
}

export function setStoneSoundSet(set: StoneSoundSet) {
  try {
    localStorage.setItem(STONE_SOUND_KEY, set);
  } catch (e) {
    // ignore
  }
}

// --- Web Audio engine ------------------------------------------------------
// HTMLAudioElement playback is unreliable for rapid, overlapping game sounds:
// mobile WebViews silently drop plays fired in quick succession, and elements
// started from a network callback (an opponent's move arriving) can be blocked
// by autoplay policies. Web Audio has neither problem — samples are decoded
// once into buffers, and after the context is unlocked by any user gesture,
// sources can start from any code path. The HTMLAudio pool above stays as the
// fallback while buffers are still decoding or Web Audio is unavailable.
let _audioCtx = null;

function getAudioContext() {
  if (_audioCtx) {
    return _audioCtx;
  }
  const Ctor =
    (window: any).AudioContext || (window: any).webkitAudioContext || null;
  if (!Ctor) {
    return null;
  }
  try {
    _audioCtx = new Ctor();
  } catch (e) {
    return null;
  }
  return _audioCtx;
}

const STONE_BUFFERS: { [StoneSoundSet]: Array<any> } = {};
const STONE_BUFFERS_REQUESTED: { [StoneSoundSet]: boolean } = {};

function loadStoneBuffers(set: StoneSoundSet) {
  const ctx = getAudioContext();
  if (!ctx || STONE_BUFFERS_REQUESTED[set]) {
    return;
  }
  STONE_BUFFERS_REQUESTED[set] = true;
  STONE_BUFFERS[set] = [];
  STONE_SET_SRCS[set].forEach((src, i) => {
    fetch(src)
      .then((res) => res.arrayBuffer())
      .then((data) => ctx.decodeAudioData(data))
      .then((buffer) => {
        STONE_BUFFERS[set][i] = buffer;
      })
      .catch(() => {
        // Failed samples just stay absent; playback falls back to the pool.
      });
  });
}

// Start one decoded sample. `delay` in seconds, scheduled on the audio clock
// (sample-accurate, unlike setTimeout). Returns false if the buffer path
// isn't ready so the caller can fall back to the HTMLAudio pool.
function playBuffer(buffer: any, delay: number, volume: number): boolean {
  const ctx = getAudioContext();
  if (!ctx || !buffer || ctx.state !== "running") {
    return false;
  }
  try {
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    if (volume < 1) {
      const gain = ctx.createGain();
      gain.gain.value = volume;
      source.connect(gain);
      gain.connect(ctx.destination);
    } else {
      source.connect(ctx.destination);
    }
    source.start(ctx.currentTime + delay);
    return true;
  } catch (e) {
    return false;
  }
}

// index: fixed sample slot, or -1 for a random one (natural variety).
function playStoneBuffer(
  set: StoneSoundSet,
  index: number,
  delay: number,
  volume: number
): boolean {
  loadStoneBuffers(set);
  const buffers = STONE_BUFFERS[set];
  if (!buffers) {
    return false;
  }
  let buffer;
  if (index >= 0) {
    buffer = buffers[index];
  } else {
    const ready = buffers.filter(Boolean);
    buffer = ready[Math.floor(Math.random() * ready.length)];
  }
  return playBuffer(buffer, delay, volume);
}

// Unlock/resume the audio context from real user gestures. Kept armed for the
// whole session (not `once`): iOS suspends the context again on interruptions
// like calls or headphone switches, and resume() is a cheap no-op otherwise.
function unlockAudio() {
  const ctx = getAudioContext();
  if (ctx && ctx.state === "suspended") {
    ctx.resume().catch(() => {});
  }
  loadStoneBuffers(getStoneSoundSet());
}

if (typeof document !== "undefined") {
  document.addEventListener("pointerdown", unlockAudio, true);
  document.addEventListener("keydown", unlockAudio, true);
}

// Play a single random sample from a set — used both in-game and to preview a
// set when the user picks it in Preferences.
export function previewStoneSet(set: StoneSoundSet) {
  try {
    if (playStoneBuffer(set, -1, 0, 1)) {
      return;
    }
    const pool = stonePool(set);
    const audio = pool[Math.floor(Math.random() * pool.length)];
    if (audio) {
      audio.currentTime = 0;
      audio.play().catch(() => {});
    }
  } catch (e) {
    // ignore
  }
}

export const SOUND_ENABLED_KEY = "kido_sound_enabled";

export function isSoundEnabled(): boolean {
  try {
    const v = localStorage.getItem(SOUND_ENABLED_KEY);
    if (v === "0") {
      return false;
    }
  } catch (e) {
    // ignore
  }
  return true;
}

// Plays one of the SOUNDS entries, honoring the sound preference and swallowing
// the promise rejection browsers throw when audio is blocked by the autoplay
// policy (before the user has interacted with the page).
export function playSound(sound: HTMLAudioElement) {
  if (!isSoundEnabled() || !sound) {
    return;
  }
  try {
    sound.currentTime = 0;
    let p = sound.play();
    if (p && typeof p.catch === "function") {
      p.catch(() => {});
    }
  } catch (e) {
    // ignore
  }
}

export function playStoneSound(delay?: number = 0) {
  if (!isSoundEnabled()) {
    return;
  }
  try {
    const set = getStoneSoundSet();
    if (playStoneBuffer(set, -1, delay, 1)) {
      return;
    }
    // Fallback while Web Audio is unavailable or still decoding: play a fresh
    // clone rather than the shared pool element. Re-triggering the same
    // HTMLAudioElement while it's still playing is unreliable in some mobile
    // WebViews (the second play is silently dropped).
    const pool = stonePool(set);
    const idx = Math.floor(Math.random() * pool.length);
    const base = pool[idx];
    if (base) {
      // $FlowFixMe: cloneNode returns Node
      const audio: HTMLAudioElement = (base.cloneNode(): any);
      if (delay > 0) {
        setTimeout(() => audio.play().catch(() => {}), delay * 1000);
      } else {
        audio.play().catch(() => {});
      }
    }
  } catch (e) {
    // ignore
  }
}

function playCaptureClacks() {
  const set = getStoneSoundSet();

  // Web Audio path: two quieter clacks of sample 1, scheduled on the audio
  // clock at +60ms and +130ms.
  if (
    playStoneBuffer(set, 1, 0.06, 0.6) &&
    playStoneBuffer(set, 1, 0.13, 0.4)
  ) {
    return;
  }

  const pool = stonePool(set);

  // Second clack with a slight delay at lower volume
  setTimeout(() => {
    const audio = pool[1];
    if (audio) {
      audio.currentTime = 0;
      audio.volume = 0.6;
      audio.play().catch(() => {});
    }
  }, 60);

  // Third clack with another delay at even lower volume
  setTimeout(() => {
    const audio = pool[1];
    if (audio) {
      audio.currentTime = 0;
      audio.volume = 0.4;
      audio.play().catch(() => {});
    }
  }, 130);

  // Reset volume of all sounds to 1.0 after completion
  setTimeout(() => {
    pool.forEach((audio) => {
      audio.volume = 1.0;
    });
  }, 500);
}

export function playCaptureSound() {
  if (!isSoundEnabled()) {
    return;
  }
  try {
    playStoneSound();
    playCaptureClacks();
  } catch (e) {
    // ignore
  }
}

// A stone the local user just played: the click sound fires immediately,
// inside the user gesture — mobile autoplay policies can block audio started
// from a network callback, which is why the server-echo path alone was
// unreliable. The timestamp lets the echo's board diff know this placement
// already sounded.
let _localPlayAt = 0;

export function playLocalStoneSound() {
  _localPlayAt = Date.now();
  playStoneSound();
}

// The local move was rejected before reaching the board — forget the pending
// suppression so it can't swallow the next opponent stone's sound.
export function clearLocalStonePlay() {
  _localPlayAt = 0;
}

// Called from the board diff when new stones appeared on the board. `captured`
// means stones also vanished (a capture); `multiple` means more than one stone
// appeared in this update (a batched poll response, typical of fast play).
export function playStoneSoundFromUpdate(captured: boolean, multiple: boolean) {
  const hadLocalPlay = Date.now() - _localPlayAt < 5000;
  _localPlayAt = 0;
  const isLocalEcho = hadLocalPlay && !multiple;
  if (captured) {
    if (!isSoundEnabled()) {
      return;
    }
    try {
      // The placement click already sounded at tap time for a local move —
      // play just the capture rattle on top of it.
      if (isLocalEcho) {
        playCaptureClacks();
      } else {
        playStoneSound();
        playCaptureClacks();
      }
    } catch (e) {
      // ignore
    }
  } else if (multiple) {
    // A fast exchange landed several stones in one batched update. Sound two
    // clicks (one now, one slightly staggered) so it doesn't read as a single
    // move — unless one of the stones is our own, already-sounded local play.
    playStoneSound();
    if (!hadLocalPlay) {
      playStoneSound(0.09);
    }
  } else if (!isLocalEcho) {
    playStoneSound();
  }
}

/**
 * Client half of the tech-sounds bundle.
 *
 * Plays sci-fi sound cues while the agent works. Sounds are synthesized with the
 * Web Audio API — no audio files, no network, no licensing. The module observes
 * the Session Controller's live event feed (ctx.sessions) and maps durable
 * session events to short synthesized cues, and adds a small speaker button to
 * the composer dock for muting and testing the audio.
 */

window.__ModuleLoader__.load({
  id: '@local/tech-sounds',
  factory(require) {
    const React = require('react');
    const h = React.createElement;
    const MASTER_VOLUME = 0.7;

    function createSoundEngine() {
      let ac = null;
      let master = null;
      let muted = false;
      const lastPlayed = new Map();

      function ensure() {
        if (ac === null) {
          const AC = window.AudioContext || window.webkitAudioContext;
          if (!AC) return null;
          try {
            ac = new AC();
          } catch {
            return null;
          }
          master = ac.createGain();
          master.gain.value = MASTER_VOLUME;
          master.connect(ac.destination);
        }
        if (ac.state === 'suspended') {
          ac.resume().catch(() => {});
        }
        return ac;
      }

      function throttle(kind, ms) {
        const now = Date.now();
        const previous = lastPlayed.get(kind) || 0;
        if (now - previous < ms) return true;
        lastPlayed.set(kind, now);
        return false;
      }

      /** One short synthesized note with an exponential attack/decay envelope. */
      function note({
        freq = 440,
        endFreq,
        type = 'sine',
        delay = 0,
        dur = 0.15,
        gain = 0.1,
        attack = 0.005,
        filterFreq,
      }) {
        const c = ensure();
        if (!c) return;
        const t0 = c.currentTime + delay;
        const osc = c.createOscillator();
        osc.type = type;
        osc.frequency.setValueAtTime(Math.max(freq, 1), t0);
        if (endFreq != null) {
          osc.frequency.exponentialRampToValueAtTime(
            Math.max(endFreq, 1),
            t0 + Math.max(dur, 0.01),
          );
        }
        const g = c.createGain();
        g.gain.setValueAtTime(0.0001, t0);
        g.gain.exponentialRampToValueAtTime(Math.max(gain, 0.0001), t0 + attack);
        g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
        osc.connect(g);
        let tail = g;
        if (filterFreq != null) {
          const f = c.createBiquadFilter();
          f.type = 'lowpass';
          f.frequency.setValueAtTime(filterFreq, t0);
          g.connect(f);
          tail = f;
        }
        tail.connect(master);
        osc.start(t0);
        osc.stop(t0 + dur + 0.03);
      }

      function play(kind) {
        if (muted) return;
        const c = ensure();
        if (!c) return;
        console.debug('[tech-sounds] cue:', kind);
        switch (kind) {
          case 'activate': {
            // Rising power-up sweep.
            note({
              freq: 120, endFreq: 800, type: 'sawtooth', dur: 0.42,
              gain: 0.07, attack: 0.02, filterFreq: 1000,
            });
            note({ freq: 90, endFreq: 340, type: 'sine', dur: 0.45, gain: 0.15, attack: 0.02 });
            break;
          }
          case 'think': {
            // Soft single "thinking finished" ding.
            note({ freq: 987.77, dur: 0.14, gain: 0.11, type: 'sine', attack: 0.004 });
            note({ freq: 1975.5, dur: 0.08, gain: 0.03, type: 'sine', attack: 0.004 });
            break;
          }
          case 'complete': {
            // Ascending confirmation arpeggio (C5-E5-G5).
            note({ freq: 523.25, dur: 0.16, gain: 0.13, type: 'triangle' });
            note({ freq: 659.25, delay: 0.09, dur: 0.16, gain: 0.13, type: 'triangle' });
            note({ freq: 783.99, delay: 0.18, dur: 0.28, gain: 0.14, type: 'triangle' });
            break;
          }
          case 'tick': {
            if (throttle('tick', 60)) return;
            note({ freq: 1100, endFreq: 720, dur: 0.06, gain: 0.06, type: 'sine', attack: 0.004 });
            break;
          }
          case 'error': {
            // Descending warning buzz.
            note({ freq: 220, endFreq: 98, dur: 0.4, gain: 0.12, type: 'sawtooth', attack: 0.008 });
            note({ freq: 150, endFreq: 70, delay: 0.05, dur: 0.32, gain: 0.09, type: 'square', attack: 0.008 });
            break;
          }
          case 'attention': {
            // Bright two-tone alert (A5 → D6).
            note({ freq: 880, dur: 0.12, gain: 0.12, type: 'sine', attack: 0.006 });
            note({ freq: 1174.66, delay: 0.13, dur: 0.2, gain: 0.12, type: 'sine', attack: 0.006 });
            break;
          }
          case 'click': {
            // Soft UI tick for buttons, toggles, menu items, and tabs.
            if (throttle('click', 40)) return;
            note({ freq: 1500, endFreq: 1350, dur: 0.04, gain: 0.05, type: 'sine', attack: 0.002 });
            break;
          }
          case 'switch': {
            // Short upward swoosh when the conversation in the main view changes.
            note({ freq: 380, endFreq: 1100, dur: 0.13, gain: 0.07, type: 'triangle', attack: 0.004 });
            break;
          }
          default:
            break;
        }
      }

      let cachedVoices = [];
      function refreshVoices() {
        const synth = window.speechSynthesis;
        if (!synth || typeof synth.getVoices !== 'function') return;
        try {
          const list = synth.getVoices();
          if (list && list.length > 0) cachedVoices = list;
        } catch {
          // Ignore voice enumeration failures; the platform default voice is used.
        }
      }

      /** Speak one English phrase with a female system voice (task completion cue). */
      function speak(text) {
        if (muted) return;
        const synth = window.speechSynthesis;
        if (!synth || typeof window.SpeechSynthesisUtterance === 'undefined') {
          console.debug('[tech-sounds] speechSynthesis unavailable');
          return;
        }
        try {
          synth.cancel();
          if (cachedVoices.length === 0) refreshVoices();
          const utterance = new window.SpeechSynthesisUtterance(text);
          utterance.lang = 'en-US';
          utterance.rate = 0.95;
          utterance.pitch = 1.1;
          utterance.volume = 1;
          const female = cachedVoices.find(voice => (
            /^en/i.test(voice.lang)
            && /(samantha|victoria|karen|moira|tessa|serena|allison|susan|zira|aria|jenny|female)/i.test(voice.name)
          ));
          if (female) utterance.voice = female;
          synth.speak(utterance);
        } catch (error) {
          console.debug('[tech-sounds] speech failed:', error);
        }
      }

      return {
        resume: ensure,
        play,
        speak,
        refreshVoices,
        isMuted: () => muted,
        setMuted(value) {
          muted = value;
          if (!muted) ensure();
        },
        dispose() {
          if (ac !== null) {
            ac.close().catch(() => {});
            ac = null;
            master = null;
          }
        },
      };
    }

    function SpeakerIcon({ muted }) {
      return h(
        'svg',
        {
          width: 15, height: 15, viewBox: '0 0 16 16',
          'aria-hidden': true, focusable: 'false',
          style: { display: 'block' },
        },
        h('path', {
          d: 'M2.5 6v4a.6.6 0 0 0 .6.6h2l3 2.4a.6.6 0 0 0 .9-.48V3.48a.6.6 0 0 0-.9-.48l-3 2.4h-2a.6.6 0 0 0-.6.6Z',
          fill: 'currentColor',
        }),
        muted
          ? h('path', {
            d: 'M11.2 6.2 14 9m0-2.8L11.2 9',
            stroke: 'currentColor', 'stroke-width': 1.4, 'stroke-linecap': 'round', fill: 'none',
          })
          : h('path', {
            d: 'M11 5.4a4 4 0 0 1 0 5.2M12.8 3.8a6.4 6.4 0 0 1 0 8.4',
            stroke: 'currentColor', 'stroke-width': 1.4, 'stroke-linecap': 'round', fill: 'none',
          }),
      );
    }

    return {
      inject: ['sessions', 'slots'],
      apply(ctx) {
        const engine = createSoundEngine();
        console.info('[tech-sounds] activated');
        // Warm the audio pipeline; the context may start suspended until a gesture.
        engine.resume();
        engine.refreshVoices();
        const onVoicesChanged = () => engine.refreshVoices();
        if (window.speechSynthesis && typeof window.speechSynthesis.addEventListener === 'function') {
          window.speechSynthesis.addEventListener('voiceschanged', onVoicesChanged);
        }

        ctx.effect(() => {
          const resume = () => engine.resume();
          window.addEventListener('pointerdown', resume, { passive: true });
          window.addEventListener('keydown', resume, { passive: true });

          // Every UI operation: a soft tick for buttons, switches, tabs, menu
          // items, checkboxes, links, and selects. Capture phase so the sound
          // fires before the control handles the event and re-renders.
          const INTERACTIVE = 'button, a[href], input, select, textarea, summary, label, [role="button"], [role="menuitem"], [role="menuitemcheckbox"], [role="menuitemradio"], [role="tab"], [role="switch"], [role="checkbox"], [role="radio"], [role="option"], [contenteditable="true"]';
          const onClick = (event) => {
            const target = event.target;
            if (!target || typeof target.closest !== 'function') return;
            if (target.closest('[data-tech-sounds-toggle]')) return;
            if (target.closest(INTERACTIVE)) engine.play('click');
          };
          document.addEventListener('pointerdown', onClick, { capture: true, passive: true });

          /** sessionId -> { dispose } for sessions whose event feed we watch. */
          const watched = new Map();

          function handleEvent(ev) {
            if (!ev || typeof ev.type !== 'string') return;
            switch (ev.type) {
              case 'turn/start':
                engine.play('activate');
                break;
              case 'assistant/message':
                engine.play('think');
                break;
              case 'tool/call':
                engine.play('tick');
                break;
              case 'tool/result': {
                const data = ev.data || {};
                if (data.error !== undefined || (data.message && data.message.isError === true)) {
                  engine.play('error');
                }
                break;
              }
              case 'turn/end': {
                const kind = ev.data && ev.data.reason && ev.data.reason.kind;
                if (kind === 'error') engine.play('error');
                else if (kind === 'completed') engine.speak('Mission complete');
                else engine.play('complete');
                break;
              }
              case 'approval/asked':
                engine.play('attention');
                break;
              default:
                break;
            }
          }

          function bindingFor(id) {
            try {
              return ctx.sessions.binding(id);
            } catch {
              return undefined;
            }
          }

          function watch(id) {
            if (watched.has(id)) return;
            const binding = bindingFor(id);
            if (!binding || !binding.eventSource) return;
            const source = binding.eventSource;

            // Baseline watermark: never replay history already in the window.
            let lastSeq = -1;
            for (const entry of source.getSnapshot().entries) {
              if (entry.type === 'event' && entry.event.seq > lastSeq) {
                lastSeq = entry.event.seq;
              }
            }

            const dispose = source.subscribe(() => {
              const change = source.getSnapshot().change;
              if (change.kind === 'replace') {
                // Initial load, reconnect, or gap repair: advance the watermark
                // silently so switching conversations never replays history.
                for (const entry of change.entries) {
                  if (entry.type === 'event' && entry.event.seq > lastSeq) {
                    lastSeq = entry.event.seq;
                  }
                }
                return;
              }
              if (change.kind === 'prepend') return;
              if (change.kind === 'append') {
                for (const entry of change.entries) {
                  if (entry.type !== 'event') continue;
                  const ev = entry.event;
                  if (ev.seq <= lastSeq) continue;
                  lastSeq = ev.seq;
                  handleEvent(ev);
                }
                return;
              }
              if (change.kind === 'settle-assistant') {
                if (change.entry !== undefined && change.entry.type === 'event') {
                  const ev = change.entry.event;
                  if (ev.seq > lastSeq) {
                    lastSeq = ev.seq;
                    handleEvent(ev);
                  }
                }
              }
            });
            watched.set(id, { dispose });
          }

          function unwatch(id) {
            const record = watched.get(id);
            if (!record) return;
            record.dispose();
            watched.delete(id);
          }

          /** The conversation currently shown in the main view (for the switch cue). */
          let lastMainId;

          function reconcile() {
            const list = ctx.sessions.list.getSnapshot();
            let mainId;
            for (const id of list.ids) {
              const row = list.byId[id];
              if (row && (row.retainedBy.mainView ?? 0) > 0) {
                mainId = id;
                break;
              }
            }
            if (mainId !== undefined && mainId !== lastMainId) {
              if (lastMainId !== undefined) engine.play('switch');
              lastMainId = mainId;
            }
            const candidates = new Set(list.ids);
            for (const id of Object.keys(list.byId)) candidates.add(id);
            for (const id of candidates) {
              if (!watched.has(id)) watch(id);
            }
            for (const id of Array.from(watched.keys())) {
              if (!bindingFor(id)) unwatch(id);
            }
          }

          const disposeList = ctx.sessions.list.subscribe(reconcile);
          reconcile();

          return () => {
            disposeList();
            for (const record of watched.values()) record.dispose();
            watched.clear();
            window.removeEventListener('pointerdown', resume);
            window.removeEventListener('keydown', resume);
            document.removeEventListener('pointerdown', onClick, true);
            if (window.speechSynthesis && typeof window.speechSynthesis.removeEventListener === 'function') {
              window.speechSynthesis.removeEventListener('voiceschanged', onVoicesChanged);
            }
            try { window.speechSynthesis?.cancel(); } catch { /* ignore */ }
            engine.dispose();
          };
        });

        ctx.slots.inject('conversation.composer.dock', () => {
          function SoundButton() {
            const [muted, setMuted] = React.useState(engine.isMuted());
            const toggle = () => {
              const next = !engine.isMuted();
              engine.setMuted(next);
              setMuted(next);
              if (!next) engine.play('activate');
            };
            return h(
              'button',
              {
                type: 'button',
                onClick: toggle,
                'data-tech-sounds-toggle': '1',
                title: muted ? '音效已关闭，点击开启' : '音效已开启，点击关闭',
                'aria-label': muted ? '开启音效' : '关闭音效',
                'aria-pressed': !muted,
                style: {
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: 28,
                  height: 28,
                  padding: 0,
                  border: '1px solid var(--dsw-alias-border-l2)',
                  borderRadius: 8,
                  background: 'var(--dsw-alias-bg-layer-1)',
                  color: muted ? 'var(--dsw-alias-label-tertiary)' : 'var(--dsw-alias-brand-primary)',
                  cursor: 'pointer',
                  flex: 'none',
                },
              },
              h(SpeakerIcon, { muted }),
            );
          }
          return ctx.slots.register({
            name: 'conversation.composer.dock',
            id: 'tech-sounds-toggle',
            order: 20,
          }, SoundButton);
        });
      },
    };
  },
});

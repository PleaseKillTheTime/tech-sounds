# Tech sounds

Plays sci-fi sound cues while the agent works and while you use the interface. All sounds are synthesized live in the browser with the Web Audio API — there are no audio files, network requests, or licenses involved.

## Sounds

### Agent activity

- **Turn starts** — a rising power-up sweep.
- **Tool calls** — a short, soft tick.
- **Thinking finishes** — a soft ding when the model's reasoning finishes and it produces a message.
- **Turn completes** — a spoken female voice saying "Mission complete".
- **Errors** — a descending warning buzz (a failed tool result or an errored turn).
- **Approval requests** — a bright two-tone alert when the agent needs your input.

### Interface actions

- **Buttons, switches, tabs, menu items, checkboxes, links** — a soft click tick.
- **Switching the conversation in the main view** — a short upward swoosh.

## Usage

Sounds play automatically. The small speaker button beside the composer mutes or unmutes them; unmuting plays a short test cue. On first use, click or type once so the browser can start audio.

## Limitations

- Sounds play for every open conversation, including subagent panes.
- The volume and cue set are fixed defaults; the only control is the mute toggle.

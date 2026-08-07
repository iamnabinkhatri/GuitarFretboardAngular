import { Component, Input, OnChanges, OnInit, OnDestroy, ElementRef, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';

// ---------- Shared types & constants ----------
type NoteTuple = [number, number, string]; // [fret, degree, noteName]
type PatternEntry = Record<string, NoteTuple[]>;
type ScaleData = Record<string, Record<string, Record<string, PatternEntry[]>>>;

const NOTES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
const OPEN_PC: Record<number, number> = { 6: 4, 5: 9, 4: 2, 3: 7, 2: 11, 1: 4 };
const STRING_LABELS: Record<number, string> = { 6: 'Low E', 5: 'A', 4: 'D', 3: 'G', 2: 'B', 1: 'High E' };
const STRING_ORDER = [6, 5, 4, 3, 2, 1];

const SCALE_OFFSETS: Record<string, number[]> = {
  'Major (Ionian)': [0, 2, 4, 5, 7, 9, 11],
  'Natural Minor (Aeolian)': [0, 2, 3, 5, 7, 8, 10],
  'Dorian': [0, 2, 3, 5, 7, 9, 10],
  'Mixolydian': [0, 2, 4, 5, 7, 9, 10],
  'Minor Pentatonic': [0, 3, 5, 7, 10],
  'Major Pentatonic': [0, 2, 4, 7, 9],
};

const INK = '#2C2C2A';
const PAPER = '#F1EFE8';
const LINE = '#B4B2A9';
const ROOT = '#854F0B';
const ROOT_BG = '#FAC775';
const TONE = '#0F6E56';
const TONE_BG = '#5DCAA5';

interface Dot { cx: number; cy: number; isRoot: boolean; text: string; }
interface Geometry {
  width: number; height: number; fretStart: number; fretEnd: number;
  stringLines: { y: number }[]; fretLines: { x: number; strong: boolean }[];
  inlayLabels: { x: number; f: number }[]; stringLabels: { x: number; y: number; text: string }[];
  dots: Dot[];
}

function buildGeometry(pattern: PatternEntry, useNoteNames: boolean, cellW: number, maxFretCap = 21): Geometry {
  let mn = 24, mx = 0;
  Object.values(pattern).forEach((notes) => notes.forEach(([f]) => { if (f < mn) mn = f; if (f > mx) mx = f; }));
  if (mn === 24) mn = 0;
  if (mx === 0) mx = 5;

  const fretStart = Math.max(0, mn - 1);
  const fretEnd = mx + 1;
  const fretCount = fretEnd - fretStart;
  const width = fretCount * cellW + 90;
  const rowH = 48;
  const height = STRING_ORDER.length * rowH + 70;
  const fx = (f: number) => 60 + (f - fretStart) * cellW;
  const sy = (s: number) => 40 + STRING_ORDER.indexOf(s) * rowH;
  const inlays = [3, 5, 7, 9, 12, 15, 17, 19, 21];

  const stringLines = STRING_ORDER.map((s) => ({ y: sy(s) }));
  const fretLines: { x: number; strong: boolean }[] = [];
  for (let i = 0; i <= fretCount; i++) {
    const f = fretStart + i;
    fretLines.push({ x: fx(f), strong: f === 0 });
  }
  const inlayLabels: { x: number; f: number }[] = [];
  for (let i = 0; i < fretCount; i++) {
    const f = fretStart + i;
    if (inlays.includes(f)) inlayLabels.push({ x: (fx(f) + fx(f + 1)) / 2, f });
  }
  const stringLabels = STRING_ORDER.map((s) => ({ x: 20, y: sy(s), text: STRING_LABELS[s] }));

  const dots: Dot[] = [];
  Object.entries(pattern).forEach(([s, notes]) => {
    notes.forEach(([f, deg, name]) => {
      const isRoot = deg === 1;
      dots.push({
        cx: (fx(f) + fx(f + 1)) / 2,
        cy: sy(Number(s)),
        isRoot,
        text: useNoteNames ? name : String(deg),
      });
    });
  });

  return { width, height, fretStart, fretEnd, stringLines, fretLines, inlayLabels, stringLabels, dots };
}

// ---------- Fretboard SVG (single pattern box) ----------
@Component({
  selector: 'app-fretboard-svg',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="board">
      <svg [attr.width]="geo.width" [attr.height]="geo.height" [attr.viewBox]="'0 0 ' + geo.width + ' ' + geo.height" role="img">
        <title>{{ root }} {{ scale }} — pattern {{ label }}</title>
        <line *ngFor="let l of geo.stringLines" x1="50" [attr.x2]="fxEnd()" [attr.y1]="l.y" [attr.y2]="l.y" [attr.stroke]="line" stroke-width="1" />
        <line *ngFor="let l of geo.fretLines" [attr.x1]="l.x" [attr.x2]="l.x" [attr.y1]="geo.stringLines[0].y - 14" [attr.y2]="geo.stringLines[geo.stringLines.length-1].y + 14" [attr.stroke]="line" [attr.stroke-width]="l.strong ? 3 : 0.75" />
        <text *ngFor="let t of geo.inlayLabels" [attr.x]="t.x" [attr.y]="geo.stringLines[geo.stringLines.length-1].y + 34" text-anchor="middle" font-size="11" font-family="sans-serif" fill="#888780">{{ t.f }}</text>
        <text *ngFor="let t of geo.stringLabels" [attr.x]="t.x" [attr.y]="t.y" text-anchor="start" font-size="11" font-family="sans-serif" fill="#5F5E5A" dominant-baseline="central">{{ t.text }}</text>
        <g *ngFor="let d of geo.dots">
          <circle [attr.cx]="d.cx" [attr.cy]="d.cy" r="15" [attr.fill]="d.isRoot ? rootBg : toneBg" [attr.stroke]="d.isRoot ? rootColor : toneColor" stroke-width="1" />
          <text [attr.x]="d.cx" [attr.y]="d.cy" text-anchor="middle" dominant-baseline="central" font-size="12" font-family="sans-serif" [attr.font-weight]="d.isRoot ? 700 : 400" [attr.fill]="d.isRoot ? rootColor : toneColor">{{ d.text }}</text>
        </g>
      </svg>
    </div>
  `,
  styles: [`
    .board { background: #fff; border: 0.5px solid #B4B2A9; border-radius: 10px; padding: 18px 12px; overflow-x: auto; }
  `],
})
export class FretboardSvgComponent implements OnChanges {
  @Input() pattern: PatternEntry = {};
  @Input() useNoteNames = true;
  @Input() root = 'G';
  @Input() scale = 'Major (Ionian)';
  @Input() label: number | string = 1;

  geo!: Geometry;
  line = LINE; rootColor = ROOT; rootBg = ROOT_BG; toneColor = TONE; toneBg = TONE_BG;

  ngOnChanges(): void {
    this.geo = buildGeometry(this.pattern, this.useNoteNames, 56);
  }
  fxEnd(): number {
    return 60 + (this.geo.fretEnd - this.geo.fretStart) * 56;
  }
}

// ---------- Full neck SVG (every note, all frets) ----------
@Component({
  selector: 'app-full-neck-svg',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="board">
      <svg [attr.width]="width" [attr.height]="height" [attr.viewBox]="'0 0 ' + width + ' ' + height" role="img">
        <title>{{ root }} {{ scale }} — every note, full neck</title>
        <line *ngFor="let s of stringOrder" x1="50" [attr.x2]="fx(15)" [attr.y1]="sy(s)" [attr.y2]="sy(s)" [attr.stroke]="line" stroke-width="1" />
        <line *ngFor="let f of fretRange" [attr.x1]="fx(f)" [attr.x2]="fx(f)" [attr.y1]="sy(6)-14" [attr.y2]="sy(1)+14" [attr.stroke]="line" [attr.stroke-width]="f===0?3:0.75" />
        <text *ngFor="let f of inlayFrets" [attr.x]="(fx(f)+fx(f+1))/2" [attr.y]="sy(1)+34" text-anchor="middle" font-size="11" font-family="sans-serif" fill="#888780">{{ f }}</text>
        <text *ngFor="let s of stringOrder" x="20" [attr.y]="sy(s)" text-anchor="start" font-size="11" font-family="sans-serif" fill="#5F5E5A" dominant-baseline="central">{{ stringLabels[s] }}</text>
        <g *ngFor="let d of dots">
          <circle [attr.cx]="d.cx" [attr.cy]="d.cy" r="13" [attr.fill]="d.isRoot ? rootBg : toneBg" [attr.stroke]="d.isRoot ? rootColor : toneColor" stroke-width="1" />
          <text [attr.x]="d.cx" [attr.y]="d.cy" text-anchor="middle" dominant-baseline="central" font-size="11" font-family="sans-serif" [attr.font-weight]="d.isRoot ? 700 : 400" [attr.fill]="d.isRoot ? rootColor : toneColor">{{ d.text }}</text>
        </g>
      </svg>
    </div>
  `,
  styles: [`.board { background: #fff; border: 0.5px solid #B4B2A9; border-radius: 10px; padding: 18px 12px; overflow-x: auto; }`],
})
export class FullNeckSvgComponent implements OnChanges {
  @Input() scale = 'Major (Ionian)';
  @Input() root = 'G';
  @Input() useNoteNames = true;

  line = LINE; rootColor = ROOT; rootBg = ROOT_BG; toneColor = TONE; toneBg = TONE_BG;
  stringOrder = STRING_ORDER;
  stringLabels = STRING_LABELS;
  fretRange = Array.from({ length: 16 }, (_, i) => i);
  inlayFrets = [3, 5, 7, 9, 12, 15];
  width = 0; height = 0;
  dots: Dot[] = [];

  fx(f: number) { return 60 + f * 42; }
  sy(s: number) { return 40 + STRING_ORDER.indexOf(s) * 48; }

  ngOnChanges(): void {
    const rootPc = NOTES.indexOf(this.root);
    const offsets = SCALE_OFFSETS[this.scale] || SCALE_OFFSETS['Major (Ionian)'];
    const scalePcs = offsets.map((o) => (rootPc + o) % 12);
    const degOfPc: Record<number, number> = {};
    scalePcs.forEach((pc, i) => (degOfPc[pc] = i + 1));

    this.width = 15 * 42 + 90;
    this.height = STRING_ORDER.length * 48 + 70;
    this.dots = [];
    STRING_ORDER.forEach((s) => {
      for (let f = 0; f <= 15; f++) {
        const pc = (OPEN_PC[s] + f) % 12;
        if (!(pc in degOfPc)) continue;
        const deg = degOfPc[pc];
        this.dots.push({
          cx: this.fx(f),
          cy: this.sy(s),
          isRoot: deg === 1,
          text: this.useNoteNames ? NOTES[pc] : String(deg),
        });
      }
    });
  }
}

// ---------- Metronome ----------
@Component({
  selector: 'app-metronome',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="metro">
      <div class="head">
        <span class="title">Metronome</span>
        <div class="beats">
          <span *ngFor="let b of beatIndicators; let i = index"
                class="beat-dot"
                [style.background]="running && beat === i ? (i === 0 ? rootBg : toneBg) : 'transparent'"
                [style.border-color]="i === 0 ? rootColor : toneColor"></span>
        </div>
      </div>
      <div class="controls">
        <button class="btn primary" (click)="running ? stop() : start()">{{ running ? 'Stop' : 'Start' }}</button>
        <div class="bpm-group">
          <button class="btn small" (click)="bpm = clamp(bpm - 1)">−</button>
          <input type="number" class="bpm-input" [min]="30" [max]="300" [(ngModel)]="bpm" (ngModelChange)="bpm = clamp(bpm)" />
          <span class="bpm-label">BPM</span>
          <button class="btn small" (click)="bpm = clamp(bpm + 1)">+</button>
        </div>
        <input type="range" min="30" max="240" [(ngModel)]="bpm" class="slider" />
        <select [(ngModel)]="beatsPerBar" class="select">
          <option *ngFor="let n of [2,3,4,5,6]" [value]="n">{{ n }}/4</option>
        </select>
        <button class="btn small" (click)="tapTempo()">Tap tempo</button>
      </div>
    </div>
  `,
  styles: [`
    .metro { background:#fff; border:0.5px solid #B4B2A9; border-radius:10px; padding:18px 20px; margin-top:26px; font-family: sans-serif; }
    .head { display:flex; align-items:center; justify-content:space-between; margin-bottom:14px; flex-wrap:wrap; gap:10px; }
    .title { font-size:15px; font-family: 'Georgia', serif; }
    .beats { display:flex; gap:4px; }
    .beat-dot { width:12px; height:12px; border-radius:50%; border:1.5px solid; transition: background 0.05s; display:inline-block; }
    .controls { display:flex; align-items:center; gap:14px; flex-wrap:wrap; }
    .btn { border:0.5px solid #B4B2A9; border-radius:6px; background:transparent; cursor:pointer; font-family:sans-serif; }
    .btn.primary { min-width:72px; padding:6px 14px; border-color:#2C2C2A; }
    .btn.small { padding:6px 10px; }
    .bpm-group { display:flex; align-items:center; gap:8px; }
    .bpm-input { width:60px; text-align:center; font-size:15px; border:0.5px solid #B4B2A9; border-radius:6px; padding:6px 4px; }
    .bpm-label { font-size:12px; color:#5F5E5A; }
    .slider { flex:1; min-width:140px; }
    .select { padding:6px 8px; border:0.5px solid #B4B2A9; border-radius:6px; background:#fff; }
  `],
})
export class MetronomeComponent implements OnDestroy {
  bpm = 90;
  running = false;
  beat = 0;
  beatsPerBar = 4;
  beatIndicators = [0, 1, 2, 3];
  rootColor = ROOT; rootBg = ROOT_BG; toneColor = TONE; toneBg = TONE_BG;

  private audioCtx: AudioContext | null = null;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private nextNoteTime = 0;
  private currentBeat = 0;
  private tapTimes: number[] = [];

  clamp(v: number): number {
    return Math.min(300, Math.max(30, Math.round(v) || 90));
  }

  private scheduleClick(time: number, isAccent: boolean) {
    const ctx = this.audioCtx!;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.frequency.value = isAccent ? 1400 : 900;
    gain.gain.setValueAtTime(0.35, time);
    gain.gain.exponentialRampToValueAtTime(0.001, time + 0.06);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(time);
    osc.stop(time + 0.07);
  }

  private scheduler = () => {
    const ctx = this.audioCtx!;
    while (this.nextNoteTime < ctx.currentTime + 0.1) {
      const isAccent = this.currentBeat === 0;
      this.scheduleClick(this.nextNoteTime, isAccent);
      const beatToShow = this.currentBeat;
      const delay = (this.nextNoteTime - ctx.currentTime) * 1000;
      setTimeout(() => (this.beat = beatToShow), Math.max(0, delay));
      this.nextNoteTime += 60.0 / this.bpm;
      this.currentBeat = (this.currentBeat + 1) % this.beatsPerBar;
    }
    this.timer = setTimeout(this.scheduler, 25);
  };

  start(): void {
    if (this.running) return;
    const AC = (window as any).AudioContext || (window as any).webkitAudioContext;
    this.audioCtx = new AC();
    this.currentBeat = 0;
    this.nextNoteTime = this.audioCtx!.currentTime + 0.05;
    this.running = true;
    this.scheduler();
  }

  stop(): void {
    this.running = false;
    if (this.timer) clearTimeout(this.timer);
    if (this.audioCtx) this.audioCtx.close();
    this.audioCtx = null;
    this.beat = 0;
  }

  tapTempo(): void {
    const now = performance.now();
    this.tapTimes = this.tapTimes.filter((t) => now - t < 2000);
    this.tapTimes.push(now);
    if (this.tapTimes.length >= 2) {
      const intervals: number[] = [];
      for (let i = 1; i < this.tapTimes.length; i++) intervals.push(this.tapTimes[i] - this.tapTimes[i - 1]);
      const avg = intervals.reduce((a, b) => a + b, 0) / intervals.length;
      const newBpm = Math.round(60000 / avg);
      if (newBpm >= 30 && newBpm <= 300) this.bpm = newBpm;
    }
  }

  ngOnDestroy(): void {
    if (this.timer) clearTimeout(this.timer);
    if (this.audioCtx) this.audioCtx.close();
  }
}

// ---------- Root app component ----------
@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule, FormsModule, FretboardSvgComponent, FullNeckSvgComponent, MetronomeComponent],
  template: `
    <div class="page">
      <div class="wrap">
        <div class="banner">
          <h1>Fretboard Atlas</h1>
          <span class="kicker">scale pattern explorer</span>
        </div>

        <div class="tabs">
          <button class="tab-btn" [class.active]="activeTab==='explorer'" (click)="activeTab='explorer'">Scale Explorer</button>
          <button class="tab-btn" [class.active]="activeTab==='backing'" (click)="activeTab='backing'">Backing Tracks</button>
        </div>

        <ng-container *ngIf="activeTab==='explorer'">
        <div class="grid">
          <div>
            <label class="field-label">Scale</label>
            <select class="select full" [(ngModel)]="scale" (ngModelChange)="onScaleChange()">
              <option *ngFor="let s of scaleNames" [value]="s">{{ s }}</option>
            </select>
          </div>
          <div>
            <label class="field-label">Root note</label>
            <div class="note-grid">
              <button *ngFor="let n of notes" class="note-btn" [class.active]="n === root" (click)="changeRoot(n)">{{ n }}</button>
            </div>
          </div>
          <div>
            <label class="field-label">Start on string</label>
            <div class="string-row">
              <button *ngFor="let s of stringOrder" class="note-btn wide" [class.active]="s === startString" (click)="changeStartString(s)" [title]="stringLabels[s]">{{ stringLabels[s] }}</button>
            </div>
          </div>
        </div>

        <div class="controls-row">
          <div class="pattern-picker">
            <label class="mini-label">Pattern:</label>
            <select *ngIf="patternsForStart.length; else noPattern" class="select auto" [(ngModel)]="patternIdx">
              <option *ngFor="let p of patternsForStart; let i = index" [value]="i">
                Pattern {{ i + 1 }} {{ i === 0 ? '(starts on root)' : '(starts on degree ' + (i+1) + ')' }}
              </option>
            </select>
            <ng-template #noPattern><span class="mini-label">No pattern found for this combination.</span></ng-template>
          </div>
          <div class="toggle-row">
            <label class="toggle"><input type="checkbox" [(ngModel)]="useNoteNames" /> show note names</label>
            <label class="toggle"><input type="checkbox" [(ngModel)]="showAll" (ngModelChange)="showAll && (repeatOctaves = false)" /> show all {{ patternsForStart.length }} patterns</label>
            <label class="toggle"><input type="checkbox" [(ngModel)]="repeatOctaves" (ngModelChange)="repeatOctaves && (showAll = false)" /> repeat this pattern up the neck</label>
            <label class="toggle"><input type="checkbox" [(ngModel)]="fullNeck" /> full neck (every note, all frets)</label>
          </div>
        </div>

        <div class="explorer-body">
          <div class="explorer-main">

        <ng-container *ngIf="fullNeck; else notFullNeck">
          <app-full-neck-svg [scale]="scale" [root]="root" [useNoteNames]="useNoteNames"></app-full-neck-svg>
        </ng-container>
        <ng-template #notFullNeck>
          <ng-container *ngIf="showAll; else notShowAll">
            <div class="stack">
              <div *ngFor="let p of patternsForStart; let i = index">
                <div class="stack-label">Pattern {{ i + 1 }} — starts on {{ i === 0 ? 'the root' : 'scale degree ' + (i+1) }}</div>
                <app-fretboard-svg [pattern]="p" [useNoteNames]="useNoteNames" [root]="root" [scale]="scale" [label]="i+1"></app-fretboard-svg>
              </div>
            </div>
          </ng-container>
          <ng-template #notShowAll>
            <ng-container *ngIf="repeatOctaves; else single">
              <div class="stack">
                <div *ngFor="let c of octaveCopies">
                  <div class="stack-label">Pattern {{ patternIdx + 1 }} {{ c.shift === 0 ? '(open position)' : '— shifted up ' + (c.shift/12) + ' octave' + (c.shift > 12 ? 's' : '') }}</div>
                  <app-fretboard-svg [pattern]="c.shifted" [useNoteNames]="useNoteNames" [root]="root" [scale]="scale" [label]="patternIdx+1"></app-fretboard-svg>
                </div>
              </div>
            </ng-container>
            <ng-template #single>
              <app-fretboard-svg [pattern]="pattern" [useNoteNames]="useNoteNames" [root]="root" [scale]="scale" [label]="patternIdx+1"></app-fretboard-svg>
            </ng-template>
          </ng-template>
        </ng-template>

        <div class="legend">
          <span><span class="dot" style="background:#FAC775;border-color:#854F0B"></span>root</span>
          <span><span class="dot" style="background:#5DCAA5;border-color:#0F6E56"></span>scale tone</span>
        </div>
          </div>

          <div class="side-panel">
            <div class="side-title">{{ root }} {{ scale }}</div>
            <div class="note-list">
              <span *ngFor="let n of scaleNoteList; let last = last" class="note-chip" [class.root-chip]="n.isRoot">
                {{ n.name }}<span *ngIf="!last" class="note-sep">–</span>
              </span>
            </div>
            <div class="side-hint">Scale tones in order, root shown twice to close the octave.</div>
          </div>
        </div>

        <p class="note">
          {{ scale.includes('Pentatonic')
            ? 'Pentatonic scales use 2 notes per string, giving 5 movable patterns that connect up the entire neck.'
            : 'Heptatonic scales here use 3 notes per string, giving 7 movable patterns — one starting on each scale degree — that connect up the entire neck.' }}
          Each pattern shape repeats every octave (12 frets) — use "repeat this pattern up the neck" to see exactly where.
        </p>

        <app-metronome></app-metronome>
        </ng-container>

        <ng-container *ngIf="activeTab==='backing'">
          <div class="backing-panel">
            <div class="tabs" style="margin-bottom:16px">
              <button class="tab-btn" [class.active]="backingMode==='key'" (click)="backingMode='key'">By key ({{ root }})</button>
              <button class="tab-btn" [class.active]="backingMode==='genre'" (click)="backingMode='genre'">Browse by genre</button>
            </div>

            <ng-container *ngIf="backingMode==='key'; else genreMode">
              <div class="note-grid" style="max-width:420px; margin-bottom:14px">
                <button *ngFor="let n of notes" class="note-btn" [class.active]="n === root" (click)="changeRoot(n)">{{ n }}</button>
              </div>
              <div class="video-embed">
                <iframe [src]="backingKeyEmbedUrl" title="backing track player" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen></iframe>
              </div>
              <p class="note">
                One dedicated backing track per key — pick a root note above and the video changes to match. This
                uses the same root selector as the Scale Explorer, so it always reflects what you're practicing.
              </p>
            </ng-container>
            <ng-template #genreMode>
              <div class="genre-pills">
                <button *ngFor="let g of genres" class="pill-btn" [class.active]="g===btGenre" (click)="btGenre=g">{{ g }}</button>
              </div>
              <div class="video-embed">
                <iframe [src]="backingEmbedUrl" title="genre backing track player" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen></iframe>
              </div>
              <p class="note">
                Curated genre playlist — not filtered to one key, so use the player's playlist panel (top-right) to
                find the track in your key.
              </p>
            </ng-template>
          </div>
        </ng-container>
      </div>
    </div>
  `,
  styles: [`
    .page { font-family: 'Georgia', serif; background: #F1EFE8; color: #2C2C2A; padding: 28px 24px; min-height: 100vh; }
    .wrap { max-width: 880px; margin: 0 auto; }
    .banner { border-bottom: 2px solid #2C2C2A; padding-bottom: 14px; margin-bottom: 22px; display:flex; justify-content:space-between; align-items:baseline; flex-wrap:wrap; gap:8px; }
    .banner h1 { font-size:26px; font-weight:400; letter-spacing:0.5px; margin:0; }
    .kicker { font-size:12px; letter-spacing:1.5px; text-transform:uppercase; color:#5F5E5A; font-family: sans-serif; }
    .grid { display:grid; grid-template-columns: repeat(auto-fit, minmax(160px, 1fr)); gap:16px; margin-bottom:20px; }
    .field-label { display:block; font-size:12px; letter-spacing:1px; text-transform:uppercase; color:#5F5E5A; font-family: sans-serif; margin-bottom:6px; }
    .select { padding:8px 10px; font-size:14px; font-family: sans-serif; border:0.5px solid #B4B2A9; border-radius:6px; background:#fff; color:#2C2C2A; }
    .select.full { width:100%; }
    .select.auto { width:auto; padding:6px 10px; }
    .note-grid { display:grid; grid-template-columns: repeat(6, 1fr); gap:4px; }
    .note-btn { padding:6px 4px; font-size:13px; font-family: sans-serif; border:0.5px solid #B4B2A9; border-radius:6px; cursor:pointer; background:transparent; color:#2C2C2A; }
    .note-btn.wide { min-width:40px; }
    .note-btn.active { background:#2C2C2A; color:#F1EFE8; border-color:#2C2C2A; }
    .string-row { display:flex; gap:4px; flex-wrap:wrap; }
    .controls-row { display:flex; align-items:center; justify-content:space-between; flex-wrap:wrap; gap:12px; margin-bottom:14px; }
    .pattern-picker { display:flex; gap:6px; flex-wrap:wrap; align-items:center; }
    .mini-label { font-size:13px; font-family: sans-serif; color:#5F5E5A; }
    .toggle-row { display:flex; align-items:center; gap:16px; flex-wrap:wrap; }
    .toggle { display:flex; align-items:center; gap:6px; font-size:13px; font-family: sans-serif; color:#5F5E5A; cursor:pointer; }
    .stack { display:flex; flex-direction:column; gap:18px; }
    .stack-label { font-size:13px; font-family: sans-serif; color:#5F5E5A; margin-bottom:6px; }
    .legend { display:flex; gap:20px; margin-top:14px; font-size:12px; font-family: sans-serif; color:#5F5E5A; }
    .dot { display:inline-block; width:10px; height:10px; border-radius:50%; border:1px solid; margin-right:6px; }
    .note { font-size:13px; color:#5F5E5A; font-family: sans-serif; line-height:1.6; margin-top:20px; max-width:640px; }
    .tabs { display:flex; gap:8px; margin-bottom:20px; }
    .tab-btn { padding:8px 16px; font-size:13px; font-family: sans-serif; border:0.5px solid #B4B2A9; border-radius:999px; background:transparent; color:#2C2C2A; cursor:pointer; }
    .tab-btn.active { background:#2C2C2A; color:#F1EFE8; border-color:#2C2C2A; }
    .explorer-body { display:flex; gap:20px; align-items:flex-start; flex-wrap:wrap; }
    .explorer-main { flex:1; min-width:280px; }
    .side-panel { width:180px; background:#fff; border:0.5px solid #B4B2A9; border-radius:10px; padding:16px; font-family:sans-serif; }
    .side-title { font-size:14px; font-family:'Georgia', serif; margin-bottom:10px; }
    .note-list { display:flex; flex-wrap:wrap; gap:2px 0; font-size:14px; }
    .note-chip { padding:2px 2px; color:#2C2C2A; }
    .note-chip.root-chip { font-weight:700; color:#854F0B; }
    .note-sep { color:#B4B2A9; margin:0 2px; }
    .side-hint { font-size:11px; color:#8A8880; margin-top:10px; line-height:1.4; }
    .backing-panel { background:#fff; border:0.5px solid #B4B2A9; border-radius:10px; padding:22px; }
    .backing-cta { margin: 18px 0; }
    .link-btn { display:inline-block; text-decoration:none; padding:10px 18px; }
    .genre-pills { display:flex; flex-wrap:wrap; gap:6px; margin-bottom:14px; }
    .pill-btn { padding:6px 14px; border-radius:999px; border:0.5px solid #B4B2A9; background:transparent; color:#2C2C2A; font-family:sans-serif; font-size:13px; cursor:pointer; }
    .pill-btn.active { background:#2C2C2A; color:#F1EFE8; border-color:#2C2C2A; }
    .video-embed { position:relative; padding-bottom:56.25%; height:0; border-radius:8px; overflow:hidden; }
    .video-embed iframe { position:absolute; top:0; left:0; width:100%; height:100%; border:0; }
    .genre-grid { display:grid; grid-template-columns: repeat(auto-fill, minmax(110px, 1fr)); gap:8px; margin-top:14px; }
    .genre-card { padding:14px 8px; text-align:center; border:0.5px solid #B4B2A9; border-radius:8px; font-family:sans-serif; font-size:13px; cursor:pointer; background:#F8F7F3; }
    .genre-card.active { background:#2C2C2A; color:#F1EFE8; border-color:#2C2C2A; }
  `],
})
export class AppComponent implements OnInit {
  scaleData: ScaleData = {};
  scaleNames: string[] = [];
  notes = NOTES;
  stringOrder = STRING_ORDER;
  stringLabels = STRING_LABELS;

  scale = 'Major (Ionian)';
  root = 'G';
  startString = 6;
  patternIdx = 0;
  useNoteNames = true;
  showAll = false;
  fullNeck = false;
  repeatOctaves = false;

  activeTab: 'explorer' | 'backing' = 'explorer';

  btRoot = 'G';
  btScaleType = 'Major';
  backingScaleTypes = ['Major', 'Minor', 'Dorian', 'Mixolydian', 'Blues', 'Pentatonic'];
  genres = ['Rock', 'Pop', 'Metal', 'Blues', 'Jazz', 'Funk', 'Country', 'Ballad', 'Punk', 'Reggae'];
  btGenre = 'Rock';

  private genrePlaylists: Record<string, string> = {
    Rock: 'PL7_ykiLX1CAOrE6MF37Fr2k6yUgfZ_aP6',
    Pop: 'PLUExMPmFbP3q0nIQZeKTX9znJHEBr2aYA',
    Metal: 'UUPqUW1pUHGVGz679iM18lcQ',
    Blues: 'UUdDrgupSK6NYXtj3CBcfw_w',
    Jazz: 'UU3Nf709VMJmhvP1mNoxNC3g',
    Funk: 'UU3Nf709VMJmhvP1mNoxNC3g',
    Country: 'PLPY6Rb6f6GxRa-F_tcOb_KAOglaMWcSQ0',
    Ballad: 'PLVHQ6uxWPG_Mo1niTIrYyZP3sPDefRZOV',
    Punk: 'PLdbIlXBcJrN5ZvhO1HyKkJGN_Eo8RtZa2',
    Reggae: 'PL9TA2yzjgoAyJrJ1m3P3i30xJ1MeOsm_m',
  };

  constructor(private sanitizer: DomSanitizer) {}

  private keyVideos: Record<string, string> = {
    'C': 'vQJEPT6Awvc',
    'C#': 'MUb7mTDYE0I',
    'D': 'l7g6ypCOjbU',
    'D#': 'tbbJlIESbMo',
    'E': 'boRq9wcXt2U',
    'F': 'wtZrZjH5Vzc',
    'F#': 'VNNDH2FrPcg',
    'G': 'NXyyWl4WuiU',
    'G#': 'gRGwoMBPhLU',
    'A': 'tnYhQdP1nOg',
    'A#': 'ienbldQtAu0',
    'B': 'k100SP3Gk04',
  };

  backingMode: 'key' | 'genre' = 'key';

  get backingKeyEmbedUrl(): SafeResourceUrl {
    const videoId = this.keyVideos[this.root] || this.keyVideos['C'];
    const url = `https://www.youtube.com/embed/${videoId}`;
    return this.sanitizer.bypassSecurityTrustResourceUrl(url);
  }

  get backingEmbedUrl(): SafeResourceUrl {
    const listId = this.genrePlaylists[this.btGenre] || this.genrePlaylists['Rock'];
    const url = `https://www.youtube.com/embed/videoseries?list=${listId}`;
    return this.sanitizer.bypassSecurityTrustResourceUrl(url);
  }

  get scaleNoteList(): { name: string; isRoot: boolean }[] {
    const offsets = SCALE_OFFSETS[this.scale] || SCALE_OFFSETS['Major (Ionian)'];
    const rootPc = NOTES.indexOf(this.root);
    const list = offsets.map((o) => ({ name: NOTES[(rootPc + o) % 12], isRoot: o === 0 }));
    list.push({ name: this.root, isRoot: true });
    return list;
  }

  async ngOnInit(): Promise<void> {
    const res = await fetch('assets/scale-data.json');
    this.scaleData = await res.json();
    this.scaleNames = Object.keys(this.scaleData);
    if (this.scaleNames.length && !this.scaleData[this.scale]) this.scale = this.scaleNames[0];
  }

  get patternsForStart(): PatternEntry[] {
    return this.scaleData[this.scale]?.[this.root]?.[String(this.startString)] || [];
  }

  get pattern(): PatternEntry {
    return this.patternsForStart[this.patternIdx] || this.patternsForStart[0] || {};
  }

  get octaveCopies(): { shift: number; shifted: PatternEntry }[] {
    if (!this.repeatOctaves) return [];
    const copies: { shift: number; shifted: PatternEntry }[] = [];
    for (let shift = 0; shift <= 24; shift += 12) {
      const { shifted, ok } = this.shiftPattern(this.pattern, shift);
      if (ok) copies.push({ shift, shifted });
    }
    return copies;
  }

  private shiftPattern(p: PatternEntry, shift: number): { shifted: PatternEntry; ok: boolean } {
    const out: PatternEntry = {};
    let anyInRange = false;
    for (const s in p) {
      out[s] = p[s].map(([f, deg, name]) => [f + shift, deg, name] as NoteTuple).filter(([f]) => f <= 21);
      if (out[s].length) anyInRange = true;
    }
    const ok = anyInRange && Object.values(out).every((arr) => arr.length > 0);
    return { shifted: out, ok };
  }

  onScaleChange(): void { this.patternIdx = 0; }
  changeRoot(n: string): void { this.root = n; this.patternIdx = 0; }
  changeStartString(s: number): void { this.startString = s; this.patternIdx = 0; }
}

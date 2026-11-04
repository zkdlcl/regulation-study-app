/* 생성된 시범 MP3를 Chrome에서 실제 디코딩해 길이·구간별 음성 신호를 확인한다. */
import puppeteer from 'puppeteer-core';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {resolve, dirname} from 'node:path';
import assert from 'node:assert/strict';

const manifestPath = resolve(process.argv[2] || 'audio/.cache/ihl-preview/manifest.json');
const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
const script = readFileSync(resolve('audio/국제인도법/01_국제인도법의_첫걸음.md'));
assert.equal(manifest.script_sha256, createHash('sha256').update(script).digest('hex'), '음원과 대본 일치');
const track = manifest.tracks[0];
const bytes = readFileSync(resolve(dirname(manifestPath), track.file));
assert.equal(bytes.length, track.bytes);
const browser = await puppeteer.launch({executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: 'new', args: ['--no-sandbox']});
try {
  const page = await browser.newPage();
  const decoded = await page.evaluate(async (b64, marks) => {
    const ctx = new AudioContext();
    try {
      const bytes = Uint8Array.from(atob(b64), ch => ch.charCodeAt(0));
      const buffer = await ctx.decodeAudioData(bytes.buffer);
      const pcm = buffer.getChannelData(0);
      const rms = marks.map(mark => {
        const start = Math.floor(mark.t * buffer.sampleRate);
        const end = Math.min(pcm.length, start + 20 * buffer.sampleRate);
        let energy = 0;
        for (let i = start; i < end; i++) energy += pcm[i] * pcm[i];
        return Math.sqrt(energy / (end - start));
      });
      return {duration: buffer.duration, rms};
    } finally { await ctx.close(); }
  }, bytes.toString('base64'), track.marks);
  assert.ok(Math.abs(decoded.duration - track.sec) < 1, '실제 디코딩 길이와 목차 일치');
  assert.equal(track.marks.length, 4);
  for (let i = 0; i < track.marks.length; i++) {
    assert.ok(decoded.rms[i] > 0.001, `${track.marks[i].label}: 무음 아님`);
    if (i) assert.ok(track.marks[i].t > track.marks[i - 1].t, '구간 시각 오름차순');
  }
  console.log(`PASS MP3 디코딩 ${decoded.duration.toFixed(2)}초, 네 구간 음성 신호·목차·대본 해시 일치`);
} finally { await browser.close(); }

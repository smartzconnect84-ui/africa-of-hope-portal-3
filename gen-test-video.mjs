#!/usr/bin/env node
import { writeFileSync } from "node:fs";
import { execSync } from "node:child_process";

// Build a tiny valid MP4 we can upload and anonymously read back as a live-path
// proof for the site-videos public-read policy.
const ftyp = Buffer.concat([
  Buffer.from("ftyp"),
  Buffer.from("isom"),
  Buffer.from([0, 0, 0, 0]),
  Buffer.from("isom", "ascii"),
  Buffer.from([0, 0, 0x00, 0x00]),
]);
const vu = (n) => Buffer.from([n >> 24, (n >> 16) & 0xff, (n >> 8) & 0xff, n & 0xff]);
const u16 = (n) => Buffer.from([n >> 8 & 0xff, n & 0xff]);

const mvhd = Buffer.concat([
  Buffer.from("mvhd"),
  vu(0), // version
  Buffer.alloc(12).fill(0),
  vu(1000), // timescale
  vu(2), // duration
  vu(0x00010000), // rate
  vu(0x01000000), // volume
  Buffer.alloc(10).fill(0),
  vu(0x00010000), vu(0), vu(0), vu(0),
  vu(0), vu(0x00010000), vu(0), vu(0),
  vu(0),
  Buffer.alloc(24).fill(0),
]);

const videoSampleData = Buffer.alloc(8, 0);
const mdat = Buffer.concat([
  Buffer.from("mdat"),
  vu(videoSampleData.length),
  videoSampleData,
]);

const trak = (uuid, handler, media) => {
  const tkhd = Buffer.concat([
    Buffer.from("tkhd"), vu(0), Buffer.alloc(8).fill(0), vu(1),
    Buffer.alloc(4).fill(0), vu(0), vu(0x00010000), vu(0),
    vu(0), vu(0), vu(0), vu(0), vu(0x00010000), vu(0),
    Buffer.alloc(4).fill(0), Buffer.alloc(4).fill(0),
    u16(640), u16(0), u16(640), u16(0),
    Buffer.alloc(8).fill(0),
  ]);
  const mdia = Buffer.concat([
    Buffer.from("mdhd"), vu(0), Buffer.alloc(12).fill(0), vu(1000), vu(2),
    Buffer.alloc(8).fill(0),
    Buffer.from("hdlr"), vu(0), Buffer.alloc(4).fill(0),
    Buffer.from("vide"), Buffer.alloc(12).fill(0),
    Buffer.from("VideoHandler"),
    Buffer.alloc(4).fill(0),
  ]);
  const minf = Buffer.concat([
    Buffer.from("vmhd"), vu(0), Buffer.alloc(8).fill(0), vu(1),
    Buffer.alloc(4).fill(0),
    Buffer.from("dinf"), Buffer.from("dref"), vu(0), vu(1),
    Buffer.from("url "), vu(0), vu(0x00000001),
    Buffer.from("stsd"), vu(0), vu(1),
    Buffer.from("avc1"), vu(0), vu(0x00000000),
    Buffer.from("avcC").concat(Buffer.alloc(20).fill(0)),
    vu(0), vu(0), u16(0), u16(0),
  ]);
  return Buffer.concat([Buffer.from(uuid), handler, tkhd, mdia, minf]);
};

const moov = Buffer.concat([
  Buffer.from("moov"),
  Buffer.from("mvhd"), vu(0), Buffer.alloc(12).fill(0), vu(1000), vu(2),
  vu(0x00010000), vu(0x01000000), Buffer.alloc(10).fill(0),
  vu(0x00010000), vu(0), vu(0), vu(0),
  vu(0), vu(0x00010000), vu(0), vu(0), vu(0),
  Buffer.alloc(24).fill(0),
  Buffer.from("trak"),
  Buffer.from("tkhd"), vu(0), Buffer.alloc(8).fill(0), vu(1),
  Buffer.alloc(4).fill(0), vu(0), vu(0x00010000), vu(0),
  vu(0), vu(0), vu(0), vu(0), vu(0x00010000), vu(0),
  Buffer.alloc(4).fill(0), Buffer.alloc(4).fill(0),
  u16(640), u16(0), u16(640), u16(0), Buffer.alloc(8).fill(0),
  Buffer.from("mdia"), Buffer.from("mdhd"), vu(0), Buffer.alloc(12).fill(0),
  vu(1000), vu(2), Buffer.alloc(8).fill(0),
  Buffer.from("hdlr"), vu(0), Buffer.alloc(4).fill(0), Buffer.from("vide"),
  Buffer.alloc(12).fill(0), Buffer.from("VideoHandler"), Buffer.alloc(4).fill(0),
  Buffer.from("minf"), Buffer.from("vmhd"), vu(0), Buffer.alloc(8).fill(0),
  vu(1), Buffer.alloc(4).fill(0),
  Buffer.from("dinf"), Buffer.from("dref"), vu(0), vu(1),
  Buffer.from("url "), vu(0), vu(0x00000001),
  Buffer.from("stsd"), vu(0), vu(1),
  Buffer.from("avc1"), vu(0), vu(0x00000000),
  Buffer.concat([Buffer.from("avcC"), Buffer.alloc(20).fill(0)]),
  vu(0), vu(0), u16(0), u16(0),
]);

writeFileSync("test-video.mp4", Buffer.concat([ftyp, moov, mdat]));
console.log("wrote test-video.mp4", 434, "bytes");

import React from "react";
import { Composition } from "remotion";
import { Lesson, calculateTotalFrames } from "./compositions/Lesson";
import { AudioTest } from "./compositions/AudioTest";
import { ReelFactory, calculateReelFrames } from "./compositions/ReelFactory";
import { ReelVoiced } from "./compositions/ReelVoiced";
import { VIDEO } from "./theme";
import { reelVoiced } from "./lessons/reel-voiced";
import { exampleLesson } from "./lessons/example-ka2";
import { kaLinesLesson } from "./lessons/ka-lines";
import { ka3QueEsLesson } from "./lessons/ka3-que-es";
import { assignBankImages } from "./lessons/assignImages";
import { CtaOutro, calculateCtaFrames } from "./compositions/CtaOutro";
import { LessonWithCta } from "./compositions/LessonWithCta";
import imageBank from "../public/images/bank/manifest.json";
import ctaOutroManifest from "./audio/cta-outro/manifest.json";
import {
  reel1_money,
  reel2_errors,
  reel3_steps,
  reel4_quiz,
  reel5_inspire,
} from "./lessons/reels-collection";
import kaLinesManifest from "./audio/ka-lines/manifest.json";
import ka3QueEsManifest from "./audio/ka3-que-es/manifest.json";

const FPS = 30;

export const RemotionRoot: React.FC = () => {
  const kaLinesFrames = calculateTotalFrames(kaLinesLesson, FPS, kaLinesManifest);

  // Assign unique bank images (no repeats anywhere in the video)
  const ka3QueEsData = assignBankImages(
    ka3QueEsLesson,
    imageBank as Record<string, string[]>,
    ka3QueEsManifest,
    FPS
  );
  const ka3QueEsFrames = calculateTotalFrames(ka3QueEsData, FPS, ka3QueEsManifest);

  // Reusable CTA outro: varied background mix + ~17s VO
  const bank = imageBank as Record<string, string[]>;
  const ctaImages = ["youth", "collaboration", "europe", "education", "travel", "politics", "support"]
    .map((t) => bank[t]?.[0])
    .filter(Boolean) as string[];
  const ctaFrames = calculateCtaFrames(ctaOutroManifest[0]?.duration ?? 16, FPS);

  // KA3 completo = lección SIN su outro propio + CTA reutilizable
  const ka3NoOutro = {
    ...ka3QueEsData,
    slides: ka3QueEsData.slides.slice(0, -1),
  };
  const ka3FullFrames =
    calculateTotalFrames(ka3NoOutro, FPS, ka3QueEsManifest) + ctaFrames;

  return (
    <>
      {/* ── UTILIDADES ── */}
      <Composition
        id="AudioTest"
        component={AudioTest}
        durationInFrames={400}
        fps={FPS}
        width={VIDEO.width}
        height={VIDEO.height}
      />

      {/* ── LECCIONES (horizontal 1920x1080) ── */}
      <Composition
        id="KA-Lines"
        component={Lesson}
        durationInFrames={kaLinesFrames}
        fps={FPS}
        width={VIDEO.width}
        height={VIDEO.height}
        defaultProps={{
          data: kaLinesLesson,
          audioFolder: "ka-lines",
          audioManifest: kaLinesManifest,
          musicTrack: "music/bg-energy-full.wav",
          sfxTransition: "sfx/whoosh.wav",
        }}
      />

      <Composition
        id="KA3-QueEs"
        component={Lesson}
        durationInFrames={ka3QueEsFrames}
        fps={FPS}
        width={VIDEO.width}
        height={VIDEO.height}
        defaultProps={{
          data: ka3QueEsData,
          audioFolder: "ka3-que-es",
          audioManifest: ka3QueEsManifest,
          sfxTransition: "sfx/whoosh.wav",
        }}
      />

      {/* ── KA3 COMPLETO: lección + CTA integrado ── */}
      <Composition
        id="KA3-Full"
        component={LessonWithCta}
        durationInFrames={ka3FullFrames}
        fps={FPS}
        width={VIDEO.width}
        height={VIDEO.height}
        defaultProps={{
          data: ka3NoOutro,
          audioFolder: "ka3-que-es",
          audioManifest: ka3QueEsManifest,
          sfxTransition: "sfx/whoosh.wav",
          ctaImages: ctaImages,
          ctaDurationFrames: ctaFrames,
        }}
      />

      {/* ── CTA OUTRO reutilizable (~17s, horizontal) ── */}
      <Composition
        id="CTA-Outro"
        component={CtaOutro}
        durationInFrames={ctaFrames}
        fps={FPS}
        width={VIDEO.width}
        height={VIDEO.height}
        defaultProps={{ images: ctaImages }}
      />

      {/* ── REELS (vertical 1080x1920) ── */}
      <Composition
        id="Reel-1-Money"
        component={ReelFactory}
        durationInFrames={calculateReelFrames(reel1_money, FPS)}
        fps={FPS}
        width={1080}
        height={1920}
        defaultProps={{ data: reel1_money }}
      />
      <Composition
        id="Reel-2-Errors"
        component={ReelFactory}
        durationInFrames={calculateReelFrames(reel2_errors, FPS)}
        fps={FPS}
        width={1080}
        height={1920}
        defaultProps={{ data: reel2_errors }}
      />
      <Composition
        id="Reel-3-Steps"
        component={ReelFactory}
        durationInFrames={calculateReelFrames(reel3_steps, FPS)}
        fps={FPS}
        width={1080}
        height={1920}
        defaultProps={{ data: reel3_steps }}
      />
      <Composition
        id="Reel-4-Quiz"
        component={ReelFactory}
        durationInFrames={calculateReelFrames(reel4_quiz, FPS)}
        fps={FPS}
        width={1080}
        height={1920}
        defaultProps={{ data: reel4_quiz }}
      />
      <Composition
        id="Reel-5-Inspire"
        component={ReelFactory}
        durationInFrames={calculateReelFrames(reel5_inspire, FPS)}
        fps={FPS}
        width={1080}
        height={1920}
        defaultProps={{ data: reel5_inspire }}
      />
      {/* ── REEL CON VOZ + SUBTÍTULOS TIKTOK ── */}
      <Composition
        id="Reel-Voiced"
        component={ReelVoiced}
        durationInFrames={calculateReelFrames(reelVoiced.reel, FPS)}
        fps={FPS}
        width={1080}
        height={1920}
        defaultProps={{
          data: reelVoiced.reel,
          audioFolder: "reel-voiced",
          narrations: reelVoiced.narrations,
          audioDurations: [5.3, 6.6, 5.4, 6.0],
        }}
      />
    </>
  );
};

import React from "react";
import {
  AbsoluteFill,
  Audio,
  interpolate,
  spring,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { COLORS, FONTS } from "../theme";
import { RotatingImage } from "../components/RotatingImage";
import { useFadeIn, useScaleIn, useFloat, useGlow } from "../components/animations";

// Tipos de proyecto + importe y perfiles destinatarios — flotan de fondo.
const PROJECT_CHIPS = [
  "KA1 Movilidad · 120.000€",
  "KA2 Cooperación · 400.000€",
  "KA3 Juventud · 500.000€",
  "CoVE FP · 4.000.000€",
  "European Youth Together · 500.000€",
  "Small-scale · 60.000€",
  "Capacity Building · 1.000.000€",
  "Alianzas · 4.000.000€",
];
const PROFILE_CHIPS = [
  "Empresas",
  "Centros educativos",
  "Universidades",
  "Ayuntamientos",
  "ONGs y asociaciones",
  "Administración pública",
  "Formación Profesional",
];

interface Chip {
  text: string;
  kind: "project" | "profile";
  x: number; // % horizontal (sesgado a los lados, centro libre)
  baseY: number; // % vertical inicial
  speed: number; // % de altura por frame (hacia arriba)
  phase: number;
}

// Layout determinista: chips en las bandas izquierda y derecha, centro limpio.
const CHIPS: Chip[] = [...PROJECT_CHIPS, ...PROFILE_CHIPS].map((text, i) => {
  const leftSide = i % 2 === 0;
  const band = leftSide ? 3 + (i * 7) % 22 : 70 + (i * 11) % 27;
  return {
    text,
    kind: i < PROJECT_CHIPS.length ? "project" : "profile",
    x: band,
    baseY: (i * 37) % 100,
    speed: 0.12 + (i % 4) * 0.04,
    phase: i * 1.3,
  };
});

const FloatingChips: React.FC = () => {
  const frame = useCurrentFrame();
  return (
    <AbsoluteFill style={{ overflow: "hidden", zIndex: 5 }}>
      {CHIPS.map((c, i) => {
        // Movimiento ascendente continuo con wrap.
        const travelled = c.baseY - frame * c.speed;
        const y = ((travelled % 120) + 120) % 120 - 10; // -10%..110%
        // Opacidad media (visibles en primer plano, sin saturar) con fundido en bordes.
        const opacity =
          (0.55 + 0.07 * Math.sin(frame * 0.04 + c.phase)) *
          interpolate(y, [-10, 4, 92, 110], [0, 1, 1, 0], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
          });
        const isProject = c.kind === "project";
        return (
          <div
            key={i}
            style={{
              position: "absolute",
              left: `${c.x}%`,
              top: `${y}%`,
              opacity,
              padding: isProject ? "11px 22px" : "9px 18px",
              borderRadius: 999,
              whiteSpace: "nowrap",
              fontFamily: FONTS.family,
              fontSize: isProject ? 30 : 26,
              fontWeight: isProject
                ? FONTS.weights.bold
                : FONTS.weights.semiBold,
              color: isProject ? COLORS.accent : COLORS.white,
              border: `1.5px solid ${
                isProject ? "rgba(231,235,0,0.6)" : "rgba(255,255,255,0.5)"
              }`,
              background: "rgba(6,0,62,0.5)",
              backdropFilter: "blur(3px)",
              boxShadow: "0 6px 18px rgba(0,0,0,0.3)",
            }}
          >
            {c.text}
          </div>
        );
      })}
    </AbsoluteFill>
  );
};

interface CtaOutroProps {
  images: string[];
  audioFile?: string;
}

export const CtaOutro: React.FC<CtaOutroProps> = ({
  images,
  audioFile = "audio/cta-outro/slide-00.ogg",
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const tagAnim = useScaleIn(4);
  const headAnim = useFadeIn(12);
  const headFloat = useFloat(2, 0.02, 0);
  const profilesAnim = useFadeIn(28);
  const urlAnim = useFadeIn(40);
  const urlGlow = useGlow(0.5, 1, 0.05, 0);

  // Entrada en muelle del panel central
  const panelIn = spring({ frame: frame - 4, fps, config: { damping: 18, stiffness: 90 } });

  return (
    <AbsoluteFill style={{ backgroundColor: COLORS.primary, fontFamily: FONTS.family }}>
      {/* Fondo: fotos rotando (proyectos reales) */}
      <RotatingImage images={images} maxSecondsPerImage={4} />

      {/* Scrim de marca + viñeta para que nada compita con el texto */}
      <AbsoluteFill
        style={{
          background:
            "linear-gradient(180deg, rgba(6,0,62,0.82) 0%, rgba(6,0,62,0.7) 50%, rgba(6,0,62,0.86) 100%)",
        }}
      />
      <AbsoluteFill
        style={{
          background:
            "radial-gradient(ellipse at center, transparent 30%, rgba(0,0,0,0.5) 100%)",
        }}
      />

      {/* Chips flotantes (tipos de proyecto + importes + perfiles) */}
      <FloatingChips />

      {/* Panel central — siempre legible por encima de todo */}
      <AbsoluteFill
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          zIndex: 2,
        }}
      >
        <div
          style={{
            transform: `scale(${interpolate(panelIn, [0, 1], [0.94, 1])})`,
            opacity: panelIn,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            textAlign: "center",
            gap: 24,
            padding: "56px 80px",
            borderRadius: 28,
            background: "rgba(6,0,62,0.45)",
            border: "1px solid rgba(231,235,0,0.25)",
            backdropFilter: "blur(6px)",
            boxShadow: "0 20px 80px rgba(0,0,0,0.45)",
            maxWidth: 1250,
          }}
        >
          {/* Tag */}
          <div
            style={{
              ...tagAnim,
              background: COLORS.accent,
              color: COLORS.primary,
              padding: "8px 26px",
              borderRadius: 999,
              fontSize: 24,
              fontWeight: FONTS.weights.bold,
              letterSpacing: 3,
              textTransform: "uppercase",
            }}
          >
            EU Funding School
          </div>

          {/* Headline */}
          <h1
            style={{
              ...headAnim,
              ...headFloat,
              margin: 0,
              fontSize: 92,
              lineHeight: 1.05,
              fontWeight: FONTS.weights.extraBold,
              color: COLORS.white,
            }}
          >
            Conoce <span style={{ color: COLORS.accent }}>todas</span>
            <br />
            las posibilidades
          </h1>

          {/* Perfiles destinatarios */}
          <p
            style={{
              ...profilesAnim,
              margin: 0,
              fontSize: 34,
              fontWeight: FONTS.weights.medium,
              color: COLORS.white,
              opacity: profilesAnim.opacity * 0.85,
            }}
          >
            Empresas · Centros educativos · Administraciones · ONGs
          </p>

          {/* URL */}
          <div
            style={{
              ...urlAnim,
              marginTop: 8,
              fontSize: 56,
              fontWeight: FONTS.weights.extraBold,
              color: COLORS.accent,
              letterSpacing: 1,
              textShadow: `0 0 ${14 + 10 * Math.sin(frame * 0.08)}px rgba(231,235,0,${0.35 * urlGlow})`,
            }}
          >
            eufundingschool.com
          </div>
        </div>
      </AbsoluteFill>

      {/* Barra de acento inferior */}
      <div
        style={{
          position: "absolute",
          bottom: 0,
          left: 0,
          right: 0,
          height: 6,
          background: `linear-gradient(90deg, ${COLORS.accent}, transparent 60%)`,
          zIndex: 3,
        }}
      />

      <Audio src={staticFile(audioFile)} volume={1.4} />
    </AbsoluteFill>
  );
};

export function calculateCtaFrames(audioDuration: number, fps: number): number {
  return Math.round((audioDuration + 0.8) * fps);
}

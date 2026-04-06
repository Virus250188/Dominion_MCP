// ─── Widget Shared Components Module ───────────────────────────────────────
// Source code of the Dashboard's shared widget components.
// Agents can reference these to understand props and rendering behavior.
// Imports like @/components/widgets/shared/... resolve in the Dashboard.
//
// LAST_SYNCED: 2026-04-06
// DASHBOARD_VERSION: 1.0.6-alpha
// SOURCE: Dashboard/src/components/widgets/shared/*.tsx, registry.ts
// ────────────────────────────────────────────────────────────────────────────

export const COMPONENTS = {
  overview: `
# Widget Shared Components

Das Dashboard stellt wiederverwendbare Komponenten fuer Widgets bereit.
Diese liegen unter \`src/components/widgets/shared/\` und koennen in jedem
Widget importiert werden:

\`\`\`typescript
import { WidgetHeader } from "@/components/widgets/shared/WidgetHeader";
import { CircularProgress } from "@/components/widgets/shared/CircularProgress";
import { SparklineChart } from "@/components/widgets/shared/SparklineChart";
import { HorizontalProgressBar } from "@/components/widgets/shared/HorizontalProgressBar";
import { ControlButton } from "@/components/widgets/shared/ControlButton";
\`\`\`

**Diese Imports funktionieren nach dem Deployment im Dashboard.**
Agents brauchen die Dateien NICHT in die ZIP aufzunehmen —
sie sind Teil des Dashboard-Systems.

## WidgetProps Interface

Jede Widget-Komponente erhaelt diese Props:

\`\`\`typescript
import type { EnhancedStats } from "@/types/tile";

interface WidgetProps {
  stats: EnhancedStats;              // { items: StatItem[], status, widgetData }
  config: Record<string, unknown>;   // User-Konfiguration (Tile-spezifisch)
  tileId: number;                    // Tile-ID in der Datenbank
  size: "2x1" | "2x2";              // Aktuelle Tile-Groesse
  onAction?: (action: string, payload?: unknown) => void;  // Widget->Dashboard Signal
}
\`\`\`

\`stats.widgetData\` enthaelt die reichhaltigen Daten aus \`fetchStats\` —
z.B. Cover-Bilder, Listen, Medien-Metadaten.
`,

  widgetHeader: `
# WidgetHeader

Standard-Kopfzeile fuer Widgets mit Icon, Titel, Status-Punkt und optionalen Actions.

## Props

| Prop | Typ | Pflicht | Beschreibung |
|------|-----|---------|-------------|
| title | string | Ja | Widget-Titel |
| icon | string | Nein | Lucide-Icon Name (z.B. "Activity", "Play") |
| iconColor | string | Nein | Farbe des Icons (CSS color) |
| subtitle | string | Nein | Untertitel (rechts vom Titel, klein) |
| status | "online" \\| "offline" \\| "unknown" | Nein | Status-Punkt (gruen/rot/grau) |
| children | ReactNode | Nein | Rechts-ausgerichtete Actions (Buttons etc.) |

## Quellcode

\`\`\`tsx
"use client";

import { cn } from "@/lib/utils";
import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import * as LucideIcons from "lucide-react";

interface WidgetHeaderProps {
  icon?: string;
  iconColor?: string;
  title: string;
  subtitle?: string;
  status?: "online" | "offline" | "unknown";
  children?: ReactNode;
}

const statusColors = {
  online: "bg-emerald-500",
  offline: "bg-red-500",
  unknown: "bg-muted-foreground/40",
};

export function WidgetHeader({
  icon, iconColor, title, subtitle, status, children,
}: WidgetHeaderProps) {
  const IconComponent = icon
    ? ((LucideIcons as unknown as Record<string, LucideIcon>)[icon] ?? null) as LucideIcon | null
    : null;

  return (
    <div className="flex items-center gap-2 h-10 px-3 border-b border-border/30 flex-shrink-0">
      {status && (
        <span className={cn("h-2 w-2 rounded-full flex-shrink-0", statusColors[status])} />
      )}
      {IconComponent && (
        <IconComponent
          className="h-5 w-5 flex-shrink-0"
          style={iconColor ? { color: iconColor } : undefined}
        />
      )}
      <div className="flex items-baseline gap-2 min-w-0 flex-1">
        <span className="text-sm font-semibold text-foreground truncate">{title}</span>
        {subtitle && (
          <span className="text-[10px] text-muted-foreground truncate">{subtitle}</span>
        )}
      </div>
      {children}
    </div>
  );
}
\`\`\`

## Verwendung

\`\`\`tsx
<WidgetHeader
  icon="Activity"
  title="Mein Service"
  subtitle="v2.1.0"
  status={isOnline ? "online" : "offline"}
>
  <ControlButton icon="RefreshCw" onClick={handleRefresh} label="Aktualisieren" />
</WidgetHeader>
\`\`\`
`,

  circularProgress: `
# CircularProgress

SVG-basierter kreisfoermiger Fortschrittsbalken mit automatischer Farbwahl.

## Props

| Prop | Typ | Default | Beschreibung |
|------|-----|---------|-------------|
| value | number | — | Prozent (0-100, wird geclampt) |
| size | number | 64 | Durchmesser in Pixeln |
| strokeWidth | number | 6 | Linienbreite |
| color | string | auto | Farbe (auto: gruen<70, gelb<85, rot>=85) |
| label | string | — | Text unter dem Kreis |
| className | string | — | Zusaetzliche CSS-Klassen |

## Quellcode

\`\`\`tsx
"use client";

import { cn } from "@/lib/utils";

interface CircularProgressProps {
  value: number;
  size?: number;
  strokeWidth?: number;
  color?: string;
  label?: string;
  className?: string;
}

function getAutoColor(value: number): string {
  if (value >= 85) return "#ef4444";
  if (value >= 70) return "#eab308";
  return "#10b981";
}

export function CircularProgress({
  value, size = 64, strokeWidth = 6, color, label, className,
}: CircularProgressProps) {
  const clampedValue = Math.max(0, Math.min(100, value));
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (clampedValue / 100) * circumference;
  const resolvedColor = color ?? getAutoColor(clampedValue);

  return (
    <div className={cn("flex flex-col items-center gap-1", className)}>
      <div className="relative" style={{ width: size, height: size }}>
        <svg width={size} height={size} viewBox={\\\`0 0 \\\${size} \\\${size}\\\`} className="transform -rotate-90">
          <circle cx={size/2} cy={size/2} r={radius} fill="none" stroke="currentColor"
            strokeWidth={strokeWidth} className="text-muted/30" />
          <circle cx={size/2} cy={size/2} r={radius} fill="none" stroke={resolvedColor}
            strokeWidth={strokeWidth} strokeLinecap="round"
            strokeDasharray={circumference} strokeDashoffset={offset}
            className="transition-all duration-500 ease-out" />
        </svg>
        <span className="absolute inset-0 flex items-center justify-center text-xs font-bold tabular-nums text-foreground">
          {Math.round(clampedValue)}%
        </span>
      </div>
      {label && <span className="text-[10px] text-muted-foreground leading-tight text-center">{label}</span>}
    </div>
  );
}
\`\`\`
`,

  sparklineChart: `
# SparklineChart

Mini-Liniendiagramm (SVG) fuer Trend-Daten. Optional mit Farbverlauf-Fuellung.

## Props

| Prop | Typ | Default | Beschreibung |
|------|-----|---------|-------------|
| data | number[] | — | Datenpunkte (min. 2 fuer Linie) |
| width | number | 120 | Breite in Pixeln |
| height | number | 40 | Hoehe in Pixeln |
| color | string | "currentColor" | Linienfarbe |
| fill | boolean | false | Farbverlauf-Fuellung unter der Linie |
| className | string | — | Zusaetzliche CSS-Klassen |

## Verwendung

\`\`\`tsx
<SparklineChart
  data={[10, 25, 18, 30, 22, 35, 28]}
  width={100}
  height={30}
  color="#10b981"
  fill
/>
\`\`\`
`,

  horizontalProgressBar: `
# HorizontalProgressBar

Horizontaler Fortschrittsbalken mit Label und optionalem Wert-Display.
Automatische Farbwahl basierend auf dem Wert (gruen<70, gelb<85, rot>=85).

## Props

| Prop | Typ | Default | Beschreibung |
|------|-----|---------|-------------|
| label | string | — | Label-Text (links oben) |
| value | number | — | Prozent (0-100, wird geclampt) |
| displayValue | string | — | Anzeige-Wert (rechts oben, z.B. "85 GB / 100 GB") |
| color | string | auto | Balkenfarbe (Tailwind-Klasse oder CSS color) |
| height | number | 8 | Balkenhoehe in Pixeln |
| className | string | — | Zusaetzliche CSS-Klassen |

## Verwendung

\`\`\`tsx
<HorizontalProgressBar
  label="Speicher"
  value={85}
  displayValue="85 GB / 100 GB"
/>
\`\`\`
`,

  controlButton: `
# ControlButton

Button fuer interaktive Widget-Controls (Play/Pause, Like, Refresh etc.).
Unterstuetzt Varianten, Loading-State und verschiedene Groessen.

## Props

| Prop | Typ | Default | Beschreibung |
|------|-----|---------|-------------|
| icon | string | — | Lucide-Icon Name (z.B. "Play", "Pause", "Heart") |
| label | string | — | Tooltip-Text |
| onClick | () => void | — | Click-Handler |
| variant | "default" \\| "success" \\| "danger" \\| "warning" | "default" | Farbvariante |
| disabled | boolean | false | Deaktiviert |
| loading | boolean | false | Zeigt Spinner statt Icon |
| size | "sm" \\| "md" | "sm" | Button-Groesse (sm=28px, md=36px) |

## Varianten-Farben

| Variante | Hintergrund | Text |
|----------|-------------|------|
| default | muted/40 → muted/60 | muted-foreground → foreground |
| success | emerald-500/15 → /25 | emerald-400 → emerald-300 |
| danger | red-500/15 → /25 | red-400 → red-300 |
| warning | yellow-500/15 → /25 | yellow-400 → yellow-300 |

## Verwendung

\`\`\`tsx
// Im WidgetHeader als Action
<WidgetHeader title="Player" icon="Music" status="online">
  <ControlButton icon="SkipBack" onClick={handlePrev} label="Zurueck" />
  <ControlButton
    icon={isPlaying ? "Pause" : "Play"}
    onClick={handleToggle}
    variant="success"
    label={isPlaying ? "Pause" : "Abspielen"}
  />
  <ControlButton icon="SkipForward" onClick={handleNext} label="Weiter" />
</WidgetHeader>
\`\`\`
`,
} as const;

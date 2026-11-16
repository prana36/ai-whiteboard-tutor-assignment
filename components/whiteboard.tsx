"use client";

import { useEffect, useRef, useState } from "react";
import {
  Download,
  MousePointer2,
  PenLine,
  RotateCcw,
  Highlighter,
  ZoomIn,
  ZoomOut,
} from "lucide-react";
import type { BoardElement, Scene } from "@/lib/lesson";
import { visibleElements } from "@/lib/lesson";
import { downloadFile } from "@/lib/client";

const colors = {
  ink: "#454354",
  purple: "#7956d8",
  green: "#388a72",
  orange: "#df9851",
  blue: "#5187b8",
};
const fills = {
  ink: "#f3f1f7",
  purple: "#f0eafa",
  green: "#e8f4ee",
  orange: "#fcf0e1",
  blue: "#eaf2fa",
};

function wrap(text: string, max: number) {
  const lines: string[] = [];
  for (const word of text.split(/\s+/)) {
    if (!lines.length || `${lines[lines.length - 1]} ${word}`.length > max) lines.push(word);
    else lines[lines.length - 1] += ` ${word}`;
  }
  return lines.slice(0, 4);
}

function Label({
  text,
  x,
  y,
  width = 600,
  color,
  small = false,
}: {
  text: string;
  x: number;
  y: number;
  width?: number;
  color: string;
  small?: boolean;
}) {
  const size = small ? 17 : 22;
  const lines = wrap(text, Math.max(7, Math.floor(width / (size * 0.53))));
  return (
    <text
      x={x}
      y={y - ((lines.length - 1) * (size + 5)) / 2}
      textAnchor="middle"
      dominantBaseline="middle"
      fill={color}
      fontSize={size}
      fontWeight="550"
      fontFamily="'Segoe UI', sans-serif"
    >
      {lines.map((line, i) => (
        <tspan key={i} x={x} dy={i === 0 ? 0 : size + 5}>
          {line}
        </tspan>
      ))}
    </text>
  );
}

function Element({ element }: { element: BoardElement }) {
  const { kind, x, y, width, height, text, color } = element;
  const stroke = colors[color];
  if (kind === "text") return <Label text={text} x={x} y={y} color={stroke} />;
  if (kind === "line" || kind === "arrow")
    return (
      <>
        <line
          x1={x}
          y1={y}
          x2={x + width}
          y2={y + height}
          stroke={stroke}
          strokeWidth="2.5"
          strokeLinecap="round"
          markerEnd={kind === "arrow" ? `url(#arrow-${color})` : undefined}
        />
        {text && (
          <>
            <rect
              x={x + width / 2 - Math.min(text.length * 5.2, 140)}
              y={y + height / 2 - 25}
              width={Math.min(text.length * 10.4, 280)}
              height="23"
              rx="5"
              fill="#fffefa"
            />
            <Label text={text} x={x + width / 2} y={y + height / 2 - 13} color={stroke} small />
          </>
        )}
      </>
    );
  return (
    <>
      {kind === "rect" ? (
        <rect
          x={x}
          y={y}
          width={width}
          height={height}
          rx="16"
          fill={fills[color]}
          stroke={stroke}
          strokeWidth="2"
        />
      ) : (
        <ellipse
          cx={x + width / 2}
          cy={y + height / 2}
          rx={width / 2}
          ry={height / 2}
          fill={fills[color]}
          stroke={stroke}
          strokeWidth="2"
        />
      )}
      {text && (
        <Label text={text} x={x + width / 2} y={y + height / 2} width={width - 24} color={stroke} />
      )}
    </>
  );
}

type Stroke = { points: { x: number; y: number }[]; highlight: boolean };

export function Whiteboard({
  scene,
  progress,
  sceneKey,
  onAsk,
  preview = false,
}: {
  scene: Scene;
  progress: number;
  sceneKey: string;
  onAsk: (text: string) => void;
  preview?: boolean;
}) {
  const [tool, setTool] = useState<"select" | "pen" | "highlight">("select");
  const [strokes, setStrokes] = useState<Record<string, Stroke[]>>({});
  const [drawing, setDrawing] = useState<Stroke | null>(null);
  const [zoom, setZoom] = useState(1);
  const svgRef = useRef<SVGSVGElement>(null);
  const currentStrokes = strokes[sceneKey] || [];
  useEffect(() => {
    setDrawing(null);
  }, [sceneKey]);

  function point(event: React.PointerEvent<SVGSVGElement>) {
    const svg = svgRef.current!;
    const p = new DOMPoint(event.clientX, event.clientY).matrixTransform(
      svg.getScreenCTM()!.inverse(),
    );
    return { x: Math.max(0, Math.min(1000, p.x)), y: Math.max(0, Math.min(560, p.y)) };
  }

  function finish() {
    if (drawing) setStrokes((all) => ({ ...all, [sceneKey]: [...(all[sceneKey] || []), drawing] }));
    setDrawing(null);
  }

  function save() {
    if (!svgRef.current) return;
    const copy = svgRef.current.cloneNode(true) as SVGSVGElement;
    copy.setAttribute("xmlns", "http://www.w3.org/2000/svg");
    copy.setAttribute("width", "1000");
    copy.setAttribute("height", "560");
    copy.removeAttribute("style");
    downloadFile(
      "lumio-whiteboard.svg",
      new XMLSerializer().serializeToString(copy),
      "image/svg+xml",
    );
  }

  return (
    <div className="whiteboard-inner">
      <div className="canvas-topline">
        <span className="canvas-topic">{preview ? "A peek at what's possible" : scene.title}</span>
        <span className="canvas-label">
          <i />
          {preview ? "SAMPLE DIAGRAM" : "LIVE WHITEBOARD"}
        </span>
      </div>
      <div className="canvas-viewport" tabIndex={0} aria-label="Scrollable whiteboard">
        <svg
          ref={svgRef}
          viewBox="0 0 1000 560"
          style={{ width: `${zoom * 100}%` }}
          className={`board-svg tool-${tool}`}
          aria-label={`Whiteboard: ${scene.title}`}
          role="img"
          onPointerDown={(event) => {
            if (tool === "select") return;
            event.currentTarget.setPointerCapture(event.pointerId);
            setDrawing({ points: [point(event)], highlight: tool === "highlight" });
          }}
          onPointerMove={(event) => {
            if (drawing)
              setDrawing((stroke) =>
                stroke ? { ...stroke, points: [...stroke.points, point(event)] } : null,
              );
          }}
          onPointerUp={finish}
          onPointerCancel={() => setDrawing(null)}
        >
          <title>{scene.title}</title>
          <defs>
            <pattern id="dots" width="24" height="24" patternUnits="userSpaceOnUse">
              <circle cx="2" cy="2" r="1" fill="#e8e4ed" />
            </pattern>
            {Object.entries(colors).map(([name, color]) => (
              <marker
                key={name}
                id={`arrow-${name}`}
                viewBox="0 0 10 10"
                refX="8"
                refY="5"
                markerWidth="6"
                markerHeight="6"
                orient="auto-start-reverse"
              >
                <path
                  d="M 1 1 L 9 5 L 1 9"
                  fill="none"
                  stroke={color}
                  strokeWidth="1.7"
                  strokeLinejoin="round"
                />
              </marker>
            ))}
          </defs>
          <rect width="1000" height="560" fill="#fffefa" />
          <rect width="1000" height="560" fill="url(#dots)" />
          {visibleElements(scene, progress).map((element) => (
            <g
              key={`${sceneKey}-${element.id}`}
              className="board-element"
              style={{
                cursor: tool === "select" && element.text && !preview ? "pointer" : undefined,
              }}
              onClick={() => {
                if (tool === "select" && element.text && !preview)
                  onAsk(`Can you explain “${element.text}” from this diagram?`);
              }}
            >
              <title>
                {element.text
                  ? `${element.text}${preview ? "" : " — click to ask about this"}`
                  : element.kind}
              </title>
              <Element element={element} />
            </g>
          ))}
          {[...currentStrokes, ...(drawing ? [drawing] : [])].map((stroke, i) => (
            <polyline
              key={i}
              points={stroke.points.map((p) => `${p.x},${p.y}`).join(" ")}
              fill="none"
              stroke={stroke.highlight ? "#f3c646" : "#7956d8"}
              strokeWidth={stroke.highlight ? 20 : 3}
              opacity={stroke.highlight ? 0.4 : 1}
              strokeLinecap="round"
              strokeLinejoin="round"
              pointerEvents="none"
            />
          ))}
        </svg>
      </div>
      <div className="canvas-bottomline">
        <div className="board-tools" aria-label="Whiteboard tools">
          <button
            title="Select · click a diagram label to ask about it"
            aria-label="Select tool"
            aria-pressed={tool === "select"}
            className={tool === "select" ? "selected" : ""}
            onClick={() => setTool("select")}
          >
            <MousePointer2 size={17} />
          </button>
          <button
            title="Draw on the whiteboard"
            aria-label="Pen tool"
            aria-pressed={tool === "pen"}
            className={tool === "pen" ? "selected" : ""}
            onClick={() => setTool("pen")}
          >
            <PenLine size={17} />
          </button>
          <button
            title="Highlight"
            aria-label="Highlighter tool"
            aria-pressed={tool === "highlight"}
            className={tool === "highlight" ? "selected" : ""}
            onClick={() => setTool("highlight")}
          >
            <Highlighter size={17} />
          </button>
          <span className="tool-divider" />
          <button
            title="Undo last drawing"
            aria-label="Undo last drawing"
            disabled={!currentStrokes.length}
            onClick={() =>
              setStrokes((all) => ({ ...all, [sceneKey]: currentStrokes.slice(0, -1) }))
            }
          >
            <RotateCcw size={16} />
          </button>
        </div>
        <div className="canvas-actions">
          <div className="canvas-zoom" aria-label="Whiteboard zoom">
            <button
              className="icon-button"
              aria-label="Zoom out whiteboard"
              title="Zoom out"
              disabled={zoom <= 1}
              onClick={() => setZoom((value) => Math.max(1, value - 0.5))}
            >
              <ZoomOut size={17} />
            </button>
            <button
              className="zoom-reset"
              aria-label="Reset whiteboard zoom"
              title="Reset to fit"
              onClick={() => setZoom(1)}
            >
              {Math.round(zoom * 100)}%
            </button>
            <button
              className="icon-button"
              aria-label="Zoom in whiteboard"
              title="Zoom in"
              disabled={zoom >= 3}
              onClick={() => setZoom((value) => Math.min(3, value + 0.5))}
            >
              <ZoomIn size={17} />
            </button>
          </div>
          <button
            className="icon-button export-board"
            onClick={save}
            title="Download this whiteboard as SVG"
            aria-label="Download whiteboard"
          >
            <Download size={17} />
          </button>
        </div>
      </div>
    </div>
  );
}

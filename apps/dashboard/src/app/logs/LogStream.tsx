"use client";
import { useEffect, useRef, useState } from "react";

type LogLine = {
  at?: string;
  siteId?: string;
  eventType?: string;
  detail?: Record<string, unknown>;
  hello?: string;
  error?: string;
};

export default function LogStream() {
  const [lines, setLines] = useState<LogLine[]>([]);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const source = new EventSource("/api/logs");
    source.onmessage = (evt) => {
      try {
        const parsed = JSON.parse(evt.data) as LogLine;
        setLines((prev) => [parsed, ...prev].slice(0, 200));
      } catch {
        // Ignore malformed frames — the server sometimes sends comments
      }
    };
    source.onerror = () => {
      setLines((prev) => [
        { error: "connection lost — retrying", at: new Date().toISOString() },
        ...prev,
      ]);
    };
    return () => source.close();
  }, []);

  return (
    <div
      ref={scrollRef}
      className="max-h-[70vh] overflow-y-auto text-xs font-mono rounded border border-[--color-panel-border] bg-[--color-panel] p-3 space-y-1"
    >
      {lines.length === 0 ? (
        <p className="text-[--color-muted]">Waiting for events…</p>
      ) : null}
      {lines.map((line, idx) => (
        <div key={idx} className="whitespace-pre-wrap">
          {line.hello ? (
            <span className="text-[--color-accent]">{line.hello}</span>
          ) : line.error ? (
            <span className="text-[--color-danger]">{line.error}</span>
          ) : (
            <>
              <span className="text-[--color-muted]">{line.at}</span>{" "}
              <span className="text-[--color-accent]">{line.siteId}</span>{" "}
              <span className="text-[--color-success]">{line.eventType}</span>{" "}
              {line.detail
                ? JSON.stringify(line.detail).slice(0, 160)
                : ""}
            </>
          )}
        </div>
      ))}
    </div>
  );
}

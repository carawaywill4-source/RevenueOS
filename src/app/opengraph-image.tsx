import { ImageResponse } from "next/og";

export const alt =
  "TributeReady — thoughtful memorial writing and print-ready keepsakes";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpenGraphImage() {
  return new ImageResponse(
    <div
      style={{
        alignItems: "center",
        background: "#f8f6f1",
        color: "#173e35",
        display: "flex",
        height: "100%",
        justifyContent: "center",
        overflow: "hidden",
        padding: "64px",
        position: "relative",
        width: "100%",
      }}
    >
      <div
        style={{
          border: "1px solid rgba(23, 62, 53, 0.14)",
          borderRadius: "999px",
          display: "flex",
          height: "520px",
          position: "absolute",
          right: "-180px",
          top: "-220px",
          width: "520px",
        }}
      />
      <div
        style={{
          background: "#e7ece8",
          borderRadius: "999px",
          bottom: "-240px",
          display: "flex",
          height: "480px",
          left: "-120px",
          position: "absolute",
          width: "480px",
        }}
      />
      <div
        style={{
          alignItems: "flex-start",
          background: "#fffdf8",
          border: "1px solid rgba(23, 62, 53, 0.12)",
          borderRadius: "36px",
          boxShadow: "0 30px 80px rgba(23, 62, 53, 0.10)",
          display: "flex",
          flexDirection: "column",
          height: "100%",
          justifyContent: "space-between",
          padding: "58px 64px",
          position: "relative",
          width: "100%",
        }}
      >
        <div
          style={{
            alignItems: "center",
            display: "flex",
            fontSize: 28,
            fontWeight: 700,
            gap: 14,
          }}
        >
          <div
            style={{
              alignItems: "center",
              background: "#173e35",
              borderRadius: "999px",
              color: "white",
              display: "flex",
              fontSize: 22,
              height: 48,
              justifyContent: "center",
              width: 48,
            }}
          >
            <div
              style={{
                background: "#d8c08e",
                borderRadius: "100% 0 100% 0",
                display: "flex",
                height: 22,
                transform: "rotate(-35deg)",
                width: 14,
              }}
            />
          </div>
          TributeReady
        </div>
        <div style={{ display: "flex", flexDirection: "column" }}>
          <div
            style={{
              color: "#b9985f",
              display: "flex",
              fontSize: 18,
              fontWeight: 700,
              letterSpacing: "0.18em",
              textTransform: "uppercase",
            }}
          >
            Memorial guidance & keepsakes
          </div>
          <div
            style={{
              display: "flex",
              fontFamily: "Georgia, serif",
              fontSize: 76,
              letterSpacing: "-0.04em",
              lineHeight: 0.98,
              marginTop: 18,
              maxWidth: 860,
            }}
          >
            A life, beautifully remembered.
          </div>
        </div>
        <div
          style={{
            color: "rgba(23, 62, 53, 0.62)",
            display: "flex",
            fontSize: 22,
          }}
        >
          Thoughtful writing · Print-ready programs · Private memorials
        </div>
      </div>
    </div>,
    size,
  );
}

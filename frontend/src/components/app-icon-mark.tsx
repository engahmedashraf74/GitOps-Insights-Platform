export function AppIconMark({ size }: { size: number }) {
  const node = Math.round(size * 0.22);
  const bar = Math.max(4, Math.round(size * 0.055));
  const gap = Math.round(size * 0.045);
  const link = Math.round(size * 0.16);

  return (
    <div
      style={{
        width: size,
        height: size,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "#0f766e",
      }}
    >
      <div style={{ display: "flex", alignItems: "center" }}>
        <div
          style={{
            width: node,
            height: node,
            borderRadius: node,
            background: "#f8fafc",
          }}
        />
        <div
          style={{
            width: link,
            height: bar,
            marginLeft: gap,
            marginRight: gap,
            borderRadius: bar,
            background: "#ccfbf1",
          }}
        />
        <div
          style={{
            width: node,
            height: node,
            borderRadius: node,
            background: "#f8fafc",
          }}
        />
      </div>
    </div>
  );
}

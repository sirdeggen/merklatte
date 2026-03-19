function formatBytes(bytes: number): { value: string; unit: string } {
  if (bytes < 1024) return { value: bytes.toString(), unit: "B" };
  if (bytes < 1024 * 1024) return { value: (bytes / 1024).toFixed(1), unit: "KB" };
  if (bytes < 1024 * 1024 * 1024) return { value: (bytes / (1024 * 1024)).toFixed(2), unit: "MB" };
  return { value: (bytes / (1024 * 1024 * 1024)).toFixed(2), unit: "GB" };
}

interface ByteSizeProps {
  bytes: number;
  className?: string;
}

export const ByteSize = ({ bytes, className }: ByteSizeProps) => {
  const { value, unit } = formatBytes(bytes);
  return (
    <span className={className}>
      {value} <span style={{ fontSize: "0.7em", opacity: 0.75 }}>{unit}</span>
    </span>
  );
};

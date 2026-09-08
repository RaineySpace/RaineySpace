interface PostCoverProps {
  src: string;
  priority?: boolean;
  className?: string;
}

export default function PostCover({ src, priority = false, className = "" }: PostCoverProps) {
  return (
    <div
      className={`overflow-hidden rounded-xl bg-[--surface-muted] ring-1 ring-[--border] ${className}`.trim()}
    >
      {/* Covers may be local files or remote URLs, so they cannot use a fixed Next Image allowlist. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src}
        alt=""
        {...(priority ? { fetchPriority: "high" as const } : { loading: "lazy" as const })}
        className="aspect-[16/9] h-auto w-full object-cover"
      />
    </div>
  );
}

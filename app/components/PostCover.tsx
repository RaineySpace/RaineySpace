interface PostCoverProps {
  src: string;
  priority?: boolean;
  className?: string;
}

export default function PostCover({ src, priority = false, className = "" }: PostCoverProps) {
  return (
    <div
      className={`overflow-hidden rounded-xl bg-gray-100 ring-1 ring-black/[0.04] dark:bg-gray-800 dark:ring-white/10 ${className}`.trim()}
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

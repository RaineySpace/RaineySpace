import type { Project } from "@/lib/projects";

interface ProjectCardProps {
  project: Project;
  headingLevel?: "h2" | "h3";
}

function getProjectInitial(name: string): string {
  return Array.from(name.trim())[0] || "·";
}

export default function ProjectCard({
  project,
  headingLevel = "h3",
}: ProjectCardProps) {
  const Heading = headingLevel;
  return (
    <article className="group relative cursor-pointer rounded-lg border border-gray-200 px-3 py-3 transition-colors hover:bg-gray-50 dark:border-gray-800 dark:hover:bg-white/[0.04]">
      <a
        href={project.url}
        target="_blank"
        rel="noreferrer"
        aria-label={`访问项目：${project.name}`}
        className="absolute inset-0 z-0 cursor-pointer rounded-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[--lightLink] dark:focus-visible:ring-[--darkLink]"
      />

      <div className="pointer-events-none relative z-10 flex items-start gap-3">
        {project.cover ? (
          // Project covers may use any validated HTTPS host, so they cannot use a fixed Next Image allowlist.
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={project.cover}
            alt=""
            loading="lazy"
            className="h-16 w-16 shrink-0 rounded-xl bg-gray-100 object-cover dark:bg-gray-800"
          />
        ) : (
          <span
            aria-hidden="true"
            className="flex h-16 w-16 shrink-0 items-center justify-center rounded-xl bg-gray-100 text-xl font-semibold text-pink-500/80 dark:bg-gray-800 dark:text-pink-300/80"
          >
            {getProjectInitial(project.name)}
          </span>
        )}

        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-3">
            <Heading className="min-w-0 truncate text-[15px] font-semibold leading-snug text-[--title]">
              {project.name}
            </Heading>

            {project.dateText && (
              <time
                dateTime={project.date?.toISOString()}
                className="shrink-0 text-[12px] leading-5 tabular-nums text-gray-400 dark:text-gray-500"
              >
                {project.dateText}
              </time>
            )}
          </div>

          {project.description && (
            <p className="line-clamp-2 mt-1 text-xs leading-relaxed text-gray-500 dark:text-gray-400 group-hover:text-gray-600 dark:group-hover:text-gray-300">
              {project.description}
            </p>
          )}
        </div>
      </div>
    </article>
  );
}

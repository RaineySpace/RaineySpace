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
    <article className="group relative">
      <a
        href={project.url}
        target="_blank"
        rel="noreferrer"
        aria-label={`访问项目：${project.name}`}
        className="absolute inset-0 z-0 focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[--lightLink] dark:focus-visible:ring-[--darkLink]"
      />

      <div className="relative z-10 py-2">
        <div className="flex items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-2">
            {project.cover ? (
              // Project covers may use any validated HTTPS host, so they cannot use a fixed Next Image allowlist.
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={project.cover}
                alt=""
                loading="lazy"
                className="h-5 w-5 shrink-0 object-contain"
              />
            ) : (
              <span
                aria-hidden="true"
                className="flex h-5 w-5 shrink-0 items-center justify-center text-[13px] font-semibold leading-5 text-pink-500/80 dark:text-pink-300/80"
              >
                {getProjectInitial(project.name)}
              </span>
            )}
            <Heading className="truncate text-[15px] font-semibold leading-5 text-[--title]">
              {project.name}
            </Heading>
          </div>

          {project.dateText && (
            <time
              dateTime={project.date?.toISOString()}
              className="shrink-0 text-[13px] leading-5 text-gray-500 dark:text-gray-400"
            >
              {project.dateText}
            </time>
          )}
        </div>

        {project.description && (
          <p className="project-card-description mt-0.5 text-[13px] leading-5 text-gray-400 dark:text-gray-500">
            {project.description}
          </p>
        )}

        {project.sourceUrl && (
          <a
            href={project.sourceUrl}
            target="_blank"
            rel="noreferrer"
            className="pointer-events-auto relative z-20 mt-0.5 inline-block text-[12px] leading-5 text-gray-400 hover:text-gray-700 focus:outline-none focus-visible:rounded focus-visible:ring-2 focus-visible:ring-[--lightLink] dark:text-gray-500 dark:hover:text-gray-200 dark:focus-visible:ring-[--darkLink]"
          >
            源码 ↗
          </a>
        )}
      </div>
    </article>
  );
}

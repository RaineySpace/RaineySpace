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
    <article className="project-card group relative -mx-3 cursor-pointer rounded-xl p-3">
      <a
        href={project.url}
        target="_blank"
        rel="noreferrer"
        aria-label={`访问项目：${project.name}`}
        className="absolute inset-0 z-0 cursor-pointer rounded-xl focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[--lightLink] dark:focus-visible:ring-[--darkLink]"
      />

      <div className="pointer-events-none relative z-10 flex items-center gap-3 sm:gap-5">
        {project.cover ? (
          // Project covers may use any validated HTTPS host, so they cannot use a fixed Next Image allowlist.
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={project.cover}
            alt=""
            loading="lazy"
            className="h-12 w-12 shrink-0 rounded-xl bg-[--surface-muted] object-contain"
          />
        ) : (
          <span
            aria-hidden="true"
            className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-[--surface-muted] text-base font-semibold text-[--title]"
          >
            {getProjectInitial(project.name)}
          </span>
        )}

        <div className="min-w-0 flex-1">
          <Heading className="min-w-0 truncate text-sm font-normal leading-[1.6] text-[--title]">
            {project.name}
          </Heading>

          {project.description && (
            <p className="truncate mt-1 text-xs leading-[1.65] text-[--secondary]">
              {project.description}
            </p>
          )}
        </div>
      </div>
    </article>
  );
}

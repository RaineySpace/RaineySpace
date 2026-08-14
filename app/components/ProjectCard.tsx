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
    <article className="group relative overflow-hidden rounded-2xl border border-gray-200/90 bg-white/70 shadow-[0_1px_2px_rgb(0_0_0/0.03)] transition duration-200 hover:-translate-y-0.5 hover:border-gray-300 hover:shadow-[0_10px_28px_rgb(0_0_0/0.08)] dark:border-gray-800 dark:bg-gray-900/40 dark:hover:border-gray-700 dark:hover:shadow-[0_12px_30px_rgb(0_0_0/0.28)]">
      <a
        href={project.url}
        target="_blank"
        rel="noreferrer"
        aria-label={`访问项目：${project.name}`}
        className="absolute inset-0 z-0 rounded-2xl focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[--lightLink] dark:focus-visible:ring-[--darkLink]"
      />

      <div className="pointer-events-none relative z-10 grid min-h-32 grid-cols-[minmax(0,1fr)_7rem] sm:grid-cols-[minmax(0,1fr)_10rem]">
        <div className="flex min-w-0 flex-col justify-center px-4 py-5 sm:px-6 sm:py-6">
          <Heading className="text-lg font-bold tracking-tight text-[--title]">
            {project.name}
          </Heading>
          {project.description && (
            <p className="project-card-description mt-1 text-[13px] leading-5 text-gray-600 dark:text-gray-300">
              {project.description}
            </p>
          )}

          {project.sourceUrl && (
            <div className="mt-3 flex justify-end">
              <a
                href={project.sourceUrl}
                target="_blank"
                rel="noreferrer"
                className="pointer-events-auto relative z-20 text-[11px] leading-5 text-gray-500 hover:text-gray-900 focus:outline-none focus-visible:rounded focus-visible:ring-2 focus-visible:ring-[--lightLink] dark:text-gray-400 dark:hover:text-white dark:focus-visible:ring-[--darkLink]"
              >
                源码 ↗
              </a>
            </div>
          )}
        </div>

        <div className="flex items-center justify-center p-3 sm:p-4">
          <div className="relative aspect-square w-full overflow-hidden rounded-xl sm:rounded-2xl">
            {project.cover ? (
              // Project covers may use any validated HTTPS host, so they cannot use a fixed Next Image allowlist.
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={project.cover}
                alt=""
                loading="lazy"
                className="h-full w-full object-contain transition-transform duration-300 group-hover:scale-[1.025]"
              />
            ) : (
              <div
                aria-hidden="true"
                className="flex h-full w-full items-center justify-center bg-gradient-to-br from-pink-100 via-rose-50 to-purple-100 text-4xl font-black text-pink-500/80 dark:from-pink-950/70 dark:via-rose-950/50 dark:to-purple-950/70 dark:text-pink-300/80"
              >
                {getProjectInitial(project.name)}
              </div>
            )}
          </div>
        </div>
      </div>
    </article>
  );
}

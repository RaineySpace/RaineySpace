import type { Project } from "@/lib/projects";
import Link from "next/link";

interface ProjectListProps {
  projects: Project[];
}

export default function ProjectList({ projects }: ProjectListProps) {
  return (
    <div className="divide-y divide-gray-200 dark:divide-gray-800">
      {projects.map((project) => (
        <article
          key={project.id}
          className="py-5 first:pt-1"
        >
          <div className="flex items-baseline justify-between gap-4">
            <h3 className="text-xl font-bold">
              <Link
                href={project.detailHref}
                className="inline-block text-[--lightLink] hover:scale-[1.005] dark:text-[--darkLink]"
              >
                {project.name}
              </Link>
            </h3>
            <span className="shrink-0 text-xs text-gray-500 dark:text-gray-400">
              {project.year}
            </span>
          </div>
          <p className="mt-1 text-sm leading-relaxed text-gray-700 dark:text-gray-300">
            {project.summary}
          </p>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            {project.tags.map((tag) => (
              <span
                key={tag}
                className="rounded-md bg-gray-100 px-2 py-1 text-[10px] text-gray-800 dark:bg-gray-800 dark:text-gray-200"
              >
                {tag}
              </span>
            ))}
            <span className="ml-auto flex items-center gap-3">
              {project.projectUrl && (
                <a
                  href={project.projectUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="text-[11px] text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white"
                >
                  访问项目
                </a>
              )}
              {project.sourceUrl && (
                <a
                  href={project.sourceUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="text-[11px] text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white"
                >
                  查看源码
                </a>
              )}
            </span>
          </div>
        </article>
      ))}
    </div>
  );
}

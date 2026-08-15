import type { Project } from "@/lib/projects";
import ProjectCard from "@/app/components/ProjectCard";

interface ProjectListProps {
  projects: Project[];
  headingLevel?: "h2" | "h3";
  showCount?: boolean;
}

export default function ProjectList({
  projects,
  headingLevel = "h3",
  showCount = false,
}: ProjectListProps) {
  return (
    <div>
      <div className="grid grid-cols-1 gap-x-8 gap-y-1 sm:grid-cols-2 sm:gap-x-10">
        {projects.map((project) => (
          <ProjectCard
            key={project.id}
            project={project}
            headingLevel={headingLevel}
          />
        ))}
      </div>
      {showCount && (
        <p className="mt-6 text-right text-xs text-gray-400 dark:text-gray-500">
          {projects.length} 个项目
        </p>
      )}
    </div>
  );
}

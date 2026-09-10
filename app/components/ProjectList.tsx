import type { Project } from "@/lib/projects";
import ProjectCard from "@/app/components/ProjectCard";
import HoverCardList from "@/app/components/HoverCardList";

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
      <HoverCardList>
        {projects.map((project) => (
          <ProjectCard
            key={project.id}
            project={project}
            headingLevel={headingLevel}
          />
        ))}
      </HoverCardList>
      {showCount && (
        <p className="mt-6 text-right text-xs text-[--muted]">
          {`${projects.length} 个项目`}
        </p>
      )}
    </div>
  );
}

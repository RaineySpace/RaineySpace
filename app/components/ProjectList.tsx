import type { Project } from "@/lib/projects";
import ProjectCard from "@/app/components/ProjectCard";

interface ProjectListProps {
  projects: Project[];
  headingLevel?: "h2" | "h3";
}

export default function ProjectList({
  projects,
  headingLevel = "h3",
}: ProjectListProps) {
  return (
    <div className="grid gap-4">
      {projects.map((project) => (
        <ProjectCard
          key={project.id}
          project={project}
          headingLevel={headingLevel}
        />
      ))}
    </div>
  );
}

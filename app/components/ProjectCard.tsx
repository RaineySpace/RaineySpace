import type { Project } from "@/lib/projects";
import EntityCard from "@/app/components/EntityCard";

interface ProjectCardProps {
  project: Project;
  headingLevel?: "h2" | "h3";
}

export default function ProjectCard({
  project,
  headingLevel = "h3",
}: ProjectCardProps) {
  return (
    <EntityCard
      item={{
        id: project.id,
        name: project.name,
        url: project.url,
        description: project.description,
        icon: project.cover,
      }}
      headingLevel={headingLevel}
      visitLabel="访问项目"
    />
  );
}

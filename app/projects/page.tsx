import type { Metadata } from "next";
import ProjectList from "@/app/components/ProjectList";
import { getProjects } from "@/lib/projects";

export const metadata: Metadata = {
  title: "项目 - Rainey's Blog",
  description: "Rainey 的项目与个人实验。",
};

export default async function ProjectsPage() {
  const projects = await getProjects();

  return (
    <div className="page-content">
      <header className="mb-3">
        <h1 className="page-title">项目</h1>
        <p className="page-description">
          做过的一些产品、工具与个人实验。
        </p>
      </header>
      <ProjectList projects={projects} headingLevel="h2" showCount />
    </div>
  );
}

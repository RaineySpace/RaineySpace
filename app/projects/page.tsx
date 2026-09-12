import type { Metadata } from "next";
import ProjectList from "@/app/components/ProjectList";
import { getProjects } from "@/lib/projects";
import JsonLd from "@/app/components/JsonLd";
import { collectionJsonLd, pageMetadata, pages } from "@/lib/seo";

export const metadata: Metadata = pageMetadata(pages.projects);

export default async function ProjectsPage() {
  const projects = await getProjects();

  return (
    <div className="page-content">
      <JsonLd data={collectionJsonLd(pages.projects, projects.map((project) => ({
        url: project.url, name: project.name, description: project.description,
      })))} />
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

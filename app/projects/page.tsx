import type { Metadata } from "next";
import EntityList from "@/app/components/EntityList";
import { emptyCollectionMessage, entityTitle } from "@/lib/entity-rendering.ts";
import { getProjects } from "@/lib/projects";
import JsonLd from "@/app/components/JsonLd";
import { collectionJsonLd, pageMetadata, pages } from "@/lib/seo";

export const metadata: Metadata = pageMetadata(pages.projects);

export default async function ProjectsPage() {
  const projects = await getProjects();

  return (
    <div>
      <JsonLd data={collectionJsonLd(pages.projects, projects.map((project) => ({
        url: project.url, name: entityTitle(project), description: project.description,
      })))} />
      <header className="mb-3">
        <h1 className="page-title">项目</h1>
        <p className="page-description">
          做过的一些产品、工具与个人实验。
        </p>
      </header>
      <EntityList items={projects} headingLevel="h2" emptyLabel={emptyCollectionMessage.project} />
    </div>
  );
}

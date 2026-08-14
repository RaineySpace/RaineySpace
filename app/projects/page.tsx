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
    <div className="relative -top-2.5">
      <header className="mb-8">
        <h1 className="text-[28px] font-black leading-none text-[--title]">项目</h1>
        <p className="mt-3 text-sm text-gray-500 dark:text-gray-400">
          做过的一些产品、工具与个人实验。
        </p>
      </header>
      <ProjectList projects={projects} headingLevel="h2" />
    </div>
  );
}

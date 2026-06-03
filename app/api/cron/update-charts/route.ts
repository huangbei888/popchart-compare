import { NextResponse } from "next/server";

const OWNER = "huangbei888";
const REPO = "popchart-compare";
const REF = "main";

const workflows = [
  { name: "spotify", file: "update-spotify.yml" },
  { name: "billboard", file: "update-billboard.yml" },
] as const;

function isAuthorized(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  return request.headers.get("authorization") === `Bearer ${secret}`;
}

async function dispatchWorkflow(workflowFile: string, token: string) {
  const response = await fetch(
    `https://api.github.com/repos/${OWNER}/${REPO}/actions/workflows/${workflowFile}/dispatches`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        "X-GitHub-Api-Version": "2022-11-28",
      },
      body: JSON.stringify({ ref: REF }),
    },
  );

  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new Error(`${workflowFile} dispatch failed with ${response.status}: ${detail}`);
  }
}

export async function GET(request: Request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const token = process.env.GITHUB_WORKFLOW_DISPATCH_TOKEN;
  if (!token) {
    return NextResponse.json({ error: "Missing GITHUB_WORKFLOW_DISPATCH_TOKEN" }, { status: 500 });
  }

  const results = await Promise.allSettled(
    workflows.map(async (workflow) => {
      await dispatchWorkflow(workflow.file, token);
      return workflow.name;
    }),
  );

  const failed = results
    .map((result, index) => ({ result, workflow: workflows[index] }))
    .filter((item): item is { result: PromiseRejectedResult; workflow: (typeof workflows)[number] } => item.result.status === "rejected");

  if (failed.length > 0) {
    console.error("Chart workflow dispatch failed", failed);
    return NextResponse.json(
      {
        error: "Some workflows failed to dispatch",
        failed: failed.map((item) => ({
          workflow: item.workflow.name,
          message: item.result.reason instanceof Error ? item.result.reason.message : String(item.result.reason),
        })),
      },
      { status: 502 },
    );
  }

  return NextResponse.json({
    ok: true,
    dispatched: workflows.map((workflow) => workflow.name),
  });
}

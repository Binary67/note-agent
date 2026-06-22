import { getUploadProgress } from "@/lib/upload-progress";

export async function GET(request: Request) {
  const jobId = new URL(request.url).searchParams.get("jobId");

  if (!jobId) {
    return Response.json({ progress: null }, { status: 400 });
  }

  return Response.json({ progress: getUploadProgress(jobId) });
}

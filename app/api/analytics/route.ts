import { getQuestionAnalytics } from "@/lib/analytics";

export async function GET() {
  return Response.json(await getQuestionAnalytics());
}
